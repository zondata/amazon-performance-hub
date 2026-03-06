import { describe, expect, it } from 'vitest';

import {
  validateCreateChangeSetItemPayload,
  validateCreateChangeSetPayload,
  validateCreateObjectivePresetPayload,
  validateUpdateChangeSetItemPayload,
} from '../apps/web/src/lib/ads-workspace/validation';

describe('ads workspace validation', () => {
  it('accepts a change set draft with optional experiment_id omitted', () => {
    const result = validateCreateChangeSetPayload({
      name: 'Bid recovery draft',
      filters_json: { asin: 'B001234567' },
    });

    expect(result.errors).toEqual([]);
    expect(result.value.experiment_id).toBeNull();
    expect(result.value.status).toBe('draft');
    expect(result.value.filters_json).toEqual({ asin: 'B001234567' });
  });

  it('rejects invalid change set status and non-object filters_json', () => {
    const result = validateCreateChangeSetPayload({
      name: 'Bad draft',
      status: 'queued',
      filters_json: [],
    });

    expect(result.errors.join(' ')).toMatch(/status/);
    expect(result.errors.join(' ')).toMatch(/filters_json/);
  });

  it('accepts an atomic change set item payload', () => {
    const result = validateCreateChangeSetItemPayload({
      channel: 'sp',
      entity_level: 'target',
      entity_key: 'sp:target:123',
      action_type: 'update_target_bid',
      before_json: { bid: 0.55 },
      after_json: { bid: 0.7 },
      forecast_json: { expected_clicks_delta: 14 },
    });

    expect(result.errors).toEqual([]);
    expect(result.value.action_type).toBe('update_target_bid');
    expect(result.value.before_json).toEqual({ bid: 0.55 });
    expect(result.value.after_json).toEqual({ bid: 0.7 });
  });

  it('rejects invalid atomic-action enums and non-object before/after payloads', () => {
    const result = validateCreateChangeSetItemPayload({
      channel: 'email',
      entity_level: 'portfolio',
      entity_key: 'bad',
      action_type: 'update_target_bid,update_target_state',
      before_json: 'not-an-object',
      after_json: [],
    });

    expect(result.errors.join(' ')).toMatch(/channel/);
    expect(result.errors.join(' ')).toMatch(/entity_level/);
    expect(result.errors.join(' ')).toMatch(/action_type/);
    expect(result.errors.join(' ')).toMatch(/before_json/);
    expect(result.errors.join(' ')).toMatch(/after_json/);
  });

  it('rejects empty item patches', () => {
    const result = validateUpdateChangeSetItemPayload({});
    expect(result.errors.join(' ')).toMatch(/at least one field/i);
  });

  it('accepts and normalizes objective preset payloads', () => {
    const result = validateCreateObjectivePresetPayload({
      channel: 'sp',
      name: 'Harvest winner',
      objective: 'Scale efficient winners',
      forecast_json: { expected_sales_delta: 250 },
      notes: 'Use for exact-match expansions',
    });

    expect(result.errors).toEqual([]);
    expect(result.value.channel).toBe('sp');
    expect(result.value.forecast_json).toEqual({ expected_sales_delta: 250 });
  });

  it('rejects invalid objective preset payloads', () => {
    const result = validateCreateObjectivePresetPayload({
      channel: 'invalid',
      name: '  ',
      objective: '',
      forecast_json: ['bad'],
    });

    expect(result.errors.join(' ')).toMatch(/channel/);
    expect(result.errors.join(' ')).toMatch(/name/);
    expect(result.errors.join(' ')).toMatch(/objective/);
    expect(result.errors.join(' ')).toMatch(/forecast_json/);
  });
});
