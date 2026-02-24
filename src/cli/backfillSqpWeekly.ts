import { backfillSqpWeekly } from "../pipeline/backfillSqpWeekly";
import { rejectDeprecatedAccountId } from "./_accountGuard";

function usage() {
  console.log(
    "Usage: npm run pipeline:backfill:sqp -- --account-id US --marketplace US --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--continue-on-error]"
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
  const marketplace = getArg("--marketplace");
  const root = getArg("--root");
  const from = getArg("--from");
  const to = getArg("--to");
  const dryRun = hasFlag("--dry-run");
  const continueOnError = hasFlag("--continue-on-error");

  if (!accountId || !marketplace || !root || !from || !to) {
    usage();
    process.exit(1);
  }

  const summaries = await backfillSqpWeekly({
    accountId,
    marketplace,
    root,
    from,
    to,
    dryRun,
    continueOnError,
  });

  console.log(JSON.stringify(summaries, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
