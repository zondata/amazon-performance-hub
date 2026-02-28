import path from "node:path";

export const SP_PLACEMENT_REPORT_FILENAME = "Sponsored_Products_Placement_report.xlsx";

export function exportedAtIsoToUtcFolderDate(exportedAtIso: string): string {
  const parsed = new Date(exportedAtIso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid exported_at ISO value: ${exportedAtIso}`);
  }
  return parsed.toISOString().slice(0, 10);
}

export function buildSpPlacementReportPath(root: string, folderDate: string): string {
  return path.join(root, folderDate, SP_PLACEMENT_REPORT_FILENAME);
}

export function extractDateSegmentFromPath(inputPath: string): string | null {
  const matches = inputPath.match(/\d{4}-\d{2}-\d{2}/g);
  if (!matches?.length) return null;
  return matches[matches.length - 1] ?? null;
}

export function deriveExportedAtFromPath(inputPath: string): string | undefined {
  const date = extractDateSegmentFromPath(inputPath);
  if (!date) return undefined;
  return `${date}T00:00:00Z`;
}
