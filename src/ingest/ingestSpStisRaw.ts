import fs from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "../db/supabaseClient";
import { parseSpStisReport } from "../ads/parseSpStisReport";
import { chunkArray, hashFileSha256 } from "./utils";
import { retryAsync, isTransientSupabaseError, formatRetryError } from "../lib/retry";

export type SpStisIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  rowCount?: number;
};

export async function ingestSpStisRaw(
  csvPath: string,
  accountId: string,
  exportedAtOverride?: string
): Promise<SpStisIngestResult> {
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
      .from("sp_stis_daily_raw")
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

  const { rows, coverageStart, coverageEnd } = parseSpStisReport(csvPath);

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
      source_type: "sp_stis",
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

  const rowsToInsert = rows.map((row) => ({
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
    customer_search_term_raw: row.customer_search_term_raw,
    customer_search_term_norm: row.customer_search_term_norm,
    search_term_impression_rank: row.search_term_impression_rank,
    search_term_impression_share: row.search_term_impression_share,
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

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    const { error } = await client.from("sp_stis_daily_raw").insert(chunk);
    if (error) throw new Error(`Failed inserting sp_stis_daily_raw: ${error.message}`);
  }

  return {
    status: "ok",
    uploadId,
    coverageStart,
    coverageEnd,
    rowCount: rowsToInsert.length,
  };
}
