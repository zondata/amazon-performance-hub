import { beforeEach, describe, expect, it, vi } from 'vitest';

const rankingState = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
  error: null as Error | null,
}));

const overviewState = vi.hoisted(() => ({
  data: {
    product: {
      asin: 'B001TEST',
      title: 'Test product',
      shortName: 'Test',
      displayName: 'Test',
    },
    economics: {
      sales: 1800,
      orders: 30,
      units: 32,
      adSpend: 420,
      adSales: 950,
      tacos: 0.23,
      averagePrice: 56.25,
      costCoverage: 0.62,
      breakEvenAcos: 0.34,
      contributionBeforeAdsPerUnit: 18,
      contributionAfterAds: 226,
    },
    visibility: {
      rankingCoverage: {
        status: 'ready',
        trackedKeywords: 5,
        detail: 'ready',
      },
      heroQueryTrend: {
        status: 'ready',
        keyword: 'blue widget',
        searchVolume: 2200,
        latestOrganicRank: 9,
        baselineOrganicRank: 13,
        rankDelta: 4,
        detail: 'ready',
      },
      sqpCoverage: {
        status: 'ready',
        selectedWeekEnd: '2026-03-08',
        trackedQueries: 4,
        totalSearchVolume: 4200,
        topQuery: 'blue widget',
        detail: 'ready',
        alignment: 'exact',
      },
    },
    state: {
      value: 'profitable',
      label: 'Profitable',
      reason: 'ready',
    },
    objective: {
      value: 'Scale Profit',
      reason: 'ready',
    },
    warnings: [],
  } as any,
}));

const state = {
  advertisedRows: [] as Array<Record<string, unknown>>,
  targetingRows: [] as Array<Record<string, unknown>>,
  stisRows: [] as Array<Record<string, unknown>>,
  placementRows: [] as Array<Record<string, unknown>>,
  sqpRows: [] as Array<Record<string, unknown>>,
  sqpRangeCalls: 0,
};

const resetState = () => {
  state.advertisedRows = [];
  state.targetingRows = [];
  state.stisRows = [];
  state.placementRows = [];
  state.sqpRows = [];
  state.sqpRangeCalls = 0;
  rankingState.rows = [];
  rankingState.error = null;
  overviewState.data.visibility = {
    rankingCoverage: {
      status: 'ready',
      trackedKeywords: 5,
      detail: 'ready',
    },
    heroQueryTrend: {
      status: 'ready',
      keyword: 'blue widget',
      searchVolume: 2200,
      latestOrganicRank: 9,
      baselineOrganicRank: 13,
      rankDelta: 4,
      detail: 'ready',
    },
    sqpCoverage: {
      status: 'ready',
      selectedWeekEnd: '2026-03-08',
      trackedQueries: 4,
      totalSearchVolume: 4200,
      topQuery: 'blue widget',
      detail: 'ready',
      alignment: 'exact',
    },
  };
};

const createQuery = (table: string) => {
  const filters: Array<{ type: 'eq' | 'in' | 'is'; column: string; value: unknown }> = [];

  const matches = (row: Record<string, unknown>) =>
    filters.every((filter) => {
      if (filter.type === 'eq') {
        return row[filter.column] === filter.value;
      }
      if (filter.type === 'is') {
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
          : table === 'sp_stis_daily_fact_latest'
            ? state.stisRows
            : table === 'sp_placement_daily_fact_latest'
              ? state.placementRows
              : table === 'sqp_weekly_latest_known_keywords'
                ? state.sqpRows
              : [];
    return source.filter(matches);
  };

  const query: any = {
    select: () => query,
    eq: (column: string, value: unknown) => {
      filters.push({ type: 'eq', column, value });
      return query;
    },
    is: (column: string, value: unknown) => {
      filters.push({ type: 'is', column, value });
      return query;
    },
    gte: () => query,
    lte: () => query,
    in: (column: string, value: unknown[]) => {
      filters.push({ type: 'in', column, value });
      return query;
    },
    range: async (from: number, to: number) => {
      if (table === 'sqp_weekly_latest_known_keywords') {
        state.sqpRangeCalls += 1;
      }
      return {
        data: readRows().slice(from, to + 1),
        error: null,
      };
    },
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

vi.mock('../apps/web/src/lib/bulksheets/fetchCurrent', () => ({
  fetchCurrentSpData: async () => ({
    snapshotDate: '2026-03-10',
    campaignsById: new Map([
      [
        'campaign-1',
        {
          campaign_id: 'campaign-1',
          campaign_name_raw: 'Campaign 1',
          state: 'enabled',
          daily_budget: 50,
          bidding_strategy: 'dynamic down only',
          portfolio_id: null,
        },
      ],
    ]),
    adGroupsById: new Map([
      [
        'ad-group-1',
        {
          ad_group_id: 'ad-group-1',
          campaign_id: 'campaign-1',
          ad_group_name_raw: 'Ad Group 1',
          state: 'enabled',
          default_bid: 1.5,
        },
      ],
    ]),
    targetsById: new Map([
      [
        'target-1',
        {
          target_id: 'target-1',
          ad_group_id: 'ad-group-1',
          campaign_id: 'campaign-1',
          expression_raw: 'blue widget',
          match_type: 'exact',
          is_negative: false,
          state: 'enabled',
          bid: 1.4,
        },
      ],
    ]),
    placementsByKey: new Map([
      [
        'campaign-1::placement_top',
        {
          campaign_id: 'campaign-1',
          placement_raw: 'Top of search',
          placement_code: 'PLACEMENT_TOP',
          percentage: 18,
        },
      ],
    ]),
  }),
}));

vi.mock('../apps/web/src/lib/ads-optimizer/overview', () => ({
  getAdsOptimizerOverviewData: async () => overviewState.data,
}));

vi.mock('../apps/web/src/lib/ranking/getProductRankingDaily', () => ({
  getProductRankingDaily: vi.fn(async () => {
    if (rankingState.error) {
      throw rankingState.error;
    }
    return rankingState.rows;
  }),
}));

import {
  loadAdsOptimizerTargetProfiles,
  mapTargetSnapshotToProfileView,
} from '../apps/web/src/lib/ads-optimizer/targetProfile';

describe('ads optimizer phase 5 target profile engine', () => {
  beforeEach(() => {
    resetState();
  });

  it('builds raw + derived target profile snapshots from existing SP facts', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-2',
        ad_group_id: 'ad-group-2',
        advertised_asin_norm: 'B001TEST',
        impressions: 70,
        clicks: 6,
        spend: 15,
        sales: 80,
        orders: 2,
        units: 2,
      },
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 80,
        clicks: 8,
        spend: 20,
        sales: 90,
        orders: 2,
        units: 2,
        top_of_search_impression_share: 0.34,
      },
    ];
    state.stisRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        target_key: 'target-1',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        customer_search_term_raw: 'blue widget',
        customer_search_term_norm: 'blue widget',
        search_term_impression_share: 0.22,
        search_term_impression_rank: 7,
        impressions: 50,
        clicks: 6,
        spend: 16,
        sales: 70,
        orders: 2,
        units: 2,
      },
    ];
    state.placementRows = [
      {
        account_id: 'acct',
        campaign_id: 'campaign-1',
        placement_code: 'PLACEMENT_TOP',
        placement_raw: 'Top of search',
        placement_raw_norm: 'top of search',
        impressions: 120,
        clicks: 12,
        spend: 32,
        sales: 140,
        orders: 3,
        units: 3,
      },
    ];
    rankingState.rows = [
      {
        observed_date: '2026-03-01',
        keyword_raw: 'blue widget',
        keyword_norm: 'blue widget',
        keyword_id: 'kw-1',
        organic_rank_value: 14,
        organic_rank_kind: 'rank',
        organic_rank_raw: '14',
        sponsored_pos_value: 9,
        sponsored_pos_kind: 'rank',
        sponsored_pos_raw: '9',
        search_volume: 2200,
      },
      {
        observed_date: '2026-03-03',
        keyword_raw: 'blue widget',
        keyword_norm: 'blue widget',
        keyword_id: 'kw-1',
        organic_rank_value: 11,
        organic_rank_kind: 'rank',
        organic_rank_raw: '11',
        sponsored_pos_value: 8,
        sponsored_pos_kind: 'rank',
        sponsored_pos_raw: '8',
        search_volume: 2200,
      },
    ];

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.zeroTargetDiagnostics).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.snapshotPayload.phase).toBe(5);
    expect(result.rows[0]?.snapshotPayload.target_profile_version).toBe('phase5_v2');
    expect(result.rows[0]?.snapshotPayload.ranking_context).toMatchObject({
      contract: 'keyword_query_context',
      status: 'ready',
      resolved_keyword_norm: 'blue widget',
      note: 'Rank is contextual to the selected ASIN and resolved keyword text. It is not a target-owned performance fact.',
    });
    expect(result.rows[0]?.snapshotPayload.ranking_context).toMatchObject({
      organic_observed_ranks: [
        {
          observed_date: '2026-03-01',
          rank: 14,
        },
        {
          observed_date: '2026-03-03',
          rank: 11,
        },
      ],
      sponsored_observed_ranks: [
        {
          observed_date: '2026-03-01',
          rank: 9,
        },
        {
          observed_date: '2026-03-03',
          rank: 8,
        },
      ],
    });
    expect(result.rows[0]?.snapshotPayload.demand_proxies).toMatchObject({
      search_term_count: 1,
      same_text_search_term_count: 1,
      representative_search_term: 'blue widget',
    });
    expect(result.rows[0]?.snapshotPayload.placement_context).toMatchObject({
      impressions: 120,
      clicks: 12,
      spend: 32,
    });
    expect(result.rows[0]?.snapshotPayload.current_campaign_bidding_strategy).toBe(
      'dynamic down only'
    );
    expect(result.rows[0]?.snapshotPayload.placement_breakdown).toMatchObject({
      note: 'Placement metrics remain campaign-level context only. They are shared across targets in the same campaign and must not be treated as target-owned history.',
      rows: [
        {
          placement_code: 'PLACEMENT_TOP',
          placement_label: 'Top of search',
          modifier_pct: 18,
          impressions: 120,
          clicks: 12,
          orders: 3,
          sales: 140,
          spend: 32,
        },
        {
          placement_code: 'PLACEMENT_REST_OF_SEARCH',
          placement_label: 'Rest of search',
          modifier_pct: null,
          impressions: null,
          clicks: null,
          orders: null,
          sales: null,
          spend: null,
        },
        {
          placement_code: 'PLACEMENT_PRODUCT_PAGE',
          placement_label: 'Product pages',
          modifier_pct: null,
          impressions: null,
          clicks: null,
          orders: null,
          sales: null,
          spend: null,
        },
      ],
    });
    expect(result.rows[0]?.snapshotPayload.derived_metrics.contribution_after_ads).toBeCloseTo(10.6);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.break_even_gap).toBeCloseTo(
      0.11777777777777781
    );
    expect(result.rows[0]?.snapshotPayload.derived_metrics.max_cpc_support_gap).toBeCloseTo(1.325);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.click_velocity).toBe(8);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.impression_velocity).toBe(80);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.ad_sales_share).toBeCloseTo(0.45);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.ad_order_share).toBeCloseTo(0.4);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.total_sales_share).toBeCloseTo(0.05);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.loss_to_ad_sales_ratio).toBeNull();
    expect(result.rows[0]?.snapshotPayload.derived_metrics.loss_severity).toBeNull();
    expect(result.rows[0]?.snapshotPayload.derived_metrics.protected_contributor).toBe(true);
    expect(result.rows[0]?.snapshotPayload.asin_scope_membership).toMatchObject({
      scope_level: 'asin',
      asin: 'B001TEST',
      product_ad_spend: 40,
      product_ad_sales: 200,
      product_orders: 5,
      product_units: 5,
    });
    expect(result.rows[0]?.snapshotPayload.non_additive_diagnostics).toMatchObject({
      latest_observed_tos_is: 0.34,
      latest_observed_tos_is_observed_date: '2026-03-03',
      latest_observed_stis: 0.22,
      latest_observed_stis_observed_date: '2026-03-03',
      latest_observed_stir: 7,
      latest_observed_stir_observed_date: '2026-03-03',
      representative_search_term: 'blue widget',
    });
    expect(result.rows[0]?.snapshotPayload.non_additive_diagnostics).not.toHaveProperty(
      'top_of_search_impression_share_latest'
    );
    expect(result.rows[0]?.snapshotPayload.derived_metrics.organic_leverage_proxy).toBeNull();
    expect(result.rows[0]?.snapshotPayload.derived_metrics.organic_context_signal).toBe(
      'same_text_visibility_context'
    );
    expect(result.rows[0]?.snapshotPayload.execution_context.snapshot_date).toBe('2026-03-10');
    expect(result.rows[0]?.snapshotPayload.execution_context.target.current_bid).toBe(1.4);
    expect(result.rows[0]?.snapshotPayload.execution_context.placement.current_percentage).toBe(18);
  });

  it('persists aligned SQP market-impression context from the Overview-selected week using the full aligned-week query set', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 80,
        clicks: 8,
        spend: 20,
        sales: 90,
        orders: 2,
        units: 2,
        top_of_search_impression_share: 0.34,
      },
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-2',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'phrase',
        impressions: 50,
        clicks: 5,
        spend: 12,
        sales: 48,
        orders: 1,
        units: 1,
        top_of_search_impression_share: 0.18,
      },
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-3',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'asin=\"B001UNSUPPORTED\"',
        targeting_norm: 'asin=\"b001unsupported\"',
        match_type_norm: 'TARGETING_EXPRESSION',
        impressions: 20,
        clicks: 2,
        spend: 4,
        sales: 0,
        orders: 0,
        units: 0,
        top_of_search_impression_share: null,
      },
    ];
    rankingState.rows = [
      {
        observed_date: '2026-03-03',
        keyword_raw: 'blue widget',
        keyword_norm: 'blue widget',
        keyword_id: 'kw-1',
        organic_rank_value: 11,
        organic_rank_kind: 'rank',
        organic_rank_raw: '11',
        sponsored_pos_value: 8,
        sponsored_pos_kind: 'rank',
        sponsored_pos_raw: '8',
        search_volume: 2200,
      },
    ];
    state.sqpRows = [
      {
        account_id: 'acct',
        marketplace: 'US',
        scope_type: 'asin',
        scope_value: 'B001TEST',
        week_end: '2026-03-08',
        search_query_norm: 'alpha query',
        search_query_raw: 'alpha query',
        impressions_total: 1200,
      },
      {
        account_id: 'acct',
        marketplace: 'US',
        scope_type: 'asin',
        scope_value: 'B001TEST',
        week_end: '2026-03-08',
        search_query_norm: null,
        search_query_raw: 'Blue Widget',
        impressions_total: 1000,
      },
      ...Array.from({ length: 1000 }, (_, index) => ({
        account_id: 'acct',
        marketplace: 'US',
        scope_type: 'asin',
        scope_value: 'B001TEST',
        week_end: '2026-03-08',
        search_query_norm: `query ${index + 1}`,
        search_query_raw: `Query ${index + 1}`,
        impressions_total: index + 1,
      })),
    ];

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.zeroTargetDiagnostics).toBeNull();
    expect(result.rows).toHaveLength(3);

    const rowsByTargetId = new Map(result.rows.map((row) => [row.targetId, row]));
    const expectedTotalMarketImpressions = 1200 + 1000 + (1000 * 1001) / 2;

    expect(rowsByTargetId.get('target-1')?.snapshotPayload.sqp_context).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_norm: 'blue widget',
      tracked_query_count: 1002,
      market_impressions_total: 1000,
      total_market_impressions: expectedTotalMarketImpressions,
      market_impression_rank: 2,
      note: null,
    });
    expect(
      (rowsByTargetId.get('target-1')?.snapshotPayload.sqp_context as Record<string, unknown>)
        .market_impression_share
    ).toBeCloseTo(1000 / expectedTotalMarketImpressions);
    expect(rowsByTargetId.get('target-1')?.snapshotPayload.sqp_detail).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_raw: 'Blue Widget',
      matched_query_norm: 'blue widget',
      impressions_total: 1000,
      impressions_self: null,
      clicks_total: null,
      purchases_total: null,
      market_ctr: null,
      self_ctr: null,
      note: null,
    });
    expect(rowsByTargetId.get('target-2')?.snapshotPayload.sqp_context).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_norm: 'blue widget',
      tracked_query_count: 1002,
      market_impressions_total: 1000,
      total_market_impressions: expectedTotalMarketImpressions,
      market_impression_rank: 2,
      note: null,
    });
    expect(rowsByTargetId.get('target-2')?.snapshotPayload.sqp_detail).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_raw: 'Blue Widget',
      matched_query_norm: 'blue widget',
      impressions_total: 1000,
      note: null,
    });
    expect(rowsByTargetId.get('target-3')?.snapshotPayload.sqp_context).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_norm: null,
      tracked_query_count: 1002,
      market_impressions_total: null,
      total_market_impressions: expectedTotalMarketImpressions,
      market_impression_share: null,
      market_impression_rank: null,
      note:
        'SQP market-impression context is unavailable because no deterministic keyword mapping was resolved for this target.',
    });
    expect(rowsByTargetId.get('target-3')?.snapshotPayload.sqp_detail).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_raw: null,
      matched_query_norm: null,
      impressions_total: null,
      market_ctr: null,
      note:
        'SQP market-impression context is unavailable because no deterministic keyword mapping was resolved for this target.',
    });
    expect(state.sqpRangeCalls).toBe(2);
  });

  it('matches the Overview SQP week-selection semantics and persists the Overview-selected week into sqp_context', async () => {
    const { selectSqpWeekForWindow } =
      await vi.importActual<typeof import('../apps/web/src/lib/ads-optimizer/overview')>(
        '../apps/web/src/lib/ads-optimizer/overview'
      );
    const exact = selectSqpWeekForWindow({
      availableWeeks: [
        { week_start: '2026-03-02', week_end: '2026-03-08' },
        { week_start: '2026-02-23', week_end: '2026-03-01' },
      ],
      targetEnd: '2026-03-08',
    });
    const nearestPrior = selectSqpWeekForWindow({
      availableWeeks: [
        { week_start: '2026-03-02', week_end: '2026-03-08' },
        { week_start: '2026-02-23', week_end: '2026-03-01' },
      ],
      targetEnd: '2026-03-05',
    });
    const fallbackLatest = selectSqpWeekForWindow({
      availableWeeks: [
        { week_start: '2026-03-09', week_end: '2026-03-15' },
        { week_start: '2026-03-02', week_end: '2026-03-08' },
      ],
      targetEnd: '2026-03-01',
    });

    expect(exact).toMatchObject({ weekEnd: '2026-03-08', alignment: 'exact' });
    expect(nearestPrior).toMatchObject({ weekEnd: '2026-03-01', alignment: 'nearest_prior' });
    expect(fallbackLatest).toMatchObject({
      weekEnd: '2026-03-15',
      alignment: 'fallback_latest',
    });

    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 80,
        clicks: 8,
        spend: 20,
        sales: 90,
        orders: 2,
        units: 2,
        top_of_search_impression_share: 0.34,
      },
    ];
    state.sqpRows = [
      {
        account_id: 'acct',
        marketplace: 'US',
        scope_type: 'asin',
        scope_value: 'B001TEST',
        week_end: '2026-03-01',
        search_query_norm: 'blue widget',
        search_query_raw: 'blue widget',
        impressions_total: 100,
      },
    ];

    for (const scenario of [
      { selectedWeekEnd: exact.weekEnd, label: 'exact' },
      { selectedWeekEnd: nearestPrior.weekEnd, label: 'nearest_prior' },
      { selectedWeekEnd: fallbackLatest.weekEnd, label: 'fallback_latest' },
    ]) {
      overviewState.data.visibility = {
        ...overviewState.data.visibility,
        sqpCoverage: {
          status: 'ready',
          selectedWeekEnd: scenario.selectedWeekEnd,
          trackedQueries: 1,
          totalSearchVolume: 100,
          topQuery: 'blue widget',
          detail: scenario.label,
          alignment: scenario.label,
        },
      };
      state.sqpRows = [
        {
          account_id: 'acct',
          marketplace: 'US',
          scope_type: 'asin',
          scope_value: 'B001TEST',
          week_end: scenario.selectedWeekEnd,
          search_query_norm: 'blue widget',
          search_query_raw: 'blue widget',
          impressions_total: 100,
        },
      ];

      const result = await loadAdsOptimizerTargetProfiles({
        asin: 'B001TEST',
        start: '2026-03-01',
        end: '2026-03-10',
      });

      expect(result.rows[0]?.snapshotPayload.sqp_context).toMatchObject({
        selected_week_end: scenario.selectedWeekEnd,
      });
    }
  });

  it('persists matched-query sqp_detail metrics from the aligned SQP week and derives funnel rates from the matched row only', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 80,
        clicks: 8,
        spend: 20,
        sales: 90,
        orders: 2,
        units: 2,
        top_of_search_impression_share: 0.34,
      },
    ];
    rankingState.rows = [
      {
        observed_date: '2026-03-03',
        keyword_raw: 'blue widget',
        keyword_norm: 'blue widget',
        keyword_id: 'kw-1',
        organic_rank_value: 11,
        organic_rank_kind: 'rank',
        organic_rank_raw: '11',
        sponsored_pos_value: 8,
        sponsored_pos_kind: 'rank',
        sponsored_pos_raw: '8',
        search_volume: 2200,
      },
    ];
    state.sqpRows = [
      {
        account_id: 'acct',
        marketplace: 'US',
        scope_type: 'asin',
        scope_value: 'B001TEST',
        week_end: '2026-03-08',
        search_query_norm: 'blue widget',
        search_query_raw: 'Blue Widget',
        search_query_score: 95,
        search_query_volume: 18000,
        impressions_total: 1000,
        impressions_self: 180,
        impressions_self_share: 0.18,
        clicks_total: 80,
        clicks_self: 24,
        clicks_self_share: 0.3,
        clicks_rate_per_query: 80 / 18000,
        cart_adds_total: 16,
        cart_adds_self: 6,
        cart_adds_self_share: 0.375,
        cart_add_rate_per_query: 16 / 18000,
        purchases_total: 8,
        purchases_self: 3,
        purchases_self_share: 0.375,
        purchases_rate_per_query: 8 / 18000,
      },
      {
        account_id: 'acct',
        marketplace: 'US',
        scope_type: 'asin',
        scope_value: 'B001TEST',
        week_end: '2026-03-08',
        search_query_norm: 'alpha query',
        search_query_raw: 'alpha query',
        impressions_total: 1200,
      },
    ];

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.rows[0]?.snapshotPayload.sqp_detail).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_raw: 'Blue Widget',
      matched_query_norm: 'blue widget',
      search_query_volume: 18000,
      search_query_score: 95,
      impressions_total: 1000,
      impressions_self: 180,
      impressions_self_share: 0.18,
      clicks_total: 80,
      clicks_self: 24,
      clicks_self_share: 0.3,
      cart_adds_total: 16,
      cart_adds_self: 6,
      cart_adds_self_share: 0.375,
      purchases_total: 8,
      purchases_self: 3,
      purchases_self_share: 0.375,
      clicks_rate_per_query: 80 / 18000,
      cart_add_rate_per_query: 16 / 18000,
      purchases_rate_per_query: 8 / 18000,
      market_ctr: 0.08,
      self_ctr: 24 / 180,
      market_cvr: 8 / 80,
      self_cvr: 3 / 24,
      self_ctr_index: (24 / 180) / 0.08,
      self_cvr_index: (3 / 24) / (8 / 80),
      cart_add_rate_from_clicks_market: 16 / 80,
      cart_add_rate_from_clicks_self: 6 / 24,
      note: null,
    });
    expect(result.rows[0]?.snapshotPayload.sqp_context).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_norm: 'blue widget',
      market_impressions_total: 1000,
      market_impression_share: 1000 / 2200,
      market_impression_rank: 2,
    });
    expect(state.sqpRangeCalls).toBe(1);
  });

  it('persists null-safe sqp_detail values with an honest note when no aligned SQP query matches the resolved keyword', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 80,
        clicks: 8,
        spend: 20,
        sales: 90,
        orders: 2,
        units: 2,
        top_of_search_impression_share: 0.34,
      },
    ];
    rankingState.rows = [
      {
        observed_date: '2026-03-03',
        keyword_raw: 'blue widget',
        keyword_norm: 'blue widget',
        keyword_id: 'kw-1',
        organic_rank_value: 11,
        organic_rank_kind: 'rank',
        organic_rank_raw: '11',
        sponsored_pos_value: 8,
        sponsored_pos_kind: 'rank',
        sponsored_pos_raw: '8',
        search_volume: 2200,
      },
    ];
    state.sqpRows = [
      {
        account_id: 'acct',
        marketplace: 'US',
        scope_type: 'asin',
        scope_value: 'B001TEST',
        week_end: '2026-03-08',
        search_query_norm: 'alpha query',
        search_query_raw: 'alpha query',
        impressions_total: 1200,
      },
    ];

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.rows[0]?.snapshotPayload.sqp_detail).toMatchObject({
      selected_week_end: '2026-03-08',
      matched_query_raw: null,
      matched_query_norm: null,
      impressions_total: null,
      purchases_total: null,
      market_ctr: null,
      self_ctr: null,
      note: 'No aligned SQP query matched resolved keyword "blue widget" for 2026-03-08.',
    });
  });

  it('continues building target profiles when keyword-query ranking is unavailable', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 80,
        clicks: 8,
        spend: 20,
        sales: 90,
        orders: 2,
        units: 2,
        top_of_search_impression_share: 0.34,
      },
    ];
    rankingState.error = new Error('tracker timeout');

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.zeroTargetDiagnostics).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.snapshotPayload.ranking_context).toMatchObject({
      contract: 'keyword_query_context',
      status: 'unavailable',
      resolved_keyword_norm: 'blue widget',
    });
    expect((result.rows[0]?.snapshotPayload.ranking_context as Record<string, unknown>).note).toBe(
      'Keyword-query ranking is unavailable for this ASIN window: tracker timeout'
    );
  });

  it('marks zero-click search-term diagnostics as expected-unavailable instead of true missing', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        advertised_asin_norm: 'B001TEST',
        impressions: 40,
        clicks: 0,
        spend: 0,
        sales: 0,
        orders: 0,
        units: 0,
      },
    ];
    state.targetingRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 40,
        clicks: 0,
        spend: 0,
        sales: 0,
        orders: 0,
        units: 0,
        top_of_search_impression_share: null,
      },
    ];
    state.stisRows = [];
    state.placementRows = [];

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.rows).toHaveLength(1);
    const payload = result.rows[0]?.snapshotPayload;
    expect(payload?.coverage.statuses.search_terms).toBe('expected_unavailable');
    expect(payload?.coverage.statuses.stis).toBe('expected_unavailable');
    expect(payload?.coverage.statuses.stir).toBe('expected_unavailable');
    expect(payload?.coverage.notes).toContain(
      'Zero-click target: missing search-term diagnostics are expected availability behavior for this window.'
    );
    expect(payload?.coverage.critical_warnings).not.toContain(
      'No search-term diagnostics were found for this target in the selected window.'
    );
  });

  it('selects latest observed non-additive diagnostics by date and exported_at without averaging the window', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        date: '2026-03-02',
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 20,
        clicks: 2,
        spend: 4,
        sales: 12,
        orders: 0,
        units: 0,
        top_of_search_impression_share: 0.18,
      },
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-09T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 30,
        clicks: 3,
        spend: 6,
        sales: 18,
        orders: 1,
        units: 1,
        top_of_search_impression_share: 0.24,
      },
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-10T12:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        impressions: 30,
        clicks: 3,
        spend: 6,
        sales: 18,
        orders: 1,
        units: 1,
        top_of_search_impression_share: 0.27,
      },
    ];
    state.stisRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-09T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        target_key: 'target-1',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        customer_search_term_raw: 'blue widget',
        customer_search_term_norm: 'blue widget',
        search_term_impression_share: 0.19,
        search_term_impression_rank: 8,
        impressions: 12,
        clicks: 2,
        spend: 4,
        sales: 10,
        orders: 0,
        units: 0,
      },
      {
        account_id: 'acct',
        date: '2026-03-03',
        exported_at: '2026-03-10T12:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        target_key: 'target-1',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: 'Ad Group 1',
        targeting_raw: 'blue widget',
        targeting_norm: 'blue widget',
        match_type_norm: 'exact',
        customer_search_term_raw: 'blue widget',
        customer_search_term_norm: 'blue widget',
        search_term_impression_share: 0.23,
        search_term_impression_rank: 6,
        impressions: 20,
        clicks: 3,
        spend: 6,
        sales: 12,
        orders: 1,
        units: 1,
      },
    ];
    state.placementRows = [];

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    const diagnostics = result.rows[0]?.snapshotPayload.non_additive_diagnostics as Record<
      string,
      unknown
    >;
    expect(diagnostics.latest_observed_tos_is).toBe(0.27);
    expect(diagnostics.latest_observed_tos_is_observed_date).toBe('2026-03-03');
    expect((diagnostics.tos_is_trend as Record<string, unknown>).previous_value).toBe(0.24);
    expect(diagnostics.latest_observed_stis).toBe(0.23);
    expect(diagnostics.latest_observed_stir).toBe(6);
    expect((diagnostics.stis_trend as Record<string, unknown>).delta).toBeCloseTo(0.04);
    expect((diagnostics.stir_trend as Record<string, unknown>).direction).toBe('down');
    expect(diagnostics.latest_observed_stis).not.toBeCloseTo((0.19 + 0.23) / 2);
  });

  it('maps persisted phase 5 target snapshots into review rows', () => {
    const row = mapTargetSnapshotToProfileView({
      target_snapshot_id: 'snapshot-1',
      run_id: 'run-1',
      created_at: '2026-03-10T00:00:00Z',
      asin: 'B001TEST',
      campaign_id: 'campaign-1',
      ad_group_id: 'ad-group-1',
      target_id: 'target-1',
      coverage_note: null,
      snapshot_payload_json: {
        phase: 5,
        identity: {
          campaign_name: 'Campaign 1',
          ad_group_name: 'Ad Group 1',
          target_text: 'blue widget',
          match_type: 'exact',
          type_label: 'Keyword',
        },
        totals: {
          impressions: 80,
          clicks: 8,
          spend: 20,
          orders: 2,
          sales: 90,
          cpc: 2.5,
          ctr: 0.1,
          cvr: 0.25,
          acos: 0.22,
          roas: 4.5,
        },
        non_additive_diagnostics: {
          latest_observed_tos_is: 0.34,
          latest_observed_tos_is_observed_date: '2026-03-03',
          tos_is_trend: {
            previous_value: 0.3,
            delta: 0.04,
            direction: 'up',
            observed_days: 2,
            latest_observed_date: '2026-03-03',
          },
          latest_observed_stis: 0.22,
          latest_observed_stis_observed_date: '2026-03-03',
          stis_trend: {
            previous_value: 0.18,
            delta: 0.04,
            direction: 'up',
            observed_days: 2,
            latest_observed_date: '2026-03-03',
          },
          latest_observed_stir: 7,
          latest_observed_stir_observed_date: '2026-03-03',
          stir_trend: {
            previous_value: 9,
            delta: -2,
            direction: 'down',
            observed_days: 2,
            latest_observed_date: '2026-03-03',
          },
          representative_search_term: 'blue widget',
        },
        ranking_context: {
          contract: 'keyword_query_context',
          status: 'ready',
          resolved_keyword_norm: 'blue widget',
          note: 'Rank is contextual to the selected ASIN and resolved keyword text. It is not a target-owned performance fact.',
          organic_observed_ranks: [
            {
              observed_date: '2026-03-01',
              rank: 14,
            },
            {
              observed_date: '2026-03-03',
              rank: 11,
            },
          ],
          sponsored_observed_ranks: [
            {
              observed_date: '2026-03-01',
              rank: 9,
            },
            {
              observed_date: '2026-03-03',
              rank: 8,
            },
          ],
        },
        sqp_context: {
          selected_week_end: '2026-03-08',
          matched_query_norm: 'blue widget',
          tracked_query_count: 1002,
          market_impressions_total: 1000,
          total_market_impressions: 502700,
          market_impression_share: 1000 / 502700,
          market_impression_rank: 2,
          note: null,
        },
        sqp_detail: {
          selected_week_end: '2026-03-08',
          matched_query_raw: 'Blue Widget',
          matched_query_norm: 'blue widget',
          search_query_volume: 18000,
          search_query_score: 95,
          impressions_total: 1000,
          impressions_self: 180,
          impressions_self_share: 0.18,
          clicks_total: 80,
          clicks_self: 24,
          clicks_self_share: 0.3,
          cart_adds_total: 16,
          cart_adds_self: 6,
          cart_adds_self_share: 0.375,
          purchases_total: 8,
          purchases_self: 3,
          purchases_self_share: 0.375,
          clicks_rate_per_query: 80 / 18000,
          cart_add_rate_per_query: 16 / 18000,
          purchases_rate_per_query: 8 / 18000,
          market_ctr: 0.08,
          self_ctr: 24 / 180,
          market_cvr: 8 / 80,
          self_cvr: 3 / 24,
          self_ctr_index: (24 / 180) / 0.08,
          self_cvr_index: (3 / 24) / (8 / 80),
          cart_add_rate_from_clicks_market: 16 / 80,
          cart_add_rate_from_clicks_self: 6 / 24,
          note: null,
        },
        demand_proxies: {
          search_term_count: 1,
          same_text_search_term_count: 1,
          total_search_term_impressions: 50,
          total_search_term_clicks: 6,
          representative_search_term: 'blue widget',
          representative_click_share: 0.75,
        },
        placement_context: {
          top_of_search_modifier_pct: null,
          impressions: 120,
          clicks: 12,
          orders: 3,
          units: 3,
          sales: 140,
          spend: 32,
          note: 'placement note',
        },
        current_campaign_bidding_strategy: 'dynamic down only',
        placement_breakdown: {
          note: 'Placement metrics remain campaign-level context only. They are shared across targets in the same campaign and must not be treated as target-owned history.',
          rows: [
            {
              placement_code: 'PLACEMENT_TOP',
              placement_label: 'Top of search',
              modifier_pct: 18,
              impressions: 120,
              clicks: 12,
              orders: 3,
              sales: 140,
              spend: 32,
            },
            {
              placement_code: 'PLACEMENT_REST_OF_SEARCH',
              placement_label: 'Rest of search',
              modifier_pct: 4,
              impressions: 80,
              clicks: 7,
              orders: 1,
              sales: 40,
              spend: 12,
            },
            {
              placement_code: 'PLACEMENT_PRODUCT_PAGE',
              placement_label: 'Product pages',
              modifier_pct: null,
              impressions: null,
              clicks: null,
              orders: null,
              sales: null,
              spend: null,
            },
          ],
        },
        search_term_diagnostics: {
          representative_search_term: 'blue widget',
          representative_same_text: true,
          note: 'diagnostic note',
          top_terms: [
            {
              search_term: 'blue widget',
              same_text: true,
              impressions: 50,
              clicks: 6,
              orders: 2,
              spend: 16,
              sales: 70,
              stis: 0.22,
              stir: 7,
            },
          ],
        },
        derived_metrics: {
          contribution_after_ads: 10.6,
          break_even_gap: 0.12,
          max_cpc_support_gap: 1.82,
          loss_dollars: null,
          profit_dollars: 10.6,
          click_velocity: 8,
          impression_velocity: 80,
          organic_leverage_proxy: null,
          organic_context_signal: 'same_text_visibility_context',
        },
        coverage: {
          observed_start: '2026-03-03',
          observed_end: '2026-03-03',
          days_observed: 1,
          statuses: {
            tos_is: 'ready',
            stis: 'ready',
            stir: 'ready',
            placement_context: 'ready',
            search_terms: 'ready',
            break_even_inputs: 'ready',
          },
          notes: ['Coverage explicit'],
          critical_warnings: [],
        },
        state_engine: {
          engine_version: 'phase6_v1',
          coverage_status: 'ready',
          efficiency: {
            value: 'profitable',
            label: 'Profitable',
            detail: 'Positive contribution after ads.',
            coverage_status: 'ready',
            reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
          },
          confidence: {
            value: 'confirmed',
            label: 'Confirmed',
            detail: 'Orders and days met the threshold.',
            coverage_status: 'ready',
            reason_codes: ['CONFIDENCE_ORDER_THRESHOLD_MET'],
          },
          importance: {
            value: 'tier_1_dominant',
            label: 'Tier 1 dominant',
            detail: 'High spend share.',
            coverage_status: 'ready',
            reason_codes: ['IMPORTANCE_DOMINANT_SPEND_SHARE'],
          },
          scores: {
            opportunity: 82,
            risk: 18,
            opportunity_reason_codes: ['OPPORTUNITY_PROFITABLE_BASELINE'],
            risk_reason_codes: ['RISK_PARTIAL_COVERAGE'],
          },
          reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS', 'IMPORTANCE_DOMINANT_SPEND_SHARE'],
        },
        role_engine: {
          engine_version: 'phase7_v1',
          coverage_status: 'ready',
          previous_role: 'Harvest',
          desired_role: {
            value: 'Scale',
            label: 'Scale',
            detail: 'Scale role',
            coverage_status: 'ready',
            reason_codes: ['ROLE_DESIRED_PROFIT_SCALE'],
          },
          current_role: {
            value: 'Scale',
            label: 'Scale',
            detail: 'Scale now',
            coverage_status: 'ready',
            reason_codes: ['CURRENT_ROLE_TRANSITION_APPLIED'],
          },
          transition: {
            rule: 'apply_desired_transition',
            reason_codes: ['CURRENT_ROLE_TRANSITION_APPLIED'],
          },
          guardrails: {
            coverage_status: 'ready',
            categories: {
              no_sale_spend_cap: 20,
              no_sale_click_cap: 12,
              max_loss_per_cycle: 25,
              max_bid_increase_per_cycle_pct: 9,
              max_bid_decrease_per_cycle_pct: 18,
              max_placement_bias_increase_per_cycle_pct: 8,
              rank_push_time_limit_days: 14,
              manual_approval_threshold: 'medium',
              auto_pause_threshold: 40,
              min_bid_floor: 0.2,
              max_bid_ceiling: 3,
            },
            flags: {
              requires_manual_approval: true,
              auto_pause_eligible: false,
              bid_changes_allowed: true,
              placement_changes_allowed: true,
              transition_locked: false,
            },
            reason_codes: ['GUARDRAIL_ROLE_SCALE'],
            notes: ['Coverage explicit'],
          },
          reason_codes: ['ROLE_DESIRED_PROFIT_SCALE', 'CURRENT_ROLE_TRANSITION_APPLIED'],
        },
      },
    });

    expect(row.targetText).toBe('blue widget');
    expect(row.raw.stis).toBe(0.22);
    expect(row.derived.profitDollars).toBe(10.6);
    expect(row.rankingContext).toMatchObject({
      contract: 'keyword_query_context',
      status: 'ready',
      resolvedKeywordNorm: 'blue widget',
      note: 'Rank is contextual to the selected ASIN and resolved keyword text. It is not a target-owned performance fact.',
      organicObservedRanks: [
        {
          observedDate: '2026-03-01',
          rank: 14,
        },
        {
          observedDate: '2026-03-03',
          rank: 11,
        },
      ],
      sponsoredObservedRanks: [
        {
          observedDate: '2026-03-01',
          rank: 9,
        },
        {
          observedDate: '2026-03-03',
          rank: 8,
        },
      ],
    });
    expect(row.sqpContext).toMatchObject({
      selectedWeekEnd: '2026-03-08',
      matchedQueryNorm: 'blue widget',
      trackedQueryCount: 1002,
      marketImpressionsTotal: 1000,
      totalMarketImpressions: 502700,
      marketImpressionShare: 1000 / 502700,
      marketImpressionRank: 2,
      note: null,
    });
    expect(row.sqpDetail).toMatchObject({
      selectedWeekEnd: '2026-03-08',
      matchedQueryRaw: 'Blue Widget',
      matchedQueryNorm: 'blue widget',
      searchQueryVolume: 18000,
      searchQueryScore: 95,
      impressionsTotal: 1000,
      impressionsSelf: 180,
      impressionsSelfShare: 0.18,
      clicksTotal: 80,
      clicksSelf: 24,
      clicksSelfShare: 0.3,
      cartAddsTotal: 16,
      cartAddsSelf: 6,
      cartAddsSelfShare: 0.375,
      purchasesTotal: 8,
      purchasesSelf: 3,
      purchasesSelfShare: 0.375,
      clicksRatePerQuery: 80 / 18000,
      cartAddRatePerQuery: 16 / 18000,
      purchasesRatePerQuery: 8 / 18000,
      marketCtr: 0.08,
      selfCtr: 24 / 180,
      marketCvr: 8 / 80,
      selfCvr: 3 / 24,
      selfCtrIndex: (24 / 180) / 0.08,
      selfCvrIndex: (3 / 24) / (8 / 80),
      cartAddRateFromClicksMarket: 16 / 80,
      cartAddRateFromClicksSelf: 6 / 24,
      note: null,
    });
    expect(row.nonAdditiveDiagnostics.tosIs.latestObservedDate).toBe('2026-03-03');
    expect(row.nonAdditiveDiagnostics.stis.previousValue).toBe(0.18);
    expect(row.nonAdditiveDiagnostics.stir.direction).toBe('down');
    expect(row.coverage.statuses.breakEvenInputs).toBe('ready');
    expect(row.derived.organicContextSignal).toBe('same_text_visibility_context');
    expect(row.searchTermDiagnostics.topTerms).toHaveLength(1);
    expect(row.state.efficiency.value).toBe('profitable');
    expect(row.state.confidence.value).toBe('confirmed');
    expect(row.state.importance.value).toBe('tier_1_dominant');
    expect(row.state.opportunityScore).toBe(82);
    expect(row.role.previousRole).toBe('Harvest');
    expect(row.role.currentRole.value).toBe('Scale');
    expect(row.role.guardrails.categories.maxBidIncreasePerCyclePct).toBe(9);
    expect(row.currentCampaignBiddingStrategy).toBe('dynamic down only');
    expect(row.placementBreakdown.note).toBe(
      'Placement metrics remain campaign-level context only. They are shared across targets in the same campaign and must not be treated as target-owned history.'
    );
    expect(row.placementBreakdown.rows.map((entry) => entry.placementCode)).toEqual([
      'PLACEMENT_TOP',
      'PLACEMENT_REST_OF_SEARCH',
      'PLACEMENT_PRODUCT_PAGE',
    ]);
    expect(row.placementBreakdown.rows[0]).toMatchObject({
      placementCode: 'PLACEMENT_TOP',
      placementLabel: 'Top of search',
      modifierPct: 18,
      impressions: 120,
      clicks: 12,
      orders: 3,
      sales: 140,
      spend: 32,
    });
    expect(row.placementBreakdown.rows[1]).toMatchObject({
      placementCode: 'PLACEMENT_REST_OF_SEARCH',
      placementLabel: 'Rest of search',
      modifierPct: 4,
      impressions: 80,
      clicks: 7,
      orders: 1,
      sales: 40,
      spend: 12,
    });
    expect(row.placementBreakdown.rows[2]).toMatchObject({
      placementCode: 'PLACEMENT_PRODUCT_PAGE',
      placementLabel: 'Product pages',
      modifierPct: null,
      impressions: null,
      clicks: null,
      orders: null,
      sales: null,
      spend: null,
    });
  });

  it('does not coerce legacy snapshots without ranking_context into unavailable ranking state', () => {
    const row = mapTargetSnapshotToProfileView({
      target_snapshot_id: 'snapshot-legacy',
      run_id: 'run-legacy',
      created_at: '2026-03-10T00:00:00Z',
      asin: 'B001TEST',
      campaign_id: 'campaign-1',
      ad_group_id: 'ad-group-1',
      target_id: 'target-1',
      coverage_note: null,
      snapshot_payload_json: {
        phase: 5,
        identity: {
          campaign_name: 'Campaign 1',
          ad_group_name: 'Ad Group 1',
          target_text: 'blue widget',
          match_type: 'exact',
          type_label: 'Keyword',
        },
        totals: {
          impressions: 80,
          clicks: 8,
          spend: 20,
          orders: 2,
          sales: 90,
          cpc: 2.5,
          ctr: 0.1,
          cvr: 0.25,
          acos: 0.22,
          roas: 4.5,
        },
        coverage: {
          observed_start: '2026-03-03',
          observed_end: '2026-03-03',
          days_observed: 1,
          statuses: {},
          notes: [],
          critical_warnings: [],
        },
      },
    });

    expect(row.rankingContext).toBeUndefined();
    expect(row.sqpContext).toBeUndefined();
    expect(row.sqpDetail).toBeUndefined();
  });

  it('falls back from legacy placement_context into a three-row placement breakdown', () => {
    const row = mapTargetSnapshotToProfileView({
      target_snapshot_id: 'snapshot-legacy-placement',
      run_id: 'run-legacy-placement',
      created_at: '2026-03-10T00:00:00Z',
      asin: 'B001TEST',
      campaign_id: 'campaign-1',
      ad_group_id: 'ad-group-1',
      target_id: 'target-1',
      coverage_note: null,
      snapshot_payload_json: {
        phase: 5,
        identity: {
          campaign_name: 'Campaign 1',
          ad_group_name: 'Ad Group 1',
          target_text: 'blue widget',
          match_type: 'exact',
          type_label: 'Keyword',
        },
        execution_context: {
          campaign: {
            current_bidding_strategy: 'legacy up and down',
          },
        },
        placement_context: {
          top_of_search_modifier_pct: 12,
          impressions: 90,
          clicks: 8,
          orders: 1,
          units: 1,
          sales: 35,
          spend: 11,
          note: 'legacy placement note',
        },
        coverage: {
          observed_start: '2026-03-03',
          observed_end: '2026-03-03',
          days_observed: 1,
          statuses: {},
          notes: [],
          critical_warnings: [],
        },
      },
    });

    expect(row.currentCampaignBiddingStrategy).toBe('legacy up and down');
    expect(row.placementBreakdown.note).toBe(
      'Placement metrics remain campaign-level context only. They are shared across targets in the same campaign and must not be treated as target-owned history.'
    );
    expect(row.placementBreakdown.rows).toEqual([
      {
        placementCode: 'PLACEMENT_TOP',
        placementLabel: 'Top of search',
        modifierPct: 12,
        impressions: 90,
        clicks: 8,
        orders: 1,
        sales: 35,
        spend: 11,
      },
      {
        placementCode: 'PLACEMENT_REST_OF_SEARCH',
        placementLabel: 'Rest of search',
        modifierPct: null,
        impressions: null,
        clicks: null,
        orders: null,
        sales: null,
        spend: null,
      },
      {
        placementCode: 'PLACEMENT_PRODUCT_PAGE',
        placementLabel: 'Product pages',
        modifierPct: null,
        impressions: null,
        clicks: null,
        orders: null,
        sales: null,
        spend: null,
      },
    ]);
  });

  it('preserves observed ranks when persisted ranking_context is missing status', () => {
    const row = mapTargetSnapshotToProfileView({
      target_snapshot_id: 'snapshot-partial-ranking',
      run_id: 'run-partial-ranking',
      created_at: '2026-03-10T00:00:00Z',
      asin: 'B001TEST',
      campaign_id: 'campaign-1',
      ad_group_id: 'ad-group-1',
      target_id: 'target-1',
      coverage_note: null,
      snapshot_payload_json: {
        phase: 5,
        identity: {
          campaign_name: 'Campaign 1',
          ad_group_name: 'Ad Group 1',
          target_text: 'blue widget',
          match_type: 'exact',
          type_label: 'Keyword',
        },
        totals: {
          impressions: 80,
          clicks: 8,
          spend: 20,
          orders: 2,
          sales: 90,
          cpc: 2.5,
          ctr: 0.1,
          cvr: 0.25,
          acos: 0.22,
          roas: 4.5,
        },
        ranking_context: {
          contract: 'keyword_query_context',
          resolved_keyword_norm: 'blue widget',
          organic_observed_ranks: [
            {
              observed_date: '2026-03-01',
              rank: 14,
            },
            {
              observed_date: '2026-03-03',
              rank: 11,
            },
          ],
          sponsored_observed_ranks: [
            {
              observed_date: '2026-03-01',
              rank: 9,
            },
            {
              observed_date: '2026-03-03',
              rank: 8,
            },
          ],
        },
        coverage: {
          observed_start: '2026-03-03',
          observed_end: '2026-03-03',
          days_observed: 1,
          statuses: {},
          notes: [],
          critical_warnings: [],
        },
      },
    });

    expect(row.rankingContext).toMatchObject({
      contract: 'keyword_query_context',
      status: null,
      resolvedKeywordNorm: 'blue widget',
      organicObservedRanks: [
        {
          observedDate: '2026-03-01',
          rank: 14,
        },
        {
          observedDate: '2026-03-03',
          rank: 11,
        },
      ],
      sponsoredObservedRanks: [
        {
          observedDate: '2026-03-01',
          rank: 9,
        },
        {
          observedDate: '2026-03-03',
          rank: 8,
        },
      ],
    });
  });

  it('does not collapse multiple unresolved target identities into one row', async () => {
    state.advertisedRows = [
      {
        account_id: 'acct',
        date: '2026-03-03',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
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
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: null,
        target_id: 'UNKNOWN',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: null,
        targeting_raw: 'blue widget exact',
        targeting_norm: 'blue widget exact',
        match_type_norm: 'exact',
        impressions: 40,
        clicks: 4,
        spend: 12,
        sales: 48,
        orders: 1,
        units: 1,
        top_of_search_impression_share: null,
      },
      {
        account_id: 'acct',
        date: '2026-03-04',
        exported_at: '2026-03-10T00:00:00Z',
        campaign_id: 'campaign-1',
        ad_group_id: null,
        target_id: 'UNKNOWN',
        portfolio_name_raw: 'Portfolio',
        campaign_name_raw: 'Campaign 1',
        ad_group_name_raw: null,
        targeting_raw: 'blue widget broad',
        targeting_norm: 'blue widget broad',
        match_type_norm: 'broad',
        impressions: 60,
        clicks: 5,
        spend: 14,
        sales: 52,
        orders: 1,
        units: 1,
        top_of_search_impression_share: null,
      },
    ];

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.targetId)).toEqual([
      'weak::campaign_1::missing::blue_widget_broad::broad',
      'weak::campaign_1::missing::blue_widget_exact::exact',
    ]);
    expect(
      result.rows.every((row) => row.snapshotPayload.identity.target_identity_status === 'unresolved')
    ).toBe(true);
    expect(result.rows[0]?.snapshotPayload.identity.target_text).not.toContain('weak::');
  });
});
