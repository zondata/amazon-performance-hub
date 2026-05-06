import { ingestHelium10KeywordTrackerRaw } from "../ingest/ingestHelium10KeywordTrackerRaw";

type IngestHelium10KeywordTrackerCliArgs = {
  accountId?: string;
  marketplace?: string;
  exportedAt?: string;
  originalFilename?: string;
  json: boolean;
  csvPath?: string;
};

function usage() {
  console.log(
    "Usage: npm run ingest:rank:h10 -- --account-id <id> --marketplace <marketplace> <csv> [--exported-at ISO]"
  );
}

export function parseIngestHelium10KeywordTrackerCliArgs(
  argv: string[]
): IngestHelium10KeywordTrackerCliArgs {
  const args = [...argv];
  const parsed: IngestHelium10KeywordTrackerCliArgs = {
    json: false,
  };
  const positionals: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    if (arg === "--json") {
      parsed.json = true;
      continue;
    }

    const value = args[index + 1];
    index += 1;

    if (arg === "--account-id") parsed.accountId = value;
    else if (arg === "--marketplace") parsed.marketplace = value;
    else if (arg === "--exported-at") parsed.exportedAt = value;
    else if (arg === "--original-filename") parsed.originalFilename = value;
  }

  parsed.csvPath = positionals[0];
  return parsed;
}

export async function runIngestHelium10KeywordTrackerCli(
  args: IngestHelium10KeywordTrackerCliArgs
): Promise<void> {
  if (!args.accountId || !args.marketplace || !args.csvPath) {
    usage();
    process.exit(1);
  }

  const result = await ingestHelium10KeywordTrackerRaw(
    args.csvPath,
    args.accountId,
    args.marketplace,
    args.exportedAt,
    args.originalFilename
  );

  if (args.json) {
    console.log(JSON.stringify(result));
    return;
  }

  if (result.status === "already ingested") {
    console.log("Already ingested (same account_id + file hash).");
    return;
  }

  console.log("Ingest complete.");
  console.log({
    uploadId: result.uploadId,
    asin: result.asin,
    marketplaceDomainRaw: result.marketplaceDomainRaw,
    rowCount: result.rowCount,
    coverageStart: result.coverageStart,
    coverageEnd: result.coverageEnd,
  });
}

async function main() {
  const args = parseIngestHelium10KeywordTrackerCliArgs(process.argv.slice(2));
  await runIngestHelium10KeywordTrackerCli(args);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
