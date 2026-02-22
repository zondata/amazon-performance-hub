import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSbKeywordReport } from "../src/ads/parseSbKeywordReport";

function writeKeywordXlsx(filePath: string) {
  const rows = [
    [
      "Date",
      "Portfolio Name",
      "Campaign Name",
      "Ad Group Name",
      "Keyword Text",
      "Match Type",
      "Impressions",
      "Clicks",
      "Spend",
      "Sales",
      "Orders",
      "Units",
      "CPC",
      "CTR",
      "ACOS",
      "ROAS",
      "Conversion Rate",
    ],
    [
      "2026-01-01",
      "Brand A",
      "Campaign One",
      "Adgroup A",
      "blue widgets",
      "Exact",
      "1,234",
      "12",
      "$1,234.56",
      "2,345.00",
      "3",
      "4",
      "$2.34",
      "0.98%",
      "28.6%",
      "3.50",
      "10.0%",
    ],
    [
      "2026-01-02",
      "Brand A",
      "Campaign One",
      "Adgroup A",
      "red widgets",
      "-",
      "100",
      "5",
      "12.34",
      "0",
      "0",
      "0",
      "1.23",
      "1.00%",
      "0%",
      "0",
      "0%",
    ],
    [
      "2026-01-03",
      "Brand A",
      "Campaign One",
      "Adgroup A",
      "category=\"retirement planning\"",
      "-",
      "80",
      "4",
      "10.00",
      "12.00",
      "1",
      "1",
      "2.50",
      "5.00%",
      "83.33%",
      "1.20",
      "25.0%",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Keywords");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSbKeywordReport", () => {
  it("parses match types, percents, and coverage range", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `sb-keyword-${Date.now()}.xlsx`);
    writeKeywordXlsx(filePath);

    const result = parseSbKeywordReport(filePath);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-02");

    const first = result.rows[0];
    expect(first.match_type_raw).toBe("Exact");
    expect(first.match_type_norm).toBe("EXACT");
    expect(first.ctr).toBeCloseTo(0.0098, 6);

    const second = result.rows[1];
    expect(second.match_type_raw).toBe("-");
    expect(second.match_type_norm).toBe("UNKNOWN");

    const categoryRows = result.rows.filter(
      (row) => row.targeting_norm === 'category="retirement planning"',
    );
    expect(categoryRows.length).toBe(0);
  });
});
