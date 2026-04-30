import fs from "node:fs";
import path from "node:path";

import { parseSpSearchTermReport } from "../ads/parseSpSearchTermReport";
import { getSupabaseClient } from "../db/supabaseClient";
import { formatRetryError, isTransientSupabaseError, retryAsync } from "../lib/retry";
import { chunkArray, hashFileSha256 } from "./utils";

export type SpSearchTermIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  rowCount?: number;
  duplicateIdenticalRowCount?: number;
  duplicateAggregatedRowCount?: number;
};

type SpSearchTermInsertRow = {
  upload_id: string;
  account_id: string;
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  ad_group_name_raw: string;
  ad_group_name_norm: string;
  targeting_raw: string;
  targeting_norm: string;
  match_type_raw: string | null;
  match_type_norm: string | null;
  keyword_type: string | null;
  target_status: string | null;
  search_term_raw: string;
  search_term_norm: string;
  impressions: number | null;
  clicks: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  units: number | null;
  cpc: number | null;
  ctr: number | null;
  acos: number | null;
  roas: number | null;
  conversion_rate: number | null;
  exported_at: string;
};

const SEARCH_TERM_ON_CONFLICT =
  "account_id,date,campaign_name_norm,ad_group_name_norm,targeting_norm,match_type_norm,search_term_norm,exported_at";

const buildDuplicateKey = (row: SpSearchTermInsertRow): string =>
  [
    row.account_id,
    row.date,
    row.campaign_name_norm,
    row.ad_group_name_norm,
    row.targeting_norm,
    row.match_type_norm ?? "",
    row.search_term_norm,
    row.exported_at,
  ].join("||");

const serializeComparable = (row: SpSearchTermInsertRow): string =>
  JSON.stringify({
    date: row.date,
    portfolio_name_raw: row.portfolio_name_raw,
    portfolio_name_norm: row.portfolio_name_norm,
    campaign_name_raw: row.campaign_name_raw,
    campaign_name_norm: row.campaign_name_norm,
    ad_group_name_raw: row.ad_group_name_raw,
    ad_group_name_norm: row.ad_group_name_norm,
    targeting_raw: row.targeting_raw,
    targeting_norm: row.targeting_norm,
    match_type_raw: row.match_type_raw,
    match_type_norm: row.match_type_norm,
    keyword_type: row.keyword_type,
    target_status: row.target_status,
    search_term_raw: row.search_term_raw,
    search_term_norm: row.search_term_norm,
    impressions: row.impressions,
    clicks: row.clicks,
    spend: row.spend,
    sales: row.sales,
    orders: row.orders,
    units: row.units,
    cpc: row.cpc,
    ctr: row.ctr,
    acos: row.acos,
    roas: row.roas,
    conversion_rate: row.conversion_rate,
    exported_at: row.exported_at,
  });

const sumNullableNumber = (left: number | null, right: number | null): number | null => {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
};

const safeDivide = (numerator: number | null, denominator: number | null): number | null => {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
};

const aggregateRows = (
  left: SpSearchTermInsertRow,
  right: SpSearchTermInsertRow
): SpSearchTermInsertRow => {
  const impressions = sumNullableNumber(left.impressions, right.impressions);
  const clicks = sumNullableNumber(left.clicks, right.clicks);
  const spend = sumNullableNumber(left.spend, right.spend);
  const sales = sumNullableNumber(left.sales, right.sales);
  const orders = sumNullableNumber(left.orders, right.orders);
  const units = sumNullableNumber(left.units, right.units);
  return {
    ...left,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units,
    cpc: safeDivide(spend, clicks),
    ctr: safeDivide(clicks, impressions),
    acos: safeDivide(spend, sales),
    roas: safeDivide(sales, spend),
    conversion_rate: safeDivide(orders, clicks),
  };
};

const dedupeRows = (
  rows: SpSearchTermInsertRow[]
): {
  rows: SpSearchTermInsertRow[];
  duplicateIdenticalRowCount: number;
  duplicateAggregatedRowCount: number;
} => {
  const deduped = new Map<string, SpSearchTermInsertRow>();
  let duplicateIdenticalRowCount = 0;
  let duplicateAggregatedRowCount = 0;

  for (const row of rows) {
    const key = buildDuplicateKey(row);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, row);
      continue;
    }
    if (serializeComparable(existing) === serializeComparable(row)) {
      duplicateIdenticalRowCount += 1;
      continue;
    }
    duplicateAggregatedRowCount += 1;
    deduped.set(key, aggregateRows(existing, row));
  }

  return {
    rows: [...deduped.values()],
    duplicateIdenticalRowCount,
    duplicateAggregatedRowCount,
  };
};

export async function ingestSpSearchTermRaw(
  csvPath: string,
  accountId: string,
  exportedAtOverride?: string
): Promise<SpSearchTermIngestResult> {
  const client = getSupabaseClient();
  const fileHash = hashFileSha256(csvPath);
  const filename = path.basename(csvPath);

  const { data: existingUpload, error: existingError } = await retryAsync(
    () =>
      client
        .from("uploads")
        .select("upload_id")
        .eq("account_id", accountId)
        .eq("file_hash_sha256", fileHash)
        .maybeSingle(),
    {
      retries: 3,
      delaysMs: [1000, 3000, 7000],
      shouldRetry: isTransientSupabaseError,
      onRetry: ({ attempt, error, delayMs }) => {
        console.warn(
          `Retrying upload lookup (attempt ${attempt}/3, ${delayMs}ms): ${formatRetryError(error)}`
        );
      },
    }
  );

  if (existingError) {
    throw new Error(`Failed to check existing upload: ${existingError.message}`);
  }

  if (existingUpload?.upload_id) {
    const { count, error: countError } = await client
      .from("sp_search_term_daily_raw")
      .select("upload_id", { count: "exact", head: true })
      .eq("upload_id", existingUpload.upload_id);
    if (countError) {
      throw new Error(`Failed to check existing rows: ${countError.message}`);
    }
    if ((count ?? 0) > 0) {
      return { status: "already ingested" };
    }
  }

  const stats = fs.statSync(csvPath);
  const exportedAt = exportedAtOverride ?? stats.mtime.toISOString();
  const { rows, coverageStart, coverageEnd } = parseSpSearchTermReport(csvPath);

  const { error: accountError } = await client
    .from("accounts")
    .upsert({ account_id: accountId }, { onConflict: "account_id" });
  if (accountError) {
    throw new Error(`Failed to upsert account: ${accountError.message}`);
  }

  let uploadId = existingUpload?.upload_id as string | undefined;
  if (!uploadId) {
    const uploadPayload = {
      account_id: accountId,
      source_type: "sp_search_term",
      original_filename: filename,
      file_hash_sha256: fileHash,
      exported_at: exportedAt,
      coverage_start: coverageStart,
      coverage_end: coverageEnd,
      snapshot_date: null,
    };
    const { data: uploadRow, error: uploadError } = await client
      .from("uploads")
      .insert(uploadPayload)
      .select("upload_id")
      .single();
    if (uploadError) {
      throw new Error(`Failed to insert upload: ${uploadError.message}`);
    }
    uploadId = uploadRow.upload_id;
  }

  const insertRows = rows.map<SpSearchTermInsertRow>((row) => ({
    upload_id: uploadId as string,
    account_id: accountId,
    date: row.date,
    portfolio_name_raw: row.portfolio_name_raw,
    portfolio_name_norm: row.portfolio_name_norm,
    campaign_name_raw: row.campaign_name_raw,
    campaign_name_norm: row.campaign_name_norm,
    ad_group_name_raw: row.ad_group_name_raw,
    ad_group_name_norm: row.ad_group_name_norm,
    targeting_raw: row.targeting_raw,
    targeting_norm: row.targeting_norm,
    match_type_raw: row.match_type_raw,
    match_type_norm: row.match_type_norm,
    keyword_type: row.keyword_type,
    target_status: row.target_status,
    search_term_raw: row.search_term_raw,
    search_term_norm: row.search_term_norm,
    impressions: row.impressions,
    clicks: row.clicks,
    spend: row.spend,
    sales: row.sales,
    orders: row.orders,
    units: row.units,
    cpc: row.cpc,
    ctr: row.ctr,
    acos: row.acos,
    roas: row.roas,
    conversion_rate: row.conversion_rate,
    exported_at: exportedAt,
  }));

  const deduped = dedupeRows(insertRows);
  for (const chunk of chunkArray(deduped.rows, 500)) {
    const { error } = await client
      .from("sp_search_term_daily_raw")
      .upsert(chunk, { onConflict: SEARCH_TERM_ON_CONFLICT, ignoreDuplicates: false });
    if (error) {
      throw new Error(`Failed inserting sp_search_term_daily_raw: ${error.message}`);
    }
  }

  return {
    status: "ok",
    uploadId,
    coverageStart,
    coverageEnd,
    rowCount: deduped.rows.length,
    duplicateIdenticalRowCount: deduped.duplicateIdenticalRowCount,
    duplicateAggregatedRowCount: deduped.duplicateAggregatedRowCount,
  };
}
