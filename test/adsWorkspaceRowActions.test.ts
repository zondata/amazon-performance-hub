import { describe, expect, it } from 'vitest';

import {
  buildAdGroupRowActions,
  buildCampaignRowActions,
  buildPlacementRowActions,
  buildSearchTermRowActions,
  buildTargetRowActions,
} from '../apps/web/src/lib/ads/adsWorkspaceRowActions';

describe('adsWorkspaceRowActions', () => {
  it('builds the campaign row destination matrix without a self-link', () => {
    const row = {
      campaign_id: 'c1',
      ads_type: 'Sponsored Products',
      status: 'Enabled',
      campaign_name: 'Campaign A',
      bidding_strategy: null,
      portfolio_name: null,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      sales: 0,
      conversion: null,
      spend: 0,
      cpc: null,
      ctr: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      composer_context: {} as never,
    };

    expect(buildCampaignRowActions(row).map((item) => item.key)).toEqual([
      'stage_change',
      'trend',
      'placement',
      'adgroup',
      'target',
      'searchterm',
    ]);
    const trendAction = buildCampaignRowActions(row).find((item) => item.key === 'trend');
    expect(trendAction && trendAction.type === 'navigate' ? trendAction.view : null).toBe('trend');
    expect(
      trendAction && trendAction.type === 'navigate' ? trendAction.trendEntityId : null
    ).toBe('c1');
  });

  it('builds the placement row destination matrix without a self-link', () => {
    const row = {
      id: 'c1::PLACEMENT_TOP',
      campaign_id: 'c1',
      placement_code: 'PLACEMENT_TOP',
      ads_type: 'Sponsored Products',
      portfolio_name: null,
      campaign_name: 'Campaign A',
      placement_label: 'Top of Search (first page)',
      placement_modifier_pct: 15,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      sales: 0,
      conversion: null,
      spend: 0,
      cpc: null,
      ctr: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      composer_context: {} as never,
    };

    expect(buildPlacementRowActions(row).map((item) => item.key)).toEqual([
      'stage_change',
      'campaign',
      'adgroup',
      'target',
      'searchterm',
    ]);
  });

  it('builds the ad-group row destination matrix with scoped lower-level destinations', () => {
    const row = {
      ad_group_id: 'ag1',
      campaign_id: 'c1',
      ads_type: 'Sponsored Products',
      campaign_name: 'Campaign A',
      status: 'Enabled',
      ad_group_name: 'Ad Group A',
      default_bid: 1.2,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      sales: 0,
      conversion: null,
      spend: 0,
      cpc: null,
      ctr: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      composer_context: {} as never,
    };

    const actions = buildAdGroupRowActions(row);
    expect(actions.map((item) => item.key)).toEqual([
      'stage_change',
      'campaign',
      'placement',
      'target',
      'searchterm',
    ]);
    const targetAction = actions.find((item) => item.key === 'target');
    expect(targetAction && targetAction.type === 'navigate' ? targetAction.scope.adGroupScopeId : null).toBe('ag1');
  });

  it('builds the target row destination matrix and keeps search-term navigation scoped to parent ids', () => {
    const row = {
      target_id: 't1',
      campaign_id: 'c1',
      ad_group_id: 'ag1',
      status: 'Enabled',
      target_text: 'blue shoes',
      type_label: 'Keyword',
      portfolio_name: null,
      campaign_name: 'Campaign A',
      ad_group_name: 'Ad Group A',
      match_type: 'EXACT',
      rank_context: null,
      rank_context_note: null,
      stis: null,
      stir: null,
      tos_is: null,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      sales: 0,
      conversion: null,
      spend: 0,
      cpc: null,
      ctr: null,
      acos: null,
      roas: null,
      pnl: null,
      break_even_bid: null,
      last_activity: null,
      coverage_label: null,
      coverage_note: null,
      search_terms: [],
      placement_context: null,
      composer_context: {} as never,
    };

    const actions = buildTargetRowActions(row);
    expect(actions.map((item) => item.key)).toEqual([
      'stage_change',
      'trend',
      'campaign',
      'placement',
      'adgroup',
      'searchterm',
    ]);
    const trendAction = actions.find((item) => item.key === 'trend');
    expect(trendAction && trendAction.type === 'navigate' ? trendAction.view : null).toBe('trend');
    expect(
      trendAction && trendAction.type === 'navigate' ? trendAction.trendEntityId : null
    ).toBe('t1');
    const searchTermAction = actions.find((item) => item.key === 'searchterm');
    expect(
      searchTermAction && searchTermAction.type === 'navigate'
        ? searchTermAction.scope.adGroupScopeId
        : null
    ).toBe('ag1');
  });

  it('shows only deterministic destinations for grouped search-term rows', () => {
    const row = {
      id: 'st1',
      asin: 'B001',
      asin_label: 'B001',
      ads_type: 'Sponsored Products',
      search_term: 'blue shoes',
      search_term_norm: 'blue shoes',
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      spend: 0,
      sales: 0,
      ctr: null,
      cpc: null,
      cost_per_order: null,
      conversion: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      child_rows: [
        {
          id: 'child-1',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          campaign_name: 'Campaign A',
          ad_group_name: 'Ad Group A',
          target_text: 'blue shoes',
          status: 'Enabled',
          match_type: 'EXACT',
          impressions: 0,
          clicks: 0,
          orders: 0,
          units: null,
          sales: 0,
          conversion: null,
          cost: 0,
          current_bid: null,
          cpc: null,
          acos: null,
          roas: null,
          coverage_label: null,
          coverage_note: null,
          composer_context: {} as never,
        },
      ],
    };

    expect(buildSearchTermRowActions(row).map((item) => item.key)).toEqual([
      'campaign',
      'placement',
      'adgroup',
      'target',
    ]);
  });

  it('keeps Trend hidden for scopes without a real trend surface', () => {
    const placementRow = {
      id: 'c1::PLACEMENT_TOP',
      campaign_id: 'c1',
      placement_code: 'PLACEMENT_TOP',
      ads_type: 'Sponsored Products',
      portfolio_name: null,
      campaign_name: 'Campaign A',
      placement_label: 'Top of Search (first page)',
      placement_modifier_pct: 15,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      sales: 0,
      conversion: null,
      spend: 0,
      cpc: null,
      ctr: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      composer_context: {} as never,
    };
    const adGroupRow = {
      ad_group_id: 'ag1',
      campaign_id: 'c1',
      ads_type: 'Sponsored Products',
      campaign_name: 'Campaign A',
      status: 'Enabled',
      ad_group_name: 'Ad Group A',
      default_bid: 1.2,
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      sales: 0,
      conversion: null,
      spend: 0,
      cpc: null,
      ctr: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      composer_context: {} as never,
    };
    const searchTermRow = {
      id: 'st1',
      asin: 'B001',
      asin_label: 'B001',
      ads_type: 'Sponsored Products',
      search_term: 'blue shoes',
      search_term_norm: 'blue shoes',
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      spend: 0,
      sales: 0,
      ctr: null,
      cpc: null,
      cost_per_order: null,
      conversion: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      child_rows: [],
    };

    expect(buildPlacementRowActions(placementRow).map((item) => item.key)).not.toContain('trend');
    expect(buildAdGroupRowActions(adGroupRow).map((item) => item.key)).not.toContain('trend');
    expect(buildSearchTermRowActions(searchTermRow).map((item) => item.key)).not.toContain('trend');
  });

  it('hides ambiguous search-term destinations instead of showing misleading links', () => {
    const row = {
      id: 'st2',
      asin: 'B001',
      asin_label: 'B001',
      ads_type: 'Sponsored Products',
      search_term: 'running shoes',
      search_term_norm: 'running shoes',
      impressions: 0,
      clicks: 0,
      orders: 0,
      units: null,
      spend: 0,
      sales: 0,
      ctr: null,
      cpc: null,
      cost_per_order: null,
      conversion: null,
      acos: null,
      roas: null,
      pnl: null,
      coverage_label: null,
      coverage_note: null,
      child_rows: [
        {
          id: 'child-1',
          campaign_id: 'c1',
          ad_group_id: 'ag1',
          target_id: 't1',
          target_key: 'tk1',
          campaign_name: 'Campaign A',
          ad_group_name: 'Ad Group A',
          target_text: 'running shoes',
          status: 'Enabled',
          match_type: 'PHRASE',
          impressions: 0,
          clicks: 0,
          orders: 0,
          units: null,
          sales: 0,
          conversion: null,
          cost: 0,
          current_bid: null,
          cpc: null,
          acos: null,
          roas: null,
          coverage_label: null,
          coverage_note: null,
          composer_context: {} as never,
        },
        {
          id: 'child-2',
          campaign_id: 'c2',
          ad_group_id: 'ag2',
          target_id: 't2',
          target_key: 'tk2',
          campaign_name: 'Campaign B',
          ad_group_name: 'Ad Group B',
          target_text: 'running shoes broad',
          status: 'Enabled',
          match_type: 'BROAD',
          impressions: 0,
          clicks: 0,
          orders: 0,
          units: null,
          sales: 0,
          conversion: null,
          cost: 0,
          current_bid: null,
          cpc: null,
          acos: null,
          roas: null,
          coverage_label: null,
          coverage_note: null,
          composer_context: {} as never,
        },
      ],
    };

    expect(buildSearchTermRowActions(row)).toEqual([]);
  });
});
