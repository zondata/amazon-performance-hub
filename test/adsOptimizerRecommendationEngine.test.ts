import { describe, expect, it } from 'vitest';

import {
  buildAdsOptimizerRecommendationSnapshot,
  classifyAdsOptimizerRecommendations,
  classifyAdsOptimizerRecommendationsBatch,
} from '../apps/web/src/lib/ads-optimizer/recommendation';

const makeRulePackPayload = (overrides?: Record<string, unknown>) => ({
  schema_version: 1,
  channel: 'sp' as const,
  role_templates: {},
  guardrail_templates: {},
  scoring_weights: {},
  state_engine: {},
  action_policy: overrides ?? {},
});

const makePayload = () => ({
  phase: 7,
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
});
