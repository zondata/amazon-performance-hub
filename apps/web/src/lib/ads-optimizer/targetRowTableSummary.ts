import type { AdsOptimizerTargetRole } from './role';
import type { AdsOptimizerTargetReviewRow } from './runtime';

export type AdsOptimizerTargetTableSort =
  | 'target'
  | 'priority'
  | 'recommendations'
  | 'workspace_actions'
  | 'current_role'
  | 'efficiency'
  | 'confidence'
  | 'tier'
  | 'spend_direction'
  | 'exceptions'
  | 'state_current_profit_loss'
  | 'state_current_acos'
  | 'economics_current_spend'
  | 'economics_current_sales'
  | 'economics_current_orders'
  | 'contribution_sales_rank'
  | 'contribution_spend_rank'
  | 'contribution_impression_rank'
  | 'contribution_sqp_impression_rank'
  | 'ranking_organic_latest'
  | 'ranking_organic_trend';
export type AdsOptimizerTargetTableSortDirection = 'asc' | 'desc';
export type AdsOptimizerTargetFilterValue = 'all' | string;
export type AdsOptimizerTargetExceptionFilterValue =
  | 'all'
  | 'has_exception'
  | 'high_severity'
  | 'manual_review_required';

type WorkspaceSupportedActionType =
  | 'update_target_bid'
  | 'update_target_state'
  | 'update_campaign_bidding_strategy'
  | 'update_placement_modifier';

type SummaryTone = 'good' | 'bad' | 'neutral' | 'missing';

type SummaryValue<T = string | number | null> = {
  raw: T;
  display: string;
  tone: SummaryTone;
};

type ComparisonMetricRow<T = string | number | null> = {
  label: string;
  current: SummaryValue<T>;
  previous: SummaryValue<T>;
  change: SummaryValue<T>;
};

type RankTrendLabel =
  | 'Rising'
  | 'Maintain'
  | 'Decline'
  | 'Limited data'
  | 'No data'
  | 'No snapshot'
  | 'Negative keyword'
  | 'Product target'
  | 'No keyword map'
  | 'Ranking unavailable';

type RankingObservation = {
  observedDate: string | null;
  rank: number | null;
};
type ContributionRowLabel = 'Sales' | 'Spend' | 'Impression' | 'SQP Impression';

type TargetReviewRowLike = AdsOptimizerTargetReviewRow;

export type AdsOptimizerTargetRowTableSummary = {
  rowId: string;
  targetSnapshotId: string;
  persistedTargetKey: string;
  identity: {
    targetText: string;
    targetKindLabel: string;
    matchTypeLabel: string;
    targetIdLabel: string;
    campaignLabel: string;
    adGroupLabel: string;
    campaignContextLabel: string;
    tierValue: string | null;
    tierLabel: string;
    priorityLabel: string;
    prioritySortValue: number | null;
    overrideBadgeLabel: string | null;
  };
  stateComparison: {
    stateValue: string | null;
    efficiencyValue: string | null;
    confidenceValue: string | null;
    rows: [
      ComparisonMetricRow<string | null>,
      ComparisonMetricRow<number | null>,
      ComparisonMetricRow<number | null>,
      ComparisonMetricRow<number | null>,
    ];
  };
  economicsComparison: {
    rows: [
      ComparisonMetricRow<number | null>,
      ComparisonMetricRow<number | null>,
      ComparisonMetricRow<number | null>,
    ];
  };
  contribution: {
    rows: Array<{
      label: ContributionRowLabel;
      value: number | null;
      share: SummaryValue<number | null>;
      rank: SummaryValue<number | null>;
    }>;
  };
  ranking: {
    organic: {
      latestRank: number | null;
      latestLabel: string;
      trendLabel: RankTrendLabel;
    };
    sponsored: {
      latestRank: number | null;
      latestLabel: string;
      trendLabel: RankTrendLabel;
    };
  };
  role: {
    currentValue: AdsOptimizerTargetRole | null;
    currentLabel: string;
    nextValue: AdsOptimizerTargetRole | null;
    nextLabel: string;
  };
  lastChange: {
    detectedDate: string | null;
    items: Array<{
      key: string;
      label: string;
      previousDisplay: string;
      currentDisplay: string;
      deltaPercentLabel: string | null;
      deltaDirection: 'positive' | 'negative' | null;
    }>;
    overflowCount: number;
    emptyMessage: string | null;
  };
  changeSummary: {
    lines: string[];
    overflowCount: number;
    emptyMessage: string | null;
    supportedChangeCount: number;
  };
  handoff: {
    stageable: boolean;
    workspaceActionCount: number;
    reviewOnlyActionCount: number;
    hasManualOverride: boolean;
  };
  exceptionFlags: {
    count: number;
    highestSeverity: 'high' | 'medium' | 'low' | null;
    manualReviewRequired: boolean;
  };
  filters: {
    role: AdsOptimizerTargetRole | null;
    efficiency: string | null;
    confidence: string | null;
    tier: string | null;
    spendDirection: string | null;
    trendContext: string | null;
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
    currentProfitLoss: number | null;
    currentAcos: number | null;
    currentSpend: number | null;
    currentSales: number | null;
    currentOrders: number | null;
    contributionSalesRank: number | null;
    contributionSpendRank: number | null;
    contributionImpressionRank: number | null;
    contributionSqpImpressionRank: number | null;
    organicLatestRank: number | null;
    organicTrendScore: number | null;
  };
};

export type AdsOptimizerTargetTableFilters = {
  role: AdsOptimizerTargetFilterValue;
  efficiency: AdsOptimizerTargetFilterValue;
  tier: AdsOptimizerTargetFilterValue;
  confidence: AdsOptimizerTargetFilterValue;
  spendDirection: AdsOptimizerTargetFilterValue;
  exceptions: AdsOptimizerTargetExceptionFilterValue;
  targetSearch: string;
  sortBy: AdsOptimizerTargetTableSort;
  sortDirection: AdsOptimizerTargetTableSortDirection;
};

const formatNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatSignedNumber = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}`;
};

const formatCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
};

const formatSignedCurrency = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  });
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${value === 0 ? abs : abs.replace(/^-/, '')}`;
};

const formatPercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatSignedPercentPointDelta = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const points = value * 100;
  return `${points > 0 ? '+' : ''}${points.toFixed(1)}pp`;
};

const formatShare = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatRankValue = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  return `#${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const formatWholePercent = (value: number | null) => {
  if (value === null || !Number.isFinite(value)) return '—';
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)}%`;
};

const labelize = (value: string | null) =>
  value
    ? value
        .split(/[_\s]+/)
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1).toLowerCase() : part))
        .join(' ')
    : '—';

const buildPriorityLabel = (priority: number | null, actionType: string | null) => {
  if (priority === null) return 'Monitor only';
  return `P${Math.max(1, Math.round(priority / 10))} · ${labelize(actionType)}`;
};

const buildOverrideBadgeLabel = (row: TargetReviewRowLike) =>
  row.manualOverride
    ? row.manualOverride.override_scope === 'persistent'
      ? 'Override'
      : 'One-time override'
    : null;

const getSeverityRank = (severity: 'high' | 'medium' | 'low') => {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
};

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

const compareMissingLastNumber = (
  left: number | null,
  right: number | null,
  direction: AdsOptimizerTargetTableSortDirection
) => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === 'asc' ? left - right : right - left;
};

const normalizeSearchToken = (value: string | null | undefined) => {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
};

const isWorkspaceSupportedActionType = (
  value: string
): value is WorkspaceSupportedActionType =>
  value === 'update_target_bid' ||
  value === 'update_target_state' ||
  value === 'update_campaign_bidding_strategy' ||
  value === 'update_placement_modifier';

const getEffectiveStageableActions = (row: TargetReviewRowLike) =>
  (
    row.manualOverride?.replacement_action_bundle_json.actions.map((action) => ({
      actionType: action.action_type,
      entityContext: action.entity_context_json,
      proposedChange: action.proposed_change_json,
    })) ??
    row.recommendation?.actions ??
    []
  ).filter((action) => isWorkspaceSupportedActionType(action.actionType));

const getReviewOnlyActionCount = (row: TargetReviewRowLike) =>
  (row.recommendation?.actions ?? []).filter(
    (action) => !isWorkspaceSupportedActionType(action.actionType)
  ).length;

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

const getCurrentProfitLoss = (row: TargetReviewRowLike | TargetReviewRowLike['previousComparable']) => {
  if (!row) return null;
  if (row.derived.profitDollars !== null) return row.derived.profitDollars;
  if (row.derived.lossDollars !== null) return -Math.abs(row.derived.lossDollars);
  return row.derived.contributionAfterAds;
};

const getBreakEvenAcos = (row: TargetReviewRowLike | TargetReviewRowLike['previousComparable']) => {
  if (!row) return null;
  if (row.raw.acos === null || row.derived.breakEvenGap === null) return null;
  return row.raw.acos + row.derived.breakEvenGap;
};

const efficiencyRank = (value: string | null) => {
  if (value === 'profitable') return 4;
  if (value === 'break_even') return 3;
  if (value === 'converting_but_loss_making') return 2;
  if (value === 'learning_no_sale') return 1;
  return null;
};

const buildStateChangeSummary = (
  currentValue: string | null,
  currentLabel: string,
  previousValue: string | null,
  previousLabel: string
): SummaryValue<string | null> => {
  if (!previousValue) {
    return { raw: null, display: '—', tone: 'missing' };
  }
  if (currentValue === previousValue) {
    return { raw: currentValue, display: 'No change', tone: 'neutral' };
  }

  const currentRank = efficiencyRank(currentValue);
  const previousRank = efficiencyRank(previousValue);
  if (currentRank !== null && previousRank !== null) {
    if (currentRank > previousRank) {
      return { raw: currentValue, display: 'Improved', tone: 'good' };
    }
    if (currentRank < previousRank) {
      return { raw: currentValue, display: 'Declined', tone: 'bad' };
    }
  }

  return {
    raw: currentValue,
    display: currentLabel === previousLabel ? 'No change' : 'Changed',
    tone: 'neutral',
  };
};

const buildMetricDelta = (args: {
  current: number | null;
  previous: number | null;
  formatter: (value: number | null) => string;
  higherIsBetter?: boolean;
  lowerIsBetter?: boolean;
  neutral?: boolean;
}): SummaryValue<number | null> => {
  if (args.previous === null || args.current === null) {
    return { raw: null, display: '—', tone: 'missing' };
  }

  const delta = args.current - args.previous;
  let tone: SummaryTone = 'neutral';
  if (!args.neutral && delta !== 0) {
    if (args.higherIsBetter) tone = delta > 0 ? 'good' : 'bad';
    if (args.lowerIsBetter) tone = delta < 0 ? 'good' : 'bad';
  }

  return {
    raw: delta,
    display: args.formatter(delta),
    tone,
  };
};

const buildCurrencyMetricRow = (
  label: string,
  current: number | null,
  previous: number | null,
  opts: { higherIsBetter?: boolean; neutral?: boolean } = {}
): ComparisonMetricRow<number | null> => ({
  label,
  current: {
    raw: current,
    display: formatCurrency(current),
    tone: current === null ? 'missing' : 'neutral',
  },
  previous: {
    raw: previous,
    display: formatCurrency(previous),
    tone: previous === null ? 'missing' : 'neutral',
  },
  change: buildMetricDelta({
    current,
    previous,
    formatter: formatSignedCurrency,
    higherIsBetter: opts.higherIsBetter,
    neutral: opts.neutral,
  }),
});

const buildCountMetricRow = (
  label: string,
  current: number | null,
  previous: number | null,
  higherIsBetter: boolean
): ComparisonMetricRow<number | null> => ({
  label,
  current: {
    raw: current,
    display: formatNumber(current),
    tone: current === null ? 'missing' : 'neutral',
  },
  previous: {
    raw: previous,
    display: formatNumber(previous),
    tone: previous === null ? 'missing' : 'neutral',
  },
  change: buildMetricDelta({
    current,
    previous,
    formatter: formatSignedNumber,
    higherIsBetter,
  }),
});

const buildPercentMetricRow = (
  label: string,
  current: number | null,
  previous: number | null,
  opts: { lowerIsBetter?: boolean; neutral?: boolean } = {}
): ComparisonMetricRow<number | null> => ({
  label,
  current: {
    raw: current,
    display: formatPercent(current),
    tone: current === null ? 'missing' : 'neutral',
  },
  previous: {
    raw: previous,
    display: formatPercent(previous),
    tone: previous === null ? 'missing' : 'neutral',
  },
  change: buildMetricDelta({
    current,
    previous,
    formatter: formatSignedPercentPointDelta,
    lowerIsBetter: opts.lowerIsBetter,
    neutral: opts.neutral,
  }),
});

const formatPlacementCodeShort = (value: string | null) => {
  if (value === 'PLACEMENT_TOP') return 'TOS';
  if (value === 'PLACEMENT_REST_OF_SEARCH') return 'ROS';
  if (value === 'PLACEMENT_PRODUCT_PAGE') return 'PP';
  return labelize(value);
};

const readActionString = (value: Record<string, unknown> | null, key: string) =>
  typeof value?.[key] === 'string' ? (value[key] as string) : null;

const readActionNumber = (value: Record<string, unknown> | null, key: string) => {
  const raw = value?.[key];
  if (raw === null || raw === undefined || raw === '') return null;
  const numeric = Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
};

const buildActionLine = (action: ReturnType<typeof getEffectiveStageableActions>[number]) => {
  if (action.actionType === 'update_target_bid') {
    const currentBid = readActionNumber(action.entityContext, 'current_bid');
    const nextBid = readActionNumber(action.proposedChange, 'next_bid');
    if (currentBid !== null && nextBid !== null) {
      const verb = nextBid > currentBid ? 'Increase' : nextBid < currentBid ? 'Reduce' : 'Keep';
      return `${verb} bid from ${formatCurrency(currentBid)} to ${formatCurrency(nextBid)}`;
    }
    if (nextBid !== null) {
      return `Change bid to ${formatCurrency(nextBid)}`;
    }
    return 'Change bid';
  }

  if (action.actionType === 'update_target_state') {
    const currentState = readActionString(action.entityContext, 'current_state');
    const nextState = readActionString(action.proposedChange, 'next_state');
    if (currentState && nextState) {
      return `Change state from ${currentState} to ${nextState}`;
    }
    if (nextState) return `Change state to ${nextState}`;
    return 'Change state';
  }

  if (action.actionType === 'update_campaign_bidding_strategy') {
    const currentStrategy = readActionString(action.entityContext, 'current_bidding_strategy');
    const newStrategy = readActionString(action.proposedChange, 'new_strategy');
    if (currentStrategy && newStrategy) {
      return `Change campaign strategy from ${currentStrategy} to ${newStrategy}`;
    }
    if (newStrategy) return `Set campaign strategy to ${newStrategy}`;
    return 'Change campaign strategy';
  }

  const placementCode =
    readActionString(action.entityContext, 'placement_code') ??
    readActionString(action.proposedChange, 'placement_code');
  const currentPct = readActionNumber(action.entityContext, 'current_percentage');
  const nextPct = readActionNumber(action.proposedChange, 'next_percentage');
  const placementLabel = formatPlacementCodeShort(placementCode);
  if (currentPct !== null && nextPct !== null) {
    const verb = nextPct > currentPct ? 'Increase' : nextPct < currentPct ? 'Reduce' : 'Keep';
    return `${verb} ${placementLabel} modifier from ${formatWholePercent(currentPct)} to ${formatWholePercent(nextPct)}`;
  }
  if (nextPct !== null) {
    return `Change ${placementLabel} modifier to ${formatWholePercent(nextPct)}`;
  }
  return `Change ${placementLabel} modifier`;
};

const buildContributionRankMap = (
  rows: TargetReviewRowLike[],
  valueSelector: (row: TargetReviewRowLike) => number
) =>
  new Map(
    [...rows]
      .sort(
        (left, right) =>
          valueSelector(right) - valueSelector(left) ||
          left.persistedTargetKey.localeCompare(right.persistedTargetKey)
      )
      .map((row, index) => [row.persistedTargetKey, index + 1] as const)
  );

const median = (values: number[]) => {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle] ?? null;
  const left = ordered[middle - 1];
  const right = ordered[middle];
  if (left === undefined || right === undefined) return null;
  return (left + right) / 2;
};

const getRankThreshold = (priorMedian: number) => {
  if (priorMedian <= 10) return 2;
  if (priorMedian <= 45) return 5;
  if (priorMedian <= 90) return 8;
  return 12;
};

export const classifyAdsOptimizerRankingTrend = (
  observations: RankingObservation[]
): {
  latestRank: number | null;
  trendLabel: RankTrendLabel;
} => {
  const ordered = [...observations]
    .sort((left, right) => {
      const leftDate = left.observedDate ?? '';
      const rightDate = right.observedDate ?? '';
      return leftDate.localeCompare(rightDate);
    })
    .map((entry) => entry.rank)
    .filter((rank): rank is number => rank !== null && Number.isFinite(rank));

  if (ordered.length === 0) {
    return {
      latestRank: null,
      trendLabel: 'No data',
    };
  }

  const latestRank = ordered[ordered.length - 1] ?? null;
  if (ordered.length < 4) {
    return {
      latestRank,
      trendLabel: 'Limited data',
    };
  }

  const latestBucket = ordered.slice(-3);
  const priorBucket = ordered.slice(Math.max(0, ordered.length - 6), Math.max(0, ordered.length - 3));
  const latestMedian = median(latestBucket);
  const priorMedian = median(priorBucket);
  if (latestMedian === null || priorMedian === null) {
    return {
      latestRank,
      trendLabel: 'Limited data',
    };
  }

  const threshold = getRankThreshold(priorMedian);
  if (latestMedian <= priorMedian - threshold) {
    return { latestRank, trendLabel: 'Rising' };
  }
  if (latestMedian >= priorMedian + threshold) {
    return { latestRank, trendLabel: 'Decline' };
  }
  return { latestRank, trendLabel: 'Maintain' };
};

const hasFiniteRankingObservation = (observations: RankingObservation[]) =>
  observations.some((entry) => entry.rank !== null && Number.isFinite(entry.rank));

const buildRankingReasonLabel = (args: {
  status: 'ready' | 'unsupported' | 'unavailable' | null;
  note: string | null;
}): RankTrendLabel => {
  if (args.status === 'unavailable') {
    return 'Ranking unavailable';
  }
  if (
    args.note?.includes('negative keyword') ||
    args.note?.includes('negative keywords')
  ) {
    return 'Negative keyword';
  }
  if (args.note?.includes('targeting-expression')) {
    return 'Product target';
  }
  if (args.note?.includes('no deterministic keyword mapping')) {
    return 'No keyword map';
  }
  return 'No keyword map';
};

const buildRankingSummaryBlock = (args: {
  observations: RankingObservation[];
  status: 'ready' | 'unsupported' | 'unavailable' | null;
  note: string | null;
}) => {
  if (args.status === 'unsupported') {
    return {
      latestRank: null,
      latestLabel: 'Unsupported',
      trendLabel: buildRankingReasonLabel(args),
    };
  }

  if (args.status === 'unavailable') {
    return {
      latestRank: null,
      latestLabel: 'Unavailable',
      trendLabel: buildRankingReasonLabel(args),
    };
  }

  const hasObservations = hasFiniteRankingObservation(args.observations);
  if (!hasObservations) {
    return {
      latestRank: null,
      latestLabel: 'No data',
      trendLabel: 'No snapshot' as const,
    };
  }

  const result = classifyAdsOptimizerRankingTrend(args.observations);
  return {
    latestRank: result.latestRank,
    latestLabel: result.latestRank === null ? 'No data' : formatRankValue(result.latestRank),
    trendLabel: result.trendLabel,
  };
};

const getOrganicTrendSortScore = (trendLabel: RankTrendLabel): number | null => {
  if (trendLabel === 'Rising') return 4;
  if (trendLabel === 'Maintain') return 3;
  if (trendLabel === 'Decline') return 2;
  if (trendLabel === 'Limited data') return 1;
  return null;
};

const buildStateComparison = (
  row: TargetReviewRowLike
): AdsOptimizerTargetRowTableSummary['stateComparison'] => {
  const previous = row.previousComparable ?? null;
  return {
    stateValue: row.state.efficiency.value,
    efficiencyValue: row.state.efficiency.value,
    confidenceValue: row.state.confidence.value,
    rows: [
      {
        label: 'State',
        current: {
          raw: row.state.efficiency.value,
          display: row.state.efficiency.label,
          tone: row.state.efficiency.value ? 'neutral' : 'missing',
        },
        previous: {
          raw: previous?.state.efficiency.value ?? null,
          display: previous?.state.efficiency.label ?? '—',
          tone: previous?.state.efficiency.value ? 'neutral' : 'missing',
        },
        change: buildStateChangeSummary(
          row.state.efficiency.value,
          row.state.efficiency.label,
          previous?.state.efficiency.value ?? null,
          previous?.state.efficiency.label ?? '—'
        ),
      },
      buildCurrencyMetricRow('P&L', getCurrentProfitLoss(row), getCurrentProfitLoss(previous), {
        higherIsBetter: true,
      }),
      buildPercentMetricRow('ACoS', row.raw.acos, previous?.raw.acos ?? null, {
        lowerIsBetter: true,
      }),
      buildPercentMetricRow('Break-even ACoS', getBreakEvenAcos(row), getBreakEvenAcos(previous), {
        neutral: true,
      }),
    ],
  };
};

const buildEconomicsComparison = (
  row: TargetReviewRowLike
): AdsOptimizerTargetRowTableSummary['economicsComparison'] => {
  const previous = row.previousComparable ?? null;
  return {
    rows: [
      buildCurrencyMetricRow('Spend', row.raw.spend, previous?.raw.spend ?? null, {
        neutral: true,
      }),
      buildCurrencyMetricRow('Sales', row.raw.sales, previous?.raw.sales ?? null, {
        higherIsBetter: true,
      }),
      buildCountMetricRow('Orders', row.raw.orders, previous?.raw.orders ?? null, true),
    ],
  };
};

const buildContributionSummary = (
  row: TargetReviewRowLike,
  totals: { sales: number; spend: number; impressions: number },
  ranks: {
    sales: Map<string, number>;
    spend: Map<string, number>;
    impressions: Map<string, number>;
  }
): AdsOptimizerTargetRowTableSummary['contribution'] => {
  const salesShare = totals.sales > 0 ? row.raw.sales / totals.sales : null;
  const spendShare = totals.spend > 0 ? row.raw.spend / totals.spend : null;
  const impressionShare = totals.impressions > 0 ? row.raw.impressions / totals.impressions : null;
  const sqpImpressionShare = row.sqpContext?.marketImpressionShare ?? null;
  const sqpImpressionRank = row.sqpContext?.marketImpressionRank ?? null;

  return {
    rows: [
      {
        label: 'Sales' as const,
        value: row.raw.sales,
        share: {
          raw: salesShare,
          display: formatShare(salesShare),
          tone: salesShare === null ? 'missing' : 'neutral',
        },
        rank: {
          raw: salesShare === null ? null : (ranks.sales.get(row.persistedTargetKey) ?? null),
          display:
            salesShare === null
              ? '—'
              : `Rank ${formatNumber(ranks.sales.get(row.persistedTargetKey) ?? null)}`,
          tone: salesShare === null ? 'missing' : 'neutral',
        },
      },
      {
        label: 'Spend' as const,
        value: row.raw.spend,
        share: {
          raw: spendShare,
          display: formatShare(spendShare),
          tone: spendShare === null ? 'missing' : 'neutral',
        },
        rank: {
          raw: spendShare === null ? null : (ranks.spend.get(row.persistedTargetKey) ?? null),
          display:
            spendShare === null
              ? '—'
              : `Rank ${formatNumber(ranks.spend.get(row.persistedTargetKey) ?? null)}`,
          tone: spendShare === null ? 'missing' : 'neutral',
        },
      },
      {
        label: 'Impression' as const,
        value: row.raw.impressions,
        share: {
          raw: impressionShare,
          display: formatShare(impressionShare),
          tone: impressionShare === null ? 'missing' : 'neutral',
        },
        rank: {
          raw:
            impressionShare === null ? null : (ranks.impressions.get(row.persistedTargetKey) ?? null),
          display:
            impressionShare === null
              ? '—'
              : `Rank ${formatNumber(ranks.impressions.get(row.persistedTargetKey) ?? null)}`,
          tone: impressionShare === null ? 'missing' : 'neutral',
        },
      },
      {
        label: 'SQP Impression' as const,
        value: row.sqpContext?.marketImpressionsTotal ?? null,
        share: {
          raw: sqpImpressionShare,
          display: formatShare(sqpImpressionShare),
          tone: sqpImpressionShare === null ? 'missing' : 'neutral',
        },
        rank: {
          raw: sqpImpressionRank,
          display:
            sqpImpressionRank === null ? '—' : `Rank ${formatNumber(sqpImpressionRank)}`,
          tone: sqpImpressionRank === null ? 'missing' : 'neutral',
        },
      },
    ],
  };
};

const buildChangeSummary = (row: TargetReviewRowLike) => {
  const stageableLines = getEffectiveStageableActions(row).map(buildActionLine);
  if (stageableLines.length === 0) {
    return {
      lines: [],
      overflowCount: 0,
      emptyMessage: 'No supported stageable change',
      supportedChangeCount: 0,
    };
  }

  return {
    lines: stageableLines.slice(0, 2),
    overflowCount: Math.max(0, stageableLines.length - 2),
    emptyMessage: null,
    supportedChangeCount: stageableLines.length,
  };
};

const buildLastChangeSummary = (row: TargetReviewRowLike) => {
  const lastDetectedChange = row.lastDetectedChange ?? {
    detectedDate: null,
    items: [],
    overflowCount: 0,
    emptyMessage: 'No detected tracked change',
  };

  if (lastDetectedChange.items.length === 0) {
    return {
      detectedDate: lastDetectedChange.detectedDate,
      items: [],
      overflowCount: 0,
      emptyMessage: lastDetectedChange.emptyMessage ?? 'No detected tracked change',
    };
  }

  return {
    detectedDate: lastDetectedChange.detectedDate,
    items: lastDetectedChange.items.slice(0, 2).map((item) => ({
      key: item.key,
      label: item.label,
      previousDisplay: item.previousDisplay,
      currentDisplay: item.currentDisplay,
      deltaPercentLabel: item.deltaPercentLabel,
      deltaDirection: item.deltaDirection,
    })),
    overflowCount: lastDetectedChange.overflowCount,
    emptyMessage: null,
  };
};

const buildTableSummary = (
  row: TargetReviewRowLike,
  context: {
    totals: { sales: number; spend: number; impressions: number };
    ranks: {
      sales: Map<string, number>;
      spend: Map<string, number>;
      impressions: Map<string, number>;
    };
  }
): AdsOptimizerTargetRowTableSummary => {
  const stageableActions = getEffectiveStageableActions(row);
  const reviewOnlyActionCount = getReviewOnlyActionCount(row);
  const highestExceptionSeverity = getHighestExceptionSeverity(row);
  const currentProfitLoss = getCurrentProfitLoss(row);
  const contributionSalesRank =
    context.totals.sales > 0 ? (context.ranks.sales.get(row.persistedTargetKey) ?? null) : null;
  const contributionSpendRank =
    context.totals.spend > 0 ? (context.ranks.spend.get(row.persistedTargetKey) ?? null) : null;
  const contributionImpressionRank =
    context.totals.impressions > 0
      ? (context.ranks.impressions.get(row.persistedTargetKey) ?? null)
      : null;
  const contributionSqpImpressionRank = row.sqpContext?.marketImpressionRank ?? null;
  const organicRankingSummary = buildRankingSummaryBlock({
    observations: row.rankingContext?.organicObservedRanks ?? [],
    status: row.rankingContext?.status ?? null,
    note: row.rankingContext?.note ?? null,
  });
  const sponsoredRankingSummary = buildRankingSummaryBlock({
    observations: row.rankingContext?.sponsoredObservedRanks ?? [],
    status: row.rankingContext?.status ?? null,
    note: row.rankingContext?.note ?? null,
  });

  return {
    rowId: row.targetSnapshotId,
    targetSnapshotId: row.targetSnapshotId,
    persistedTargetKey: row.persistedTargetKey,
    identity: {
      targetText: row.targetText,
      targetKindLabel: row.typeLabel ?? 'Target',
      matchTypeLabel: row.matchType ? labelize(row.matchType) : '—',
      targetIdLabel: row.targetId || 'Unresolved target ID',
      campaignLabel: row.campaignName ?? row.campaignId ?? '—',
      adGroupLabel: row.adGroupName ?? row.adGroupId ?? '—',
      campaignContextLabel: `${row.campaignName ?? row.campaignId ?? '—'} | ${row.adGroupName ?? row.adGroupId ?? '—'}`,
      tierValue: row.state.importance.value,
      tierLabel: row.state.importance.label,
      priorityLabel: buildPriorityLabel(row.queue.priority, row.queue.primaryActionType),
      prioritySortValue: row.queue.priority,
      overrideBadgeLabel: buildOverrideBadgeLabel(row),
    },
    stateComparison: buildStateComparison(row),
    economicsComparison: buildEconomicsComparison(row),
    contribution: buildContributionSummary(row, context.totals, context.ranks),
    ranking: {
      organic: organicRankingSummary,
      sponsored: sponsoredRankingSummary,
    },
    role: {
      currentValue: row.role.currentRole.value,
      currentLabel: row.role.currentRole.value ? row.role.currentRole.label : '—',
      nextValue: row.role.desiredRole.value,
      nextLabel: row.role.desiredRole.value ? row.role.desiredRole.label : '—',
    },
    lastChange: buildLastChangeSummary(row),
    changeSummary: buildChangeSummary(row),
    handoff: {
      stageable: stageableActions.length > 0,
      workspaceActionCount: stageableActions.length,
      reviewOnlyActionCount,
      hasManualOverride: Boolean(row.manualOverride),
    },
    exceptionFlags: {
      count: row.recommendation?.exceptionSignals.length ?? 0,
      highestSeverity: highestExceptionSeverity,
      manualReviewRequired: hasManualReviewRequirement(row),
    },
    filters: {
      role: row.role.currentRole.value,
      efficiency: row.state.efficiency.value,
      confidence: row.state.confidence.value,
      tier: row.state.importance.value,
      spendDirection: row.queue.spendDirection,
      trendContext: row.derived.organicContextSignal,
    },
    sort: {
      priority: row.queue.priority,
      recommendationCount: row.queue.recommendationCount,
      workspaceActionCount: stageableActions.length,
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
      currentProfitLoss,
      currentAcos: row.raw.acos,
      currentSpend: row.raw.spend,
      currentSales: row.raw.sales,
      currentOrders: row.raw.orders,
      contributionSalesRank,
      contributionSpendRank,
      contributionImpressionRank,
      contributionSqpImpressionRank,
      organicLatestRank: organicRankingSummary.latestRank,
      organicTrendScore: getOrganicTrendSortScore(organicRankingSummary.trendLabel),
    },
  };
};

export const buildAdsOptimizerTargetRowTableSummary = (
  row: TargetReviewRowLike,
  rows: TargetReviewRowLike[]
) => {
  const totals = {
    sales: rows.reduce((sum, entry) => sum + entry.raw.sales, 0),
    spend: rows.reduce((sum, entry) => sum + entry.raw.spend, 0),
    impressions: rows.reduce((sum, entry) => sum + entry.raw.impressions, 0),
  };
  const ranks = {
    sales: buildContributionRankMap(rows, (entry) => entry.raw.sales),
    spend: buildContributionRankMap(rows, (entry) => entry.raw.spend),
    impressions: buildContributionRankMap(rows, (entry) => entry.raw.impressions),
  };
  return buildTableSummary(row, {
    totals,
    ranks,
  });
};

export const buildAdsOptimizerTargetRowTableSummaries = (rows: TargetReviewRowLike[]) => {
  const totals = {
    sales: rows.reduce((sum, entry) => sum + entry.raw.sales, 0),
    spend: rows.reduce((sum, entry) => sum + entry.raw.spend, 0),
    impressions: rows.reduce((sum, entry) => sum + entry.raw.impressions, 0),
  };
  const ranks = {
    sales: buildContributionRankMap(rows, (entry) => entry.raw.sales),
    spend: buildContributionRankMap(rows, (entry) => entry.raw.spend),
    impressions: buildContributionRankMap(rows, (entry) => entry.raw.impressions),
  };

  return rows.map((row) =>
    buildTableSummary(row, {
      totals,
      ranks,
    })
  );
};

export const getDefaultAdsOptimizerTargetTableSortDirection = (
  sortBy: AdsOptimizerTargetTableSort
): AdsOptimizerTargetTableSortDirection => {
  if (
    sortBy === 'recommendations' ||
    sortBy === 'workspace_actions' ||
    sortBy === 'exceptions' ||
    sortBy === 'state_current_profit_loss' ||
    sortBy === 'economics_current_spend' ||
    sortBy === 'economics_current_sales' ||
    sortBy === 'economics_current_orders' ||
    sortBy === 'ranking_organic_trend'
  ) {
    return 'desc';
  }

  return 'asc';
};

const compareRowSummariesByDefault = (
  left: AdsOptimizerTargetRowTableSummary,
  right: AdsOptimizerTargetRowTableSummary
) =>
  compareNullableNumber(left.sort.priority, right.sort.priority) ||
  right.sort.recommendationCount - left.sort.recommendationCount ||
  compareNullableNumber(right.sort.riskScore, left.sort.riskScore) ||
  compareNullableNumber(right.sort.opportunityScore, left.sort.opportunityScore) ||
  left.sort.targetText.localeCompare(right.sort.targetText);

export const compareAdsOptimizerTargetRowTableSummaries = (
  left: AdsOptimizerTargetRowTableSummary,
  right: AdsOptimizerTargetRowTableSummary,
  sortBy: AdsOptimizerTargetTableSort,
  direction: AdsOptimizerTargetTableSortDirection
) => {
  let comparison = 0;
  let handledDirection = false;

  switch (sortBy) {
    case 'target':
      comparison = left.sort.targetText.localeCompare(right.sort.targetText);
      break;
    case 'priority':
      comparison = compareNullableNumber(left.sort.priority, right.sort.priority);
      break;
    case 'recommendations':
      comparison = left.changeSummary.supportedChangeCount - right.changeSummary.supportedChangeCount;
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
    case 'state_current_profit_loss':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.currentProfitLoss,
        right.sort.currentProfitLoss,
        direction
      );
      break;
    case 'state_current_acos':
      handledDirection = true;
      comparison = compareMissingLastNumber(left.sort.currentAcos, right.sort.currentAcos, direction);
      break;
    case 'economics_current_spend':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.currentSpend,
        right.sort.currentSpend,
        direction
      );
      break;
    case 'economics_current_sales':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.currentSales,
        right.sort.currentSales,
        direction
      );
      break;
    case 'economics_current_orders':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.currentOrders,
        right.sort.currentOrders,
        direction
      );
      break;
    case 'contribution_sales_rank':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.contributionSalesRank,
        right.sort.contributionSalesRank,
        direction
      );
      break;
    case 'contribution_spend_rank':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.contributionSpendRank,
        right.sort.contributionSpendRank,
        direction
      );
      break;
    case 'contribution_impression_rank':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.contributionImpressionRank,
        right.sort.contributionImpressionRank,
        direction
      );
      break;
    case 'contribution_sqp_impression_rank':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.contributionSqpImpressionRank,
        right.sort.contributionSqpImpressionRank,
        direction
      );
      break;
    case 'ranking_organic_latest':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.organicLatestRank,
        right.sort.organicLatestRank,
        direction
      );
      break;
    case 'ranking_organic_trend':
      handledDirection = true;
      comparison = compareMissingLastNumber(
        left.sort.organicTrendScore,
        right.sort.organicTrendScore,
        direction
      );
      break;
  }

  return (
    (handledDirection ? comparison : direction === 'asc' ? comparison : -comparison) ||
    compareRowSummariesByDefault(left, right)
  );
};

export const filterAdsOptimizerTargetRowTableSummaries = (
  rowSummaries: AdsOptimizerTargetRowTableSummary[],
  filters: AdsOptimizerTargetTableFilters
) => {
  const targetSearch = normalizeSearchToken(filters.targetSearch);

  return [...rowSummaries]
    .filter((row) => {
      if (!targetSearch) return true;
      const targetText = normalizeSearchToken(row.identity.targetText);
      const targetId = normalizeSearchToken(row.identity.targetIdLabel);
      return targetText?.includes(targetSearch) || targetId?.includes(targetSearch) || false;
    })
    .filter((row) => (filters.role === 'all' ? true : row.filters.role === filters.role))
    .filter((row) =>
      filters.efficiency === 'all' ? true : row.filters.efficiency === filters.efficiency
    )
    .filter((row) => (filters.tier === 'all' ? true : row.filters.tier === filters.tier))
    .filter((row) =>
      filters.confidence === 'all' ? true : row.filters.confidence === filters.confidence
    )
    .filter((row) =>
      filters.spendDirection === 'all'
        ? true
        : row.filters.spendDirection === filters.spendDirection
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
      compareAdsOptimizerTargetRowTableSummaries(left, right, filters.sortBy, filters.sortDirection)
    );
};
