import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, it, expect } from "vitest";
import { parseSponsoredBrandsBulk } from "../src/bulk/parseSponsoredBrandsBulk";

const SB_CAMPAIGN_HEADER = [
  "Entity",
  "Campaign ID",
  "Campaign Name",
  "Portfolio ID",
  "State",
  "Daily Budget",
  "Bid Optimization",
  "Ad Group ID",
  "Ad Group Name",
  "Keyword ID",
  "Keyword Text",
  "Match Type",
  "Bid",
  "Product Targeting ID",
  "Product Targeting Expression",
];

const SB_MULTI_HEADER = [
  "Entity",
  "Campaign ID",
  "Campaign Name",
  "Portfolio ID",
  "State",
  "Daily Budget",
  "Bid Optimization",
  "Ad Group ID",
  "Ad Group Name",
  "Keyword ID",
  "Keyword Text",
  "Match Type",
  "Bid",
  "Product Targeting ID",
  "Product Targeting Expression",
  "Placement",
  "Percentage",
];

function rowFromMap(header: string[], values: Record<string, string | number | boolean | null>) {
  const headerIndex = new Map(header.map((name, idx) => [name, idx] as const));
  const row = new Array(header.length).fill("");
  for (const [key, value] of Object.entries(values)) {
    const idx = headerIndex.get(key);
    if (idx !== undefined) {
      row[idx] = value;
    }
  }
  return row as (string | number | boolean | null)[];
}

function makeSbWorkbook(
  filePath: string,
  campaignRows: (string | number | boolean | null)[][],
  multiRows: (string | number | boolean | null)[][]
) {
  const workbook = XLSX.utils.book_new();
  const campaignSheet = XLSX.utils.aoa_to_sheet(campaignRows);
  const multiSheet = XLSX.utils.aoa_to_sheet(multiRows);
  XLSX.utils.book_append_sheet(workbook, campaignSheet, "Sponsored Brands Campaigns");
  XLSX.utils.book_append_sheet(workbook, multiSheet, "SB Multi Ad Group Campaigns");
  XLSX.writeFile(workbook, filePath);
}

describe("parseSponsoredBrandsBulk", () => {
  it("parses SB sheets and synthesizes legacy ad group", async () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const filePath = path.join(tmpDir, `bulk-sb-${Date.now()}.xlsx`);

    const campaignRows = [
      SB_CAMPAIGN_HEADER,
      rowFromMap(SB_CAMPAIGN_HEADER, {
        Entity: "Campaign",
        "Campaign ID": "321.0",
        "Campaign Name": "  Brand SB ",
        "Portfolio ID": "555",
        State: "enabled",
        "Daily Budget": "25",
        "Bid Optimization": "reach",
      }),
      rowFromMap(SB_CAMPAIGN_HEADER, {
        Entity: "Keyword",
        "Campaign ID": "321",
        "Ad Group ID": "888",
        "Keyword ID": "111",
        "Keyword Text": "  Blue  Shoes ",
        "Match Type": "PHRASE",
        State: "enabled",
        Bid: "0.7",
      }),
      rowFromMap(SB_CAMPAIGN_HEADER, {
        Entity: "Product Targeting",
        "Campaign ID": "321",
        "Ad Group ID": "888",
        "Product Targeting ID": "222",
        "Product Targeting Expression": "asin=ASIN123",
        State: "paused",
        Bid: "1.1",
      }),
      rowFromMap(SB_CAMPAIGN_HEADER, {
        Entity: "Negative Keyword",
        "Campaign ID": "321",
        "Ad Group ID": "888",
        "Keyword ID": "333",
        "Keyword Text": "bad word",
        "Match Type": "EXACT",
        State: "paused",
      }),
    ];

    const multiRows = [
      SB_MULTI_HEADER,
      rowFromMap(SB_MULTI_HEADER, {
        Entity: "Campaign",
        "Campaign ID": "999",
        "Campaign Name": " Multi Camp ",
        "Portfolio ID": "777",
        State: "enabled",
        "Daily Budget": "99",
        "Bid Optimization": "reach",
      }),
      rowFromMap(SB_MULTI_HEADER, {
        Entity: "Ad Group",
        "Campaign ID": "321",
        "Ad Group ID": "999",
        "Ad Group Name": "  Primary AG ",
      }),
      rowFromMap(SB_MULTI_HEADER, {
        Entity: "Keyword",
        "Campaign ID": "999",
        "Ad Group ID": "555",
        "Keyword ID": "444",
        "Keyword Text": " Multi Shoes ",
        "Match Type": "BROAD",
        Bid: "0.9",
        State: "enabled",
      }),
      rowFromMap(SB_MULTI_HEADER, {
        Entity: "Bidding Adjustment by Placement",
        "Campaign ID": "321",
        Placement: "Home Page",
        Percentage: "50",
      }),
    ];

    makeSbWorkbook(filePath, campaignRows, multiRows);

    const snap = await parseSponsoredBrandsBulk(filePath, "2026-01-31");

    expect(snap.campaigns.length).toBe(2);
    expect(snap.adGroups.length).toBe(3);
    expect(snap.targets.length).toBe(4);
    expect(snap.placements.length).toBe(1);

    const campaign321 = snap.campaigns.find((row) => row.campaignId === "321");
    const campaign999 = snap.campaigns.find((row) => row.campaignId === "999");
    expect(campaign321?.campaignNameNorm).toBe("brand sb");
    expect(campaign321?.biddingStrategy).toBe("reach");
    expect(campaign999?.campaignNameNorm).toBe("multi camp");

    const synthetic = snap.adGroups.find((row) => row.adGroupId === "888");
    expect(synthetic?.adGroupNameRaw).toBe("Ad group");
    expect(synthetic?.adGroupNameNorm).toBe("ad group");
    const syntheticMulti = snap.adGroups.find((row) => row.adGroupId === "555");
    expect(syntheticMulti?.adGroupNameRaw).toBe("Ad group");

    const keyword = snap.targets.find((row) => row.targetId === "111");
    const product = snap.targets.find((row) => row.targetId === "222");
    const negative = snap.targets.find((row) => row.targetId === "333");
    const multiKeyword = snap.targets.find((row) => row.targetId === "444");

    expect(keyword?.expressionNorm).toBe("blue shoes");
    expect(keyword?.matchType).toBe("PHRASE");
    expect(keyword?.isNegative).toBe(false);
    expect(keyword?.bid).toBe(0.7);

    expect(product?.matchType).toBe("TARGETING_EXPRESSION");

    expect(negative?.isNegative).toBe(true);
    expect(negative?.bid).toBeNull();

    expect(multiKeyword?.matchType).toBe("BROAD");
    expect(multiKeyword?.expressionNorm).toBe("multi shoes");

    expect(snap.placements[0]?.placementCode).toBe("HOME");
    expect(snap.placements[0]?.placementRawNorm).toBe("home page");
  });
});
