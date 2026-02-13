import fs from "node:fs";
import path from "node:path";
import { getSupabaseClient } from "../db/supabaseClient";
import { parseHelium10KeywordTracker } from "../ranking/parseHelium10KeywordTracker";
import { chunkArray, hashFileSha256 } from "./utils";
import { retryAsync, isTransientSupabaseError, formatRetryError } from "../lib/retry";

export type Helium10KeywordTrackerIngestResult = {
  status: "ok" | "already ingested";
  uploadId?: string;
  rowCount?: number;
  coverageStart?: string | null;
  coverageEnd?: string | null;
  asin?: string;
  marketplaceDomainRaw?: string | null;
};

function inferExportedAtFromFilename(filename: string): string | null {
  const match = filename.match(/-(\d{4}-\d{2}-\d{2})\.csv$/i);
  if (!match) return null;
  return `${match[1]}T00:00:00Z`;
}

export async function ingestHelium10KeywordTrackerRaw(
  csvPath: string,
  accountId: string,
  marketplace: string,
  exportedAtOverride?: string
): Promise<Helium10KeywordTrackerIngestResult> {
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
      .from("h10_keyword_tracker_raw")
      .select("upload_id", { count: "exact", head: true })
      .eq("upload_id", existingUpload.upload_id);
    if (countError) {
      throw new Error(`Failed to check existing rows: ${countError.message}`);
    }
    if ((count ?? 0) > 0) {
      return { status: "already ingested" };
    }
  }

  const parsed = parseHelium10KeywordTracker(csvPath);

  const stats = fs.statSync(csvPath);
  const exportedAt =
    exportedAtOverride ?? inferExportedAtFromFilename(filename) ?? stats.mtime.toISOString();

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
      source_type: "h10_keyword_tracker",
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
    marketplace_domain_raw: row.marketplace_domain_raw,
    asin: row.asin,
    title: row.title,
    keyword_raw: row.keyword_raw,
    keyword_norm: row.keyword_norm,
    keyword_sales: row.keyword_sales,
    search_volume: row.search_volume,
    organic_rank_raw: row.organic_rank_raw,
    organic_rank_value: row.organic_rank_value,
    organic_rank_kind: row.organic_rank_kind,
    sponsored_pos_raw: row.sponsored_pos_raw,
    sponsored_pos_value: row.sponsored_pos_value,
    sponsored_pos_kind: row.sponsored_pos_kind,
    observed_at: row.observed_at,
    observed_date: row.observed_date,
    exported_at: exportedAt,
  }));

  for (const chunk of chunkArray(rowsToInsert, 500)) {
    const { error } = await client.from("h10_keyword_tracker_raw").insert(chunk);
    if (error) throw new Error(`Failed inserting h10_keyword_tracker_raw: ${error.message}`);
  }

  return {
    status: "ok",
    uploadId,
    rowCount: rowsToInsert.length,
    coverageStart: parsed.coverageStart,
    coverageEnd: parsed.coverageEnd,
    asin: parsed.asin,
    marketplaceDomainRaw: parsed.marketplace_domain_raw,
  };
}
