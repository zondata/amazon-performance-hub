import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { makeXlsx, HEADER_ROW } from "./utils/makeXlsx";
import { parseSponsoredProductsBulk } from "../src/bulk/parseSponsoredProductsBulk";
import { buildNameHistory } from "../src/bulk/buildNameHistory";

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

describe("buildNameHistory", () => {
  it("tracks name changes across snapshots", async () => {
    const tmpDir = path.resolve(__dirname, "tmp");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const file1 = path.join(tmpDir, "Bulk_20260101-20260131.xlsx");
    const file2 = path.join(tmpDir, "Bulk_20260201-20260228.xlsx");
    const file3 = path.join(tmpDir, "Bulk_20260301-20260331.xlsx");

    const baseRows = [HEADER_ROW];

    makeXlsx(file1, [
      ...baseRows,
      rowFromMap({
        Entity: "Campaign",
        "Campaign ID": "500",
        "Campaign Name": "A One",
        State: "enabled",
        "Daily Budget": "5",
        "Bidding Strategy": "dynamic",
      }),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "500",
        "Ad Group ID": "600",
        "Ad Group Name": "Group One",
        State: "enabled",
        Bid: "1.0",
      }),
    ]);

    makeXlsx(file2, [
      ...baseRows,
      rowFromMap({
        Entity: "Campaign",
        "Campaign ID": "500",
        "Campaign Name": "A Two",
        State: "enabled",
        "Daily Budget": "5",
        "Bidding Strategy": "dynamic",
      }),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "500",
        "Ad Group ID": "600",
        "Ad Group Name": "Group Two",
        State: "enabled",
        Bid: "1.0",
      }),
    ]);

    makeXlsx(file3, [
      ...baseRows,
      rowFromMap({
        Entity: "Campaign",
        "Campaign ID": "500",
        "Campaign Name": "A Two",
        State: "enabled",
        "Daily Budget": "5",
        "Bidding Strategy": "dynamic",
      }),
      rowFromMap({
        Entity: "Ad Group",
        "Campaign ID": "500",
        "Ad Group ID": "600",
        "Ad Group Name": "Group Two",
        State: "enabled",
        Bid: "1.0",
      }),
    ]);

    const snap1 = await parseSponsoredProductsBulk(file1, "2026-01-31");
    const snap2 = await parseSponsoredProductsBulk(file2, "2026-02-28");
    const snap3 = await parseSponsoredProductsBulk(file3, "2026-03-31");

    const history = buildNameHistory([snap1, snap2, snap3]);

    const campaignRows = history.filter((row) => row.entityType === "campaign");
    const adGroupRows = history.filter((row) => row.entityType === "adGroup");

    expect(campaignRows.length).toBe(2);
    expect(campaignRows[0]?.validFrom).toBe("2026-01-31");
    expect(campaignRows[0]?.validTo).toBe("2026-02-27");
    expect(campaignRows[1]?.validFrom).toBe("2026-02-28");
    expect(campaignRows[1]?.validTo).toBeNull();

    expect(adGroupRows.length).toBe(2);
    expect(adGroupRows[0]?.validFrom).toBe("2026-01-31");
    expect(adGroupRows[0]?.validTo).toBe("2026-02-27");
    expect(adGroupRows[1]?.validFrom).toBe("2026-02-28");
    expect(adGroupRows[1]?.validTo).toBeNull();
  });
});
