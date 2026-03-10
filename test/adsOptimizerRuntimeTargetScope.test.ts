import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  advertisedRows: [] as Array<Record<string, unknown>>,
  targetingRows: [] as Array<Record<string, unknown>>,
};

const resetState = () => {
  state.advertisedRows = [];
  state.targetingRows = [];
};

const createQuery = (table: string) => {
  const filters: Array<{ type: 'eq' | 'in'; column: string; value: unknown }> = [];

  const matches = (row: Record<string, unknown>) =>
    filters.every((filter) => {
      if (filter.type === 'eq') {
        return row[filter.column] === filter.value;
      }
      if (!Array.isArray(filter.value)) {
        return false;
      }
      return filter.value.includes(row[filter.column]);
    });

  const readRows = () => {
    const source =
      table === 'sp_advertised_product_daily_fact_latest'
        ? state.advertisedRows
        : table === 'sp_targeting_daily_fact_latest'
          ? state.targetingRows
          : [];
    return source.filter(matches);
  };

  const query: any = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push({ type: 'eq', column, value });
      return query;
    },
    gte: () => query,
    lte: () => query,
    in: (column: string, value: unknown[]) => {
      filters.push({ type: 'in', column, value });
      return query;
    },
    range: async (from: number, to: number) => ({
      data: readRows().slice(from, to + 1),
      error: null,
    }),
  };

  return query;
};

vi.mock('../apps/web/src/lib/env', () => ({
  env: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-role-key',
    accountId: 'acct',
    marketplace: 'US',
  },
}));

vi.mock('../apps/web/src/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: (table: string) => createQuery(table),
  },
}));

vi.mock('../apps/web/src/lib/ads-optimizer/overview', () => ({
  getAdsOptimizerOverviewData: async () => {
    throw new Error('getAdsOptimizerOverviewData should not be called in target scope tests');
  },
}));

vi.mock('../apps/web/src/lib/ads-optimizer/repoRuntime', () => ({
  createAdsOptimizerRun: async () => {
    throw new Error('createAdsOptimizerRun should not be called in target scope tests');
  },
  findOptimizerProductByAsin: async () => {
    throw new Error('findOptimizerProductByAsin should not be called in target scope tests');
  },
  getAdsOptimizerRuntimeContext: async () => {
    throw new Error('getAdsOptimizerRuntimeContext should not be called in target scope tests');
  },
  insertAdsOptimizerProductSnapshots: async () => {
    throw new Error('insertAdsOptimizerProductSnapshots should not be called in target scope tests');
  },
  insertAdsOptimizerRecommendationSnapshots: async () => {
    throw new Error(
      'insertAdsOptimizerRecommendationSnapshots should not be called in target scope tests'
    );
  },
  insertAdsOptimizerTargetSnapshots: async () => {
    throw new Error('insertAdsOptimizerTargetSnapshots should not be called in target scope tests');
  },
  listAdsOptimizerRuns: async () => {
    throw new Error('listAdsOptimizerRuns should not be called in target scope tests');
  },
  updateAdsOptimizerRun: async () => {
    throw new Error('updateAdsOptimizerRun should not be called in target scope tests');
  },
}));

import { loadTargetSnapshotInputs } from '../apps/web/src/lib/ads-optimizer/runtime';

describe('ads optimizer phase 4 target snapshot scope loading', () => {
  beforeEach(() => {
    resetState();
  });

  it('normalizes the selected ASIN and persists qualifying target snapshots from SP facts', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        advertised_asin_raw: 'B001TEST',
        advertised_asin_norm: 'B001TEST',
        impressions: 100,
        clicks: 10,
        spend: 25,
        sales: 120,
        orders: 3,
        units: 3,
      },
    ];
    state.targetingRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_raw: 'exact',
        match_type_norm: 'exact',
        impressions: 80,
        clicks: 8,
        spend: 20,
        sales: 90,
        orders: 2,
        units: 2,
        cpc: 2.5,
        ctr: 0.1,
        acos: 0.22,
        roas: 4.5,
        conversion_rate: 0.25,
        top_of_search_impression_share: 0.34,
        exported_at: '2026-03-10T00:00:00Z',
      },
    ];

    const result = await loadTargetSnapshotInputs({
      asin: 'b001test',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.zeroTargetDiagnostics).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.targetId).toBe('target-1');
    expect(result.rows[0]?.sourceScope).toBe('asin_via_sp_advertised_product_membership');
    expect(result.rows[0]?.snapshotPayload.scope_resolution).toMatchObject({
      advertised_product_rows: 1,
      ad_group_ids: 1,
      campaign_ids: 1,
    });
  });
});
