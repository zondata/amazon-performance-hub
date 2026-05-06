const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { parseHelium10KeywordTracker } = require("./parseHelium10KeywordTrackerCore");

function hashFileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function inferExportedAtFromFilename(filename) {
  const match = filename.match(/-(\d{4}-\d{2}-\d{2})\.csv$/i);
  if (!match) return null;
  return `${match[1]}T00:00:00Z`;
}

async function ingestHelium10KeywordTrackerRawWithClient(options) {
  const {
    client,
    csvPath,
    accountId,
    marketplace,
    exportedAtOverride,
    originalFilenameOverride,
  } = options;

  const fileHash = hashFileSha256(csvPath);
  const normalizedOriginalFilename = originalFilenameOverride
    ? path.basename(originalFilenameOverride.replace(/\\/g, "/").trim())
    : null;
  const filename = normalizedOriginalFilename || path.basename(csvPath);

  const { data: existingUpload, error: existingError } = await client
    .from("uploads")
    .select("upload_id")
    .eq("account_id", accountId)
    .eq("file_hash_sha256", fileHash)
    .maybeSingle();
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

  let uploadId = existingUpload?.upload_id;
  if (!uploadId) {
    const { data: uploadRow, error: uploadError } = await client
      .from("uploads")
      .insert({
        account_id: accountId,
        source_type: "h10_keyword_tracker",
        original_filename: filename,
        file_hash_sha256: fileHash,
        exported_at: exportedAt,
        coverage_start: parsed.coverageStart,
        coverage_end: parsed.coverageEnd,
        snapshot_date: null,
      })
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
    if (error) {
      throw new Error(`Failed inserting h10_keyword_tracker_raw: ${error.message}`);
    }
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

module.exports = {
  inferExportedAtFromFilename,
  ingestHelium10KeywordTrackerRawWithClient,
};
