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
  const exportedAt = exportedAtOverride ?? stats.mtime.toISOString();

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

  const rowsToInsert = rows.map((row) => ({
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

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    const { error } = await client.from("sp_placement_daily_raw").insert(chunk);
    if (error) throw new Error(`Failed inserting sp_placement_daily_raw: ${error.message}`);
  }

  return {
    status: "ok",
    uploadId,
    coverageStart,
    coverageEnd,
    rowCount: rowsToInsert.length,
  };
}
