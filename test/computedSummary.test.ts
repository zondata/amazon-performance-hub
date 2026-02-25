import { describe, expect, it } from 'vitest';

import { computeBaselineSummary } from '../apps/web/src/lib/logbook/computedSummary';

describe('computeBaselineSummary', () => {
  it('computes deterministic counts from baseline sections', () => {
    const summary = computeBaselineSummary({
      metadata: {
        warnings: ['missing ranking depth', 'recent upload lag'],
      },
      kpis: {
        baseline: {
          totals: {
            profits: 145.5,
          },
        },
      },
      ads_baseline: {
        sp: {
          targets: [
            { target_id: 'SP-T1', spend: 60, sales: 0, clicks: 40, orders: 0 },
            { target_id: 'SP-T2', spend: 45, sales: 0, clicks: 30, orders: 0 },
            { target_id: 'SP-T3', spend: 20, sales: 100, clicks: 40, orders: 12 },
          ],
        },
        sb: {
          targets: [{ target_id: 'SB-T1', spend: 18, sales: 55, clicks: 25, orders: 8 }],
        },
        sd: {
          targets: [{ target_key: 'SD-K1', spend: 25, sales: 40, clicks: 60, units: 18 }],
        },
      },
      ranking_baseline: {
        top_keyword_trends: [
          { keyword_norm: 'alpha', observed_date: '2026-02-01', organic_rank_value: 10 },
          { keyword_norm: 'alpha', observed_date: '2026-02-15', organic_rank_value: 12 },
          { keyword_norm: 'beta', observed_date: '2026-02-01', organic_rank_value: 20 },
          { keyword_norm: 'beta', observed_date: '2026-02-15', organic_rank_value: 31 },
        ],
      },
      product: {
        intent: {
          driver_campaigns: ['C1', 'C2'],
          suggestions: ['tighten placement tiers'],
          kiv: ['test broad relaunch', 'new image set'],
        },
      },
    });

    expect(summary.data_quality.warnings_count).toBe(2);
    expect(summary.profitability.state).toBe('profit');
    expect(summary.waste.high_spend_no_sales_count).toBe(2);
    expect(summary.opportunity.high_cvr_count).toBe(3);
    expect(summary.ranking.stable_terms_count).toBe(1);
    expect(summary.ranking.falling_terms_count).toBe(1);
    expect(summary.intent_alignment.driver_campaigns_classified_count).toBe(2);
    expect(summary.intent_alignment.suggestions_count).toBe(1);
    expect(summary.kiv.items_count).toBe(2);
  });

  it('returns unknown profitability when baseline KPI profits are missing', () => {
    const summary = computeBaselineSummary({
      metadata: { warnings: [] },
      ads_baseline: { sp: { targets: [] } },
      ranking_baseline: { top_keyword_trends: [] },
    });

    expect(summary.profitability.state).toBe('unknown');
    expect(summary.profitability.evidence.join(' ')).toContain('unknown due to missing data');
    expect(summary.data_quality.missing_sections).toContain('kpis.baseline.totals.profits');
  });
});
