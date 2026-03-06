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
          },
        ],
      ]),
      currentCampaignsById: new Map([
        [
          'c1',
          {
            campaign_id: 'c1',
            campaign_name_raw: 'Campaign A',
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
  });
});
