import { ingestSpPlacementRaw } from "../ingest/ingestSpPlacementRaw";
import { mapUpload } from "../mapping/db";
import { deriveExportedAtFromPath } from "./spPlacementDateUtils";

function usage() {
  console.log(
    "Usage: npm run reingest:sp:placement -- --account-id US <xlsx> [--exported-at ISO]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function getPositionalArgs(): string[] {
  const args = process.argv.slice(2);
  const positionals: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      i += 1;
      continue;
    }
    positionals.push(arg);
  }
  return positionals;
}

async function main() {
  const accountId = getArg("--account-id");
  const exportedAtArg = getArg("--exported-at");
  const positionals = getPositionalArgs();
  const xlsxPath = positionals[0];

  if (!accountId || !xlsxPath) {
    usage();
    process.exit(1);
  }

  const exportedAt = exportedAtArg ?? deriveExportedAtFromPath(xlsxPath);
  if (!exportedAtArg && exportedAt) {
    console.log(`Derived exported_at from path: ${exportedAt}`);
  }

  const ingestResult = await ingestSpPlacementRaw(xlsxPath, accountId, exportedAt, { force: true });
  if (ingestResult.status !== "ok" || !ingestResult.uploadId) {
    throw new Error("Expected force reingest to return status=ok with uploadId.");
  }

  const mappingResult = await mapUpload(ingestResult.uploadId, "sp_placement");

  console.log("Reingest + mapping complete.");
  console.log({
    uploadId: ingestResult.uploadId,
    ingest: {
      rowCount: ingestResult.rowCount,
      coverageStart: ingestResult.coverageStart,
      coverageEnd: ingestResult.coverageEnd,
    },
    mapping: mappingResult,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
