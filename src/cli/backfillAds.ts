import { backfillAds } from "../pipeline/backfillAds";
import { rejectDeprecatedAccountId } from "./_accountGuard";

function usage() {
  console.log(
    "Usage: npm run pipeline:backfill:ads -- --account-id US --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--concurrency N] [--dry-run] [--continue-on-error]"
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

async function main() {
  const accountId = getArg("--account-id");
  if (accountId) rejectDeprecatedAccountId(accountId);
  const root = getArg("--root");
  const from = getArg("--from");
  const to = getArg("--to");
  const concurrencyRaw = getArg("--concurrency");
  const concurrency = concurrencyRaw ? Number.parseInt(concurrencyRaw, 10) : undefined;
  const dryRun = hasFlag("--dry-run");
  const continueOnError = hasFlag("--continue-on-error");

  if (!accountId || !root || !from || !to) {
    usage();
    process.exit(1);
  }

  const summaries = await backfillAds({
    accountId,
    root,
    from,
    to,
    concurrency,
    dryRun,
    continueOnError,
  });

  console.log(JSON.stringify(summaries, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
