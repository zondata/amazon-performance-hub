import { parseSponsoredProductsBulk } from "../bulk/parseSponsoredProductsBulk";
import { inferSnapshotDate } from "./snapshotDate";

function usage() {
  console.log("Usage: npm run bulk:parse -- <xlsx> [--snapshot-date YYYY-MM-DD]");
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

async function main() {
  const xlsxPath = process.argv[2];
  if (!xlsxPath || xlsxPath.startsWith("--")) {
    usage();
    process.exit(1);
  }

  const snapshotDate = inferSnapshotDate(xlsxPath, getArg("--snapshot-date"));

  const snap = await parseSponsoredProductsBulk(xlsxPath, snapshotDate);
  console.log("OK bulk parse complete.");
  console.log({
    snapshotDate: snap.snapshotDate,
    counts: {
      campaigns: snap.campaigns.length,
      adGroups: snap.adGroups.length,
      targets: snap.targets.length,
      placements: snap.placements.length,
      portfolios: snap.portfolios.length,
    },
  });
  console.log("Samples:");
  console.log({ campaigns: snap.campaigns.slice(0, 5) });
  console.log({ adGroups: snap.adGroups.slice(0, 5) });
  console.log({ targets: snap.targets.slice(0, 5) });
  console.log({ placements: snap.placements.slice(0, 5) });
  console.log({ portfolios: snap.portfolios.slice(0, 5) });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
