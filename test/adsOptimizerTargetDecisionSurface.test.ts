import { describe, expect, it } from 'vitest';

import {
  buildAdsOptimizerPlacementEvidenceRows,
  buildAdsOptimizerSearchTermEvidenceRows,
  buildAdsOptimizerSearchTermsEmptyState,
} from '@/lib/ads-optimizer/targetDecisionSurface';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';

const buildRow = (): AdsOptimizerTargetReviewRow =>
  ({
    targetSnapshotId: 'snap-1',
    targetId: 'target-1',
    targetText: 'hero exact',
    placementContext: {
      topOfSearchModifierPct: 25,
      impressions: 1400,
      clicks: 64,
      orders: 9,
      units: 9,
      sales: 420,
      spend: 96,
      note: 'Campaign-level placement context.',
    },
    searchTermDiagnostics: {
      representativeSearchTerm: 'hero exact',
      representativeSameText: true,
      note: 'Search-term diagnostics remain limited to captured top terms.',
      topTerms: [
        {
          searchTerm: 'hero exact',
          sameText: true,
          impressions: 800,
          clicks: 40,
          orders: 8,
          spend: 54,
          sales: 320,
          stis: 0.42,
          stir: 11,
        },
        {
          searchTerm: 'hero broad waste',
          sameText: false,
          impressions: 300,
          clicks: 18,
          orders: 0,
          spend: 28,
          sales: 0,
          stis: null,
          stir: null,
        },
      ],
    },
    demandProxies: {
      searchTermCount: 2,
      sameTextSearchTermCount: 1,
      totalSearchTermImpressions: 1100,
      totalSearchTermClicks: 58,
      representativeSearchTerm: 'hero exact',
      representativeClickShare: 0.69,
    },
    coverage: {
      statuses: {
        placementContext: 'ready',
        searchTerms: 'ready',
      },
    },
    recommendation: {
      queryDiagnostics: {
        promoteToExactCandidates: [],
        isolateCandidates: [
          {
            searchTerm: 'hero broad waste',
            sameText: false,
            clicks: 18,
            orders: 0,
            spend: 28,
            sales: 0,
            stis: null,
            stir: null,
          },
        ],
        negativeCandidates: [
          {
            searchTerm: 'hero broad waste',
            sameText: false,
            clicks: 18,
            orders: 0,
            spend: 28,
            sales: 0,
            stis: null,
            stir: null,
          },
        ],
        sameTextQueryPinning: {
          status: 'pinned',
          searchTerm: 'hero exact',
          clickShare: 0.69,
          orderShareProxy: 0.8,
          reasonCodes: [],
        },
        contextScope: 'search_term_context_only',
        note: 'Hero same-text query remains pinned.',
      },
      placementDiagnostics: {
        contextScope: 'campaign_level_context_only',
        currentPlacementLabel: 'Top of search',
        currentPlacementCode: 'PLACEMENT_TOP',
        currentPercentage: 25,
        biasRecommendation: 'stronger',
        reasonCodes: ['PLACEMENT_BIAS_STRONGER_CONTEXT'],
        note: 'Campaign-level context only.',
      },
    },
  }) as unknown as AdsOptimizerTargetReviewRow;

describe('ads optimizer target decision surface helpers', () => {
  it('builds operator-facing search-term KPI rows with decision evidence tags', () => {
    const rows = buildAdsOptimizerSearchTermEvidenceRows(buildRow());

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      searchTerm: 'hero exact',
      clicks: 40,
      orders: 8,
      spend: 54,
      sales: 320,
    });
    expect(rows[0]?.evidenceTags).toContain('Same-text');
    expect(rows[0]?.evidenceTags).toContain('Winning');
    expect(rows[1]?.evidenceTags).toContain('Losing');
    expect(rows[1]?.evidenceTags).toContain('Isolate');
    expect(rows[1]?.evidenceTags).toContain('Negate');
  });

  it('returns an explicit limited-data state when no search-term rows are available', () => {
    const row = buildRow();
    row.searchTermDiagnostics.topTerms = [];
    row.coverage.statuses.searchTerms = 'expected_unavailable';

    expect(buildAdsOptimizerSearchTermsEmptyState(row)).toContain(
      'expected to be unavailable'
    );
  });

  it('builds all three placement rows and marks missing context explicitly', () => {
    const rows = buildAdsOptimizerPlacementEvidenceRows(buildRow());

    expect(rows.map((row) => row.shortLabel)).toEqual(['TOS', 'ROS', 'PP']);
    expect(rows[0]).toMatchObject({
      hasKpiContext: true,
      clicks: 64,
      spend: 96,
      sales: 420,
      currentFocus: true,
      recommendationLabel: 'Bias stronger',
    });
    expect(rows[1]?.hasKpiContext).toBe(false);
    expect(rows[1]?.note).toContain('Top of Search campaign placement context');
    expect(rows[2]?.hasKpiContext).toBe(false);
  });
});
