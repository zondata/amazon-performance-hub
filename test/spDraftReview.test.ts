import { describe, expect, it } from 'vitest';

import {
  buildSpDraftItemPatch,
  describeSpDraftItem,
  mapChangeSetItemsToSpUpdateActions,
} from '../apps/web/src/lib/ads-workspace/spDraftReview';
import type { AdsChangeSetItem } from '../apps/web/src/lib/ads-workspace/types';

const makeItem = (overrides: Partial<AdsChangeSetItem> = {}): AdsChangeSetItem => ({
  id: 'item-1',
  change_set_id: 'cs-1',
  channel: 'sp',
  entity_level: 'target',
  entity_key: 'target-1',
  campaign_id: 'campaign-1',
  ad_group_id: 'ad-group-1',
  target_id: 'target-1',
  target_key: null,
  placement_code: null,
  action_type: 'update_target_bid',
  before_json: { bid: 0.75 },
  after_json: { bid: 0.95 },
  objective: 'Reduce waste',
  hypothesis: 'Bid down trims bad clicks',
  forecast_json: { summary: 'ACOS down', window_days: 7, direction: 'down' },
  review_after_days: 5,
  notes: 'Start here',
  objective_preset_id: null,
  ui_context_json: {
    campaign_name: 'Campaign A',
    ad_group_name: 'Ad Group A',
    target_text: 'blue shoes',
  },
  created_at: '2026-03-06T10:00:00.000Z',
  updated_at: '2026-03-06T10:00:00.000Z',
  ...overrides,
});

describe('mapChangeSetItemsToSpUpdateActions', () => {
  it('maps staged items back into SP update actions with parent identity chain intact', () => {
    const actions = mapChangeSetItemsToSpUpdateActions([
      makeItem(),
      makeItem({
        id: 'item-2',
        entity_level: 'ad_group',
        entity_key: 'ad-group-1',
        target_id: null,
        action_type: 'update_ad_group_default_bid',
        before_json: { default_bid: 0.6 },
        after_json: { default_bid: 0.8 },
      }),
      makeItem({
        id: 'item-3',
        entity_level: 'campaign',
        entity_key: 'campaign-1',
        ad_group_id: null,
        target_id: null,
        action_type: 'update_campaign_budget',
        before_json: { daily_budget: 20 },
        after_json: { daily_budget: 25 },
      }),
      makeItem({
        id: 'item-4',
        entity_level: 'placement',
        entity_key: 'campaign-1::PLACEMENT_TOP',
        ad_group_id: null,
        target_id: null,
        placement_code: 'PLACEMENT_TOP',
        action_type: 'update_placement_modifier',
        before_json: { placement_code: 'PLACEMENT_TOP', percentage: 20 },
        after_json: { placement_code: 'PLACEMENT_TOP', percentage: 35 },
      }),
    ]);

    expect(actions).toEqual([
      {
        type: 'update_target_bid',
        target_id: 'target-1',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        new_bid: 0.95,
      },
      {
        type: 'update_ad_group_default_bid',
        ad_group_id: 'ad-group-1',
        campaign_id: 'campaign-1',
        new_bid: 0.8,
      },
      {
        type: 'update_campaign_budget',
        campaign_id: 'campaign-1',
        new_budget: 25,
      },
      {
        type: 'update_placement_modifier',
        campaign_id: 'campaign-1',
        placement_code: 'PLACEMENT_TOP',
        new_pct: 35,
      },
    ]);
  });

  it('rejects missing required ids and invalid state values', () => {
    expect(() =>
      mapChangeSetItemsToSpUpdateActions([
        makeItem({
          target_id: null,
        }),
      ])
    ).toThrow('target_id is required.');

    expect(() =>
      mapChangeSetItemsToSpUpdateActions([
        makeItem({
          action_type: 'update_target_state',
          before_json: { state: 'enabled' },
          after_json: { state: 'draft' },
        }),
      ])
    ).toThrow('after_json.state must be one of: enabled, paused, archived.');
  });
});

describe('buildSpDraftItemPatch', () => {
  it('updates the atomic field and reasoning metadata for a staged item', () => {
    const patch = buildSpDraftItemPatch({
      item: makeItem(),
      nextValueRaw: '1.10',
      objective: 'Scale efficient traffic',
      hypothesis: 'Higher bid improves top placements',
      forecastSummary: 'Clicks up, ACOS stable',
      forecastWindowDays: '14',
      reviewAfterDays: '7',
      notes: 'Review after one week',
    });

    expect(patch.after_json).toEqual({ bid: 1.1 });
    expect(patch.objective).toBe('Scale efficient traffic');
    expect(patch.hypothesis).toBe('Higher bid improves top placements');
    expect(patch.forecast_json).toEqual({
      summary: 'Clicks up, ACOS stable',
      window_days: 14,
      direction: 'down',
    });
    expect(patch.review_after_days).toBe(7);
    expect(patch.notes).toBe('Review after one week');
  });

  it('rejects invalid item edits', () => {
    expect(() =>
      buildSpDraftItemPatch({
        item: makeItem({
          action_type: 'update_target_state',
          before_json: { state: 'enabled' },
          after_json: { state: 'paused' },
        }),
        nextValueRaw: 'draft',
        objective: 'Keep hygiene',
        hypothesis: null,
        forecastSummary: null,
        forecastWindowDays: null,
        reviewAfterDays: null,
        notes: null,
      })
    ).toThrow('Target state must be one of: enabled, paused, archived.');

    expect(() =>
      buildSpDraftItemPatch({
        item: makeItem(),
        nextValueRaw: '-1',
        objective: 'Bad edit',
        hypothesis: null,
        forecastSummary: null,
        forecastWindowDays: null,
        reviewAfterDays: null,
        notes: null,
      })
    ).toThrow('Target bid must be non-negative.');
  });
});

describe('describeSpDraftItem', () => {
  it('keeps target text primary while adding readable campaign and ad group context', () => {
    const descriptor = describeSpDraftItem(makeItem());

    expect(descriptor.title).toBe('blue shoes');
    expect(descriptor.subtitle).toBe('Campaign A · Ad Group A');
    expect(descriptor.contextLabel).toBe('Campaign A · Ad Group A · blue shoes');
    expect(descriptor.groupKey).toBe('campaign-1');
    expect(descriptor.groupTitle).toBe('Campaign A');
    expect(descriptor.secondaryIds).toBe('campaign-1 · ad-group-1 · target-1');
  });

  it('simplifies placement items while keeping campaign context readable', () => {
    const descriptor = describeSpDraftItem(
      makeItem({
        entity_level: 'placement',
        entity_key: 'campaign-1::PLACEMENT_TOP',
        ad_group_id: null,
        target_id: null,
        placement_code: 'PLACEMENT_TOP',
        action_type: 'update_placement_modifier',
        before_json: { placement_code: 'PLACEMENT_TOP', percentage: 20 },
        after_json: { placement_code: 'PLACEMENT_TOP', percentage: 35 },
        ui_context_json: {
          campaign_name: 'Campaign A',
          placement_label: 'Top of Search (first page)',
        },
      })
    );

    expect(descriptor.title).toBe('Top of Search (first page)');
    expect(descriptor.subtitle).toBe('Campaign A');
    expect(descriptor.contextLabel).toBe('Campaign A · Top of Search (first page)');
    expect(descriptor.groupKey).toBe('campaign-1');
    expect(descriptor.secondaryIds).toBe('campaign-1 · PLACEMENT_TOP');
  });
});
