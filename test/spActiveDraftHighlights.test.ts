import { describe, expect, it } from 'vitest';

import { deriveSpActiveDraftHighlights } from '../apps/web/src/lib/ads-workspace/spActiveDraftHighlights';
import type { AdsChangeSetItem } from '../apps/web/src/lib/ads-workspace/types';

const makeItem = (overrides: Partial<AdsChangeSetItem>): AdsChangeSetItem => ({
  id: 'item-1',
  change_set_id: 'cs-1',
  channel: 'sp',
  entity_level: 'campaign',
  entity_key: 'campaign-1',
  campaign_id: 'campaign-1',
  ad_group_id: null,
  target_id: null,
  target_key: null,
  placement_code: null,
  action_type: 'update_campaign_budget',
  before_json: {},
  after_json: {},
  objective: null,
  hypothesis: null,
  forecast_json: null,
  review_after_days: null,
  notes: null,
  objective_preset_id: null,
  ui_context_json: null,
  created_at: '2026-03-08T00:00:00Z',
  updated_at: '2026-03-08T00:00:00Z',
  ...overrides,
});

describe('deriveSpActiveDraftHighlights', () => {
  it('returns empty highlight state for undefined, null, and empty inputs', () => {
    for (const result of [
      deriveSpActiveDraftHighlights(undefined),
      deriveSpActiveDraftHighlights(null),
      deriveSpActiveDraftHighlights([]),
    ]) {
      expect(result.campaigns.size).toBe(0);
      expect(result.adGroups.size).toBe(0);
      expect(result.targets.size).toBe(0);
      expect(result.placements.size).toBe(0);
    }
  });

  it('marks direct rows and contextual ancestors for target/ad-group/placement edits', () => {
    const result = deriveSpActiveDraftHighlights([
      makeItem({
        entity_level: 'target',
        entity_key: 'target-1',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        action_type: 'update_target_bid',
      }),
      makeItem({
        id: 'item-2',
        entity_level: 'ad_group',
        entity_key: 'ad-group-2',
        campaign_id: 'campaign-2',
        ad_group_id: 'ad-group-2',
        action_type: 'update_ad_group_state',
      }),
      makeItem({
        id: 'item-3',
        entity_level: 'placement',
        entity_key: 'campaign-3::PLACEMENT_TOP',
        campaign_id: 'campaign-3',
        placement_code: 'PLACEMENT_TOP',
        action_type: 'update_placement_modifier',
      }),
    ]);

    expect(result.targets.get('target-1')).toBe('direct');
    expect(result.adGroups.get('ad-group-1')).toBe('context');
    expect(result.campaigns.get('campaign-1')).toBe('context');
    expect(result.adGroups.get('ad-group-2')).toBe('direct');
    expect(result.campaigns.get('campaign-2')).toBe('context');
    expect(result.placements.get('campaign-3::PLACEMENT_TOP')).toBe('direct');
    expect(result.campaigns.get('campaign-3')).toBe('context');
  });

  it('lets direct edits win over contextual ancestor tones', () => {
    const result = deriveSpActiveDraftHighlights([
      makeItem({
        entity_level: 'target',
        entity_key: 'target-1',
        campaign_id: 'campaign-1',
        ad_group_id: 'ad-group-1',
        target_id: 'target-1',
        action_type: 'update_target_bid',
      }),
      makeItem({
        id: 'item-2',
        entity_level: 'campaign',
        entity_key: 'campaign-1',
        campaign_id: 'campaign-1',
        action_type: 'update_campaign_state',
      }),
    ]);

    expect(result.campaigns.get('campaign-1')).toBe('direct');
    expect(result.targets.get('target-1')).toBe('direct');
    expect(result.adGroups.get('ad-group-1')).toBe('context');
  });

  it('preserves normal populated behavior and ignores non-SP items', () => {
    const result = deriveSpActiveDraftHighlights([
      makeItem({
        channel: 'sb',
        entity_level: 'campaign',
        entity_key: 'campaign-9',
        campaign_id: 'campaign-9',
      }),
    ]);

    expect(result.campaigns.size).toBe(0);
    expect(result.adGroups.size).toBe(0);
    expect(result.targets.size).toBe(0);
    expect(result.placements.size).toBe(0);
  });
});
