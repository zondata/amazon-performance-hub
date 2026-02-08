import fs from "node:fs";
import path from "node:path";
import { parseSponsoredProductsBulk } from "../bulk/parseSponsoredProductsBulk";
import { diffSnapshots } from "../bulk/diffSnapshots";
import { inferSnapshotDate } from "./snapshotDate";

function usage() {
  console.log(
    "Usage: npm run bulk:diff -- <old.xlsx> <new.xlsx> [--out out/diff_<old>_<new>.json]"
  );
}

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function pickOutPath(oldPath: string, newPath: string, explicit?: string): string {
  if (explicit) return explicit;
  const outDir = path.resolve(process.cwd(), "out");
  const oldBase = path.basename(oldPath, path.extname(oldPath));
  const newBase = path.basename(newPath, path.extname(newPath));
  return path.join(outDir, `diff_${oldBase}_${newBase}.json`);
}

function logCategory<T>(label: string, items: T[], sampleCount = 10) {
  console.log(`${label}: ${items.length}`);
  if (items.length) {
    console.log(items.slice(0, sampleCount));
  }
}

async function main() {
  const oldPath = process.argv[2];
  const newPath = process.argv[3];

  if (!oldPath || !newPath || oldPath.startsWith("--") || newPath.startsWith("--")) {
    usage();
    process.exit(1);
  }

  const outPath = pickOutPath(oldPath, newPath, getArg("--out"));

  const oldSnap = await parseSponsoredProductsBulk(
    oldPath,
    inferSnapshotDate(oldPath, getArg("--snapshot-date-old"))
  );
  const newSnap = await parseSponsoredProductsBulk(
    newPath,
    inferSnapshotDate(newPath, getArg("--snapshot-date-new"))
  );

  const diff = diffSnapshots(oldSnap, newSnap);

  console.log("Bulk diff summary:");
  logCategory("Campaign renames", diff.campaignRenames);
  logCategory("Ad group renames", diff.adGroupRenames);
  logCategory("Campaign budget changes", diff.campaignBudgetChanges);
  logCategory("Campaign strategy changes", diff.campaignBiddingStrategyChanges);
  logCategory("Placement changes", diff.placementChanges);
  logCategory("Target bid changes", diff.targetBidChanges);
  logCategory("Target state changes", diff.targetStateChanges);
  console.log(
    `Added campaigns: ${diff.added.campaigns.length}, ad groups: ${diff.added.adGroups.length}, targets: ${diff.added.targets.length}`
  );
  console.log(
    `Removed campaigns: ${diff.removed.campaigns.length}, ad groups: ${diff.removed.adGroups.length}, targets: ${diff.removed.targets.length}`
  );
  if (diff.added.campaigns.length) console.log(diff.added.campaigns.slice(0, 10));
  if (diff.added.adGroups.length) console.log(diff.added.adGroups.slice(0, 10));
  if (diff.added.targets.length) console.log(diff.added.targets.slice(0, 10));
  if (diff.removed.campaigns.length) console.log(diff.removed.campaigns.slice(0, 10));
  if (diff.removed.adGroups.length) console.log(diff.removed.adGroups.slice(0, 10));
  if (diff.removed.targets.length) console.log(diff.removed.targets.slice(0, 10));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(diff, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
