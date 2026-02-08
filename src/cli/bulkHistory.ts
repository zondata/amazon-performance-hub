import fs from "node:fs";
import path from "node:path";
import { parseSponsoredProductsBulk } from "../bulk/parseSponsoredProductsBulk";
import { buildNameHistory } from "../bulk/buildNameHistory";
import { inferSnapshotDate } from "./snapshotDate";

function usage() {
  console.log("Usage: npm run bulk:history -- <folder>");
}

async function main() {
  const folder = process.argv[2];
  if (!folder || folder.startsWith("--")) {
    usage();
    process.exit(1);
  }

  const entries = fs.readdirSync(folder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xlsx"))
    .map((entry) => path.join(folder, entry.name));

  const snapshots = [];
  for (const filePath of files) {
    const snapshotDate = inferSnapshotDate(filePath);
    const snapshot = await parseSponsoredProductsBulk(filePath, snapshotDate);
    snapshots.push(snapshot);
  }

  const history = buildNameHistory(snapshots);

  const outPath = path.resolve(process.cwd(), "out", "name_history.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(history, null, 2));

  const campaigns = history.filter((row) => row.entityType === "campaign");
  const adGroups = history.filter((row) => row.entityType === "adGroup");
  const portfolios = history.filter((row) => row.entityType === "portfolio");

  console.log(`Campaign history rows: ${campaigns.length}`);
  console.log(campaigns.slice(0, 5));
  console.log(`Ad group history rows: ${adGroups.length}`);
  console.log(adGroups.slice(0, 5));
  console.log(`Portfolio history rows: ${portfolios.length}`);
  console.log(portfolios.slice(0, 5));
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
