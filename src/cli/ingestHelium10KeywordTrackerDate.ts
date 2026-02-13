import { ingestHelium10KeywordTrackerRaw } from "../ingest/ingestHelium10KeywordTrackerRaw";
import { resolveDateFolder, getHelium10KeywordTrackerCsvFiles } from "../fs/reportLocator";

function usage() {
  console.log(
    "Usage: npm run ingest:rank:h10:date -- --account-id <id> --marketplace <marketplace> <date-folder-or-date>\n" +
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

export async function ingestHelium10KeywordTrackerDateFolder(
  accountId: string,
  marketplace: string,
  dateInput: string
) {
  const dateFolder = resolveDateFolder(dateInput);
  const csvFiles = getHelium10KeywordTrackerCsvFiles(dateFolder);
  const exportedAt = exportedAtFromFolder(dateFolder);

  if (!exportedAt) {
    throw new Error(`Unable to infer folder date from ${dateFolder}`);
  }

  const results: Array<{
    csvPath: string;
    status: string;
    uploadId?: string;
    asin?: string;
    rowCount?: number;
    coverageStart?: string | null;
    coverageEnd?: string | null;
  }> = [];

  for (const csvPath of csvFiles) {
    const result = await ingestHelium10KeywordTrackerRaw(csvPath, accountId, marketplace, exportedAt);
    if (result.status === "already ingested") {
      results.push({ csvPath, status: "already ingested" });
      continue;
    }

    results.push({
      csvPath,
      status: result.status,
      uploadId: result.uploadId,
      asin: result.asin,
      rowCount: result.rowCount,
      coverageStart: result.coverageStart,
      coverageEnd: result.coverageEnd,
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

  const results = await ingestHelium10KeywordTrackerDateFolder(accountId, marketplace, dateInput);
  for (const result of results) {
    if (result.status === "already ingested") {
      console.log(`${result.csvPath}: already ingested.`);
      continue;
    }

    console.log(`${result.csvPath}: ingested.`);
    console.log({
      uploadId: result.uploadId,
      asin: result.asin,
      rowCount: result.rowCount,
      coverageStart: result.coverageStart,
      coverageEnd: result.coverageEnd,
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
