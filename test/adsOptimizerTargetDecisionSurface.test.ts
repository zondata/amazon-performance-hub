import { describe, expect, it } from 'vitest';

import {
  buildAdsOptimizerPlacementCampaignTargetCount,
  buildAdsOptimizerPlacementEvidenceRows,
  buildAdsOptimizerPlacementTableRows,
  buildAdsOptimizerPlacementTotalsRow,
  buildAdsOptimizerSearchTermEvidenceRows,
  buildAdsOptimizerSearchTermTableRows,
  buildAdsOptimizerSearchTermsEmptyState,
} from '@/lib/ads-optimizer/targetDecisionSurface';
import type { AdsOptimizerTargetReviewRow } from '@/lib/ads-optimizer/runtime';

const buildRow = (): AdsOptimizerTargetReviewRow =>
  ({
    targetSnapshotId: 'snap-1',
    campaignId: 'campaign-1',
    targetId: 'target-1',
    targetText: 'hero exact',
    currentCampaignBiddingStrategy: 'dynamic down only',
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
    placementBreakdown: {
      note: 'Placement metrics remain campaign-level context only. They are shared across targets in the same campaign and must not be treated as target-owned history.',
      rows: [
        {
          placementCode: 'PLACEMENT_TOP',
          placementLabel: 'Top of search',
          modifierPct: 25,
          impressions: 1400,
          clicks: 64,
          orders: 9,
          sales: 420,
          spend: 96,
        },
        {
          placementCode: 'PLACEMENT_REST_OF_SEARCH',
          placementLabel: 'Rest of search',
          modifierPct: 10,
          impressions: 900,
          clicks: 40,
          orders: 0,
          sales: 0,
          spend: 52,
        },
        {
          placementCode: 'PLACEMENT_PRODUCT_PAGE',
          placementLabel: 'Product pages',
          modifierPct: null,
          impressions: 200,
          clicks: 0,
          orders: 0,
          sales: 0,
          spend: 0,
        },
      ],
    },
    searchTermDiagnostics: {
      representativeSearchTerm: 'Hero Exact',
      representativeSameText: true,
      note: 'Search-term diagnostics remain limited to captured top terms.',
      topTerms: [
        {
          searchTerm: 'Hero Exact',
          sameText: true,
          impressions: 100,
          clicks: 20,
          orders: 5,
          spend: 40,
          sales: 200,
          stis: 0.42,
          stir: 11,
        },
        {
          searchTerm: 'Hero Broad Winner',
          sameText: false,
          impressions: 60,
          clicks: 10,
          orders: 2,
          spend: 15,
          sales: 100,
          stis: 0.12,
          stir: 38,
        },
        {
          searchTerm: 'Hero Broad Waste',
          sameText: false,
          impressions: 40,
          clicks: 6,
          orders: 0,
          spend: 20,
          sales: 0,
          stis: null,
          stir: 55,
        },
        {
          searchTerm: 'Net New Discovery',
          sameText: false,
          impressions: 10,
          clicks: 2,
          orders: 0,
          spend: 5,
          sales: 0,
          stis: 0.05,
          stir: 71,
        },
      ],
    },
    previousComparable: {
      placementBreakdown: {
        note: 'Placement metrics remain campaign-level context only. They are shared across targets in the same campaign and must not be treated as target-owned history.',
        rows: [
          {
            placementCode: 'PLACEMENT_TOP',
            placementLabel: 'Top of search',
            modifierPct: 18,
            impressions: 1200,
            clicks: 48,
            orders: 6,
            sales: 300,
            spend: 90,
          },
          {
            placementCode: 'PLACEMENT_REST_OF_SEARCH',
            placementLabel: 'Rest of search',
            modifierPct: 8,
            impressions: 800,
            clicks: 35,
            orders: 2,
            sales: 40,
            spend: 30,
          },
          {
            placementCode: 'PLACEMENT_PRODUCT_PAGE',
            placementLabel: 'Product pages',
            modifierPct: null,
            impressions: 100,
            clicks: 0,
            orders: 0,
            sales: 0,
            spend: 0,
          },
        ],
      },
      searchTermDiagnostics: {
        representativeSearchTerm: 'Hero Exact',
        representativeSameText: true,
        note: 'Previous comparison window.',
        topTerms: [
          {
            searchTerm: ' hero exact ',
            sameText: true,
            impressions: 80,
            clicks: 16,
            orders: 4,
            spend: 30,
            sales: 160,
            stis: 0.35,
            stir: 14,
          },
          {
            searchTerm: 'hero exact',
            sameText: false,
            impressions: 999,
            clicks: 999,
            orders: 999,
            spend: 999,
            sales: 999,
            stis: 0.99,
            stir: 1,
          },
          {
            searchTerm: 'hero broad winner',
            sameText: false,
            impressions: 50,
            clicks: 8,
            orders: 1,
            spend: 12,
            sales: 60,
            stis: 0.1,
            stir: 40,
          },
          {
            searchTerm: 'hero broad waste',
            sameText: false,
            impressions: 20,
            clicks: 4,
            orders: 0,
            spend: 10,
            sales: 0,
            stis: null,
            stir: 61,
          },
          {
            searchTerm: 'previous only',
            sameText: false,
            impressions: 15,
            clicks: 1,
            orders: 0,
            spend: 3,
            sales: 0,
            stis: null,
            stir: 77,
          },
        ],
      },
    },
    demandProxies: {
      searchTermCount: 4,
      sameTextSearchTermCount: 1,
      totalSearchTermImpressions: 210,
      totalSearchTermClicks: 38,
      representativeSearchTerm: 'Hero Exact',
      representativeClickShare: 0.53,
    },
    coverage: {
      statuses: {
        tosIs: 'ready',
        placementContext: 'ready',
        searchTerms: 'ready',
      },
    },
    recommendation: {
      queryDiagnostics: {
        promoteToExactCandidates: [
          {
            searchTerm: 'Hero Broad Winner',
            sameText: false,
            clicks: 10,
            orders: 2,
            spend: 15,
            sales: 100,
            stis: 0.12,
            stir: 38,
          },
        ],
        isolateCandidates: [
          {
            searchTerm: 'Hero Broad Winner',
            sameText: false,
            clicks: 10,
            orders: 2,
            spend: 15,
            sales: 100,
            stis: 0.12,
            stir: 38,
          },
        ],
        negativeCandidates: [
          {
            searchTerm: 'Hero Broad Waste',
            sameText: false,
            clicks: 6,
            orders: 0,
            spend: 20,
            sales: 0,
            stis: null,
            stir: 55,
          },
        ],
        sameTextQueryPinning: {
          status: 'pinned',
          searchTerm: 'Hero Exact',
          clickShare: 0.53,
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

    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      searchTerm: 'Hero Exact',
      clicks: 20,
      orders: 5,
      spend: 40,
      sales: 200,
    });
    expect(rows[0]?.evidenceTags).toContain('Same-text');
    expect(rows[0]?.evidenceTags).toContain('Winning');
    expect(rows[1]?.evidenceTags).toContain('Winning');
    expect(rows[1]?.evidenceTags).toContain('Promote exact');
    expect(rows[1]?.evidenceTags).toContain('Isolate');
    expect(rows[2]?.evidenceTags).toContain('Losing');
    expect(rows[2]?.evidenceTags).toContain('Negate');
  });

  it('builds search-term table rows from current rows only and matches previous rows by normalized text plus sameText', () => {
    const rows = buildAdsOptimizerSearchTermTableRows(buildRow());

    expect(rows.map((row) => row.searchTerm)).toEqual([
      'Hero Exact',
      'Hero Broad Winner',
      'Hero Broad Waste',
      'Net New Discovery',
    ]);
    expect(rows.some((row) => row.searchTerm === 'previous only')).toBe(false);

    expect(rows[0]).toMatchObject({
      searchTerm: 'Hero Exact',
      sameText: true,
      primaryEvidence: 'same',
      actionHint: null,
      stis: 0.42,
      stir: 11,
    });
    expect(rows[0]?.impressions).toEqual({
      current: 100,
      previous: 80,
      changePercent: 25,
      isNew: false,
    });
    expect(rows[0]?.clicks.previous).toBe(16);
    expect(rows[0]?.orders.previous).toBe(4);
    expect(rows[0]?.ctr.current).toBe(0.2);
    expect(rows[0]?.ctr.previous).toBe(0.2);
    expect(rows[0]?.ctr.changePercent).toBe(0);
    expect(rows[0]?.cvr.current).toBe(0.25);
    expect(rows[0]?.cvr.previous).toBe(0.25);
    expect(rows[0]?.cvr.changePercent).toBe(0);
    expect(rows[0]?.sales).toEqual({
      current: 200,
      previous: 160,
      changePercent: 25,
      isNew: false,
    });
    expect(rows[0]?.acos.current).toBe(0.2);
    expect(rows[0]?.acos.previous).toBe(0.1875);
    expect(rows[0]?.acos.changePercent).toBeCloseTo(6.6666666667);
    expect(rows[0]?.roas.current).toBe(5);
    expect(rows[0]?.roas.previous).toBeCloseTo(160 / 30);
    expect(rows[0]?.roas.changePercent).toBeCloseTo(-6.25);

    expect(rows[1]).toMatchObject({
      searchTerm: 'Hero Broad Winner',
      primaryEvidence: 'winning',
      actionHint: 'isolate',
      stir: 38,
    });
    expect(rows[1]?.impressions.previous).toBe(50);
    expect(rows[1]?.ctr.current).toBeCloseTo(10 / 60);
    expect(rows[1]?.ctr.previous).toBeCloseTo(8 / 50);
    expect(rows[1]?.cvr.current).toBe(0.2);
    expect(rows[1]?.cvr.previous).toBe(0.125);
    expect(rows[1]?.sales.current).toBe(100);
    expect(rows[1]?.sales.previous).toBe(60);
    expect(rows[1]?.acos.current).toBe(0.15);
    expect(rows[1]?.acos.previous).toBe(0.2);
    expect(rows[1]?.roas.current).toBeCloseTo(100 / 15);
    expect(rows[1]?.roas.previous).toBe(5);

    expect(rows[2]).toMatchObject({
      searchTerm: 'Hero Broad Waste',
      primaryEvidence: 'losing',
      actionHint: 'negate',
    });
    expect(rows[2]?.impressions.previous).toBe(20);
    expect(rows[2]?.spend.changePercent).toBe(100);
    expect(rows[2]?.sales.current).toBe(0);
    expect(rows[2]?.sales.previous).toBe(0);
    expect(rows[2]?.sales.changePercent).toBe(null);
    expect(rows[2]?.cvr.current).toBe(0);
    expect(rows[2]?.cvr.previous).toBe(0);
    expect(rows[2]?.cvr.changePercent).toBe(null);
    expect(rows[2]?.acos.previous).toBe(null);
    expect(rows[2]?.acos.changePercent).toBe(null);
    expect(rows[2]?.roas.current).toBe(0);
    expect(rows[2]?.roas.previous).toBe(0);
    expect(rows[2]?.roas.changePercent).toBe(null);
    expect(rows[2]?.orders.changePercent).toBe(null);

    expect(rows[3]).toMatchObject({
      searchTerm: 'Net New Discovery',
      primaryEvidence: 'losing',
      actionHint: null,
    });
    expect(rows[3]?.impressions.isNew).toBe(true);
    expect(rows[3]?.impressions.previous).toBe(null);
    expect(rows[3]?.impressions.changePercent).toBe(null);
    expect(rows[3]?.ctr.isNew).toBe(true);
    expect(rows[3]?.sales.isNew).toBe(true);
    expect(rows[3]?.sales.previous).toBe(null);
    expect(rows[3]?.sales.changePercent).toBe(null);
    expect(rows[3]?.cvr.isNew).toBe(true);
    expect(rows[3]?.roas.isNew).toBe(true);
  });

  it('keeps STIR as a rank integer and does not surface Promote exact in the redesigned row model', () => {
    const rows = buildAdsOptimizerSearchTermTableRows(buildRow());

    expect(rows[1]?.stir).toBe(38);
    expect(typeof rows[1]?.stir).toBe('number');
    expect(JSON.stringify(rows)).not.toContain('Promote exact');
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

  it('builds the placement table rows in canonical order with derived ratios and previous-by-code matching', () => {
    const rows = buildAdsOptimizerPlacementTableRows(buildRow());

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.placementCode)).toEqual([
      'PLACEMENT_TOP',
      'PLACEMENT_REST_OF_SEARCH',
      'PLACEMENT_PRODUCT_PAGE',
    ]);
    expect(rows.map((row) => row.placementName)).toEqual([
      'Top of search',
      'Rest of search',
      'Product pages',
    ]);

    expect(rows[0]).toMatchObject({
      placementCode: 'PLACEMENT_TOP',
      modifierPct: 25,
      bidStrategy: 'dynamic down only',
      evidence: 'strong',
    });
    expect(rows[0]?.impressions).toEqual({
      current: 1400,
      previous: 1200,
      changePercent: 16.666666666666664,
    });
    expect(rows[0]?.ctr.current).toBeCloseTo(64 / 1400);
    expect(rows[0]?.ctr.previous).toBeCloseTo(48 / 1200);
    expect(rows[0]?.cvr.current).toBeCloseTo(9 / 64);
    expect(rows[0]?.cvr.previous).toBeCloseTo(6 / 48);
    expect(rows[0]?.acos.current).toBeCloseTo(96 / 420);
    expect(rows[0]?.acos.previous).toBeCloseTo(90 / 300);
    expect(rows[0]?.roas.current).toBeCloseTo(420 / 96);
    expect(rows[0]?.roas.previous).toBeCloseTo(300 / 90);

    expect(rows[1]).toMatchObject({
      placementCode: 'PLACEMENT_REST_OF_SEARCH',
      modifierPct: 10,
      bidStrategy: 'dynamic down only',
      evidence: 'weak',
    });
    expect(rows[1]?.clicks.previous).toBe(35);
    expect(rows[1]?.ctr.current).toBeCloseTo(40 / 900);
    expect(rows[1]?.ctr.previous).toBeCloseTo(35 / 800);
    expect(rows[1]?.cvr.current).toBe(0);
    expect(rows[1]?.cvr.previous).toBeCloseTo(2 / 35);
    expect(rows[1]?.sales.current).toBe(0);
    expect(rows[1]?.sales.previous).toBe(40);
    expect(rows[1]?.sales.changePercent).toBe(-100);
    expect(rows[1]?.roas.current).toBe(0);
    expect(rows[1]?.roas.previous).toBeCloseTo(40 / 30);
    expect(rows[1]?.roas.changePercent).toBe(-100);

    expect(rows[2]).toMatchObject({
      placementCode: 'PLACEMENT_PRODUCT_PAGE',
      modifierPct: null,
      bidStrategy: 'dynamic down only',
      evidence: 'mixed',
    });
    expect(rows[2]?.clicks.current).toBe(0);
    expect(rows[2]?.clicks.previous).toBe(0);
    expect(rows[2]?.clicks.changePercent).toBe(null);
    expect(rows[2]?.ctr.previous).toBe(0);
    expect(rows[2]?.cvr.previous).toBe(null);
    expect(rows[2]?.acos.previous).toBe(null);
    expect(rows[2]?.roas.previous).toBe(null);
    expect(rows[2]?.roas.changePercent).toBe(null);
  });

  it('builds placement totals from current rows only and counts targets already in memory', () => {
    const rows = buildAdsOptimizerPlacementTableRows(buildRow());
    const totals = buildAdsOptimizerPlacementTotalsRow(rows);
    const count = buildAdsOptimizerPlacementCampaignTargetCount(
      [
        buildRow(),
        { ...buildRow(), targetSnapshotId: 'snap-2', targetId: 'target-2' },
        { ...buildRow(), targetSnapshotId: 'snap-3', targetId: 'target-3', campaignId: 'campaign-2' },
      ],
      'campaign-1'
    );

    expect(totals).toMatchObject({
      placementCount: 3,
      impressions: 2500,
      clicks: 104,
      spend: 148,
      sales: 420,
      orders: 9,
    });
    expect(totals.ctr).toBeCloseTo(104 / 2500);
    expect(totals.cvr).toBeCloseTo(9 / 104);
    expect(totals.acos).toBeCloseTo(148 / 420);
    expect(totals.roas).toBeCloseTo(420 / 148);
    expect(count).toBe(2);
  });

  it('returns null placement change values when the matched previous row is missing or zero', () => {
    const row = buildRow();
    row.previousComparable = {
      ...(row.previousComparable ?? {}),
      placementBreakdown: {
        note: 'Placement metrics remain campaign-level context only. They are shared across targets in the same campaign and must not be treated as target-owned history.',
        rows: [
          {
            placementCode: 'PLACEMENT_TOP',
            placementLabel: 'Top of search',
            modifierPct: 18,
            impressions: 1200,
            clicks: 48,
            orders: 6,
            sales: 300,
            spend: 90,
          },
          {
            placementCode: 'PLACEMENT_PRODUCT_PAGE',
            placementLabel: 'Product pages',
            modifierPct: null,
            impressions: 100,
            clicks: 0,
            orders: 0,
            sales: 0,
            spend: 0,
          },
        ],
      },
    } as AdsOptimizerTargetReviewRow['previousComparable'];

    const rows = buildAdsOptimizerPlacementTableRows(row);

    expect(rows[1]?.impressions.previous).toBe(null);
    expect(rows[1]?.impressions.changePercent).toBe(null);
    expect(rows[1]?.clicks.previous).toBe(null);
    expect(rows[1]?.clicks.changePercent).toBe(null);
    expect(rows[2]?.clicks.previous).toBe(0);
    expect(rows[2]?.clicks.changePercent).toBe(null);
    expect(rows[2]?.roas.previous).toBe(null);
    expect(rows[2]?.roas.changePercent).toBe(null);
  });
});
