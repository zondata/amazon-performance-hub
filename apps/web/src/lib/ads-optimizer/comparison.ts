import type { AdsOptimizerRun } from './runtimeTypes';

type ComparisonSeverity = 'high' | 'medium' | 'low';

type ComparisonException = {
  type: string;
  severity: ComparisonSeverity;
};

type ComparisonPortfolioControls = {
  discoverCapBlocked: boolean;
  learningBudgetExceeded: boolean;
  stopLossCapExceeded: boolean;
  budgetShareExceeded: boolean;
  discoverRank: number | null;
  targetSpendShare: number | null;
};

type ComparisonRecommendation = {
  spendDirection: string | null;
  primaryActionType: string | null;
  actionCount: number;
  actions: Array<{ actionType: string }>;
  exceptionSignals: ComparisonException[];
  portfolioControls: ComparisonPortfolioControls | null;
};

type ComparisonState = {
  efficiency: { value: string | null; label: string };
  confidence: { value: string | null; label: string };
  importance: { value: string | null; label: string };
};

type ComparisonRole = {
  currentRole: { value: string | null; label: string };
  desiredRole: { value: string | null; label: string };
};

export type AdsOptimizerComparisonRow = {
  targetId: string;
  persistedTargetKey: string;
  targetText: string;
  state: ComparisonState;
  role: ComparisonRole;
  recommendation: ComparisonRecommendation | null;
};

export type AdsOptimizerComparisonVersionSummary = {
  versionLabel: string;
  changeSummary: string | null;
};

export type AdsOptimizerComparisonRunRef = {
  runId: string;
  createdAt: string;
  rulePackVersionLabel: string;
};

export type AdsOptimizerRunComparisonMaterialChange = {
  targetId: string;
  targetText: string;
  kind:
    | 'target_added'
    | 'target_removed'
    | 'state'
    | 'role'
    | 'recommendation'
    | 'exception'
    | 'portfolio';
  severity: ComparisonSeverity;
  summary: string;
  why: string;
  previousValue: string | null;
  currentValue: string | null;
};

export type AdsOptimizerRollbackGuidance = {
  targetId: string;
  targetText: string;
  title: string;
  detail: string;
  cautionFlags: string[];
};

export type AdsOptimizerRunComparisonView = {
  baselineRun: AdsOptimizerComparisonRunRef | null;
  recentComparableRuns: AdsOptimizerComparisonRunRef[];
  versionComparison: {
    changed: boolean;
    currentVersionLabel: string;
    previousVersionLabel: string | null;
    currentChangeSummary: string | null;
    previousChangeSummary: string | null;
  };
  summary: {
    stateChanges: number;
    roleChanges: number;
    recommendationChanges: number;
    exceptionChanges: number;
    portfolioControlChanges: number;
  };
  handoffAudit: {
    currentRunChangeSetCount: number;
    currentRunItemCount: number;
    previousRunChangeSetCount: number;
    previousRunItemCount: number;
    latestCurrentChangeSetName: string | null;
    latestPreviousChangeSetName: string | null;
  };
  materialChanges: AdsOptimizerRunComparisonMaterialChange[];
  rollbackGuidance: AdsOptimizerRollbackGuidance[];
};

type HandoffAuditSummary = {
  changeSetCount: number;
  itemCount: number;
  latestChangeSetName: string | null;
  entityKeys: string[];
};

const getSeverityRank = (severity: ComparisonSeverity) => {
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
};

const stageableActionTypes = (row: AdsOptimizerComparisonRow | null) =>
  row?.recommendation?.actions
    .map((action) => action.actionType)
    .filter(
      (actionType) =>
        actionType === 'update_target_bid' ||
        actionType === 'update_target_state' ||
        actionType === 'update_placement_modifier'
    ) ?? [];

const exceptionSignature = (row: AdsOptimizerComparisonRow | null) =>
  (row?.recommendation?.exceptionSignals ?? [])
    .map((signal) => `${signal.type}:${signal.severity}`)
    .sort()
    .join('|');

const recommendationSignature = (row: AdsOptimizerComparisonRow | null) =>
  row?.recommendation
    ? [
        row.recommendation.spendDirection ?? 'none',
        row.recommendation.primaryActionType ?? 'none',
        stageableActionTypes(row).join(','),
      ].join('|')
    : 'none';

const portfolioSignature = (row: AdsOptimizerComparisonRow | null) => {
  const portfolio = row?.recommendation?.portfolioControls;
  if (!portfolio) return 'none';
  return [
    String(portfolio.discoverCapBlocked),
    String(portfolio.learningBudgetExceeded),
    String(portfolio.stopLossCapExceeded),
    String(portfolio.budgetShareExceeded),
    String(portfolio.discoverRank ?? 'none'),
  ].join('|');
};

const buildComparisonKey = (row: AdsOptimizerComparisonRow) => row.persistedTargetKey || row.targetId;

const describeState = (row: AdsOptimizerComparisonRow | null) =>
  row
    ? `${row.state.efficiency.label} / ${row.state.confidence.label} / ${row.state.importance.label}`
    : null;

const describeRole = (row: AdsOptimizerComparisonRow | null) =>
  row ? `${row.role.currentRole.label} (desired ${row.role.desiredRole.label})` : null;

const describeRecommendation = (row: AdsOptimizerComparisonRow | null) =>
  row?.recommendation
    ? `${row.recommendation.spendDirection ?? 'none'} / ${
        row.recommendation.primaryActionType ?? 'monitor_only'
      }`
    : null;

const describePortfolio = (row: AdsOptimizerComparisonRow | null) => {
  const portfolio = row?.recommendation?.portfolioControls;
  if (!portfolio) return null;

  const flags = [
    portfolio.discoverCapBlocked ? 'discover cap blocked' : null,
    portfolio.learningBudgetExceeded ? 'learning cap exceeded' : null,
    portfolio.stopLossCapExceeded ? 'stop-loss cap exceeded' : null,
    portfolio.budgetShareExceeded ? 'budget share exceeded' : null,
  ].filter(Boolean);

  return flags.length > 0 ? flags.join(', ') : 'no breached portfolio caps';
};

export const buildAdsOptimizerRunComparison = (args: {
  currentRun: AdsOptimizerRun;
  previousRun: AdsOptimizerRun | null;
  currentRows: AdsOptimizerComparisonRow[];
  previousRows: AdsOptimizerComparisonRow[];
  currentVersion: AdsOptimizerComparisonVersionSummary;
  previousVersion: AdsOptimizerComparisonVersionSummary | null;
  recentComparableRuns: AdsOptimizerComparisonRunRef[];
  currentHandoff: HandoffAuditSummary;
  previousHandoff: HandoffAuditSummary;
}): AdsOptimizerRunComparisonView | null => {
  if (!args.previousRun) {
    return null;
  }

  const previousByKey = new Map(args.previousRows.map((row) => [buildComparisonKey(row), row]));
  const currentByKey = new Map(args.currentRows.map((row) => [buildComparisonKey(row), row]));
  const comparisonKeys = [...new Set([...previousByKey.keys(), ...currentByKey.keys()])];
  const materialChanges: AdsOptimizerRunComparisonMaterialChange[] = [];
  const rollbackGuidance: AdsOptimizerRollbackGuidance[] = [];
  const summary = {
    stateChanges: 0,
    roleChanges: 0,
    recommendationChanges: 0,
    exceptionChanges: 0,
    portfolioControlChanges: 0,
  };
  const previousHandoffKeys = new Set(args.previousHandoff.entityKeys);
  const currentHandoffKeys = new Set(args.currentHandoff.entityKeys);

  for (const key of comparisonKeys) {
    const previousRow = previousByKey.get(key) ?? null;
    const currentRow = currentByKey.get(key) ?? null;
    const targetId = currentRow?.targetId ?? previousRow?.targetId ?? key;
    const targetText = currentRow?.targetText ?? previousRow?.targetText ?? key;

    if (!previousRow && currentRow) {
      materialChanges.push({
        targetId,
        targetText,
        kind: 'target_added',
        severity: currentRow.recommendation?.exceptionSignals.length ? 'medium' : 'low',
        summary: 'New target entered the optimizer queue',
        why: 'This target was not present in the prior comparable run.',
        previousValue: null,
        currentValue: describeRecommendation(currentRow),
      });
      continue;
    }

    if (previousRow && !currentRow) {
      materialChanges.push({
        targetId,
        targetText,
        kind: 'target_removed',
        severity: previousHandoffKeys.has(key) ? 'medium' : 'low',
        summary: 'Target dropped out of the optimizer queue',
        why: 'This target no longer appears in the current comparable run output.',
        previousValue: describeRecommendation(previousRow),
        currentValue: null,
      });
      continue;
    }

    if (!previousRow || !currentRow) continue;

    if (describeState(previousRow) !== describeState(currentRow)) {
      summary.stateChanges += 1;
      materialChanges.push({
        targetId,
        targetText,
        kind: 'state',
        severity: 'medium',
        summary: 'Target state changed',
        why: 'Efficiency, confidence, or importance moved between comparable runs.',
        previousValue: describeState(previousRow),
        currentValue: describeState(currentRow),
      });
    }

    if (describeRole(previousRow) !== describeRole(currentRow)) {
      summary.roleChanges += 1;
      materialChanges.push({
        targetId,
        targetText,
        kind: 'role',
        severity:
          currentRow.role.currentRole.value === 'Suppress' ||
          previousRow.role.currentRole.value === 'Suppress'
            ? 'high'
            : 'medium',
        summary: 'Target role changed',
        why: 'Current or desired role assignment moved between comparable runs.',
        previousValue: describeRole(previousRow),
        currentValue: describeRole(currentRow),
      });
    }

    if (recommendationSignature(previousRow) !== recommendationSignature(currentRow)) {
      summary.recommendationChanges += 1;
      materialChanges.push({
        targetId,
        targetText,
        kind: 'recommendation',
        severity: 'medium',
        summary: 'Recommendation output changed',
        why: 'Spend direction, primary action, or stageable action mix changed between runs.',
        previousValue: describeRecommendation(previousRow),
        currentValue: describeRecommendation(currentRow),
      });
    }

    if (exceptionSignature(previousRow) !== exceptionSignature(currentRow)) {
      summary.exceptionChanges += 1;
      const highestSeverity =
        currentRow.recommendation?.exceptionSignals
          .map((signal) => signal.severity)
          .sort((left, right) => getSeverityRank(right) - getSeverityRank(left))[0] ?? 'medium';
      materialChanges.push({
        targetId,
        targetText,
        kind: 'exception',
        severity: highestSeverity,
        summary: 'Exception signal set changed',
        why: 'Guardrail, degradation, or low-confidence exception flags changed between runs.',
        previousValue: exceptionSignature(previousRow) || 'none',
        currentValue: exceptionSignature(currentRow) || 'none',
      });
    }

    if (portfolioSignature(previousRow) !== portfolioSignature(currentRow)) {
      summary.portfolioControlChanges += 1;
      materialChanges.push({
        targetId,
        targetText,
        kind: 'portfolio',
        severity: currentRow.recommendation?.portfolioControls?.stopLossCapExceeded ? 'high' : 'medium',
        summary: 'Portfolio control status changed',
        why: 'ASIN-level cap pressure or Discover ranking changed for this target.',
        previousValue: describePortfolio(previousRow),
        currentValue: describePortfolio(currentRow),
      });
    }

    const previousStageable = stageableActionTypes(previousRow);
    if (
      previousHandoffKeys.has(key) &&
      previousStageable.length > 0 &&
      recommendationSignature(previousRow) !== recommendationSignature(currentRow)
    ) {
      rollbackGuidance.push({
        targetId,
        targetText,
        title: 'Prior staged action may need reversal review',
        detail:
          `The prior comparable run already produced staged Ads Workspace action(s) for this target, ` +
          `but the current run changed the recommendation from ${
            describeRecommendation(previousRow) ?? 'none'
          } to ${describeRecommendation(currentRow) ?? 'none'}.`,
        cautionFlags: ['PRIOR_WORKSPACE_HANDOFF_EXISTS'],
      });
    }

    if (
      previousRow.recommendation?.primaryActionType === 'update_target_state' &&
      currentRow.recommendation?.spendDirection === 'increase'
    ) {
      rollbackGuidance.push({
        targetId,
        targetText,
        title: 'Review prior pause or state-down guidance',
        detail:
          'A prior comparable run pointed toward a state change, while the current run now wants renewed spend. Review whether any staged or executed pause should be reversed in Ads Workspace.',
        cautionFlags: ['STATE_REVERSAL_REVIEW'],
      });
    }

    if (
      previousRow.recommendation?.primaryActionType === 'update_target_bid' &&
      previousRow.recommendation?.spendDirection !== currentRow.recommendation?.spendDirection &&
      currentRow.recommendation?.primaryActionType === 'update_target_bid'
    ) {
      rollbackGuidance.push({
        targetId,
        targetText,
        title: 'Review prior bid-direction change',
        detail:
          'Bid direction flipped across comparable runs. Check whether any staged or executed bid adjustment from the prior run now needs reversal or cancellation in Ads Workspace.',
        cautionFlags: ['BID_DIRECTION_CHANGED'],
      });
    }

    if (
      currentHandoffKeys.has(key) &&
      (currentRow.recommendation?.exceptionSignals.some((signal) => signal.severity === 'high') ?? false)
    ) {
      rollbackGuidance.push({
        targetId,
        targetText,
        title: 'High-severity exception on already staged target',
        detail:
          'This target has a current high-severity exception and also has optimizer-linked staged action(s). Review the draft before moving it further through Ads Workspace.',
        cautionFlags: ['CURRENT_STAGE_EXISTS', 'HIGH_SEVERITY_EXCEPTION'],
      });
    }
  }

  const dedupedRollbackGuidance = [...new Map(
    rollbackGuidance.map((entry) => [`${entry.targetId}:${entry.title}`, entry])
  ).values()];

  return {
    baselineRun: {
      runId: args.previousRun.run_id,
      createdAt: args.previousRun.created_at,
      rulePackVersionLabel: args.previousRun.rule_pack_version_label,
    },
    recentComparableRuns: args.recentComparableRuns,
    versionComparison: {
      changed: args.currentVersion.versionLabel !== (args.previousVersion?.versionLabel ?? null),
      currentVersionLabel: args.currentVersion.versionLabel,
      previousVersionLabel: args.previousVersion?.versionLabel ?? null,
      currentChangeSummary: args.currentVersion.changeSummary,
      previousChangeSummary: args.previousVersion?.changeSummary ?? null,
    },
    summary,
    handoffAudit: {
      currentRunChangeSetCount: args.currentHandoff.changeSetCount,
      currentRunItemCount: args.currentHandoff.itemCount,
      previousRunChangeSetCount: args.previousHandoff.changeSetCount,
      previousRunItemCount: args.previousHandoff.itemCount,
      latestCurrentChangeSetName: args.currentHandoff.latestChangeSetName,
      latestPreviousChangeSetName: args.previousHandoff.latestChangeSetName,
    },
    materialChanges: materialChanges.sort(
      (left, right) =>
        getSeverityRank(right.severity) - getSeverityRank(left.severity) ||
        left.targetText.localeCompare(right.targetText)
    ),
    rollbackGuidance: dedupedRollbackGuidance.sort((left, right) =>
      left.targetText.localeCompare(right.targetText)
    ),
  };
};
