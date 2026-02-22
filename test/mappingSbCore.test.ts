import { describe, expect, it } from "vitest";
import {
  pickBulkSnapshotFromList,
  resolveCampaignId,
  BulkLookup,
  resolveTargetId,
  buildTargetKey,
  normalizeCategoryExpression,
} from "../src/mapping_sb/core";
import { mapSbStisRows } from "../src/mapping_sb/mappers";

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

describe("sb pickBulkSnapshotFromList", () => {
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
});

describe("sb resolveCampaignId", () => {
  it("resolves via snapshot", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("summer", [{ campaign_id: "c1", portfolio_id: null }]);
    lookup.campaignById.set("c1", { campaign_id: "c1", portfolio_id: null });

    const result = resolveCampaignId({
      campaignNameNorm: "summer",
      portfolioNameNorm: null,
      referenceDate: "2025-01-10",
      lookup,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.id).toBe("c1");
  });
});

describe("sb resolveTargetId", () => {
  it("maps UNKNOWN asin=... to TARGETING_EXPRESSION", () => {
    const lookup = emptyLookup();
    const adGroupId = "ag1";
    const expressionNorm = "asin=\"b0123abc\"";
    const key = buildTargetKey(adGroupId, expressionNorm, "TARGETING_EXPRESSION", false);
    lookup.targetByAdGroupKey.set(key, [
      { target_id: "t1", ad_group_id: adGroupId, match_type_norm: "TARGETING_EXPRESSION", is_negative: false },
    ]);

    const result = resolveTargetId({
      adGroupId,
      expressionNorm,
      matchTypeNorm: "UNKNOWN",
      matchTypeRaw: null,
      isNegative: false,
      referenceDate: "2025-01-10",
      lookup,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.id).toBe("t1");
  });
});

describe("sb normalizeCategoryExpression", () => {
  it("maps category name expression to category id expression when lookup contains a mapping", () => {
    const lookup = emptyLookup();
    lookup.categoryIdByNameNorm.set("retirement planning", "12345");

    const normalized = normalizeCategoryExpression('category="retirement planning"', lookup);
    expect(normalized).toBe('category="12345"');
  });
});

describe("sb mapSbStisRows", () => {
  it("accepts search-term rows with null target_id and deterministic target_key", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("camp", [{ campaign_id: "c1", portfolio_id: null }]);
    lookup.campaignById.set("c1", { campaign_id: "c1", portfolio_id: null });
    lookup.adGroupByCampaignName.set("c1::ag", [{ ad_group_id: "ag1", campaign_id: "c1" }]);
    lookup.adGroupById.set("ag1", { ad_group_id: "ag1", campaign_id: "c1" });

    const { facts, issues } = mapSbStisRows({
      rows: [
        {
          date: "2025-01-01",
          portfolio_name_raw: null,
          portfolio_name_norm: null,
          campaign_name_raw: "Camp",
          campaign_name_norm: "camp",
          ad_group_name_raw: "Ag",
          ad_group_name_norm: "ag",
          targeting_raw: "*",
          targeting_norm: "*",
          match_type_raw: null,
          match_type_norm: null,
          customer_search_term_raw: "term",
          customer_search_term_norm: "term",
          search_term_impression_rank: null,
          search_term_impression_share: null,
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

    expect(issues.length).toBe(0);
    expect(facts.length).toBe(1);
    expect(facts[0]?.target_id).toBeNull();
    const expectedKey = JSON.stringify({
      campaign_name_norm: "camp",
      portfolio_name_norm: null,
      ad_group_name_norm: "ag",
      targeting_norm: "*",
      match_type_norm: null,
      is_negative: false,
    });
    expect(facts[0]?.target_key).toBe(expectedKey);
  });
});
