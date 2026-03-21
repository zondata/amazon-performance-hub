import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import TargetChangePlanTab, {
  createTargetChangePlanDraftState,
  reduceTargetChangePlanDraftState,
  type TargetChangePlanOverrideActionItem,
  type TargetChangePlanProposalItem,
} from '../apps/web/src/components/ads-optimizer/targets/TargetChangePlanTab';
import TargetPlacementTab from '../apps/web/src/components/ads-optimizer/targets/TargetPlacementTab';
import TargetSearchTermTab from '../apps/web/src/components/ads-optimizer/targets/TargetSearchTermTab';
import TargetSqpTab from '../apps/web/src/components/ads-optimizer/targets/TargetSqpTab';
import type { AdsOptimizerTargetReviewRow } from '../apps/web/src/lib/ads-optimizer/runtime';

const pagePath = path.join(process.cwd(), 'apps/web/src/app/ads/optimizer/page.tsx');
const panelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/OptimizerTargetsPanel.tsx'
);
const shellPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetsPageShell.tsx'
);
const toolbarPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetsToolbar.tsx'
);
const summaryRowPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetSummaryRow.tsx'
);
const expandedPanelPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetExpandedPanel.tsx'
);
const expandedTabsPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetExpandedTabs.tsx'
);
const changePlanTabPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetChangePlanTab.tsx'
);
const searchTermTabPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetSearchTermTab.tsx'
);
const placementTabPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetPlacementTab.tsx'
);
const sqpTabPath = path.join(
  process.cwd(),
  'apps/web/src/components/ads-optimizer/targets/TargetSqpTab.tsx'
);
const runtimePath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/runtime.ts'
);
const tableLayoutPrefsPath = path.join(
  process.cwd(),
  'apps/web/src/lib/ads-optimizer/targetTableLayoutPrefs.ts'
);
const phase6cDocPath = path.join(
  process.cwd(),
  'docs/ads-optimizer/ads_optimizer_v2_phase6c_change_plan_override_split_build_plan.md'
);
const phase6dDocPath = path.join(
  process.cwd(),
  'docs/ads-optimizer/ads_optimizer_v2_phase6d_search_term_tab_build_plan.md'
);
const phase6eDocPath = path.join(
  process.cwd(),
  'docs/ads-optimizer/ads_optimizer_v2_phase6e_placement_tab_build_plan.md'
);
const phase6fDocPath = path.join(
  process.cwd(),
  'docs/ads-optimizer/ads_optimizer_v2_phase6f_sqp_tab_build_plan.md'
);

const requireFromWeb = createRequire(path.join(process.cwd(), 'apps/web/package.json'));
const React = requireFromWeb('react') as {
  createElement: (type: unknown, props?: Record<string, unknown> | null) => unknown;
};
const { renderToStaticMarkup } = requireFromWeb('react-dom/server') as {
  renderToStaticMarkup: (element: unknown) => string;
};

const makeChangePlanProposalRows = (): TargetChangePlanProposalItem[] => [
  {
    key: 'proposal-state',
    title: 'Update target state',
    tone: 'execution',
    status: 'stageable',
    currentValue: 'enabled',
    currentValueUnknown: false,
    proposedValue: 'paused',
    footnote: null,
  },
  {
    key: 'proposal-cadence',
    title: 'Change review cadence',
    tone: 'cadence',
    status: 'review',
    currentValue: 'Not captured',
    currentValueUnknown: true,
    proposedValue: 'Daily',
    footnote: 'Current cadence is not persisted in this snapshot.',
  },
];

const makeChangePlanOverrideRows = (): TargetChangePlanOverrideActionItem[] => [
  {
    key: 'update_target_bid',
    title: 'Update target bid',
    currentLine: 'Current: —',
    enabledFieldName: 'override_bid_enabled',
    valueFieldName: 'override_bid_next_bid',
    inputType: 'number',
    initialChecked: false,
    initialValue: '',
    placeholder: 'Next bid',
    min: '0.01',
    step: '0.01',
  },
  {
    key: 'update_target_state',
    title: 'Update target state',
    currentLine: 'Current: enabled',
    enabledFieldName: 'override_state_enabled',
    valueFieldName: 'override_state_next_state',
    inputType: 'select',
    initialChecked: true,
    initialValue: 'paused',
    options: [
      { value: 'enabled', label: 'Enabled' },
      { value: 'paused', label: 'Paused' },
      { value: 'archived', label: 'Archived' },
    ],
  },
  {
    key: 'update_placement_modifier',
    title: 'Update placement modifier',
    currentLine: 'Top of Search · current 0%',
    enabledFieldName: 'override_placement_enabled',
    valueFieldName: 'override_placement_next_percentage',
    inputType: 'number',
    initialChecked: false,
    initialValue: '',
    placeholder: 'Next placement percentage',
    min: '0',
    step: '1',
  },
];

const renderFixtureChangePlanMarkup = () =>
  renderToStaticMarkup(
    React.createElement(TargetChangePlanTab, {
      proposalRows: makeChangePlanProposalRows(),
      stageableCount: 1,
      reviewOnlyCount: 1,
      initialScope: 'persistent',
      initialOperatorNote: 'Document the staged bundle replacement before shipping.',
      overrideRows: makeChangePlanOverrideRows(),
      hiddenInputs: {
        returnTo: '/ads/optimizer?view=targets',
        productId: 'product-1',
        asin: 'B001TEST',
        targetId: 'target-1',
        runId: 'run-1',
        targetSnapshotId: 'target-snapshot-1',
        recommendationSnapshotId: 'recommendation-1',
        campaignId: 'campaign-1',
        currentState: 'enabled',
        currentBid: null,
        currentPlacementCode: 'PLACEMENT_TOP',
        currentPlacementPercentage: 0,
      },
      canSave: true,
      saveRecommendationOverrideAction: async () => {},
    })
  );

const makeSearchTermFixtureRow = (): AdsOptimizerTargetReviewRow =>
  ({
    targetSnapshotId: 'target-snapshot-1',
    targetId: 'target-1',
    campaignId: 'campaign-1',
    campaignName: 'Brand Campaign',
    adGroupId: 'ad-group-1',
    adGroupName: 'Hero Ad Group',
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
        ],
      },
    },
    coverage: {
      statuses: {
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
    },
  }) as unknown as AdsOptimizerTargetReviewRow;

const renderFixtureSearchTermMarkup = () =>
  renderToStaticMarkup(
    React.createElement(TargetSearchTermTab, {
      row: makeSearchTermFixtureRow(),
      asin: 'B001TEST',
      start: '2026-02-01',
      end: '2026-02-29',
    })
  );

const makePlacementFixtureRow = (): AdsOptimizerTargetReviewRow => {
  const row = makeSearchTermFixtureRow();

  return {
    ...row,
    currentCampaignBiddingStrategy: 'dynamic down only',
    nonAdditiveDiagnostics: {
      note: 'Placement diagnostics remain contextual only.',
      representativeSearchTerm: 'Hero Exact',
      tosIs: {
        latestValue: 0.42,
        previousValue: 0.35,
        delta: 0.07,
        direction: 'up',
        observedDays: 6,
        latestObservedDate: '2026-02-28',
      },
      stis: {
        latestValue: 0.42,
        previousValue: 0.35,
        delta: 0.07,
        direction: 'up',
        observedDays: 6,
        latestObservedDate: '2026-02-28',
      },
      stir: {
        latestValue: 11,
        previousValue: 14,
        delta: -3,
        direction: 'down',
        observedDays: 6,
        latestObservedDate: '2026-02-28',
      },
    },
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
    previousComparable: {
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
      currentCampaignBiddingStrategy: 'dynamic down only',
    },
    coverage: {
      ...row.coverage,
      statuses: {
        ...row.coverage.statuses,
        tosIs: 'ready',
        placementContext: 'ready',
      },
    },
    recommendation: {
      ...(row.recommendation ?? {}),
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
  } as AdsOptimizerTargetReviewRow;
};

const makePlacementFixtureRows = () => {
  const primary = makePlacementFixtureRow();
  const shared = {
    ...makePlacementFixtureRow(),
    targetSnapshotId: 'target-snapshot-2',
    targetId: 'target-2',
    targetText: 'hero broad',
  } as AdsOptimizerTargetReviewRow;
  const otherCampaign = {
    ...makePlacementFixtureRow(),
    targetSnapshotId: 'target-snapshot-3',
    targetId: 'target-3',
    campaignId: 'campaign-2',
    campaignName: 'Other Campaign',
  } as AdsOptimizerTargetReviewRow;

  return [primary, shared, otherCampaign];
};

const renderFixturePlacementMarkup = (allRows = makePlacementFixtureRows()) =>
  renderToStaticMarkup(
    React.createElement(TargetPlacementTab, {
      row: allRows[0],
      allRows,
    })
  );

const makeSqpFixtureRow = (): AdsOptimizerTargetReviewRow => {
  const row = makePlacementFixtureRow();

  return {
    ...row,
    sqpContext: {
      selectedWeekEnd: '2026-03-08',
      matchedQueryNorm: 'hero exact',
      trackedQueryCount: 2400,
      marketImpressionsTotal: 5000,
      totalMarketImpressions: 60000,
      marketImpressionShare: 5000 / 60000,
      marketImpressionRank: 8,
      note: null,
    },
    sqpDetail: {
      selectedWeekEnd: '2026-03-08',
      matchedQueryRaw: 'Hero Exact',
      matchedQueryNorm: 'hero exact',
      searchQueryVolume: 18000,
      searchQueryScore: 95,
      impressionsTotal: 5000,
      impressionsSelf: 900,
      impressionsSelfShare: 0.18,
      clicksTotal: 400,
      clicksSelf: 96,
      clicksSelfShare: 0.24,
      cartAddsTotal: 80,
      cartAddsSelf: 24,
      cartAddsSelfShare: 0.3,
      purchasesTotal: 40,
      purchasesSelf: 14,
      purchasesSelfShare: 0.35,
      clicksRatePerQuery: 400 / 18000,
      cartAddRatePerQuery: 80 / 18000,
      purchasesRatePerQuery: 40 / 18000,
      marketCtr: 400 / 5000,
      selfCtr: 96 / 900,
      marketCvr: 40 / 400,
      selfCvr: 14 / 96,
      selfCtrIndex: (96 / 900) / (400 / 5000),
      selfCvrIndex: (14 / 96) / (40 / 400),
      cartAddRateFromClicksMarket: 80 / 400,
      cartAddRateFromClicksSelf: 24 / 96,
      note: null,
    },
    previousComparable: {
      ...(row.previousComparable ?? {}),
      sqpContext: {
        selectedWeekEnd: '2026-03-01',
        matchedQueryNorm: 'hero exact',
        trackedQueryCount: 2200,
        marketImpressionsTotal: 4000,
        totalMarketImpressions: 56000,
        marketImpressionShare: 4000 / 56000,
        marketImpressionRank: 11,
        note: null,
      },
      sqpDetail: {
        selectedWeekEnd: '2026-03-01',
        matchedQueryRaw: 'Hero Exact',
        matchedQueryNorm: 'hero exact',
        searchQueryVolume: 15000,
        searchQueryScore: 91,
        impressionsTotal: 4000,
        impressionsSelf: 700,
        impressionsSelfShare: 0.175,
        clicksTotal: 350,
        clicksSelf: 70,
        clicksSelfShare: 0.2,
        cartAddsTotal: 70,
        cartAddsSelf: 14,
        cartAddsSelfShare: 0.2,
        purchasesTotal: 35,
        purchasesSelf: 10,
        purchasesSelfShare: 10 / 35,
        clicksRatePerQuery: 350 / 15000,
        cartAddRatePerQuery: 70 / 15000,
        purchasesRatePerQuery: 35 / 15000,
        marketCtr: 350 / 4000,
        selfCtr: 70 / 700,
        marketCvr: 35 / 350,
        selfCvr: 10 / 70,
        selfCtrIndex: (70 / 700) / (350 / 4000),
        selfCvrIndex: (10 / 70) / (35 / 350),
        cartAddRateFromClicksMarket: 70 / 350,
        cartAddRateFromClicksSelf: 14 / 70,
        note: null,
      },
    },
  } as AdsOptimizerTargetReviewRow;
};

const renderFixtureSqpMarkup = () =>
  renderToStaticMarkup(
    React.createElement(TargetSqpTab, {
      row: makeSqpFixtureRow(),
    })
  );

describe('ads optimizer phase 6 inline target review wiring', () => {
  it('loads targets view data only for the targets view and renders the inline targets panel', () => {
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain(
      "view === 'targets' && utility === null && (asin !== 'all' || requestedRunId !== null)"
    );
    expect(source).toContain('getAdsOptimizerTargetsViewData');
    expect(source).toContain('<OptimizerTargetsPanel');
    expect(source).toContain('Inline target review');
    expect(source).toContain('handoffAdsOptimizerToWorkspaceAction');
    expect(source).toContain('saveAdsOptimizerRecommendationOverrideAction');
    expect(source).toContain("paramValue('override_error') === '1'");
    expect(source).toContain('runId: requestedRunId');
  });

  it('keeps the stable wrapper but switches the default review path to inline row expansion', () => {
    const wrapperSource = fs.readFileSync(panelPath, 'utf-8');
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const toolbarSource = fs.readFileSync(toolbarPath, 'utf-8');
    const summaryRowSource = fs.readFileSync(summaryRowPath, 'utf-8');
    const expandedPanelSource = fs.readFileSync(expandedPanelPath, 'utf-8');
    const expandedTabsSource = fs.readFileSync(expandedTabsPath, 'utf-8');
    const changePlanTabSource = fs.readFileSync(changePlanTabPath, 'utf-8');
    const searchTermTabSource = fs.readFileSync(searchTermTabPath, 'utf-8');
    const placementTabSource = fs.readFileSync(placementTabPath, 'utf-8');
    const sqpTabSource = fs.readFileSync(sqpTabPath, 'utf-8');

    expect(wrapperSource).toContain('TargetsPageShell');
    expect(shellSource).toContain('buildAdsOptimizerTargetRowTableSummaries');
    expect(shellSource).toContain('filterAdsOptimizerTargetRowTableSummaries');
    expect(shellSource).toContain('<TargetsToolbar');
    expect(shellSource).toContain('<TargetSummaryRow');
    expect(shellSource).toContain('<TargetExpandedPanel');
    expect(shellSource).toContain('<TargetExpandedTabs');
    expect(shellSource).toContain('<TargetChangePlanTab');
    expect(shellSource).toContain('<TargetSearchTermTab');
    expect(shellSource).toContain('<TargetSqpTab');
    expect(shellSource).not.toContain('<TargetOverrideForm');
    expect(shellSource).toContain('Targets review');
    expect(shellSource).toContain('buildWhyFlaggedNarrative');
    expect(shellSource).toContain("useState<TargetExpandedTabKey>('why_flagged')");
    expect(shellSource).toContain("setActiveExpandedTab('why_flagged');");
    expect(shellSource).toContain('expandedContent={');
    expect(shellSource).toContain('colSpan={7}');
    expect(shellSource).toContain('data-aph-hscroll');
    expect(shellSource).toContain('overflow-x-auto overflow-y-visible');
    expect(shellSource).toContain('min-w-full table-fixed');
    expect(shellSource).toContain('<colgroup>');
    expect(shellSource).toContain('<thead>');
    expect(shellSource).toContain('<tbody>');
    expect(shellSource).not.toContain('No target rows match the current inline review filters.');
    expect(shellSource).toContain('ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY');
    expect(shellSource).toContain('window.localStorage.getItem');
    expect(shellSource).toContain('window.localStorage.setItem');
    expect(shellSource).toContain('parseAdsOptimizerTargetTableLayoutPrefs');
    expect(shellSource).toContain('serializeAdsOptimizerTargetTableLayoutPrefs');
    expect(shellSource).toContain('applyAdsOptimizerTargetTableColumnResizeDelta');
    expect(shellSource).toContain('toggleAdsOptimizerTargetTableFrozenColumn');
    expect(shellSource).toContain('activeColumnResize');
    expect(shellSource).toContain("window.addEventListener('pointermove'");
    expect(shellSource).toContain("window.addEventListener('pointerup'");
    expect(shellSource).toContain("window.addEventListener('pointercancel'");
    expect(shellSource).toContain('handleColumnResizePointerDown');
    expect(shellSource).toContain('data-column-resize-handle');
    expect(shellSource).toContain("tableLayoutPrefs.frozenColumns.includes('target')");
    expect(shellSource).toContain('sticky left-0 z-30');
    expect(shellSource).toContain("backgroundColor: 'var(--color-surface)'");
    expect(shellSource).toContain('Search targets');
    expect(shellSource).toContain('aria-label="Search target rows"');
    expect(shellSource).toContain('No matching targets');
    expect(shellSource).toContain('Try a different search or clear filters.');
    expect(shellSource).toContain('Clear search');
    expect(shellSource).toContain('colSpan={ADS_OPTIMIZER_TARGET_TABLE_COLUMNS.length}');
    expect(shellSource).toContain("onClick={() => setTargetSearch('')}");
    expect(shellSource).toContain('P&L (current)');
    expect(shellSource).toContain('ACoS (current)');
    expect(shellSource).toContain('Spend (current)');
    expect(shellSource).toContain('Sales (current)');
    expect(shellSource).toContain('Orders (current)');
    expect(shellSource).toContain('Sales rank');
    expect(shellSource).toContain('Spend rank');
    expect(shellSource).toContain('Impression rank');
    expect(shellSource).toContain('SQP impression rank');
    expect(shellSource).toContain('Organic rank');
    expect(shellSource).toContain('Organic trend');
    expect(shellSource).toContain('toggleExpandedTargetSnapshotId');
    expect(shellSource).toContain('resolveVisibleExpandedTargetSnapshotId');
    expect(shellSource).not.toContain('Target queue');
    expect(shellSource).not.toContain('Use the drawer');
    const tableLayoutPrefsSource = fs.readFileSync(tableLayoutPrefsPath, 'utf-8');
    const orderedHeaders = [
      "label: 'Target'",
      "label: 'State'",
      "label: 'Economics'",
      "label: 'Contribution'",
      "label: 'Ranking'",
      "label: 'Role'",
      "label: 'Change summary'",
    ];
    const orderedIndexes = orderedHeaders.map((label) => tableLayoutPrefsSource.indexOf(label));
    orderedIndexes.forEach((index, position) => {
      expect(index, `missing header ${orderedHeaders[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < orderedIndexes.length; index += 1) {
      expect(orderedIndexes[index]).toBeGreaterThan(orderedIndexes[index - 1]!);
    }
    expect(summaryRowSource).toContain('data-persisted-target-key');
    expect(summaryRowSource).toContain('aria-expanded={props.isActive}');
    expect(summaryRowSource).toContain('aria-controls=');
    expect(summaryRowSource).toContain('Select ${row.targetText} for Ads Workspace handoff');
    expect(summaryRowSource).toContain('Chevron expanded={props.isActive}');
    expect(summaryRowSource).toContain('sticky left-0 z-20');
    expect(summaryRowSource).toContain('summary.stateComparison.rows[0]');
    expect(summaryRowSource).toContain('summary.stateComparison.rows.slice(1)');
    expect(summaryRowSource).toContain('stateStatus.current.display');
    expect(summaryRowSource).toContain('stateStatusClass');
    expect(summaryRowSource).toContain("backgroundColor: 'var(--color-surface)'");
    expect(summaryRowSource).toContain(
      "backgroundColor: 'color-mix(in srgb, var(--color-primary) 5%, var(--color-surface))'"
    );
    expect(summaryRowSource).toContain(
      "backgroundColor: 'color-mix(in srgb, var(--color-surface-2) 35%, var(--color-surface))'"
    );
    expect(summaryRowSource).toContain("columnStyle('target')");
    expect(summaryRowSource).toContain('maxWidth');
    expect(summaryRowSource).toContain('w-full min-w-0 max-w-full');
    expect(summaryRowSource).toContain('overflow-hidden');
    expect(summaryRowSource).toContain(
      'grid w-full min-w-0 max-w-full grid-cols-[minmax(0,1.15fr)_repeat(3,minmax(0,1fr))]'
    );
    expect(summaryRowSource).toContain('gap-x-1.5');
    expect(summaryRowSource).not.toContain('gap-x-3');
    expect(summaryRowSource).not.toContain(
      'grid w-max grid-cols-[max-content_repeat(3,minmax(6.5rem,max-content))]'
    );
    expect(summaryRowSource).not.toContain('className="px-3 py-3 align-top whitespace-nowrap"');
    expect(summaryRowSource).not.toContain('min-w-[28rem]');
    expect(summaryRowSource).toContain('props.expandedContent ?');
    expect(summaryRowSource).toContain('Current');
    expect(summaryRowSource).toContain('Previous');
    expect(summaryRowSource).toContain('Change');
    expect(summaryRowSource).toContain('SQP Impression');
    expect(summaryRowSource).toContain('Organic');
    expect(summaryRowSource).toContain('Sponsored');
    expect(summaryRowSource).not.toContain('Target tier');
    expect(summaryRowSource).not.toContain('Search-term diagnosis');
    expect(toolbarSource).toContain('Trend state');
    expect(toolbarSource).toContain('Sort by');
    expect(toolbarSource).toContain('Ascending');
    expect(toolbarSource).toContain('Adjust columns');
    expect(toolbarSource).toContain('P&L (current)');
    expect(toolbarSource).toContain('ACoS (current)');
    expect(toolbarSource).toContain('Spend (current)');
    expect(toolbarSource).toContain('Sales (current)');
    expect(toolbarSource).toContain('Orders (current)');
    expect(toolbarSource).toContain('Sales rank');
    expect(toolbarSource).toContain('Spend rank');
    expect(toolbarSource).toContain('Impression rank');
    expect(toolbarSource).toContain('SQP impression rank');
    expect(toolbarSource).toContain('Organic rank');
    expect(toolbarSource).toContain('Organic trend');
    expect(toolbarSource).toContain('Reset widths');
    expect(toolbarSource).toContain('Freeze Target column');
    expect(toolbarSource).toContain('Drag header borders to resize columns');
    expect(toolbarSource).toContain('browser&apos;s default for the collapsed table');
    expect(toolbarSource).not.toContain('type="range"');
    expect(toolbarSource).not.toContain('Collapsed table layout');
    expect(toolbarSource).toContain('Select visible stageable');
    expect(toolbarSource).toContain('Handoff selected to Ads Workspace');
    expect(toolbarSource).toContain('Open Ads Workspace');
    expect(expandedPanelSource).toContain('target-inline-panel-');
    expect(expandedPanelSource).toContain('h-[36rem]');
    expect(expandedPanelSource).toContain('grid-rows-[auto_auto_minmax(0,1fr)]');
    expect(expandedPanelSource).toContain('overflow-y-auto');
    expect(expandedPanelSource).toContain('overflow-hidden');
    expect(expandedPanelSource).toContain('border-b-[0.5px]');
    expect(expandedTabsSource).toContain('role="tablist"');
    expect(expandedTabsSource).toContain('role="tab"');
    expect(expandedTabsSource).toContain('overflow-x-auto');
    expect(expandedTabsSource).toContain('aria-selected');
    expect(expandedTabsSource).toContain('aria-controls');
    expect(expandedTabsSource).toContain('target-expanded-tab-');
    expect(expandedTabsSource).toContain('target-expanded-tabpanel-');
    expect(expandedPanelSource).not.toContain('Target detail drawer');
    expect(changePlanTabSource).toContain('Save override bundle');
    expect(changePlanTabSource).toContain('Replacement actions');
    expect(searchTermTabSource).toContain('buildAdsWorkspaceNavigationHref');
    expect(searchTermTabSource).toContain("Top = current · Middle = previous · Bottom = change %");
    expect(placementTabSource).toContain('TOP OF SEARCH IMPRESSION SHARE (TOS IS)');
    expect(placementTabSource).toContain('CAMPAIGN CONTEXT');
    expect(placementTabSource).toContain("data-show-previous-change={showPreviousAndChange ? 'true' : 'false'}");
    expect(sqpTabSource).toContain('Summary');
    expect(sqpTabSource).toContain('KPI');
    expect(sqpTabSource).toContain('Market');
    expect(sqpTabSource).toContain('Self');
    expect(sqpTabSource).toContain('Impression');
    expect(sqpTabSource).toContain('Impression share');
    expect(sqpTabSource).toContain('Click');
    expect(sqpTabSource).toContain('Click share');
    expect(sqpTabSource).toContain('CTR');
    expect(sqpTabSource).toContain('CVR');
    expect(sqpTabSource).toContain('Purchase');
    expect(sqpTabSource).toContain('Purchase share');
    expect(sqpTabSource).toContain('metric-current');
    expect(sqpTabSource).toContain('metric-prev');
    expect(sqpTabSource).toContain('metric-change');
    expect(sqpTabSource).toContain('Top = current · Middle = previous · Bottom = change %');
    expect(sqpTabSource).toContain(
      'Green = increase · Red = decrease · Gray = no change or unavailable'
    );
    expect(sqpTabSource).toContain('sticky left-0 z-30');
    expect(sqpTabSource).toContain('sticky left-0 z-20');
    expect(sqpTabSource).toContain(
      'SQP is matched-query ASIN context. Targets that resolve to the same query can share the same SQP values.'
    );
    expect(sqpTabSource).not.toContain('SQP CONTEXT');
    expect(sqpTabSource).not.toContain('SQP SUMMARY');
    expect(sqpTabSource).not.toContain('Previous & change');
    expect(sqpTabSource).not.toContain("role=\"switch\"");
    expect(sqpTabSource).not.toContain('Current market');
    expect(sqpTabSource).not.toContain('Current self');
    expect(sqpTabSource).not.toContain('Previous market');
    expect(sqpTabSource).not.toContain('Previous self');
    expect(sqpTabSource).not.toContain('Change market');
    expect(sqpTabSource).not.toContain('Change self');
  });

  it('renders the tabbed expanded row as a fixed-height shell with one active panel at a time', () => {
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const expandedTabsSource = fs.readFileSync(expandedTabsPath, 'utf-8');
    const expandedStart = shellSource.indexOf('const activeExpandedContent');
    const expandedSource = shellSource.slice(
      expandedStart,
      shellSource.indexOf('\n  return (', expandedStart)
    );
    const normalizedTabsSource = expandedTabsSource.replace(/\s+/g, ' ').trim();

    const orderedTabLabels = [
      "label: 'Why flagged'",
      "label: 'Change plan'",
      "label: 'Search term'",
      "label: 'Placement'",
      "label: 'SQP'",
      "label: 'Metrics'",
      "label: 'Advanced'",
    ];
    const orderedTabKeys = [
      "key: 'why_flagged'",
      "key: 'change_plan'",
      "key: 'search_term'",
      "key: 'placement'",
      "key: 'sqp'",
      "key: 'metrics'",
      "key: 'advanced'",
    ];
    const indexes = orderedTabLabels.map((label) => expandedTabsSource.indexOf(label));
    const keyIndexes = orderedTabKeys.map((key) => expandedTabsSource.indexOf(key));

    indexes.forEach((index, position) => {
      expect(index, `missing tab label ${orderedTabLabels[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < indexes.length; index += 1) {
      expect(indexes[index]).toBeGreaterThan(indexes[index - 1]!);
    }
    keyIndexes.forEach((index, position) => {
      expect(index, `missing tab key ${orderedTabKeys[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < keyIndexes.length; index += 1) {
      expect(keyIndexes[index]).toBeGreaterThan(keyIndexes[index - 1]!);
    }

    expect(normalizedTabsSource).toContain(
      "role=\"tablist\" aria-label=\"Expanded target details\""
    );
    expect(expandedSource).toContain('role="tabpanel"');
    expect(expandedSource).toContain("getTargetExpandedTabPanelId(");
    expect(expandedSource).toContain('const renderExpandedPanel = (tabKey: TargetExpandedTabKey)');
    expect(expandedSource).toContain("case 'why_flagged'");
    expect(expandedSource).toContain("case 'change_plan'");
    expect(expandedSource).toContain("case 'search_term'");
    expect(expandedSource).toContain("case 'placement'");
    expect(expandedSource).toContain("case 'sqp'");
    expect(expandedSource).toContain("case 'metrics'");
    expect(expandedSource).toContain("case 'advanced'");
    expect(expandedSource).not.toContain("case 'override'");
    expect(expandedSource).toContain('TARGET_EXPANDED_TAB_DEFINITIONS.map((tab) => {');
    expect(expandedSource).toContain('hidden={!isActive}');
    expect(expandedSource).toContain('Reason codes');
    expect(expandedSource).toContain('No persisted reason codes');
    expect(expandedSource).toContain('<TargetSearchTermTab');
    expect(expandedSource).toContain('<TargetPlacementTab');
    expect(expandedSource).toContain('<TargetSqpTab');
    expect(expandedSource).toContain('<TargetChangePlanTab');
    expect(expandedSource).not.toContain('<TargetOverrideForm');
    expect(expandedSource).toContain('TargetAdvancedSection');
    expect(expandedSource).toContain("role.currentRole.label} → {activeRow.role.desiredRole.label");
    expect(expandedSource).toContain("`Objective: ${props.productState?.objective ?? 'Not captured'}`");
    expect(expandedSource).toContain('Blocking condition unresolved');
    expect(expandedSource).toContain('Auto-pause eligible');
    expect(expandedSource).not.toContain('Open in Ads Workspace');
    expect(expandedSource).not.toContain('Handoff this target');
    expect(expandedSource).not.toContain('Collapse details');
    expect(expandedSource).not.toContain('Search-term evidence');
    expect(expandedSource).not.toContain('Search-term diagnosis:');
    expect(expandedSource).not.toContain('Campaign-level context only. Placement evidence');
    expect(expandedSource).not.toContain("activeRow.typeLabel ?? 'Target'");
    expect(expandedSource).not.toContain('activeRow.campaignName ?? activeRow.campaignId');
    expect(expandedSource).not.toContain('Current ${activeRow.role.currentRole.label}');
    expect(expandedSource).not.toContain('Next ${activeRow.role.desiredRole.label}');
    expect(expandedSource).not.toContain('OverrideDisclosureCard');
    expect(expandedSource).not.toContain('SectionDisclosureCard');
    expect(expandedTabsSource).not.toContain("| 'override'");
    expect(expandedTabsSource).not.toContain("label: 'Override'");
  });

  it('documents Phase 6C as the change-plan override merge without replacing Phase 6A or 6B', () => {
    const source = fs.readFileSync(phase6cDocPath, 'utf-8');

    expect(source).toContain('Phase 6A remains authoritative for the collapsed row.');
    expect(source).toContain(
      'Phase 6B remains authoritative for the fixed-height tabbed expanded shell.'
    );
    expect(source).toContain(
      'This Phase 6C task supersedes only the tab list and the Change plan / Override content described in the earlier expanded-row work.'
    );
    expect(source).toContain('Remove the standalone `Override` tab.');
    expect(source).toContain('Manual override controls now live inside the `Change plan` tab.');
  });

  it('documents Phase 6D as a Search term tab-only replacement inside the fixed expanded shell', () => {
    const source = fs.readFileSync(phase6dDocPath, 'utf-8');

    expect(source).toContain('Phase 6A remains authoritative for the collapsed row.');
    expect(source).toContain(
      'Phase 6B remains authoritative for the fixed-height tabbed expanded shell.'
    );
    expect(source).toContain('This task changes only the `Search term` tab content.');
    expect(source).toContain('This task replaces the existing `Search term` tab layout entirely.');
    expect(source).toContain('STIR remains a rank integer.');
    expect(source).toContain(
      'Trend is not rendered inline inside the `Search term` tab; the tab uses a `Trend` button that opens Ads Workspace target trend in a new browser tab.'
    );
  });

  it('documents Phase 6E as a Placement tab-only replacement inside the fixed expanded shell', () => {
    const source = fs.readFileSync(phase6eDocPath, 'utf-8');

    expect(source).toContain('Phase 6A remains authoritative for the collapsed row.');
    expect(source).toContain(
      'Phase 6B remains authoritative for the fixed-height expanded shell.'
    );
    expect(source).toContain('Phase 6D remains authoritative for the Search term tab.');
    expect(source).toContain('This task changes only the Placement tab.');
    expect(source).toContain('Placement metrics remain campaign-level context.');
    expect(source).toContain('TOS IS remains a non-additive target-level diagnostic.');
    expect(source).toContain('No client fetch is performed when the tab opens.');
    expect(source).toContain('No synthetic TOS IS window average is allowed.');
  });

  it('documents Phase 6F as an SQP tab-only addition inside the fixed expanded shell', () => {
    const source = fs.readFileSync(phase6fDocPath, 'utf-8');
    const agentsSource = fs.readFileSync(
      path.join(process.cwd(), 'docs/ads-optimizer/AGENTS.md'),
      'utf-8'
    );

    expect(source).toContain('Phase 6A remains authoritative for the collapsed row.');
    expect(source).toContain('Phase 6B remains authoritative for the fixed-height expanded shell.');
    expect(source).toContain('Phase 6D remains authoritative for the Search term tab.');
    expect(source).toContain('Phase 6E remains authoritative for the Placement tab.');
    expect(source).toContain('This phase changes only the new SQP tab.');
    expect(source).toContain('SQP is matched-query ASIN context, not target-owned history.');
    expect(source).toContain('The tab uses persisted snapshot payload, not tab-open fetches.');
    expect(source).toContain('Comparison is same matched query only.');
    expect(source).toContain(
      'Current and previous SQP week labels come from the current snapshot and previous comparable snapshot respectively.'
    );
    expect(source).toContain('Deterministic summary only. No AI call.');
    expect(agentsSource).toContain('ads_optimizer_v2_phase6f_sqp_tab_build_plan.md');
  });

  it('renders the split Change plan contract with the fixture-specific default OFF state', () => {
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const expandedTabsSource = fs.readFileSync(expandedTabsPath, 'utf-8');
    const changePlanTabSource = fs.readFileSync(changePlanTabPath, 'utf-8');
    const markup = renderFixtureChangePlanMarkup();
    const orderedTabs = [
      'Why flagged',
      'Change plan',
      'Search term',
      'Placement',
      'SQP',
      'Metrics',
      'Advanced',
    ];

    const tabIndexes = orderedTabs.map((label) => expandedTabsSource.indexOf(`label: '${label}'`));
    tabIndexes.forEach((index, position) => {
      expect(index, `missing tab ${orderedTabs[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < tabIndexes.length; index += 1) {
      expect(tabIndexes[index]).toBeGreaterThan(tabIndexes[index - 1]!);
    }

    expect(changePlanTabSource).toContain(
      'grid-cols-[minmax(0,1fr)_0.5px_minmax(0,1fr)]'
    );
    expect(changePlanTabSource).toContain("draftState.isOverrideActive ? 'Active' : 'None'");
    expect(changePlanTabSource).toContain('aria-checked={draftState.isOverrideActive}');
    expect(changePlanTabSource).toContain("draftState.isOverrideActive ? 'translate-x-[16px]' : ''");
    expect(changePlanTabSource).toContain(
      "draftState.isOverrideActive ? 'opacity-40' : 'opacity-100'"
    );
    expect(changePlanTabSource).toContain('pointer-events-none opacity-[0.35]');
    expect(changePlanTabSource).toContain('disabled={!isFormEnabled}');
    expect(changePlanTabSource).toContain(
      'Overridden — manual override is active. This proposal remains visible for audit.'
    );
    expect(markup).toContain('Optimizer proposal');
    expect(markup).toContain('Manual override');
    expect(markup).toContain('Auto');
    expect(markup).toContain('None');
    expect(markup).toContain('Replaces staged bundle');
    expect(markup).toContain('Scope');
    expect(markup).toContain('One time');
    expect(markup).toContain('Persistent');
    expect(markup).toContain('Replacement actions');
    expect(markup).toContain('Operator note');
    expect(markup).toMatch(
      /<span class="font-medium">1<\/span> stageable · <span class="font-medium">1<\/span> review-only/
    );
    expect(markup).toContain('Update target state');
    expect(markup).toContain('enabled');
    expect(markup).toContain('paused');
    expect(markup).toContain('Stageable');
    expect(markup).toContain('Change review cadence');
    expect(markup).toContain('Not captured');
    expect(markup).toContain('Daily');
    expect(markup).toContain('Review');
    expect(markup).toContain('Current cadence is not persisted in this snapshot.');
    expect(markup).toContain('Update target bid');
    expect(markup).toContain('Update placement modifier');
    expect(markup).toContain('Current: —');
    expect(markup).toContain('Current: enabled');
    expect(markup).toContain('Top of Search · current 0%');
    expect(markup).toContain('Next bid');
    expect(markup).toContain('Paused');
    expect(markup).toContain('Next placement percentage');
    expect(markup).toMatch(/Override is <span class="font-medium">off<\/span>/);
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="false"');
    expect(markup).not.toContain(
      'Overridden — manual override is active. This proposal remains visible for audit.'
    );
    expect(markup).not.toContain('>Override<');
    expect(markup).toMatch(/name="override_scope"[^>]*disabled|disabled=""[^>]*name="override_scope"/);
    expect(markup).toMatch(
      /name="override_bid_enabled"[^>]*disabled|disabled=""[^>]*name="override_bid_enabled"/
    );
    expect(markup).toMatch(
      /name="override_state_enabled"[^>]*checked|checked=""[^>]*name="override_state_enabled"/
    );
    expect(markup).toMatch(
      /name="override_state_enabled"[^>]*disabled|disabled=""[^>]*name="override_state_enabled"/
    );
    expect(markup).toMatch(
      /name="override_placement_enabled"[^>]*disabled|disabled=""[^>]*name="override_placement_enabled"/
    );
    expect(markup).toMatch(/name="operator_note"[^>]*disabled|disabled=""[^>]*name="operator_note"/);
    expect(shellSource).toContain('saveRecommendationOverrideAction={props.saveRecommendationOverrideAction}');
  });

  it('keeps the override draft values when the manual override switch toggles on and off', () => {
    const initial = createTargetChangePlanDraftState({
      initialScope: 'persistent',
      initialOperatorNote: 'Document the staged bundle replacement before shipping.',
      overrideRows: makeChangePlanOverrideRows(),
    });

    expect(initial.isOverrideActive).toBe(false);
    expect(initial.scope).toBe('persistent');
    expect(initial.actions.update_target_state.checked).toBe(true);
    expect(initial.actions.update_target_state.value).toBe('paused');

    const overrideOn = reduceTargetChangePlanDraftState(initial, {
      type: 'set_override_active',
      value: true,
    });
    const scopeEdited = reduceTargetChangePlanDraftState(overrideOn, {
      type: 'set_scope',
      value: 'one_time',
    });
    const bidChecked = reduceTargetChangePlanDraftState(scopeEdited, {
      type: 'set_action_checked',
      actionKey: 'update_target_bid',
      value: true,
    });
    const bidEdited = reduceTargetChangePlanDraftState(bidChecked, {
      type: 'set_action_value',
      actionKey: 'update_target_bid',
      value: '0.82',
    });
    const placementChecked = reduceTargetChangePlanDraftState(bidEdited, {
      type: 'set_action_checked',
      actionKey: 'update_placement_modifier',
      value: true,
    });
    const placementEdited = reduceTargetChangePlanDraftState(placementChecked, {
      type: 'set_action_value',
      actionKey: 'update_placement_modifier',
      value: '12',
    });
    const noteEdited = reduceTargetChangePlanDraftState(placementEdited, {
      type: 'set_operator_note',
      value: 'Pause now, but keep a manual note for the replacement bundle.',
    });
    const overrideOff = reduceTargetChangePlanDraftState(noteEdited, {
      type: 'set_override_active',
      value: false,
    });

    expect(overrideOn.isOverrideActive).toBe(true);
    expect(overrideOff.isOverrideActive).toBe(false);
    expect(overrideOff.scope).toBe('one_time');
    expect(overrideOff.actions.update_target_bid.checked).toBe(true);
    expect(overrideOff.actions.update_target_bid.value).toBe('0.82');
    expect(overrideOff.actions.update_target_state.checked).toBe(true);
    expect(overrideOff.actions.update_target_state.value).toBe('paused');
    expect(overrideOff.actions.update_placement_modifier.checked).toBe(true);
    expect(overrideOff.actions.update_placement_modifier.value).toBe('12');
    expect(overrideOff.operatorNote).toBe(
      'Pause now, but keep a manual note for the replacement bundle.'
    );
  });

  it('renders the redesigned Search term tab with the new toolbar, table, trend link, and footer', () => {
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const searchTermTabSource = fs.readFileSync(searchTermTabPath, 'utf-8');
    const markup = renderFixtureSearchTermMarkup();
    const orderedColumns = [
      `Search term
                </th>`,
      `Evidence
                </th>`,
      "renderSortableHeader('STIS', 'stis')",
      "renderSortableHeader('STIR', 'stir')",
      "renderSortableHeader('Impr.', 'impressions')",
      "renderSortableHeader('Clicks', 'clicks')",
      "renderSortableHeader('CTR', 'ctr')",
      "renderSortableHeader('CVR', 'cvr')",
      "renderSortableHeader('Spend', 'spend')",
      "renderSortableHeader('Sales', 'sales')",
      "renderSortableHeader('Orders', 'orders')",
      "renderSortableHeader('ACOS', 'acos')",
      "renderSortableHeader('ROAS', 'roas')",
    ];
    const orderedColumnIndexes = orderedColumns.map((label) => searchTermTabSource.indexOf(label));

    expect(shellSource).toContain('<TargetSearchTermTab');
    expect(searchTermTabSource).toContain('buildAdsWorkspaceNavigationHref');
    expect(searchTermTabSource).toContain("role=\"switch\"");
    expect(searchTermTabSource).toContain("pathname: '/ads/performance'");
    expect(searchTermTabSource).toContain("level: 'targets'");
    expect(searchTermTabSource).toContain("view: 'trend'");
    expect(searchTermTabSource).toContain('trendEntityId: props.row.targetId');
    expect(markup).toContain('Top = current · Middle = previous · Bottom = change %');
    expect(markup).toContain('Previous &amp; change');
    expect(markup).toContain('Trend');
    expect(markup).toContain('role="switch"');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('Sorted by impressions (desc)');
    expect(markup).toContain('Search term');
    expect(markup).toContain('Evidence');
    expect(markup).toContain('STIS');
    expect(markup).toContain('STIR');
    expect(markup).toContain('Impr.');
    expect(markup).toContain('Clicks');
    expect(markup).toContain('CTR');
    expect(markup).toContain('CVR');
    expect(markup).toContain('Spend');
    expect(markup).toContain('Sales');
    expect(markup).toContain('Orders');
    expect(markup).toContain('ACOS');
    expect(markup).toContain('ROAS');
    orderedColumnIndexes.forEach((index, position) => {
      expect(index, `missing Search term column ${orderedColumns[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < orderedColumnIndexes.length; index += 1) {
      expect(orderedColumnIndexes[index]).toBeGreaterThan(orderedColumnIndexes[index - 1]!);
    }
    expect(searchTermTabSource).toContain("renderMetricLines({ kind: 'cvr', metric: row.cvr })");
    expect(searchTermTabSource).toContain("renderMetricLines({ kind: 'sales', metric: row.sales })");
    expect(searchTermTabSource).toContain("renderMetricLines({ kind: 'roas', metric: row.roas })");
    expect(searchTermTabSource).toContain("data-show-previous-change={showPreviousAndChange ? 'true' : 'false'}");
    expect(searchTermTabSource).toContain('min-w-[1375px]');
    expect(searchTermTabSource).toContain('row.sameText ? (');
    expect(markup).toContain('Same');
    expect(markup).toContain('Same Text');
    expect(markup).toContain('Winning');
    expect(markup).toContain('Losing');
    expect(markup).toContain('Isolate →');
    expect(markup).toContain('Negate →');
    expect((markup.match(/Same Text/g) ?? [])).toHaveLength(1);
    expect(markup).toContain('42%');
    expect(markup).toContain('38');
    expect(markup).not.toContain('38%');
    expect(markup).toContain('25.00%');
    expect(markup).toContain('$200.00');
    expect(markup).toContain('5.00');
    expect(markup).toContain('+25.0%');
    expect(markup).toContain('new');
    expect(markup).toContain('data-show-previous-change="true"');
    expect(markup).toContain('href="/ads/performance?channel=sp');
    expect(markup).toContain('start=2026-02-01');
    expect(markup).toContain('end=2026-02-29');
    expect(markup).toContain('asin=B001TEST');
    expect(markup).toContain('view=trend');
    expect(markup).toContain('level=targets');
    expect(markup).toContain('trend_entity=target-1');
    expect(markup).toContain('campaign_scope=campaign-1');
    expect(markup).toContain('campaign_scope_name=Brand+Campaign');
    expect(markup).toContain('ad_group_scope=ad-group-1');
    expect(markup).toContain('ad_group_scope_name=Hero+Ad+Group');
    expect(searchTermTabSource.indexOf('{badgeProps.label}')).toBeLessThan(
      searchTermTabSource.indexOf('Same Text')
    );
    expect(searchTermTabSource.indexOf('Same Text')).toBeLessThan(
      searchTermTabSource.indexOf("row.actionHint === 'isolate' ? 'Isolate →' : 'Negate →'")
    );
    expect(markup).not.toContain('Search-term evidence');
    expect(markup).not.toContain('Search-term diagnosis:');
    expect(markup).not.toContain('Representative term');
  });

  it('renders the redesigned Placement tab with non-additive TOS context, shared campaign context, and the new table', () => {
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const placementTabSource = fs.readFileSync(placementTabPath, 'utf-8');
    const sharedMarkup = renderFixturePlacementMarkup();
    const exclusiveMarkup = renderFixturePlacementMarkup([makePlacementFixtureRow()]);
    const orderedColumns = [
      `Placement
              </th>`,
      `Bid strategy
              </th>`,
      `Evidence
              </th>`,
      "renderSortableHeader('Impr.', 'impressions')",
      "renderSortableHeader('Clicks', 'clicks')",
      "renderSortableHeader('CTR', 'ctr')",
      "renderSortableHeader('CVR', 'cvr')",
      "renderSortableHeader('Spend', 'spend')",
      "renderSortableHeader('Sales', 'sales')",
      "renderSortableHeader('Orders', 'orders')",
      "renderSortableHeader('ACOS', 'acos')",
      "renderSortableHeader('ROAS', 'roas')",
    ];
    const orderedColumnIndexes = orderedColumns.map((label) => placementTabSource.indexOf(label));

    expect(shellSource).toContain('<TargetPlacementTab');
    expect(placementTabSource).toContain("role=\"switch\"");
    expect(placementTabSource).toContain("formatUiDate(tosIs.latestObservedDate)");
    expect(placementTabSource).toContain('buildAdsOptimizerPlacementCampaignTargetCount');
    expect(placementTabSource).toContain("data-show-previous-change={showPreviousAndChange ? 'true' : 'false'}");
    expect(placementTabSource).toContain('[data-row-kind="data"] .metric-prev');
    expect(placementTabSource).toContain('[data-row-kind="data"] .metric-change');
    expect(placementTabSource).toContain("renderMetricLines({ kind: 'cvr', metric: placement.cvr })");
    expect(placementTabSource).toContain(
      "renderMetricLines({ kind: 'sales', metric: placement.sales })"
    );
    expect(placementTabSource).toContain(
      "renderMetricLines({ kind: 'roas', metric: placement.roas })"
    );
    expect(sharedMarkup).toContain('TOP OF SEARCH IMPRESSION SHARE (TOS IS)');
    expect(sharedMarkup).toContain('CAMPAIGN CONTEXT');
    expect(sharedMarkup).toContain('Top = current · Middle = previous · Bottom = change %');
    expect(sharedMarkup).toContain('Previous &amp; change');
    expect(sharedMarkup).toContain('role="switch"');
    expect(sharedMarkup).toContain('aria-checked="true"');
    expect(sharedMarkup).toContain('Placement');
    expect(sharedMarkup).toContain('Bid strategy');
    expect(sharedMarkup).toContain('Evidence');
    expect(sharedMarkup).toContain('Impr.');
    expect(sharedMarkup).toContain('Clicks');
    expect(sharedMarkup).toContain('CTR');
    expect(sharedMarkup).toContain('CVR');
    expect(sharedMarkup).toContain('Spend');
    expect(sharedMarkup).toContain('Sales');
    expect(sharedMarkup).toContain('Orders');
    expect(sharedMarkup).toContain('ACOS');
    expect(sharedMarkup).toContain('ROAS');
    expect(sharedMarkup).toContain('Top of search');
    expect(sharedMarkup).toContain('Rest of search');
    expect(sharedMarkup).toContain('Product pages');
    expect(sharedMarkup).toContain('Strong');
    expect(sharedMarkup).toContain('Weak');
    expect(sharedMarkup).toContain('Mixed');
    expect(sharedMarkup).toContain('dynamic down only');
    expect(sharedMarkup).toContain('Modifier: +25%');
    expect(sharedMarkup).toContain('Modifier: +10%');
    expect(sharedMarkup).toContain('42%');
    expect(sharedMarkup).toContain('35%');
    expect(sharedMarkup).toContain('+7pp');
    expect(sharedMarkup).toContain('Latest observed (28 Feb 2026)');
    expect(sharedMarkup).toContain('Previous observed');
    expect(sharedMarkup).toContain(
      'Non-additive diagnostic. Latest and previous are the two most recent observed TOS IS values in-window. No window average is synthesized.'
    );
    expect(sharedMarkup).toContain('Observed days');
    expect(sharedMarkup).toContain('Direction');
    expect(sharedMarkup).toContain('Coverage');
    expect(sharedMarkup).toContain('Higher');
    expect(sharedMarkup).toContain('Ready');
    expect(sharedMarkup).toContain(
      'This campaign contains <strong class="font-medium text-foreground">2</strong> targets'
    );
    expect(sharedMarkup).toContain('Shared across 2 targets');
    expect(exclusiveMarkup).toContain(
      'This is the only target in this campaign. Placement data reflects this campaign for one target only. Changes to placement modifiers affect only this target.'
    );
    expect(exclusiveMarkup).toContain('Exclusive to this target');
    expect(sharedMarkup).toContain('Total: 3');
    expect(sharedMarkup).toContain('Sorted by impressions (desc)');
    expect(sharedMarkup).toContain('data-show-previous-change="true"');
    orderedColumnIndexes.forEach((index, position) => {
      expect(index, `missing Placement column ${orderedColumns[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < orderedColumnIndexes.length; index += 1) {
      expect(orderedColumnIndexes[index]).toBeGreaterThan(orderedColumnIndexes[index - 1]!);
    }
    expect(sharedMarkup.lastIndexOf('Total: 3')).toBeGreaterThan(
      sharedMarkup.lastIndexOf('Product pages')
    );
    expect(sharedMarkup).not.toContain('>Trend<');
    expect(sharedMarkup).not.toContain('Current avg');
    expect(sharedMarkup).not.toContain('Previous avg');
    expect(sharedMarkup).not.toContain('<polyline points="2 12 5.5 7 9 9.5 14 3"');
  });

  it('renders the SQP tab as metadata, summary, and a single KPI comparison table', () => {
    const shellSource = fs.readFileSync(shellPath, 'utf-8');
    const sqpTabSource = fs.readFileSync(sqpTabPath, 'utf-8');
    const markup = renderFixtureSqpMarkup();
    const tableMarkup = markup.slice(markup.indexOf('<table'));
    const orderedColumns = ['KPI', 'Market', 'Self'];
    const orderedRows = [
      'Impression',
      'Impression share',
      'Click',
      'Click share',
      'CTR',
      'CVR',
      'Purchase',
      'Purchase share',
    ];

    expect(shellSource).toContain('<TargetSqpTab');
    expect(sqpTabSource).toContain('buildAdsOptimizerSqpComparisonState');
    expect(sqpTabSource).toContain('buildAdsOptimizerSqpKpiRows');
    expect(sqpTabSource).toContain('buildAdsOptimizerSqpSummaryLines');
    expect(markup).toContain('Matched SQP query:');
    expect(markup).toContain('Current SQP week:');
    expect(markup).toContain('Previous comparable SQP week:');
    expect(markup).toContain('Comparison basis:');
    expect(markup).toContain('Hero Exact');
    expect(markup).toContain('Week ending 8 Mar 2026');
    expect(markup).toContain('Week ending 1 Mar 2026');
    expect(markup).toContain('same matched query only');
    expect(markup).toContain('Summary');
    expect(markup).toContain(
      'SQP is matched-query ASIN context. Targets that resolve to the same query can share the same SQP values.'
    );
    expect(markup).toContain('Impression share');
    expect(markup).toContain('Demand: High volume.');
    expect(markup).toContain('Funnel capture: strengthens.');
    expect(markup).toContain('Vs previous: Impression +28.6%.');
    expect(markup).toContain('Top = current · Middle = previous · Bottom = change %');
    expect(markup).toContain(
      'Green = increase · Red = decrease · Gray = no change or unavailable'
    );
    expect(markup).toContain('KPI');
    expect(markup).toContain('Market');
    expect(markup).toContain('Self');
    expect(markup).toContain('Impression');
    expect(markup).toContain('Click');
    expect(markup).toContain('CTR');
    expect(markup).toContain('CVR');
    expect(markup).toContain('Purchase');
    expect(markup).toContain('Purchase share');
    expect(markup).toContain('metric-current');
    expect(markup).toContain('metric-prev');
    expect(markup).toContain('metric-change');
    expect(markup).toContain('sticky left-0 z-30');
    expect(markup).toContain('sticky left-0 z-20');
    expect((sqpTabSource.match(/sticky left-0/g) ?? [])).toHaveLength(2);
    expect(markup).not.toMatch(/<th class="sticky[^"]*">\s*Market\s*<\/th>/);
    expect(markup).not.toMatch(/<th class="sticky[^"]*">\s*Self\s*<\/th>/);
    expect(sqpTabSource).not.toContain('Current market');
    expect(sqpTabSource).not.toContain('Current self');
    expect(sqpTabSource).not.toContain('Previous market');
    expect(sqpTabSource).not.toContain('Previous self');
    expect(sqpTabSource).not.toContain('Change market');
    expect(sqpTabSource).not.toContain('Change self');
    expect(markup).not.toContain('SQP CONTEXT');
    expect(markup).not.toContain('SQP SUMMARY');
    expect(markup).not.toContain('Previous &amp; change');
    expect(markup).not.toContain('Cart adds');
    expect(markup).not.toContain('CTR Index');
    expect(markup).not.toContain('Conversion index');

    const columnIndexes = orderedColumns.map((label) => tableMarkup.indexOf(`>${label}<`));
    columnIndexes.forEach((index, position) => {
      expect(index, `missing SQP header ${orderedColumns[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < columnIndexes.length; index += 1) {
      expect(columnIndexes[index]).toBeGreaterThan(columnIndexes[index - 1]!);
    }

    const rowIndexes = orderedRows.map((label) => tableMarkup.indexOf(`>${label}<`));
    rowIndexes.forEach((index, position) => {
      expect(index, `missing SQP row ${orderedRows[position]}`).toBeGreaterThan(-1);
    });
    for (let index = 1; index < rowIndexes.length; index += 1) {
      expect(rowIndexes[index]).toBeGreaterThan(rowIndexes[index - 1]!);
    }
  });

  it('pulls exact-window run snapshots plus persisted recommendations and role history', () => {
    const source = fs.readFileSync(runtimePath, 'utf-8');

    expect(source).toContain('export const getAdsOptimizerTargetsViewData');
    expect(source).toContain("runById.status !== 'completed'");
    expect(source).toContain('run.date_start === args.start');
    expect(source).toContain('run.date_end === args.end');
    expect(source).toContain('listAdsOptimizerProductSnapshotsByRun');
    expect(source).toContain('listActiveAdsOptimizerRecommendationOverrides');
    expect(source).toContain('readAdsOptimizerProductRunState');
    expect(source).toContain('listAdsOptimizerTargetSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRecommendationSnapshotsByRun');
    expect(source).toContain('listAdsOptimizerRoleTransitionLogsByAsin');
    expect(source).toContain('readAdsOptimizerRecommendationSnapshotView');
    expect(source).toContain('mapTargetSnapshotToProfileView');
    expect(source).toContain('buildAdsOptimizerOverviewComparisonWindow');
    expect(source).toContain('loadAdsOptimizerTargetProfiles');
    expect(source).toContain('mapTargetProfileRowToSnapshotView');
    expect(source).toContain('recommendationsByTargetSnapshotId');
    expect(source).toContain('roleHistoryByTargetId');
    expect(source).toContain('manualOverride');
    expect(source).toContain('previousRowsByKey');
    expect(source).toContain('previousComparable');
    expect(source).toContain('productId');
    expect(source).toContain('requestedRunId');
    expect(source).toContain("resolvedContextSource = 'run_id'");
  });

  it('defines stable collapsed-row layout preferences with column keys and target freeze support', () => {
    const source = fs.readFileSync(tableLayoutPrefsPath, 'utf-8');

    expect(source).toContain('ADS_OPTIMIZER_TARGET_TABLE_LAYOUT_STORAGE_KEY');
    expect(source).toContain("'aph.adsOptimizerTargetsCollapsedTableLayout.v2'");
    expect(source).toContain("key: 'target'");
    expect(source).toContain("key: 'state'");
    expect(source).toContain("key: 'economics'");
    expect(source).toContain("key: 'contribution'");
    expect(source).toContain("key: 'ranking'");
    expect(source).toContain("key: 'role'");
    expect(source).toContain("key: 'change_summary'");
    expect(source).toContain('defaultWidth');
    expect(source).toContain('minWidth');
    expect(source).toContain('maxWidth');
    expect(source).toContain('freezable: true');
    expect(source).toContain('minWidth: 280');
    expect(source).toContain('defaultWidth: 340');
    expect(source).toContain('maxWidth: 500');
    expect(source).toContain('defaultWidth: 280');
    expect(source).toContain('defaultWidth: 270');
    expect(source).toContain('defaultWidth: 170');
    expect(source).toContain('defaultWidth: 150');
    expect(source).toContain('defaultWidth: 120');
    expect(source).toContain('defaultWidth: 200');
    expect(source).toContain('parseAdsOptimizerTargetTableLayoutPrefs');
    expect(source).toContain('serializeAdsOptimizerTargetTableLayoutPrefs');
    expect(source).toContain('toggleAdsOptimizerTargetTableFrozenColumn');
    expect(source).toContain('applyAdsOptimizerTargetTableColumnResizeDelta');
    expect(source).toContain('getAdsOptimizerTargetTableColumnConfig');
  });
});
