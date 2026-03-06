import { describe, expect, it } from "vitest";

import type { BulkLookup } from "../src/mapping/core";
import { mapSpAdvertisedProductRows } from "../src/mapping/mappers";

function emptyLookup(): BulkLookup {
  return {
    campaignByName: new Map(),
    campaignById: new Map(),
    adGroupByCampaignName: new Map(),
    adGroupById: new Map(),
    targetByAdGroupKey: new Map(),
    targetById: new Map(),
    portfolioByName: new Map(),
    campaignHistoryByName: new Map(),
    adGroupHistoryByName: new Map(),
    overridesByName: new Map(),
    categoryIdByNameNorm: new Map(),
  };
}

describe("mapSpAdvertisedProductRows", () => {
  it("resolves canonical campaign and ad-group IDs from names instead of raw informational IDs", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("campaign a", [{ campaign_id: "c1", portfolio_id: null }]);
    lookup.campaignById.set("c1", { campaign_id: "c1", portfolio_id: null });
    lookup.adGroupByCampaignName.set("c1::ad group a", [{ ad_group_id: "ag1", campaign_id: "c1" }]);
    lookup.adGroupById.set("ag1", { ad_group_id: "ag1", campaign_id: "c1" });

    const { facts, issues } = mapSpAdvertisedProductRows({
      rows: [
        {
          date: "2026-03-01",
          campaign_id: "999999999",
          ad_group_id: "888888888",
          campaign_name_raw: "Campaign A",
          campaign_name_norm: "campaign a",
          ad_group_name_raw: "Ad Group A",
          ad_group_name_norm: "ad group a",
          advertised_asin_raw: "b0test1234",
          advertised_asin_norm: "B0TEST1234",
          sku_raw: "sku-1",
          impressions: 100,
          clicks: 10,
          spend: 20,
          sales: 50,
          orders: 2,
          units: 2,
        },
      ],
      lookup,
      uploadId: "u1",
      accountId: "acct",
      exportedAt: "2026-03-02T00:00:00.000Z",
      referenceDate: "2026-03-02",
    });

    expect(facts).toHaveLength(1);
    expect(facts[0]?.campaign_id).toBe("c1");
    expect(facts[0]?.ad_group_id).toBe("ag1");
    expect(issues).toHaveLength(0);
  });

  it("keeps campaign-level coverage when ad-group name cannot be mapped and logs the issue", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("campaign a", [{ campaign_id: "c1", portfolio_id: null }]);
    lookup.campaignById.set("c1", { campaign_id: "c1", portfolio_id: null });

    const { facts, issues } = mapSpAdvertisedProductRows({
      rows: [
        {
          date: "2026-03-01",
          campaign_id: "raw-c1",
          ad_group_id: null,
          campaign_name_raw: "Campaign A",
          campaign_name_norm: "campaign a",
          ad_group_name_raw: "Unknown Ad Group",
          ad_group_name_norm: "unknown ad group",
          advertised_asin_raw: "b0test1234",
          advertised_asin_norm: "B0TEST1234",
          sku_raw: null,
          impressions: 100,
          clicks: 10,
          spend: 20,
          sales: 50,
          orders: 2,
          units: 2,
        },
      ],
      lookup,
      uploadId: "u1",
      accountId: "acct",
      exportedAt: "2026-03-02T00:00:00.000Z",
      referenceDate: "2026-03-02",
    });

    expect(facts).toHaveLength(1);
    expect(facts[0]?.campaign_id).toBe("c1");
    expect(facts[0]?.ad_group_id).toBeNull();
    expect(issues).toHaveLength(1);
    expect(issues[0]?.entity_level).toBe("ad_group");
    expect(issues[0]?.issue_type).toBe("unmapped");
  });
});
