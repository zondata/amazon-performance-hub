import { ingestSqpWeeklyRaw } from "../ingest/ingestSqpWeeklyRaw";
import { resolveDateFolder, getSqpCsvFiles } from "../fs/reportLocator";

function usage() {
  console.log(
    "Usage: npm run ingest:sqp:weekly:date -- --account-id <id> --marketplace <marketplace> <date-folder-or-date>\n" +
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

export async function ingestSqpWeeklyDateFolder(
  accountId: string,
  marketplace: string,
  dateInput: string
) {
  const dateFolder = resolveDateFolder(dateInput);
  const csvFiles = getSqpCsvFiles(dateFolder);
  const exportedAt = exportedAtFromFolder(dateFolder);

  if (!exportedAt) {
    throw new Error(`Unable to infer folder date from ${dateFolder}`);
  }

  const results: Array<{
    csvPath: string;
    status: string;
    uploadId?: string;
    rowCount?: number;
    warningsCount?: number;
    coverageStart?: string | null;
    coverageEnd?: string | null;
    scopeType?: "brand" | "asin";
    scopeValue?: string;
  }> = [];

  for (const csvPath of csvFiles) {
    const result = await ingestSqpWeeklyRaw(csvPath, accountId, marketplace, exportedAt);
    if (result.status === "already ingested") {
      results.push({ csvPath, status: "already ingested" });
      continue;
    }

    results.push({
      csvPath,
      status: result.status,
      uploadId: result.uploadId,
      rowCount: result.rowCount,
      warningsCount: result.warningsCount,
      coverageStart: result.coverageStart,
      coverageEnd: result.coverageEnd,
      scopeType: result.scopeType,
      scopeValue: result.scopeValue,
    });
  }

  return results;
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

  const results = await ingestSqpWeeklyDateFolder(accountId, marketplace, dateInput);
  for (const result of results) {
    if (result.status === "already ingested") {
      console.log(`${result.csvPath}: already ingested.`);
      continue;
    }

    console.log(`${result.csvPath}: ingested.`);
    console.log({
      uploadId: result.uploadId,
      rowCount: result.rowCount,
      warningsCount: result.warningsCount,
      coverageStart: result.coverageStart,
      coverageEnd: result.coverageEnd,
      scopeType: result.scopeType,
      scopeValue: result.scopeValue,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
