import { describe, expect, it } from 'vitest';

import { buildAdsOptimizerRunComparison } from '../apps/web/src/lib/ads-optimizer/comparison';

const makeRun = (args: {
  runId: string;
  createdAt: string;
  rulePackVersionLabel: string;
}) => ({
  run_id: args.runId,
  account_id: 'acct',
  marketplace: 'US',
  channel: 'sp' as const,
  scope_type: 'product' as const,
  selected_asin: 'B001TEST',
  run_kind: 'manual' as const,
  date_start: '2026-03-01',
  date_end: '2026-03-10',
  rule_pack_version_id: args.rulePackVersionLabel,
  rule_pack_version_label: args.rulePackVersionLabel,
  status: 'completed' as const,
  input_summary_json: {},
  diagnostics_json: null,
  product_snapshot_count: 1,
  target_snapshot_count: 1,
  recommendation_snapshot_count: 1,
  role_transition_count: 0,
  created_at: args.createdAt,
  started_at: args.createdAt,
  completed_at: args.createdAt,
});

const makeRow = (args: {
  targetId: string;
  targetText: string;
  role: string;
  desiredRole?: string;
  spendDirection: string;
  primaryActionType: string;
  exceptionTypes?: Array<{ type: string; severity: 'high' | 'medium' | 'low' }>;
  portfolio?: {
    discoverCapBlocked?: boolean;
    learningBudgetExceeded?: boolean;
    stopLossCapExceeded?: boolean;
    budgetShareExceeded?: boolean;
  };
}) => ({
  targetId: args.targetId,
  persistedTargetKey: args.targetId,
  targetText: args.targetText,
  state: {
    efficiency: { value: 'profitable', label: 'Profitable' },
    confidence: { value: 'confirmed', label: 'Confirmed' },
    importance: { value: 'tier_1_dominant', label: 'Tier 1 dominant' },
  },
  role: {
    currentRole: { value: args.role, label: args.role },
    desiredRole: { value: args.desiredRole ?? args.role, label: args.desiredRole ?? args.role },
  },
  recommendation: {
    spendDirection: args.spendDirection,
    primaryActionType: args.primaryActionType,
    actionCount: 1,
    actions: [{ actionType: args.primaryActionType }],
    exceptionSignals: args.exceptionTypes ?? [],
    portfolioControls: {
      discoverCapBlocked: args.portfolio?.discoverCapBlocked ?? false,
      learningBudgetExceeded: args.portfolio?.learningBudgetExceeded ?? false,
      stopLossCapExceeded: args.portfolio?.stopLossCapExceeded ?? false,
      budgetShareExceeded: args.portfolio?.budgetShareExceeded ?? false,
      discoverRank: null,
      targetSpendShare: 0.2,
    },
  },
});

describe('ads optimizer phase 12 run comparison', () => {
  it('builds material comparison changes and rollback guidance from comparable runs', () => {
    const previousRun = makeRun({
      runId: 'run-prev',
      createdAt: '2026-03-10T00:00:00Z',
      rulePackVersionLabel: 'sp_v1_prev',
    });
    const currentRun = makeRun({
      runId: 'run-current',
      createdAt: '2026-03-11T00:00:00Z',
      rulePackVersionLabel: 'sp_v1_next',
    });

    const comparison = buildAdsOptimizerRunComparison({
      currentRun,
      previousRun,
      currentRows: [
        makeRow({
          targetId: 'target-1',
          targetText: 'blue widget',
          role: 'Scale',
          spendDirection: 'increase',
          primaryActionType: 'update_target_bid',
          exceptionTypes: [{ type: 'guardrail_breach', severity: 'high' }],
          portfolio: { budgetShareExceeded: true },
        }),
      ],
      previousRows: [
        makeRow({
          targetId: 'target-1',
          targetText: 'blue widget',
          role: 'Suppress',
          desiredRole: 'Suppress',
          spendDirection: 'collapse',
          primaryActionType: 'update_target_state',
        }),
      ],
      currentVersion: {
        versionLabel: 'sp_v1_next',
        changeSummary: 'Tightened Discover caps.',
      },
      previousVersion: {
        versionLabel: 'sp_v1_prev',
        changeSummary: 'Baseline version.',
      },
      recentComparableRuns: [
        {
          runId: currentRun.run_id,
          createdAt: currentRun.created_at,
          rulePackVersionLabel: currentRun.rule_pack_version_label,
        },
        {
          runId: previousRun.run_id,
          createdAt: previousRun.created_at,
          rulePackVersionLabel: previousRun.rule_pack_version_label,
        },
      ],
      currentHandoff: {
        changeSetCount: 1,
        itemCount: 1,
        latestChangeSetName: 'Optimizer handoff current',
        entityKeys: ['target-1'],
      },
      previousHandoff: {
        changeSetCount: 1,
        itemCount: 1,
        latestChangeSetName: 'Optimizer handoff previous',
        entityKeys: ['target-1'],
      },
    });

    expect(comparison).not.toBeNull();
    expect(comparison?.versionComparison.changed).toBe(true);
    expect(comparison?.summary.roleChanges).toBe(1);
    expect(comparison?.summary.recommendationChanges).toBe(1);
    expect(comparison?.summary.exceptionChanges).toBe(1);
    expect(comparison?.summary.portfolioControlChanges).toBe(1);
    expect(comparison?.materialChanges.some((change) => change.kind === 'role')).toBe(true);
    expect(
      comparison?.rollbackGuidance.some((entry) =>
        entry.cautionFlags.includes('PRIOR_WORKSPACE_HANDOFF_EXISTS')
      )
    ).toBe(true);
  });
});
