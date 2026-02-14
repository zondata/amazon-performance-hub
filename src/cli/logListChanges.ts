import { listLogChanges } from "../logbook/db";

function usage() {
  console.log(
    "Usage: npm run log:change:list -- --account-id <id> --marketplace <marketplace> [--limit N]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function parseLimit(raw: string | undefined): number | null {
  if (!raw) return 20;
  const num = Number.parseInt(raw, 10);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

async function main() {
  const accountId = getArg("--account-id");
  const marketplace = getArg("--marketplace");
  const limitArg = getArg("--limit");
  const limit = parseLimit(limitArg);

  if (!accountId || !marketplace || limit === null) {
    usage();
    process.exit(1);
  }

  const rows = await listLogChanges({ accountId, marketplace, limit });
  console.log(JSON.stringify({ count: rows.length, rows }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
