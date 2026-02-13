import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSbCampaignReport } from "../src/ads/parseSbCampaignReport";

function writeCampaignXlsx(filePath: string) {
  const rows = [
    [
      "Date",
      "Portfolio Name",
      "Campaign Name",
      "Impressions",
      "Clicks",
      "Spend",
      "Sales",
      "Orders",
      "Units",
    ],
    ["2026-01-01", "Brand A", "Campaign One", "1,234", "12", "$1,234.56", "2,345.00", "3", "4"],
    ["1/2/2026", "Brand A", "Campaign One", "100", "5", "12.34", "0", "0", "0"],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Campaigns");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSbCampaignReport", () => {
  it("parses dates, money, and coverage range", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `sb-campaign-${Date.now()}.xlsx`);
    writeCampaignXlsx(filePath);

    const result = parseSbCampaignReport(filePath);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-02");

    const first = result.rows[0];
    expect(first.spend).toBe(1234.56);
    expect(first.impressions).toBe(1234);
  });
});
