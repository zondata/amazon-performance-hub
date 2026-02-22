import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSpTargetingReport } from "../src/ads/parseSpTargetingReport";

function writeTargetingXlsx(filePath: string) {
  const rows = [
    [
      "Date",
      "Portfolio Name",
      "Campaign Name",
      "Ad Group Name",
      "Targeting",
      "Match Type",
      "Impressions",
      "Clicks",
      "Spend",
      "Sales",
      "Orders",
      "Units",
      "CTR",
      "ACOS",
      "Conversion Rate",
      "Top of Search Impression Share",
    ],
    [
      "2026-01-01",
      "Brand A",
      "Campaign One",
      "Ad Group One",
      "blue shoes",
      "Exact",
      "1,234",
      "12",
      "$1,234.56",
      "2,345.00",
      "3",
      "4",
      "0.98%",
      "28.6%",
      "12.5%",
      "40%",
    ],
    [
      "2026-01-02",
      "Brand A",
      "Campaign One",
      "Ad Group One",
      "red shoes",
      "Phrase",
      "100",
      "5",
      "12.34",
      "0",
      "0",
      "0",
      "1.00%",
      "0%",
      "0%",
      "",
    ],
    [
      "2026-01-03",
      "Brand A",
      "Campaign One",
      "Ad Group One",
      "category=\"123\"",
      "-",
      "80",
      "4",
      "10.00",
      "12.00",
      "1",
      "1",
      "5.00%",
      "83.33%",
      "25.0%",
      "10%",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Targeting");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSpTargetingReport", () => {
  it("parses match types, percents, and coverage range", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `targeting-${Date.now()}.xlsx`);
    writeTargetingXlsx(filePath);

    const result = parseSpTargetingReport(filePath);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-02");

    const first = result.rows[0];
    expect(first.match_type_norm).toBe("EXACT");
    expect(first.ctr).toBeCloseTo(0.0098, 6);
    expect(first.acos).toBeCloseTo(0.286, 6);
    expect(first.conversion_rate).toBeCloseTo(0.125, 6);
    expect(first.top_of_search_impression_share).toBeCloseTo(0.4, 6);

    const second = result.rows[1];
    expect(second.match_type_norm).toBe("PHRASE");
    expect(second.top_of_search_impression_share).toBeNull();
    expect(result.rows.some((row) => row.targeting_norm === 'category="123"')).toBe(false);
  });
});
