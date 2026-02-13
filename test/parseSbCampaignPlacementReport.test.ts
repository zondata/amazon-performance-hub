import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSbCampaignPlacementReport } from "../src/ads/parseSbCampaignPlacementReport";

function writePlacementXlsx(filePath: string) {
  const rows = [
    [
      "Date",
      "Portfolio Name",
      "Campaign Name",
      "Placement",
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
    ],
    [
      "2026-01-01",
      "Brand A",
      "Campaign One",
      "Top of Search (first page)",
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
    ],
    [
      "2026-01-02",
      "Brand A",
      "Campaign One",
      "Off Amazon",
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
    ],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Placement");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSbCampaignPlacementReport", () => {
  it("parses placement codes, percents, and coverage range", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `sb-placement-${Date.now()}.xlsx`);
    writePlacementXlsx(filePath);

    const result = parseSbCampaignPlacementReport(filePath);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-02");

    const first = result.rows[0];
    expect(first.placement_code).toBe("TOS");
    expect(first.ctr).toBeCloseTo(0.0098, 6);
    expect(first.acos).toBeCloseTo(0.286, 6);
  });
});
