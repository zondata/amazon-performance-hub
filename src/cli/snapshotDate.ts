import fs from "node:fs";
import path from "node:path";

export function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function inferSnapshotDate(xlsxPath: string, explicit?: string): string {
  if (explicit) return explicit;

  const basename = path.basename(xlsxPath);
  const rangeMatch = basename.match(/(\d{8})-(\d{8})/);
  if (rangeMatch) {
    const end = rangeMatch[2];
    return `${end.slice(0, 4)}-${end.slice(4, 6)}-${end.slice(6, 8)}`;
  }

  const stats = fs.statSync(xlsxPath);
  return formatLocalDate(stats.mtime);
}
