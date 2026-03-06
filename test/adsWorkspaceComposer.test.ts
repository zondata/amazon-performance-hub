import { describe, expect, it } from 'vitest';

import {
  buildForecastJson,
  buildSpDraftMutationPlan,
  type SpChangeComposerContext,
} from '../apps/web/src/lib/ads-workspace/spChangeComposer';

const baseContext: SpChangeComposerContext = {
  channel: 'sp',
  surface: 'targets',
  target: {
    id: 't1',
    text: 'blue shoes',
    match_type: 'EXACT',
    is_negative: false,
    current_state: 'enabled',
    current_bid: 1.2,
  },
  ad_group: {
    id: 'ag1',
    name: 'Ad Group A',
    current_state: 'enabled',
    current_default_bid: 0.9,
  },
  campaign: {
    id: 'c1',
    name: 'Campaign A',
    current_state: 'enabled',
    current_budget: 25,
    current_bidding_strategy: 'Dynamic bids - down only',
  },
  placement: {
    placement_code: 'PLACEMENT_TOP',
    label: 'Top of Search (first page)',
    current_percentage: 35,
  },
  coverage_note: null,
};

describe('buildForecastJson', () => {
  it('overrides base forecast fields with manual composer inputs', () => {
    const result = buildForecastJson({
      forecastSummary: 'Expect cheaper CPC',
      forecastWindowDays: '14',
      baseForecastJson: { summary: 'Old', window_days: 7, direction: 'down' },
    });

    expect(result.forecast_window_days).toBe(14);
    expect(result.forecast_json).toEqual({
      summary: 'Expect cheaper CPC',
      window_days: 14,
      direction: 'down',
    });
  });
});

describe('buildSpDraftMutationPlan', () => {
  it('splits a multi-field save into atomic draft items with resolved reasoning', () => {
    const result = buildSpDraftMutationPlan({
      change_set_name: 'SP draft alpha',
      filters_json: { start: '2026-03-01', end: '2026-03-31', asin: 'all' },
      context: baseContext,
      reasoning: {
        objective: 'Reduce waste while protecting rank',
        hypothesis: 'Lower bid and pause weak state slices',
        forecast_json: { summary: 'Spend down, ACOS down', window_days: 10 },
        forecast_window_days: 10,
        review_after_days: 5,
        notes: 'Priority row',
        objective_preset_id: 'preset-1',
      },
      target_bid: '1.05',
      ad_group_state: 'paused',
      campaign_budget: '30',
      placement_modifier_pct: '42',
    });

    expect(result.changeSetPayload.name).toBe('SP draft alpha');
    expect(result.itemPayloads.map((item) => item.action_type)).toEqual([
      'update_target_bid',
      'update_ad_group_state',
      'update_campaign_budget',
      'update_placement_modifier',
    ]);
    expect(result.itemPayloads.every((item) => item.objective === 'Reduce waste while protecting rank')).toBe(true);
    expect(result.itemPayloads.every((item) => item.objective_preset_id === 'preset-1')).toBe(true);
    expect(result.itemPayloads[0]?.before_json).toEqual({ bid: 1.2 });
    expect(result.itemPayloads[0]?.after_json).toEqual({ bid: 1.05 });
    expect(result.itemPayloads[3]?.placement_code).toBe('PLACEMENT_TOP');
  });

  it('rejects unsupported target bid edits for negative targets', () => {
    expect(() =>
      buildSpDraftMutationPlan({
        change_set_name: 'Negative target draft',
        filters_json: {},
        context: {
          ...baseContext,
          target: {
            ...baseContext.target,
            is_negative: true,
          },
        },
        reasoning: {
          objective: 'Keep negatives clean',
          hypothesis: null,
          forecast_json: null,
          forecast_window_days: null,
          review_after_days: null,
          notes: null,
          objective_preset_id: null,
        },
        target_bid: '0.8',
      })
    ).toThrow('Negative targets cannot stage update_target_bid actions.');
  });

  it('rejects no-op saves when nothing changed', () => {
    expect(() =>
      buildSpDraftMutationPlan({
        change_set_name: 'No-op draft',
        filters_json: {},
        context: baseContext,
        reasoning: {
          objective: 'No-op',
          hypothesis: null,
          forecast_json: null,
          forecast_window_days: null,
          review_after_days: null,
          notes: null,
          objective_preset_id: null,
        },
        target_bid: '1.2',
        target_state: 'enabled',
        ad_group_default_bid: '0.9',
        ad_group_state: 'enabled',
        campaign_budget: '25',
        campaign_state: 'enabled',
        campaign_bidding_strategy: 'Dynamic bids - down only',
        placement_modifier_pct: '35',
      })
    ).toThrow('No draft changes were staged. Change at least one editable field before saving.');
  });
});
