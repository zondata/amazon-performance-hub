import { describe, it, expect } from "vitest";
import {
  parseAsinFromFilename,
  resolveSalesTrendAsinFromFilenameOrOverride,
  parseScaleInsightsSalesTrend,
  buildScaleInsightsSalesTrendRawRows,
} from "../src/sales/parseScaleInsightsSalesTrend";

const CSV = `Start Date,End Date,Sales,Orders,Units,PPC Cost,PPC Sales,PPC Clicks,PPC Impressions,Avg Sales Price,ROI,Margin,Unit Session %,ACOS,TACOS,CTR,Sessions,Conversions,Cost Per Click,PPC Conversions,PPC Cost Per Order,Promotions,Promotion Value,Refund Units,Refund Cost,Refund Per Unit,Referral Fees,Fulfillment Fees,Cost of Goods,Payout,Profits,Organic Orders,Organic Units,PPC Orders,PPC Units
2026-01-01,2026-01-01,"$1,234.50",12,14,$123.45,$456.78,"1,234","12,345",$88.18,25%,10%,5%,12.5%,3%,0.5%,1000,2.5%,$0.10,1.2%,$4.50,2,$5.00,1,$2.00,$2.00,$50,$20,$300,$800,$400,8,9,4,5
13/01/2026,14/01/2026,100,1,1,10,0,10,100,100,0%,0%,0%,0%,0%,0%,10,0%,0,0%,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0
`;

describe("parseScaleInsightsSalesTrend", () => {
  it("parses dates, numerics, coverage range, and warnings", () => {
    const result = parseScaleInsightsSalesTrend(CSV);
    expect(result.rows.length).toBe(2);
    expect(result.coverageStart).toBe("2026-01-01");
    expect(result.coverageEnd).toBe("2026-01-13");
    expect(result.warnings).toBe(1);

    const first = result.rows[0];
    expect(first.date).toBe("2026-01-01");
    expect(first.sales).toBe(1234.5);
    expect(first.orders).toBe(12);
    expect(first.ppc_clicks).toBe(1234);
    expect(first.avg_sales_price).toBe(88.18);
    expect(first.roi).toBeCloseTo(0.25, 5);
    expect(first.unit_session_pct).toBeCloseTo(0.05, 5);
    expect(first.ctr).toBeCloseTo(0.005, 5);
  });

  it("parses ASIN from filename prefix", () => {
    expect(parseAsinFromFilename("B0B2K57W5R SalesTrend - Retirement.csv")).toBe("B0B2K57W5R");
    expect(parseAsinFromFilename("b0fyprwpn1 SalesTrend.csv")).toBe("B0FYPRWPN1");
    expect(parseAsinFromFilename("SalesTrend.csv")).toBeNull();
  });

  it("resolves ASIN from override when filename has no ASIN", () => {
    expect(
      resolveSalesTrendAsinFromFilenameOrOverride("SalesTrend.csv", "b0fyprwpn1")
    ).toBe("B0FYPRWPN1");
  });

  it("throws when both filename ASIN and override are missing", () => {
    expect(() =>
      resolveSalesTrendAsinFromFilenameOrOverride("SalesTrend.csv")
    ).toThrow(/Provide --asin or rename file to start with ASIN/);
  });

  it("builds raw rows for ingestion", () => {
    const { rows } = parseScaleInsightsSalesTrend(CSV);
    const rawRows = buildScaleInsightsSalesTrendRawRows({
      rows,
      accountId: "US",
      marketplace: "US",
      asin: "B0B2K57W5R",
      uploadId: "00000000-0000-0000-0000-000000000000",
      exportedAt: "2026-02-01T00:00:00Z",
    });

    expect(rawRows.length).toBe(2);
    expect(rawRows[0].account_id).toBe("US");
    expect(rawRows[0].marketplace).toBe("US");
    expect(rawRows[0].asin).toBe("B0B2K57W5R");
    expect(rawRows[0].exported_at).toBe("2026-02-01T00:00:00Z");
  });
});
