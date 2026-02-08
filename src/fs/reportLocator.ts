import fs from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

export function resolveDateFolder(inputPathOrDate: string): string {
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(inputPathOrDate);
  if (!isDate) {
    return inputPathOrDate;
  }

  const root = process.env.AMAZON_REPORTS_ROOT ?? "/mnt/c/Users/User/Dropbox/AmazonReports";
  return path.join(root, inputPathOrDate);
}

export function findBulkXlsx(dateFolder: string): string {
  if (!fs.existsSync(dateFolder)) {
    throw new Error(`Folder not found: ${dateFolder}`);
  }
  const entries = fs.readdirSync(dateFolder, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile() && /^bulk-.*\.xlsx$/i.test(entry.name))
    .map((entry) => path.join(dateFolder, entry.name));

  if (!matches.length) {
    throw new Error(`No bulk .xlsx found in ${dateFolder}`);
  }

  if (matches.length === 1) {
    return matches[0];
  }

  const withStats = matches.map((filePath) => ({
    filePath,
    mtimeMs: fs.statSync(filePath).mtimeMs,
  }));
  withStats.sort((a, b) => a.mtimeMs - b.mtimeMs);
  const newest = withStats[withStats.length - 1]?.filePath;

  console.warn(`Multiple bulk files found in ${dateFolder}, selecting newest by mtime:`);
  console.warn(withStats.map((entry) => entry.filePath));

  if (!newest) {
    throw new Error(`Unable to select bulk file in ${dateFolder}`);
  }

  return newest;
}

export function getSpCampaignCsv(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Campaign_report.csv");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Campaign report: ${filePath}`);
  }
  return filePath;
}

export function getSpPlacementXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Placement_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Placement report: ${filePath}`);
  }
  return filePath;
}

export function getSpTargetingXlsx(dateFolder: string): string {
  const filePath = path.join(dateFolder, "Sponsored_Products_Targeting_report.xlsx");
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Sponsored Products Targeting report: ${filePath}`);
  }
  return filePath;
}
