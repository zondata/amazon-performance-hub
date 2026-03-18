import 'server-only';

import { fetchAvailableSqpWeeks } from '@/lib/sqp/fetchAvailableSqpWeeks';
import { getProductRankingDaily, type ProductRankingRow } from '@/lib/ranking/getProductRankingDaily';
import { getSalesDaily, type SalesDailyPoint } from '@/lib/sales/getSalesDaily';
import { getProductSqpWeekly, type SqpKnownKeywordRow, type SqpWeek } from '@/lib/sqp/getProductSqpWeekly';
import { getIsoWeekYear } from '@/lib/sqp/formatSqpWeekLabel';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAdsOptimizerHeroQueryManualOverride } from './heroQueryOverride';
import {
  buildAdsOptimizerRankingLadder,
  type AdsOptimizerRankingLadderBandLabel,
} from './rankingLadder';
import type { AdsOptimizerArchetype } from './types';

export { buildAdsOptimizerRankingLadder } from './rankingLadder';

export type AdsOptimizerProductState =
  | 'structurally_weak'
  | 'loss'
  | 'break_even'
  | 'profitable';

export type AdsOptimizerObjective =
  | 'Recover'
  | 'Break Even'
  | 'Harvest Profit'
  | 'Scale Profit'
  | 'Rank Growth'
  | 'Rank Defense';

export type AdsOptimizerCoverageStatus = 'ready' | 'partial' | 'missing';
export const ADS_OPTIMIZER_OVERVIEW_TREND_MODES = ['7', '14', '30', '60'] as const;
export type AdsOptimizerOverviewTrendMode =
  (typeof ADS_OPTIMIZER_OVERVIEW_TREND_MODES)[number];
export type AdsOptimizerOverviewDeltaDirection =
  | 'up'
  | 'down'
  | 'flat'
  | 'unknown';
export type AdsOptimizerOverviewDeltaSemantics =
  | 'higher_is_better'
  | 'lower_is_better'
  | 'contextual';
export type AdsOptimizerOverviewDeltaEvaluation =
  | 'better'
  | 'worse'
  | 'flat'
  | 'unknown';
export type AdsOptimizerOverviewSqpAlignment =
  | 'exact'
  | 'nearest_prior'
  | 'fallback_latest'
  | 'missing';
export type AdsOptimizerHeroQueryMode = 'auto' | 'manual';

export type AdsOptimizerOverviewWindow = {
  start: string;
  end: string;
  days: number;
};

export type AdsOptimizerOverviewMetricDelta = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
  direction: AdsOptimizerOverviewDeltaDirection;
  semantics: AdsOptimizerOverviewDeltaSemantics;
  evaluation: AdsOptimizerOverviewDeltaEvaluation;
  detail: string;
};

export type AdsOptimizerOverviewCoverageNote = {
  source:
    | 'economics'
    | 'ranking'
    | 'sqp'
    | 'traffic'
    | 'conversion'
    | 'trend';
  status: AdsOptimizerCoverageStatus;
  message: string;
};

export type AdsOptimizerOverviewData = {
  product: {
    productId: string | null;
    asin: string;
    title: string | null;
    shortName: string | null;
    displayName: string;
  };
  window?: {
    current: AdsOptimizerOverviewWindow;
    previous: AdsOptimizerOverviewWindow;
  };
  trend?: {
    enabled: boolean;
    selectedMode: AdsOptimizerOverviewTrendMode;
    availableModes: AdsOptimizerOverviewTrendMode[];
    appliedWindow: AdsOptimizerOverviewWindow;
    truncatedToWindow: boolean;
    detail: string;
    series: {
      economics: Array<{
        date: string;
        sales: number;
        adSpend: number;
        contributionAfterAds: number | null;
        tacos: number | null;
      }>;
      traffic: Array<{
        date: string;
        sessions: number;
        spImpressions: number;
      }>;
      conversion: Array<{
        date: string;
        unitSessionPercentage: number | null;
        ordersPerSession: number | null;
      }>;
      visibility: {
        heroQueryKeyword: string | null;
        latestObservedDate: string | null;
        observedDays: number;
        detail: string;
        rankSeries: Array<{
          date: string;
          organicRank: number | null;
        }>;
      };
    };
  };
  economics: {
    sales: number;
    orders: number;
    units: number;
    adSpend: number;
    adSales: number;
    tacos: number | null;
    averagePrice: number | null;
    costCoverage: number | null;
    breakEvenAcos: number | null;
    contributionBeforeAdsPerUnit: number | null;
    contributionAfterAds: number | null;
  };
  comparison?: {
    sales: AdsOptimizerOverviewMetricDelta;
    adSpend: AdsOptimizerOverviewMetricDelta;
    tacos: AdsOptimizerOverviewMetricDelta;
    contributionAfterAds: AdsOptimizerOverviewMetricDelta;
  };
  traffic?: {
    coverage: {
      status: AdsOptimizerCoverageStatus;
      detail: string;
    };
    sessions: AdsOptimizerOverviewMetricDelta;
    spImpressions: AdsOptimizerOverviewMetricDelta;
    heroQueryDemand: {
      status: AdsOptimizerCoverageStatus;
      query: string | null;
      currentWeekEnd: string | null;
      previousWeekEnd: string | null;
      alignment: AdsOptimizerOverviewSqpAlignment;
      current: number | null;
      previous: number | null;
      delta: number | null;
      deltaPct: number | null;
      detail: string;
    };
    sqpDemand: {
      status: AdsOptimizerCoverageStatus;
      currentWeekEnd: string | null;
      previousWeekEnd: string | null;
      alignment: AdsOptimizerOverviewSqpAlignment;
      current: number | null;
      previous: number | null;
      delta: number | null;
      deltaPct: number | null;
      detail: string;
    };
  };
  conversion?: {
    coverage: {
      status: AdsOptimizerCoverageStatus;
      detail: string;
    };
    unitSessionPercentage: AdsOptimizerOverviewMetricDelta;
    ordersPerSession: AdsOptimizerOverviewMetricDelta;
  };
  visibility: {
    rankingCoverage: {
      status: AdsOptimizerCoverageStatus;
      trackedKeywords: number;
      detail: string;
    };
    rankingLadder?: {
      status: AdsOptimizerCoverageStatus;
      trackedKeywords: number;
      latestObservedDate: string | null;
      detail: string;
      bands: Array<{
        label: AdsOptimizerRankingLadderBandLabel;
        currentCount: number;
        deltaCount: number | null;
      }>;
    };
    heroQueryTrend: {
      status: AdsOptimizerCoverageStatus;
      keyword: string | null;
      searchVolume: number | null;
      latestOrganicRank: number | null;
      baselineOrganicRank: number | null;
      rankDelta: number | null;
      latestObservedDate?: string | null;
      observedDays?: number;
      detail: string;
    };
    heroQuerySelection: {
      mode: AdsOptimizerHeroQueryMode;
      savedManualQuery: string | null;
      savedManualQueryAvailableInCandidates: boolean;
      candidates: Array<{
        query: string;
        searchVolume: number | null;
        latestOrganicRank: number | null;
        latestObservedDate: string | null;
      }>;
      detail: string;
    };
    sqpCoverage: {
      status: AdsOptimizerCoverageStatus;
      selectedWeekEnd: string | null;
      trackedQueries: number;
      totalSearchVolume: number | null;
      topQuery: string | null;
      previousWeekEnd?: string | null;
      previousTotalSearchVolume?: number | null;
      alignment?: AdsOptimizerOverviewSqpAlignment;
      detail: string;
    };
  };
  coverageNotes?: AdsOptimizerOverviewCoverageNote[];
  state: {
    value: AdsOptimizerProductState;
    label: string;
    reason: string;
  };
  objective: {
    value: AdsOptimizerObjective;
    reason: string;
  };
  warnings: string[];
};

type ProductMetaRow = {
  product_id: string;
  title: string | null;
};

type ProductProfileRow = {
  profile_json: unknown | null;
};

type HeroQueryTrend = AdsOptimizerOverviewData['visibility']['heroQueryTrend'];
type HeroQueryCandidate = AdsOptimizerOverviewData['visibility']['heroQuerySelection']['candidates'][number];

type ProductStateInput = {
  sales: number;
  orders: number;
  units: number;
  acos: number | null;
  breakEvenAcos: number | null;
  contributionAfterAds: number | null;
};

type ObjectiveInput = {
  state: AdsOptimizerProductState;
  acos: number | null;
  breakEvenAcos: number | null;
  heroQueryTrend: HeroQueryTrend;
  totalSqpSearchVolume: number | null;
  archetype?: AdsOptimizerArchetype | null;
};

type SalesWindowSummary = {
  dailySeries: SalesDailyPoint[];
  kpis: Awaited<ReturnType<typeof getSalesDaily>>['kpis'];
  hasRows: boolean;
  economicsDays: number;
  coveredEconomicsDays: number;
  costCoverage: number | null;
  contributionBeforeAdsTotal: number | null;
  contributionBeforeAdsPerUnit: number | null;
  contributionAfterAds: number | null;
  breakEvenAcos: number | null;
  unitSessionPercentage: number | null;
  ordersPerSession: number | null;
};

const LOW_DATA_ORDERS_THRESHOLD = 3;
const LOW_DATA_UNITS_THRESHOLD = 5;
const LOW_DATA_SALES_THRESHOLD = 250;
const HERO_QUERY_WEAK_RANK = 20;
const HERO_QUERY_DEFEND_RANK = 16;
const HERO_QUERY_RANK_DROP = -5;
const STRONG_SQP_DEMAND = 3000;
const SCALE_BUFFER_THRESHOLD = 0.12;
const BREAK_EVEN_BUFFER_THRESHOLD = 0.03;

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric;
};

const safeRatio = (numerator: number, denominator: number): number | null => {
  if (denominator <= 0) return null;
  return numerator / denominator;
};

const addDays = (value: string, delta: number): string => {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  const next = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  next.setUTCDate(next.getUTCDate() + delta);
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const countDaysInclusive = (start: string, end: string): number => {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.floor((endMs - startMs) / 86400000) + 1;
};

const parseShortName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shortName = (value as Record<string, unknown>).short_name;
  return typeof shortName === 'string' && shortName.trim().length > 0 ? shortName.trim() : null;
};

const stateLabel = (value: AdsOptimizerProductState) => {
  if (value === 'structurally_weak') return 'Structurally weak';
  if (value === 'break_even') return 'Break even';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const buildDailyContributionAfterAds = (row: SalesDailyPoint): number | null => {
  if (row.profits !== null && row.profits !== undefined) {
    return row.profits;
  }
  const payout = row.payout ?? null;
  const costOfGoods = row.cost_of_goods ?? null;
  if (payout !== null && costOfGoods !== null) {
    return (
      payout -
      costOfGoods -
      numberValue(row.referral_fees) -
      numberValue(row.fulfillment_fees) -
      numberValue(row.refund_cost) -
      numberValue(row.promotion_value) -
      row.ppc_cost
    );
  }
  return null;
};

const summarizeSalesWindow = (
  salesData: Awaited<ReturnType<typeof getSalesDaily>>
): SalesWindowSummary => {
  const dailySeries = salesData.dailySeries;
  const kpis = salesData.kpis;
  const economicsDays = dailySeries.length;
  const coveredEconomicsDays = dailySeries.filter(
    (row) =>
      row.payout !== null &&
      row.payout !== undefined &&
      row.cost_of_goods !== null &&
      row.cost_of_goods !== undefined &&
      row.referral_fees !== null &&
      row.referral_fees !== undefined &&
      row.fulfillment_fees !== null &&
      row.fulfillment_fees !== undefined
  ).length;
  const costCoverage = economicsDays > 0 ? coveredEconomicsDays / economicsDays : null;

  const totalPayout = kpis.payout ?? null;
  const totalCostOfGoods = kpis.cost_of_goods ?? null;
  const totalReferralFees = kpis.referral_fees ?? null;
  const totalFulfillmentFees = kpis.fulfillment_fees ?? null;
  const totalRefundCost = kpis.refund_cost ?? null;
  const totalPromotionValue = kpis.promotion_value ?? null;

  let contributionBeforeAdsTotal: number | null = null;
  if (
    totalCostOfGoods !== null &&
    totalReferralFees !== null &&
    totalFulfillmentFees !== null
  ) {
    contributionBeforeAdsTotal =
      kpis.sales -
      totalCostOfGoods -
      totalReferralFees -
      totalFulfillmentFees -
      numberValue(totalRefundCost) -
      numberValue(totalPromotionValue);
  } else if (totalPayout !== null && totalCostOfGoods !== null) {
    contributionBeforeAdsTotal = totalPayout - totalCostOfGoods;
  } else if (kpis.profits !== null && kpis.profits !== undefined) {
    contributionBeforeAdsTotal = kpis.profits + kpis.ppc_cost;
  }

  const contributionBeforeAdsPerUnit =
    contributionBeforeAdsTotal !== null
      ? safeRatio(contributionBeforeAdsTotal, kpis.units)
      : null;
  const contributionAfterAds =
    kpis.profits ??
    (contributionBeforeAdsTotal !== null
      ? contributionBeforeAdsTotal - kpis.ppc_cost
      : null);
  const breakEvenAcos =
    contributionBeforeAdsTotal !== null
      ? safeRatio(contributionBeforeAdsTotal, kpis.sales)
      : null;

  return {
    dailySeries,
    kpis,
    hasRows: dailySeries.length > 0,
    economicsDays,
    coveredEconomicsDays,
    costCoverage,
    contributionBeforeAdsTotal,
    contributionBeforeAdsPerUnit,
    contributionAfterAds,
    breakEvenAcos,
    unitSessionPercentage: safeRatio(kpis.units, kpis.sessions),
    ordersPerSession: safeRatio(kpis.orders, kpis.sessions),
  };
};

export const normalizeAdsOptimizerOverviewTrendMode = (
  value?: string
): AdsOptimizerOverviewTrendMode => {
  const normalized = value?.trim();
  return ADS_OPTIMIZER_OVERVIEW_TREND_MODES.includes(
    normalized as AdsOptimizerOverviewTrendMode
  )
    ? (normalized as AdsOptimizerOverviewTrendMode)
    : '30';
};

export const normalizeAdsOptimizerOverviewTrendEnabled = (value?: string): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  return normalized !== '0' && normalized !== 'off' && normalized !== 'false';
};

export const buildAdsOptimizerOverviewComparisonWindow = (args: {
  start: string;
  end: string;
}): {
  current: AdsOptimizerOverviewWindow;
  previous: AdsOptimizerOverviewWindow;
} => {
  const days = countDaysInclusive(args.start, args.end);
  const previousEnd = addDays(args.start, -1);
  const previousStart = addDays(previousEnd, -(Math.max(days, 1) - 1));

  return {
    current: {
      start: args.start,
      end: args.end,
      days,
    },
    previous: {
      start: previousStart,
      end: previousEnd,
      days,
    },
  };
};

export const buildAdsOptimizerOverviewMetricDelta = (args: {
  current: number | null;
  previous: number | null;
  semantics: AdsOptimizerOverviewDeltaSemantics;
  label: string;
}): AdsOptimizerOverviewMetricDelta => {
  if (args.current === null || args.previous === null) {
    return {
      current: args.current,
      previous: args.previous,
      delta: null,
      deltaPct: null,
      direction: 'unknown',
      semantics: args.semantics,
      evaluation: 'unknown',
      detail: `${args.label} could not be compared across current and previous windows because at least one window is missing data.`,
    };
  }

  const delta = args.current - args.previous;
  const deltaPct =
    Math.abs(args.previous) > 0 ? delta / Math.abs(args.previous) : null;
  const direction: AdsOptimizerOverviewDeltaDirection =
    delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const evaluation: AdsOptimizerOverviewDeltaEvaluation =
    direction === 'flat'
      ? 'flat'
      : args.semantics === 'higher_is_better'
        ? direction === 'up'
          ? 'better'
          : 'worse'
        : args.semantics === 'lower_is_better'
          ? direction === 'down'
            ? 'better'
            : 'worse'
          : 'unknown';

  const semanticDetail =
    args.semantics === 'higher_is_better'
      ? 'Higher is generally better.'
      : args.semantics === 'lower_is_better'
        ? 'Lower is generally better.'
        : 'Interpret direction in context instead of treating it as automatically good or bad.';

  return {
    current: args.current,
    previous: args.previous,
    delta,
    deltaPct,
    direction,
    semantics: args.semantics,
    evaluation,
    detail:
      direction === 'flat'
        ? `${args.label} held flat versus the equal-length previous window. ${semanticDetail}`
        : `${args.label} moved ${direction} versus the equal-length previous window. ${semanticDetail}`,
  };
};

const buildHeroQueryCandidates = (rows: ProductRankingRow[]): HeroQueryCandidate[] => {
  const rowsByKeyword = new Map<string, ProductRankingRow[]>();
  rows.forEach((row) => {
    const keyword = row.keyword_norm ?? row.keyword_raw ?? null;
    if (!keyword) return;
    const bucket = rowsByKeyword.get(keyword) ?? [];
    bucket.push(row);
    rowsByKeyword.set(keyword, bucket);
  });

  const latestPerKeyword = Array.from(rowsByKeyword.entries())
    .map(([keyword, keywordRows]) => {
      const sorted = [...keywordRows].sort((left, right) =>
        String(right.observed_date ?? '').localeCompare(String(left.observed_date ?? ''))
      );
      const latest = sorted[0] ?? null;
      return { keyword, latest };
    })
    .filter((row) => row.latest !== null);

  latestPerKeyword.sort((left, right) => {
    const volumeDiff =
      numberValue(right.latest?.search_volume ?? null) -
      numberValue(left.latest?.search_volume ?? null);
    if (volumeDiff !== 0) return volumeDiff;
    return left.keyword.localeCompare(right.keyword);
  });

  return latestPerKeyword.map(({ keyword, latest }) => ({
    query: latest?.keyword_raw ?? keyword,
    searchVolume: latest?.search_volume ?? null,
    latestOrganicRank: latest?.organic_rank_value ?? null,
    latestObservedDate: latest?.observed_date ?? null,
  }));
};

export const buildHeroQueryTrend = (
  rows: ProductRankingRow[],
  preferredQuery?: string | null
): HeroQueryTrend => {
  if (rows.length === 0) {
    return {
      status: preferredQuery ? 'partial' : 'missing',
      keyword: preferredQuery ?? null,
      searchVolume: null,
      latestOrganicRank: null,
      baselineOrganicRank: null,
      rankDelta: null,
      latestObservedDate: null,
      observedDays: 0,
      detail: preferredQuery
        ? `Manual hero query "${preferredQuery}" is saved for this ASIN, but no ranking rows were available in the selected window.`
        : 'No ranking rows were available in the selected window.',
    };
  }

  const heroQueryCandidates = buildHeroQueryCandidates(rows);
  if (heroQueryCandidates.length === 0) {
    return {
      status: preferredQuery ? 'partial' : 'partial',
      keyword: preferredQuery ?? null,
      searchVolume: null,
      latestOrganicRank: null,
      baselineOrganicRank: null,
      rankDelta: null,
      latestObservedDate: null,
      observedDays: 0,
      detail: preferredQuery
        ? `Manual hero query "${preferredQuery}" is saved, but ranking rows in the selected window did not include usable keyword identity or rank values for it.`
        : 'Ranking rows exist, but keyword identity or rank values were incomplete.',
    };
  }

  const normalizedPreferredQuery = normalizeQueryValue(preferredQuery);
  const selectedCandidate =
    normalizedPreferredQuery
      ? heroQueryCandidates.find(
          (candidate) => normalizeQueryValue(candidate.query) === normalizedPreferredQuery
        ) ?? null
      : null;
  const hero = selectedCandidate ?? heroQueryCandidates[0] ?? null;

  if (!hero) {
    return {
      status: 'partial',
      keyword: preferredQuery ?? null,
      searchVolume: null,
      latestOrganicRank: null,
      baselineOrganicRank: null,
      rankDelta: null,
      latestObservedDate: null,
      observedDays: 0,
      detail: preferredQuery
        ? `Manual hero query "${preferredQuery}" is saved, but a representative hero query could not be resolved from the selected ranking window.`
        : 'Ranking data was present, but a representative hero query could not be resolved.',
    };
  }

  if (normalizedPreferredQuery && selectedCandidate === null) {
    return {
      status: 'partial',
      keyword: preferredQuery ?? null,
      searchVolume: null,
      latestOrganicRank: null,
      baselineOrganicRank: null,
      rankDelta: null,
      latestObservedDate: null,
      observedDays: 0,
      detail: `Manual hero query "${preferredQuery}" is saved for this ASIN, but it is not present in the current ranking candidates for the selected window.`,
    };
  }

  const keywordRows = [...rows].filter((row) => {
    const rowKeyword = row.keyword_raw ?? row.keyword_norm ?? null;
    return normalizeQueryValue(rowKeyword) === normalizeQueryValue(hero.query);
  }).sort((left, right) =>
    String(left.observed_date ?? '').localeCompare(String(right.observed_date ?? ''))
  );
  const firstWithRank = keywordRows.find((row) => row.organic_rank_value !== null) ?? null;
  const latestWithRank =
    [...keywordRows].reverse().find((row) => row.organic_rank_value !== null) ?? null;

  if (!firstWithRank || !latestWithRank) {
    return {
      status: 'partial',
      keyword: hero.query,
      searchVolume: hero.searchVolume,
      latestOrganicRank: latestWithRank?.organic_rank_value ?? null,
      baselineOrganicRank: firstWithRank?.organic_rank_value ?? null,
      rankDelta: null,
      latestObservedDate: latestWithRank?.observed_date ?? hero.latestObservedDate ?? null,
      observedDays: keywordRows.length,
      detail: 'Hero-query ranking coverage exists, but at least one endpoint rank value is missing.',
    };
  }

  const baselineRank = firstWithRank.organic_rank_value;
  const latestRank = latestWithRank.organic_rank_value;
  if (baselineRank === null || latestRank === null) {
    return {
      status: 'partial',
      keyword: hero.query,
      searchVolume: hero.searchVolume,
      latestOrganicRank: latestRank,
      baselineOrganicRank: baselineRank,
      rankDelta: null,
      latestObservedDate: latestWithRank.observed_date ?? hero.latestObservedDate ?? null,
      observedDays: keywordRows.length,
      detail: 'Hero-query ranking coverage exists, but at least one endpoint rank value is missing.',
    };
  }

  const rankDelta = baselineRank - latestRank;
  const trendDirection =
    rankDelta >= 3 ? 'improved' : rankDelta <= -3 ? 'weakened' : 'held roughly flat';
  return {
    status: keywordRows.length >= 2 ? 'ready' : 'partial',
    keyword: hero.query,
    searchVolume: hero.searchVolume,
    latestOrganicRank: latestRank,
    baselineOrganicRank: baselineRank,
    rankDelta,
    latestObservedDate: latestWithRank.observed_date ?? hero.latestObservedDate ?? null,
    observedDays: keywordRows.length,
    detail:
      keywordRows.length >= 2
        ? `Hero query ${trendDirection} from rank ${baselineRank} to ${latestRank}.`
        : 'Only one ranking observation exists for the current hero query.',
  };
};

export const classifyAdsOptimizerProductState = (
  input: ProductStateInput
): AdsOptimizerOverviewData['state'] => {
  if (
    input.orders < LOW_DATA_ORDERS_THRESHOLD ||
    input.units < LOW_DATA_UNITS_THRESHOLD ||
    input.sales < LOW_DATA_SALES_THRESHOLD
  ) {
    return {
      value: 'structurally_weak',
      label: stateLabel('structurally_weak'),
      reason:
        'Selected-window demand is still thin, so the product needs baseline recovery before stronger optimization decisions are safe.',
    };
  }

  if (input.contributionAfterAds !== null && input.contributionAfterAds < 0) {
    return {
      value: 'loss',
      label: stateLabel('loss'),
      reason:
        'Contribution after ads is negative in the selected window, so the current product posture is loss-making.',
    };
  }

  const acosBuffer =
    input.acos !== null && input.breakEvenAcos !== null
      ? input.breakEvenAcos - input.acos
      : null;
  const contributionMargin =
    input.contributionAfterAds !== null
      ? safeRatio(input.contributionAfterAds, input.sales)
      : null;

  if (
    (acosBuffer !== null && acosBuffer <= BREAK_EVEN_BUFFER_THRESHOLD) ||
    (contributionMargin !== null && contributionMargin <= 0.04)
  ) {
    return {
      value: 'break_even',
      label: stateLabel('break_even'),
      reason:
        'The product is clearing costs, but only with a thin economics buffer in the selected window.',
    };
  }

  return {
    value: 'profitable',
    label: stateLabel('profitable'),
    reason:
      'The selected window shows a positive economics buffer after ads, so the product is operating from a profitable baseline.',
  };
};

export const recommendAdsOptimizerObjective = (
  input: ObjectiveInput
): AdsOptimizerOverviewData['objective'] => {
  const archetype = input.archetype ?? 'hybrid';

  if (input.state === 'structurally_weak') {
    return {
      value: 'Recover',
      reason:
        'Demand and order volume are still too limited, so the immediate objective is to recover viable product traction.',
    };
  }

  if (input.state === 'loss') {
    return {
      value: 'Break Even',
      reason:
        'The product is losing contribution after ads, so the safest objective is to stabilize economics first.',
    };
  }

  const sqpDemand = input.totalSqpSearchVolume ?? 0;
  const rankWeak =
    input.heroQueryTrend.latestOrganicRank !== null &&
    input.heroQueryTrend.latestOrganicRank > HERO_QUERY_WEAK_RANK;
  const rankSliding =
    input.heroQueryTrend.rankDelta !== null &&
    input.heroQueryTrend.rankDelta <= HERO_QUERY_RANK_DROP &&
    input.heroQueryTrend.latestOrganicRank !== null &&
    input.heroQueryTrend.latestOrganicRank <= HERO_QUERY_DEFEND_RANK;
  const scaleBuffer =
    input.acos !== null && input.breakEvenAcos !== null
      ? input.breakEvenAcos - input.acos
      : null;

  if (input.state === 'break_even') {
    if (rankSliding) {
      if (archetype === 'design_led') {
        return {
          value: 'Break Even',
          reason:
            'Economics are thin and design-led posture keeps the product margin-first, so the objective stays break-even instead of forcing rank defense.',
        };
      }
      return {
        value: 'Rank Defense',
        reason:
          'Economics are thin and the hero query rank is slipping, so defending existing visibility is safer than expansion.',
      };
    }
    return {
      value: 'Break Even',
      reason:
        'Economics remain the limiting factor, so the product should protect margin before taking on growth objectives.',
    };
  }

  if (rankSliding) {
    if (archetype === 'design_led' && (scaleBuffer ?? 0) >= BREAK_EVEN_BUFFER_THRESHOLD) {
      return {
        value: 'Scale Profit',
        reason:
          'Hero-query rank is softening, but design-led posture keeps profitable scaling ahead of defensive visibility unless the visibility risk is more severe.',
      };
    }
    return {
      value: 'Rank Defense',
      reason:
        'The product is profitable, but hero-query rank momentum is weakening inside the top results, so visibility defense comes first.',
    };
  }

  if (rankWeak && sqpDemand >= STRONG_SQP_DEMAND) {
    if (archetype === 'design_led' && (scaleBuffer ?? 0) >= SCALE_BUFFER_THRESHOLD) {
      return {
        value: 'Scale Profit',
        reason:
          'Demand is present, but design-led posture still prefers profitable scaling before a dedicated rank-growth push.',
      };
    }
    return {
      value: 'Rank Growth',
      reason:
        'Demand is present while the hero query still ranks weakly, so the next objective is controlled rank growth.',
    };
  }

  if (scaleBuffer !== null && scaleBuffer >= SCALE_BUFFER_THRESHOLD) {
    return {
      value: 'Scale Profit',
      reason:
        'The product is profitable with room under the break-even ACoS ceiling, so the next objective is measured profitable scaling.',
    };
  }

  return {
    value: 'Harvest Profit',
    reason:
      'The product is profitable without a strong visibility gap signal, so the safest objective is to harvest profit from the current base.',
  };
};

const loadProductMeta = async (args: {
  accountId: string;
  marketplace: string;
  asin: string;
}) => {
  const { data: product } = await supabaseAdmin
    .from('products')
    .select('product_id,title')
    .eq('account_id', args.accountId)
    .eq('marketplace', args.marketplace)
    .eq('asin', args.asin)
    .maybeSingle();

  const typedProduct = (product ?? null) as ProductMetaRow | null;
  if (!typedProduct?.product_id) {
    return {
      productId: null,
      title: null,
      shortName: null,
      displayName: args.asin,
      manualHeroQuery: null,
    };
  }
  const [{ data: profile }, manualHeroQueryOverride] = await Promise.all([
    supabaseAdmin
      .from('product_profile')
      .select('profile_json')
      .eq('product_id', typedProduct.product_id)
      .maybeSingle(),
    getAdsOptimizerHeroQueryManualOverride(typedProduct.product_id),
  ]);

  const typedProfile = (profile ?? null) as ProductProfileRow | null;
  const shortName = parseShortName(typedProfile?.profile_json ?? null);
  return {
    productId: typedProduct.product_id,
    title: typedProduct.title ?? null,
    shortName,
    displayName: shortName ?? typedProduct.title ?? args.asin,
    manualHeroQuery: manualHeroQueryOverride?.query ?? null,
  };
};

const emptySqpWeekly = {
  availableWeeks: [] as SqpWeek[],
  selectedWeekEnd: null,
  rows: [] as SqpKnownKeywordRow[],
};

const selectSqpWeekForWindow = (args: {
  availableWeeks: SqpWeek[];
  targetEnd: string;
}): {
  weekEnd: string | null;
  alignment: AdsOptimizerOverviewSqpAlignment;
  detail: string;
} => {
  if (args.availableWeeks.length === 0) {
    return {
      weekEnd: null,
      alignment: 'missing',
      detail: 'SQP weekly coverage is unavailable for this ASIN.',
    };
  }

  const exact = args.availableWeeks.find((week) => week.week_end === args.targetEnd) ?? null;
  if (exact) {
    return {
      weekEnd: exact.week_end,
      alignment: 'exact',
      detail: `${formatSqpWeekEndingLabel(exact.week_end)} exactly matches the window end.`,
    };
  }

  const nearestPrior =
    args.availableWeeks.find((week) => week.week_end <= args.targetEnd) ?? null;
  if (nearestPrior) {
    return {
      weekEnd: nearestPrior.week_end,
      alignment: 'nearest_prior',
      detail: `SQP uses the nearest available prior week, ${formatSqpWeekEndingLabel(
        nearestPrior.week_end
      )}, for window end ${args.targetEnd}.`,
    };
  }

  return {
    weekEnd: args.availableWeeks[0]?.week_end ?? null,
    alignment: 'fallback_latest',
    detail: `All available SQP weeks fall after window end ${args.targetEnd}, so ${formatSqpWeekEndingLabel(
      args.availableWeeks[0]?.week_end ?? null
    )} is used instead.`,
  };
};

const sumSqpSearchVolume = (rows: SqpKnownKeywordRow[]): number | null =>
  rows.length > 0
    ? rows.reduce((sum, row) => sum + numberValue(row.search_query_volume), 0)
    : null;

const normalizeQueryValue = (value?: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const formatSqpWeekEndingLabel = (weekEnd?: string | null): string => {
  if (!weekEnd) return 'No SQP week available';
  const { week } = getIsoWeekYear(weekEnd);
  return week > 0 ? `Week ${week} ending ${weekEnd}` : `Week ending ${weekEnd}`;
};

const findSqpRowForQuery = (
  rows: SqpKnownKeywordRow[],
  query?: string | null
): SqpKnownKeywordRow | null => {
  const normalizedQuery = normalizeQueryValue(query);
  if (!normalizedQuery) return null;

  return (
    rows.find(
      (row) =>
        normalizeQueryValue(row.search_query_norm) === normalizedQuery ||
        normalizeQueryValue(row.search_query_raw) === normalizedQuery
    ) ?? null
  );
};

export const getAdsOptimizerOverviewData = async (args: {
  accountId: string;
  marketplace: string;
  asin: string;
  start: string;
  end: string;
  trendEnabled?: boolean;
  trendMode?: AdsOptimizerOverviewTrendMode | string | null;
  archetype?: AdsOptimizerArchetype | null;
}): Promise<AdsOptimizerOverviewData> => {
  const comparisonWindow = buildAdsOptimizerOverviewComparisonWindow({
    start: args.start,
    end: args.end,
  });
  const selectedTrendMode = normalizeAdsOptimizerOverviewTrendMode(
    typeof args.trendMode === 'string' ? args.trendMode : undefined
  );
  const trendEnabled = args.trendEnabled ?? true;

  const [
    meta,
    currentSalesData,
    previousSalesData,
    rankingRows,
    previousRankingRows,
    availableSqpWeeks,
  ] =
    await Promise.all([
      loadProductMeta(args),
      getSalesDaily({
        accountId: args.accountId,
        marketplace: args.marketplace,
        asin: args.asin,
        start: args.start,
        end: args.end,
      }),
      getSalesDaily({
        accountId: args.accountId,
        marketplace: args.marketplace,
        asin: args.asin,
        start: comparisonWindow.previous.start,
        end: comparisonWindow.previous.end,
      }),
      getProductRankingDaily({
        accountId: args.accountId,
        marketplace: args.marketplace,
        asin: args.asin,
        start: args.start,
        end: args.end,
      }),
      getProductRankingDaily({
        accountId: args.accountId,
        marketplace: args.marketplace,
        asin: args.asin,
        start: comparisonWindow.previous.start,
        end: comparisonWindow.previous.end,
      }),
      fetchAvailableSqpWeeks({
        accountId: args.accountId,
        marketplace: args.marketplace,
        asin: args.asin,
      }),
    ]);

  const currentSales = summarizeSalesWindow(currentSalesData);
  const previousSales = summarizeSalesWindow(previousSalesData);
  const currentSqpSelection = selectSqpWeekForWindow({
    availableWeeks: availableSqpWeeks,
    targetEnd: args.end,
  });
  const previousSqpSelection = selectSqpWeekForWindow({
    availableWeeks: availableSqpWeeks,
    targetEnd: comparisonWindow.previous.end,
  });

  const [currentSqpWeekly, previousSqpWeekly] = await Promise.all([
    currentSqpSelection.weekEnd
      ? getProductSqpWeekly({
          accountId: args.accountId,
          marketplace: args.marketplace,
          asin: args.asin,
          start: args.start,
          end: args.end,
          weekEnd: currentSqpSelection.weekEnd,
        })
      : Promise.resolve(emptySqpWeekly),
    previousSqpSelection.weekEnd
      ? getProductSqpWeekly({
          accountId: args.accountId,
          marketplace: args.marketplace,
          asin: args.asin,
          start: comparisonWindow.previous.start,
          end: comparisonWindow.previous.end,
          weekEnd: previousSqpSelection.weekEnd,
        })
      : Promise.resolve(emptySqpWeekly),
  ]);

  const coverageNotes: AdsOptimizerOverviewCoverageNote[] = [];

  if (currentSales.costCoverage === null) {
    coverageNotes.push({
      source: 'economics',
      status: 'missing',
      message: 'No economics rows were available in the selected window.',
    });
  } else if (currentSales.costCoverage < 1) {
    coverageNotes.push({
      source: 'economics',
      status: 'partial',
      message: `${currentSales.coveredEconomicsDays}/${currentSales.economicsDays} day(s) had complete payout/fees/COGS coverage, so economics-derived fields are partial.`,
    });
  }

  const heroQueryCandidates = buildHeroQueryCandidates(rankingRows);
  const savedManualHeroQuery = meta.manualHeroQuery ?? null;
  const heroQueryTrend = buildHeroQueryTrend(rankingRows, savedManualHeroQuery);
  const savedManualHeroQueryAvailableInCandidates =
    savedManualHeroQuery !== null
      ? heroQueryCandidates.some(
          (candidate) =>
            normalizeQueryValue(candidate.query) === normalizeQueryValue(savedManualHeroQuery)
        )
      : false;
  const heroQuerySelection = {
    mode: savedManualHeroQuery ? ('manual' as const) : ('auto' as const),
    savedManualQuery: savedManualHeroQuery,
    savedManualQueryAvailableInCandidates: savedManualHeroQueryAvailableInCandidates,
    candidates: heroQueryCandidates,
    detail: savedManualHeroQuery
      ? savedManualHeroQueryAvailableInCandidates
        ? 'Manual hero query override is active for this ASIN and is currently present in ranking coverage.'
        : 'Manual hero query override is active for this ASIN, but the saved query is not present in the current ranking candidates.'
      : 'Auto hero query uses the highest-search-volume tracked ranking query from the selected ranking window.',
  };
  const rankingLadder = buildAdsOptimizerRankingLadder({
    currentRows: rankingRows,
    previousRows: previousRankingRows,
  });
  const trackedRankingKeywords = new Set(
    rankingRows
      .map((row) => row.keyword_norm ?? row.keyword_raw ?? null)
      .filter((value): value is string => Boolean(value))
  ).size;
  const rankingCoverageStatus: AdsOptimizerCoverageStatus =
    rankingRows.length === 0 ? 'missing' : trackedRankingKeywords >= 3 ? 'ready' : 'partial';
  if (rankingCoverageStatus !== 'ready') {
    coverageNotes.push({
      source: 'ranking',
      status: rankingCoverageStatus,
      message: heroQueryTrend.detail,
    });
  }

  const currentSqpRows = currentSqpWeekly.rows as SqpKnownKeywordRow[];
  const previousSqpRows = previousSqpWeekly.rows as SqpKnownKeywordRow[];
  const currentSqpSearchVolume = sumSqpSearchVolume(currentSqpRows);
  const previousSqpSearchVolume = sumSqpSearchVolume(previousSqpRows);
  const currentHeroSqpRow = findSqpRowForQuery(currentSqpRows, heroQueryTrend.keyword);
  const previousHeroSqpRow = findSqpRowForQuery(previousSqpRows, heroQueryTrend.keyword);
  const currentHeroSqpDemand = currentHeroSqpRow?.search_query_volume ?? null;
  const previousHeroSqpDemand = previousHeroSqpRow?.search_query_volume ?? null;
  const sqpTopRow =
    currentSqpRows.length > 0
      ? [...currentSqpRows].sort(
          (left, right) =>
            numberValue(right.search_query_volume) - numberValue(left.search_query_volume)
        )[0]
      : null;
  const sqpCoverageStatus: AdsOptimizerCoverageStatus =
    currentSqpWeekly.availableWeeks.length === 0
      ? 'missing'
      : currentSqpRows.length >= 10
        ? 'ready'
        : 'partial';
  if (sqpCoverageStatus !== 'ready') {
    coverageNotes.push({
      source: 'sqp',
      status: sqpCoverageStatus,
      message:
        currentSqpWeekly.availableWeeks.length === 0
          ? 'SQP demand coverage is unavailable for this ASIN.'
          : `SQP demand coverage is partial for ${formatSqpWeekEndingLabel(
              currentSqpWeekly.selectedWeekEnd
            )}.`,
    });
  }
  if (currentSqpSelection.alignment !== 'exact' || previousSqpSelection.alignment !== 'exact') {
    coverageNotes.push({
      source: 'sqp',
      status: 'partial',
      message: `${currentSqpSelection.detail} ${previousSqpSelection.detail}`,
    });
  }

  const trafficCoverageStatus: AdsOptimizerCoverageStatus =
    !currentSales.hasRows && !previousSales.hasRows
      ? 'missing'
      : currentSales.hasRows && previousSales.hasRows
        ? 'ready'
        : 'partial';
  const trafficCoverageDetail =
    trafficCoverageStatus === 'missing'
      ? 'Traffic block is missing because neither current nor previous window has sales-trend rows.'
      : trafficCoverageStatus === 'partial'
        ? 'Traffic block is partial because one comparison window is missing sales-trend rows.'
        : 'Traffic block compares equal-length current and previous windows.';
  if (trafficCoverageStatus !== 'ready') {
    coverageNotes.push({
      source: 'traffic',
      status: trafficCoverageStatus,
      message: trafficCoverageDetail,
    });
  }

  const conversionCoverageStatus: AdsOptimizerCoverageStatus =
    currentSales.unitSessionPercentage === null &&
    previousSales.unitSessionPercentage === null
      ? 'missing'
      : currentSales.unitSessionPercentage !== null &&
          previousSales.unitSessionPercentage !== null
        ? 'ready'
        : 'partial';
  const conversionCoverageDetail =
    conversionCoverageStatus === 'missing'
      ? 'Conversion block is missing because session-based conversion inputs are unavailable in both windows.'
      : conversionCoverageStatus === 'partial'
        ? 'Conversion block is partial because one comparison window lacks session-based conversion inputs.'
        : 'Conversion block compares equal-length current and previous windows.';
  if (conversionCoverageStatus !== 'ready') {
    coverageNotes.push({
      source: 'conversion',
      status: conversionCoverageStatus,
      message: conversionCoverageDetail,
    });
  }

  const trendWindow: AdsOptimizerOverviewWindow = comparisonWindow.current;

  const trendSalesSeries = currentSales.dailySeries.filter(
    (row) => row.date >= trendWindow.start && row.date <= trendWindow.end
  );
  const trendVisibilitySeries =
    heroQueryTrend.keyword !== null
      ? rankingRows
          .filter(
            (row) =>
              normalizeQueryValue(row.keyword_norm ?? row.keyword_raw ?? null) ===
                normalizeQueryValue(heroQueryTrend.keyword) &&
              row.observed_date !== null &&
              row.observed_date >= trendWindow.start &&
              row.observed_date <= trendWindow.end
          )
          .sort((left, right) =>
            String(left.observed_date ?? '').localeCompare(String(right.observed_date ?? ''))
          )
      : [];

  const comparison = {
    sales: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.kpis.sales : null,
      previous: previousSales.hasRows ? previousSales.kpis.sales : null,
      semantics: 'higher_is_better',
      label: 'Sales',
    }),
    adSpend: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.kpis.ppc_cost : null,
      previous: previousSales.hasRows ? previousSales.kpis.ppc_cost : null,
      semantics: 'contextual',
      label: 'Ad spend',
    }),
    tacos: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.kpis.tacos : null,
      previous: previousSales.hasRows ? previousSales.kpis.tacos : null,
      semantics: 'lower_is_better',
      label: 'TACOS',
    }),
    contributionAfterAds: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.contributionAfterAds : null,
      previous: previousSales.hasRows ? previousSales.contributionAfterAds : null,
      semantics: 'higher_is_better',
      label: 'Contribution after ads',
    }),
  };

  const heroQueryDemandStatus: AdsOptimizerCoverageStatus =
    sqpCoverageStatus === 'missing'
      ? 'missing'
      : heroQueryTrend.keyword === null
        ? 'missing'
        : currentHeroSqpDemand !== null && previousHeroSqpDemand !== null
          ? 'ready'
          : 'partial';

  const traffic = {
    coverage: {
      status: trafficCoverageStatus,
      detail: trafficCoverageDetail,
    },
    sessions: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.kpis.sessions : null,
      previous: previousSales.hasRows ? previousSales.kpis.sessions : null,
      semantics: 'higher_is_better',
      label: 'Sessions',
    }),
    spImpressions: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.kpis.ppc_impressions : null,
      previous: previousSales.hasRows ? previousSales.kpis.ppc_impressions : null,
      semantics: 'higher_is_better',
      label: 'SP impressions',
    }),
    heroQueryDemand: {
      status: heroQueryDemandStatus,
      query: heroQueryTrend.keyword,
      currentWeekEnd: currentSqpWeekly.selectedWeekEnd,
      previousWeekEnd: previousSqpWeekly.selectedWeekEnd,
      alignment:
        currentSqpSelection.alignment !== 'exact'
          ? currentSqpSelection.alignment
          : previousSqpSelection.alignment,
      current: currentHeroSqpDemand,
      previous: previousHeroSqpDemand,
      delta:
        currentHeroSqpDemand !== null && previousHeroSqpDemand !== null
          ? currentHeroSqpDemand - previousHeroSqpDemand
          : null,
      deltaPct:
        currentHeroSqpDemand !== null &&
        previousHeroSqpDemand !== null &&
        Math.abs(previousHeroSqpDemand) > 0
          ? (currentHeroSqpDemand - previousHeroSqpDemand) / Math.abs(previousHeroSqpDemand)
          : null,
      detail:
        sqpCoverageStatus === 'missing'
          ? 'Hero-query-specific SQP demand is unavailable because no aligned SQP week exists for this ASIN.'
          : heroQueryTrend.keyword === null
            ? 'Hero-query-specific SQP demand is unavailable because no hero query was resolved from ranking coverage.'
            : currentHeroSqpDemand === null
              ? `Hero-query-specific SQP demand is unavailable for "${heroQueryTrend.keyword}" in ${formatSqpWeekEndingLabel(
                  currentSqpWeekly.selectedWeekEnd
                )}. Tracked total SQP demand is still shown separately.`
              : `Hero-query-specific SQP demand is tied to "${heroQueryTrend.keyword}" in ${formatSqpWeekEndingLabel(
                  currentSqpWeekly.selectedWeekEnd
                )}. Previous window uses ${formatSqpWeekEndingLabel(previousSqpWeekly.selectedWeekEnd)}.`,
    },
    sqpDemand: {
      status: sqpCoverageStatus,
      currentWeekEnd: currentSqpWeekly.selectedWeekEnd,
      previousWeekEnd: previousSqpWeekly.selectedWeekEnd,
      alignment:
        currentSqpSelection.alignment !== 'exact'
          ? currentSqpSelection.alignment
          : previousSqpSelection.alignment,
      current: currentSqpSearchVolume,
      previous: previousSqpSearchVolume,
      delta:
        currentSqpSearchVolume !== null && previousSqpSearchVolume !== null
          ? currentSqpSearchVolume - previousSqpSearchVolume
          : null,
      deltaPct:
        currentSqpSearchVolume !== null &&
        previousSqpSearchVolume !== null &&
        Math.abs(previousSqpSearchVolume) > 0
          ? (currentSqpSearchVolume - previousSqpSearchVolume) /
            Math.abs(previousSqpSearchVolume)
          : null,
      detail:
        sqpCoverageStatus === 'missing'
          ? 'Tracked total SQP demand is unavailable for this ASIN.'
          : `${currentSqpSelection.detail} Previous window uses ${formatSqpWeekEndingLabel(
              previousSqpSelection.weekEnd
            )}.`,
    },
  };

  const conversion = {
    coverage: {
      status: conversionCoverageStatus,
      detail: conversionCoverageDetail,
    },
    unitSessionPercentage: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.unitSessionPercentage : null,
      previous: previousSales.hasRows ? previousSales.unitSessionPercentage : null,
      semantics: 'higher_is_better',
      label: 'Unit session percentage',
    }),
    ordersPerSession: buildAdsOptimizerOverviewMetricDelta({
      current: currentSales.hasRows ? currentSales.ordersPerSession : null,
      previous: previousSales.hasRows ? previousSales.ordersPerSession : null,
      semantics: 'higher_is_better',
      label: 'Orders per session',
    }),
  };

  const state = classifyAdsOptimizerProductState({
    sales: currentSales.kpis.sales,
    orders: currentSales.kpis.orders,
    units: currentSales.kpis.units,
    acos: currentSales.kpis.acos,
    breakEvenAcos: currentSales.breakEvenAcos,
    contributionAfterAds: currentSales.contributionAfterAds,
  });
  const objective = recommendAdsOptimizerObjective({
    state: state.value,
    acos: currentSales.kpis.acos,
    breakEvenAcos: currentSales.breakEvenAcos,
    heroQueryTrend,
    totalSqpSearchVolume: currentSqpSearchVolume,
    archetype: args.archetype ?? null,
  });

  return {
    product: {
      productId: meta.productId,
      asin: args.asin,
      title: meta.title,
      shortName: meta.shortName,
      displayName: meta.displayName,
    },
    window: comparisonWindow,
    trend: {
      enabled: trendEnabled,
      selectedMode: selectedTrendMode,
      availableModes: [...ADS_OPTIMIZER_OVERVIEW_TREND_MODES],
      appliedWindow: trendWindow,
      truncatedToWindow: false,
      detail:
        trendEnabled
          ? `Trend display uses the selected Overview window (${trendWindow.days} day(s)).`
          : `Trend display is off in the operator UI, but the selected Overview window (${trendWindow.days} day(s)) still defines the prepared trend series.`,
      series: {
        economics: trendSalesSeries.map((row) => ({
          date: row.date,
          sales: row.sales,
          adSpend: row.ppc_cost,
          contributionAfterAds: buildDailyContributionAfterAds(row),
          tacos: row.tacos,
        })),
        traffic: trendSalesSeries.map((row) => ({
          date: row.date,
          sessions: row.sessions,
          spImpressions: row.ppc_impressions,
        })),
        conversion: trendSalesSeries.map((row) => ({
          date: row.date,
          unitSessionPercentage: safeRatio(row.units, row.sessions),
          ordersPerSession: safeRatio(row.orders, row.sessions),
        })),
        visibility: {
          heroQueryKeyword: heroQueryTrend.keyword,
          latestObservedDate: heroQueryTrend.latestObservedDate ?? null,
          observedDays: trendVisibilitySeries.length,
          detail:
            heroQueryTrend.keyword === null
              ? 'No hero query was resolved, so rank trend series is empty.'
              : 'Rank trend series shows latest observed raw ranks only and never averages rank across the selected window.',
          rankSeries: trendVisibilitySeries.map((row) => ({
            date: row.observed_date ?? '',
            organicRank: row.organic_rank_value ?? null,
          })),
        },
      },
    },
    economics: {
      sales: currentSales.kpis.sales,
      orders: currentSales.kpis.orders,
      units: currentSales.kpis.units,
      adSpend: currentSales.kpis.ppc_cost,
      adSales: currentSales.kpis.ppc_sales,
      tacos: currentSales.kpis.tacos,
      averagePrice: currentSales.kpis.avg_price,
      costCoverage: currentSales.costCoverage,
      breakEvenAcos: currentSales.breakEvenAcos,
      contributionBeforeAdsPerUnit: currentSales.contributionBeforeAdsPerUnit,
      contributionAfterAds: currentSales.contributionAfterAds,
    },
    comparison,
    traffic,
    conversion,
    visibility: {
      rankingCoverage: {
        status: rankingCoverageStatus,
        trackedKeywords: trackedRankingKeywords,
        detail:
          rankingRows.length === 0
            ? 'No ranking coverage was available in the selected window.'
            : `${trackedRankingKeywords} tracked ranking keyword(s) were available in the selected window.`,
      },
      rankingLadder,
      heroQueryTrend,
      heroQuerySelection,
      sqpCoverage: {
        status: sqpCoverageStatus,
        selectedWeekEnd: currentSqpWeekly.selectedWeekEnd,
        trackedQueries: currentSqpRows.length,
        totalSearchVolume: currentSqpSearchVolume,
        topQuery: sqpTopRow?.search_query_raw ?? sqpTopRow?.search_query_norm ?? null,
        previousWeekEnd: previousSqpWeekly.selectedWeekEnd,
        previousTotalSearchVolume: previousSqpSearchVolume,
        alignment:
          currentSqpSelection.alignment !== 'exact'
            ? currentSqpSelection.alignment
            : previousSqpSelection.alignment,
        detail:
          sqpCoverageStatus === 'missing'
            ? 'No SQP weekly coverage was available for this ASIN.'
            : `${currentSqpSelection.detail} Using ${formatSqpWeekEndingLabel(
                currentSqpWeekly.selectedWeekEnd
              )} with ${currentSqpRows.length} tracked query row(s).`,
      },
    },
    coverageNotes,
    state,
    objective,
    warnings: coverageNotes
      .filter((note) => note.status !== 'ready')
      .map((note) => note.message),
  };
};
