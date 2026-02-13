import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSdTargetingReport } from "../src/ads/parseSdTargetingReport";

describe("parseSdTargetingReport", () => {
  it("returns empty rows for header-only reports", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `sd-targeting-empty-${Date.now()}.xlsx`);

    const rows = [["Date", "Campaign Name", "Ad Group Name", "Targeting"]];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Targeting");
    XLSX.writeFile(workbook, filePath);

    const result = parseSdTargetingReport(filePath);
    expect(result.rows.length).toBe(0);
    expect(result.coverageStart).toBeNull();
    expect(result.coverageEnd).toBeNull();
  });
});
