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

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    const { error } = await client.from("sp_targeting_daily_raw").insert(chunk);
    if (error) throw new Error(`Failed inserting sp_targeting_daily_raw: ${error.message}`);
  }

  return {
    status: "ok",
    uploadId,
    coverageStart,
    coverageEnd,
    rowCount: rowsToInsert.length,
  };
}
