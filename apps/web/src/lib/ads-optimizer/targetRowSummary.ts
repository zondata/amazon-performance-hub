import type { AdsOptimizerCoverageSummary } from './coverage';
import { buildAdsOptimizerCoverageSummary } from './coverage';
import type { AdsOptimizerRecommendationSnapshotView } from './recommendation';
import type { AdsOptimizerTargetRole } from './role';
import type { AdsOptimizerTargetProfileSnapshotView } from './targetProfile';
import type { AdsOptimizerRecommendationOverride } from './types';

export type AdsOptimizerTargetQueueSort =
  | 'target'
  | 'priority'
  | 'recommendations'
  | 'workspace_actions'
  | 'current_role'
  | 'efficiency'
  | 'confidence'
  | 'tier'
  | 'spend_direction'
  | 'exceptions';
export type AdsOptimizerTargetQueueSortDirection = 'asc' | 'desc';
export type AdsOptimizerTargetFilterValue = 'all' | string;
export type AdsOptimizerTargetExceptionFilterValue =
  | 'all'
  | 'has_exception'
  | 'high_severity'
  | 'manual_review_required';

type WorkspaceSupportedActionType =
  | 'update_target_bid'
  | 'update_target_state'
  | 'update_placement_modifier';

type TargetReviewRowLike = AdsOptimizerTargetProfileSnapshotView & {
  persistedTargetKey: string;
  recommendation: AdsOptimizerRecommendationSnapshotView | null;
  manualOverride?: AdsOptimizerRecommendationOverride | null;
  queue: {
    priority: number | null;
    recommendationCount: number;
    primaryActionType: string | null;
    spendDirection: string | null;
    reasonCodeBadges: string[];
    readOnlyBoundary: string | null;
    hasCoverageGaps: boolean;
  };
};

export type AdsOptimizerTargetRowSummary = {
  rowId: string;
  targetSnapshotId: string;
  persistedTargetKey: string;
  targetId: string;
  targetText: string;
  targetMeta: string;
  parentMeta: string;
  tier: {
    value: string | null;
    label: string;
    detail: string;
  };
  economics: {
    headline: string;
    detail: string;
    spend: number;
    sales: number;
    orders: number;
    acos: number | null;
  };
  efficiency: {
    value: string | null;
    label: string;
  };
  confidence: {
    value: string | null;
    label: string;
  };
  role: {
    currentValue: AdsOptimizerTargetRole | null;
    currentLabel: string;
    nextValue: AdsOptimizerTargetRole | null;
    nextLabel: string;
    changed: boolean;
    summary: string;
  };
  organicRank: {
    status: 'ready' | 'limited' | 'missing';
    label: string;
    detail: string;
  };
  trend: {
    value: string | null;
    label: string;
    detail: string;
    status: 'ready' | 'missing';
  };
  contribution: {
    value: number | null;
    label: string;
    detail: string;
  };
  change: {
    priority: number | null;
    priorityLabel: string;
    spendDirection: string | null;
    primaryActionType: string | null;
    recommendationCount: number;
    workspaceActionCount: number;
    reviewOnlyActionCount: number;
    summary: string;
  };
  searchTermDiagnosis: {
    status: 'ready' | 'limited' | 'missing';
    label: string;
    detail: string;
  };
  coverage: {
    summary: AdsOptimizerCoverageSummary;
    hasGaps: boolean;
    criticalWarningCount: number;
    rowSpecificExceptionCount: number;
  };
  reasonCodeBadges: string[];
  exceptionFlags: {
    count: number;
    highestSeverity: 'high' | 'medium' | 'low' | null;
    manualReviewRequired: boolean;
    criticalWarningCount: number;
    rowSpecificExceptionCount: number;
  };
  handoff: {
    stageable: boolean;
    workspaceActionCount: number;
    reviewOnlyActionCount: number;
    hasManualOverride: boolean;
    overrideBadgeLabel: string | null;
    overrideNote: string | null;
  };
  sort: {
    priority: number | null;
    recommendationCount: number;
    workspaceActionCount: number;
    currentRole: string;
    efficiency: string;
    confidence: string;
    tier: string;
    spendDirection: string | null;
    highestExceptionSeverityRank: number;
    exceptionCount: number;
    manualReviewRequired: boolean;
    riskScore: number | null;
    opportunityScore: number | null;
    targetText: string;
  };
};

export type AdsOptimizerTargetQueueFilters = {
  role: AdsOptimizerTargetFilterValue;
  efficiency: AdsOptimizerTargetFilterValue;
  tier: AdsOptimizerTargetFilterValue;
  confidence: AdsOptimizerTargetFilterValue;
  spendDirection: AdsOptimizerTargetFilterValue;
  exceptions: AdsOptimizerTargetExceptionFilterValue;
  sortBy: AdsOptimizerTargetQueueSort;
  sortDirection: AdsOptimizerTargetQueueSortDirection;
};

const formatNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const labelize = (value: string | null) =>
  value
    ? value
        .split(/[_\s]+/)
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join(' ')
    : 'Not captured';

const buildPriorityLabel = (priority: number | null, actionType: string | null) => {
  if (priority === null) return 'Monitor only';
  return `P${Math.max(1, Math.round(priority / 10))} · ${labelize(actionType)}`;
};

const getSeverityRank = (severity: 'high' | 'medium' | 'low') => {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
};

const isWorkspaceSupportedActionType = (
  value: string
): value is WorkspaceSupportedActionType =>
  value === 'update_target_bid' ||
  value === 'update_target_state' ||
  value === 'update_placement_modifier';

const getWorkspaceSupportedActions = (row: TargetReviewRowLike) =>
  (
    row.manualOverride?.replacement_action_bundle_json.actions.map((action) => ({
      actionType: action.action_type,
    })) ??
    row.recommendation?.actions ??
    []
  ).filter((action) => isWorkspaceSupportedActionType(action.actionType));

const getUnsupportedReviewOnlyActions = (row: TargetReviewRowLike) =>
  (row.recommendation?.actions ?? []).filter(
    (action) => !isWorkspaceSupportedActionType(action.actionType)
  );

const buildOverrideBadgeLabel = (override: AdsOptimizerRecommendationOverride) =>
  override.override_scope === 'persistent' ? 'Human override · persistent' : 'Human override';

const getHighestExceptionSeverity = (
  row: TargetReviewRowLike
): 'high' | 'medium' | 'low' | null => {
  const exceptionSignals = row.recommendation?.exceptionSignals ?? [];
  if (exceptionSignals.some((signal) => signal.severity === 'high')) return 'high';
  if (exceptionSignals.some((signal) => signal.severity === 'medium')) return 'medium';
  if (exceptionSignals.some((signal) => signal.severity === 'low')) return 'low';
  return null;
};

const hasManualReviewRequirement = (row: TargetReviewRowLike) =>
  row.recommendation?.manualReviewRequired === true ||
  row.role.guardrails.flags.requiresManualApproval ||
  row.role.guardrails.flags.autoPauseEligible ||
  row.role.guardrails.flags.transitionLocked;

const compareNullableNumber = (left: number | null, right: number | null) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};

const compareNullableString = (left: string | null, right: string | null) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
};

const buildOrganicRankSummary = (row: TargetReviewRowLike) => {
  if (row.derived.organicContextSignal) {
    return {
      status: 'limited' as const,
      label: labelize(row.derived.organicContextSignal),
      detail:
        'Target-owned organic rank is not captured in the target snapshot. This organic context signal is directional only.',
    };
  }

  return {
    status: 'missing' as const,
    label: 'Rank context unavailable',
    detail:
      'No target-owned organic rank or safe contextual proxy was captured for this row in the selected run.',
  };
};

const buildTrendSummary = (row: TargetReviewRowLike) => {
  const signal = row.derived.organicContextSignal;
  if (signal === 'same_text_visibility_context') {
    return {
      value: signal,
      label: 'Same-text visibility',
      detail:
        'Trend context is based on same-text search-term visibility only, not target-owned rank.',
      status: 'ready' as const,
    };
  }
  if (signal === 'search_term_visibility_context') {
    return {
      value: signal,
      label: 'Search-term visibility',
      detail:
        'Trend context is based on search-term visibility only, not target-owned rank.',
      status: 'ready' as const,
    };
  }
  if (signal === 'top_of_search_visibility_context') {
    return {
      value: signal,
      label: 'Top-of-search visibility',
      detail:
        'Trend context is based on top-of-search visibility only, not target-owned rank.',
      status: 'ready' as const,
    };
  }

  return {
    value: null,
    label: 'Trend unavailable',
    detail: 'No safe organic visibility trend context was captured for this target in the run.',
    status: 'missing' as const,
  };
};

const buildContributionSummary = (row: TargetReviewRowLike) => {
  const value = row.derived.contributionAfterAds;
  if (value === null) {
    return {
      value,
      label: 'Contribution unavailable',
      detail: 'Contribution after ads could not be computed from the captured target inputs.',
    };
  }

  if (value < 0) {
    return {
      value,
      label: formatCurrency(value),
      detail: 'Contribution after ads is negative for this row in the selected window.',
    };
  }

  return {
    value,
    label: formatCurrency(value),
    detail: 'Contribution after ads is positive for this row in the selected window.',
  };
};

const buildSearchTermDiagnosis = (row: TargetReviewRowLike) => {
  const pinning = row.recommendation?.queryDiagnostics?.sameTextQueryPinning;
  if (pinning?.status === 'degrading') {
    return {
      status: 'ready' as const,
      label: 'Same-text degrading',
      detail: row.recommendation?.queryDiagnostics?.note ?? 'Same-text query coverage is degrading.',
    };
  }
  if (pinning?.status === 'pinned') {
    return {
      status: 'ready' as const,
      label: 'Same-text pinned',
      detail: row.recommendation?.queryDiagnostics?.note ?? 'Same-text query coverage is pinned.',
    };
  }
  if ((row.recommendation?.queryDiagnostics?.promoteToExactCandidates.length ?? 0) > 0) {
    return {
      status: 'ready' as const,
      label: 'Promote exact',
      detail: 'A promote-to-exact candidate was persisted for this target.',
    };
  }
  if ((row.recommendation?.queryDiagnostics?.isolateCandidates.length ?? 0) > 0) {
    return {
      status: 'ready' as const,
      label: 'Isolate candidate',
      detail: 'An isolate-query candidate was persisted for this target.',
    };
  }
  if ((row.recommendation?.queryDiagnostics?.negativeCandidates.length ?? 0) > 0) {
    return {
      status: 'ready' as const,
      label: 'Negative candidate',
      detail: 'A negative-query candidate was persisted for this target.',
    };
  }
  if (row.searchTermDiagnostics.topTerms.length > 0) {
    return {
      status: 'limited' as const,
      label: 'Search-term context',
      detail:
        row.searchTermDiagnostics.note ??
        'Search-term context exists, but no stronger candidate or same-text pinning signal was persisted.',
    };
  }
  if (row.coverage.statuses.searchTerms === 'expected_unavailable') {
    return {
      status: 'limited' as const,
      label: 'Expected unavailable',
      detail:
        'Search-term diagnostics are expected to be unavailable here, usually because the row had no click volume.',
    };
  }

  return {
    status: 'missing' as const,
    label: 'Search terms missing',
    detail:
      row.searchTermDiagnostics.note ??
      'No search-term diagnostic chip could be derived from the selected run.',
  };
};

const buildEconomicsSummary = (row: TargetReviewRowLike) => ({
  headline: `Spend ${formatCurrency(row.raw.spend)} · Sales ${formatCurrency(row.raw.sales)}`,
  detail: `Orders ${formatNumber(row.raw.orders)} · ACoS ${formatPercent(row.raw.acos)}`,
  spend: row.raw.spend,
  sales: row.raw.sales,
  orders: row.raw.orders,
  acos: row.raw.acos,
});

const buildCoverageItems = (row: TargetReviewRowLike) => [
  { label: 'TOS', status: row.coverage.statuses.tosIs },
  { label: 'STIS', status: row.coverage.statuses.stis },
  { label: 'STIR', status: row.coverage.statuses.stir },
  { label: 'Place', status: row.coverage.statuses.placementContext },
  { label: 'Terms', status: row.coverage.statuses.searchTerms },
  { label: 'BE', status: row.coverage.statuses.breakEvenInputs },
] as const;

export const buildAdsOptimizerTargetRowSummary = (
  row: TargetReviewRowLike
): AdsOptimizerTargetRowSummary => {
  const workspaceSupportedActions = getWorkspaceSupportedActions(row);
  const unsupportedReviewOnlyActions = getUnsupportedReviewOnlyActions(row);
  const highestExceptionSeverity = getHighestExceptionSeverity(row);
  const criticalWarningCount = row.coverage.criticalWarnings.length + (row.recommendation ? 0 : 1);
  const rowSpecificExceptionCount = row.coverage.notes.length;

  return {
    rowId: row.targetSnapshotId,
    targetSnapshotId: row.targetSnapshotId,
    persistedTargetKey: row.persistedTargetKey,
    targetId: row.targetId,
    targetText: row.targetText,
    targetMeta: `${row.typeLabel ?? 'Target'} · ${row.matchType ?? '—'} · ${row.targetId}`,
    parentMeta: `${row.campaignName ?? row.campaignId} / ${row.adGroupName ?? row.adGroupId}`,
    tier: {
      value: row.state.importance.value,
      label: row.state.importance.label,
      detail: row.state.importance.detail,
    },
    economics: buildEconomicsSummary(row),
    efficiency: {
      value: row.state.efficiency.value,
      label: row.state.efficiency.label,
    },
    confidence: {
      value: row.state.confidence.value,
      label: row.state.confidence.label,
    },
    role: {
      currentValue: row.role.currentRole.value,
      currentLabel: row.role.currentRole.label,
      nextValue: row.role.desiredRole.value,
      nextLabel: row.role.desiredRole.label,
      changed: row.role.currentRole.label !== row.role.desiredRole.label,
      summary:
        row.role.currentRole.label === row.role.desiredRole.label
          ? row.role.currentRole.label
          : `${row.role.currentRole.label} → ${row.role.desiredRole.label}`,
    },
    organicRank: buildOrganicRankSummary(row),
    trend: buildTrendSummary(row),
    contribution: buildContributionSummary(row),
    change: {
      priority: row.queue.priority,
      priorityLabel: buildPriorityLabel(row.queue.priority, row.queue.primaryActionType),
      spendDirection: row.queue.spendDirection,
      primaryActionType: row.queue.primaryActionType,
      recommendationCount: row.queue.recommendationCount,
      workspaceActionCount: workspaceSupportedActions.length,
      reviewOnlyActionCount: unsupportedReviewOnlyActions.length,
      summary: `${labelize(row.queue.spendDirection).toLowerCase()} · ${formatNumber(
        row.queue.recommendationCount
      )} rec(s) · ${formatNumber(workspaceSupportedActions.length)} stageable`,
    },
    searchTermDiagnosis: buildSearchTermDiagnosis(row),
    coverage: {
      summary: buildAdsOptimizerCoverageSummary(buildCoverageItems(row)),
      hasGaps: row.queue.hasCoverageGaps,
      criticalWarningCount,
      rowSpecificExceptionCount,
    },
    reasonCodeBadges: row.queue.reasonCodeBadges,
    exceptionFlags: {
      count: row.recommendation?.exceptionSignals.length ?? 0,
      highestSeverity: highestExceptionSeverity,
      manualReviewRequired: hasManualReviewRequirement(row),
      criticalWarningCount,
      rowSpecificExceptionCount,
    },
    handoff: {
      stageable: workspaceSupportedActions.length > 0,
      workspaceActionCount: workspaceSupportedActions.length,
      reviewOnlyActionCount: unsupportedReviewOnlyActions.length,
      hasManualOverride: Boolean(row.manualOverride),
      overrideBadgeLabel: row.manualOverride ? buildOverrideBadgeLabel(row.manualOverride) : null,
      overrideNote: row.manualOverride?.operator_note ?? null,
    },
    sort: {
      priority: row.queue.priority,
      recommendationCount: row.queue.recommendationCount,
      workspaceActionCount: workspaceSupportedActions.length,
      currentRole: row.role.currentRole.label,
      efficiency: row.state.efficiency.label,
      confidence: row.state.confidence.label,
      tier: row.state.importance.label,
      spendDirection: row.queue.spendDirection,
      highestExceptionSeverityRank: highestExceptionSeverity
        ? getSeverityRank(highestExceptionSeverity)
        : 0,
      exceptionCount: row.recommendation?.exceptionSignals.length ?? 0,
      manualReviewRequired: hasManualReviewRequirement(row),
      riskScore: row.state.riskScore,
      opportunityScore: row.state.opportunityScore,
      targetText: row.targetText,
    },
  };
};

export const buildAdsOptimizerTargetRowSummaries = (rows: TargetReviewRowLike[]) =>
  rows.map(buildAdsOptimizerTargetRowSummary);

export const getDefaultAdsOptimizerTargetQueueSortDirection = (
  sortBy: AdsOptimizerTargetQueueSort
): AdsOptimizerTargetQueueSortDirection =>
  sortBy === 'recommendations' ||
  sortBy === 'workspace_actions' ||
  sortBy === 'exceptions'
    ? 'desc'
    : 'asc';

const compareRowSummariesByDefault = (
  left: AdsOptimizerTargetRowSummary,
  right: AdsOptimizerTargetRowSummary
) =>
  compareNullableNumber(left.sort.priority, right.sort.priority) ||
  right.sort.recommendationCount - left.sort.recommendationCount ||
  compareNullableNumber(right.sort.riskScore, left.sort.riskScore) ||
  compareNullableNumber(right.sort.opportunityScore, left.sort.opportunityScore) ||
  left.sort.targetText.localeCompare(right.sort.targetText);

export const compareAdsOptimizerTargetRowSummaries = (
  left: AdsOptimizerTargetRowSummary,
  right: AdsOptimizerTargetRowSummary,
  sortBy: AdsOptimizerTargetQueueSort,
  direction: AdsOptimizerTargetQueueSortDirection
) => {
  let comparison = 0;

  switch (sortBy) {
    case 'target':
      comparison = left.sort.targetText.localeCompare(right.sort.targetText);
      break;
    case 'priority':
      comparison = compareNullableNumber(left.sort.priority, right.sort.priority);
      break;
    case 'recommendations':
      comparison = left.sort.recommendationCount - right.sort.recommendationCount;
      break;
    case 'workspace_actions':
      comparison = left.sort.workspaceActionCount - right.sort.workspaceActionCount;
      break;
    case 'current_role':
      comparison = left.sort.currentRole.localeCompare(right.sort.currentRole);
      break;
    case 'efficiency':
      comparison = left.sort.efficiency.localeCompare(right.sort.efficiency);
      break;
    case 'confidence':
      comparison = left.sort.confidence.localeCompare(right.sort.confidence);
      break;
    case 'tier':
      comparison = left.sort.tier.localeCompare(right.sort.tier);
      break;
    case 'spend_direction':
      comparison = compareNullableString(left.sort.spendDirection, right.sort.spendDirection);
      break;
    case 'exceptions':
      comparison =
        left.sort.highestExceptionSeverityRank - right.sort.highestExceptionSeverityRank ||
        left.sort.exceptionCount - right.sort.exceptionCount ||
        Number(left.sort.manualReviewRequired) - Number(right.sort.manualReviewRequired);
      break;
  }

  return (
    (direction === 'asc' ? comparison : -comparison) ||
    compareRowSummariesByDefault(left, right)
  );
};

export const filterAdsOptimizerTargetRowSummaries = (
  rowSummaries: AdsOptimizerTargetRowSummary[],
  filters: AdsOptimizerTargetQueueFilters
) =>
  [...rowSummaries]
    .filter((row) => (filters.role === 'all' ? true : row.role.currentValue === filters.role))
    .filter((row) =>
      filters.efficiency === 'all' ? true : row.efficiency.value === filters.efficiency
    )
    .filter((row) => (filters.tier === 'all' ? true : row.tier.value === filters.tier))
    .filter((row) =>
      filters.confidence === 'all' ? true : row.confidence.value === filters.confidence
    )
    .filter((row) =>
      filters.spendDirection === 'all'
        ? true
        : row.change.spendDirection === filters.spendDirection
    )
    .filter((row) => {
      if (filters.exceptions === 'all') return true;
      if (filters.exceptions === 'has_exception') return row.exceptionFlags.count > 0;
      if (filters.exceptions === 'high_severity') {
        return row.exceptionFlags.highestSeverity === 'high';
      }
      return row.exceptionFlags.manualReviewRequired;
    })
    .sort((left, right) =>
      compareAdsOptimizerTargetRowSummaries(left, right, filters.sortBy, filters.sortDirection)
    );
