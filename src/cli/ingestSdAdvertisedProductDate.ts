import { ingestSdAdvertisedProductRaw } from "../ingest/ingestSdAdvertisedProductRaw";
import { resolveDateFolder, getSdAdvertisedProductXlsx } from "../fs/reportLocator";

function usage() {
  console.log(
    "Usage: npm run ingest:sd:advertised:date -- --account-id <id> <date-folder-or-date> [--exported-at ISO]\n" +
      "If --exported-at is omitted, the folder date is used as YYYY-MM-DDT00:00:00Z."
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

function exportedAtFromFolder(dateFolder: string): string | null {
  const match = dateFolder.match(/(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  return `${match[1]}T00:00:00Z`;
}

async function main() {
  const accountId = getArg("--account-id");
  const exportedAtArg = getArg("--exported-at");
  const positionals = getPositionalArgs();
  const dateInput = positionals[0];

  if (!accountId || !dateInput) {
    usage();
    process.exit(1);
  }

  const dateFolder = resolveDateFolder(dateInput);
  const xlsxPath = getSdAdvertisedProductXlsx(dateFolder);
  const exportedAt = exportedAtArg ?? exportedAtFromFolder(dateFolder) ?? undefined;

  const result = await ingestSdAdvertisedProductRaw(xlsxPath, accountId, exportedAt);
  if (result.status === "already ingested") {
    console.log("Already ingested (same account_id + file hash).");
    return;
  }

  console.log("Ingest complete.");
  console.log({
    uploadId: result.uploadId,
    rowCount: result.rowCount,
    coverageStart: result.coverageStart,
    coverageEnd: result.coverageEnd,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
