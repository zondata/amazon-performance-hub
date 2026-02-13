import fs from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "../db/supabaseClient";
import {
  buildScaleInsightsSalesTrendRawRows,
  parseAsinFromFilename,
  parseScaleInsightsSalesTrend,
} from "../sales/parseScaleInsightsSalesTrend";
import { chunkArray, hashFileSha256 } from "./utils";
import { retryAsync, isTransientSupabaseError, formatRetryError } from "../lib/retry";

export type ScaleInsightsSalesTrendIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  asin?: string;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  rowCount?: number;
  warningsCount?: number;
};

export async function ingestScaleInsightsSalesTrendRaw(
  csvPath: string,
  accountId: string,
  marketplace: string,
  exportedAtOverride?: string
): Promise<ScaleInsightsSalesTrendIngestResult> {
  const client = getSupabaseClient();
  const fileHash = hashFileSha256(csvPath);
  const filename = path.basename(csvPath);

  const asin = parseAsinFromFilename(filename);
  if (!asin) {
    throw new Error(
      "Cannot parse ASIN from filename. Rename file to start with ASIN, e.g. B0B2K57W5R SalesTrend - Name.csv"
    );
  }

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
      .from("si_sales_trend_daily_raw")
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

  const { rows, coverageStart, coverageEnd, warnings } = parseScaleInsightsSalesTrend(csvPath);

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
      source_type: "si_sales_trend",
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
    throw new Error("Failed to resolve upload_id after insert.");
  }

  const rowsToInsert = buildScaleInsightsSalesTrendRawRows({
    rows,
    accountId,
    marketplace,
    asin,
    uploadId,
    exportedAt,
  });

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    const { error } = await client.from("si_sales_trend_daily_raw").insert(chunk);
    if (error) throw new Error(`Failed inserting si_sales_trend_daily_raw: ${error.message}`);
  }

  return {
    status: "ok",
    uploadId,
    asin,
    coverageStart,
    coverageEnd,
    rowCount: rowsToInsert.length,
    warningsCount: warnings,
  };
}
