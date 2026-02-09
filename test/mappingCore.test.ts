import { describe, expect, it } from "vitest";
import {
  pickBulkSnapshotFromList,
  resolveCampaignId,
  BulkLookup,
} from "../src/mapping/core";
import { mapSpCampaignRows } from "../src/mapping/mappers";

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
