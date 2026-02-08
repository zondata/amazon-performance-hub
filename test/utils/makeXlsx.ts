import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export const HEADER_ROW = [
  "Entity",
  "Campaign ID",
  "Campaign Name",
  "Ad Group ID",
  "Ad Group Name",
  "Keyword ID",
  "Product Targeting ID",
  "Keyword Text",
  "Product Targeting Expression",
  "Match Type",
  "State",
  "Daily Budget",
  "Bidding Strategy",
  "Bid",
  "Placement",
  "Percentage",
  "Portfolio ID",
  "Portfolio Name",
];

export function makeXlsx(
  filePath: string,
  rows: (string | number | boolean | null)[][] = []
): void {
  const allRows = rows.length ? rows : [HEADER_ROW];

  const worksheet = XLSX.utils.aoa_to_sheet(allRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sponsored Products Campaigns");

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  XLSX.writeFile(workbook, filePath);
}
