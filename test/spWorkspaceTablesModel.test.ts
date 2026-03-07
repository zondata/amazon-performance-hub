import { describe, expect, it } from 'vitest';

import { buildSpDraftMutationPlan } from '../apps/web/src/lib/ads-workspace/spChangeComposer';
import {
  buildSpAdGroupsWorkspaceModel,
  buildSpCampaignsWorkspaceModel,
  buildSpPlacementsWorkspaceModel,
} from '../apps/web/src/lib/ads/spWorkspaceTablesModel';

describe('buildSpCampaignsWorkspaceModel', () => {
  it('builds campaign rows with current campaign context and nullable placement context', () => {
    const model = buildSpCampaignsWorkspaceModel({
      campaignRows: [
        {
          date: '2026-03-01',
          exported_at: '2026-03-02T00:00:00.000Z',
          campaign_id: 'c1',
          portfolio_name_raw: 'Portfolio A',
          campaign_name_raw: 'Campaign A',
          impressions: 120,
          clicks: 12,
          spend: 30,
          sales: 150,
          orders: 5,
          units: 6,
        },
      ],
      currentCampaignsById: new Map([
        [
          'c1',
          {
            campaign_id: 'c1',
            campaign_name_raw: 'Campaign A',
            state: 'enabled',
            daily_budget: 50,
            bidding_strategy: 'Dynamic bids - down only',
          },
        ],
      ]),
      currentPlacementModifiers: [
        {
          campaign_id: 'c1',
          placement_code: 'PLACEMENT_TOP',
          placement_raw: 'Top of Search (first page)',
          percentage: 35,
        },
      ],
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      campaign_id: 'c1',
      status: 'Enabled',
      bidding_strategy: 'Dynamic bids - down only',
      spend: 30,
      sales: 150,
    });
    expect(model.rows[0]?.composer_context.surface).toBe('campaigns');
    expect(model.rows[0]?.composer_context.placement?.current_percentage).toBe(35);
  });

  it('preserves nullable campaign units when source rows have no units coverage', () => {
    const model = buildSpCampaignsWorkspaceModel({
      campaignRows: [
        {
          date: '2026-03-01',
          exported_at: '2026-03-02T00:00:00.000Z',
          campaign_id: 'c2',
          portfolio_name_raw: 'Portfolio B',
          campaign_name_raw: 'Campaign B',
          impressions: 80,
          clicks: 8,
          spend: 16,
          sales: 48,
          orders: 2,
          units: null,
        },
      ],
      currentCampaignsById: new Map(),
      currentPlacementModifiers: [],
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]?.units).toBeNull();
    expect(model.totals.units).toBeNull();
  });
});

describe('buildSpAdGroupsWorkspaceModel', () => {
  it('aggregates targeting rows into ad group totals with explicit shared-campaign coverage', () => {
    const model = buildSpAdGroupsWorkspaceModel({
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
          sales: 110,
          orders: 4,
          units: 4,
          top_of_search_impression_share: 0.2,
        },
        {
          date: '2026-03-02',
          exported_at: '2026-03-03T00:00:00.000Z',
          target_id: 't2',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          portfolio_name_raw: 'Portfolio A',
          campaign_name_raw: 'Campaign A',
          ad_group_name_raw: 'Ad Group A',
          targeting_raw: 'Red Shoes',
          targeting_norm: 'red shoes',
          match_type_norm: 'PHRASE',
          impressions: 60,
          clicks: 6,
          spend: 12,
          sales: 40,
          orders: 2,
          units: 2,
          top_of_search_impression_share: 0.1,
        },
      ],
      currentAdGroupsById: new Map([
        [
          'ag1',
          {
            ad_group_id: 'ag1',
            campaign_id: 'c1',
            ad_group_name_raw: 'Ad Group A',
            state: 'paused',
            default_bid: 0.85,
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
      currentPlacementModifiers: [],
      ambiguousCampaignIds: new Set(['c1']),
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      ad_group_id: 'ag1',
      spend: 32,
      sales: 150,
      status: 'Paused',
      default_bid: 0.85,
      coverage_label: 'Shared campaign',
    });
    expect(model.rows[0]?.composer_context.surface).toBe('adgroups');
  });
});

describe('buildSpPlacementsWorkspaceModel', () => {
  it('keeps placement rows campaign-scoped and maps current placement modifier by placement code', () => {
    const model = buildSpPlacementsWorkspaceModel({
      placementRows: [
        {
          campaign_id: 'c1',
          placement_code: 'PLACEMENT_PRODUCT_PAGE',
          placement_raw: 'Product Pages',
          portfolio_name_raw: 'Portfolio A',
          campaign_name_raw: 'Campaign A',
          impressions: 200,
          clicks: 20,
          spend: 40,
          sales: 80,
          orders: 3,
          units: 4,
        },
      ],
      currentCampaignsById: new Map([
        [
          'c1',
          {
            campaign_id: 'c1',
            campaign_name_raw: 'Campaign A',
            state: 'enabled',
            daily_budget: 60,
            bidding_strategy: 'Fixed bids',
          },
        ],
      ]),
      currentPlacementModifiers: [
        {
          campaign_id: 'c1',
          placement_code: 'PLACEMENT_PRODUCT_PAGE',
          placement_raw: 'Product Pages',
          percentage: 15,
        },
      ],
    });

    expect(model.rows).toHaveLength(1);
    expect(model.rows[0]).toMatchObject({
      placement_code: 'PLACEMENT_PRODUCT_PAGE',
      placement_label: 'Product Pages',
      placement_modifier_pct: 15,
      spend: 40,
      sales: 80,
    });
    expect(model.rows[0]?.composer_context.surface).toBe('placements');
    expect(model.rows[0]?.composer_context.placement?.placement_code).toBe(
      'PLACEMENT_PRODUCT_PAGE'
    );
  });
});

describe('buildSpDraftMutationPlan for phase 5 contexts', () => {
  it('stages campaign and placement actions without requiring a target context', () => {
    const result = buildSpDraftMutationPlan({
      change_set_name: 'Campaign draft',
      filters_json: { level: 'campaigns' },
      context: {
        channel: 'sp',
        surface: 'campaigns',
        target: null,
        ad_group: null,
        campaign: {
          id: 'c1',
          name: 'Campaign A',
          current_state: 'enabled',
          current_budget: 30,
          current_bidding_strategy: 'Dynamic bids - down only',
        },
        placement: {
          placement_code: 'PLACEMENT_TOP',
          label: 'Top of Search (first page)',
          current_percentage: 20,
        },
        coverage_note: null,
      },
      reasoning: {
        objective: 'Scale winners',
        hypothesis: null,
        forecast_json: null,
        forecast_window_days: null,
        review_after_days: null,
        notes: null,
        objective_preset_id: null,
      },
      campaign_budget: '35',
      placement_modifier_pct: '25',
    });

    expect(result.itemPayloads.map((item) => item.action_type)).toEqual([
      'update_campaign_budget',
      'update_placement_modifier',
    ]);
    expect(result.itemPayloads[1]?.after_json).toEqual({
      placement_code: 'PLACEMENT_TOP',
      percentage: 25,
    });
  });
});
