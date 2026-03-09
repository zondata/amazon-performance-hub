import { describe, expect, it } from 'vitest';

import {
  buildSpTargetsWorkspaceModel,
  resolveSpProductScopeSummary,
} from '../apps/web/src/lib/ads/spTargetsWorkspaceModel';

describe('resolveSpProductScopeSummary', () => {
  it('derives deterministic inclusion ids and ambiguous campaign warnings', () => {
    const summary = resolveSpProductScopeSummary({
      selectedRows: [
        { campaign_id: 'c1', ad_group_id: 'ag1', advertised_asin_norm: 'asin-a' },
        { campaign_id: 'c2', ad_group_id: 'ag2', advertised_asin_norm: 'asin-a' },
      ],
      scopedRows: [
        { campaign_id: 'c1', ad_group_id: 'ag1', advertised_asin_norm: 'asin-a' },
        { campaign_id: 'c1', ad_group_id: 'ag1', advertised_asin_norm: 'asin-b' },
        { campaign_id: 'c2', ad_group_id: 'ag2', advertised_asin_norm: 'asin-a' },
      ],
    });

    expect(summary.campaignIds).toEqual(['c1', 'c2']);
    expect(summary.adGroupIds).toEqual(['ag1', 'ag2']);
    expect([...summary.ambiguousCampaignIds]).toEqual(['c1']);
  });
});

describe('buildSpTargetsWorkspaceModel', () => {
  it('keeps parent totals intact, uses latest diagnostics, and pins same-text child rows first', () => {
    const model = buildSpTargetsWorkspaceModel({
      targetRows: [
        {
          date: '2026-03-01',
          exported_at: '2026-03-02T00:00:00.000Z',
          target_id: 't1',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          portfolio_name_raw: 'Portfolio A',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group A',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
          impressions: 100,
          clicks: 10,
          spend: 20,
          sales: 100,
          orders: 4,
          units: 5,
          top_of_search_impression_share: 0.21,
        },
        {
          date: '2026-03-03',
          exported_at: '2026-03-04T00:00:00.000Z',
          target_id: 't1',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          portfolio_name_raw: 'Portfolio A',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group A',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
          impressions: 50,
          clicks: 5,
          spend: 15,
          sales: 75,
          orders: 3,
          units: 3,
          top_of_search_impression_share: 0.32,
        },
      ],
      searchTermRows: [
        {
          date: '2026-03-02',
          exported_at: '2026-03-02T00:00:00.000Z',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          targeting_norm: 'blue shoes',
          customer_search_term_raw: 'blue shoes',
          customer_search_term_norm: 'blue shoes',
          search_term_impression_share: 0.41,
          search_term_impression_rank: 3,
          impressions: 40,
          clicks: 4,
          spend: 8,
          sales: 50,
          orders: 2,
          units: 2,
        },
        {
          date: '2026-03-02',
          exported_at: '2026-03-02T00:00:00.000Z',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          targeting_norm: 'blue shoes',
          customer_search_term_raw: 'blue running shoes',
          customer_search_term_norm: 'blue running shoes',
          search_term_impression_share: 0.19,
          search_term_impression_rank: 7,
          impressions: 20,
          clicks: 2,
          spend: 5,
          sales: 10,
          orders: 1,
          units: 1,
        },
      ],
      placementRows: [
        {
          campaign_id: 'c1',
          placement_code: 'TOS',
          placement_raw: 'Top of Search (first page)',
          placement_raw_norm: 'top of search (first page)',
          impressions: 80,
          clicks: 8,
          spend: 16,
          sales: 120,
          orders: 5,
          units: 6,
        },
      ],
      currentTargetsById: new Map([
        [
          't1',
          {
            target_id: 't1',
            ad_group_id: 'ag1',
            campaign_id: 'c1',
            expression_raw: 'Blue Shoes',
            match_type: 'EXACT',
            is_negative: false,
            state: 'enabled',
            bid: 1.5,
          },
        ],
      ]),
      currentAdGroupsById: new Map([
        [
          'ag1',
          {
            ad_group_id: 'ag1',
            campaign_id: 'c1',
            ad_group_name_raw: 'Ad Group A',
            state: 'enabled',
            default_bid: 0.8,
          },
        ],
      ]),
      currentCampaignsById: new Map([
        [
          'c1',
          {
            campaign_id: 'c1',
            campaign_name_raw: 'Campaign A',
            state: 'enabled',
            daily_budget: 40,
            bidding_strategy: 'Dynamic bids - down only',
          },
        ],
      ]),
      currentPlacementModifiers: [
        {
          campaign_id: 'c1',
          placement_code: 'TOS',
          placement_raw: 'Top of Search (first page)',
          percentage: 35,
        },
      ],
      ambiguousCampaignIds: new Set(['c1']),
    });

    expect(model.rows).toHaveLength(1);
    const row = model.rows[0];
    expect(row?.impressions).toBe(150);
    expect(row?.clicks).toBe(15);
    expect(row?.sales).toBe(175);
    expect(row?.spend).toBe(35);
    expect(row?.stis).toBeCloseTo(0.32, 6);
    expect(row?.stir).toBe(3);
    expect(row?.status).toBe('Enabled');
    expect(row?.coverage_label).toBe('Shared campaign');
    expect(row?.search_terms[0]?.search_term).toBe('blue shoes');
    expect(row?.search_terms[0]?.same_text).toBe(true);
    expect(row?.placement_context?.top_of_search_modifier_pct).toBe(35);
    expect(row?.placement_context?.sales).toBe(120);
    expect(row?.composer_context.target.current_bid).toBe(1.5);
    expect(row?.composer_context.ad_group?.current_default_bid).toBe(0.8);
    expect(row?.composer_context.campaign.current_budget).toBe(40);
    expect(row?.composer_context.placement?.current_percentage).toBe(35);
  });

  it('surfaces parent STIR from the best covered child when same-text is unavailable and preserves null units', () => {
    const model = buildSpTargetsWorkspaceModel({
      targetRows: [
        {
          date: '2026-03-03',
          exported_at: '2026-03-04T00:00:00.000Z',
          target_id: 't2',
          campaign_id: 'c2',
          ad_group_id: 'ag2',
          portfolio_name_raw: 'Portfolio B',
          campaign_name_raw: 'Campaign B',
          ad_group_name_raw: 'Ad Group B',
          targeting_raw: 'Brown Boots',
          targeting_norm: 'brown boots',
          match_type_norm: 'PHRASE',
          impressions: 80,
          clicks: 8,
          spend: 24,
          sales: 96,
          orders: 3,
          units: null,
          top_of_search_impression_share: 0.14,
        },
      ],
      searchTermRows: [
        {
          date: '2026-03-03',
          exported_at: '2026-03-04T00:00:00.000Z',
          campaign_id: 'c2',
          ad_group_id: 'ag2',
          target_id: 't2',
          target_key: 'tk2',
          targeting_norm: 'brown boots',
          customer_search_term_raw: 'brown winter boots',
          customer_search_term_norm: 'brown winter boots',
          search_term_impression_share: 0.22,
          search_term_impression_rank: 5,
          impressions: 120,
          clicks: 10,
          spend: 20,
          sales: 40,
          orders: 2,
          units: null,
        },
        {
          date: '2026-03-03',
          exported_at: '2026-03-04T00:00:00.000Z',
          campaign_id: 'c2',
          ad_group_id: 'ag2',
          target_id: 't2',
          target_key: 'tk2',
          targeting_norm: 'brown boots',
          customer_search_term_raw: 'boots for winter',
          customer_search_term_norm: 'boots for winter',
          search_term_impression_share: 0.18,
          search_term_impression_rank: 11,
          impressions: 20,
          clicks: 2,
          spend: 4,
          sales: 8,
          orders: 1,
          units: 0,
        },
      ],
      placementRows: [],
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.stir).toBe(5);
    expect(model.rows[0]?.units).toBeNull();
    expect(model.rows[0]?.search_terms[0]?.units).toBeNull();
    expect(model.rows[0]?.search_terms[1]?.units).toBe(0);
    expect(model.totals.units).toBeNull();
  });

  it('shows single-ASIN rank context when exact keyword mapping is available', () => {
    const model = buildSpTargetsWorkspaceModel({
      targetRows: [
        {
          date: '2026-03-03',
          exported_at: '2026-03-04T00:00:00.000Z',
          target_id: 't3',
          campaign_id: 'c3',
          ad_group_id: 'ag3',
          portfolio_name_raw: 'Portfolio C',
          campaign_name_raw: 'Campaign C',
          ad_group_name_raw: 'Ad Group C',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
          impressions: 20,
          clicks: 2,
          spend: 4,
          sales: 12,
          orders: 1,
          units: 1,
          top_of_search_impression_share: null,
        },
      ],
      searchTermRows: [],
      placementRows: [],
      rankContextTrustworthy: true,
      rankContextByKeywordNorm: new Map([
        [
          'blue shoes',
          {
            organic_rank: 6,
            sponsored_rank: 2,
            observed_date: '2026-03-04',
          },
        ],
      ]),
    });

    expect(model.rows[0]?.rank_context).toEqual({
      organic_rank: 6,
      sponsored_rank: 2,
      observed_date: '2026-03-04',
    });
    expect(model.rows[0]?.rank_context_note).toBeNull();
  });

  it('stays null-safe when rank context is not trustworthy even if rank rows exist', () => {
    const model = buildSpTargetsWorkspaceModel({
      targetRows: [
        {
          date: '2026-03-03',
          exported_at: '2026-03-04T00:00:00.000Z',
          target_id: 't4',
          campaign_id: 'c4',
          ad_group_id: 'ag4',
          portfolio_name_raw: 'Portfolio D',
          campaign_name_raw: 'Campaign D',
          ad_group_name_raw: 'Ad Group D',
          targeting_raw: 'Red Boots',
          targeting_norm: 'red boots',
          match_type_norm: 'PHRASE',
          impressions: 20,
          clicks: 2,
          spend: 4,
          sales: 12,
          orders: 1,
          units: 1,
          top_of_search_impression_share: null,
        },
      ],
      searchTermRows: [],
      placementRows: [],
      rankContextTrustworthy: false,
      rankContextByKeywordNorm: new Map([
        [
          'red boots',
          {
            organic_rank: 12,
            sponsored_rank: 7,
            observed_date: '2026-03-04',
          },
        ],
      ]),
    });

    expect(model.rows[0]?.rank_context).toBeNull();
    expect(model.rows[0]?.rank_context_note).toBe('single-ASIN only');
  });

  it('stays null-safe when no rank snapshot exists for the exact keyword', () => {
    const model = buildSpTargetsWorkspaceModel({
      targetRows: [
        {
          date: '2026-03-03',
          exported_at: '2026-03-04T00:00:00.000Z',
          target_id: 't5',
          campaign_id: 'c5',
          ad_group_id: 'ag5',
          portfolio_name_raw: 'Portfolio E',
          campaign_name_raw: 'Campaign E',
          ad_group_name_raw: 'Ad Group E',
          targeting_raw: 'Green Sandals',
          targeting_norm: 'green sandals',
          match_type_norm: 'BROAD',
          impressions: 20,
          clicks: 2,
          spend: 4,
          sales: 12,
          orders: 1,
          units: 1,
          top_of_search_impression_share: null,
        },
      ],
      searchTermRows: [],
      placementRows: [],
      rankContextTrustworthy: true,
      rankContextByKeywordNorm: new Map(),
    });

    expect(model.rows[0]?.rank_context).toBeNull();
    expect(model.rows[0]?.rank_context_note).toBe('no rank snapshot');
  });
});
