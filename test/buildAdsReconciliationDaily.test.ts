import { describe, expect, it } from "vitest";

import { buildAdsReconciliationDaily } from "../apps/web/src/lib/ads/buildAdsReconciliationDaily";

describe("buildAdsReconciliationDaily", () => {
  it("fills missing dates with zeros and computes per-day totals/diffs", () => {
    const rows = buildAdsReconciliationDaily({
      siRows: [
        { date: "2026-01-01", ppc_cost: 10 },
        { date: "2026-01-03", ppc_cost: 9.2 },
      ],
      spRows: [
        { date: "2026-01-01", spend: 2.5 },
        { date: "2026-01-03", spend: 1.2 },
      ],
      sbRows: [{ date: "2026-01-02", spend: 1.5 }],
      sdRows: [{ date: "2026-01-03", spend: 0.8 }],
      start: "2026-01-01",
      end: "2026-01-03",
    });

    expect(rows.map((row) => row.date)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(rows[0]).toEqual({
      date: "2026-01-01",
      si_ppc_cost: 10,
      si_ppc_cost_attributed: 10,
      sp_spend_total: 2.5,
      sb_spend_total: 0,
      sd_spend_total: 0,
      ads_spend_total: 2.5,
      advertised_ads_total: 2.5,
      diff: 7.5,
      attribution_delta: 7.5,
    });
    expect(rows[1]).toEqual({
      date: "2026-01-02",
      si_ppc_cost: 0,
      si_ppc_cost_attributed: 0,
      sp_spend_total: 0,
      sb_spend_total: 1.5,
      sd_spend_total: 0,
      ads_spend_total: 1.5,
      advertised_ads_total: 1.5,
      diff: -1.5,
      attribution_delta: -1.5,
    });
    expect(rows[2]).toEqual({
      date: "2026-01-03",
      si_ppc_cost: 9.2,
      si_ppc_cost_attributed: 9.2,
      sp_spend_total: 1.2,
      sb_spend_total: 0,
      sd_spend_total: 0.8,
      ads_spend_total: 2,
      advertised_ads_total: 2,
      diff: 7.2,
      attribution_delta: 7.2,
    });
  });

  it("rounds floating sums to two decimals and returns ascending dates", () => {
    const rows = buildAdsReconciliationDaily({
      siRows: [{ date: "2026-02-02", ppc_cost: 0.3 }],
      spRows: [
        { date: "2026-02-02", spend: 0.1 },
        { date: "2026-02-02", spend: 0.2 },
      ],
      sbRows: [{ date: "2026-02-02", spend: 0.105 }],
      sdRows: [{ date: "2026-02-02", spend: 0.105 }],
      start: "2026-02-01",
      end: "2026-02-02",
    });

    expect(rows.map((row) => row.date)).toEqual(["2026-02-01", "2026-02-02"]);
    expect(rows[1].sp_spend_total).toBe(0.3);
    expect(rows[1].sb_spend_total).toBe(0.1);
    expect(rows[1].sd_spend_total).toBe(0.1);
    expect(rows[1].ads_spend_total).toBe(0.5);
    expect(rows[1].advertised_ads_total).toBe(0.5);
    expect(rows[1].diff).toBe(-0.2);
    expect(rows[1].attribution_delta).toBe(-0.2);
  });

  it("uses SP advertised spend in reconciliation and keeps positive gap on zero-ad days", () => {
    const rows = buildAdsReconciliationDaily({
      siRows: [
        { date: "2026-02-10", ppc_cost: 10 },
        { date: "2026-02-11", ppc_cost: 9 },
      ],
      spRows: [{ date: "2026-02-10", spend: 4 }],
      sbRows: [],
      sdRows: [{ date: "2026-02-10", spend: 1 }],
      start: "2026-02-10",
      end: "2026-02-11",
    });

    expect(rows[0]).toEqual({
      date: "2026-02-10",
      si_ppc_cost: 10,
      si_ppc_cost_attributed: 10,
      sp_spend_total: 4,
      sb_spend_total: 0,
      sd_spend_total: 1,
      ads_spend_total: 5,
      advertised_ads_total: 5,
      diff: 5,
      attribution_delta: 5,
    });
    expect(rows[1]).toEqual({
      date: "2026-02-11",
      si_ppc_cost: 9,
      si_ppc_cost_attributed: 9,
      sp_spend_total: 0,
      sb_spend_total: 0,
      sd_spend_total: 0,
      ads_spend_total: 0,
      advertised_ads_total: 0,
      diff: 9,
      attribution_delta: 9,
    });
  });

  it("exposes alias fields for attributed SI cost and attribution delta", () => {
    const rows = buildAdsReconciliationDaily({
      siRows: [{ date: "2026-02-14", ppc_cost: 12 }],
      spRows: [{ date: "2026-02-14", spend: 4 }],
      sbRows: [],
      sdRows: [{ date: "2026-02-14", spend: 1 }],
      start: "2026-02-14",
      end: "2026-02-14",
    });

    expect(rows[0].si_ppc_cost_attributed).toBe(rows[0].si_ppc_cost);
    expect(rows[0].advertised_ads_total).toBe(rows[0].ads_spend_total);
    expect(rows[0].attribution_delta).toBe(rows[0].diff);
  });
});
