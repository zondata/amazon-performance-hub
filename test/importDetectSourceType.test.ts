import { describe, expect, it } from "vitest";
import { detectSourceTypeFromFilename } from "../src/fs/reportLocator";

describe("detectSourceTypeFromFilename", () => {
  it("detects supported source_type values from known filenames", () => {
    expect(detectSourceTypeFromFilename("Sponsored_Products_Campaign_report.csv")).toBe("sp_campaign");
    expect(detectSourceTypeFromFilename("Sponsored_Products_Placement_report.xlsx")).toBe("sp_placement");
    expect(detectSourceTypeFromFilename("Sponsored_Products_Targeting_report.xlsx")).toBe("sp_targeting");
    expect(detectSourceTypeFromFilename("Sponsored_Products_Search_Term_Impression_Share_report.csv")).toBe("sp_stis");
    expect(detectSourceTypeFromFilename("Sponsored_Products_Advertised_product_report.xlsx")).toBe("sp_advertised_product");

    expect(detectSourceTypeFromFilename("Sponsored_Brands_Campaign_report.xlsx")).toBe("sb_campaign");
    expect(detectSourceTypeFromFilename("Sponsored_Brands_Campaign_placement_report.xlsx")).toBe("sb_campaign_placement");
    expect(detectSourceTypeFromFilename("Sponsored_Brands_Keyword_report.xlsx")).toBe("sb_keyword");
    expect(detectSourceTypeFromFilename("Sponsored_Brands_Search_Term_Impression_Share_report.csv")).toBe("sb_stis");
    expect(detectSourceTypeFromFilename("Sponsored_Brands_Attributed_Purchases_report.csv")).toBe("sb_attributed_purchases");

    expect(detectSourceTypeFromFilename("B0B2K57W5R SalesTrend - Retirement.csv")).toBe("si_sales_trend");
    expect(detectSourceTypeFromFilename("SalesTrend.csv")).toBe("si_sales_trend");
    expect(detectSourceTypeFromFilename("helium10-kt-B0B2K57W5R-2026-02-26.csv")).toBe("h10_keyword_tracker");
    expect(detectSourceTypeFromFilename("bulk-a10515s1clzayc-20260226-1772090891793.xlsx")).toBe("bulk");
  });
});
