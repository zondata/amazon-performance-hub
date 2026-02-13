import { ingestHelium10KeywordTrackerRaw } from "../ingest/ingestHelium10KeywordTrackerRaw";

function usage() {
  console.log(
    "Usage: npm run ingest:rank:h10 -- --account-id <id> --marketplace <marketplace> <csv> [--exported-at ISO]"
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
  const marketplace = getArg("--marketplace");
  const exportedAtArg = getArg("--exported-at");
  const positionals = getPositionalArgs();
  const csvPath = positionals[0];

  if (!accountId || !marketplace || !csvPath) {
    usage();
    process.exit(1);
  }

  const result = await ingestHelium10KeywordTrackerRaw(csvPath, accountId, marketplace, exportedAtArg);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
