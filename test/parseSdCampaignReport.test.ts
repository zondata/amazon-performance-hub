import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSdCampaignReport } from "../src/ads/parseSdCampaignReport";

function excelSerial(date: Date): number {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const epoch = Date.UTC(1899, 11, 30);
  return (utc - epoch) / (24 * 60 * 60 * 1000);
}

function writeCampaignXlsx(filePath: string) {
  const rows: (string | number | Date | null)[][] = [
    [
      "Date",
      "Portfolio Name",
      "Campaign Name",
      "Cost Type",
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
      "SD Campaign",
      "CPC",
      "1,000",
      "25",
      "$1,234.56",
      "2,000",
      "5",
      "6",
      "$0.99",
      "12.5%",
      "25%",
      "4.0",
      "10%",
    ],
    [
      new Date("2026-01-02T00:00:00Z"),
      "Brand A",
      "SD Campaign",
      "CPC",
      "500",
      "10",
      "12.34",
      "0",
      "0",
      "0",
      "1.23",
      "1.0%",
      "0%",
      "0",
      "0%",
    ],
    [
      excelSerial(new Date("2026-01-03T00:00:00Z")),
      "Brand A",
      "SD Campaign",
      "CPC",
      "200",
      "5",
      "5.00",
      "10",
      "1",
      "1",
      "1.00",
      "2.5%",
      "10%",
      "2.0",
      "5%",
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Campaign");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSdCampaignReport", () => {
  it("parses date variants, money, and percent values", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `sd-campaign-${Date.now()}.xlsx`);
    writeCampaignXlsx(filePath);

    const result = parseSdCampaignReport(filePath);
    expect(result.rows.length).toBe(3);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-03");

    const first = result.rows[0];
    expect(first.spend).toBeCloseTo(1234.56, 2);
    expect(first.ctr).toBeCloseTo(0.125, 6);
  });
});
