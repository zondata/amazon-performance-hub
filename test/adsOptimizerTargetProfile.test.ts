import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
  advertisedRows: [] as Array<Record<string, unknown>>,
  targetingRows: [] as Array<Record<string, unknown>>,
  stisRows: [] as Array<Record<string, unknown>>,
  placementRows: [] as Array<Record<string, unknown>>,
};

const resetState = () => {
  state.advertisedRows = [];
  state.targetingRows = [];
  state.stisRows = [];
  state.placementRows = [];
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
  getAdsOptimizerOverviewData: async () => ({
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

    const result = await loadAdsOptimizerTargetProfiles({
      asin: 'B001TEST',
      start: '2026-03-01',
      end: '2026-03-10',
    });

    expect(result.zeroTargetDiagnostics).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.snapshotPayload.phase).toBe(5);
    expect(result.rows[0]?.snapshotPayload.target_profile_version).toBe('phase5_v1');
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
    expect(result.rows[0]?.snapshotPayload.derived_metrics.contribution_after_ads).toBeCloseTo(10.6);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.break_even_gap).toBeCloseTo(
      0.11777777777777781
    );
    expect(result.rows[0]?.snapshotPayload.derived_metrics.max_cpc_support_gap).toBeCloseTo(1.325);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.click_velocity).toBe(8);
    expect(result.rows[0]?.snapshotPayload.derived_metrics.impression_velocity).toBe(80);
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
