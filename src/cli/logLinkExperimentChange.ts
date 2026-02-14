import { linkExperimentChange } from "../logbook/db";

function usage() {
  console.log(
    "Usage: npm run log:experiment:link-change -- --account-id <id> --marketplace <marketplace> --experiment-id <uuid> --change-id <uuid>"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const accountId = getArg("--account-id");
  const marketplace = getArg("--marketplace");
  const experimentId = getArg("--experiment-id");
  const changeId = getArg("--change-id");

  if (!accountId || !marketplace || !experimentId || !changeId) {
    usage();
    process.exit(1);
  }

  const result = await linkExperimentChange({ experimentId, changeId });

  if (result.status === "already linked") {
    console.log("Already linked.");
    return;
  }

  console.log("Link created.");
  console.log({
    experimentId,
    changeId,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
