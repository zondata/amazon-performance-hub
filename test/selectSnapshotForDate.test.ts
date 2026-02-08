import { describe, it, expect } from "vitest";
import { parseBulkFilenameMeta } from "../src/bulk/bulkFileMeta";
import { selectBestBulkFileForDate } from "../src/bulk/selectSnapshotForDate";

function meta(name: string) {
  return parseBulkFilenameMeta(name);
}

describe("selectBestBulkFileForDate", () => {
  it("prefers the latest export timestamp in overlapping range", () => {
    const fileA = meta("Bulk_20260101-20260131-1700000000000.xlsx");
    const fileB = meta("Bulk_20260101-20260131-1800000000000.xlsx");

    const best = selectBestBulkFileForDate([fileA, fileB], "2026-01-15");
    expect(best?.filename).toBe(fileB.filename);
    expect(best?.exportTimestampMs).toBe(1800000000000);
  });
});
