import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseSponsoredDisplayBulk } from "../src/bulk/parseSponsoredDisplayBulk";

const HEADER_ROW = [
  "Entity",
  "Campaign ID",
  "Campaign Name",
  "Ad Group ID",
  "Ad Group Name",
  "Ad ID",
  "SKU",
  "ASIN",
  "Targeting ID",
  "Targeting Expression",
  "State",
  "Budget",
  "Tactic",
  "Cost Type",
  "Bid Optimization",
  "Bid",
  "Portfolio ID",
];

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

function writeSdBulkXlsx(filePath: string, rows: (string | number | boolean | null)[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Sponsored Display Campaigns");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSponsoredDisplayBulk", () => {
  it("parses SD campaigns, ad groups, product ads, and targets", async () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `sd-bulk-${Date.now()}.xlsx`);

    const rows = [
      HEADER_ROW,
      rowFromMap({
        Entity: "Campaign",
        "Campaign ID": "12345.0",
        "Campaign Name": "  SD Campaign  ",
        "Portfolio ID": "777",
        State: "enabled",
        Budget: "25",
        Tactic: "T00020",
        "Cost Type": "CPC",
        "Bid Optimization": "optimized",
      }),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Ad Group Name": "  SD Ad Group ",
        State: "enabled",
        Bid: "1.5",
      }),
      rowFromMap({
        Entity: "Product Ad",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Ad ID": "222",
        SKU: "SKU-1",
        ASIN: "ASIN1",
      }),
      rowFromMap({
        Entity: "Contextual Targeting",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Targeting ID": "333",
        "Targeting Expression": "asin=ASIN1",
        Bid: "0.75",
        "Cost Type": "CPC",
      }),
      rowFromMap({
        Entity: "Audience Targeting",
        "Campaign ID": "12345",
        "Ad Group ID": "999",
        "Targeting ID": "444",
        "Targeting Expression": "audience=remarketing",
        Bid: "0.5",
      }),
    ];

    writeSdBulkXlsx(filePath, rows);

    const snap = await parseSponsoredDisplayBulk(filePath, "2026-01-31");

    expect(snap.campaigns.length).toBe(1);
    expect(snap.adGroups.length).toBe(1);
    expect(snap.productAds.length).toBe(1);
    expect(snap.targets.length).toBe(2);

    expect(snap.campaigns[0]?.campaignId).toBe("12345");
    expect(snap.campaigns[0]?.campaignNameNorm).toBe("sd campaign");

    const contextual = snap.targets.find((t) => t.targetType === "CONTEXTUAL_TARGETING");
    const audience = snap.targets.find((t) => t.targetType === "AUDIENCE_TARGETING");
    expect(contextual?.expressionNorm).toBe("asin=asin1");
    expect(audience?.expressionRaw).toBe("audience=remarketing");
  });
});
