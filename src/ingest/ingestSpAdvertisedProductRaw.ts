import fs from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "../db/supabaseClient";
import { parseSpAdvertisedProductReport } from "../sp/parseSpAdvertisedProductReport";
import { chunkArray, hashFileSha256 } from "./utils";
import { retryAsync, isTransientSupabaseError, formatRetryError } from "../lib/retry";

export type SpAdvertisedProductIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  rowCount?: number;
};

export async function ingestSpAdvertisedProductRaw(
  xlsxPath: string,
  accountId: string,
  exportedAtOverride?: string
): Promise<SpAdvertisedProductIngestResult> {
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
    const existingExportedAt = existingUpload.exported_at;
    const { count, error: countError } = await client
      .from("sp_advertised_product_daily_fact")
      .select("account_id", { count: "exact", head: true })
      .eq("account_id", accountId)
      .eq("exported_at", existingExportedAt);

    if (countError) {
      throw new Error(`Failed to check existing rows: ${countError.message}`);
    }
    if ((count ?? 0) > 0) {
      return { status: "already ingested" };
    }
  }

  const stats = fs.statSync(xlsxPath);
  const exportedAt = exportedAtOverride ?? existingUpload?.exported_at ?? stats.mtime.toISOString();
  const { rows, coverageStart, coverageEnd } = parseSpAdvertisedProductReport(xlsxPath);

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
      source_type: "sp_advertised_product",
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
    account_id: accountId,
    date: row.date,
    campaign_id: row.campaign_id,
    ad_group_id: row.ad_group_id,
    campaign_name_raw: row.campaign_name_raw,
    campaign_name_norm: row.campaign_name_norm,
    ad_group_name_raw: row.ad_group_name_raw,
    ad_group_name_norm: row.ad_group_name_norm,
    advertised_asin_raw: row.advertised_asin_raw,
    advertised_asin_norm: row.advertised_asin_norm,
    sku_raw: row.sku_raw,
    impressions: row.impressions,
    clicks: row.clicks,
    spend: row.spend,
    sales: row.sales,
    orders: row.orders,
    units: row.units,
    exported_at: exportedAt,
  }));

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    const { error } = await client.from("sp_advertised_product_daily_fact").insert(chunk);
    if (error) {
      throw new Error(`Failed inserting sp_advertised_product_daily_fact: ${error.message}`);
    }
  }

  return {
    status: "ok",
    uploadId,
    coverageStart,
    coverageEnd,
    rowCount: rowsToInsert.length,
  };
}
