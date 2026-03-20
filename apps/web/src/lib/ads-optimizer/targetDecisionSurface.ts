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
  spend: AdsOptimizerSearchTermMetricCell;
  orders: AdsOptimizerSearchTermMetricCell;
  acos: AdsOptimizerSearchTermMetricCell;
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
    const acosCurrent = term.sales > 0 ? term.spend / term.sales : null;
    const acosPrevious = previous && previous.sales > 0 ? previous.spend / previous.sales : null;
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
      spend: buildSearchTermMetricCell(term.spend, previous?.spend ?? null, isNew),
      orders: buildSearchTermMetricCell(term.orders, previous?.orders ?? null, isNew),
      acos: buildSearchTermMetricCell(acosCurrent, acosPrevious, isNew),
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
