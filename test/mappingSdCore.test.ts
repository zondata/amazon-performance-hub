import { describe, expect, it } from "vitest";
import {
  BulkLookup,
  pickBulkSnapshotFromList,
  resolveCampaignId,
  resolveAdGroupId,
} from "../src/mapping_sd/core";
import { mapSdAdvertisedProductRows, mapSdTargetingRows } from "../src/mapping_sd/mappers";

function emptyLookup(): BulkLookup {
  return {
    campaignByName: new Map(),
    campaignById: new Map(),
    adGroupByCampaignName: new Map(),
    adGroupById: new Map(),
    targetByAdGroupKey: new Map(),
    targetByCampaignKey: new Map(),
    targetById: new Map(),
    adByGroupSku: new Map(),
    adByGroupAsin: new Map(),
    adById: new Map(),
    portfolioByName: new Map(),
    campaignHistoryByName: new Map(),
    adGroupHistoryByName: new Map(),
    overridesByName: new Map(),
  };
}

describe("sd pickBulkSnapshotFromList", () => {
  it("picks latest snapshot before or on exported date", () => {
    const result = pickBulkSnapshotFromList("2025-01-20", [
      "2025-01-01",
      "2025-01-15",
      "2025-02-05",
    ]);
    expect(result).toBe("2025-01-15");
  });

  it("falls forward within 7 days when no prior snapshot", () => {
    const result = pickBulkSnapshotFromList("2025-01-15", ["2025-01-20"]);
    expect(result).toBe("2025-01-20");
  });

  it("returns null when no snapshot within 7 days", () => {
    const result = pickBulkSnapshotFromList("2025-01-01", ["2025-01-20"]);
    expect(result).toBeNull();
  });
});

describe("sd resolvers", () => {
  it("returns ambiguous for duplicate campaigns", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("dup", [
      { campaign_id: "c1", portfolio_id: null },
      { campaign_id: "c2", portfolio_id: null },
    ]);

    const result = resolveCampaignId({
      campaignNameNorm: "dup",
      portfolioNameNorm: null,
      referenceDate: "2025-01-10",
      lookup,
    });

    expect(result.status).toBe("ambiguous");
  });

  it("returns ambiguous for duplicate ad groups", () => {
    const lookup = emptyLookup();
    lookup.adGroupByCampaignName.set("c1::ag", [
      { ad_group_id: "ag1", campaign_id: "c1" },
      { ad_group_id: "ag2", campaign_id: "c1" },
    ]);

    const result = resolveAdGroupId({
      campaignId: "c1",
      adGroupNameNorm: "ag",
      referenceDate: "2025-01-10",
      lookup,
    });

    expect(result.status).toBe("ambiguous");
  });
});

describe("sd key fallbacks", () => {
  it("builds deterministic target_key when target_id is missing", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("camp", [{ campaign_id: "c1", portfolio_id: null }]);
    lookup.campaignById.set("c1", { campaign_id: "c1", portfolio_id: null });
    lookup.adGroupByCampaignName.set("c1::ag", [{ ad_group_id: "ag1", campaign_id: "c1" }]);
    lookup.adGroupById.set("ag1", { ad_group_id: "ag1", campaign_id: "c1" });

    const { facts, issues } = mapSdTargetingRows({
      rows: [
        {
          date: "2025-01-01",
          portfolio_name_raw: null,
          portfolio_name_norm: null,
          campaign_name_raw: "Camp",
          campaign_name_norm: "camp",
          ad_group_name_raw: "Ag",
          ad_group_name_norm: "ag",
          targeting_raw: "audience",
          targeting_norm: "audience",
          match_type_raw: null,
          match_type_norm: null,
          cost_type: "CPC",
          impressions: 1,
          clicks: 0,
          spend: 0,
          sales: 0,
          orders: 0,
          units: 0,
          cpc: null,
          ctr: null,
          acos: null,
          roas: null,
          conversion_rate: null,
        },
      ],
      lookup,
      uploadId: "u1",
      accountId: "a1",
      exportedAt: "2025-01-02T00:00:00Z",
      referenceDate: "2025-01-02",
    });

    expect(facts.length).toBe(1);
    expect(facts[0]?.target_id).toBeNull();
    const expectedKey = JSON.stringify({
      campaign_name_norm: "camp",
      portfolio_name_norm: null,
      ad_group_name_norm: "ag",
      targeting_norm: "audience",
      match_type_norm: null,
      cost_type: "CPC",
    });
    expect(facts[0]?.target_key).toBe(expectedKey);
    expect(issues.length).toBe(1);
    expect(issues[0]?.entity_level).toBe("target");
  });

  it("builds deterministic ad_key when ad_id is missing", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("camp", [{ campaign_id: "c1", portfolio_id: null }]);
    lookup.campaignById.set("c1", { campaign_id: "c1", portfolio_id: null });
    lookup.adGroupByCampaignName.set("c1::ag", [{ ad_group_id: "ag1", campaign_id: "c1" }]);
    lookup.adGroupById.set("ag1", { ad_group_id: "ag1", campaign_id: "c1" });

    const { facts, issues } = mapSdAdvertisedProductRows({
      rows: [
        {
          date: "2025-01-01",
          portfolio_name_raw: null,
          portfolio_name_norm: null,
          campaign_name_raw: "Camp",
          campaign_name_norm: "camp",
          ad_group_name_raw: "Ag",
          ad_group_name_norm: "ag",
          advertised_sku_raw: "SKU-1",
          advertised_sku_norm: "sku-1",
          advertised_asin_raw: null,
          advertised_asin_norm: null,
          cost_type: "CPC",
          impressions: 1,
          clicks: 0,
          spend: 0,
          sales: 0,
          orders: 0,
          units: 0,
          cpc: null,
          ctr: null,
          acos: null,
          roas: null,
          conversion_rate: null,
        },
      ],
      lookup,
      uploadId: "u1",
      accountId: "a1",
      exportedAt: "2025-01-02T00:00:00Z",
      referenceDate: "2025-01-02",
    });

    expect(facts.length).toBe(1);
    expect(facts[0]?.ad_id).toBeNull();
    const expectedKey = JSON.stringify({
      campaign_name_norm: "camp",
      portfolio_name_norm: null,
      ad_group_name_norm: "ag",
      advertised_sku_norm: "sku-1",
      advertised_asin_norm: null,
      cost_type: "CPC",
    });
    expect(facts[0]?.ad_key).toBe(expectedKey);
    expect(issues.length).toBe(1);
    expect(issues[0]?.entity_level).toBe("ad");
  });
});
