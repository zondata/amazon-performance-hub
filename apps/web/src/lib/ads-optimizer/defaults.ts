import type { AdsOptimizerRulePackPayload } from './types';

export const ADS_OPTIMIZER_DEFAULT_RULE_PACK_NAME = 'SP V1 Default Rule Pack';
export const ADS_OPTIMIZER_DEFAULT_RULE_PACK_DESCRIPTION =
  'Account-level Sponsored Products optimizer configuration foundation for V1.';
export const ADS_OPTIMIZER_DEFAULT_VERSION_LABEL = 'sp_v1_seed';
export const ADS_OPTIMIZER_DEFAULT_CHANGE_SUMMARY =
  'Seeded Phase 2 SP-only config foundation with placeholder role templates, guardrails, scoring weights, and manual approval policy. No engine or execution flow is active yet.';

export const buildDefaultAdsOptimizerRulePackPayload = (): AdsOptimizerRulePackPayload => ({
  schema_version: 1,
  channel: 'sp',
  role_templates: {
    Discover: { enabled: true, notes: 'Placeholder role template for future engine phases.' },
    Harvest: { enabled: true, notes: 'Placeholder role template for future engine phases.' },
    Scale: { enabled: true, notes: 'Placeholder role template for future engine phases.' },
    'Rank Push': { enabled: true, notes: 'Placeholder role template for future engine phases.' },
    'Rank Defend': {
      enabled: true,
      notes: 'Placeholder role template for future engine phases.',
    },
    Suppress: { enabled: true, notes: 'Placeholder role template for future engine phases.' },
  },
  guardrail_templates: {
    default: {
      notes: 'Placeholder guardrail template. Concrete rule resolution arrives in later phases.',
      thresholds: {
        min_clicks_directional: 20,
        min_orders_confirmed: 2,
      },
    },
  },
  scoring_weights: {
    profitability: 1,
    confidence: 1,
    importance: 1,
  },
  state_engine: {
    notes: 'Phase 6 deterministic state-engine thresholds for efficiency, confidence, importance, risk, and opportunity scoring.',
    thresholds: {
      min_clicks_directional: 20,
      min_orders_confirmed: 2,
      min_days_directional: 3,
      min_days_confirmed: 7,
      break_even_gap_tolerance: 0.03,
      dominant_spend_share: 0.35,
      core_spend_share: 0.12,
      dominant_click_velocity: 4,
      core_click_velocity: 1.5,
      dominant_importance_score: 70,
      core_importance_score: 40,
      no_sale_spend_risk: 20,
      no_sale_clicks_risk: 10,
    },
  },
  action_policy: {
    manual_review_required: true,
    auto_execute: false,
    approval_thresholds: {
      bid_changes: 'manual',
      state_changes: 'manual',
      structural_changes: 'manual',
    },
    notes: 'Execution remains outside the optimizer in Phase 2.',
  },
});
