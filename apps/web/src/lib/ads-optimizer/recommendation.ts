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

export type AdsOptimizerPortfolioControls = {
  activeDiscoverTargets: number;
  maxActiveDiscoverTargets: number;
  discoverRank: number | null;
  discoverCapBlocked: boolean;
  learningBudgetUsed: number;
  learningBudgetCap: number;
  learningBudgetExceeded: boolean;
  totalStopLossSpend: number;
  totalStopLossCap: number;
  stopLossCapExceeded: boolean;
  targetSpendShare: number | null;
  maxBudgetSharePerTarget: number;
  budgetShareExceeded: boolean;
  reasonCodes: string[];
};

export type AdsOptimizerQueryDiagnosticCandidate = {
  searchTerm: string;
  sameText: boolean;
  clicks: number;
  orders: number;
  spend: number;
  sales: number;
  stis: number | null;
  stir: number | null;
};

export type AdsOptimizerQueryDiagnostics = {
  contextScope: 'search_term_context_only';
  note: string;
  sameTextQueryPinning: {
    status: 'not_observed' | 'context_only' | 'pinned' | 'degrading';
    searchTerm: string | null;
    clickShare: number | null;
    orderShareProxy: number | null;
    reasonCodes: string[];
  };
  promoteToExactCandidates: AdsOptimizerQueryDiagnosticCandidate[];
  isolateCandidates: AdsOptimizerQueryDiagnosticCandidate[];
  negativeCandidates: AdsOptimizerQueryDiagnosticCandidate[];
};

export type AdsOptimizerPlacementDiagnostics = {
  contextScope: 'campaign_level_context_only';
  currentPlacementLabel: string | null;
  currentPlacementCode: string | null;
  currentPercentage: number | null;
  biasRecommendation: 'stronger' | 'weaker' | 'hold' | 'unknown';
  reasonCodes: string[];
  note: string;
};

export type AdsOptimizerExceptionSignal = {
  type:
    | 'guardrail_breach'
    | 'major_role_change'
    | 'main_driver_degradation'
    | 'low_confidence_high_spend';
  severity: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  reasonCodes: string[];
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
  portfolioControls: AdsOptimizerPortfolioControls;
  queryDiagnostics: AdsOptimizerQueryDiagnostics;
  placementDiagnostics: AdsOptimizerPlacementDiagnostics;
  exceptionSignals: AdsOptimizerExceptionSignal[];
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
  portfolioControls: AdsOptimizerPortfolioControls | null;
  queryDiagnostics: AdsOptimizerQueryDiagnostics | null;
  placementDiagnostics: AdsOptimizerPlacementDiagnostics | null;
  exceptionSignals: AdsOptimizerExceptionSignal[];
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
  promoteToExactClicksMin: number;
  sameTextPinClickShareMin: number;
  mainDriverDegradationClickShareMin: number;
  lowConfidenceHighSpendMin: number;
  increaseOpportunityGap: number;
  reduceRiskGap: number;
  maxActiveDiscoverTargets: number;
  learningBudgetCap: number;
  totalStopLossCap: number;
  maxBudgetSharePerTarget: number;
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

type RecommendationPortfolioContext = {
  activeDiscoverTargets: number;
  discoverRank: number | null;
  maxActiveDiscoverTargets: number;
  discoverCapBlocked: boolean;
  learningBudgetUsed: number;
  learningBudgetCap: number;
  learningBudgetExceeded: boolean;
  totalStopLossSpend: number;
  totalStopLossCap: number;
  stopLossCapExceeded: boolean;
  targetSpendShare: number | null;
  maxBudgetSharePerTarget: number;
  budgetShareExceeded: boolean;
};

type RecommendationRowInput = {
  targetSnapshotId: string;
  targetId: string;
  payload: RuntimeJsonObject;
};

const RECOMMENDATION_ENGINE_VERSION = 'phase11_v1';

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
  promoteToExactClicksMin: 5,
  sameTextPinClickShareMin: 0.55,
  mainDriverDegradationClickShareMin: 0.55,
  lowConfidenceHighSpendMin: 25,
  increaseOpportunityGap: 10,
  reduceRiskGap: 8,
  maxActiveDiscoverTargets: 6,
  learningBudgetCap: 75,
  totalStopLossCap: 120,
  maxBudgetSharePerTarget: 0.35,
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
    promoteToExactClicksMin:
      readNumber(thresholds, 'promote_to_exact_clicks_min') ??
      DEFAULT_RECOMMENDATION_CONFIG.promoteToExactClicksMin,
    sameTextPinClickShareMin:
      readNumber(thresholds, 'same_text_pin_click_share_min') ??
      DEFAULT_RECOMMENDATION_CONFIG.sameTextPinClickShareMin,
    mainDriverDegradationClickShareMin:
      readNumber(thresholds, 'main_driver_degradation_click_share_min') ??
      DEFAULT_RECOMMENDATION_CONFIG.mainDriverDegradationClickShareMin,
    lowConfidenceHighSpendMin:
      readNumber(thresholds, 'low_confidence_high_spend_min') ??
      DEFAULT_RECOMMENDATION_CONFIG.lowConfidenceHighSpendMin,
    increaseOpportunityGap:
      readNumber(thresholds, 'increase_opportunity_gap') ??
      DEFAULT_RECOMMENDATION_CONFIG.increaseOpportunityGap,
    reduceRiskGap:
      readNumber(thresholds, 'reduce_risk_gap') ??
      DEFAULT_RECOMMENDATION_CONFIG.reduceRiskGap,
    maxActiveDiscoverTargets:
      readNumber(thresholds, 'max_active_discover_targets') ??
      DEFAULT_RECOMMENDATION_CONFIG.maxActiveDiscoverTargets,
    learningBudgetCap:
      readNumber(thresholds, 'learning_budget_cap') ??
      DEFAULT_RECOMMENDATION_CONFIG.learningBudgetCap,
    totalStopLossCap:
      readNumber(thresholds, 'total_stop_loss_cap') ??
      DEFAULT_RECOMMENDATION_CONFIG.totalStopLossCap,
    maxBudgetSharePerTarget:
      readNumber(thresholds, 'max_budget_share_per_target') ??
      DEFAULT_RECOMMENDATION_CONFIG.maxBudgetSharePerTarget,
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

const getConfidenceRank = (value: string | null) => {
  if (value === 'confirmed') return 3;
  if (value === 'directional') return 2;
  if (value === 'insufficient') return 1;
  return 0;
};

const getRoleRank = (value: string | null) => {
  if (value === 'Suppress') return 0;
  if (value === 'Discover') return 1;
  if (value === 'Harvest') return 2;
  if (value === 'Rank Defend') return 3;
  if (value === 'Rank Push') return 4;
  if (value === 'Scale') return 5;
  return 0;
};

const buildPortfolioContexts = (args: {
  rows: RecommendationRowInput[];
  config: RecommendationConfig;
}) => {
  const rowSummaries = args.rows.map((row) => {
    const state = readAdsOptimizerTargetRunState(row.payload);
    const role = readAdsOptimizerTargetRunRole(row.payload);
    const totals = asJsonObject(row.payload.totals);
    const derived = asJsonObject(row.payload.derived_metrics);

    return {
      targetId: row.targetId,
      spend: readNumber(totals, 'spend') ?? 0,
      opportunityScore: state?.opportunityScore ?? -1,
      confidenceRank: getConfidenceRank(state?.confidence.value ?? null),
      role: role?.currentRole.value ?? null,
      efficiency: state?.efficiency.value ?? null,
      lossDollars: readNumber(derived, 'loss_dollars') ?? 0,
      riskScore: state?.riskScore ?? -1,
    };
  });

  const totalSpend = rowSummaries.reduce((sum, row) => sum + row.spend, 0);
  const hasPortfolioCompetition = rowSummaries.length > 1;
  const discoverRows = [...rowSummaries]
    .filter((row) => row.role === 'Discover')
    .sort(
      (left, right) =>
        right.opportunityScore - left.opportunityScore ||
        right.confidenceRank - left.confidenceRank ||
        left.spend - right.spend ||
        left.targetId.localeCompare(right.targetId)
    );
  const allowedDiscoverTargetIds = new Set(
    discoverRows.slice(0, args.config.maxActiveDiscoverTargets).map((row) => row.targetId)
  );
  const learningBudgetUsed = rowSummaries
    .filter((row) => row.role === 'Discover' || row.efficiency === 'learning_no_sale')
    .reduce((sum, row) => sum + row.spend, 0);
  const totalStopLossSpend = rowSummaries
    .filter(
      (row) =>
        row.role === 'Suppress' ||
        row.lossDollars > 0 ||
        row.efficiency === 'converting_but_loss_making'
    )
    .reduce((sum, row) => sum + row.spend, 0);

  return new Map(
    rowSummaries.map((row) => [
      row.targetId,
      {
        activeDiscoverTargets: discoverRows.length,
        discoverRank:
          row.role === 'Discover'
            ? discoverRows.findIndex((entry) => entry.targetId === row.targetId) + 1
            : null,
        maxActiveDiscoverTargets: args.config.maxActiveDiscoverTargets,
        discoverCapBlocked:
          row.role === 'Discover' &&
          discoverRows.length > args.config.maxActiveDiscoverTargets &&
          !allowedDiscoverTargetIds.has(row.targetId),
        learningBudgetUsed,
        learningBudgetCap: args.config.learningBudgetCap,
        learningBudgetExceeded:
          learningBudgetUsed > args.config.learningBudgetCap &&
          (row.role === 'Discover' || row.efficiency === 'learning_no_sale'),
        totalStopLossSpend,
        totalStopLossCap: args.config.totalStopLossCap,
        stopLossCapExceeded:
          totalStopLossSpend > args.config.totalStopLossCap &&
          (row.role === 'Suppress' || row.lossDollars > 0 || row.riskScore >= 70),
        targetSpendShare: totalSpend > 0 ? row.spend / totalSpend : null,
        maxBudgetSharePerTarget: args.config.maxBudgetSharePerTarget,
        budgetShareExceeded:
          hasPortfolioCompetition &&
          totalSpend > 0 &&
          row.spend / totalSpend > args.config.maxBudgetSharePerTarget,
      } satisfies RecommendationPortfolioContext,
    ])
  );
};

const buildPortfolioControls = (
  context: RecommendationPortfolioContext | null | undefined
): AdsOptimizerPortfolioControls => {
  const portfolioContext = context ?? {
    activeDiscoverTargets: 0,
    discoverRank: null,
    maxActiveDiscoverTargets: DEFAULT_RECOMMENDATION_CONFIG.maxActiveDiscoverTargets,
    discoverCapBlocked: false,
    learningBudgetUsed: 0,
    learningBudgetCap: DEFAULT_RECOMMENDATION_CONFIG.learningBudgetCap,
    learningBudgetExceeded: false,
    totalStopLossSpend: 0,
    totalStopLossCap: DEFAULT_RECOMMENDATION_CONFIG.totalStopLossCap,
    stopLossCapExceeded: false,
    targetSpendShare: null,
    maxBudgetSharePerTarget: DEFAULT_RECOMMENDATION_CONFIG.maxBudgetSharePerTarget,
    budgetShareExceeded: false,
  };

  const reasonCodes: string[] = [];
  if (portfolioContext.discoverCapBlocked) {
    reasonCodes.push('PORTFOLIO_CAP_MAX_ACTIVE_DISCOVER');
  }
  if (portfolioContext.learningBudgetExceeded) {
    reasonCodes.push('PORTFOLIO_CAP_LEARNING_BUDGET');
  }
  if (portfolioContext.stopLossCapExceeded) {
    reasonCodes.push('PORTFOLIO_CAP_TOTAL_STOP_LOSS');
  }
  if (portfolioContext.budgetShareExceeded) {
    reasonCodes.push('PORTFOLIO_CAP_MAX_BUDGET_SHARE_PER_TARGET');
  }

  return {
    ...portfolioContext,
    reasonCodes,
  };
};

const compareCandidates = (
  left: AdsOptimizerQueryDiagnosticCandidate,
  right: AdsOptimizerQueryDiagnosticCandidate
) =>
  right.clicks - left.clicks ||
  right.orders - left.orders ||
  right.sales - left.sales ||
  left.searchTerm.localeCompare(right.searchTerm);

const toQueryCandidate = (term: SearchTermDiagnostic): AdsOptimizerQueryDiagnosticCandidate => ({
  searchTerm: term.searchTerm,
  sameText: term.sameText,
  clicks: term.clicks,
  orders: term.orders,
  spend: term.spend,
  sales: term.sales,
  stis: term.stis,
  stir: term.stir,
});

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

const readQueryCandidateView = (
  entry: RuntimeJsonObject | null
): AdsOptimizerQueryDiagnosticCandidate | null => {
  if (!entry) return null;
  const searchTerm = readString(entry, 'search_term');
  if (!searchTerm) return null;

  return {
    searchTerm,
    sameText: readBoolean(entry, 'same_text') ?? false,
    clicks: readNumber(entry, 'clicks') ?? 0,
    orders: readNumber(entry, 'orders') ?? 0,
    spend: readNumber(entry, 'spend') ?? 0,
    sales: readNumber(entry, 'sales') ?? 0,
    stis: readNumber(entry, 'stis'),
    stir: readNumber(entry, 'stir'),
  };
};

export const readAdsOptimizerRecommendationSnapshotView = (snapshot: {
  recommendation_snapshot_id: string;
  target_snapshot_id: string;
  created_at: string;
  status: 'pending_phase5' | 'generated' | 'skipped';
  action_type: string | null;
  snapshot_payload_json: RuntimeJsonObject;
}): AdsOptimizerRecommendationSnapshotView => {
  const payload = asJsonObject(snapshot.snapshot_payload_json) ?? {};
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const portfolioControls = asJsonObject(payload.portfolio_controls);
  const queryDiagnostics = asJsonObject(payload.query_diagnostics);
  const sameTextPinning = asJsonObject(queryDiagnostics?.same_text_query_pinning);
  const placementDiagnostics = asJsonObject(payload.placement_diagnostics);
  const exceptionSignals = Array.isArray(payload.exception_signals) ? payload.exception_signals : [];

  return {
    recommendationSnapshotId: snapshot.recommendation_snapshot_id,
    targetSnapshotId: snapshot.target_snapshot_id,
    createdAt: snapshot.created_at,
    status: snapshot.status,
    actionType: snapshot.action_type,
    spendDirection:
      (readString(payload, 'spend_direction') as AdsOptimizerSpendDirection | null) ?? null,
    primaryActionType:
      (readString(payload, 'primary_action_type') as AdsOptimizerRecommendationActionType | null) ??
      null,
    actionCount: readNumber(payload, 'action_count') ?? 0,
    reasonCodes: readStringArray(payload, 'reason_codes'),
    coverageFlags: readStringArray(payload, 'coverage_flags'),
    confidenceNotes: readStringArray(payload, 'confidence_notes'),
    unsupportedActionBlocks: readStringArray(payload, 'unsupported_action_blocks'),
    portfolioControls: portfolioControls
      ? {
          activeDiscoverTargets: readNumber(portfolioControls, 'active_discover_targets') ?? 0,
          maxActiveDiscoverTargets:
            readNumber(portfolioControls, 'max_active_discover_targets') ??
            DEFAULT_RECOMMENDATION_CONFIG.maxActiveDiscoverTargets,
          discoverRank: readNumber(portfolioControls, 'discover_rank'),
          discoverCapBlocked: readBoolean(portfolioControls, 'discover_cap_blocked') ?? false,
          learningBudgetUsed: readNumber(portfolioControls, 'learning_budget_used') ?? 0,
          learningBudgetCap:
            readNumber(portfolioControls, 'learning_budget_cap') ??
            DEFAULT_RECOMMENDATION_CONFIG.learningBudgetCap,
          learningBudgetExceeded:
            readBoolean(portfolioControls, 'learning_budget_exceeded') ?? false,
          totalStopLossSpend: readNumber(portfolioControls, 'total_stop_loss_spend') ?? 0,
          totalStopLossCap:
            readNumber(portfolioControls, 'total_stop_loss_cap') ??
            DEFAULT_RECOMMENDATION_CONFIG.totalStopLossCap,
          stopLossCapExceeded: readBoolean(portfolioControls, 'stop_loss_cap_exceeded') ?? false,
          targetSpendShare: readNumber(portfolioControls, 'target_spend_share'),
          maxBudgetSharePerTarget:
            readNumber(portfolioControls, 'max_budget_share_per_target') ??
            DEFAULT_RECOMMENDATION_CONFIG.maxBudgetSharePerTarget,
          budgetShareExceeded: readBoolean(portfolioControls, 'budget_share_exceeded') ?? false,
          reasonCodes: readStringArray(portfolioControls, 'reason_codes'),
        }
      : null,
    queryDiagnostics: queryDiagnostics
      ? {
          contextScope:
            (readString(queryDiagnostics, 'context_scope') as 'search_term_context_only' | null) ??
            'search_term_context_only',
          note:
            readString(queryDiagnostics, 'note') ??
            'Search-term diagnostics remain contextual only.',
          sameTextQueryPinning: {
            status:
              (readString(sameTextPinning, 'status') as
                | 'not_observed'
                | 'context_only'
                | 'pinned'
                | 'degrading'
                | null) ?? 'not_observed',
            searchTerm: readString(sameTextPinning, 'search_term'),
            clickShare: readNumber(sameTextPinning, 'click_share'),
            orderShareProxy: readNumber(sameTextPinning, 'order_share_proxy'),
            reasonCodes: readStringArray(sameTextPinning, 'reason_codes'),
          },
          promoteToExactCandidates: (
            Array.isArray(queryDiagnostics.promote_to_exact_candidates)
              ? queryDiagnostics.promote_to_exact_candidates
              : []
          )
            .map((entry) => readQueryCandidateView(asJsonObject(entry)))
            .filter((entry): entry is AdsOptimizerQueryDiagnosticCandidate => entry !== null),
          isolateCandidates: (
            Array.isArray(queryDiagnostics.isolate_candidates)
              ? queryDiagnostics.isolate_candidates
              : []
          )
            .map((entry) => readQueryCandidateView(asJsonObject(entry)))
            .filter((entry): entry is AdsOptimizerQueryDiagnosticCandidate => entry !== null),
          negativeCandidates: (
            Array.isArray(queryDiagnostics.negative_candidates)
              ? queryDiagnostics.negative_candidates
              : []
          )
            .map((entry) => readQueryCandidateView(asJsonObject(entry)))
            .filter((entry): entry is AdsOptimizerQueryDiagnosticCandidate => entry !== null),
        }
      : null,
    placementDiagnostics: placementDiagnostics
      ? {
          contextScope:
            (readString(placementDiagnostics, 'context_scope') as
              | 'campaign_level_context_only'
              | null) ?? 'campaign_level_context_only',
          currentPlacementLabel: readString(placementDiagnostics, 'current_placement_label'),
          currentPlacementCode: readString(placementDiagnostics, 'current_placement_code'),
          currentPercentage: readNumber(placementDiagnostics, 'current_percentage'),
          biasRecommendation:
            (readString(placementDiagnostics, 'bias_recommendation') as
              | 'stronger'
              | 'weaker'
              | 'hold'
              | 'unknown'
              | null) ?? 'unknown',
          reasonCodes: readStringArray(placementDiagnostics, 'reason_codes'),
          note:
            readString(placementDiagnostics, 'note') ??
            'Placement diagnostics remain campaign-level context only.',
        }
      : null,
    exceptionSignals: exceptionSignals
      .map((entry) => asJsonObject(entry))
      .filter((entry): entry is RuntimeJsonObject => entry !== null)
      .map((entry) => ({
        type:
          (readString(entry, 'type') as AdsOptimizerExceptionSignal['type'] | null) ??
          'guardrail_breach',
        severity:
          (readString(entry, 'severity') as AdsOptimizerExceptionSignal['severity'] | null) ??
          'medium',
        title: readString(entry, 'title') ?? 'Exception',
        detail: readString(entry, 'detail') ?? 'No detail captured.',
        reasonCodes: readStringArray(entry, 'reason_codes'),
      })),
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
  const criticalWarnings = Array.isArray(coverage?.critical_warnings)
    ? coverage.critical_warnings.filter((entry): entry is string => typeof entry === 'string')
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

  coverageNotes.slice(0, 2).forEach((note) => notes.push(note));
  criticalWarnings.slice(0, 2).forEach((note) => notes.push(note));
  return withUnique(notes);
};

const buildRecommendationSupportingMetrics = (payload: RuntimeJsonObject) => {
  const state = readAdsOptimizerTargetRunState(payload);
  const role = readAdsOptimizerTargetRunRole(payload);
  const totals = asJsonObject(payload.totals);
  const derived = asJsonObject(payload.derived_metrics);

  return {
    current_role: role?.currentRole.value ?? null,
    desired_role: role?.desiredRole.value ?? null,
    efficiency: state?.efficiency.value ?? null,
    confidence: state?.confidence.value ?? null,
    importance: state?.importance.value ?? null,
    opportunity_score: state?.opportunityScore ?? null,
    risk_score: state?.riskScore ?? null,
    clicks: readNumber(totals, 'clicks') ?? 0,
    spend: readNumber(totals, 'spend') ?? 0,
    orders: readNumber(totals, 'orders') ?? 0,
    sales: readNumber(totals, 'sales') ?? 0,
    break_even_gap: readNumber(derived, 'break_even_gap'),
    loss_dollars: readNumber(derived, 'loss_dollars'),
    profit_dollars: readNumber(derived, 'profit_dollars'),
  } satisfies RuntimeJsonObject;
};

const determineBaseSpendDirection = (payload: RuntimeJsonObject, config: RecommendationConfig) => {
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
  const autoPauseThreshold =
    role.guardrails.categories.autoPauseThreshold ?? Number.POSITIVE_INFINITY;
  const noSaleSpendCap =
    role.guardrails.categories.noSaleSpendCap ?? Number.POSITIVE_INFINITY;
  const noSaleClickCap =
    role.guardrails.categories.noSaleClickCap ?? Number.POSITIVE_INFINITY;
  const severeLoss =
    lossDollars >= (role.guardrails.categories.maxLossPerCycle ?? Number.POSITIVE_INFINITY);
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

const determineSpendDirection = (args: {
  payload: RuntimeJsonObject;
  config: RecommendationConfig;
  portfolioControls: AdsOptimizerPortfolioControls;
}) => {
  const base = determineBaseSpendDirection(args.payload, args.config);
  const state = readAdsOptimizerTargetRunState(args.payload);
  const role = readAdsOptimizerTargetRunRole(args.payload);

  if (!base.value || !state || !role?.currentRole.value) {
    return base;
  }

  let value = base.value;
  const reasonCodes = [...base.reasonCodes];

  if (
    args.portfolioControls.stopLossCapExceeded &&
    (role.currentRole.value === 'Suppress' ||
      state.riskScore >= 70 ||
      state.efficiency.value === 'converting_but_loss_making')
  ) {
    value = role.guardrails.flags.autoPauseEligible ? 'stop' : 'collapse';
    reasonCodes.push('SPEND_DIRECTION_PORTFOLIO_STOP_LOSS_CAP');
  }

  if (
    args.portfolioControls.discoverCapBlocked &&
    role.currentRole.value === 'Discover' &&
    (value === 'increase' || value === 'hold')
  ) {
    value = 'reduce';
    reasonCodes.push('SPEND_DIRECTION_DISCOVER_CAP_REDUCE');
  }

  if (
    args.portfolioControls.learningBudgetExceeded &&
    (role.currentRole.value === 'Discover' || state.efficiency.value === 'learning_no_sale') &&
    (value === 'increase' || value === 'hold')
  ) {
    value = 'reduce';
    reasonCodes.push('SPEND_DIRECTION_LEARNING_BUDGET_CAP_REDUCE');
  }

  if (args.portfolioControls.budgetShareExceeded && value === 'increase') {
    value = 'hold';
    reasonCodes.push('SPEND_DIRECTION_MAX_BUDGET_SHARE_HOLD');
  }

  return {
    value,
    reasonCodes: withUnique(reasonCodes),
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

const buildQueryDiagnostics = (args: {
  payload: RuntimeJsonObject;
  config: RecommendationConfig;
}): AdsOptimizerQueryDiagnostics => {
  const searchTerms = readSearchTerms(args.payload);
  const execution = readExecutionContext(args.payload);
  const totals = asJsonObject(args.payload.totals);
  const targetClicks = readNumber(totals, 'clicks') ?? 0;
  const targetOrders = readNumber(totals, 'orders') ?? 0;
  const keywordEligible = !execution.target.isNegative && isKeywordTarget(args.payload, execution);
  const sameTextTerms = [...searchTerms.filter((term) => term.sameText)].sort(compareCandidates);
  const topSameText = sameTextTerms[0] ?? null;
  const totalObservedClicks = searchTerms.reduce((sum, term) => sum + term.clicks, 0);
  const clickShareDenominator = totalObservedClicks > 0 ? totalObservedClicks : targetClicks;
  const clickShare =
    topSameText && clickShareDenominator > 0 ? topSameText.clicks / clickShareDenominator : null;
  const orderShareProxy =
    topSameText && targetOrders > 0 ? topSameText.orders / targetOrders : null;
  const sameTextReasonCodes: string[] = [];
  let sameTextStatus: AdsOptimizerQueryDiagnostics['sameTextQueryPinning']['status'] = 'not_observed';

  if (!topSameText) {
    sameTextReasonCodes.push('QUERY_SAME_TEXT_NOT_OBSERVED');
  } else if ((clickShare ?? 0) >= args.config.sameTextPinClickShareMin) {
    if (topSameText.orders <= 0 && topSameText.sales <= topSameText.spend) {
      sameTextStatus = 'degrading';
      sameTextReasonCodes.push('QUERY_SAME_TEXT_DRIVER_DEGRADING');
    } else {
      sameTextStatus = 'pinned';
      sameTextReasonCodes.push('QUERY_SAME_TEXT_PINNED');
    }
  } else {
    sameTextStatus = 'context_only';
    sameTextReasonCodes.push('QUERY_SAME_TEXT_CONTEXT_ONLY');
  }

  const candidateTerms = searchTerms.filter((term) => !term.sameText);
  const profitableOrConverting = (term: SearchTermDiagnostic) =>
    term.orders > 0 || term.sales > term.spend;

  return {
    contextScope: 'search_term_context_only',
    note:
      'Search-term diagnostics stay contextual only. They describe observed query behavior without converting query context into target-owned facts.',
    sameTextQueryPinning: {
      status: sameTextStatus,
      searchTerm: topSameText?.searchTerm ?? null,
      clickShare,
      orderShareProxy,
      reasonCodes: withUnique(sameTextReasonCodes),
    },
    promoteToExactCandidates:
      keywordEligible && execution.target.matchType?.toUpperCase() !== 'EXACT'
        ? [...candidateTerms]
            .filter(
              (term) =>
                term.clicks >= args.config.promoteToExactClicksMin &&
                profitableOrConverting(term)
            )
            .sort(compareCandidates)
            .slice(0, 3)
            .map(toQueryCandidate)
        : [],
    isolateCandidates: keywordEligible
      ? [...candidateTerms]
          .filter(
            (term) =>
              term.clicks >= args.config.isolateQueryClicksMin && profitableOrConverting(term)
          )
          .sort(compareCandidates)
          .slice(0, 3)
          .map(toQueryCandidate)
      : [],
    negativeCandidates: keywordEligible
      ? [...candidateTerms]
          .filter(
            (term) =>
              term.orders <= 0 &&
              term.clicks >= args.config.negativeQueryClicksMin &&
              term.spend >= args.config.negativeQuerySpendMin
          )
          .sort(compareCandidates)
          .slice(0, 3)
          .map(toQueryCandidate)
      : [],
  };
};

const buildPlacementDiagnostics = (args: {
  payload: RuntimeJsonObject;
  spendDirection: AdsOptimizerSpendDirection | null;
}): AdsOptimizerPlacementDiagnostics => {
  const execution = readExecutionContext(args.payload);
  const placementContext = asJsonObject(args.payload.placement_context);
  const state = readAdsOptimizerTargetRunState(args.payload);
  const role = readAdsOptimizerTargetRunRole(args.payload);
  const placementSales = readNumber(placementContext, 'sales');
  const placementSpend = readNumber(placementContext, 'spend');
  const placementOrders = readNumber(placementContext, 'orders') ?? 0;
  const profitableContext =
    placementSales !== null &&
    placementSpend !== null &&
    placementSpend > 0 &&
    placementSales > placementSpend &&
    placementOrders > 0;
  const weakContext =
    placementSpend !== null &&
    ((placementSales !== null && placementSales <= placementSpend) ||
      placementOrders <= 0 ||
      role?.currentRole.value === 'Suppress' ||
      state?.efficiency.value === 'converting_but_loss_making');

  let biasRecommendation: AdsOptimizerPlacementDiagnostics['biasRecommendation'] = 'unknown';
  const reasonCodes: string[] = [];

  if (execution.placement.currentPercentage === null && !placementContext) {
    biasRecommendation = 'unknown';
    reasonCodes.push('PLACEMENT_CONTEXT_UNAVAILABLE');
  } else if (
    args.spendDirection === 'increase' &&
    profitableContext &&
    (role?.currentRole.value === 'Scale' || role?.currentRole.value === 'Rank Push')
  ) {
    biasRecommendation = 'stronger';
    reasonCodes.push('PLACEMENT_BIAS_STRONGER_CONTEXT');
  } else if (
    (args.spendDirection === 'reduce' ||
      args.spendDirection === 'collapse' ||
      args.spendDirection === 'stop') &&
    weakContext
  ) {
    biasRecommendation = 'weaker';
    reasonCodes.push('PLACEMENT_BIAS_WEAKER_CONTEXT');
  } else if (execution.placement.currentPercentage !== null || placementContext) {
    biasRecommendation = 'hold';
    reasonCodes.push('PLACEMENT_BIAS_HOLD_CONTEXT');
  }

  const noteParts = [
    'Campaign-level context only. Placement diagnostics should guide operator review, not be treated as target-owned fact history.',
  ];
  const placementNote = readString(placementContext, 'note');
  if (placementNote) noteParts.push(placementNote);

  return {
    contextScope: 'campaign_level_context_only',
    currentPlacementLabel: execution.placement.label,
    currentPlacementCode: execution.placement.placementCode,
    currentPercentage: execution.placement.currentPercentage,
    biasRecommendation,
    reasonCodes: withUnique(reasonCodes),
    note: noteParts.join(' '),
  };
};

const buildExceptionSignals = (args: {
  payload: RuntimeJsonObject;
  config: RecommendationConfig;
  portfolioControls: AdsOptimizerPortfolioControls;
  queryDiagnostics: AdsOptimizerQueryDiagnostics;
}): AdsOptimizerExceptionSignal[] => {
  const signals: AdsOptimizerExceptionSignal[] = [];
  const state = readAdsOptimizerTargetRunState(args.payload);
  const role = readAdsOptimizerTargetRunRole(args.payload);
  const totals = asJsonObject(args.payload.totals);
  const spend = readNumber(totals, 'spend') ?? 0;

  if (!state || !role?.currentRole.value) {
    return signals;
  }

  if (
    role.guardrails.flags.requiresManualApproval ||
    role.guardrails.flags.autoPauseEligible ||
    role.guardrails.flags.transitionLocked ||
    args.portfolioControls.reasonCodes.length > 0
  ) {
    signals.push({
      type: 'guardrail_breach',
      severity:
        role.guardrails.flags.autoPauseEligible || role.guardrails.flags.transitionLocked
          ? 'high'
          : 'medium',
      title: 'Guardrail breach requires manual review',
      detail:
        'This target triggered manual review conditions from role guardrails or ASIN-level portfolio caps.',
      reasonCodes: withUnique([
        ...role.guardrails.reasonCodes,
        ...args.portfolioControls.reasonCodes,
        role.guardrails.flags.autoPauseEligible ? 'EXCEPTION_AUTO_PAUSE_ELIGIBLE' : '',
        role.guardrails.flags.transitionLocked ? 'EXCEPTION_TRANSITION_LOCKED' : '',
        role.guardrails.flags.requiresManualApproval ? 'EXCEPTION_MANUAL_APPROVAL_REQUIRED' : '',
      ].filter(Boolean)),
    });
  }

  const previousRole = role.previousRole;
  const currentRole = role.currentRole.value;
  const roleDelta = Math.abs(getRoleRank(currentRole) - getRoleRank(previousRole));
  if (previousRole && currentRole && previousRole !== currentRole && roleDelta >= 2) {
    signals.push({
      type: 'major_role_change',
      severity: roleDelta >= 3 || currentRole === 'Suppress' ? 'high' : 'medium',
      title: 'Major role change detected',
      detail: `Role moved from ${previousRole} to ${currentRole} in the current optimizer run.`,
      reasonCodes: withUnique([
        'EXCEPTION_MAJOR_ROLE_CHANGE',
        ...role.transitionReasonCodes,
      ]),
    });
  }

  if (
    args.queryDiagnostics.sameTextQueryPinning.status === 'degrading' &&
    (args.queryDiagnostics.sameTextQueryPinning.clickShare ?? 0) >=
      args.config.mainDriverDegradationClickShareMin
  ) {
    signals.push({
      type: 'main_driver_degradation',
      severity: 'high',
      title: 'Main same-text driver is degrading',
      detail:
        'The dominant same-text query captured most observed clicks but did not convert efficiently in this run window.',
      reasonCodes: withUnique([
        'EXCEPTION_MAIN_DRIVER_DEGRADING',
        ...args.queryDiagnostics.sameTextQueryPinning.reasonCodes,
      ]),
    });
  }

  if (state.confidence.value === 'insufficient' && spend >= args.config.lowConfidenceHighSpendMin) {
    signals.push({
      type: 'low_confidence_high_spend',
      severity: spend >= args.config.lowConfidenceHighSpendMin * 2 ? 'high' : 'medium',
      title: 'Low-confidence spend exposure',
      detail: `Spend reached ${roundCurrency(spend)} with insufficient confidence for the selected window.`,
      reasonCodes: ['EXCEPTION_LOW_CONFIDENCE_HIGH_SPEND'],
    });
  }

  return signals;
};

const buildRecommendationActions = (args: {
  payload: RuntimeJsonObject;
  spendDirection: AdsOptimizerSpendDirection;
  config: RecommendationConfig;
  queryDiagnostics: AdsOptimizerQueryDiagnostics;
  placementDiagnostics: AdsOptimizerPlacementDiagnostics;
}) => {
  const actions: AdsOptimizerRecommendationAction[] = [];
  const reasonCodes: string[] = [];
  const unsupportedActionBlocks: string[] = [];
  const state = readAdsOptimizerTargetRunState(args.payload);
  const role = readAdsOptimizerTargetRunRole(args.payload);
  const execution = readExecutionContext(args.payload);
  const identity = asJsonObject(args.payload.identity);
  const supportingMetrics = buildRecommendationSupportingMetrics(args.payload);

  if (!state || !role?.currentRole.value) {
    return {
      actions: [],
      reasonCodes: ['RECOMMENDATION_PREREQUISITES_MISSING'],
      unsupportedActionBlocks: ['BLOCK_RECOMMENDATION_PREREQUISITES_MISSING'],
    };
  }

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
        args.spendDirection === 'increase' ? 1 + appliedPct / 100 : 1 - appliedPct / 100;
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
                  ? roundCurrency(
                      ((nextBid - execution.target.currentBid) / execution.target.currentBid) * 100
                    )
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
      role.currentRole.value === 'Suppress') &&
    (args.placementDiagnostics.biasRecommendation === 'stronger' ||
      args.placementDiagnostics.biasRecommendation === 'weaker')
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
    const isolateCandidate = args.queryDiagnostics.isolateCandidates[0] ?? null;
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

    const negativeCandidate = args.queryDiagnostics.negativeCandidates[0] ?? null;
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

    if (args.queryDiagnostics.promoteToExactCandidates.length > 0) {
      reasonCodes.push('QUERY_PROMOTE_TO_EXACT_CANDIDATES_AVAILABLE');
    }
    if (args.queryDiagnostics.sameTextQueryPinning.status === 'pinned') {
      reasonCodes.push('QUERY_SAME_TEXT_PINNING_ACTIVE');
    }
    if (args.queryDiagnostics.sameTextQueryPinning.status === 'degrading') {
      reasonCodes.push('QUERY_SAME_TEXT_PINNING_DEGRADING');
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
        left.priority - right.priority || left.actionType.localeCompare(right.actionType)
    ),
    reasonCodes: withUnique(reasonCodes),
    unsupportedActionBlocks: withUnique(unsupportedActionBlocks),
  };
};

const classifyRecommendationRow = (args: {
  row: RecommendationRowInput;
  config: RecommendationConfig;
  portfolioContext: RecommendationPortfolioContext | null | undefined;
}): AdsOptimizerRecommendationSet => {
  const portfolioControls = buildPortfolioControls(args.portfolioContext);
  const spendDirection = determineSpendDirection({
    payload: args.row.payload,
    config: args.config,
    portfolioControls,
  });
  const coverageFlags = buildCoverageFlags(args.row.payload);
  const confidenceNotes = buildConfidenceNotes(args.row.payload);
  const queryDiagnostics = buildQueryDiagnostics({
    payload: args.row.payload,
    config: args.config,
  });
  const placementDiagnostics = buildPlacementDiagnostics({
    payload: args.row.payload,
    spendDirection: spendDirection.value,
  });
  const state = readAdsOptimizerTargetRunState(args.row.payload);
  const role = readAdsOptimizerTargetRunRole(args.row.payload);
  const execution = readExecutionContext(args.row.payload);

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
      portfolioControls,
      queryDiagnostics,
      placementDiagnostics,
      exceptionSignals: [],
      actions: [],
      supportingMetrics: {
        ...buildRecommendationSupportingMetrics(args.row.payload),
        current_bulk_snapshot_date: execution.snapshotDate,
      },
    };
  }

  const actions = buildRecommendationActions({
    payload: args.row.payload,
    spendDirection: spendDirection.value,
    config: args.config,
    queryDiagnostics,
    placementDiagnostics,
  });
  const exceptionSignals = buildExceptionSignals({
    payload: args.row.payload,
    config: args.config,
    portfolioControls,
    queryDiagnostics,
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
      ...portfolioControls.reasonCodes,
      ...queryDiagnostics.sameTextQueryPinning.reasonCodes,
      ...placementDiagnostics.reasonCodes,
      ...exceptionSignals.flatMap((signal) => signal.reasonCodes),
    ]),
    coverageFlags,
    confidenceNotes,
    unsupportedActionBlocks: actions.unsupportedActionBlocks,
    portfolioControls,
    queryDiagnostics,
    placementDiagnostics,
    exceptionSignals,
    actions: actions.actions,
    supportingMetrics: {
      ...buildRecommendationSupportingMetrics(args.row.payload),
      current_bulk_snapshot_date: execution.snapshotDate,
    },
  };
};

export const classifyAdsOptimizerRecommendationsBatch = (args: {
  rows: RecommendationRowInput[];
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
}) => {
  const config = readRecommendationConfig(args.rulePackPayload);
  const portfolioContexts = buildPortfolioContexts({
    rows: args.rows,
    config,
  });

  return args.rows.map((row) => ({
    row,
    recommendation: classifyRecommendationRow({
      row,
      config,
      portfolioContext: portfolioContexts.get(row.targetId),
    }),
  }));
};

export const classifyAdsOptimizerRecommendations = (args: {
  payload: RuntimeJsonObject;
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
}): AdsOptimizerRecommendationSet => {
  const execution = readExecutionContext(args.payload);
  const identity = asJsonObject(args.payload.identity);
  const targetId =
    execution.target.targetId ??
    readString(identity, 'raw_target_id') ??
    readString(identity, 'target_id') ??
    '__ads_optimizer_single_row__';

  return classifyAdsOptimizerRecommendationsBatch({
    rows: [
      {
        targetSnapshotId: '__ads_optimizer_single_row_snapshot__',
        targetId,
        payload: args.payload,
      },
    ],
    rulePackPayload: args.rulePackPayload,
  })[0]!.recommendation;
};

export const buildAdsOptimizerRecommendationSnapshots = (args: {
  rows: RecommendationRowInput[];
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
}) =>
  classifyAdsOptimizerRecommendationsBatch(args).map(({ row, recommendation }) => ({
    targetSnapshotId: row.targetSnapshotId,
    targetId: row.targetId,
    status: recommendation.status,
    actionType: recommendation.primaryActionType,
    reasonCodes: recommendation.reasonCodes,
    snapshotPayload: {
      phase: 11,
      capture_type: 'recommendation_snapshot',
      source: 'phase11_recommendation_engine',
      engine_version: recommendation.engineVersion,
      output_state: recommendation.status,
      execution_boundary: 'read_only_recommendation_only',
      writes_execution_tables: false,
      workspace_handoff: 'not_started',
      manual_review_required: true,
      target_snapshot_id: row.targetSnapshotId,
      target_id: row.targetId,
      spend_direction: recommendation.spendDirection,
      primary_action_type: recommendation.primaryActionType,
      reason_codes: recommendation.reasonCodes,
      coverage_flags: recommendation.coverageFlags,
      confidence_notes: recommendation.confidenceNotes,
      unsupported_action_blocks: recommendation.unsupportedActionBlocks,
      portfolio_controls: {
        active_discover_targets: recommendation.portfolioControls.activeDiscoverTargets,
        max_active_discover_targets: recommendation.portfolioControls.maxActiveDiscoverTargets,
        discover_rank: recommendation.portfolioControls.discoverRank,
        discover_cap_blocked: recommendation.portfolioControls.discoverCapBlocked,
        learning_budget_used: recommendation.portfolioControls.learningBudgetUsed,
        learning_budget_cap: recommendation.portfolioControls.learningBudgetCap,
        learning_budget_exceeded: recommendation.portfolioControls.learningBudgetExceeded,
        total_stop_loss_spend: recommendation.portfolioControls.totalStopLossSpend,
        total_stop_loss_cap: recommendation.portfolioControls.totalStopLossCap,
        stop_loss_cap_exceeded: recommendation.portfolioControls.stopLossCapExceeded,
        target_spend_share: recommendation.portfolioControls.targetSpendShare,
        max_budget_share_per_target: recommendation.portfolioControls.maxBudgetSharePerTarget,
        budget_share_exceeded: recommendation.portfolioControls.budgetShareExceeded,
        reason_codes: recommendation.portfolioControls.reasonCodes,
      },
      query_diagnostics: {
        context_scope: recommendation.queryDiagnostics.contextScope,
        note: recommendation.queryDiagnostics.note,
        same_text_query_pinning: {
          status: recommendation.queryDiagnostics.sameTextQueryPinning.status,
          search_term: recommendation.queryDiagnostics.sameTextQueryPinning.searchTerm,
          click_share: recommendation.queryDiagnostics.sameTextQueryPinning.clickShare,
          order_share_proxy: recommendation.queryDiagnostics.sameTextQueryPinning.orderShareProxy,
          reason_codes: recommendation.queryDiagnostics.sameTextQueryPinning.reasonCodes,
        },
        promote_to_exact_candidates: recommendation.queryDiagnostics.promoteToExactCandidates.map(
          (candidate) => ({
            search_term: candidate.searchTerm,
            same_text: candidate.sameText,
            clicks: candidate.clicks,
            orders: candidate.orders,
            spend: candidate.spend,
            sales: candidate.sales,
            stis: candidate.stis,
            stir: candidate.stir,
          })
        ),
        isolate_candidates: recommendation.queryDiagnostics.isolateCandidates.map((candidate) => ({
          search_term: candidate.searchTerm,
          same_text: candidate.sameText,
          clicks: candidate.clicks,
          orders: candidate.orders,
          spend: candidate.spend,
          sales: candidate.sales,
          stis: candidate.stis,
          stir: candidate.stir,
        })),
        negative_candidates: recommendation.queryDiagnostics.negativeCandidates.map((candidate) => ({
          search_term: candidate.searchTerm,
          same_text: candidate.sameText,
          clicks: candidate.clicks,
          orders: candidate.orders,
          spend: candidate.spend,
          sales: candidate.sales,
          stis: candidate.stis,
          stir: candidate.stir,
        })),
      },
      placement_diagnostics: {
        context_scope: recommendation.placementDiagnostics.contextScope,
        current_placement_label: recommendation.placementDiagnostics.currentPlacementLabel,
        current_placement_code: recommendation.placementDiagnostics.currentPlacementCode,
        current_percentage: recommendation.placementDiagnostics.currentPercentage,
        bias_recommendation: recommendation.placementDiagnostics.biasRecommendation,
        reason_codes: recommendation.placementDiagnostics.reasonCodes,
        note: recommendation.placementDiagnostics.note,
      },
      exception_signals: recommendation.exceptionSignals.map((signal) => ({
        type: signal.type,
        severity: signal.severity,
        title: signal.title,
        detail: signal.detail,
        reason_codes: signal.reasonCodes,
      })),
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
  }));

export const buildAdsOptimizerRecommendationSnapshot = (args: {
  targetSnapshotId: string;
  targetId: string;
  payload: RuntimeJsonObject;
  rulePackPayload?: AdsOptimizerRulePackPayload | null;
}) =>
  buildAdsOptimizerRecommendationSnapshots({
    rows: [
      {
        targetSnapshotId: args.targetSnapshotId,
        targetId: args.targetId,
        payload: args.payload,
      },
    ],
    rulePackPayload: args.rulePackPayload,
  })[0]!;
