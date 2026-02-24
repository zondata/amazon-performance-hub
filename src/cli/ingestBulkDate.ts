import { ingestBulk } from "../ingest/ingestBulk";
import { resolveDateFolder, findBulkXlsx } from "../fs/reportLocator";
import { rejectDeprecatedAccountId } from "./_accountGuard";

function usage() {
  console.log(
    "Usage: npm run ingest:bulk:date -- --account-id <id> <date-folder-or-date> [--marketplace <text>] [--snapshot-date YYYY-MM-DD]"
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
  if (accountId) rejectDeprecatedAccountId(accountId);
  const marketplace = getArg("--marketplace");
  const snapshotDate = getArg("--snapshot-date");
  const positionals = getPositionalArgs();
  const dateInput = positionals[0];

  if (!accountId || !dateInput) {
    usage();
    process.exit(1);
  }

  const dateFolder = resolveDateFolder(dateInput);
  const bulkPath = findBulkXlsx(dateFolder);

  const result = await ingestBulk(bulkPath, accountId, marketplace, snapshotDate);
  if (result.status === "already ingested") {
    console.log("Already ingested (same account_id + file hash).");
    return;
  }

  console.log("Ingest complete.");
  console.log({
    uploadId: result.uploadId,
    snapshotDate: result.snapshotDate,
    counts: result.counts,
    validation: result.validation,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
