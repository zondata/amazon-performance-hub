import { describe, expect, it } from 'vitest';

import {
  ADS_OPTIMIZER_DEFAULT_CHANGE_SUMMARY,
  buildDefaultAdsOptimizerRulePackPayload,
} from '../apps/web/src/lib/ads-optimizer/defaults';
import {
  validateCreateAdsOptimizerRulePackPayload,
  validateCreateAdsOptimizerRulePackVersionPayload,
  validateSaveAdsOptimizerManualOverridePayload,
  validateSaveAdsOptimizerProductSettingsPayload,
} from '../apps/web/src/lib/ads-optimizer/validation';

describe('ads optimizer config validation', () => {
  it('builds the seeded SP V1 payload with manual review enabled', () => {
    const payload = buildDefaultAdsOptimizerRulePackPayload();

    expect(payload.channel).toBe('sp');
    expect(payload.action_policy['manual_review_required']).toBe(true);
    expect(payload.action_policy['auto_execute']).toBe(false);
    expect(ADS_OPTIMIZER_DEFAULT_CHANGE_SUMMARY).toContain('No engine');
  });

  it('normalizes a rule pack version payload and keeps the payload object intact', () => {
    const value = validateCreateAdsOptimizerRulePackVersionPayload({
      rule_pack_id: 'pack-1',
      version_label: '  sp_v1_tune  ',
      change_summary: '  Adjust placeholder weights  ',
      change_payload_json: buildDefaultAdsOptimizerRulePackPayload(),
      created_from_version_id: 'version-1',
      status: 'draft',
    });

    expect(value.rule_pack_id).toBe('pack-1');
    expect(value.version_label).toBe('sp_v1_tune');
    expect(value.change_summary).toBe('Adjust placeholder weights');
    expect(value.created_from_version_id).toBe('version-1');
    expect(value.change_payload_json.channel).toBe('sp');
  });

  it('rejects scope_value for account-scoped rule packs', () => {
    expect(() =>
      validateCreateAdsOptimizerRulePackPayload({
        channel: 'sp',
        scope_type: 'account',
        scope_value: 'ASIN123',
        name: 'Invalid scope',
      })
    ).toThrow('scope_value must be empty for account-scoped rule packs.');
  });

  it('validates product settings and manual override payloads', () => {
    const productSettings = validateSaveAdsOptimizerProductSettingsPayload({
      product_id: 'product-1',
      archetype: 'hybrid',
      optimizer_enabled: true,
      rule_pack_version_id: 'version-1',
      guardrail_overrides_json: { cap: 10 },
    });

    const override = validateSaveAdsOptimizerManualOverridePayload({
      product_id: 'product-1',
      override_key: 'approval_threshold',
      override_value_json: { bid_changes: 'manual' },
      notes: 'Operator override',
    });

    expect(productSettings.rule_pack_version_id).toBe('version-1');
    expect(productSettings.guardrail_overrides_json).toEqual({ cap: 10 });
    expect(override.override_key).toBe('approval_threshold');
    expect(override.override_value_json).toEqual({ bid_changes: 'manual' });
  });
});
