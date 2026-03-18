import { describe, expect, it } from 'vitest';

import {
  buildAdsOptimizerTargetRowTableSummary,
  buildAdsOptimizerTargetRowTableSummaries,
  classifyAdsOptimizerRankingTrend,
  filterAdsOptimizerTargetRowTableSummaries,
} from '@/lib/ads-optimizer/targetRowTableSummary';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';

const buildRow = (
  overrides: Partial<AdsOptimizerTargetReviewRow> = {}
): AdsOptimizerTargetReviewRow =>
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
    createdAt: '2026-03-18T00:00:00Z',
    asin: 'B000TEST',
    raw: {
      impressions: 900,
      clicks: 48,
      spend: 120,
      orders: 8,
      sales: 360,
      cpc: 2.5,
      ctr: 0.053,
      cvr: 0.167,
      acos: 0.333,
      roas: 3,
      tosIs: 0.22,
      stis: 0.17,
      stir: 11,
    },
    derived: {
      contributionAfterAds: 54,
      breakEvenGap: 0.067,
      maxCpcSupportGap: 0.5,
      lossDollars: null,
      profitDollars: 54,
      clickVelocity: 10,
      impressionVelocity: 90,
      organicLeverageProxy: 0.25,
      organicContextSignal: 'same_text_visibility_context',
    },
    nonAdditiveDiagnostics: {
      note: 'Non-additive diagnostics stay point-in-time only.',
      representativeSearchTerm: 'hero exact',
      tosIs: {
        latestValue: 0.22,
        previousValue: 0.2,
        delta: 0.02,
        direction: 'up',
        observedDays: 4,
        latestObservedDate: '2026-03-18',
      },
      stis: {
        latestValue: 0.17,
        previousValue: 0.16,
        delta: 0.01,
        direction: 'up',
        observedDays: 4,
        latestObservedDate: '2026-03-18',
      },
      stir: {
        latestValue: 11,
        previousValue: 13,
        delta: -2,
        direction: 'down',
        observedDays: 4,
        latestObservedDate: '2026-03-18',
      },
    },
    rankingContext: {
      note: null,
      organicObservedRanks: [
        { observedDate: '2026-03-01', rank: 20 },
        { observedDate: '2026-03-05', rank: 18 },
        { observedDate: '2026-03-09', rank: 17 },
        { observedDate: '2026-03-12', rank: 11 },
        { observedDate: '2026-03-15', rank: 10 },
        { observedDate: '2026-03-18', rank: 9 },
      ],
      sponsoredObservedRanks: [
        { observedDate: '2026-03-01', rank: 16 },
        { observedDate: '2026-03-05', rank: 16 },
        { observedDate: '2026-03-09', rank: 15 },
        { observedDate: '2026-03-12', rank: 15 },
        { observedDate: '2026-03-15', rank: 16 },
        { observedDate: '2026-03-18', rank: 16 },
      ],
    },
    demandProxies: {
      searchTermCount: 3,
      sameTextSearchTermCount: 1,
      totalSearchTermImpressions: 400,
      totalSearchTermClicks: 30,
      representativeSearchTerm: 'hero exact',
      representativeClickShare: 0.75,
    },
    placementContext: {
      topOfSearchModifierPct: 15,
      impressions: 350,
      clicks: 21,
      orders: 4,
      units: 4,
      sales: 170,
      spend: 58,
      note: 'Campaign-level placement context only.',
    },
    searchTermDiagnostics: {
      representativeSearchTerm: 'hero exact',
      representativeSameText: true,
      note: 'Representative query only.',
      topTerms: [],
    },
    coverage: {
      observedStart: '2026-03-01',
      observedEnd: '2026-03-18',
      daysObserved: 18,
      statuses: {
        tosIs: 'ready',
        stis: 'ready',
        stir: 'ready',
        placementContext: 'ready',
        searchTerms: 'partial',
        breakEvenInputs: 'ready',
      },
      criticalWarnings: [],
      notes: [],
    },
    state: {
      efficiency: {
        value: 'profitable',
        label: 'Profitable',
        detail: 'Margin-positive',
        coverageStatus: 'ready',
        reasonCodes: ['STATE_OK'],
      },
      confidence: {
        value: 'confirmed',
        label: 'Confirmed',
        detail: 'Enough coverage',
        coverageStatus: 'ready',
        reasonCodes: ['CONFIRMED'],
      },
      importance: {
        value: 'tier_1_dominant',
        label: 'Tier 1 dominant',
        detail: 'Primary target',
        coverageStatus: 'ready',
        reasonCodes: ['TIER_1'],
      },
      riskScore: 12,
      opportunityScore: 18,
      opportunityReasonCodes: ['OPPORTUNITY'],
      riskReasonCodes: ['RISK_LOW'],
      summaryReasonCodes: ['STATE_SUMMARY'],
    },
    role: {
      currentRole: {
        value: 'Harvest',
        label: 'Harvest',
        detail: 'Current role',
        coverageStatus: 'ready',
        reasonCodes: ['CURRENT_ROLE'],
      },
      desiredRole: {
        value: 'Scale',
        label: 'Scale',
        detail: 'Desired role',
        coverageStatus: 'ready',
        reasonCodes: ['NEXT_ROLE'],
      },
      previousRole: 'Harvest',
      transitionRule: 'scale_up',
      transitionReasonCodes: ['ROLE_TRANSITION'],
      summaryReasonCodes: ['ROLE_SUMMARY'],
      guardrails: {
        flags: {
          requiresManualApproval: false,
          autoPauseEligible: false,
          transitionLocked: false,
        },
      },
    },
    recommendation: {
      recommendationSnapshotId: 'rec-1',
      targetSnapshotId: 'snap-1',
      createdAt: '2026-03-18T00:00:00Z',
      status: 'generated',
      actionType: 'update_target_bid',
      spendDirection: 'reduce',
      primaryActionType: 'update_target_bid',
      actionCount: 2,
      reasonCodes: ['hero_query', 'profit_guarded'],
      coverageFlags: [],
      confidenceNotes: [],
      unsupportedActionBlocks: [],
      portfolioControls: null,
      queryDiagnostics: {
        contextScope: 'search_term_context_only',
        note: 'Search-term diagnostics remain contextual only.',
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
      placementDiagnostics: null,
      exceptionSignals: [{ severity: 'high', type: 'guardrail_breach', title: 'Guardrail', detail: 'Manual review', reasonCodes: ['guardrail'] }],
      executionBoundary: 'read_only_recommendation_only',
      workspaceHandoff: 'not_started',
      writesExecutionTables: false,
      manualReviewRequired: false,
      outputState: 'generated',
      supportingMetrics: null,
      phasedBidPlan: null,
      actions: [
        {
          actionType: 'update_target_bid',
          priority: 1,
          entityContext: { current_bid: 1.45 },
          proposedChange: { next_bid: 1.3 },
          reasonCodes: [],
          supportingMetrics: null,
        },
        {
          actionType: 'update_target_state',
          priority: 2,
          entityContext: { current_state: 'enabled' },
          proposedChange: { next_state: 'paused' },
          reasonCodes: [],
          supportingMetrics: null,
        },
      ],
    },
    manualOverride: null,
    previousComparable: null,
    roleHistory: [],
    queue: {
      priority: 10,
      recommendationCount: 2,
      primaryActionType: 'update_target_bid',
      spendDirection: 'reduce',
      reasonCodeBadges: ['hero_query', 'profit_guarded'],
      readOnlyBoundary: 'read_only_recommendation_only',
      hasCoverageGaps: false,
    },
    ...overrides,
  }) as unknown as AdsOptimizerTargetReviewRow;

describe('ads optimizer target row table summary', () => {
  it('maps the collapsed-row table contract with current / previous / change and ranking blocks', () => {
    const previous = buildRow({
      targetSnapshotId: 'snap-0',
      recommendation: null,
      raw: {
        impressions: 700,
        clicks: 31,
        spend: 100,
        orders: 5,
        sales: 220,
        cpc: 3.2,
        ctr: 0.044,
        cvr: 0.161,
        acos: 0.45,
        roas: 2.2,
        tosIs: 0.2,
        stis: 0.15,
        stir: 13,
      },
      derived: {
        contributionAfterAds: 12,
        breakEvenGap: 0.05,
        maxCpcSupportGap: 0.2,
        lossDollars: null,
        profitDollars: 12,
        clickVelocity: 7,
        impressionVelocity: 60,
        organicLeverageProxy: 0.12,
        organicContextSignal: null,
      },
      state: {
        efficiency: {
          value: 'break_even',
          label: 'Break even',
          detail: 'Near break-even',
          coverageStatus: 'ready',
          reasonCodes: ['STATE_BE'],
        },
        confidence: {
          value: 'confirmed',
          label: 'Confirmed',
          detail: 'Enough coverage',
          coverageStatus: 'ready',
          reasonCodes: ['CONFIRMED'],
        },
        importance: {
          value: 'tier_1_dominant',
          label: 'Tier 1 dominant',
          detail: 'Primary target',
          coverageStatus: 'ready',
          reasonCodes: ['TIER_1'],
        },
        riskScore: 8,
        opportunityScore: 12,
        opportunityReasonCodes: [],
        riskReasonCodes: [],
        summaryReasonCodes: [],
      },
    });
    const row = buildRow({
      previousComparable: previous,
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.identity.targetKindLabel).toBe('Keyword');
    expect(summary.identity.matchTypeLabel).toBe('Exact');
    expect(summary.identity.campaignContextLabel).toBe('Core Campaign | Exact Group');
    expect(summary.stateComparison.rows[0].current.display).toBe('Profitable');
    expect(summary.stateComparison.rows[0].previous.display).toBe('Break even');
    expect(summary.stateComparison.rows[0].change.display).toBe('Improved');
    expect(summary.stateComparison.rows[1].current.display).toBe('$54.00');
    expect(summary.stateComparison.rows[1].previous.display).toBe('$12.00');
    expect(summary.stateComparison.rows[1].change.display).toBe('+$42.00');
    expect(summary.stateComparison.rows[2].change.display).toBe('-11.7pp');
    expect(summary.stateComparison.rows[2].change.tone).toBe('good');
    expect(summary.stateComparison.rows[3].current.display).toBe('40.0%');
    expect(summary.stateComparison.rows[3].previous.display).toBe('50.0%');
    expect(summary.ranking.organic.latestLabel).toBe('#9');
    expect(summary.ranking.organic.trendLabel).toBe('Rising');
    expect(summary.ranking.sponsored.latestLabel).toBe('#16');
    expect(summary.ranking.sponsored.trendLabel).toBe('Maintain');
  });

  it('keeps contribution share and rank stable against the full run, not the filtered subset', () => {
    const dominant = buildRow({
      targetSnapshotId: 'snap-a',
      persistedTargetKey: 'target-a',
      targetText: 'dominant',
      state: {
        ...buildRow().state,
        importance: {
          ...buildRow().state.importance,
          value: 'tier_1_dominant',
          label: 'Tier 1 dominant',
        },
      },
      raw: {
        ...buildRow().raw,
        impressions: 1000,
        spend: 50,
        sales: 100,
      },
    });
    const middle = buildRow({
      targetSnapshotId: 'snap-b',
      persistedTargetKey: 'target-b',
      targetText: 'middle',
      state: {
        ...buildRow().state,
        importance: {
          ...buildRow().state.importance,
          value: 'tier_2_core',
          label: 'Tier 2 core',
        },
      },
      raw: {
        ...buildRow().raw,
        impressions: 600,
        spend: 30,
        sales: 60,
      },
    });
    const tail = buildRow({
      targetSnapshotId: 'snap-c',
      persistedTargetKey: 'target-c',
      targetText: 'tail',
      state: {
        ...buildRow().state,
        importance: {
          ...buildRow().state.importance,
          value: 'tier_3_test_long_tail',
          label: 'Tier 3 test / long-tail',
        },
      },
      raw: {
        ...buildRow().raw,
        impressions: 200,
        spend: 20,
        sales: 20,
      },
    });

    const summaries = buildAdsOptimizerTargetRowTableSummaries([dominant, middle, tail]);
    const filtered = filterAdsOptimizerTargetRowTableSummaries(summaries, {
      role: 'all',
      efficiency: 'all',
      tier: 'tier_2_core',
      confidence: 'all',
      spendDirection: 'all',
      exceptions: 'all',
      sortBy: 'priority',
      sortDirection: 'asc',
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.contribution.rows[0]?.share.display).toBe('33.3%');
    expect(filtered[0]?.contribution.rows[0]?.rank.display).toBe('Rank 2');
    expect(filtered[0]?.contribution.rows[1]?.share.display).toBe('30.0%');
    expect(filtered[0]?.contribution.rows[1]?.rank.display).toBe('Rank 2');
    expect(filtered[0]?.contribution.rows[2]?.share.display).toBe('33.3%');
    expect(filtered[0]?.contribution.rows[2]?.rank.display).toBe('Rank 2');
  });

  it('classifies ranking trends with the required fluctuation-safe vocabulary', () => {
    expect(
      classifyAdsOptimizerRankingTrend([
        { observedDate: '2026-03-01', rank: 20 },
        { observedDate: '2026-03-03', rank: 18 },
        { observedDate: '2026-03-05', rank: 17 },
        { observedDate: '2026-03-07', rank: 11 },
        { observedDate: '2026-03-09', rank: 10 },
        { observedDate: '2026-03-11', rank: 9 },
      ]).trendLabel
    ).toBe('Rising');
    expect(
      classifyAdsOptimizerRankingTrend([
        { observedDate: '2026-03-01', rank: 20 },
        { observedDate: '2026-03-03', rank: 18 },
        { observedDate: '2026-03-05', rank: 17 },
        { observedDate: '2026-03-07', rank: 16 },
        { observedDate: '2026-03-09', rank: 15 },
        { observedDate: '2026-03-11', rank: 14 },
      ]).trendLabel
    ).toBe('Maintain');
    expect(
      classifyAdsOptimizerRankingTrend([
        { observedDate: '2026-03-01', rank: 10 },
        { observedDate: '2026-03-03', rank: 9 },
        { observedDate: '2026-03-05', rank: 8 },
        { observedDate: '2026-03-07', rank: 16 },
        { observedDate: '2026-03-09', rank: 18 },
        { observedDate: '2026-03-11', rank: 19 },
      ]).trendLabel
    ).toBe('Decline');
    expect(
      classifyAdsOptimizerRankingTrend([
        { observedDate: '2026-03-01', rank: 14 },
        { observedDate: '2026-03-03', rank: 13 },
        { observedDate: '2026-03-05', rank: 12 },
      ]).trendLabel
    ).toBe('Limited data');
    expect(classifyAdsOptimizerRankingTrend([]).trendLabel).toBe('No data');
  });

  it('keeps ranking output driven by the current row only when previous comparison data changes', () => {
    const previous = buildRow({
      targetSnapshotId: 'snap-0',
      rankingContext: {
        note: null,
        organicObservedRanks: [
          { observedDate: '2026-03-01', rank: 18 },
          { observedDate: '2026-03-05', rank: 16 },
          { observedDate: '2026-03-09', rank: 14 },
          { observedDate: '2026-03-12', rank: 12 },
        ],
        sponsoredObservedRanks: [
          { observedDate: '2026-03-01', rank: 20 },
          { observedDate: '2026-03-05', rank: 19 },
          { observedDate: '2026-03-09', rank: 18 },
          { observedDate: '2026-03-12', rank: 17 },
        ],
      },
    });
    const row = buildRow({
      rankingContext: {
        note: null,
        organicObservedRanks: [],
        sponsoredObservedRanks: [],
      },
      previousComparable: previous,
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.ranking.organic.latestLabel).toBe('No data');
    expect(summary.ranking.organic.trendLabel).toBe('No data');
    expect(summary.ranking.sponsored.latestLabel).toBe('No data');
    expect(summary.ranking.sponsored.trendLabel).toBe('No data');
  });

  it('renders multi-change summaries compactly and preserves supported handoff actions', () => {
    const row = buildRow({
      recommendation: {
        ...buildRow().recommendation!,
        actionCount: 3,
        actions: [
          {
            actionType: 'update_target_bid',
            priority: 1,
            entityContext: { current_bid: 1.45 },
            proposedChange: { next_bid: 1.3 },
            reasonCodes: [],
            supportingMetrics: null,
          },
          {
            actionType: 'update_placement_modifier',
            priority: 2,
            entityContext: {
              placement_code: 'PLACEMENT_TOP',
              current_percentage: 15,
            },
            proposedChange: {
              placement_code: 'PLACEMENT_TOP',
              next_percentage: 10,
            },
            reasonCodes: [],
            supportingMetrics: null,
          },
          {
            actionType: 'update_target_state',
            priority: 3,
            entityContext: { current_state: 'enabled' },
            proposedChange: { next_state: 'paused' },
            reasonCodes: [],
            supportingMetrics: null,
          },
        ],
      },
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.changeSummary.lines).toEqual([
      'Reduce bid from $1.45 to $1.30',
      'Reduce TOS modifier from 15% to 10%',
    ]);
    expect(summary.changeSummary.overflowCount).toBe(1);
    expect(summary.handoff.stageable).toBe(true);
    expect(summary.handoff.workspaceActionCount).toBe(3);
  });
});
