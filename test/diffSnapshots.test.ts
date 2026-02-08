import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { makeXlsx, HEADER_ROW } from "./utils/makeXlsx";
import { parseSponsoredProductsBulk } from "../src/bulk/parseSponsoredProductsBulk";
import { diffSnapshots } from "../src/bulk/diffSnapshots";

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

describe("diffSnapshots", () => {
  it("detects renames, changes, added and removed", async () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const oldPath = path.join(tmpDir, `old-${Date.now()}.xlsx`);
    const newPath = path.join(tmpDir, `new-${Date.now()}.xlsx`);

    const commonCampaign = {
      Entity: "Campaign",
      "Campaign ID": "100",
      "Campaign Name": "Old Name",
      "Portfolio ID": "700",
      State: "enabled",
      "Daily Budget": "5",
      "Bidding Strategy": "dynamic",
    };

    const oldRows = [
      HEADER_ROW,
      rowFromMap(commonCampaign),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "100",
        "Ad Group ID": "200",
        "Ad Group Name": "Ad Group One",
        State: "enabled",
        Bid: "1.0",
      }),
      rowFromMap({
        Entity: "Keyword",
        "Campaign ID": "100",
        "Ad Group ID": "200",
        "Keyword ID": "300",
        "Keyword Text": "blue shoes",
        "Match Type": "exact",
        State: "enabled",
        Bid: "0.5",
      }),
      rowFromMap({
        Entity: "Keyword",
        "Campaign ID": "100",
        "Ad Group ID": "200",
        "Keyword ID": "999",
        "Keyword Text": "old removed",
        "Match Type": "phrase",
        State: "enabled",
        Bid: "0.2",
      }),
      rowFromMap({
        Entity: "Bidding Adjustment",
        "Campaign ID": "100",
        Placement: "Top of Search",
        Percentage: "20",
      }),
    ];

    const newRows = [
      HEADER_ROW,
      rowFromMap({
        ...commonCampaign,
        "Campaign Name": "New Name",
        "Daily Budget": "10",
      }),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "100",
        "Ad Group ID": "200",
        "Ad Group Name": "Ad Group One",
        State: "enabled",
        Bid: "1.0",
      }),
      rowFromMap({
        Entity: "Keyword",
        "Campaign ID": "100",
        "Ad Group ID": "200",
        "Keyword ID": "300",
        "Keyword Text": "blue shoes",
        "Match Type": "exact",
        State: "paused",
        Bid: "0.75",
      }),
      rowFromMap({
        Entity: "Product Targeting",
        "Campaign ID": "100",
        "Ad Group ID": "200",
        "Product Targeting ID": "301",
        "Product Targeting Expression": "asin=NEW123",
        State: "enabled",
        Bid: "0.6",
      }),
      rowFromMap({
        Entity: "Bidding Adjustment",
        "Campaign ID": "100",
        Placement: "Top of Search",
        Percentage: "35",
      }),
      rowFromMap({
        Entity: "Campaign",
        "Campaign ID": "101",
        "Campaign Name": "Added Campaign",
        State: "enabled",
        "Daily Budget": "3",
        "Bidding Strategy": "fixed",
      }),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "101",
        "Ad Group ID": "201",
        "Ad Group Name": "Added Ad Group",
        State: "enabled",
        Bid: "0.8",
      }),
      rowFromMap({
        Entity: "Keyword",
        "Campaign ID": "101",
        "Ad Group ID": "201",
        "Keyword ID": "302",
        "Keyword Text": "added keyword",
        "Match Type": "phrase",
        State: "enabled",
        Bid: "0.4",
      }),
    ];

    makeXlsx(oldPath, oldRows);
    makeXlsx(newPath, newRows);

    const oldSnap = await parseSponsoredProductsBulk(oldPath, "2026-01-01");
    const newSnap = await parseSponsoredProductsBulk(newPath, "2026-02-01");

    const diff = diffSnapshots(oldSnap, newSnap);

    expect(diff.campaignRenames.length).toBe(1);
    expect(diff.campaignRenames[0]?.campaignId).toBe("100");
    expect(diff.campaignBudgetChanges.length).toBe(1);
    expect(diff.campaignBudgetChanges[0]?.toDailyBudget).toBe(10);

    expect(diff.placementChanges.length).toBe(1);
    expect(diff.placementChanges[0]?.toPercentage).toBe(35);

    expect(diff.targetBidChanges.length).toBe(1);
    expect(diff.targetBidChanges[0]?.targetId).toBe("300");
    expect(diff.targetStateChanges.length).toBe(1);
    expect(diff.targetStateChanges[0]?.toState).toBe("paused");

    expect(diff.added.campaigns).toContain("101");
    expect(diff.added.adGroups).toContain("201");
    expect(diff.added.targets).toContain("302");

    expect(diff.removed.targets).toContain("999");
  });
});
