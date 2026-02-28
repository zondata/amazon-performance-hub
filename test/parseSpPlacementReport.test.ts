import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSpPlacementReport } from "../src/ads/parseSpPlacementReport";

function writePlacementXlsx(filePath: string, rows: (string | number)[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Placement");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSpPlacementReport", () => {
  it("parses placement codes, percents, and coverage range", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `placement-${Date.now()}.xlsx`);
    writePlacementXlsx(filePath, [
      [
        "Date",
        "Portfolio Name",
        "Campaign Name",
        "Bidding Strategy",
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
        "dynamic",
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
        "dynamic",
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
    ]);

    const result = parseSpPlacementReport(filePath);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-02");

    const first = result.rows[0];
    expect(first.placement_code).toBe("TOS");
    expect(first.spend).toBe(1234.56);
    expect(first.ctr).toBeCloseTo(0.0098, 6);
    expect(first.acos).toBeCloseTo(0.286, 6);

    const second = result.rows[1];
    expect(second.placement_code).toBe("OA");
    expect(second.spend).toBe(12.34);
  });

  it("parses 14-day Amazon headers for sales/orders/units including suffixed variants", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `placement-14day-${Date.now()}.xlsx`);
    writePlacementXlsx(filePath, [
      [
        "Date",
        "Campaign Name",
        "Placement",
        "Impressions",
        "Clicks",
        "Spend",
        "14 Day Total Sales ($)",
        "14 Day Total Orders (#)",
        "14 Day Total Units",
      ],
      [
        "2026-01-03",
        "Campaign Two",
        "Rest of Search",
        "200",
        "10",
        "50.00",
        "250.75",
        "7",
        "9",
      ],
    ]);

    const result = parseSpPlacementReport(filePath);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.sales).toBe(250.75);
    expect(result.rows[0]?.orders).toBe(7);
    expect(result.rows[0]?.units).toBe(9);
  });

  it("matches prefix aliases for headers like 14 Day Total Sales (USD)", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `placement-14day-usd-${Date.now()}.xlsx`);
    writePlacementXlsx(filePath, [
      ["Date", "Campaign Name", "Placement", "14 Day Total Sales (USD)"],
      ["2026-01-04", "Campaign Three", "Product Pages", "321.09"],
    ]);

    const result = parseSpPlacementReport(filePath);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.sales).toBe(321.09);
  });

  it("does not map spend to cost-per-click when both are present", () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `placement-cost-vs-cpc-${Date.now()}.xlsx`);
    writePlacementXlsx(filePath, [
      ["Date", "Campaign Name", "Placement", "Clicks", "Cost per click", "Cost"],
      ["2026-01-05", "Campaign Four", "Top of Search (first page)", "10", "1.23", "12.30"],
    ]);

    const result = parseSpPlacementReport(filePath);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.cpc).toBe(1.23);
    expect(result.rows[0]?.spend).toBe(12.3);
  });
});
