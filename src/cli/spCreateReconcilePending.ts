import { processPendingManifests } from "../bulksheet_gen_sp_create/reconcilePending";

function usage() {
  console.log(
    "Usage: npm run sp:create:reconcile:pending -- --account-id <id> --snapshot-date YYYY-MM-DD --pending-dir <path> [--dry-run] [--max-manifests N] [--verbose]"
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
  const snapshotDate = getArg("--snapshot-date");
  const pendingDir = getArg("--pending-dir");
  const dryRun = hasFlag("--dry-run");
  const maxManifestsRaw = getArg("--max-manifests");
  const verbose = hasFlag("--verbose");

  if (!accountId || !snapshotDate || !pendingDir) {
    usage();
    process.exit(1);
  }

const maxManifests = maxManifestsRaw ? Number(maxManifestsRaw) : undefined;
if (
  maxManifestsRaw &&
  (maxManifests === undefined || !Number.isFinite(maxManifests) || maxManifests < 1)
) {
  throw new Error(`Invalid --max-manifests: ${maxManifestsRaw}`);
}

await processPendingManifests({
    accountId,
    snapshotDate,
    pendingDir,
    dryRun,
    maxManifests: maxManifests ?? undefined,
    verbose,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
