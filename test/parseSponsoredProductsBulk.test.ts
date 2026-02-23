import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { makeXlsx, HEADER_ROW } from "./utils/makeXlsx";
import {
  parseSponsoredProductsBulk,
  cleanId,
  normText,
} from "../src/bulk/parseSponsoredProductsBulk";

function rowFromMap(values: Record<string, string | number | boolean | null>) {
  const headerIndex = new Map(HEADER_ROW.map((name, idx) => [name, idx] as const));
  const row = new Array(HEADER_ROW.length).fill("");
  for (const [key, value] of Object.entries(values)) {
    const idx = headerIndex.get(key);
    if (idx !== undefined) {
      row[idx] = value;
    }
  }
  return row as (string | number | boolean | null)[];
}

describe("parseSponsoredProductsBulk", () => {
  it("parses entities and helpers", async () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `bulk-${Date.now()}.xlsx`);

    const rows = [
      HEADER_ROW,
      rowFromMap({
        Entity: "Campaign",
        "Campaign ID": "12345.0",
        "Campaign Name": "  Test Campaign  ",
        "Portfolio ID": "777",
        State: "enabled",
        "Daily Budget": "10",
        "Bidding Strategy": "dynamic",
      }),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Ad Group Name": "  My Ad  Group ",
        State: "enabled",
        Bid: "1.25",
      }),
      rowFromMap({
        Entity: "Product Ad",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Ad ID": "333.0",
        SKU: "  SKU-123  ",
        "ASIN (Informational only)": "  b0testasin1  ",
      }),
      rowFromMap({
        Entity: "Keyword",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Keyword ID": "111",
        "Keyword Text": "  Red   Shoes  ",
        "Match Type": "exact",
        State: "enabled",
        Bid: "0.75",
      }),
      rowFromMap({
        Entity: "Product Targeting",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Product Targeting ID": "222",
        "Product Targeting Expression": "asin=TEST123",
        State: "paused",
        Bid: "0.5",
      }),
      rowFromMap({
        Entity: "Bidding Adjustment",
        "Campaign ID": "12345",
        Placement: "Top of Search",
        Percentage: "50",
      }),
      rowFromMap({
        Entity: "Portfolio",
        "Portfolio ID": "777",
        "Portfolio Name": "  Brand   Portfolio ",
      }),
    ];

    makeXlsx(filePath, rows);

    const snap = await parseSponsoredProductsBulk(filePath, "2026-01-31");

    expect(snap.campaigns.length).toBe(1);
    expect(snap.adGroups.length).toBe(1);
    expect(snap.targets.length).toBe(2);
    expect(snap.placements.length).toBe(1);
    expect(snap.productAds.length).toBe(1);
    expect(snap.portfolios.length).toBe(1);

    expect(snap.campaigns[0]?.campaignId).toBe("12345");
    expect(snap.campaigns[0]?.campaignNameNorm).toBe("test campaign");
    expect(snap.adGroups[0]?.adGroupNameNorm).toBe("my ad group");

    const keywordTarget = snap.targets.find((t) => t.matchType === "exact");
    const productTarget = snap.targets.find((t) => t.matchType === "TARGETING_EXPRESSION");
    expect(keywordTarget?.expressionNorm).toBe("red shoes");
    expect(productTarget?.expressionRaw).toBe("asin=TEST123");

    expect(snap.placements[0]?.placement).toBe("Top of Search");
    expect(snap.productAds[0]).toEqual({
      adId: "333",
      adGroupId: "999",
      campaignId: "12345",
      skuRaw: "SKU-123",
      asinRaw: "b0testasin1",
    });
  });

  it("cleanId strips trailing .0", () => {
    expect(cleanId("12345.0")).toBe("12345");
    expect(cleanId(12345)).toBe("12345");
    expect(cleanId("")).toBeNull();
  });

  it("normText lowercases and collapses whitespace", () => {
    expect(normText("  Hello   WORLD ")).toBe("hello world");
  });
});
