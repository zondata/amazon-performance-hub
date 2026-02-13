import { describe, it, expect } from "vitest";
import { parseSqpReport } from "../src/sqp/parseSqpReport";

const BRAND_CSV = `Brand=["sourbear"],Reporting Range=["Weekly"],Select week=["Week 6 | 2026-02-01 - 2026-02-07 2026"]
Reporting Date,Search Query,Search Query Score,Search Query Volume,Impressions: Total Count,Impressions: Brand Count,Impressions: Brand Share,Clicks: Total Count,Click Rate %,Clicks: Brand Count,Clicks: Brand Share
2026-02-07,vitamin c serum,320,10000,1000,180,18,72,0.72,16,22.22
2026-02-07,retinol serum,280,9000,850,120,14.12,54,0.60,10,18.52
`;

const ASIN_CSV = `ASIN=["B0B2K57W5R"],Reporting Range=["Weekly"],Select week=["Week 6 | 2026-02-01 - 2026-02-07 2026"]
Reporting Date,Search Query,Search Query Score,Search Query Volume,Impressions: Total Count,Impressions: ASIN Count,Impressions: ASIN Share,Clicks: Total Count,Click Rate %,Clicks: ASIN Count,Clicks: ASIN Share
2026-02-07,hair growth serum,250,8000,600,90,15,48,0.72,8,16.67
`;

describe("parseSqpReport", () => {
  it("parses Brand View SQP metadata and rows", () => {
    const result = parseSqpReport(
      BRAND_CSV,
      "US_Search_Query_Performance_Brand_View_Simple_Week_2026_02_07.csv"
    );

    expect(result.scopeType).toBe("brand");
    expect(result.scopeValue).toBe("sourbear");
    expect(result.weekStart).toBe("2026-02-01");
    expect(result.weekEnd).toBe("2026-02-07");
    expect(result.rows.length).toBe(2);
    expect(result.rows[0].search_query_norm).toBe("vitamin c serum");
    expect(result.rows[0].clicks_total).toBe(72);
  });

  it("parses ASIN View SQP metadata and self columns", () => {
    const result = parseSqpReport(
      ASIN_CSV,
      "US_Search_Query_Performance_ASIN_View_Simple_Week_2026_02_07.csv"
    );

    expect(result.scopeType).toBe("asin");
    expect(result.scopeValue).toBe("B0B2K57W5R");
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].impressions_self).toBe(90);
    expect(result.rows[0].clicks_self).toBe(8);
  });

  it("falls back to filename-derived scope/week when metadata cannot be parsed", () => {
    const csv = `Unknown=["x"]
Reporting Date,Search Query
2026-02-07,vitamin c serum
`;

    const result = parseSqpReport(
      csv,
      "US_Search_Query_Performance_ASIN_View_Simple_Week_2026_02_07.csv"
    );

    expect(result.scopeType).toBe("asin");
    expect(result.weekStart).toBe("2026-02-01");
    expect(result.weekEnd).toBe("2026-02-07");
  });

  it("treats percent values as percentages and divides by 100", () => {
    const result = parseSqpReport(
      BRAND_CSV,
      "US_Search_Query_Performance_Brand_View_Simple_Week_2026_02_07.csv"
    );

    expect(result.rows[0].clicks_rate_per_query).toBeCloseTo(0.0072, 7);
  });
});
