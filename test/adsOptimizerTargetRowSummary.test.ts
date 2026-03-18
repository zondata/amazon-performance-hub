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
      contract: 'keyword_query_context',
      status: 'ready',
      resolvedKeywordNorm: 'hero exact',
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

const buildFilters = (
  overrides: Partial<Parameters<typeof filterAdsOptimizerTargetRowTableSummaries>[1]> = {}
): Parameters<typeof filterAdsOptimizerTargetRowTableSummaries>[1] => ({
  role: 'all',
  efficiency: 'all',
  tier: 'all',
  confidence: 'all',
  spendDirection: 'all',
  exceptions: 'all',
  targetSearch: '',
  sortBy: 'priority',
  sortDirection: 'asc',
  ...overrides,
});

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
    const filtered = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        tier: 'tier_2_core',
      })
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.contribution.rows[0]?.share.display).toBe('33.3%');
    expect(filtered[0]?.contribution.rows[0]?.rank.display).toBe('Rank 2');
    expect(filtered[0]?.contribution.rows[1]?.share.display).toBe('30.0%');
    expect(filtered[0]?.contribution.rows[1]?.rank.display).toBe('Rank 2');
    expect(filtered[0]?.contribution.rows[2]?.share.display).toBe('33.3%');
    expect(filtered[0]?.contribution.rows[2]?.rank.display).toBe('Rank 2');
  });

  it('filters target search by trimmed case-insensitive target text and target id', () => {
    const hero = buildRow({
      targetSnapshotId: 'snap-hero',
      persistedTargetKey: 'target-hero',
      targetText: 'Hero Exact',
      targetId: 'kw-hero',
    });
    const brand = buildRow({
      targetSnapshotId: 'snap-brand',
      persistedTargetKey: 'target-brand',
      targetText: 'Brand Broad',
      targetId: 'kw-brand',
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([hero, brand]);

    const byText = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({ targetSearch: '  hero exact  ' })
    );
    const byId = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({ targetSearch: 'KW-BRAND' })
    );

    expect(byText.map((summary) => summary.identity.targetText)).toEqual(['Hero Exact']);
    expect(byId.map((summary) => summary.identity.targetText)).toEqual(['Brand Broad']);
  });

  it('returns an empty filtered set for zero-match search and restores rows when the search is cleared', () => {
    const hero = buildRow({
      targetSnapshotId: 'snap-hero-clear',
      persistedTargetKey: 'target-hero-clear',
      targetText: 'Hero Exact',
      targetId: 'kw-hero-clear',
    });
    const brand = buildRow({
      targetSnapshotId: 'snap-brand-clear',
      persistedTargetKey: 'target-brand-clear',
      targetText: 'Brand Broad',
      targetId: 'kw-brand-clear',
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([hero, brand]);

    const zeroMatch = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({ targetSearch: 'missing target' })
    );
    const restored = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({ targetSearch: '' })
    );

    expect(zeroMatch).toEqual([]);
    expect(restored.map((summary) => summary.identity.targetText)).toHaveLength(2);
  });

  it('sorts current P&L with missing values last', () => {
    const profitable = buildRow({
      targetSnapshotId: 'snap-profit',
      persistedTargetKey: 'target-profit',
      targetText: 'profitable',
      derived: {
        ...buildRow().derived,
        contributionAfterAds: 45,
        profitDollars: 45,
        lossDollars: null,
      },
    });
    const lossMaking = buildRow({
      targetSnapshotId: 'snap-loss',
      persistedTargetKey: 'target-loss',
      targetText: 'loss making',
      derived: {
        ...buildRow().derived,
        contributionAfterAds: -15,
        profitDollars: null,
        lossDollars: 15,
      },
    });
    const missing = buildRow({
      targetSnapshotId: 'snap-missing-profit',
      persistedTargetKey: 'target-missing-profit',
      targetText: 'missing profit',
      derived: {
        ...buildRow().derived,
        contributionAfterAds: null,
        profitDollars: null,
        lossDollars: null,
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([lossMaking, missing, profitable]);

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'state_current_profit_loss',
        sortDirection: 'desc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'profitable',
      'loss making',
      'missing profit',
    ]);
  });

  it('sorts current ACoS ascending with missing values last', () => {
    const efficient = buildRow({
      targetSnapshotId: 'snap-acos-low',
      persistedTargetKey: 'target-acos-low',
      targetText: 'acos low',
      raw: {
        ...buildRow().raw,
        acos: 0.19,
      },
    });
    const inefficient = buildRow({
      targetSnapshotId: 'snap-acos-high',
      persistedTargetKey: 'target-acos-high',
      targetText: 'acos high',
      raw: {
        ...buildRow().raw,
        acos: 0.42,
      },
    });
    const missing = buildRow({
      targetSnapshotId: 'snap-acos-missing',
      persistedTargetKey: 'target-acos-missing',
      targetText: 'acos missing',
      raw: {
        ...buildRow().raw,
        acos: null,
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([inefficient, missing, efficient]);

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'state_current_acos',
        sortDirection: 'asc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'acos low',
      'acos high',
      'acos missing',
    ]);
  });

  it('sorts current Spend descending', () => {
    const high = buildRow({
      targetSnapshotId: 'snap-spend-high',
      persistedTargetKey: 'target-spend-high',
      targetText: 'spend high',
      raw: {
        ...buildRow().raw,
        spend: 180,
      },
    });
    const middle = buildRow({
      targetSnapshotId: 'snap-spend-middle',
      persistedTargetKey: 'target-spend-middle',
      targetText: 'spend middle',
      raw: {
        ...buildRow().raw,
        spend: 120,
      },
    });
    const low = buildRow({
      targetSnapshotId: 'snap-spend-low',
      persistedTargetKey: 'target-spend-low',
      targetText: 'spend low',
      raw: {
        ...buildRow().raw,
        spend: 40,
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([middle, low, high]);

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'economics_current_spend',
        sortDirection: 'desc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'spend high',
      'spend middle',
      'spend low',
    ]);
  });

  it('sorts current Sales descending', () => {
    const high = buildRow({
      targetSnapshotId: 'snap-sales-high',
      persistedTargetKey: 'target-sales-high',
      targetText: 'sales high',
      raw: {
        ...buildRow().raw,
        sales: 500,
      },
    });
    const middle = buildRow({
      targetSnapshotId: 'snap-sales-middle',
      persistedTargetKey: 'target-sales-middle',
      targetText: 'sales middle',
      raw: {
        ...buildRow().raw,
        sales: 300,
      },
    });
    const low = buildRow({
      targetSnapshotId: 'snap-sales-low',
      persistedTargetKey: 'target-sales-low',
      targetText: 'sales low',
      raw: {
        ...buildRow().raw,
        sales: 100,
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([middle, low, high]);

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'economics_current_sales',
        sortDirection: 'desc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'sales high',
      'sales middle',
      'sales low',
    ]);
  });

  it('sorts current Orders descending', () => {
    const high = buildRow({
      targetSnapshotId: 'snap-orders-high',
      persistedTargetKey: 'target-orders-high',
      targetText: 'orders high',
      raw: {
        ...buildRow().raw,
        orders: 12,
      },
    });
    const middle = buildRow({
      targetSnapshotId: 'snap-orders-middle',
      persistedTargetKey: 'target-orders-middle',
      targetText: 'orders middle',
      raw: {
        ...buildRow().raw,
        orders: 7,
      },
    });
    const low = buildRow({
      targetSnapshotId: 'snap-orders-low',
      persistedTargetKey: 'target-orders-low',
      targetText: 'orders low',
      raw: {
        ...buildRow().raw,
        orders: 2,
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([middle, low, high]);

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'economics_current_orders',
        sortDirection: 'desc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'orders high',
      'orders middle',
      'orders low',
    ]);
  });

  it('sorts sales contribution rank with rank 1 before rank 2 before missing', () => {
    const first = buildRow({
      targetSnapshotId: 'snap-rank-1',
      persistedTargetKey: 'target-rank-1',
      targetText: 'rank one',
      raw: {
        ...buildRow().raw,
        sales: 500,
      },
    });
    const second = buildRow({
      targetSnapshotId: 'snap-rank-2',
      persistedTargetKey: 'target-rank-2',
      targetText: 'rank two',
      raw: {
        ...buildRow().raw,
        sales: 300,
      },
    });
    const missing = buildRow({
      targetSnapshotId: 'snap-rank-missing',
      persistedTargetKey: 'target-rank-missing',
      targetText: 'rank missing',
      raw: {
        ...buildRow().raw,
        sales: 100,
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([second, missing, first]).map(
      (summary) =>
        summary.targetSnapshotId === 'snap-rank-missing'
          ? {
              ...summary,
              sort: {
                ...summary.sort,
                contributionSalesRank: null,
              },
            }
          : summary
    );

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'contribution_sales_rank',
        sortDirection: 'asc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'rank one',
      'rank two',
      'rank missing',
    ]);
  });

  it('sorts organic latest rank with lower numbers first and missing values last', () => {
    const best = buildRow({
      targetSnapshotId: 'snap-organic-best',
      persistedTargetKey: 'target-organic-best',
      targetText: 'organic best',
      rankingContext: {
        ...buildRow().rankingContext!,
        organicObservedRanks: [
          { observedDate: '2026-03-01', rank: 8 },
          { observedDate: '2026-03-05', rank: 6 },
          { observedDate: '2026-03-09', rank: 5 },
          { observedDate: '2026-03-12', rank: 4 },
        ],
      },
    });
    const worse = buildRow({
      targetSnapshotId: 'snap-organic-worse',
      persistedTargetKey: 'target-organic-worse',
      targetText: 'organic worse',
      rankingContext: {
        ...buildRow().rankingContext!,
        organicObservedRanks: [
          { observedDate: '2026-03-01', rank: 18 },
          { observedDate: '2026-03-05', rank: 16 },
          { observedDate: '2026-03-09', rank: 14 },
          { observedDate: '2026-03-12', rank: 12 },
        ],
      },
    });
    const missing = buildRow({
      targetSnapshotId: 'snap-organic-missing',
      persistedTargetKey: 'target-organic-missing',
      targetText: 'organic missing',
      rankingContext: {
        ...buildRow().rankingContext!,
        organicObservedRanks: [],
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([worse, missing, best]);

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'ranking_organic_latest',
        sortDirection: 'asc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'organic best',
      'organic worse',
      'organic missing',
    ]);
  });

  it('sorts organic trend by defined score and keeps No data last', () => {
    const rising = buildRow({
      targetSnapshotId: 'snap-trend-rising',
      persistedTargetKey: 'target-trend-rising',
      targetText: 'trend rising',
      rankingContext: {
        ...buildRow().rankingContext!,
        organicObservedRanks: [
          { observedDate: '2026-03-01', rank: 20 },
          { observedDate: '2026-03-03', rank: 18 },
          { observedDate: '2026-03-05', rank: 17 },
          { observedDate: '2026-03-07', rank: 11 },
          { observedDate: '2026-03-09', rank: 10 },
          { observedDate: '2026-03-11', rank: 9 },
        ],
      },
    });
    const maintain = buildRow({
      targetSnapshotId: 'snap-trend-maintain',
      persistedTargetKey: 'target-trend-maintain',
      targetText: 'trend maintain',
      rankingContext: {
        ...buildRow().rankingContext!,
        organicObservedRanks: [
          { observedDate: '2026-03-01', rank: 20 },
          { observedDate: '2026-03-03', rank: 18 },
          { observedDate: '2026-03-05', rank: 17 },
          { observedDate: '2026-03-07', rank: 16 },
          { observedDate: '2026-03-09', rank: 15 },
          { observedDate: '2026-03-11', rank: 14 },
        ],
      },
    });
    const limited = buildRow({
      targetSnapshotId: 'snap-trend-limited',
      persistedTargetKey: 'target-trend-limited',
      targetText: 'trend limited',
      rankingContext: {
        ...buildRow().rankingContext!,
        organicObservedRanks: [
          { observedDate: '2026-03-01', rank: 14 },
          { observedDate: '2026-03-03', rank: 13 },
          { observedDate: '2026-03-05', rank: 12 },
        ],
      },
    });
    const missing = buildRow({
      targetSnapshotId: 'snap-trend-missing',
      persistedTargetKey: 'target-trend-missing',
      targetText: 'trend missing',
      rankingContext: {
        ...buildRow().rankingContext!,
        organicObservedRanks: [],
      },
    });
    const summaries = buildAdsOptimizerTargetRowTableSummaries([
      limited,
      missing,
      maintain,
      rising,
    ]);

    const sorted = filterAdsOptimizerTargetRowTableSummaries(
      summaries,
      buildFilters({
        sortBy: 'ranking_organic_trend',
        sortDirection: 'desc',
      })
    );

    expect(sorted.map((summary) => summary.identity.targetText)).toEqual([
      'trend rising',
      'trend maintain',
      'trend limited',
      'trend missing',
    ]);
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

  it('shows Limited data for supported ranking rows with too few observations', () => {
    const row = buildRow({
      rankingContext: {
        contract: 'keyword_query_context',
        status: 'ready',
        resolvedKeywordNorm: 'hero exact',
        note: null,
        organicObservedRanks: [
          { observedDate: '2026-03-01', rank: 14 },
          { observedDate: '2026-03-03', rank: 13 },
          { observedDate: '2026-03-05', rank: 12 },
        ],
        sponsoredObservedRanks: [
          { observedDate: '2026-03-01', rank: 9 },
          { observedDate: '2026-03-03', rank: 8 },
          { observedDate: '2026-03-05', rank: 8 },
        ],
      },
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.ranking.organic.latestLabel).toBe('#12');
    expect(summary.ranking.organic.trendLabel).toBe('Limited data');
    expect(summary.ranking.sponsored.latestLabel).toBe('#8');
    expect(summary.ranking.sponsored.trendLabel).toBe('Limited data');
  });

  it('shows No data / No snapshot for supported ranking rows without any captured observations', () => {
    const row = buildRow({
      rankingContext: {
        contract: 'keyword_query_context',
        status: 'ready',
        resolvedKeywordNorm: 'hero exact',
        note: 'Keyword-query ranking is supported for this positive keyword, but no ranking snapshot was found in the selected ASIN window.',
        organicObservedRanks: [],
        sponsoredObservedRanks: [],
      },
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.ranking.organic.latestLabel).toBe('No data');
    expect(summary.ranking.organic.trendLabel).toBe('No snapshot');
    expect(summary.ranking.sponsored.latestLabel).toBe('No data');
    expect(summary.ranking.sponsored.trendLabel).toBe('No snapshot');
  });

  it('shows Unsupported with an honest short reason for unsupported ranking rows', () => {
    const row = buildRow({
      rankingContext: {
        contract: 'keyword_query_context',
        status: 'unsupported',
        resolvedKeywordNorm: null,
        note: 'Keyword-query ranking is unsupported for negative keywords.',
        organicObservedRanks: [],
        sponsoredObservedRanks: [],
      },
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.ranking.organic.latestLabel).toBe('Unsupported');
    expect(summary.ranking.organic.trendLabel).toBe('Negative keyword');
    expect(summary.ranking.sponsored.latestLabel).toBe('Unsupported');
    expect(summary.ranking.sponsored.trendLabel).toBe('Negative keyword');
  });

  it('does not default legacy rows without ranking payload to Unavailable', () => {
    const row = buildRow({
      rankingContext: undefined,
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.ranking.organic.latestLabel).toBe('No data');
    expect(summary.ranking.organic.trendLabel).toBe('No snapshot');
    expect(summary.ranking.sponsored.latestLabel).toBe('No data');
    expect(summary.ranking.sponsored.trendLabel).toBe('No snapshot');
  });

  it('uses captured observations even when a persisted ranking payload is missing status', () => {
    const row = buildRow({
      rankingContext: {
        contract: 'keyword_query_context',
        status: null,
        resolvedKeywordNorm: 'hero exact',
        note: 'Legacy ranking payload without explicit status.',
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
      } as AdsOptimizerTargetReviewRow['rankingContext'],
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.ranking.organic.latestLabel).toBe('#9');
    expect(summary.ranking.organic.trendLabel).toBe('Rising');
    expect(summary.ranking.sponsored.latestLabel).toBe('#16');
    expect(summary.ranking.sponsored.trendLabel).toBe('Maintain');
  });

  it('keeps ranking output driven by the current row only when previous comparison data changes', () => {
    const previous = buildRow({
      targetSnapshotId: 'snap-0',
      rankingContext: {
        contract: 'keyword_query_context',
        status: 'ready',
        resolvedKeywordNorm: 'hero exact',
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
        contract: 'keyword_query_context',
        status: 'ready',
        resolvedKeywordNorm: 'hero exact',
        note: null,
        organicObservedRanks: [],
        sponsoredObservedRanks: [],
      },
      previousComparable: previous,
    });

    const summary = buildAdsOptimizerTargetRowTableSummary(row, [row]);

    expect(summary.ranking.organic.latestLabel).toBe('No data');
    expect(summary.ranking.organic.trendLabel).toBe('No snapshot');
    expect(summary.ranking.sponsored.latestLabel).toBe('No data');
    expect(summary.ranking.sponsored.trendLabel).toBe('No snapshot');
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
