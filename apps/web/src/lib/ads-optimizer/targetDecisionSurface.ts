import type { AdsOptimizerTargetReviewRow } from './runtime';

export type AdsOptimizerSearchTermEvidenceRow = {
  searchTerm: string;
  sameText: boolean;
  impressions: number;
  clicks: number;
  orders: number;
  spend: number;
  sales: number;
  stis: number | null;
  stir: number | null;
  evidenceTags: string[];
};

export type AdsOptimizerSearchTermMetricCell = {
  current: number | null;
  previous: number | null;
  changePercent: number | null;
  isNew: boolean;
};

export type AdsOptimizerSearchTermTableRow = {
  searchTerm: string;
  sameText: boolean;
  primaryEvidence: 'same' | 'winning' | 'losing' | null;
  actionHint: 'isolate' | 'negate' | null;
  stis: number | null;
  stir: number | null;
  impressions: AdsOptimizerSearchTermMetricCell;
  clicks: AdsOptimizerSearchTermMetricCell;
  ctr: AdsOptimizerSearchTermMetricCell;
  cvr: AdsOptimizerSearchTermMetricCell;
  spend: AdsOptimizerSearchTermMetricCell;
  sales: AdsOptimizerSearchTermMetricCell;
  orders: AdsOptimizerSearchTermMetricCell;
  acos: AdsOptimizerSearchTermMetricCell;
  roas: AdsOptimizerSearchTermMetricCell;
};

export type AdsOptimizerPlacementEvidenceRow = {
  code: 'PLACEMENT_TOP' | 'PLACEMENT_REST_OF_SEARCH' | 'PLACEMENT_PRODUCT_PAGE';
  shortLabel: 'TOS' | 'ROS' | 'PP';
  label: string;
  hasKpiContext: boolean;
  modifierPct: number | null;
  impressions: number | null;
  clicks: number | null;
  orders: number | null;
  spend: number | null;
  sales: number | null;
  recommendationLabel: string;
  note: string;
  currentFocus: boolean;
};

export type AdsOptimizerPlacementMetricCell = {
  current: number | null;
  previous: number | null;
  changePercent: number | null;
};

export type AdsOptimizerPlacementTableRow = {
  placementCode: 'PLACEMENT_TOP' | 'PLACEMENT_REST_OF_SEARCH' | 'PLACEMENT_PRODUCT_PAGE';
  placementName: 'Top of search' | 'Rest of search' | 'Product pages';
  modifierPct: number | null;
  bidStrategy: string | null;
  evidence: 'strong' | 'weak' | 'mixed';
  impressions: AdsOptimizerPlacementMetricCell;
  clicks: AdsOptimizerPlacementMetricCell;
  ctr: AdsOptimizerPlacementMetricCell;
  cvr: AdsOptimizerPlacementMetricCell;
  spend: AdsOptimizerPlacementMetricCell;
  sales: AdsOptimizerPlacementMetricCell;
  orders: AdsOptimizerPlacementMetricCell;
  acos: AdsOptimizerPlacementMetricCell;
  roas: AdsOptimizerPlacementMetricCell;
};

export type AdsOptimizerPlacementTotalsRow = {
  placementCount: number;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  cvr: number | null;
  spend: number | null;
  sales: number | null;
  orders: number | null;
  acos: number | null;
  roas: number | null;
};

const addEvidenceTag = (tags: string[], condition: boolean, label: string) => {
  if (condition && !tags.includes(label)) tags.push(label);
};

const normalizeSearchTerm = (searchTerm: string) => searchTerm.trim().toLowerCase();

const buildSearchTermCandidateKey = (searchTerm: string, sameText: boolean) =>
  `${normalizeSearchTerm(searchTerm)}::${sameText ? 'same' : 'diff'}`;

const buildQueryCandidateKeySet = (
  candidates:
    | Array<{
        searchTerm: string;
        sameText: boolean;
      }>
    | null
    | undefined
) =>
  new Set(
    (candidates ?? []).map((candidate) =>
      buildSearchTermCandidateKey(candidate.searchTerm, candidate.sameText)
    )
  );

export const buildAdsOptimizerSearchTermEvidenceRows = (
  row: AdsOptimizerTargetReviewRow
): AdsOptimizerSearchTermEvidenceRow[] => {
  const promoteToExactKeys = buildQueryCandidateKeySet(
    row.recommendation?.queryDiagnostics?.promoteToExactCandidates
  );
  const isolateKeys = buildQueryCandidateKeySet(row.recommendation?.queryDiagnostics?.isolateCandidates);
  const negativeKeys = buildQueryCandidateKeySet(row.recommendation?.queryDiagnostics?.negativeCandidates);

  return row.searchTermDiagnostics.topTerms.map((term) => {
    const evidenceTags: string[] = [];
    const key = buildSearchTermCandidateKey(term.searchTerm, term.sameText);

    addEvidenceTag(evidenceTags, term.sameText, 'Same-text');
    addEvidenceTag(evidenceTags, term.orders > 0 && term.sales > term.spend, 'Winning');
    addEvidenceTag(
      evidenceTags,
      term.clicks > 0 && (term.orders === 0 || (term.sales > 0 && term.sales <= term.spend)),
      'Losing'
    );
    addEvidenceTag(evidenceTags, promoteToExactKeys.has(key), 'Promote exact');
    addEvidenceTag(evidenceTags, isolateKeys.has(key), 'Isolate');
    addEvidenceTag(evidenceTags, negativeKeys.has(key), 'Negate');

    return {
      searchTerm: term.searchTerm,
      sameText: term.sameText,
      impressions: term.impressions,
      clicks: term.clicks,
      orders: term.orders,
      spend: term.spend,
      sales: term.sales,
      stis: term.stis,
      stir: term.stir,
      evidenceTags,
    };
  });
};

const buildSearchTermMetricCell = (
  current: number | null,
  previous: number | null,
  isNew: boolean
): AdsOptimizerSearchTermMetricCell => {
  const changePercent =
    isNew || previous === null || current === null || previous === 0
      ? null
      : ((current - previous) / previous) * 100;

  return {
    current,
    previous,
    changePercent,
    isNew,
  };
};

export const buildAdsOptimizerSearchTermTableRows = (
  row: AdsOptimizerTargetReviewRow
): AdsOptimizerSearchTermTableRow[] => {
  const currentRows = buildAdsOptimizerSearchTermEvidenceRows(row);
  const previousRows = row.previousComparable?.searchTermDiagnostics.topTerms ?? [];
  const previousByKey = new Map(
    previousRows.map((term) => [buildSearchTermCandidateKey(term.searchTerm, term.sameText), term])
  );

  return currentRows.map((term) => {
    const previous = previousByKey.get(buildSearchTermCandidateKey(term.searchTerm, term.sameText));
    const isNew = !previous;
    const ctrCurrent = term.impressions > 0 ? term.clicks / term.impressions : null;
    const ctrPrevious =
      previous && previous.impressions > 0 ? previous.clicks / previous.impressions : null;
    const cvrCurrent = term.clicks > 0 ? term.orders / term.clicks : null;
    const cvrPrevious = previous && previous.clicks > 0 ? previous.orders / previous.clicks : null;
    const acosCurrent = term.sales > 0 ? term.spend / term.sales : null;
    const acosPrevious = previous && previous.sales > 0 ? previous.spend / previous.sales : null;
    const roasCurrent = term.spend > 0 ? term.sales / term.spend : null;
    const roasPrevious = previous && previous.spend > 0 ? previous.sales / previous.spend : null;
    const primaryEvidence = term.sameText
      ? 'same'
      : term.evidenceTags.includes('Winning')
        ? 'winning'
        : term.evidenceTags.includes('Losing')
          ? 'losing'
          : null;
    const actionHint =
      primaryEvidence === 'winning' && term.evidenceTags.includes('Isolate')
        ? 'isolate'
        : primaryEvidence === 'losing' && term.evidenceTags.includes('Negate')
          ? 'negate'
          : null;

    return {
      searchTerm: term.searchTerm,
      sameText: term.sameText,
      primaryEvidence,
      actionHint,
      stis: term.stis,
      stir: term.stir,
      impressions: buildSearchTermMetricCell(term.impressions, previous?.impressions ?? null, isNew),
      clicks: buildSearchTermMetricCell(term.clicks, previous?.clicks ?? null, isNew),
      ctr: buildSearchTermMetricCell(ctrCurrent, ctrPrevious, isNew),
      cvr: buildSearchTermMetricCell(cvrCurrent, cvrPrevious, isNew),
      spend: buildSearchTermMetricCell(term.spend, previous?.spend ?? null, isNew),
      sales: buildSearchTermMetricCell(term.sales, previous?.sales ?? null, isNew),
      orders: buildSearchTermMetricCell(term.orders, previous?.orders ?? null, isNew),
      acos: buildSearchTermMetricCell(acosCurrent, acosPrevious, isNew),
      roas: buildSearchTermMetricCell(roasCurrent, roasPrevious, isNew),
    };
  });
};

export const buildAdsOptimizerSearchTermsEmptyState = (row: AdsOptimizerTargetReviewRow) => {
  if (row.coverage.statuses.searchTerms === 'expected_unavailable') {
    return 'Search-term diagnostics are expected to be unavailable for this row in the selected window, usually because the target had no click volume.';
  }
  if (row.coverage.statuses.searchTerms === 'partial') {
    return (
      row.searchTermDiagnostics.note ??
      'Only limited search-term evidence was persisted for this target in the selected run.'
    );
  }
  return (
    row.searchTermDiagnostics.note ??
    'No search-term evidence rows were captured for this target in the selected run.'
  );
};

const getPlacementRecommendationLabel = (
  biasRecommendation: 'stronger' | 'weaker' | 'hold' | 'unknown' | null | undefined
) => {
  if (biasRecommendation === 'stronger') return 'Bias stronger';
  if (biasRecommendation === 'weaker') return 'Bias weaker';
  if (biasRecommendation === 'hold') return 'Bias hold';
  return 'Bias unknown';
};

const PLACEMENT_ROWS: Array<{
  code: AdsOptimizerPlacementEvidenceRow['code'];
  shortLabel: AdsOptimizerPlacementEvidenceRow['shortLabel'];
  label: string;
}> = [
  { code: 'PLACEMENT_TOP', shortLabel: 'TOS', label: 'Top of Search' },
  { code: 'PLACEMENT_REST_OF_SEARCH', shortLabel: 'ROS', label: 'Rest of Search' },
  { code: 'PLACEMENT_PRODUCT_PAGE', shortLabel: 'PP', label: 'Product Pages' },
];

const PLACEMENT_TABLE_ROWS: Array<{
  placementCode: AdsOptimizerPlacementTableRow['placementCode'];
  placementName: AdsOptimizerPlacementTableRow['placementName'];
}> = [
  {
    placementCode: 'PLACEMENT_TOP',
    placementName: 'Top of search',
  },
  {
    placementCode: 'PLACEMENT_REST_OF_SEARCH',
    placementName: 'Rest of search',
  },
  {
    placementCode: 'PLACEMENT_PRODUCT_PAGE',
    placementName: 'Product pages',
  },
];

const buildPlacementMetricCell = (
  current: number | null,
  previous: number | null
): AdsOptimizerPlacementMetricCell => ({
  current,
  previous,
  changePercent:
    previous === null || current === null || previous === 0
      ? null
      : ((current - previous) / previous) * 100,
});

const derivePlacementEvidence = (
  targetRow: AdsOptimizerTargetReviewRow,
  placementCode: AdsOptimizerPlacementTableRow['placementCode'],
  current: {
    clicks: number | null;
    orders: number | null;
    sales: number | null;
    spend: number | null;
  }
): AdsOptimizerPlacementTableRow['evidence'] => {
  const placementDiagnostics = targetRow.recommendation?.placementDiagnostics;
  if (placementDiagnostics?.currentPlacementCode === placementCode) {
    if (placementDiagnostics.biasRecommendation === 'stronger') return 'strong';
    if (placementDiagnostics.biasRecommendation === 'weaker') return 'weak';
    if (placementDiagnostics.biasRecommendation === 'hold') return 'mixed';
  }

  if (
    current.sales !== null &&
    current.spend !== null &&
    current.orders !== null &&
    current.sales > current.spend &&
    current.orders > 0
  ) {
    return 'strong';
  }

  if (
    current.clicks !== null &&
    current.clicks > 0 &&
    ((current.orders !== null && current.orders === 0) ||
      (current.sales !== null &&
        current.spend !== null &&
        current.sales > 0 &&
        current.sales <= current.spend))
  ) {
    return 'weak';
  }

  return 'mixed';
};

const sumNullableMetric = (values: Array<number | null>) => {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0);
};

const deriveRatio = (numerator: number | null, denominator: number | null) =>
  numerator !== null && denominator !== null && denominator > 0 ? numerator / denominator : null;

export const buildAdsOptimizerPlacementEvidenceRows = (
  row: AdsOptimizerTargetReviewRow
): AdsOptimizerPlacementEvidenceRow[] => {
  const currentPlacementCode = row.recommendation?.placementDiagnostics?.currentPlacementCode ?? null;
  const currentPlacementPct =
    row.recommendation?.placementDiagnostics?.currentPercentage ??
    row.placementContext.topOfSearchModifierPct;
  const baseNote =
    row.recommendation?.placementDiagnostics?.note ??
    row.placementContext.note ??
    'Placement diagnostics were not captured for this target in the selected run.';
  const missingAllPlacementContext =
    row.coverage.statuses.placementContext === 'true_missing' &&
    row.placementContext.impressions === null &&
    row.placementContext.clicks === null &&
    row.placementContext.orders === null &&
    row.placementContext.spend === null &&
    row.placementContext.sales === null;

  return PLACEMENT_ROWS.map((placement) => {
    const currentFocus = currentPlacementCode === placement.code;

    if (placement.code === 'PLACEMENT_TOP') {
      const hasKpiContext =
        row.placementContext.impressions !== null ||
        row.placementContext.clicks !== null ||
        row.placementContext.orders !== null ||
        row.placementContext.spend !== null ||
        row.placementContext.sales !== null;

      return {
        code: placement.code,
        shortLabel: placement.shortLabel,
        label: placement.label,
        hasKpiContext,
        modifierPct:
          currentFocus || currentPlacementCode === null
            ? currentPlacementPct
            : row.placementContext.topOfSearchModifierPct,
        impressions: row.placementContext.impressions,
        clicks: row.placementContext.clicks,
        orders: row.placementContext.orders,
        spend: row.placementContext.spend,
        sales: row.placementContext.sales,
        recommendationLabel: currentFocus
          ? getPlacementRecommendationLabel(row.recommendation?.placementDiagnostics?.biasRecommendation)
          : 'Context captured',
        note: hasKpiContext
          ? baseNote
          : 'Top of Search campaign placement context was not captured for this target campaign in the selected run.',
        currentFocus,
      };
    }

    return {
      code: placement.code,
      shortLabel: placement.shortLabel,
      label: placement.label,
      hasKpiContext: false,
      modifierPct: currentFocus ? currentPlacementPct : null,
      impressions: null,
      clicks: null,
      orders: null,
      spend: null,
      sales: null,
      recommendationLabel: currentFocus
        ? getPlacementRecommendationLabel(row.recommendation?.placementDiagnostics?.biasRecommendation)
        : 'No KPI context captured',
      note: missingAllPlacementContext
        ? 'No placement context was captured for this target campaign in the selected run.'
        : 'This target snapshot only persists Top of Search campaign placement context. Rest of Search and Product Pages were not captured in the current system.',
      currentFocus,
    };
  });
};

export const buildAdsOptimizerPlacementTableRows = (
  row: AdsOptimizerTargetReviewRow
): AdsOptimizerPlacementTableRow[] => {
  const currentRowsByCode = new Map(
    row.placementBreakdown.rows.map((placement) => [placement.placementCode, placement])
  );
  const previousRowsByCode = new Map(
    (row.previousComparable?.placementBreakdown.rows ?? []).map((placement) => [
      placement.placementCode,
      placement,
    ])
  );

  return PLACEMENT_TABLE_ROWS.map((placement) => {
    const current = currentRowsByCode.get(placement.placementCode);
    const previous = previousRowsByCode.get(placement.placementCode);
    const ctrCurrent = deriveRatio(current?.clicks ?? null, current?.impressions ?? null);
    const ctrPrevious = deriveRatio(previous?.clicks ?? null, previous?.impressions ?? null);
    const cvrCurrent = deriveRatio(current?.orders ?? null, current?.clicks ?? null);
    const cvrPrevious = deriveRatio(previous?.orders ?? null, previous?.clicks ?? null);
    const acosCurrent = deriveRatio(current?.spend ?? null, current?.sales ?? null);
    const acosPrevious = deriveRatio(previous?.spend ?? null, previous?.sales ?? null);
    const roasCurrent = deriveRatio(current?.sales ?? null, current?.spend ?? null);
    const roasPrevious = deriveRatio(previous?.sales ?? null, previous?.spend ?? null);

    return {
      placementCode: placement.placementCode,
      placementName: placement.placementName,
      modifierPct: current?.modifierPct ?? null,
      bidStrategy: row.currentCampaignBiddingStrategy,
      evidence: derivePlacementEvidence(row, placement.placementCode, {
        clicks: current?.clicks ?? null,
        orders: current?.orders ?? null,
        sales: current?.sales ?? null,
        spend: current?.spend ?? null,
      }),
      impressions: buildPlacementMetricCell(
        current?.impressions ?? null,
        previous?.impressions ?? null
      ),
      clicks: buildPlacementMetricCell(current?.clicks ?? null, previous?.clicks ?? null),
      ctr: buildPlacementMetricCell(ctrCurrent, ctrPrevious),
      cvr: buildPlacementMetricCell(cvrCurrent, cvrPrevious),
      spend: buildPlacementMetricCell(current?.spend ?? null, previous?.spend ?? null),
      sales: buildPlacementMetricCell(current?.sales ?? null, previous?.sales ?? null),
      orders: buildPlacementMetricCell(current?.orders ?? null, previous?.orders ?? null),
      acos: buildPlacementMetricCell(acosCurrent, acosPrevious),
      roas: buildPlacementMetricCell(roasCurrent, roasPrevious),
    };
  });
};

export const buildAdsOptimizerPlacementTotalsRow = (
  rows: AdsOptimizerPlacementTableRow[]
): AdsOptimizerPlacementTotalsRow => {
  const impressions = sumNullableMetric(rows.map((row) => row.impressions.current));
  const clicks = sumNullableMetric(rows.map((row) => row.clicks.current));
  const orders = sumNullableMetric(rows.map((row) => row.orders.current));
  const sales = sumNullableMetric(rows.map((row) => row.sales.current));
  const spend = sumNullableMetric(rows.map((row) => row.spend.current));

  return {
    placementCount: rows.length,
    impressions,
    clicks,
    ctr: deriveRatio(clicks, impressions),
    cvr: deriveRatio(orders, clicks),
    spend,
    sales,
    orders,
    acos: deriveRatio(spend, sales),
    roas: deriveRatio(sales, spend),
  };
};

export const buildAdsOptimizerPlacementCampaignTargetCount = (
  rows: AdsOptimizerTargetReviewRow[],
  campaignId: string
) => rows.filter((row) => row.campaignId === campaignId).length;

export type AdsOptimizerSqpChangeTone = 'muted' | 'favorable' | 'unfavorable';

export type AdsOptimizerSqpTableRow = {
  kpi:
    | 'Impression'
    | 'Impression share'
    | 'Click'
    | 'Click share'
    | 'CTR'
    | 'CVR'
    | 'Purchase'
    | 'Purchase share';
  kind: 'count' | 'percent';
  market: AdsOptimizerSqpMetricCell;
  self: AdsOptimizerSqpMetricCell;
};

export type AdsOptimizerSqpMetricCell = {
  current: number | null;
  previous: number | null;
  changePercent: number | null;
  changeTone: AdsOptimizerSqpChangeTone;
};

export type AdsOptimizerSqpComparisonState = {
  currentWeekEnd: string | null;
  previousWeekEnd: string | null;
  currentMatchedQueryNorm: string | null;
  previousMatchedQueryNorm: string | null;
  comparisonAllowed: boolean;
  status: 'same_query' | 'no_previous' | 'different_query' | 'missing_query';
  note: string | null;
};

const isFiniteNumber = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const buildPercentChange = (current: number | null, previous: number | null) =>
  current === null || previous === null || previous === 0 ? null : ((current - previous) / previous) * 100;

const buildSqpDirectionalChangeTone = (value: number | null): AdsOptimizerSqpChangeTone => {
  if (value === null || !Number.isFinite(value) || value === 0) return 'muted';
  return value > 0 ? 'favorable' : 'unfavorable';
};

const buildSqpChangeValue = (args: {
  comparisonAllowed: boolean;
  current: number | null;
  previous: number | null;
}) => (args.comparisonAllowed ? buildPercentChange(args.current, args.previous) : null);

const SQP_NO_PREVIOUS_NOTE = 'no previous comparable SQP snapshot.';
const SQP_DIFFERENT_QUERY_NOTE =
  'Previous comparable resolved to a different SQP query, so previous and change are hidden.';
const SQP_MISSING_QUERY_NOTE =
  'same-query SQP comparison is unavailable because one snapshot did not resolve a matched SQP query.';

const formatSummaryInteger = (value: number | null) => {
  if (!isFiniteNumber(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const formatSummaryPercent = (value: number | null) => {
  if (!isFiniteNumber(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatSummaryChange = (value: number | null) => {
  if (!isFiniteNumber(value)) return '—';
  const rounded = Number(value.toFixed(1));
  if (rounded === 0 || Object.is(rounded, -0)) return '0.0%';
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
};

export function buildAdsOptimizerSqpComparisonState(
  row: AdsOptimizerTargetReviewRow
): AdsOptimizerSqpComparisonState {
  const currentMatchedQueryNorm = row.sqpDetail?.matchedQueryNorm ?? null;
  const previousMatchedQueryNorm = row.previousComparable?.sqpDetail?.matchedQueryNorm ?? null;

  if (!row.previousComparable) {
    return {
      currentWeekEnd: row.sqpDetail?.selectedWeekEnd ?? row.sqpContext?.selectedWeekEnd ?? null,
      previousWeekEnd: null,
      currentMatchedQueryNorm,
      previousMatchedQueryNorm: null,
      comparisonAllowed: false,
      status: 'no_previous',
      note: SQP_NO_PREVIOUS_NOTE,
    };
  }

  if (
    currentMatchedQueryNorm !== null &&
    previousMatchedQueryNorm !== null &&
    currentMatchedQueryNorm === previousMatchedQueryNorm
  ) {
    return {
      currentWeekEnd: row.sqpDetail?.selectedWeekEnd ?? row.sqpContext?.selectedWeekEnd ?? null,
      previousWeekEnd:
        row.previousComparable.sqpDetail?.selectedWeekEnd ??
        row.previousComparable.sqpContext?.selectedWeekEnd ??
        null,
      currentMatchedQueryNorm,
      previousMatchedQueryNorm,
      comparisonAllowed: true,
      status: 'same_query',
      note: null,
    };
  }

  if (
    currentMatchedQueryNorm !== null &&
    previousMatchedQueryNorm !== null &&
    currentMatchedQueryNorm !== previousMatchedQueryNorm
  ) {
    return {
      currentWeekEnd: row.sqpDetail?.selectedWeekEnd ?? row.sqpContext?.selectedWeekEnd ?? null,
      previousWeekEnd:
        row.previousComparable.sqpDetail?.selectedWeekEnd ??
        row.previousComparable.sqpContext?.selectedWeekEnd ??
        null,
      currentMatchedQueryNorm,
      previousMatchedQueryNorm,
      comparisonAllowed: false,
      status: 'different_query',
      note: SQP_DIFFERENT_QUERY_NOTE,
    };
  }

  return {
    currentWeekEnd: row.sqpDetail?.selectedWeekEnd ?? row.sqpContext?.selectedWeekEnd ?? null,
    previousWeekEnd:
      row.previousComparable.sqpDetail?.selectedWeekEnd ??
      row.previousComparable.sqpContext?.selectedWeekEnd ??
      null,
    currentMatchedQueryNorm,
    previousMatchedQueryNorm,
    comparisonAllowed: false,
    status: 'missing_query',
    note: SQP_MISSING_QUERY_NOTE,
  };
}

const buildSqpTableRow = (args: {
  kpi: AdsOptimizerSqpTableRow['kpi'];
  kind: AdsOptimizerSqpTableRow['kind'];
  comparisonAllowed: boolean;
  currentMarket: number | null;
  currentSelf: number | null;
  previousMarket: number | null;
  previousSelf: number | null;
}): AdsOptimizerSqpTableRow => {
  const buildMetricCell = (current: number | null, previous: number | null): AdsOptimizerSqpMetricCell => {
    const previousValue = args.comparisonAllowed ? previous : null;
    const changePercent = buildSqpChangeValue({
      comparisonAllowed: args.comparisonAllowed,
      current,
      previous,
    });

    return {
      current,
      previous: previousValue,
      changePercent,
      changeTone: buildSqpDirectionalChangeTone(changePercent),
    };
  };

  return {
    kpi: args.kpi,
    kind: args.kind,
    market: buildMetricCell(args.currentMarket, args.previousMarket),
    self: buildMetricCell(args.currentSelf, args.previousSelf),
  };
};

export function buildAdsOptimizerSqpKpiRows(
  row: AdsOptimizerTargetReviewRow
): AdsOptimizerSqpTableRow[] {
  const comparison = buildAdsOptimizerSqpComparisonState(row);
  const current = row.sqpDetail;
  const previousDetail = comparison.comparisonAllowed ? row.previousComparable?.sqpDetail ?? null : null;

  return [
    buildSqpTableRow({
      kpi: 'Impression',
      kind: 'count',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: current?.impressionsTotal ?? null,
      currentSelf: current?.impressionsSelf ?? null,
      previousMarket: previousDetail?.impressionsTotal ?? null,
      previousSelf: previousDetail?.impressionsSelf ?? null,
    }),
    buildSqpTableRow({
      kpi: 'Impression share',
      kind: 'percent',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: null,
      currentSelf: current?.impressionsSelfShare ?? null,
      previousMarket: null,
      previousSelf: previousDetail?.impressionsSelfShare ?? null,
    }),
    buildSqpTableRow({
      kpi: 'Click',
      kind: 'count',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: current?.clicksTotal ?? null,
      currentSelf: current?.clicksSelf ?? null,
      previousMarket: previousDetail?.clicksTotal ?? null,
      previousSelf: previousDetail?.clicksSelf ?? null,
    }),
    buildSqpTableRow({
      kpi: 'Click share',
      kind: 'percent',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: null,
      currentSelf: current?.clicksSelfShare ?? null,
      previousMarket: null,
      previousSelf: previousDetail?.clicksSelfShare ?? null,
    }),
    buildSqpTableRow({
      kpi: 'CTR',
      kind: 'percent',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: current?.marketCtr ?? null,
      currentSelf: current?.selfCtr ?? null,
      previousMarket: previousDetail?.marketCtr ?? null,
      previousSelf: previousDetail?.selfCtr ?? null,
    }),
    buildSqpTableRow({
      kpi: 'CVR',
      kind: 'percent',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: current?.marketCvr ?? null,
      currentSelf: current?.selfCvr ?? null,
      previousMarket: previousDetail?.marketCvr ?? null,
      previousSelf: previousDetail?.selfCvr ?? null,
    }),
    buildSqpTableRow({
      kpi: 'Purchase',
      kind: 'count',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: current?.purchasesTotal ?? null,
      currentSelf: current?.purchasesSelf ?? null,
      previousMarket: previousDetail?.purchasesTotal ?? null,
      previousSelf: previousDetail?.purchasesSelf ?? null,
    }),
    buildSqpTableRow({
      kpi: 'Purchase share',
      kind: 'percent',
      comparisonAllowed: comparison.comparisonAllowed,
      currentMarket: null,
      currentSelf: current?.purchasesSelfShare ?? null,
      previousMarket: null,
      previousSelf: previousDetail?.purchasesSelfShare ?? null,
    }),
  ];
}

export function buildAdsOptimizerSqpSummaryLines(
  row: AdsOptimizerTargetReviewRow
): [string, string, string] {
  const rank = row.sqpContext?.marketImpressionRank ?? null;
  const share = row.sqpContext?.marketImpressionShare ?? null;
  const marketImpressions = row.sqpDetail?.impressionsTotal ?? null;

  const demandLine = (() => {
    if (isFiniteNumber(rank) && isFiniteNumber(share) && isFiniteNumber(marketImpressions)) {
      const demandLabel =
        rank <= 10 || share >= 0.05 ? 'High volume' : rank <= 50 || share >= 0.01 ? 'Mid volume' : 'Lower volume';
      return `Demand: ${demandLabel}. Market impressions ${formatSummaryInteger(marketImpressions)}. Market impression share ${formatSummaryPercent(share)}. Market rank ${formatSummaryInteger(rank)}.`;
    }
    if (isFiniteNumber(marketImpressions)) {
      return `Demand: Market impressions ${formatSummaryInteger(marketImpressions)}. Market rank/share unavailable.`;
    }
    return 'Demand: unavailable.';
  })();

  const funnelCaptureLine = (() => {
    const impressionShare = row.sqpDetail?.impressionsSelfShare ?? null;
    const clicksShare = row.sqpDetail?.clicksSelfShare ?? null;
    const purchaseShare = row.sqpDetail?.purchasesSelfShare ?? null;
    const selfCtr = row.sqpDetail?.selfCtr ?? null;
    const marketCtr = row.sqpDetail?.marketCtr ?? null;
    const selfCvr = row.sqpDetail?.selfCvr ?? null;
    const marketCvr = row.sqpDetail?.marketCvr ?? null;

    if (
      isFiniteNumber(impressionShare) &&
      isFiniteNumber(clicksShare) &&
      isFiniteNumber(purchaseShare) &&
      impressionShare > 0
    ) {
      const purchaseToImpressionRatio = purchaseShare / impressionShare;
      const captureLabel =
        purchaseToImpressionRatio >= 1.15
          ? 'strengthens'
          : purchaseToImpressionRatio <= 0.85
            ? 'weakens'
            : 'holds';
      const detailSegments = [
        `Self impression share ${formatSummaryPercent(impressionShare)}.`,
        `Self click share ${formatSummaryPercent(clicksShare)}.`,
        `Self purchase share ${formatSummaryPercent(purchaseShare)}.`,
        isFiniteNumber(selfCtr) && isFiniteNumber(marketCtr)
          ? `Self CTR ${formatSummaryPercent(selfCtr)} vs market CTR ${formatSummaryPercent(marketCtr)}.`
          : null,
        isFiniteNumber(selfCvr) && isFiniteNumber(marketCvr)
          ? `Self CVR ${formatSummaryPercent(selfCvr)} vs market CVR ${formatSummaryPercent(marketCvr)}.`
          : null,
      ]
        .filter((segment): segment is string => segment !== null)
        .join(' ');
      return `Funnel capture: ${captureLabel}. ${detailSegments}`;
    }
    return 'Funnel capture: unavailable.';
  })();

  const comparison = buildAdsOptimizerSqpComparisonState(row);
  const vsPreviousLine = (() => {
    if (!comparison.comparisonAllowed) {
      return `Vs previous: ${comparison.note ?? SQP_NO_PREVIOUS_NOTE}`;
    }

    return `Vs previous: Impression ${formatSummaryChange(
      buildPercentChange(
        row.sqpDetail?.impressionsSelf ?? null,
        row.previousComparable?.sqpDetail?.impressionsSelf ?? null
      )
    )}. Click ${formatSummaryChange(
      buildPercentChange(
        row.sqpDetail?.clicksSelf ?? null,
        row.previousComparable?.sqpDetail?.clicksSelf ?? null
      )
    )}. Purchase ${formatSummaryChange(
      buildPercentChange(
        row.sqpDetail?.purchasesSelf ?? null,
        row.previousComparable?.sqpDetail?.purchasesSelf ?? null
      )
    )}. CTR ${formatSummaryChange(
      buildPercentChange(row.sqpDetail?.selfCtr ?? null, row.previousComparable?.sqpDetail?.selfCtr ?? null)
    )}. CVR ${formatSummaryChange(
      buildPercentChange(row.sqpDetail?.selfCvr ?? null, row.previousComparable?.sqpDetail?.selfCvr ?? null)
    )}.`;
  })();

  return [demandLine, funnelCaptureLine, vsPreviousLine];
}

export function buildAdsOptimizerSqpEmptyState(row: AdsOptimizerTargetReviewRow) {
  return (
    row.sqpDetail?.note ??
    row.sqpContext?.note ??
    'No aligned SQP funnel metrics were captured for this target in the selected run.'
  );
}
