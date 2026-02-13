import { ingestScaleInsightsSalesTrendRaw } from "../ingest/ingestScaleInsightsSalesTrendRaw";
import { resolveDateFolder, getScaleInsightsSalesTrendCsvFiles } from "../fs/reportLocator";

function usage() {
  console.log(
    "Usage: npm run ingest:sales:si:date -- --account-id <id> --marketplace <marketplace> <date-folder-or-date>\n" +
      "Uses folder date as exported_at at T00:00:00Z."
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
  const marketplace = getArg("--marketplace");
  const positionals = getPositionalArgs();
  const dateInput = positionals[0];

  if (!accountId || !marketplace || !dateInput) {
    usage();
    process.exit(1);
  }

  const dateFolder = resolveDateFolder(dateInput);
  const csvFiles = getScaleInsightsSalesTrendCsvFiles(dateFolder);
  const exportedAt = exportedAtFromFolder(dateFolder);

  if (!exportedAt) {
    throw new Error(`Unable to infer folder date from ${dateFolder}`);
  }

  for (const csvPath of csvFiles) {
    const result = await ingestScaleInsightsSalesTrendRaw(csvPath, accountId, marketplace, exportedAt);
    if (result.status === "already ingested") {
      console.log(`${csvPath}: already ingested.`);
      continue;
    }

    console.log(`${csvPath}: ingested.`);
    console.log({
      uploadId: result.uploadId,
      asin: result.asin,
      rowCount: result.rowCount,
      warningsCount: result.warningsCount,
      coverageStart: result.coverageStart,
      coverageEnd: result.coverageEnd,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
