import { describe, expect, it } from 'vitest';

import {
  ACCOUNT_BASELINE_DATA_PACK_KIND,
  buildAccountBaselineDataPack,
} from '../apps/web/src/lib/logbook/aiPack/accountBaselinePack';

describe('account baseline data pack shape', () => {
  it('keeps required top-level keys and non-empty arrays when provided', () => {
    const pack = buildAccountBaselineDataPack({
      generated_at: '2026-02-21T00:00:00.000Z',
      account_id: 'US',
      marketplace: 'US',
      windows: {
        last_30d: { start: '2026-01-23', end: '2026-02-21', days: 30 },
        last_90d: { start: '2025-11-24', end: '2026-02-21', days: 90 },
        prev_30d: { start: '2025-12-24', end: '2026-01-22', days: 30 },
      },
      sales_kpis_summary: {
        last_30d: { sales: 1000, orders: 42, units: 50, ppc_cost: 200, tacos: 0.2 },
        last_90d: { sales: 4000, orders: 160, units: 190, ppc_cost: 700, tacos: 0.175 },
      },
      top_products_snapshot: [
        {
          asin: 'B0TEST12345',
          name: 'Test Product',
          revenue_last_30d: 1000,
          revenue_last_90d: 3000,
          orders_last_30d: 42,
          units_last_30d: 50,
          deltas_vs_prev_30d: {
            revenue_abs: 120,
            revenue_pct: 0.136,
            orders_abs: 3,
            orders_pct: 0.076,
            units_abs: 4,
            units_pct: 0.087,
          },
        },
      ],
      ads_summary: {
        last_30d: {
          sp: { spend: 100, sales: 500, acos: 0.2, roas: 5 },
          sb: { spend: 50, sales: 150, acos: 0.333, roas: 3 },
          combined: { spend: 150, sales: 650, acos: 0.231, roas: 4.333 },
        },
        last_90d: {
          sp: { spend: 300, sales: 1400, acos: 0.214, roas: 4.667 },
          sb: { spend: 120, sales: 420, acos: 0.286, roas: 3.5 },
          combined: { spend: 420, sales: 1820, acos: 0.231, roas: 4.333 },
        },
      },
      recent_experiments: [
        {
          experiment_id: '00000000-0000-0000-0000-000000000001',
          name: 'Budget Test',
          status: 'active',
          product_id: 'B0TEST12345',
          created_at: '2026-02-01T00:00:00Z',
          latest_evaluated_at: '2026-02-10T00:00:00Z',
          outcome_score: 78,
        },
      ],
      validation_summary: {
        window_start: '2025-11-24',
        window_end: '2026-02-21',
        total_changes: 10,
        validated: 6,
        mismatch: 1,
        pending: 2,
        not_found: 0,
        none: 1,
      },
      ingestion_heartbeat: [
        {
          source_type: 'si_sales_trend',
          latest_timestamp: '2026-02-21T00:00:00Z',
          coverage_start: '2026-01-01',
          coverage_end: '2026-02-21',
          row_count: 123,
        },
      ],
    });

    expect(pack.kind).toBe(ACCOUNT_BASELINE_DATA_PACK_KIND);
    expect(pack.account_id).toBe('US');
    expect(pack.marketplace).toBe('US');
    expect(pack.windows.last_30d.days).toBe(30);
    expect(pack.sales_kpis_summary.last_30d.sales).toBeGreaterThan(0);
    expect(pack.ads_summary.last_30d.combined.sales).toBeGreaterThan(0);
    expect(pack.top_products_snapshot.length).toBeGreaterThan(0);
    expect(pack.recent_experiments.length).toBeGreaterThan(0);
    expect(pack.ingestion_heartbeat.length).toBeGreaterThan(0);
  });
});
