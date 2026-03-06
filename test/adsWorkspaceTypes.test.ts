import { describe, expect, it } from 'vitest';

import {
  mapChangeSetItemRow,
  mapChangeSetRow,
  mapObjectivePresetRow,
} from '../apps/web/src/lib/ads-workspace/types';

describe('ads workspace row mapping', () => {
  it('maps change set rows and preserves object json fields', () => {
    const row = mapChangeSetRow({
      id: 'change-set-1',
      account_id: 'demo',
      marketplace: 'US',
      experiment_id: null,
      name: 'Draft',
      status: 'draft',
      objective: null,
      hypothesis: null,
      forecast_window_days: null,
      review_after_days: null,
      notes: null,
      filters_json: { asin: 'B001234567' },
      generated_run_id: null,
      generated_artifact_json: { run: 'sp-1' },
      created_at: '2026-03-06T00:00:00.000Z',
      updated_at: '2026-03-06T00:00:00.000Z',
    });

    expect(row.filters_json).toEqual({ asin: 'B001234567' });
    expect(row.generated_artifact_json).toEqual({ run: 'sp-1' });
  });

  it('maps item rows and rejects non-object before_json values', () => {
    expect(() =>
      mapChangeSetItemRow({
        id: 'item-1',
        change_set_id: 'change-set-1',
        channel: 'sp',
        entity_level: 'campaign',
        entity_key: 'sp:campaign:1',
        campaign_id: '1',
        ad_group_id: null,
        target_id: null,
        target_key: null,
        placement_code: null,
        action_type: 'update_campaign_budget',
        before_json: [],
        after_json: { budget: 45 },
        objective: null,
        hypothesis: null,
        forecast_json: null,
        review_after_days: null,
        notes: null,
        objective_preset_id: null,
        ui_context_json: null,
        created_at: '2026-03-06T00:00:00.000Z',
        updated_at: '2026-03-06T00:00:00.000Z',
      })
    ).toThrow(/before_json/);
  });

  it('maps objective preset rows with nullable forecast_json', () => {
    const row = mapObjectivePresetRow({
      id: 'preset-1',
      account_id: 'demo',
      marketplace: 'US',
      channel: null,
      name: 'Default',
      objective: 'Protect rank',
      hypothesis: null,
      forecast_json: null,
      review_after_days: 7,
      notes: null,
      is_archived: false,
      created_at: '2026-03-06T00:00:00.000Z',
      updated_at: '2026-03-06T00:00:00.000Z',
    });

    expect(row.channel).toBeNull();
    expect(row.forecast_json).toBeNull();
  });
});
