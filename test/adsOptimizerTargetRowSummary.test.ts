import { describe, expect, it } from 'vitest';

import { buildAdsOptimizerTargetRowSummary } from '@/lib/ads-optimizer/targetRowSummary';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';

const buildRow = (): AdsOptimizerTargetReviewRow =>
  ({
    targetSnapshotId: 'snap-1',
    persistedTargetKey: 'persisted:asin:campaign:adgroup:target',
    targetId: 'target-1',
    targetText: 'hero exact',
    typeLabel: 'Keyword',
    matchType: 'EXACT',
    campaignId: 'cmp-1',
    campaignName: 'Core Campaign',
    adGroupId: 'ag-1',
    adGroupName: 'Exact Group',
    runId: 'run-1',
    asin: 'B000TEST',
    raw: {
      spend: 120,
      sales: 360,
      orders: 8,
      acos: 0.333,
      clicks: 48,
    },
    derived: {
      contributionAfterAds: 54,
      organicContextSignal: 'rank_improving',
    },
    state: {
      efficiency: { value: 'profitable', label: 'Profitable', detail: 'Margin-positive' },
      confidence: { value: 'confirmed', label: 'Confirmed', detail: 'Enough coverage' },
      importance: { value: 'tier_1_dominant', label: 'Tier 1 dominant', detail: 'Primary target' },
      riskScore: 12,
      opportunityScore: 18,
    },
    role: {
      currentRole: { value: 'Harvest', label: 'Harvest' },
      desiredRole: { value: 'Scale', label: 'Scale' },
      guardrails: {
        flags: {
          requiresManualApproval: false,
          autoPauseEligible: false,
          transitionLocked: false,
        },
      },
    },
    coverage: {
      statuses: {
        tosIs: 'ready',
        stis: 'partial',
        stir: 'missing',
        placementContext: 'ready',
        searchTerms: 'expected_unavailable',
        breakEvenInputs: 'ready',
      },
      criticalWarnings: ['Missing prior STIR'],
      notes: ['Search term export was incomplete'],
    },
    searchTermDiagnostics: {
      topTerms: [],
      note: 'No strong search-term context.',
    },
    recommendation: {
      exceptionSignals: [{ severity: 'high', type: 'guardrail_breach', title: 'Guardrail', detail: 'Manual review', reasonCodes: ['guardrail'] }],
      queryDiagnostics: {
        note: 'Hero query is pinned.',
        sameTextQueryPinning: {
          status: 'pinned',
          searchTerm: 'hero exact',
          clickShare: 0.4,
          orderShareProxy: 0.3,
          reasonCodes: [],
        },
        promoteToExactCandidates: [],
        isolateCandidates: [],
        negativeCandidates: [],
      },
      actions: [
        { actionType: 'update_target_bid', priority: 1, entityContext: null, proposedChange: null, reasonCodes: [], supportingMetrics: null },
        { actionType: 'negative_candidate', priority: 2, entityContext: null, proposedChange: null, reasonCodes: [], supportingMetrics: null },
      ],
      manualReviewRequired: false,
    },
    manualOverride: {
      override_scope: 'persistent',
      operator_note: 'Keep manual bid ceiling',
      replacement_action_bundle_json: {
        actions: [
          {
            action_type: 'update_target_bid',
            entity_context_json: null,
            proposed_change_json: null,
          },
        ],
      },
    },
    queue: {
      priority: 10,
      recommendationCount: 2,
      primaryActionType: 'update_target_bid',
      spendDirection: 'increase',
      reasonCodeBadges: ['hero_query', 'profit_guarded'],
      readOnlyBoundary: 'read_only_recommendation_only',
      hasCoverageGaps: true,
    },
  }) as unknown as AdsOptimizerTargetReviewRow;

describe('ads optimizer target row summary', () => {
  it('builds a compact V2 row summary with stable ids and honest limited rank context', () => {
    const row = buildRow();
    const summary = buildAdsOptimizerTargetRowSummary(row);

    expect(summary.rowId).toBe('snap-1');
    expect(summary.targetSnapshotId).toBe('snap-1');
    expect(summary.persistedTargetKey).toBe('persisted:asin:campaign:adgroup:target');
    expect(summary.role.summary).toBe('Harvest → Scale');
    expect(summary.organicRank.status).toBe('limited');
    expect(summary.organicRank.detail).toContain('Target-owned organic rank is not captured');
    expect(summary.change.workspaceActionCount).toBe(1);
    expect(summary.change.reviewOnlyActionCount).toBe(1);
    expect(summary.handoff.overrideBadgeLabel).toContain('Human override');
    expect(summary.searchTermDiagnosis.label).toBe('Same-text pinned');
    expect(summary.exceptionFlags.highestSeverity).toBe('high');
    expect(summary.coverage.criticalWarningCount).toBe(1);
    expect(summary.coverage.rowSpecificExceptionCount).toBe(1);
  });

  it('keeps missing rank and contribution explicit instead of faking precision', () => {
    const row = buildRow();
    row.derived = {
      ...row.derived,
      contributionAfterAds: null,
      organicContextSignal: null,
    } as typeof row.derived;

    const summary = buildAdsOptimizerTargetRowSummary(row);

    expect(summary.organicRank.status).toBe('missing');
    expect(summary.organicRank.label).toBe('Rank context unavailable');
    expect(summary.contribution.label).toBe('Contribution unavailable');
  });
});
