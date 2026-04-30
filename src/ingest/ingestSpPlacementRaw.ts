import fs from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "../db/supabaseClient";
import { parseSpPlacementReport } from "../ads/parseSpPlacementReport";
import { chunkArray, hashFileSha256 } from "./utils";
import { retryAsync, isTransientSupabaseError, formatRetryError } from "../lib/retry";

export type SpPlacementIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  rowCount?: number;
  duplicateIdenticalRowCount?: number;
  duplicateAggregatedRowCount?: number;
};

type SpPlacementInsertRow = {
  upload_id: string;
  account_id: string;
  date: string;
  portfolio_name_raw: string | null;
  portfolio_name_norm: string | null;
  campaign_name_raw: string;
  campaign_name_norm: string;
  bidding_strategy: string | null;
  placement_raw: string;
  placement_raw_norm: string;
  placement_code: string;
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
  exported_at: string;
};

const PLACEMENT_ON_CONFLICT =
  "account_id,date,campaign_name_norm,placement_code,placement_raw_norm,exported_at";

const buildPlacementDuplicateKey = (row: SpPlacementInsertRow): string =>
  [
    row.account_id,
    row.date,
    row.campaign_name_norm,
    row.placement_code,
    row.placement_raw_norm,
    row.exported_at,
  ].join("||");

const serializePlacementComparable = (row: SpPlacementInsertRow): string =>
  JSON.stringify({
    date: row.date,
    portfolio_name_raw: row.portfolio_name_raw,
    portfolio_name_norm: row.portfolio_name_norm,
    campaign_name_raw: row.campaign_name_raw,
    campaign_name_norm: row.campaign_name_norm,
    bidding_strategy: row.bidding_strategy,
    placement_raw: row.placement_raw,
    placement_raw_norm: row.placement_raw_norm,
    placement_code: row.placement_code,
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

const aggregatePlacementRows = (
  left: SpPlacementInsertRow,
  right: SpPlacementInsertRow
): SpPlacementInsertRow => {
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
  };
};

const dedupePlacementRows = (
  rows: SpPlacementInsertRow[]
): {
  rows: SpPlacementInsertRow[];
  duplicateIdenticalRowCount: number;
  duplicateAggregatedRowCount: number;
} => {
  const deduped = new Map<string, SpPlacementInsertRow>();
  let duplicateIdenticalRowCount = 0;
  let duplicateAggregatedRowCount = 0;

  for (const row of rows) {
    const key = buildPlacementDuplicateKey(row);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, row);
      continue;
    }
    if (serializePlacementComparable(existing) === serializePlacementComparable(row)) {
      duplicateIdenticalRowCount += 1;
      continue;
    }
    duplicateAggregatedRowCount += 1;
    deduped.set(key, aggregatePlacementRows(existing, row));
  }

  return {
    rows: [...deduped.values()],
    duplicateIdenticalRowCount,
    duplicateAggregatedRowCount,
  };
};

export async function ingestSpPlacementRaw(
  xlsxPath: string,
  accountId: string,
  exportedAtOverride?: string,
  opts?: { force?: boolean }
): Promise<SpPlacementIngestResult> {
  const client = getSupabaseClient();
  const fileHash = hashFileSha256(xlsxPath);
  const filename = path.basename(xlsxPath);

  const { data: existingUpload, error: existingError } = await retryAsync(
    () =>
      client
        .from("uploads")
        .select("upload_id,exported_at")
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
      .from("sp_placement_daily_raw")
      .select("upload_id", { count: "exact", head: true })
      .eq("upload_id", existingUpload.upload_id);

    if (countError) {
      throw new Error(`Failed to check existing rows: ${countError.message}`);
    }
    if ((count ?? 0) > 0) {
      if (opts?.force) {
        const { error: deleteError } = await client
          .from("sp_placement_daily_raw")
          .delete()
          .eq("upload_id", existingUpload.upload_id);
        if (deleteError) {
          throw new Error(`Failed to clear existing rows for force reingest: ${deleteError.message}`);
        }
      } else {
        return { status: "already ingested" };
      }
    }
  }

  const stats = fs.statSync(xlsxPath);
  const exportedAt = exportedAtOverride ?? existingUpload?.exported_at ?? stats.mtime.toISOString();

  const { rows, coverageStart, coverageEnd } = parseSpPlacementReport(xlsxPath);

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
      source_type: "sp_placement",
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
  if (!uploadId) {
    throw new Error("Failed to resolve upload_id before placement raw insert.");
  }

  const rowsToInsert: SpPlacementInsertRow[] = rows.map((row) => ({
    upload_id: uploadId,
    account_id: accountId,
    date: row.date,
    portfolio_name_raw: row.portfolio_name_raw,
    portfolio_name_norm: row.portfolio_name_norm,
    campaign_name_raw: row.campaign_name_raw,
    campaign_name_norm: row.campaign_name_norm,
    bidding_strategy: row.bidding_strategy,
    placement_raw: row.placement_raw,
    placement_raw_norm: row.placement_raw_norm, // ✅ added
    placement_code: row.placement_code,
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
    exported_at: exportedAt,
  }));

  const {
    rows: dedupedRowsToInsert,
    duplicateIdenticalRowCount,
    duplicateAggregatedRowCount,
  } = dedupePlacementRows(rowsToInsert);

  for (const chunk of chunkArray(dedupedRowsToInsert, 500)) {
    const { error } = await client.from("sp_placement_daily_raw").upsert(chunk, {
      onConflict: PLACEMENT_ON_CONFLICT,
      ignoreDuplicates: true,
    });
    if (error) throw new Error(`Failed inserting sp_placement_daily_raw: ${error.message}`);
  }

  return {
    status: "ok",
    uploadId,
    coverageStart,
    coverageEnd,
    rowCount: dedupedRowsToInsert.length,
    duplicateIdenticalRowCount,
    duplicateAggregatedRowCount,
  };
}
