import fs from "node:fs";
import path from "node:path";
import { createChange } from "../logbook/createChange";

function usage() {
  console.log(
    "Usage: npm run log:change:create -- --account-id <id> --marketplace <marketplace> --file <change.json>"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function readJsonFile(filePath: string): unknown {
  const fullPath = path.resolve(process.cwd(), filePath);
  const raw = fs.readFileSync(fullPath, "utf8");
  return JSON.parse(raw);
}

async function main() {
  const accountId = getArg("--account-id");
  const marketplace = getArg("--marketplace");
  const filePath = getArg("--file");

  if (!accountId || !marketplace || !filePath) {
    usage();
    process.exit(1);
  }

  const payload = readJsonFile(filePath);
  const result = await createChange({ accountId, marketplace, raw: payload });

  console.log("Change created.");
  console.log({
    changeId: result.change_id,
    occurredAt: result.occurred_at,
    summary: result.summary,
    channel: result.channel,
    changeType: result.change_type,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
