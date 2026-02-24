import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseSpAdvertisedProductReport } from "../src/sp/parseSpAdvertisedProductReport";
import { makeXlsx } from "./utils/makeXlsx";

describe("parseSpAdvertisedProductReport", () => {
  it("normalizes advertised ASIN and parses metrics from xlsx", () => {
    const filePath = path.resolve(__dirname, "tmp", `sp-advertised-${Date.now()}.xlsx`);
    makeXlsx(filePath, [
      [
        "Date",
        "Campaign ID",
        "Ad Group ID",
        "Campaign Name",
        "Ad Group Name",
        "Advertised ASIN",
        "SKU",
        "Impressions",
        "Clicks",
        "Spend",
        "Sales",
        "Orders",
        "Units",
      ],
      [
        "2026-02-10",
        "12345.0",
        78901,
        "SP Campaign A",
        "AG One",
        " b0abc12345 ",
        "sku-1",
        "1,234",
        "56",
        "$78.90",
        "123.45",
        "7",
        "8",
      ],
      [
        "2026-02-11",
        "55555",
        "",
        "SP Campaign A",
        "",
        "b0xyz99999",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ],
    ]);

    const result = parseSpAdvertisedProductReport(filePath);
    expect(result.coverageStart).toBe("2026-02-10");
    expect(result.coverageEnd).toBe("2026-02-11");
    expect(result.rows.length).toBe(2);

    const first = result.rows[0];
    expect(first.campaign_id).toBe("12345");
    expect(first.ad_group_id).toBe("78901");
    expect(first.advertised_asin_raw).toBe("b0abc12345");
    expect(first.advertised_asin_norm).toBe("B0ABC12345");
    expect(first.impressions).toBe(1234);
    expect(first.clicks).toBe(56);
    expect(first.spend).toBe(78.9);
    expect(first.sales).toBe(123.45);
    expect(first.orders).toBe(7);
    expect(first.units).toBe(8);

    const second = result.rows[1];
    expect(second.ad_group_id).toBeNull();
    expect(second.advertised_asin_norm).toBe("B0XYZ99999");
    expect(second.impressions).toBeNull();
    expect(second.spend).toBeNull();
    expect(second.orders).toBeNull();
    expect(second.units).toBeNull();
  });

  it("derives synthetic campaign_id when ID columns are missing and parses Excel serial dates", () => {
    const filePath = path.resolve(__dirname, "tmp", `sp-advertised-no-ids-${Date.now()}.xlsx`);
    makeXlsx(filePath, [
      [
        "Date",
        "Campaign Name",
        "Ad Group Name",
        "Advertised ASIN",
        "Impressions",
        "Clicks",
        "Spend",
        "Sales",
        "Orders",
        "Units",
      ],
      [
        46046,
        "No ID Campaign",
        "AG Without ID",
        "b0noid12345",
        "100",
        "10",
        "$12.34",
        "56.78",
        "2",
        "3",
      ],
    ]);

    const result = parseSpAdvertisedProductReport(filePath);
    expect(result.rows.length).toBeGreaterThan(0);

    const first = result.rows[0];
    expect(first.date).toBe("2026-01-24");
    expect(first.campaign_id.startsWith("name:")).toBe(true);
    expect(first.ad_group_id).toBeNull();
    expect(first.campaign_name_raw).toBe("No ID Campaign");
    expect(first.advertised_asin_norm).toBe("B0NOID12345");
  });
});
