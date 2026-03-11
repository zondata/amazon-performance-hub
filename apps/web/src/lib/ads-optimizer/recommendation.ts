import type { AdsOptimizerRulePackPayload, JsonObject as RulePackJsonObject } from './types';
import type { JsonObject as RuntimeJsonObject } from './runtimeTypes';
import { readAdsOptimizerTargetRunRole } from './role';
import { readAdsOptimizerTargetRunState } from './state';

export const ADS_OPTIMIZER_SPEND_DIRECTIONS = [
  'increase',
  'hold',
  'reduce',
  'collapse',
  'stop',
] as const;

export const ADS_OPTIMIZER_RECOMMENDATION_ACTION_TYPES = [
  'update_target_bid',
  'update_target_state',
  'update_placement_modifier',
  'isolate_query_candidate',
  'negative_candidate',
  'change_review_cadence',
] as const;

export type AdsOptimizerSpendDirection =
  (typeof ADS_OPTIMIZER_SPEND_DIRECTIONS)[number];
export type AdsOptimizerRecommendationActionType =
  (typeof ADS_OPTIMIZER_RECOMMENDATION_ACTION_TYPES)[number];

export type AdsOptimizerRecommendationAction = {
  actionType: AdsOptimizerRecommendationActionType;
  priority: number;
  entityContext: RuntimeJsonObject;
  proposedChange: RuntimeJsonObject;
  reasonCodes: string[];
  supportingMetrics: RuntimeJsonObject;
};

export type AdsOptimizerRecommendationSet = {
  engineVersion: string;
  status: 'generated' | 'skipped';
  spendDirection: AdsOptimizerSpendDirection | null;
  primaryActionType: AdsOptimizerRecommendationActionType | null;
  reasonCodes: string[];
  coverageFlags: string[];
  confidenceNotes: string[];
  unsupportedActionBlocks: string[];
  actions: AdsOptimizerRecommendationAction[];
  supportingMetrics: RuntimeJsonObject;
};

export type AdsOptimizerRecommendationSnapshotActionView = {
  actionType: AdsOptimizerRecommendationActionType;
  priority: number | null;
  entityContext: RuntimeJsonObject | null;
  proposedChange: RuntimeJsonObject | null;
  reasonCodes: string[];
  supportingMetrics: RuntimeJsonObject | null;
};

export type AdsOptimizerRecommendationSnapshotView = {
  recommendationSnapshotId: string;
  targetSnapshotId: string;
  createdAt: string;
  status: 'pending_phase5' | 'generated' | 'skipped';
  actionType: string | null;
  spendDirection: AdsOptimizerSpendDirection | null;
  primaryActionType: AdsOptimizerRecommendationActionType | null;
  actionCount: number;
  reasonCodes: string[];
  coverageFlags: string[];
  confidenceNotes: string[];
  unsupportedActionBlocks: string[];
  executionBoundary: string | null;
  workspaceHandoff: string | null;
  writesExecutionTables: boolean | null;
  manualReviewRequired: boolean | null;
  outputState: string | null;
  supportingMetrics: RuntimeJsonObject | null;
  actions: AdsOptimizerRecommendationSnapshotActionView[];
};

type RecommendationConfig = {
  isolateQueryClicksMin: number;
  negativeQueryClicksMin: number;
  negativeQuerySpendMin: number;
  increaseOpportunityGap: number;
  reduceRiskGap: number;
};

type SearchTermDiagnostic = {
  searchTerm: string;
  sameText: boolean;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  sales: number;
  stis: number | null;
  stir: number | null;
};

const RECOMMENDATION_ENGINE_VERSION = 'phase8_v1';
const ACTION_PRIORITY: Record<AdsOptimizerRecommendationActionType, number> = {
  update_target_state: 10,
  update_target_bid: 20,
  update_placement_modifier: 30,
  isolate_query_candidate: 40,
  negative_candidate: 50,
  change_review_cadence: 60,
};

const DEFAULT_RECOMMENDATION_CONFIG: RecommendationConfig = {
  isolateQueryClicksMin: 4,
  negativeQueryClicksMin: 6,
  negativeQuerySpendMin: 12,
  increaseOpportunityGap: 10,
  reduceRiskGap: 8,
};

const asJsonObject = (value: unknown): RuntimeJsonObject | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as RuntimeJsonObject;
};

const readStringArray = (value: RuntimeJsonObject | null, key: string) => {
  const raw = value?.[key];
  return Array.isArray(raw) ? raw.filter((entry): entry is string => typeof entry === 'string') : [];
};

const readNumber = (value: RuntimeJsonObject | RulePackJsonObject | null, key: string) => {
  const raw = value?.[key];
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const readString = (value: RuntimeJsonObject | RulePackJsonObject | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readBoolean = (value: RuntimeJsonObject | null, key: string) =>
  typeof value?.[key] === 'boolean' ? (value[key] as boolean) : null;

const withUnique = (values: string[]) => [...new Set(values)];

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const normalizeState = (value: string | null) => {
  const normalized = value?.trim().toLowerCase() ?? null;
  return normalized && normalized.length > 0 ? normalized : null;
};

const readRecommendationConfig = (
  rulePackPayload: AdsOptimizerRulePackPayload | null | undefined
): RecommendationConfig => {
  const actionPolicy = asJsonObject(rulePackPayload?.action_policy ?? null);
  const thresholds = asJsonObject(actionPolicy?.recommendation_thresholds);

  return {
    isolateQueryClicksMin:
      readNumber(thresholds, 'isolate_query_clicks_min') ??
      DEFAULT_RECOMMENDATION_CONFIG.isolateQueryClicksMin,
    negativeQueryClicksMin:
      readNumber(thresholds, 'negative_query_clicks_min') ??
      DEFAULT_RECOMMENDATION_CONFIG.negativeQueryClicksMin,
    negativeQuerySpendMin:
      readNumber(thresholds, 'negative_query_spend_min') ??
      DEFAULT_RECOMMENDATION_CONFIG.negativeQuerySpendMin,
    increaseOpportunityGap:
      readNumber(thresholds, 'increase_opportunity_gap') ??
      DEFAULT_RECOMMENDATION_CONFIG.increaseOpportunityGap,
    reduceRiskGap:
      readNumber(thresholds, 'reduce_risk_gap') ??
      DEFAULT_RECOMMENDATION_CONFIG.reduceRiskGap,
  };
};

const readSearchTerms = (payload: RuntimeJsonObject): SearchTermDiagnostic[] => {
  const searchTermDiagnostics = asJsonObject(payload.search_term_diagnostics);
  const topTerms = Array.isArray(searchTermDiagnostics?.top_terms)
    ? searchTermDiagnostics.top_terms
    : [];

  return topTerms
    .map((entry) => asJsonObject(entry))
    .filter((entry): entry is RuntimeJsonObject => entry !== null)
    .map((entry) => ({
      searchTerm: readString(entry, 'search_term') ?? '—',
      sameText: readBoolean(entry, 'same_text') ?? false,
      impressions: readNumber(entry, 'impressions') ?? 0,
      clicks: readNumber(entry, 'clicks') ?? 0,
      orders: readNumber(entry, 'orders') ?? 0,
      spend: readNumber(entry, 'spend') ?? 0,
      sales: readNumber(entry, 'sales') ?? 0,
      stis: readNumber(entry, 'stis'),
      stir: readNumber(entry, 'stir'),
    }));
};

const readExecutionContext = (payload: RuntimeJsonObject) => {
  const executionContext = asJsonObject(payload.execution_context);
  const target = asJsonObject(executionContext?.target);
  const campaign = asJsonObject(executionContext?.campaign);
  const placement = asJsonObject(executionContext?.placement);
  const identity = asJsonObject(payload.identity);
  const placementContext = asJsonObject(payload.placement_context);

  return {
    snapshotDate: readString(executionContext, 'snapshot_date'),
    target: {
      targetId:
        readString(target, 'id') ??
        readString(identity, 'raw_target_id') ??
        readString(identity, 'target_id'),
      currentState: normalizeState(readString(target, 'current_state')),
      currentBid: readNumber(target, 'current_bid'),
      isNegative: Boolean(readBoolean(target, 'is_negative')),
      matchType: readString(target, 'match_type') ?? readString(identity, 'match_type'),
      text: readString(target, 'text') ?? readString(identity, 'target_text'),
      typeLabel: readString(identity, 'type_label'),
    },
    campaign: {
      campaignId: readString(campaign, 'id') ?? readString(identity, 'campaign_id'),
      currentState: normalizeState(readString(campaign, 'current_state')),
      name: readString(campaign, 'name') ?? readString(identity, 'campaign_name'),
    },
    placement: {
      placementCode: readString(placement, 'placement_code') ?? 'PLACEMENT_TOP',
      label: readString(placement, 'label') ?? 'Top of search',
      currentPercentage:
        readNumber(placement, 'current_percentage') ??
        readNumber(placementContext, 'top_of_search_modifier_pct'),
    },
  };
};

const buildCoverageFlags = (payload: RuntimeJsonObject): string[] => {
  const flags: string[] = [];
  const coverage = asJsonObject(payload.coverage);
  const statuses = asJsonObject(coverage?.statuses);
  const state = readAdsOptimizerTargetRunState(payload);
  const role = readAdsOptimizerTargetRunRole(payload);
  const execution = readExecutionContext(payload);

  const statusEntries = [
    ['tos_is', readString(statuses, 'tos_is')],
    ['stis', readString(statuses, 'stis')],
    ['stir', readString(statuses, 'stir')],
    ['placement_context', readString(statuses, 'placement_context')],
    ['search_terms', readString(statuses, 'search_terms')],
    ['break_even_inputs', readString(statuses, 'break_even_inputs')],
  ] as const;

  statusEntries.forEach(([key, status]) => {
    if (status === 'partial') flags.push(`COVERAGE_${key.toUpperCase()}_PARTIAL`);
    if (status === 'missing') flags.push(`COVERAGE_${key.toUpperCase()}_MISSING`);
  });

  if (state?.coverageStatus === 'partial') flags.push('STATE_SIGNAL_PARTIAL');
  if (state?.coverageStatus === 'missing') flags.push('STATE_SIGNAL_MISSING');
  if (role?.guardrails.flags.transitionLocked) flags.push('ROLE_TRANSITION_LOCKED');
  if (role?.guardrails.flags.requiresManualApproval) flags.push('MANUAL_APPROVAL_REQUIRED');
  if (!execution.snapshotDate) flags.push('CURRENT_BULK_CONTEXT_UNAVAILABLE');

  return withUnique(flags);
};

export const readAdsOptimizerRecommendationSnapshotView = (snapshot: {
  recommendation_snapshot_id: string;
  target_snapshot_id: string;
  created_at: string;
  status: 'pending_phase5' | 'generated' | 'skipped';
  action_type: string | null;
  snapshot_payload_json: RuntimeJsonObject;
}) : AdsOptimizerRecommendationSnapshotView => {
  const payload = asJsonObject(snapshot.snapshot_payload_json) ?? {};
  const actions = Array.isArray(payload.actions) ? payload.actions : [];

  return {
    recommendationSnapshotId: snapshot.recommendation_snapshot_id,
    targetSnapshotId: snapshot.target_snapshot_id,
    createdAt: snapshot.created_at,
    status: snapshot.status,
    actionType: snapshot.action_type,
    spendDirection: (readString(payload, 'spend_direction') as AdsOptimizerSpendDirection | null) ?? null,
    primaryActionType:
      (readString(payload, 'primary_action_type') as AdsOptimizerRecommendationActionType | null) ?? null,
    actionCount: readNumber(payload, 'action_count') ?? 0,
    reasonCodes: readStringArray(payload, 'reason_codes'),
    coverageFlags: readStringArray(payload, 'coverage_flags'),
    confidenceNotes: readStringArray(payload, 'confidence_notes'),
    unsupportedActionBlocks: readStringArray(payload, 'unsupported_action_blocks'),
    executionBoundary: readString(payload, 'execution_boundary'),
    workspaceHandoff: readString(payload, 'workspace_handoff'),
    writesExecutionTables: readBoolean(payload, 'writes_execution_tables'),
    manualReviewRequired: readBoolean(payload, 'manual_review_required'),
    outputState: readString(payload, 'output_state'),
    supportingMetrics: asJsonObject(payload.supporting_metrics),
    actions: actions
      .map((entry) => asJsonObject(entry))
      .filter((entry): entry is RuntimeJsonObject => entry !== null)
      .map((entry) => ({
        actionType:
          (readString(entry, 'action_type') as AdsOptimizerRecommendationActionType | null) ??
          'change_review_cadence',
        priority: readNumber(entry, 'priority'),
        entityContext: asJsonObject(entry.entity_context),
        proposedChange: asJsonObject(entry.proposed_change),
        reasonCodes: readStringArray(entry, 'reason_codes'),
        supportingMetrics: asJsonObject(entry.supporting_metrics),
      })),
  };
};

const buildConfidenceNotes = (payload: RuntimeJsonObject): string[] => {
  const notes: string[] = [];
  const coverage = asJsonObject(payload.coverage);
  const coverageNotes = Array.isArray(coverage?.notes)
    ? coverage.notes.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const state = readAdsOptimizerTargetRunState(payload);

  if (state?.confidence.value === 'confirmed') {
    notes.push('Confirmed signal: order and observation thresholds were met for this run window.');
  } else if (state?.confidence.value === 'directional') {
    notes.push('Directional signal only: keep spend changes bounded and review outcomes before compounding.');
  } else {
    notes.push('Insufficient signal: prefer protective monitoring over aggressive spend expansion.');
  }

  if (state?.coverageStatus === 'partial') {
    notes.push('Coverage is partial for this target snapshot, so recommendations stay conservative.');
  }
  if (state?.coverageStatus === 'missing') {
    notes.push('Target coverage is missing for required inputs; only minimal read-only guidance was emitted.');
  }

  coverageNotes.slice(0, 3).forEach((note) => notes.push(note));
  return withUnique(notes);
};

const determineSpendDirection = (payload: RuntimeJsonObject, config: RecommendationConfig) => {
  const state = readAdsOptimizerTargetRunState(payload);
  const role = readAdsOptimizerTargetRunRole(payload);
  const derived = asJsonObject(payload.derived_metrics);
  const totals = asJsonObject(payload.totals);

  if (!state || !role?.currentRole.value) {
    return {
      value: null,
      reasonCodes: ['RECOMMENDATION_PREREQUISITES_MISSING'],
    };
  }

  const lossDollars = readNumber(derived, 'loss_dollars') ?? 0;
  const spend = readNumber(totals, 'spend') ?? 0;
  const clicks = readNumber(totals, 'clicks') ?? 0;
  const orders = readNumber(totals, 'orders') ?? 0;
  const autoPauseThreshold = role.guardrails.categories.autoPauseThreshold ?? Number.POSITIVE_INFINITY;
  const noSaleSpendCap = role.guardrails.categories.noSaleSpendCap ?? Number.POSITIVE_INFINITY;
  const noSaleClickCap = role.guardrails.categories.noSaleClickCap ?? Number.POSITIVE_INFINITY;
  const severeLoss = lossDollars >= (role.guardrails.categories.maxLossPerCycle ?? Number.POSITIVE_INFINITY);
  const noSaleCapBreached =
    (state.efficiency.value === 'learning_no_sale' || orders <= 0) &&
    (spend >= noSaleSpendCap || clicks >= noSaleClickCap);

  if (
    role.currentRole.value === 'Suppress' &&
    (role.guardrails.flags.autoPauseEligible || spend >= autoPauseThreshold || severeLoss)
  ) {
    return {
      value: 'stop' as const,
      reasonCodes: ['SPEND_DIRECTION_STOP_SUPPRESS_AUTO_PAUSE'],
    };
  }

  if (
    role.currentRole.value === 'Suppress' ||
    severeLoss ||
    noSaleCapBreached ||
    state.riskScore >= 80
  ) {
    return {
      value: 'collapse' as const,
      reasonCodes: ['SPEND_DIRECTION_COLLAPSE_RISK_ENVELOPE'],
    };
  }

  if (
    state.efficiency.value === 'break_even' ||
    state.efficiency.value === 'converting_but_loss_making' ||
    state.riskScore >= state.opportunityScore + config.reduceRiskGap ||
    state.confidence.value === 'insufficient'
  ) {
    return {
      value: 'reduce' as const,
      reasonCodes: ['SPEND_DIRECTION_REDUCE_PROTECTIVE'],
    };
  }

  if (
    (role.currentRole.value === 'Scale' || role.currentRole.value === 'Rank Push') &&
    state.confidence.value === 'confirmed' &&
    state.opportunityScore >= state.riskScore + config.increaseOpportunityGap &&
    !role.guardrails.flags.transitionLocked
  ) {
    return {
      value: 'increase' as const,
      reasonCodes:
        role.currentRole.value === 'Scale'
          ? ['SPEND_DIRECTION_INCREASE_SCALE_HEADROOM']
          : ['SPEND_DIRECTION_INCREASE_RANK_PUSH'],
    };
  }

  return {
    value: 'hold' as const,
    reasonCodes: ['SPEND_DIRECTION_HOLD_STABLE'],
  };
};

const buildAction = (args: {
  actionType: AdsOptimizerRecommendationActionType;
  entityContext: RuntimeJsonObject;
  proposedChange: RuntimeJsonObject;
  reasonCodes: string[];
  supportingMetrics: RuntimeJsonObject;
}): AdsOptimizerRecommendationAction => ({
  actionType: args.actionType,
  priority: ACTION_PRIORITY[args.actionType],
  entityContext: args.entityContext,
  proposedChange: args.proposedChange,
  reasonCodes: withUnique(args.reasonCodes),
  supportingMetrics: args.supportingMetrics,
});

const isKeywordTarget = (payload: RuntimeJsonObject, execution = readExecutionContext(payload)) => {
  const typeLabel = execution.target.typeLabel?.toLowerCase() ?? '';
  const matchType = execution.target.matchType?.toUpperCase() ?? '';
  return !typeLabel.includes('product') && matchType !== 'TARGETING_EXPRESSION';
};

const buildRecommendationActions = (args: {
  payload: RuntimeJsonObject;
  spendDirection: AdsOptimizerSpendDirection;
  config: RecommendationConfig;
}) => {
  const actions: AdsOptimizerRecommendationAction[] = [];
  const reasonCodes: string[] = [];
  const unsupportedActionBlocks: string[] = [];
  const state = readAdsOptimizerTargetRunState(args.payload);
  const role = readAdsOptimizerTargetRunRole(args.payload);
  const execution = readExecutionContext(args.payload);
  const searchTerms = readSearchTerms(args.payload);
  const identity = asJsonObject(args.payload.identity);
  const totals = asJsonObject(args.payload.totals);
  const derived = asJsonObject(args.payload.derived_metrics);

  if (!state || !role?.currentRole.value) {
    return {
      actions: [],
      reasonCodes: ['RECOMMENDATION_PREREQUISITES_MISSING'],
      unsupportedActionBlocks: ['BLOCK_RECOMMENDATION_PREREQUISITES_MISSING'],
    };
  }

  const supportingMetrics = {
    current_role: role.currentRole.value,
    desired_role: role.desiredRole.value,
    efficiency: state.efficiency.value,
    confidence: state.confidence.value,
    importance: state.importance.value,
    opportunity_score: state.opportunityScore,
    risk_score: state.riskScore,
    clicks: readNumber(totals, 'clicks') ?? 0,
    spend: readNumber(totals, 'spend') ?? 0,
    orders: readNumber(totals, 'orders') ?? 0,
    sales: readNumber(totals, 'sales') ?? 0,
    break_even_gap: readNumber(derived, 'break_even_gap'),
    loss_dollars: readNumber(derived, 'loss_dollars'),
    profit_dollars: readNumber(derived, 'profit_dollars'),
  } satisfies RuntimeJsonObject;

  if (args.spendDirection === 'stop') {
    if (!execution.target.currentState) {
      unsupportedActionBlocks.push('BLOCK_UPDATE_TARGET_STATE_CURRENT_STATE_MISSING');
    } else if (execution.target.currentState !== 'paused') {
      actions.push(
        buildAction({
          actionType: 'update_target_state',
          entityContext: {
            target_id: execution.target.targetId,
            campaign_id: execution.campaign.campaignId,
            current_state: execution.target.currentState,
          },
          proposedChange: {
            next_state: 'paused',
          },
          reasonCodes: ['ACTION_UPDATE_TARGET_STATE_PAUSE', 'READ_ONLY_RECOMMENDATION_ONLY'],
          supportingMetrics,
        })
      );
      reasonCodes.push('ACTION_UPDATE_TARGET_STATE_PAUSE');
    }
  }

  if (
    (args.spendDirection === 'increase' ||
      args.spendDirection === 'reduce' ||
      args.spendDirection === 'collapse') &&
    !execution.target.isNegative
  ) {
    if (!role.guardrails.flags.bidChangesAllowed) {
      unsupportedActionBlocks.push('BLOCK_UPDATE_TARGET_BID_GUARDRAIL_DISALLOWS');
    } else if (execution.target.currentBid === null) {
      unsupportedActionBlocks.push('BLOCK_UPDATE_TARGET_BID_CURRENT_BID_MISSING');
    } else if (execution.target.currentState === 'paused') {
      unsupportedActionBlocks.push('BLOCK_UPDATE_TARGET_BID_TARGET_PAUSED');
    } else {
      const increasePct = role.guardrails.categories.maxBidIncreasePerCyclePct ?? 0;
      const decreasePct = role.guardrails.categories.maxBidDecreasePerCyclePct ?? 0;
      const appliedPct =
        args.spendDirection === 'increase'
          ? increasePct
          : args.spendDirection === 'collapse'
            ? decreasePct
            : Math.max(5, Math.round(decreasePct / 2));
      const multiplier =
        args.spendDirection === 'increase'
          ? 1 + appliedPct / 100
          : 1 - appliedPct / 100;
      const unclamped = execution.target.currentBid * multiplier;
      const nextBid = roundCurrency(
        Math.min(
          role.guardrails.categories.maxBidCeiling ?? unclamped,
          Math.max(role.guardrails.categories.minBidFloor ?? unclamped, unclamped)
        )
      );

      if (nextBid !== execution.target.currentBid) {
        actions.push(
          buildAction({
            actionType: 'update_target_bid',
            entityContext: {
              target_id: execution.target.targetId,
              campaign_id: execution.campaign.campaignId,
              current_bid: execution.target.currentBid,
              target_text: execution.target.text,
            },
            proposedChange: {
              next_bid: nextBid,
              delta_pct:
                execution.target.currentBid > 0
                  ? roundCurrency(((nextBid - execution.target.currentBid) / execution.target.currentBid) * 100)
                  : null,
            },
            reasonCodes: [
              args.spendDirection === 'increase'
                ? 'ACTION_UPDATE_TARGET_BID_INCREASE'
                : args.spendDirection === 'collapse'
                  ? 'ACTION_UPDATE_TARGET_BID_COLLAPSE'
                  : 'ACTION_UPDATE_TARGET_BID_REDUCE',
              'READ_ONLY_RECOMMENDATION_ONLY',
            ],
            supportingMetrics,
          })
        );
        reasonCodes.push(
          args.spendDirection === 'increase'
            ? 'ACTION_UPDATE_TARGET_BID_INCREASE'
            : args.spendDirection === 'collapse'
              ? 'ACTION_UPDATE_TARGET_BID_COLLAPSE'
              : 'ACTION_UPDATE_TARGET_BID_REDUCE'
        );
      }
    }
  }

  if (
    (args.spendDirection === 'increase' ||
      args.spendDirection === 'reduce' ||
      args.spendDirection === 'collapse') &&
    (role.currentRole.value === 'Scale' ||
      role.currentRole.value === 'Rank Push' ||
      role.currentRole.value === 'Suppress')
  ) {
    if (!role.guardrails.flags.placementChangesAllowed) {
      unsupportedActionBlocks.push('BLOCK_UPDATE_PLACEMENT_MODIFIER_GUARDRAIL_DISALLOWS');
    } else if (execution.placement.currentPercentage === null) {
      unsupportedActionBlocks.push('BLOCK_UPDATE_PLACEMENT_MODIFIER_CONTEXT_MISSING');
    } else {
      const currentPct = execution.placement.currentPercentage;
      const deltaPct = role.guardrails.categories.maxPlacementBiasIncreasePerCyclePct ?? 0;
      const nextPct =
        args.spendDirection === 'increase'
          ? currentPct + deltaPct
          : args.spendDirection === 'collapse'
            ? 0
            : Math.max(0, currentPct - deltaPct);

      if (nextPct !== currentPct) {
        actions.push(
          buildAction({
            actionType: 'update_placement_modifier',
            entityContext: {
              campaign_id: execution.campaign.campaignId,
              placement_code: execution.placement.placementCode,
              current_percentage: currentPct,
            },
            proposedChange: {
              next_percentage: nextPct,
            },
            reasonCodes: [
              args.spendDirection === 'increase'
                ? 'ACTION_UPDATE_PLACEMENT_MODIFIER_INCREASE'
                : args.spendDirection === 'collapse'
                  ? 'ACTION_UPDATE_PLACEMENT_MODIFIER_COLLAPSE'
                  : 'ACTION_UPDATE_PLACEMENT_MODIFIER_REDUCE',
              'READ_ONLY_RECOMMENDATION_ONLY',
            ],
            supportingMetrics,
          })
        );
        reasonCodes.push(
          args.spendDirection === 'increase'
            ? 'ACTION_UPDATE_PLACEMENT_MODIFIER_INCREASE'
            : args.spendDirection === 'collapse'
              ? 'ACTION_UPDATE_PLACEMENT_MODIFIER_COLLAPSE'
              : 'ACTION_UPDATE_PLACEMENT_MODIFIER_REDUCE'
        );
      }
    }
  }

  if (!execution.target.isNegative && isKeywordTarget(args.payload, execution)) {
    const isolateCandidate =
      searchTerms.find(
        (term) =>
          !term.sameText &&
          term.clicks >= args.config.isolateQueryClicksMin &&
          (term.orders > 0 || term.sales > term.spend)
      ) ?? null;
    if (isolateCandidate) {
      actions.push(
        buildAction({
          actionType: 'isolate_query_candidate',
          entityContext: {
            campaign_id: execution.campaign.campaignId,
            ad_group_id: readString(identity, 'ad_group_id'),
            target_id: execution.target.targetId,
            search_term: isolateCandidate.searchTerm,
          },
          proposedChange: {
            candidate: 'create_isolated_query_target',
          },
          reasonCodes: ['ACTION_ISOLATE_QUERY_CANDIDATE', 'READ_ONLY_RECOMMENDATION_ONLY'],
          supportingMetrics: {
            ...supportingMetrics,
            search_term_clicks: isolateCandidate.clicks,
            search_term_orders: isolateCandidate.orders,
            search_term_sales: isolateCandidate.sales,
          },
        })
      );
      reasonCodes.push('ACTION_ISOLATE_QUERY_CANDIDATE');
    }

    const negativeCandidate =
      searchTerms.find(
        (term) =>
          !term.sameText &&
          term.orders <= 0 &&
          term.clicks >= args.config.negativeQueryClicksMin &&
          term.spend >= args.config.negativeQuerySpendMin
      ) ?? null;
    if (negativeCandidate) {
      actions.push(
        buildAction({
          actionType: 'negative_candidate',
          entityContext: {
            campaign_id: execution.campaign.campaignId,
            ad_group_id: readString(identity, 'ad_group_id'),
            target_id: execution.target.targetId,
            search_term: negativeCandidate.searchTerm,
          },
          proposedChange: {
            candidate: 'add_negative_keyword_or_product_target',
          },
          reasonCodes: ['ACTION_NEGATIVE_CANDIDATE', 'READ_ONLY_RECOMMENDATION_ONLY'],
          supportingMetrics: {
            ...supportingMetrics,
            search_term_clicks: negativeCandidate.clicks,
            search_term_spend: negativeCandidate.spend,
          },
        })
      );
      reasonCodes.push('ACTION_NEGATIVE_CANDIDATE');
    }
  }

  const cadence =
    args.spendDirection === 'stop' || args.spendDirection === 'collapse'
      ? 'daily'
      : state.confidence.value === 'insufficient'
        ? 'daily'
        : state.confidence.value === 'directional' || role.currentRole.value === 'Rank Push'
          ? 'every_3_days'
          : role.currentRole.value === 'Harvest'
            ? 'every_14_days'
            : 'weekly';
  actions.push(
    buildAction({
      actionType: 'change_review_cadence',
      entityContext: {
        target_id: execution.target.targetId,
        campaign_id: execution.campaign.campaignId,
      },
      proposedChange: {
        recommended_cadence: cadence,
      },
      reasonCodes: ['ACTION_CHANGE_REVIEW_CADENCE', 'READ_ONLY_RECOMMENDATION_ONLY'],
      supportingMetrics,
    })
  );
  reasonCodes.push('ACTION_CHANGE_REVIEW_CADENCE');

  return {
    actions: actions.sort(
      (left, right) =>
        left.priority - right.priority ||
        left.actionType.localeCompare(right.actionType)
    ),
    reasonCodes,
    unsupportedActionBlocks: withUnique(unsupportedActionBlocks),
  };
};

export const classifyAdsOptimizerRecommendations = (args: {
  payload: RuntimeJsonObject;
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
}): AdsOptimizerRecommendationSet => {
  const config = readRecommendationConfig(args.rulePackPayload);
  const spendDirection = determineSpendDirection(args.payload, config);
  const coverageFlags = buildCoverageFlags(args.payload);
  const confidenceNotes = buildConfidenceNotes(args.payload);
  const state = readAdsOptimizerTargetRunState(args.payload);
  const role = readAdsOptimizerTargetRunRole(args.payload);
  const execution = readExecutionContext(args.payload);

  if (!spendDirection.value || !state || !role?.currentRole.value) {
    return {
      engineVersion: RECOMMENDATION_ENGINE_VERSION,
      status: 'skipped',
      spendDirection: null,
      primaryActionType: null,
      reasonCodes: ['RECOMMENDATION_PREREQUISITES_MISSING'],
      coverageFlags,
      confidenceNotes,
      unsupportedActionBlocks: ['BLOCK_RECOMMENDATION_PREREQUISITES_MISSING'],
      actions: [],
      supportingMetrics: {
        current_role: role?.currentRole.value ?? null,
        confidence: state?.confidence.value ?? null,
        current_bulk_snapshot_date: execution.snapshotDate,
      },
    };
  }

  const actions = buildRecommendationActions({
    payload: args.payload,
    spendDirection: spendDirection.value,
    config,
  });
  const primaryActionType = actions.actions[0]?.actionType ?? null;

  return {
    engineVersion: RECOMMENDATION_ENGINE_VERSION,
    status: actions.actions.length > 0 ? 'generated' : 'skipped',
    spendDirection: spendDirection.value,
    primaryActionType,
    reasonCodes: withUnique([
      ...spendDirection.reasonCodes,
      ...actions.reasonCodes,
      ...state.summaryReasonCodes,
      ...role.summaryReasonCodes,
    ]),
    coverageFlags,
    confidenceNotes,
    unsupportedActionBlocks: actions.unsupportedActionBlocks,
    actions: actions.actions,
    supportingMetrics: {
      current_role: role.currentRole.value,
      desired_role: role.desiredRole.value,
      efficiency: state.efficiency.value,
      confidence: state.confidence.value,
      importance: state.importance.value,
      opportunity_score: state.opportunityScore,
      risk_score: state.riskScore,
      current_bulk_snapshot_date: execution.snapshotDate,
    },
  };
};

export const buildAdsOptimizerRecommendationSnapshot = (args: {
  targetSnapshotId: string;
  targetId: string;
  payload: RuntimeJsonObject;
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
}) => {
  const recommendation = classifyAdsOptimizerRecommendations(args);

  return {
    status: recommendation.status,
    actionType: recommendation.primaryActionType,
    reasonCodes: recommendation.reasonCodes,
    snapshotPayload: {
      phase: 8,
      capture_type: 'recommendation_snapshot',
      source: 'phase8_recommendation_engine',
      engine_version: recommendation.engineVersion,
      output_state: recommendation.status,
      execution_boundary: 'read_only_recommendation_only',
      writes_execution_tables: false,
      workspace_handoff: 'not_started',
      manual_review_required: true,
      target_snapshot_id: args.targetSnapshotId,
      target_id: args.targetId,
      spend_direction: recommendation.spendDirection,
      primary_action_type: recommendation.primaryActionType,
      reason_codes: recommendation.reasonCodes,
      coverage_flags: recommendation.coverageFlags,
      confidence_notes: recommendation.confidenceNotes,
      unsupported_action_blocks: recommendation.unsupportedActionBlocks,
      action_count: recommendation.actions.length,
      actions: recommendation.actions.map((action) => ({
        action_type: action.actionType,
        priority: action.priority,
        entity_context: action.entityContext,
        proposed_change: action.proposedChange,
        reason_codes: action.reasonCodes,
        supporting_metrics: action.supportingMetrics,
      })),
      supporting_metrics: recommendation.supportingMetrics,
    } satisfies RuntimeJsonObject,
  };
};
