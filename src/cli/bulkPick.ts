import fs from "node:fs";
import path from "node:path";
import { parseBulkFilenameMeta } from "../bulk/bulkFileMeta";
import { selectBestBulkFileForDate } from "../bulk/selectSnapshotForDate";

function usage() {
  console.log("Usage: npm run bulk:pick -- <folder> <YYYY-MM-DD>");
}

async function main() {
  const folder = process.argv[2];
  const dateIso = process.argv[3];
  if (!folder || !dateIso || folder.startsWith("--") || dateIso.startsWith("--")) {
    usage();
    process.exit(1);
  }

  const entries = fs.readdirSync(folder, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".xlsx"))
    .map((entry) => path.join(folder, entry.name));

  const metas = files.map((filePath) => {
    const stats = fs.statSync(filePath);
    const meta = parseBulkFilenameMeta(path.basename(filePath));
    return { ...meta, filename: filePath, mtimeMs: stats.mtimeMs };
  });

  const best = selectBestBulkFileForDate(metas, dateIso);
  if (!best) {
    console.log("No matching files found.");
    process.exit(1);
  }

  console.log(`Selected: ${best.filename}`);
  console.log(best);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
