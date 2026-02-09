import { describe, expect, it } from "vitest";
import {
  pickBulkSnapshotFromList,
  resolveCampaignId,
  BulkLookup,
  resolveTargetId,
  buildTargetKey,
} from "../src/mapping/core";
import { mapSpCampaignRows } from "../src/mapping/mappers";
import { mapSpStisRows } from "../src/mapping/mappers";

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

describe("pickBulkSnapshotFromList", () => {
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

describe("resolveCampaignId", () => {
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

  it("resolves via history when snapshot missing", () => {
    const lookup = emptyLookup();
    lookup.campaignHistoryByName.set("rename", [
      {
        entity_id: "c2",
        name_norm: "rename",
        valid_from: "2025-01-01",
        valid_to: "2025-01-31",
      },
    ]);

    const result = resolveCampaignId({
      campaignNameNorm: "rename",
      portfolioNameNorm: null,
      referenceDate: "2025-01-15",
      lookup,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.id).toBe("c2");
  });

  it("resolves via override first", () => {
    const lookup = emptyLookup();
    lookup.overridesByName.set("campaign::forced", [
      {
        entity_id: "c3",
        name_norm: "forced",
        valid_from: null,
        valid_to: null,
      },
    ]);
    lookup.campaignByName.set("forced", [{ campaign_id: "c4", portfolio_id: null }]);

    const result = resolveCampaignId({
      campaignNameNorm: "forced",
      portfolioNameNorm: null,
      referenceDate: "2025-01-15",
      lookup,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.id).toBe("c3");
  });

  it("returns ambiguous when multiple candidates", () => {
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
});

describe("mapSpCampaignRows", () => {
  it("logs ambiguous mapping issue and skips fact", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("dup", [
      { campaign_id: "c1", portfolio_id: null },
      { campaign_id: "c2", portfolio_id: null },
    ]);

    const { facts, issues } = mapSpCampaignRows({
      rows: [
        {
          date: "2025-01-01",
          start_time: "01:00",
          portfolio_name_raw: null,
          portfolio_name_norm: null,
          campaign_name_raw: "Dup",
          campaign_name_norm: "dup",
          impressions: 10,
          clicks: 1,
          spend: 2,
          sales: 3,
          orders: 1,
          units: 1,
        },
      ],
      lookup,
      uploadId: "u1",
      accountId: "a1",
      exportedAt: "2025-01-02T00:00:00Z",
      referenceDate: "2025-01-02",
    });

    expect(facts.length).toBe(0);
    expect(issues.length).toBe(1);
    expect(issues[0]?.issue_type).toBe("ambiguous");
  });
});

describe("resolveTargetId", () => {
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
      matchTypeNorm: "TARGETING_EXPRESSION",
      matchTypeRaw: "TARGETING_EXPRESSION",
      isNegative: false,
      referenceDate: "2025-01-10",
      lookup,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.id).toBe("t1");
  });

  it("maps auto clause to TARGETING_EXPRESSION even when matchTypeNorm is not UNKNOWN", () => {
    const lookup = emptyLookup();
    const adGroupId = "ag2";
    const expressionNorm = "substitutes";
    const key = buildTargetKey(adGroupId, expressionNorm, "TARGETING_EXPRESSION", false);
    lookup.targetByAdGroupKey.set(key, [
      { target_id: "t2", ad_group_id: adGroupId, match_type_norm: "TARGETING_EXPRESSION", is_negative: false },
    ]);

    const result = resolveTargetId({
      adGroupId,
      expressionNorm,
      matchTypeNorm: "THEME",
      matchTypeRaw: "THEME",
      isNegative: false,
      referenceDate: "2025-01-10",
      lookup,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.id).toBe("t2");
  });

  it("maps category name to category id before lookup", () => {
    const lookup = emptyLookup();
    const adGroupId = "ag3";
    const categoryName = "tumblers & water glasses";
    const categoryId = "13218451";
    lookup.categoryIdByNameNorm.set(categoryName, categoryId);

    const expressionNorm = `category=\"${categoryName}\"`;
    const key = buildTargetKey(adGroupId, `category=\"${categoryId}\"`, "TARGETING_EXPRESSION", false);
    lookup.targetByAdGroupKey.set(key, [
      { target_id: "t3", ad_group_id: adGroupId, match_type_norm: "TARGETING_EXPRESSION", is_negative: false },
    ]);

    const result = resolveTargetId({
      adGroupId,
      expressionNorm,
      matchTypeNorm: "TARGETING_EXPRESSION",
      matchTypeRaw: "TARGETING_EXPRESSION",
      isNegative: false,
      referenceDate: "2025-01-10",
      lookup,
    });

    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.id).toBe("t3");
  });
});

describe("mapSpStisRows", () => {
  it("accepts roll-up targeting_norm='*' without issue", () => {
    const lookup = emptyLookup();
    lookup.campaignByName.set("camp", [{ campaign_id: "c1", portfolio_id: null }]);
    lookup.campaignById.set("c1", { campaign_id: "c1", portfolio_id: null });
    lookup.adGroupByCampaignName.set("c1::ag", [{ ad_group_id: "ag1", campaign_id: "c1" }]);
    lookup.adGroupById.set("ag1", { ad_group_id: "ag1", campaign_id: "c1" });

    const { facts, issues } = mapSpStisRows({
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
    expect(facts[0]?.target_key).toBe("__ROLLUP__");
  });
});
