import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, it, expect } from "vitest";
import { makeXlsx, HEADER_ROW } from "./utils/makeXlsx";

describe("makeXlsx", () => {
  it("writes a readable xlsx with the expected sheet", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    const filename = `fixture-${Date.now()}.xlsx`;
    const filePath = path.join(tmpDir, filename);

    makeXlsx(filePath, [HEADER_ROW]);

    expect(fs.existsSync(filePath)).toBe(true);
    const stats = fs.statSync(filePath);
    expect(stats.size).toBeGreaterThan(0);

    const workbook = XLSX.readFile(filePath);
    expect(workbook.SheetNames).toContain("Sponsored Products Campaigns");
  });
});
