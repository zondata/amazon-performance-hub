import { normText } from "../bulk/parseSponsoredProductsBulk";
import { UploadRow } from "./buildUploadRows";

function mergeKeyForRow(row: UploadRow): string {
  const cells = row.cells;
  const entity = String(cells["Entity"] ?? "");
  const campaignId = String(cells["Campaign ID"] ?? "");
  const adGroupId = String(cells["Ad Group ID"] ?? "");
  const keywordId = String(cells["Keyword ID"] ?? "");
  const productTargetId = String(cells["Product Targeting ID"] ?? "");
  const placementRaw = String(cells["Placement"] ?? "");
  const placementNorm = placementRaw ? normText(placementRaw) : "";
  return [
    row.sheetName,
    entity,
    campaignId,
    adGroupId,
    keywordId,
    productTargetId,
    placementNorm,
  ].join("||");
}

export function mergeSbUploadRows(rows: UploadRow[]): UploadRow[] {
  const merged: UploadRow[] = [];
  const indexByKey = new Map<string, number>();

  for (const row of rows) {
    const key = mergeKeyForRow(row);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      merged.push({ ...row, cells: { ...row.cells }, review: { ...row.review } });
      indexByKey.set(key, merged.length - 1);
      continue;
    }

    const existing = merged[existingIndex];
    const mergedCells = { ...existing.cells, ...row.cells };

    const actionTypeParts = [existing.review.action_type, row.review.action_type]
      .map((value) => String(value ?? "").trim())
      .filter((value) => value.length > 0);
    const mergedActionType = actionTypeParts.join("+");

    const mergedNotes = (() => {
      const first = String(existing.review.notes ?? "").trim();
      if (first) return first;
      const next = String(row.review.notes ?? "").trim();
      return next;
    })();

    merged[existingIndex] = {
      sheetName: existing.sheetName,
      cells: mergedCells,
      review: {
        ...existing.review,
        action_type: mergedActionType,
        notes: mergedNotes,
        current_value: null,
        new_value: null,
        delta: null,
      },
    };
  }

  return merged;
}
