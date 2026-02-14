import fs from "node:fs";
import path from "node:path";
import { createExperiment } from "../logbook/createExperiment";

function usage() {
  console.log(
    "Usage: npm run log:experiment:create -- --account-id <id> --marketplace <marketplace> --file <experiment.json>"
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
  const result = await createExperiment({ accountId, marketplace, raw: payload });

  console.log("Experiment created.");
  console.log({
    experimentId: result.experiment_id,
    name: result.name,
    objective: result.objective,
    createdAt: result.created_at,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
