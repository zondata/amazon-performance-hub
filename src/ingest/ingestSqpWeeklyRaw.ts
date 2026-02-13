import fs from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "../db/supabaseClient";
import { parseSqpReport } from "../sqp/parseSqpReport";
import { chunkArray, hashFileSha256 } from "./utils";
import { retryAsync, isTransientSupabaseError, formatRetryError } from "../lib/retry";

export type SqpWeeklyIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  rowCount?: number;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  warningsCount?: number;
  scopeType?: "brand" | "asin";
  scopeValue?: string;
};

export async function ingestSqpWeeklyRaw(
  csvPath: string,
  accountId: string,
  marketplace: string,
  exportedAtOverride?: string
): Promise<SqpWeeklyIngestResult> {
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
      .from("sqp_weekly_raw")
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

  const parsed = parseSqpReport(csvPath);

  const { error: accountError } = await client
    .from("accounts")
    .upsert({ account_id: accountId, marketplace }, { onConflict: "account_id" });
  if (accountError) {
    throw new Error(`Failed to upsert account: ${accountError.message}`);
  }

  let uploadId = existingUpload?.upload_id as string | undefined;
  if (!uploadId) {
    const uploadPayload = {
      account_id: accountId,
      source_type: "sqp",
      original_filename: filename,
      file_hash_sha256: fileHash,
      exported_at: exportedAt,
      coverage_start: parsed.coverageStart,
      coverage_end: parsed.coverageEnd,
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
    throw new Error("Failed to resolve upload_id after insert.");
  }

  const rowsToInsert = parsed.rows.map((row) => ({
    upload_id: uploadId,
    account_id: accountId,
    marketplace,
    scope_type: parsed.scopeType,
    scope_value: parsed.scopeValue,
    week_start: parsed.weekStart,
    week_end: parsed.weekEnd,
    reporting_date: row.reporting_date,
    search_query_raw: row.search_query_raw,
    search_query_norm: row.search_query_norm,
    search_query_score: row.search_query_score,
    search_query_volume: row.search_query_volume,

    impressions_total: row.impressions_total,
    impressions_self: row.impressions_self,
    impressions_self_share: row.impressions_self_share,

    clicks_total: row.clicks_total,
    clicks_rate_per_query: row.clicks_rate_per_query,
    clicks_self: row.clicks_self,
    clicks_self_share: row.clicks_self_share,
    clicks_price_median_total: row.clicks_price_median_total,
    clicks_price_median_self: row.clicks_price_median_self,
    clicks_same_day_ship: row.clicks_same_day_ship,
    clicks_1d_ship: row.clicks_1d_ship,
    clicks_2d_ship: row.clicks_2d_ship,

    cart_adds_total: row.cart_adds_total,
    cart_add_rate_per_query: row.cart_add_rate_per_query,
    cart_adds_self: row.cart_adds_self,
    cart_adds_self_share: row.cart_adds_self_share,
    cart_adds_price_median_total: row.cart_adds_price_median_total,
    cart_adds_price_median_self: row.cart_adds_price_median_self,
    cart_adds_same_day_ship: row.cart_adds_same_day_ship,
    cart_adds_1d_ship: row.cart_adds_1d_ship,
    cart_adds_2d_ship: row.cart_adds_2d_ship,

    purchases_total: row.purchases_total,
    purchases_rate_per_query: row.purchases_rate_per_query,
    purchases_self: row.purchases_self,
    purchases_self_share: row.purchases_self_share,
    purchases_price_median_total: row.purchases_price_median_total,
    purchases_price_median_self: row.purchases_price_median_self,
    purchases_same_day_ship: row.purchases_same_day_ship,
    purchases_1d_ship: row.purchases_1d_ship,
    purchases_2d_ship: row.purchases_2d_ship,

    exported_at: exportedAt,
  }));

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    const { error } = await client.from("sqp_weekly_raw").insert(chunk);
    if (error) throw new Error(`Failed inserting sqp_weekly_raw: ${error.message}`);
  }

  return {
    status: "ok",
    uploadId,
    rowCount: rowsToInsert.length,
    coverageStart: parsed.coverageStart,
    coverageEnd: parsed.coverageEnd,
    warningsCount: parsed.warnings.length,
    scopeType: parsed.scopeType,
    scopeValue: parsed.scopeValue,
  };
}
