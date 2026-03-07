import { describe, expect, it } from 'vitest';

import { buildSpSearchTermsWorkspaceModel } from '../apps/web/src/lib/ads/spSearchTermsWorkspaceModel';

describe('buildSpSearchTermsWorkspaceModel', () => {
  it('groups parent rows by asin bucket and keeps child rows deduplicated by entity chain', () => {
    const model = buildSpSearchTermsWorkspaceModel({
      asinFilter: 'all',
      searchTermRows: [
        {
          date: '2026-03-01',
          exported_at: '2026-03-02T00:00:00.000Z',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group A',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
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
          exported_at: '2026-03-03T00:00:00.000Z',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group A',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
          customer_search_term_raw: 'blue shoes',
          customer_search_term_norm: 'blue shoes',
          search_term_impression_share: 0.39,
          search_term_impression_rank: 4,
          impressions: 20,
          clicks: 2,
          spend: 4,
          sales: 15,
          orders: 1,
          units: 1,
        },
        {
          date: '2026-03-02',
          exported_at: '2026-03-03T00:00:00.000Z',
          campaign_id: 'c2',
          ad_group_id: 'ag2',
          target_id: 't2',
          target_key: 'tk2',
          campaign_name_raw: 'Campaign B',
          ad_group_name_raw: 'Ad Group B',
          targeting_raw: 'Winter Boots',
          targeting_norm: 'winter boots',
          match_type_norm: 'PHRASE',
          customer_search_term_raw: 'winter boots',
          customer_search_term_norm: 'winter boots',
          search_term_impression_share: 0.12,
          search_term_impression_rank: 11,
          impressions: 30,
          clicks: 3,
          spend: 9,
          sales: 27,
          orders: 1,
          units: 1,
        },
        {
          date: '2026-03-02',
          exported_at: '2026-03-03T00:00:00.000Z',
          campaign_id: 'c3',
          ad_group_id: 'ag3',
          target_id: null,
          target_key: 'tk3',
          campaign_name_raw: 'Campaign C',
          ad_group_name_raw: 'Ad Group C',
          targeting_raw: 'Green Shoes',
          targeting_norm: 'green shoes',
          match_type_norm: 'BROAD',
          customer_search_term_raw: 'green shoes',
          customer_search_term_norm: 'green shoes',
          search_term_impression_share: 0.08,
          search_term_impression_rank: 15,
          impressions: 25,
          clicks: 2,
          spend: 5,
          sales: 12,
          orders: 1,
          units: 1,
        },
      ],
      scopedAdvertisedProductRows: [
        { campaign_id: 'c1', ad_group_id: 'ag1', advertised_asin_norm: 'asin-a' },
        { campaign_id: 'c2', ad_group_id: 'ag2', advertised_asin_norm: 'asin-a' },
        { campaign_id: 'c2', ad_group_id: 'ag2', advertised_asin_norm: 'asin-b' },
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
            bid: 1.35,
          },
        ],
        [
          't2',
          {
            target_id: 't2',
            ad_group_id: 'ag2',
            campaign_id: 'c2',
            expression_raw: 'Winter Boots',
            match_type: 'PHRASE',
            is_negative: false,
            state: 'paused',
            bid: 0.95,
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
        [
          'ag2',
          {
            ad_group_id: 'ag2',
            campaign_id: 'c2',
            ad_group_name_raw: 'Ad Group B',
            state: 'paused',
            default_bid: 0.7,
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
            daily_budget: 35,
            bidding_strategy: 'Dynamic bids - down only',
          },
        ],
        [
          'c2',
          {
            campaign_id: 'c2',
            campaign_name_raw: 'Campaign B',
            state: 'paused',
            daily_budget: 25,
            bidding_strategy: 'Fixed bids',
          },
        ],
      ]),
      currentPlacementModifiers: [
        {
          campaign_id: 'c1',
          placement_code: 'PLACEMENT_TOP',
          placement_raw: 'Top of Search (first page)',
          percentage: 30,
        },
      ],
      ambiguousCampaignIds: new Set(['c3']),
    });

    expect(model.rows).toHaveLength(3);
    expect(model.rows.map((row) => row.asin_label)).toEqual([
      'ASIN-A',
      'Multiple ASINs',
      'Unattributed',
    ]);
    expect(model.rows[0]).toMatchObject({
      search_term: 'blue shoes',
      spend: 12,
      sales: 65,
    });
    expect(model.rows[0]?.child_rows).toHaveLength(1);
    expect(model.rows[0]?.child_rows[0]).toMatchObject({
      target_text: 'Blue Shoes',
      status: 'Enabled',
      current_bid: 1.35,
    });
    expect(model.rows[0]?.child_rows[0]?.composer_context.surface).toBe('searchterms');
    expect(model.rows[1]?.coverage_label).toBe('Shared scope');
    expect(model.rows[2]?.coverage_label).toBe('ASIN fallback');
    expect(model.coverage).toEqual({ shared_scope_count: 1, unattributed_count: 1 });
    expect(model.totals).toMatchObject({
      search_terms: 3,
      spend: 26,
      sales: 104,
      clicks: 11,
    });
  });

  it('keeps units nullable when source search-term rows do not provide units coverage', () => {
    const model = buildSpSearchTermsWorkspaceModel({
      asinFilter: 'all',
      searchTermRows: [
        {
          date: '2026-03-02',
          exported_at: '2026-03-03T00:00:00.000Z',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group A',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
          customer_search_term_raw: 'blue shoes',
          customer_search_term_norm: 'blue shoes',
          search_term_impression_share: 0.3,
          search_term_impression_rank: 3,
          impressions: 10,
          clicks: 1,
          spend: 2,
          sales: 8,
          orders: 1,
          units: null,
        },
      ],
      scopedAdvertisedProductRows: [
        { campaign_id: 'c1', ad_group_id: 'ag1', advertised_asin_norm: 'asin-a' },
      ],
      currentTargetsById: new Map(),
      currentAdGroupsById: new Map(),
      currentCampaignsById: new Map(),
      currentPlacementModifiers: [],
      ambiguousCampaignIds: new Set(),
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.units).toBeNull();
    expect(model.rows[0]?.child_rows[0]?.units).toBeNull();
    expect(model.totals.units).toBeNull();
  });

  it('uses the selected asin bucket while keeping shared-campaign coverage explicit', () => {
    const model = buildSpSearchTermsWorkspaceModel({
      asinFilter: 'B0TEST1234',
      searchTermRows: [
        {
          date: '2026-03-01',
          exported_at: '2026-03-02T00:00:00.000Z',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group A',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
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
      ],
      scopedAdvertisedProductRows: [
        { campaign_id: 'c1', ad_group_id: 'ag1', advertised_asin_norm: 'b0test1234' },
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
            bid: 1.25,
          },
        ],
      ]),
      currentAdGroupsById: new Map(),
      currentCampaignsById: new Map([
        [
          'c1',
          {
            campaign_id: 'c1',
            campaign_name_raw: 'Campaign A',
            state: 'enabled',
            daily_budget: 25,
            bidding_strategy: 'Fixed bids',
          },
        ],
      ]),
      currentPlacementModifiers: [],
      ambiguousCampaignIds: new Set(['c1']),
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.asin_label).toBe('B0TEST1234');
    expect(model.rows[0]?.coverage_label).toBe('Shared campaign');
    expect(model.rows[0]?.child_rows[0]?.coverage_label).toBe('Shared campaign');
  });

  it('uses campaign-level advertised-asin coverage when ad-group coverage is missing', () => {
    const model = buildSpSearchTermsWorkspaceModel({
      asinFilter: 'all',
      searchTermRows: [
        {
          date: '2026-03-01',
          exported_at: '2026-03-02T00:00:00.000Z',
          campaign_id: 'c1',
          ad_group_id: 'ag-missing',
          target_id: 't1',
          target_key: 'tk1',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group Missing',
          targeting_raw: 'Blue Shoes',
          targeting_norm: 'blue shoes',
          match_type_norm: 'EXACT',
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
      ],
      scopedAdvertisedProductRows: [
        { campaign_id: 'c1', ad_group_id: 'ag-other', advertised_asin_norm: 'B0ABC12345' },
      ],
      currentTargetsById: new Map(),
      currentAdGroupsById: new Map(),
      currentCampaignsById: new Map([
        [
          'c1',
          {
            campaign_id: 'c1',
            campaign_name_raw: 'Campaign A',
            state: 'enabled',
            daily_budget: 25,
            bidding_strategy: 'Fixed bids',
          },
        ],
      ]),
      currentPlacementModifiers: [],
      ambiguousCampaignIds: new Set(),
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.asin_label).toBe('B0ABC12345');
    expect(model.rows[0]?.coverage_label).toBeNull();
  });
});
