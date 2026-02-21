import { validateBulkgenChanges } from "../logbook/validateBulkgenChanges";

function usage() {
  console.log(
    "Usage: npm run log:validate:bulkgen -- --account-id <id> [--mode auto|manual] [--upload-id <uuid>] [--change-id <uuid> ...] [--limit <n>]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function getArgs(flag: string): string[] {
  const values: string[] = [];
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg !== flag) continue;
    const value = args[i + 1];
    if (!value || value.startsWith("--")) continue;
    values.push(value);
    i += 1;
  }
  return values;
}

async function main() {
  const accountId = getArg("--account-id");
  const modeArg = getArg("--mode");
  const uploadId = getArg("--upload-id");
  const changeIds = getArgs("--change-id");
  const limitRaw = getArg("--limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  if (!accountId) {
    usage();
    process.exit(1);
  }

  const mode = modeArg === "manual" ? "manual" : "auto";

  const result = await validateBulkgenChanges({
    accountId,
    mode,
    uploadId,
    changeIds: changeIds.length > 0 ? changeIds : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  console.log("Bulkgen validation complete.");
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
