import { describe, expect, it } from 'vitest';

import {
  buildAdsOptimizerRecommendationSnapshot,
  classifyAdsOptimizerRecommendations,
  classifyAdsOptimizerRecommendationsBatch,
} from '../apps/web/src/lib/ads-optimizer/recommendation';

const makeRulePackPayload = (overrides?: Record<string, unknown>) => {
  const base = {
    schema_version: 2,
    channel: 'sp' as const,
    role_templates: {},
    guardrail_templates: {},
    scoring_weights: {},
    state_engine: {},
    action_policy: {},
  };
  const rawOverrides = { ...(overrides ?? {}) };
  const topLevelKeys = new Set([
    'schema_version',
    'channel',
    'role_templates',
    'guardrail_templates',
    'scoring_weights',
    'state_engine',
    'action_policy',
    'strategy_profile',
    'loss_maker_policy',
    'phased_recovery_policy',
    'role_bias_policy',
  ]);
  const topLevelOverrides = Object.fromEntries(
    Object.entries(rawOverrides).filter(([key]) => topLevelKeys.has(key))
  );
  const legacyActionPolicyOverrides = Object.fromEntries(
    Object.entries(rawOverrides).filter(([key]) => !topLevelKeys.has(key))
  );
  const actionPolicyOverrides =
    typeof topLevelOverrides.action_policy === 'object' &&
    topLevelOverrides.action_policy &&
    !Array.isArray(topLevelOverrides.action_policy)
      ? (topLevelOverrides.action_policy as Record<string, unknown>)
      : null;
  delete topLevelOverrides.action_policy;

  return {
    ...base,
    ...topLevelOverrides,
    action_policy: {
      ...base.action_policy,
      ...legacyActionPolicyOverrides,
      ...(actionPolicyOverrides ?? {}),
    },
  };
};

const makePayload = () => ({
  phase: 7,
  optimizer_context: {
    archetype: 'hybrid',
  },
  identity: {
    campaign_id: 'campaign-1',
    ad_group_id: 'ad-group-1',
    target_id: 'target-1',
    raw_target_id: 'target-1',
    target_text: 'blue widget',
    match_type: 'exact',
    type_label: 'Keyword',
  },
  totals: {
    impressions: 120,
    clicks: 18,
    spend: 28,
    orders: 3,
    sales: 144,
    cpc: 1.56,
    ctr: 0.15,
    cvr: 0.167,
    acos: 0.194,
    roas: 5.14,
  },
  derived_metrics: {
    contribution_after_ads: 20.96,
    break_even_gap: 0.146,
    max_cpc_support_gap: 1.16,
    loss_dollars: null,
    profit_dollars: 20.96,
  },
  placement_context: {
    top_of_search_modifier_pct: 16,
    impressions: 90,
    clicks: 14,
    orders: 3,
    sales: 132,
    spend: 24,
    note: 'Campaign-level placement context only.',
  },
  coverage: {
    statuses: {
      tos_is: 'ready',
      stis: 'ready',
      stir: 'ready',
      placement_context: 'ready',
      search_terms: 'ready',
      break_even_inputs: 'ready',
    },
    notes: ['Coverage note.'],
  },
  search_term_diagnostics: {
    top_terms: [
      {
        search_term: 'blue widget',
        same_text: true,
        impressions: 70,
        clicks: 15,
        orders: 2,
        spend: 11,
        sales: 72,
        stis: 0.2,
        stir: 6,
      },
      {
        search_term: 'blue widget alt',
        same_text: false,
        impressions: 40,
        clicks: 5,
        orders: 1,
        spend: 7,
        sales: 36,
        stis: 0.14,
        stir: 11,
      },
      {
        search_term: 'blue widget waste',
        same_text: false,
        impressions: 60,
        clicks: 7,
        orders: 0,
        spend: 14,
        sales: 0,
        stis: 0.1,
        stir: 18,
      },
    ],
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
      opportunity: 82,
      risk: 18,
      opportunity_reason_codes: ['OPPORTUNITY_PROFITABLE_BASELINE'],
      risk_reason_codes: ['RISK_PARTIAL_COVERAGE'],
    },
    reason_codes: ['EFFICIENCY_POSITIVE_CONTRIBUTION_AFTER_ADS'],
  },
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
        max_bid_increase_per_cycle_pct: 12,
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
      notes: [],
    },
    reason_codes: ['ROLE_DESIRED_PROFIT_SCALE', 'CURRENT_ROLE_TRANSITION_APPLIED'],
  },
  execution_context: {
    snapshot_date: '2026-03-10',
    target: {
      id: 'target-1',
      text: 'blue widget',
      match_type: 'exact',
      is_negative: false,
      current_state: 'enabled',
      current_bid: 1.5,
    },
    campaign: {
      id: 'campaign-1',
      name: 'Campaign 1',
      current_state: 'enabled',
    },
    placement: {
      placement_code: 'PLACEMENT_TOP',
      label: 'Top of search',
      current_percentage: 16,
    },
  },
});

const makeProtectedLossPayload = () => {
  const payload = makePayload();
  payload.totals.cpc = 1.5;
  payload.derived_metrics.contribution_after_ads = -12;
  payload.derived_metrics.break_even_gap = -0.04;
  payload.derived_metrics.max_cpc_supported = 1.05;
  payload.derived_metrics.max_cpc_support_gap = -0.45;
  payload.derived_metrics.loss_dollars = 12;
  payload.derived_metrics.profit_dollars = null;
  payload.derived_metrics.ad_sales_share = 0.42;
  payload.derived_metrics.ad_order_share = 0.38;
  payload.derived_metrics.total_sales_share = 0.11;
  payload.derived_metrics.loss_to_ad_sales_ratio = 0.08;
  payload.derived_metrics.loss_severity = 'shallow';
  payload.derived_metrics.protected_contributor = true;
  payload.execution_context.target.current_bid = 1.8;
  payload.state_engine.efficiency.value = 'converting_but_loss_making';
  payload.state_engine.efficiency.label = 'Converting but loss-making';
  payload.state_engine.efficiency.reason_codes = ['EFFICIENCY_NEGATIVE_CONTRIBUTION_AFTER_ADS'];
  payload.state_engine.importance.value = 'tier_1_dominant';
  payload.state_engine.importance.reason_codes = ['IMPORTANCE_DOMINANT_AD_SALES_SHARE'];
  payload.role_engine.desired_role.value = 'Harvest';
  payload.role_engine.desired_role.label = 'Harvest';
  payload.role_engine.desired_role.reason_codes = ['ROLE_DESIRED_HARVEST_PROTECTED_LOSS_MAKER'];
  payload.role_engine.current_role.value = 'Harvest';
  payload.role_engine.current_role.label = 'Harvest';
  payload.role_engine.current_role.reason_codes = ['CURRENT_ROLE_STABLE'];
  payload.role_engine.reason_codes = ['ROLE_DESIRED_HARVEST_PROTECTED_LOSS_MAKER'];
  return payload;
};

describe('ads optimizer phase 11 recommendation engine', () => {
  it('generates deterministic read-only recommendation sets with diagnostics for the same input', () => {
    const payload = makePayload();

    const first = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload(),
    });
    const second = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload(),
    });

    expect(first).toEqual(second);
    expect(first.status).toBe('generated');
    expect(first.spendDirection).toBe('increase');
    expect(first.primaryActionType).toBe('update_target_bid');
    expect(first.actions.map((action) => action.actionType)).toEqual([
      'update_target_bid',
      'update_placement_modifier',
      'isolate_query_candidate',
      'negative_candidate',
      'change_review_cadence',
    ]);
    expect(first.queryDiagnostics.sameTextQueryPinning.status).toBe('pinned');
    expect(first.queryDiagnostics.isolateCandidates).toHaveLength(1);
    expect(first.queryDiagnostics.negativeCandidates).toHaveLength(1);
    expect(first.placementDiagnostics.biasRecommendation).toBe('stronger');
    expect(first.exceptionSignals.map((signal) => signal.type)).toEqual([
      'guardrail_breach',
      'major_role_change',
    ]);
  });

  it('blocks unsupported actions when current entity context does not support them', () => {
    const payload = makePayload();
    payload.execution_context.target.current_bid = null;
    payload.execution_context.placement.current_percentage = null;
    payload.placement_context.top_of_search_modifier_pct = null;

    const result = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload(),
    });

    expect(result.actions.map((action) => action.actionType)).toEqual([
      'isolate_query_candidate',
      'negative_candidate',
      'change_review_cadence',
    ]);
    expect(result.unsupportedActionBlocks).toContain(
      'BLOCK_UPDATE_TARGET_BID_CURRENT_BID_MISSING'
    );
    expect(result.unsupportedActionBlocks).toContain(
      'BLOCK_UPDATE_PLACEMENT_MODIFIER_CONTEXT_MISSING'
    );
  });

  it('applies ASIN-level portfolio caps across the batch and changes blocked discover output', () => {
    const leadingPayload = makePayload();
    leadingPayload.identity.target_id = 'target-a';
    leadingPayload.identity.raw_target_id = 'target-a';
    leadingPayload.execution_context.target.id = 'target-a';
    leadingPayload.execution_context.target.current_bid = 0.8;
    leadingPayload.role_engine.previous_role = 'Discover';
    leadingPayload.role_engine.desired_role.value = 'Discover';
    leadingPayload.role_engine.desired_role.label = 'Discover';
    leadingPayload.role_engine.current_role.value = 'Discover';
    leadingPayload.role_engine.current_role.label = 'Discover';
    leadingPayload.role_engine.reason_codes = ['ROLE_DISCOVER_ACTIVE'];

    const blockedPayload = makePayload();
    blockedPayload.identity.target_id = 'target-b';
    blockedPayload.identity.raw_target_id = 'target-b';
    blockedPayload.execution_context.target.id = 'target-b';
    blockedPayload.execution_context.target.current_bid = 0.7;
    blockedPayload.state_engine.scores.opportunity = 61;
    blockedPayload.role_engine.previous_role = 'Discover';
    blockedPayload.role_engine.desired_role.value = 'Discover';
    blockedPayload.role_engine.desired_role.label = 'Discover';
    blockedPayload.role_engine.current_role.value = 'Discover';
    blockedPayload.role_engine.current_role.label = 'Discover';
    blockedPayload.role_engine.reason_codes = ['ROLE_DISCOVER_ACTIVE'];

    const result = classifyAdsOptimizerRecommendationsBatch({
      rows: [
        {
          targetSnapshotId: 'snapshot-a',
          targetId: 'target-a',
          payload: leadingPayload,
        },
        {
          targetSnapshotId: 'snapshot-b',
          targetId: 'target-b',
          payload: blockedPayload,
        },
      ],
      rulePackPayload: makeRulePackPayload({
        recommendation_thresholds: {
          max_active_discover_targets: 1,
        },
      }),
    });

    expect(result[0]?.recommendation.portfolioControls.discoverCapBlocked).toBe(false);
    expect(result[0]?.recommendation.spendDirection).toBe('hold');
    expect(result[1]?.recommendation.portfolioControls.discoverCapBlocked).toBe(true);
    expect(result[1]?.recommendation.reasonCodes).toContain('PORTFOLIO_CAP_MAX_ACTIVE_DISCOVER');
    expect(result[1]?.recommendation.reasonCodes).toContain('SPEND_DIRECTION_DISCOVER_CAP_REDUCE');
    expect(result[1]?.recommendation.spendDirection).toBe('reduce');
  });

  it('persists phase 11 snapshot payload fields for diagnostics and read-only boundaries', () => {
    const snapshot = buildAdsOptimizerRecommendationSnapshot({
      targetSnapshotId: 'snapshot-1',
      targetId: 'target-1',
      payload: makePayload(),
      rulePackPayload: makeRulePackPayload(),
    });

    expect(snapshot.status).toBe('generated');
    expect(snapshot.snapshotPayload.phase).toBe(11);
    expect(snapshot.snapshotPayload.execution_boundary).toBe('read_only_recommendation_only');
    expect(snapshot.snapshotPayload.writes_execution_tables).toBe(false);
    expect(snapshot.snapshotPayload.workspace_handoff).toBe('not_started');
    expect(snapshot.snapshotPayload.portfolio_controls).toBeTruthy();
    expect(snapshot.snapshotPayload.query_diagnostics).toBeTruthy();
    expect(snapshot.snapshotPayload.placement_diagnostics).toBeTruthy();
    expect(snapshot.snapshotPayload.exception_signals).toBeTruthy();
  });

  it('creates phased bid-plan metadata for protected loss-making contributors on the first run', () => {
    const payload = makeProtectedLossPayload();

    const snapshot = buildAdsOptimizerRecommendationSnapshot({
      targetSnapshotId: 'snapshot-1',
      targetId: 'target-1',
      payload,
      rulePackPayload: makeRulePackPayload(),
    });

    expect(snapshot.snapshotPayload.phased_bid_plan).toMatchObject({
      strategy_id: 'break_even_bid_ladder_v1:target-1',
      current_step: 1,
      total_steps: 4,
      not_final_bid: true,
      continue_next_run: true,
    });
    expect(snapshot.snapshotPayload.phased_bid_plan.target_break_even_bid).toBeCloseTo(1.26);
    expect(snapshot.snapshotPayload.phased_bid_plan.recommended_next_bid).toBeCloseTo(1.67);
    expect(snapshot.reasonCodes).toContain('PHASED_BID_PLAN_CHOSEN_PROTECTED_LOSS_MAKER');
    expect(snapshot.reasonCodes).toContain('PHASED_BID_PLAN_ARCHETYPE_HYBRID');
    expect(snapshot.reasonCodes).toContain('PHASED_BID_PLAN_NOT_FINAL_BID');
    expect(snapshot.reasonCodes).toContain('PHASED_BID_PLAN_CONTINUE_NEXT_RUN');
    expect(snapshot.snapshotPayload.actions.map((action: { action_type: string }) => action.action_type)).not.toContain(
      'update_target_state'
    );
  });

  it('advances the phased bid plan on the next comparable run after the prior step lands', () => {
    const firstPayload = makeProtectedLossPayload();
    const firstSnapshot = buildAdsOptimizerRecommendationSnapshot({
      targetSnapshotId: 'snapshot-1',
      targetId: 'target-1',
      payload: firstPayload,
      rulePackPayload: makeRulePackPayload(),
    });
    const secondPayload = makeProtectedLossPayload();
    secondPayload.execution_context.target.current_bid = 1.67;

    const result = classifyAdsOptimizerRecommendationsBatch({
      rows: [
        {
          targetSnapshotId: 'snapshot-2',
          targetId: 'target-1',
          payload: secondPayload,
          previousRecommendation: {
            recommendationSnapshotId: 'recommendation-1',
            createdAt: '2026-03-10T00:00:00Z',
            payload: firstSnapshot.snapshotPayload,
          },
        },
      ],
      rulePackPayload: makeRulePackPayload(),
    })[0]!.recommendation;

    expect(result.phasedBidPlan).toMatchObject({
      strategyId: 'break_even_bid_ladder_v1:target-1',
      currentStep: 2,
      totalSteps: 4,
      continueNextRun: true,
    });
    expect(result.reasonCodes).toContain('PHASED_BID_PLAN_ADVANCED_FROM_PRIOR_RUN');
    expect(result.actions.map((action) => action.actionType)).toContain('update_target_bid');
  });

  it('stops the phased plan once the target reaches the estimated break-even bid', () => {
    const firstPayload = makeProtectedLossPayload();
    const firstSnapshot = buildAdsOptimizerRecommendationSnapshot({
      targetSnapshotId: 'snapshot-1',
      targetId: 'target-1',
      payload: firstPayload,
      rulePackPayload: makeRulePackPayload(),
    });
    const settledPayload = makeProtectedLossPayload();
    settledPayload.execution_context.target.current_bid = 1.26;

    const result = classifyAdsOptimizerRecommendationsBatch({
      rows: [
        {
          targetSnapshotId: 'snapshot-3',
          targetId: 'target-1',
          payload: settledPayload,
          previousRecommendation: {
            recommendationSnapshotId: 'recommendation-1',
            createdAt: '2026-03-10T00:00:00Z',
            payload: firstSnapshot.snapshotPayload,
          },
        },
      ],
      rulePackPayload: makeRulePackPayload(),
    })[0]!.recommendation;

    expect(result.spendDirection).toBe('hold');
    expect(result.phasedBidPlan).toMatchObject({
      continueNextRun: false,
      notFinalBid: false,
      exitConditions: ['estimated_break_even_bid_reached'],
    });
    expect(result.reasonCodes).toContain('PHASED_BID_PLAN_STOP_BREAK_EVEN_REACHED');
  });

  it('still stages a pause for low-contribution severe loss-makers', () => {
    const payload = makePayload();
    payload.totals.orders = 1;
    payload.totals.sales = 30;
    payload.derived_metrics.contribution_after_ads = -18;
    payload.derived_metrics.break_even_gap = -0.22;
    payload.derived_metrics.loss_dollars = 18;
    payload.derived_metrics.profit_dollars = null;
    payload.derived_metrics.ad_sales_share = 0.05;
    payload.derived_metrics.ad_order_share = 0.08;
    payload.derived_metrics.total_sales_share = 0.01;
    payload.derived_metrics.loss_to_ad_sales_ratio = 0.6;
    payload.derived_metrics.loss_severity = 'severe';
    payload.derived_metrics.protected_contributor = false;
    payload.state_engine.efficiency.value = 'converting_but_loss_making';
    payload.state_engine.efficiency.label = 'Converting but loss-making';
    payload.state_engine.efficiency.reason_codes = ['EFFICIENCY_NEGATIVE_CONTRIBUTION_AFTER_ADS'];
    payload.state_engine.risk_reason_codes = ['RISK_LOSS_SEVERITY_SEVERE'];
    payload.state_engine.scores.risk = 88;
    payload.role_engine.desired_role.value = 'Suppress';
    payload.role_engine.desired_role.label = 'Suppress';
    payload.role_engine.desired_role.reason_codes = ['ROLE_DESIRED_SUPPRESS_SEVERE_LOSS_MAKING'];
    payload.role_engine.current_role.value = 'Suppress';
    payload.role_engine.current_role.label = 'Suppress';
    payload.role_engine.current_role.reason_codes = ['CURRENT_ROLE_SUPPRESS_IMMEDIATE'];
    payload.role_engine.guardrails.flags.auto_pause_eligible = true;
    payload.role_engine.reason_codes = ['ROLE_DESIRED_SUPPRESS_SEVERE_LOSS_MAKING'];

    const result = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload(),
    });

    expect(result.spendDirection).toBe('stop');
    expect(result.reasonCodes).toContain('SPEND_DIRECTION_STOP_SUPPRESS_AUTO_PAUSE');
    expect(result.actions.map((action) => action.actionType)).toContain('update_target_state');
  });

  it('changes phased recovery behavior for the same payload under different saved strategy profiles', () => {
    const payload = makeProtectedLossPayload();
    payload.optimizer_context.archetype = 'hybrid';
    payload.role_engine.desired_role.value = 'Rank Defend';
    payload.role_engine.desired_role.label = 'Rank Defend';
    payload.role_engine.desired_role.reason_codes = [
      'ROLE_DESIRED_RANK_DEFEND_PROTECTED_LOSS_MAKER',
      'ROLE_ARCHETYPE_VISIBILITY_LED_PROTECTED_CONTRIBUTOR',
    ];
    payload.role_engine.current_role.value = 'Rank Defend';
    payload.role_engine.current_role.label = 'Rank Defend';
    payload.role_engine.reason_codes = [
      'ROLE_DESIRED_RANK_DEFEND_PROTECTED_LOSS_MAKER',
      'ROLE_ARCHETYPE_VISIBILITY_LED_PROTECTED_CONTRIBUTOR',
    ];

    const visibilityLed = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload({
        strategy_profile: 'visibility_led',
        phased_recovery_policy: {
          visibility_led_steps: 6,
        },
        role_bias_policy: {
          visibility_led_rank_defend_bias: true,
        },
      }),
    });
    const designLed = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload({
        strategy_profile: 'design_led',
        phased_recovery_policy: {
          design_led_steps: 2,
        },
      }),
    });

    expect(visibilityLed.phasedBidPlan?.totalSteps).toBe(6);
    expect(designLed.phasedBidPlan?.totalSteps).toBe(4);
    expect(visibilityLed.reasonCodes).toContain(
      'PHASED_BID_PLAN_ARCHETYPE_VISIBILITY_LED_GRADUAL'
    );
    expect(designLed.reasonCodes).toContain('PHASED_BID_PLAN_ARCHETYPE_DESIGN_LED_FASTER');
    expect(visibilityLed.placementDiagnostics.biasRecommendation).toBe('hold');
  });

  it('changes long-tail spend direction for the same payload under different saved rule payloads', () => {
    const payload = makePayload();
    payload.optimizer_context.archetype = 'hybrid';
    payload.state_engine.efficiency.value = 'break_even';
    payload.state_engine.efficiency.label = 'Break even';
    payload.state_engine.confidence.value = 'directional';
    payload.state_engine.confidence.label = 'Directional';
    payload.state_engine.importance.value = 'tier_3_test_long_tail';
    payload.state_engine.importance.label = 'Tier 3 test long-tail';
    payload.role_engine.current_role.value = 'Harvest';
    payload.role_engine.current_role.label = 'Harvest';
    payload.role_engine.desired_role.value = 'Harvest';
    payload.role_engine.desired_role.label = 'Harvest';

    const designLed = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload({
        strategy_profile: 'design_led',
        role_bias_policy: {
          design_led_long_tail_suppress_bias: true,
        },
      }),
    });
    const hybrid = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload({
        strategy_profile: 'hybrid',
        role_bias_policy: {
          design_led_long_tail_suppress_bias: false,
        },
      }),
    });

    expect(designLed.spendDirection).toBe('collapse');
    expect(designLed.reasonCodes).toContain('SPEND_DIRECTION_COLLAPSE_DESIGN_LED_LONG_TAIL');
    expect(hybrid.spendDirection).toBe('reduce');
  });

  it('can pause protected contributors instead of continuing the phased recovery ladder', () => {
    const payload = makeProtectedLossPayload();

    const defaultResult = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload(),
    });
    const pausedResult = classifyAdsOptimizerRecommendations({
      payload,
      rulePackPayload: makeRulePackPayload({
        loss_maker_policy: {
          pause_protected_contributors: true,
        },
      }),
    });

    expect(defaultResult.phasedBidPlan?.continueNextRun).toBe(true);
    expect(defaultResult.spendDirection).toBe('reduce');
    expect(pausedResult.phasedBidPlan).toBeNull();
    expect(pausedResult.spendDirection).toBe('collapse');
    expect(pausedResult.reasonCodes).toContain(
      'SPEND_DIRECTION_COLLAPSE_PROTECTED_LOSS_CONTRIBUTOR_POLICY'
    );
  });
});
