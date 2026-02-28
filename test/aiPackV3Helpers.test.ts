import { describe, expect, it } from "vitest";

import {
  calcCvrOrdersPerClick,
  classifySpPlacementSpendScaling,
  derivePlacementSpendReconciliation,
  mapPlacementModifierKey,
  weightedAvgTosIs,
} from "../apps/web/src/lib/logbook/aiPack/aiPackV3Helpers";

describe("aiPackV3Helpers", () => {
  it("uses orders/clicks for CVR", () => {
    const cvr = calcCvrOrdersPerClick(4, 20);
    expect(cvr).toBe(0.2);
  });

  it("computes weighted SP top-of-search impression share", () => {
    const value = weightedAvgTosIs([
      { impressions: 100, share: 0.2 },
      { impressions: 50, share: 0.5 },
      { impressions: 20, share: null },
    ]);
    // (100*0.2 + 50*0.5) / (100 + 50)
    expect(value).toBeCloseTo(0.3, 10);
  });

  it("maps SP placement rows to bulk modifier keys", () => {
    expect(mapPlacementModifierKey("sp", "TOS", "top of search")).toBe("PLACEMENT_TOP");
    expect(mapPlacementModifierKey("sp", "ROS", "rest of search")).toBe(
      "PLACEMENT_REST_OF_SEARCH"
    );
    expect(mapPlacementModifierKey("sp", "PP", "product pages")).toBe(
      "PLACEMENT_PRODUCT_PAGE"
    );
    expect(mapPlacementModifierKey("sp", "OA", "off-amazon")).toBeNull();
    expect(mapPlacementModifierKey("sp", null, "amazon business placements")).toBe(
      "PLACEMENT_AMAZON_BUSINESS"
    );
  });

  it("maps SB placement rows to bulk modifier keys", () => {
    expect(mapPlacementModifierKey("sb", "TOS", "top of search")).toBe("TOS");
    expect(mapPlacementModifierKey("sb", "PP", "product pages")).toBe("DETAIL_PAGE");
    expect(mapPlacementModifierKey("sb", "HOME", "homepage")).toBe("HOME");
    expect(mapPlacementModifierKey("sb", "ROS", "rest of search")).toBe("OTHER");
  });

  it("returns ok when placement spend matches campaign spend", () => {
    const reconciliation = derivePlacementSpendReconciliation({
      campaignSpend: 120,
      campaignClicks: 80,
      campaignSales: 300,
      placementSpendReportedSum: 120,
      placementClicksSum: 80,
      placementSalesSum: 300,
    });

    expect(reconciliation.status).toBe("ok");
    expect(reconciliation.spend_scale_factor).toBe(1);
    expect(reconciliation.spend_gap_reported).toBe(0);
  });

  it("returns scaled_to_campaign_total when clicks align but spend does not", () => {
    const reconciliation = derivePlacementSpendReconciliation({
      campaignSpend: 150,
      campaignClicks: 100,
      campaignSales: 500,
      placementSpendReportedSum: 100,
      placementClicksSum: 101,
      placementSalesSum: 480,
    });

    expect(reconciliation.status).toBe("scaled_to_campaign_total");
    expect(reconciliation.spend_scale_factor).toBeCloseTo(1.5, 10);
  });

  it("returns missing_reported_spend when campaign has spend but placements do not", () => {
    const reconciliation = derivePlacementSpendReconciliation({
      campaignSpend: 75,
      campaignClicks: 40,
      campaignSales: 250,
      placementSpendReportedSum: 0,
      placementClicksSum: 40,
      placementSalesSum: 250,
    });

    expect(reconciliation.status).toBe("missing_reported_spend");
    expect(reconciliation.spend_scale_factor).toBeNull();
  });

  it("returns mismatch when spend does not reconcile and clicks are not aligned", () => {
    const reconciliation = derivePlacementSpendReconciliation({
      campaignSpend: 200,
      campaignClicks: 100,
      campaignSales: 700,
      placementSpendReportedSum: 140,
      placementClicksSum: 70,
      placementSalesSum: 300,
    });

    expect(reconciliation.status).toBe("mismatch");
    expect(reconciliation.spend_scale_factor).toBeNull();
  });

  it("classifies small scaled reconciliation as minor_scaled", () => {
    const reconciliation = derivePlacementSpendReconciliation({
      campaignSpend: 21.42,
      campaignClicks: 47,
      campaignSales: 100,
      placementSpendReportedSum: 20.97,
      placementClicksSum: 46,
      placementSalesSum: 100,
    });

    expect(reconciliation.status).toBe("scaled_to_campaign_total");
    expect(classifySpPlacementSpendScaling(reconciliation)).toBe("minor_scaled");
  });

  it("classifies large scaled reconciliation as major_scaled", () => {
    const reconciliation = derivePlacementSpendReconciliation({
      campaignSpend: 765.81,
      campaignClicks: 100,
      campaignSales: 500,
      placementSpendReportedSum: 700,
      placementClicksSum: 100,
      placementSalesSum: 500,
    });

    expect(reconciliation.status).toBe("scaled_to_campaign_total");
    expect(classifySpPlacementSpendScaling(reconciliation)).toBe("major_scaled");
  });

  it("classifies non-scaled reconciliation as ok", () => {
    const reconciliation = derivePlacementSpendReconciliation({
      campaignSpend: 100,
      campaignClicks: 50,
      campaignSales: 250,
      placementSpendReportedSum: 100.0001,
      placementClicksSum: 50,
      placementSalesSum: 250,
    });

    expect(reconciliation.status).toBe("ok");
    expect(classifySpPlacementSpendScaling(reconciliation)).toBe("ok");
  });
});
