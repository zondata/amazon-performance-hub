import fs from "node:fs";
import { getSupabaseClient } from "../db/supabaseClient";
import { ingestSpPlacementRaw } from "../ingest/ingestSpPlacementRaw";
import { mapUpload } from "../mapping/db";
import { rejectDeprecatedAccountId } from "./_accountGuard";
import { buildSpPlacementReportPath, exportedAtIsoToUtcFolderDate } from "./spPlacementDateUtils";

type PlacementUploadRow = {
  upload_id: string;
  exported_at: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  original_filename: string | null;
};

const FETCH_LIMIT = 1000;

function usage() {
  console.log(
    "Usage: npm run repair:sp:placement:range -- --account-id <account> --root <reportsRoot> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--continue-on-error]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function fetchOverlappingSpPlacementUploads(
  accountId: string,
  from: string,
  to: string
): Promise<PlacementUploadRow[]> {
  const client = getSupabaseClient();
  const rows: PlacementUploadRow[] = [];
  let offset = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await client
      .from("uploads")
      .select("upload_id,exported_at,coverage_start,coverage_end,original_filename")
      .eq("account_id", accountId)
      .eq("source_type", "sp_placement")
      .lte("coverage_start", to)
      .gte("coverage_end", from)
      .order("exported_at", { ascending: true })
      .order("upload_id", { ascending: true })
      .range(offset, offset + FETCH_LIMIT - 1);

    if (error) {
      throw new Error(`Failed fetching overlapping sp_placement uploads: ${error.message}`);
    }

    const chunk = (data ?? []) as PlacementUploadRow[];
    rows.push(...chunk);
    if (chunk.length < FETCH_LIMIT) break;
    offset += FETCH_LIMIT;
  }

  return rows;
}

async function main() {
  const accountId = getArg("--account-id");
  if (accountId) rejectDeprecatedAccountId(accountId);
  const root = getArg("--root");
  const from = getArg("--from");
  const to = getArg("--to");
  const dryRun = hasFlag("--dry-run");
  const continueOnError = hasFlag("--continue-on-error");

  if (!accountId || !root || !from || !to) {
    usage();
    process.exit(1);
  }

  const uploads = await fetchOverlappingSpPlacementUploads(accountId, from, to);
  console.log(
    `Found ${uploads.length} overlapping sp_placement upload(s) for ${accountId} in ${from}..${to}.`
  );

  let repaired = 0;
  let skippedMissingExportedAt = 0;
  let skippedMissingFile = 0;
  let failed = 0;

  for (const upload of uploads) {
    const uploadId = upload.upload_id;
    if (!upload.exported_at) {
      skippedMissingExportedAt += 1;
      console.warn(`[skip] upload_id=${uploadId} has null exported_at.`);
      continue;
    }

    try {
      const folderDate = exportedAtIsoToUtcFolderDate(upload.exported_at);
      const xlsxPath = buildSpPlacementReportPath(root, folderDate);
      if (!fs.existsSync(xlsxPath)) {
        skippedMissingFile += 1;
        console.warn(
          `[skip] upload_id=${uploadId} missing report file; expected path: ${xlsxPath}`
        );
        continue;
      }

      const exportedAt = `${folderDate}T00:00:00Z`;
      if (dryRun) {
        console.log(
          `[dry-run] upload_id=${uploadId} would reingest+map file=${xlsxPath} exported_at=${exportedAt}`
        );
        continue;
      }

      const ingestResult = await ingestSpPlacementRaw(xlsxPath, accountId, exportedAt, { force: true });
      if (ingestResult.status !== "ok" || !ingestResult.uploadId) {
        throw new Error("Expected force reingest to return status=ok with uploadId.");
      }

      const mappingResult = await mapUpload(ingestResult.uploadId, "sp_placement");
      repaired += 1;

      console.log(
        JSON.stringify(
          {
            sourceUploadId: uploadId,
            repairedUploadId: ingestResult.uploadId,
            folderDate,
            ingest: {
              rowCount: ingestResult.rowCount ?? 0,
              coverageStart: ingestResult.coverageStart ?? null,
              coverageEnd: ingestResult.coverageEnd ?? null,
            },
            mapping: {
              status: mappingResult.status,
              factRows: mappingResult.factRows,
              issueRows: mappingResult.issueRows,
            },
          },
          null,
          2
        )
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[failed] upload_id=${uploadId}: ${message}`);
      if (!continueOnError) {
        throw error;
      }
    }
  }

  console.log(
    JSON.stringify(
      {
        accountId,
        from,
        to,
        dryRun,
        continueOnError,
        totals: {
          matchedUploads: uploads.length,
          repaired,
          skippedMissingExportedAt,
          skippedMissingFile,
          failed,
        },
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
