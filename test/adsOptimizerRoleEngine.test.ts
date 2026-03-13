import { describe, expect, it } from 'vitest';

import {
  classifyAdsOptimizerTargetRole,
  readAdsOptimizerTargetRunRole,
} from '../apps/web/src/lib/ads-optimizer/role';

const makeRulePackPayload = (overrides?: Record<string, unknown>) => ({
  schema_version: 2,
  channel: 'sp' as const,
  role_templates: {},
  guardrail_templates: {},
  scoring_weights: {},
  state_engine: {},
  action_policy: {},
  ...(overrides ?? {}),
});

const makePayload = () => ({
  phase: 6,
  totals: {
    clicks: 28,
    spend: 46,
    orders: 3,
    cpc: 1.64,
  },
  derived_metrics: {
    loss_dollars: null,
    profit_dollars: 28,
  },
  product_context: {
    product_objective: 'Scale Profit',
  },
  coverage: {
    notes: [],
  },
  state_engine: {
    engine_version: 'phase6_v1',
    coverage_status: 'ready',
    efficiency: {
      value: 'profitable',
      label: 'Profitable',
      detail: 'positive',
      coverage_status: 'ready',
      reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
    },
    confidence: {
      value: 'confirmed',
      label: 'Confirmed',
      detail: 'confirmed',
      coverage_status: 'ready',
      reason_codes: ['CONFIDENCE_ORDER_THRESHOLD_MET'],
    },
    importance: {
      value: 'tier_1_dominant',
      label: 'Tier 1 dominant',
      detail: 'dominant',
      coverage_status: 'ready',
      reason_codes: ['IMPORTANCE_SCORE_DOMINANT'],
    },
    scores: {
      opportunity: 79,
      risk: 12,
      opportunity_reason_codes: ['OPPORTUNITY_PROFITABLE_BASELINE'],
      risk_reason_codes: ['RISK_PARTIAL_COVERAGE'],
    },
    reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
  },
});

describe('ads optimizer phase 7 role engine', () => {
  it('assigns deterministic desired/current roles and resolved guardrails', () => {
    const payload = makePayload();

    const first = classifyAdsOptimizerTargetRole({
      payload,
      previousRole: 'Harvest',
      archetype: 'hybrid',
      productOverrides: {
        max_bid_increase_per_cycle_pct: 9,
      },
      rulePackPayload: makeRulePackPayload(),
    });
    const second = classifyAdsOptimizerTargetRole({
      payload,
      previousRole: 'Harvest',
      archetype: 'hybrid',
      productOverrides: {
        max_bid_increase_per_cycle_pct: 9,
      },
      rulePackPayload: makeRulePackPayload(),
    });

    expect(first).toEqual(second);
    expect(first.desiredRole.value).toBe('Scale');
    expect(first.currentRole.value).toBe('Scale');
    expect(first.previousRole).toBe('Harvest');
    expect(first.transitionRule).toBe('apply_desired_transition');
    expect(first.guardrails.categories.maxBidIncreasePerCyclePct).toBe(9);
    expect(first.guardrails.flags.requiresManualApproval).toBe(true);
  });

  it('keeps the previous current role when confidence is insufficient', () => {
    const payload = {
      ...makePayload(),
      state_engine: {
        ...makePayload().state_engine,
        confidence: {
          value: 'insufficient',
          label: 'Insufficient',
          detail: 'thin signal',
          coverage_status: 'partial',
          reason_codes: ['CONFIDENCE_ACTIVITY_TOO_THIN'],
        },
      },
    };

    const result = classifyAdsOptimizerTargetRole({
      payload,
      previousRole: 'Rank Push',
      archetype: 'visibility_led',
      productOverrides: null,
      rulePackPayload: makeRulePackPayload(),
    });

    expect(result.desiredRole.value).toBe('Scale');
    expect(result.currentRole.value).toBe('Rank Push');
    expect(result.transitionRule).toBe('defer_low_confidence');
    expect(result.guardrails.flags.transitionLocked).toBe(true);
    expect(result.guardrails.categories.manualApprovalThreshold).toBe('all');
  });

  it('keeps protected shallow-loss contributors in harvest posture instead of suppressing them', () => {
    const payload = {
      ...makePayload(),
      derived_metrics: {
        contribution_after_ads: -12,
        break_even_gap: -0.04,
        loss_dollars: 12,
        profit_dollars: null,
        ad_sales_share: 0.42,
        ad_order_share: 0.38,
        total_sales_share: 0.11,
        loss_to_ad_sales_ratio: 0.08,
        loss_severity: 'shallow',
        protected_contributor: true,
      },
      state_engine: {
        ...makePayload().state_engine,
        efficiency: {
          value: 'converting_but_loss_making',
          label: 'Converting but loss-making',
          detail: 'loss-making',
          coverage_status: 'ready',
          reason_codes: ['EFFICIENCY_NEGATIVE_CONTRIBUTION_AFTER_ADS'],
        },
        importance: {
          value: 'tier_1_dominant',
          label: 'Tier 1 dominant',
          detail: 'dominant contributor',
          coverage_status: 'ready',
          reason_codes: ['IMPORTANCE_DOMINANT_AD_SALES_SHARE'],
        },
      },
    };

    const result = classifyAdsOptimizerTargetRole({
      payload,
      previousRole: 'Harvest',
      archetype: 'hybrid',
      productOverrides: null,
      rulePackPayload: makeRulePackPayload(),
    });

    expect(result.desiredRole.value).toBe('Harvest');
    expect(result.currentRole.value).toBe('Harvest');
    expect(result.desiredRole.reasonCodes).toContain(
      'ROLE_DESIRED_HARVEST_PROTECTED_LOSS_MAKER'
    );
  });

  it('routes protected visibility-led loss-makers into rank defense instead of suppressing them', () => {
    const payload = {
      ...makePayload(),
      derived_metrics: {
        contribution_after_ads: -16,
        break_even_gap: -0.06,
        loss_dollars: 16,
        profit_dollars: null,
        ad_sales_share: 0.36,
        ad_order_share: 0.34,
        total_sales_share: 0.1,
        loss_to_ad_sales_ratio: 0.11,
        loss_severity: 'shallow',
        protected_contributor: true,
      },
      product_context: {
        product_objective: 'Rank Defense',
      },
      state_engine: {
        ...makePayload().state_engine,
        efficiency: {
          value: 'converting_but_loss_making',
          label: 'Converting but loss-making',
          detail: 'loss-making',
          coverage_status: 'ready',
          reason_codes: ['EFFICIENCY_NEGATIVE_CONTRIBUTION_AFTER_ADS'],
        },
        importance: {
          value: 'tier_1_dominant',
          label: 'Tier 1 dominant',
          detail: 'dominant contributor',
          coverage_status: 'ready',
          reason_codes: ['IMPORTANCE_DOMINANT_AD_ORDER_SHARE'],
        },
      },
    };

    const result = classifyAdsOptimizerTargetRole({
      payload,
      previousRole: null,
      archetype: 'visibility_led',
      productOverrides: null,
      rulePackPayload: makeRulePackPayload(),
    });

    expect(result.desiredRole.value).toBe('Rank Defend');
    expect(result.currentRole.value).toBe('Rank Defend');
    expect(result.desiredRole.reasonCodes).toContain(
      'ROLE_DESIRED_RANK_DEFEND_PROTECTED_LOSS_MAKER'
    );
  });

  it('resolves the same protected loss-maker differently under saved strategy profiles', () => {
    const payload = {
      ...makePayload(),
      derived_metrics: {
        contribution_after_ads: -16,
        break_even_gap: -0.06,
        loss_dollars: 16,
        profit_dollars: null,
        ad_sales_share: 0.36,
        ad_order_share: 0.34,
        total_sales_share: 0.1,
        loss_to_ad_sales_ratio: 0.11,
        loss_severity: 'shallow',
        protected_contributor: true,
      },
      state_engine: {
        ...makePayload().state_engine,
        efficiency: {
          value: 'converting_but_loss_making',
          label: 'Converting but loss-making',
          detail: 'loss-making',
          coverage_status: 'ready',
          reason_codes: ['EFFICIENCY_NEGATIVE_CONTRIBUTION_AFTER_ADS'],
        },
        importance: {
          value: 'tier_1_dominant',
          label: 'Tier 1 dominant',
          detail: 'dominant contributor',
          coverage_status: 'ready',
          reason_codes: ['IMPORTANCE_DOMINANT_AD_ORDER_SHARE'],
        },
      },
    };

    const designLed = classifyAdsOptimizerTargetRole({
      payload,
      previousRole: 'Harvest',
      archetype: 'hybrid',
      productOverrides: null,
      rulePackPayload: makeRulePackPayload({
        strategy_profile: 'design_led',
      }),
    });
    const visibilityLed = classifyAdsOptimizerTargetRole({
      payload,
      previousRole: 'Harvest',
      archetype: 'hybrid',
      productOverrides: null,
      rulePackPayload: makeRulePackPayload({
        strategy_profile: 'visibility_led',
        role_bias_policy: {
          visibility_led_rank_defend_bias: true,
        },
      }),
    });

    expect(designLed.desiredRole.value).toBe('Harvest');
    expect(visibilityLed.desiredRole.value).toBe('Rank Defend');
    expect(visibilityLed.desiredRole.reasonCodes).toContain(
      'ROLE_ARCHETYPE_VISIBILITY_LED_PROTECTED_CONTRIBUTOR'
    );
  });

  it('round-trips persisted role-engine payloads', () => {
    const payload = {
      role_engine: {
        engine_version: 'phase7_v1',
        coverage_status: 'ready',
        previous_role: 'Harvest',
        desired_role: {
          value: 'Scale',
          label: 'Scale',
          detail: 'scale',
          coverage_status: 'ready',
          reason_codes: ['ROLE_DESIRED_PROFIT_SCALE'],
        },
        current_role: {
          value: 'Scale',
          label: 'Scale',
          detail: 'scale now',
          coverage_status: 'ready',
          reason_codes: ['CURRENT_ROLE_TRANSITION_APPLIED'],
        },
        transition: {
          rule: 'apply_desired_transition',
          reason_codes: ['CURRENT_ROLE_TRANSITION_APPLIED'],
        },
        guardrails: {
          coverage_status: 'ready',
          categories: {
            no_sale_spend_cap: 20,
            no_sale_click_cap: 12,
            max_loss_per_cycle: 25,
            max_bid_increase_per_cycle_pct: 9,
            max_bid_decrease_per_cycle_pct: 18,
            max_placement_bias_increase_per_cycle_pct: 8,
            rank_push_time_limit_days: 14,
            manual_approval_threshold: 'medium',
            auto_pause_threshold: 40,
            min_bid_floor: 0.2,
            max_bid_ceiling: 3,
          },
          flags: {
            requires_manual_approval: true,
            auto_pause_eligible: false,
            bid_changes_allowed: true,
            placement_changes_allowed: true,
            transition_locked: false,
          },
          reason_codes: ['GUARDRAIL_ROLE_SCALE'],
          notes: ['coverage note'],
        },
        reason_codes: ['ROLE_DESIRED_PROFIT_SCALE', 'CURRENT_ROLE_TRANSITION_APPLIED'],
      },
    };

    const result = readAdsOptimizerTargetRunRole(payload);

    expect(result?.desiredRole.value).toBe('Scale');
    expect(result?.currentRole.value).toBe('Scale');
    expect(result?.guardrails.categories.maxBidIncreasePerCyclePct).toBe(9);
    expect(result?.guardrails.flags.bidChangesAllowed).toBe(true);
  });
});
