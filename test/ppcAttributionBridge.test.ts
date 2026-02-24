import { describe, expect, it } from "vitest";

import { computePpcAttributionBridge } from "../apps/web/src/lib/logbook/aiPack/ppcAttributionBridge";

describe("computePpcAttributionBridge", () => {
  it("computes PPC attribution totals and coverage ratios for normal inputs", () => {
    const result = computePpcAttributionBridge({
      siPpcCostTotal: 1223.59,
      spAttributedSpendTotal: 454.5,
      spAdvertisedAsinSpendTotal: 300,
      spMappedCampaignSpendTotal: 633,
      sbSpendTotalUnattributed: 300,
      sdSpendTotalUnattributed: 0,
    });

    expect(result.sp_unattributed_spend_total).toBeCloseTo(178.5, 6);
    expect(result.si_gap_vs_sp_attributed_total).toBeCloseTo(769.09, 6);
    expect(result.coverage.sp_vs_si_pct).toBeCloseTo(454.5 / 1223.59, 6);
    expect(result.coverage.sp_advertised_vs_si_pct).toBeCloseTo(300 / 1223.59, 6);
    expect(result.coverage.sp_vs_sp_campaign_pct).toBeCloseTo(454.5 / 633, 6);
  });

  it("clamps negatives and handles divide-by-zero coverage", () => {
    const result = computePpcAttributionBridge({
      siPpcCostTotal: -10,
      spAttributedSpendTotal: 50,
      spAdvertisedAsinSpendTotal: 25,
      spMappedCampaignSpendTotal: 20,
      sbSpendTotalUnattributed: -5,
      sdSpendTotalUnattributed: Number.NaN,
    });

    expect(result.si_ppc_cost_total).toBe(0);
    expect(result.sb_spend_total_unattributed).toBe(0);
    expect(result.sd_spend_total_unattributed).toBe(0);
    expect(result.sp_unattributed_spend_total).toBe(0);
    expect(result.coverage.sp_vs_si_pct).toBeNull();
    expect(result.coverage.sp_advertised_vs_si_pct).toBeNull();
    expect(result.coverage.sp_vs_sp_campaign_pct).toBe(2.5);
  });
});
