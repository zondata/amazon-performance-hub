import fs from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "../db/supabaseClient";
import { parseSpTargetingReport } from "../ads/parseSpTargetingReport";
import { chunkArray, hashFileSha256 } from "./utils";
import { retryAsync, isTransientSupabaseError, formatRetryError } from "../lib/retry";

export type SpTargetingIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  rowCount?: number;
  duplicateIdenticalRowCount?: number;
  duplicateAggregatedRowCount?: number;
};

type ExistingTargetingUploadRow = {
  upload_id: string;
  account_id: string;
  source_type: string;
  file_hash_sha256: string;
  exported_at: string | null;
};

type SpTargetingIngestOptions = {
  reprocessUploadId?: string;
};

type SpTargetingInsertRow = {
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
  top_of_search_impression_share: number | null;
  exported_at: string;
};

const TARGETING_ON_CONFLICT =
  "account_id,date,campaign_name_norm,ad_group_name_norm,targeting_norm,match_type_norm,exported_at";

const buildTargetingDuplicateKey = (row: SpTargetingInsertRow): string =>
  [
    row.account_id,
    row.date,
    row.campaign_name_norm,
    row.ad_group_name_norm,
    row.targeting_norm,
    row.match_type_norm ?? "",
    row.exported_at,
  ].join("||");

const summarizeTargetingKey = (row: SpTargetingInsertRow): string =>
  [
    `date=${row.date}`,
    `campaign=${row.campaign_name_raw}`,
    `ad_group=${row.ad_group_name_raw}`,
    `targeting=${row.targeting_raw}`,
    `match_type=${row.match_type_raw ?? row.match_type_norm ?? "UNKNOWN"}`,
    `exported_at=${row.exported_at}`,
  ].join(", ");

const serializeTargetingComparable = (row: SpTargetingInsertRow): string =>
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
    top_of_search_impression_share: row.top_of_search_impression_share,
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

const weightedAverageNullable = (
  leftValue: number | null,
  leftWeight: number | null,
  rightValue: number | null,
  rightWeight: number | null
): number | null => {
  const totalWeight = (leftWeight ?? 0) + (rightWeight ?? 0);
  if (totalWeight <= 0) return null;
  const leftContribution = leftValue === null || !leftWeight ? 0 : leftValue * leftWeight;
  const rightContribution = rightValue === null || !rightWeight ? 0 : rightValue * rightWeight;
  return (leftContribution + rightContribution) / totalWeight;
};

const aggregateTargetingRows = (
  left: SpTargetingInsertRow,
  right: SpTargetingInsertRow
): SpTargetingInsertRow => {
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
    top_of_search_impression_share: weightedAverageNullable(
      left.top_of_search_impression_share,
      left.impressions,
      right.top_of_search_impression_share,
      right.impressions
    ),
  };
};

const dedupeTargetingRows = (
  rows: SpTargetingInsertRow[]
): {
  rows: SpTargetingInsertRow[];
  duplicateIdenticalRowCount: number;
  duplicateAggregatedRowCount: number;
} => {
  const deduped = new Map<string, SpTargetingInsertRow>();
  let duplicateIdenticalRowCount = 0;
  let duplicateAggregatedRowCount = 0;

  for (const row of rows) {
    const key = buildTargetingDuplicateKey(row);
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, row);
      continue;
    }

    if (serializeTargetingComparable(existing) === serializeTargetingComparable(row)) {
      duplicateIdenticalRowCount += 1;
      continue;
    }
    duplicateAggregatedRowCount += 1;
    deduped.set(key, aggregateTargetingRows(existing, row));
  }

  return {
    rows: [...deduped.values()],
    duplicateIdenticalRowCount,
    duplicateAggregatedRowCount,
  };
};

async function fetchExistingTargetingUpload(uploadId: string): Promise<ExistingTargetingUploadRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("uploads")
    .select("upload_id,account_id,source_type,file_hash_sha256,exported_at")
    .eq("upload_id", uploadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch targeting upload ${uploadId}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Targeting upload ${uploadId} was not found.`);
  }
  if (data.source_type !== "sp_targeting") {
    throw new Error(`Upload ${uploadId} is ${data.source_type}, expected sp_targeting.`);
  }

  return data as ExistingTargetingUploadRow;
}

export async function ingestSpTargetingRaw(
  xlsxPath: string,
  accountId: string,
  exportedAtOverride?: string,
  options: SpTargetingIngestOptions = {}
): Promise<SpTargetingIngestResult> {
  const client = getSupabaseClient();
  const fileHash = hashFileSha256(xlsxPath);
  const filename = path.basename(xlsxPath);
  const reprocessUploadId = options.reprocessUploadId?.trim() || null;

  const existingUpload = reprocessUploadId
    ? await fetchExistingTargetingUpload(reprocessUploadId)
    : await retryAsync(
        async () => {
          const { data, error } = await client
            .from("uploads")
            .select("upload_id,account_id,source_type,file_hash_sha256,exported_at")
            .eq("account_id", accountId)
            .eq("file_hash_sha256", fileHash)
            .maybeSingle();
          if (error) throw error;
          return (data as ExistingTargetingUploadRow | null) ?? null;
        },
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

  if (existingUpload && existingUpload.account_id !== accountId) {
    throw new Error(
      `Upload ${existingUpload.upload_id} belongs to account ${existingUpload.account_id}, expected ${accountId}.`
    );
  }
  if (reprocessUploadId && (!existingUpload || existingUpload.file_hash_sha256 !== fileHash)) {
    throw new Error(
      `Refusing to reprocess ${reprocessUploadId}: local file hash does not match the original upload hash.`
    );
  }

  if (existingUpload?.upload_id) {
    const { count, error: countError } = await client
      .from("sp_targeting_daily_raw")
      .select("upload_id", { count: "exact", head: true })
      .eq("upload_id", existingUpload.upload_id);
    if (countError) {
      throw new Error(`Failed to check existing rows: ${countError.message}`);
    }
    if ((count ?? 0) > 0) {
      if (!reprocessUploadId) {
        return { status: "already ingested" };
      }
      const { error: deleteError } = await client
        .from("sp_targeting_daily_raw")
        .delete()
        .eq("upload_id", existingUpload.upload_id);
      if (deleteError) {
        throw new Error(`Failed clearing existing sp_targeting_daily_raw rows: ${deleteError.message}`);
      }
    }
  }

  const stats = fs.statSync(xlsxPath);
  const exportedAt =
    existingUpload?.exported_at ?? exportedAtOverride ?? stats.mtime.toISOString();

  const { rows, coverageStart, coverageEnd } = parseSpTargetingReport(xlsxPath);

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
      source_type: "sp_targeting",
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
  } else if (reprocessUploadId) {
    const { error: updateError } = await client
      .from("uploads")
      .update({
        coverage_start: coverageStart,
        coverage_end: coverageEnd,
      })
      .eq("upload_id", uploadId);
    if (updateError) {
      throw new Error(`Failed updating upload coverage for ${uploadId}: ${updateError.message}`);
    }
  }

  if (!uploadId) {
    throw new Error("Failed to resolve upload_id before targeting raw insert.");
  }

  const rowsToInsert: SpTargetingInsertRow[] = rows.map((row) => ({
    upload_id: uploadId,
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
    top_of_search_impression_share: row.top_of_search_impression_share,
    exported_at: exportedAt,
  }));

  const {
    rows: dedupedRowsToInsert,
    duplicateIdenticalRowCount,
    duplicateAggregatedRowCount,
  } = dedupeTargetingRows(rowsToInsert);

  for (const chunk of chunkArray(dedupedRowsToInsert, 500)) {
    const { error } = await client
      .from("sp_targeting_daily_raw")
      .upsert(chunk, {
        onConflict: TARGETING_ON_CONFLICT,
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`Failed inserting sp_targeting_daily_raw: ${error.message}`);
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
