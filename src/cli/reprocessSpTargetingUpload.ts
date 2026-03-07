import { getSupabaseClient } from "../db/supabaseClient";
import { getSpTargetingXlsx, resolveDateFolder } from "../fs/reportLocator";
import { ingestSpTargetingRaw } from "../ingest/ingestSpTargetingRaw";
import { mapUpload } from "../mapping/db";

type UploadRow = {
  upload_id: string;
  account_id: string;
  source_type: string;
  exported_at: string | null;
};

function usage() {
  console.log("Usage: npm run reprocess:sp:targeting -- <upload-id> [upload-id ...]");
}

function getPositionalArgs(): string[] {
  return process.argv
    .slice(2)
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && !value.startsWith("--"));
}

function extractDate(iso: string | null): string | null {
  if (!iso) return null;
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
}

async function fetchUpload(uploadId: string): Promise<UploadRow> {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from("uploads")
    .select("upload_id,account_id,source_type,exported_at")
    .eq("upload_id", uploadId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch upload ${uploadId}: ${error.message}`);
  }
  if (!data) {
    throw new Error(`Upload ${uploadId} was not found.`);
  }
  if (data.source_type !== "sp_targeting") {
    throw new Error(`Upload ${uploadId} is ${data.source_type}, expected sp_targeting.`);
  }

  return data as UploadRow;
}

async function main() {
  const uploadIds = getPositionalArgs();
  if (uploadIds.length === 0) {
    usage();
    process.exit(1);
  }

  for (const uploadId of uploadIds) {
    const upload = await fetchUpload(uploadId);
    const exportedAtDate = extractDate(upload.exported_at);
    if (!exportedAtDate) {
      throw new Error(`Upload ${uploadId} has no exported_at date.`);
    }

    const dateFolder = resolveDateFolder(exportedAtDate);
    const xlsxPath = getSpTargetingXlsx(dateFolder);
    const ingestResult = await ingestSpTargetingRaw(xlsxPath, upload.account_id, undefined, {
      reprocessUploadId: uploadId,
    });
    const mapResult = await mapUpload(uploadId, "sp_targeting");

    console.log("Reprocessed targeting upload.");
    console.log({
      uploadId,
      dateFolder,
      xlsxPath,
      ingestResult,
      mapResult,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
