import 'server-only';

import type { AdsOptimizerArchetype } from './types';
import { getProductRankingDaily, type ProductRankingRow } from '@/lib/ranking/getProductRankingDaily';
import { getSalesDaily } from '@/lib/sales/getSalesDaily';
import { getProductSqpWeekly, type SqpKnownKeywordRow } from '@/lib/sqp/getProductSqpWeekly';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

export type AdsOptimizerOverviewData = {
  product: {
    asin: string;
    title: string | null;
    shortName: string | null;
    displayName: string;
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
  visibility: {
    rankingCoverage: {
      status: AdsOptimizerCoverageStatus;
      trackedKeywords: number;
      detail: string;
    };
    heroQueryTrend: {
      status: AdsOptimizerCoverageStatus;
      keyword: string | null;
      searchVolume: number | null;
      latestOrganicRank: number | null;
      baselineOrganicRank: number | null;
      rankDelta: number | null;
      detail: string;
    };
    sqpCoverage: {
      status: AdsOptimizerCoverageStatus;
      selectedWeekEnd: string | null;
      trackedQueries: number;
      totalSearchVolume: number | null;
      topQuery: string | null;
      detail: string;
    };
  };
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

export const buildHeroQueryTrend = (rows: ProductRankingRow[]): HeroQueryTrend => {
  if (rows.length === 0) {
    return {
      status: 'missing',
      keyword: null,
      searchVolume: null,
      latestOrganicRank: null,
      baselineOrganicRank: null,
      rankDelta: null,
      detail: 'No ranking rows were available in the selected window.',
    };
  }

  const rowsByKeyword = new Map<string, ProductRankingRow[]>();
  rows.forEach((row) => {
    const keyword = row.keyword_norm ?? row.keyword_raw ?? null;
    if (!keyword) return;
    const bucket = rowsByKeyword.get(keyword) ?? [];
    bucket.push(row);
    rowsByKeyword.set(keyword, bucket);
  });

  if (rowsByKeyword.size === 0) {
    return {
      status: 'partial',
      keyword: null,
      searchVolume: null,
      latestOrganicRank: null,
      baselineOrganicRank: null,
      rankDelta: null,
      detail: 'Ranking rows exist, but keyword identity or rank values were incomplete.',
    };
  }

  const latestPerKeyword = Array.from(rowsByKeyword.entries())
    .map(([keyword, keywordRows]) => {
      const sorted = [...keywordRows].sort((left, right) =>
        String(right.observed_date ?? '').localeCompare(String(left.observed_date ?? ''))
      );
      const latest = sorted[0] ?? null;
      return {
        keyword,
        latest,
        searchVolume: latest?.search_volume ?? null,
      };
    })
    .filter((row) => row.latest !== null);

  latestPerKeyword.sort((left, right) => {
    const volumeDiff = numberValue(right.searchVolume) - numberValue(left.searchVolume);
    if (volumeDiff !== 0) return volumeDiff;
    return left.keyword.localeCompare(right.keyword);
  });

  const hero = latestPerKeyword[0] ?? null;
  if (!hero?.latest) {
    return {
      status: 'partial',
      keyword: null,
      searchVolume: null,
      latestOrganicRank: null,
      baselineOrganicRank: null,
      rankDelta: null,
      detail: 'Ranking data was present, but a representative hero query could not be resolved.',
    };
  }

  const keywordRows = [...(rowsByKeyword.get(hero.keyword) ?? [])].sort((left, right) =>
    String(left.observed_date ?? '').localeCompare(String(right.observed_date ?? ''))
  );
  const firstWithRank = keywordRows.find((row) => row.organic_rank_value !== null) ?? null;
  const latestWithRank = [...keywordRows].reverse().find((row) => row.organic_rank_value !== null) ?? null;

  if (!firstWithRank || !latestWithRank) {
    return {
      status: 'partial',
      keyword: hero.latest.keyword_raw ?? hero.keyword,
      searchVolume: hero.latest.search_volume ?? null,
      latestOrganicRank: latestWithRank?.organic_rank_value ?? null,
      baselineOrganicRank: firstWithRank?.organic_rank_value ?? null,
      rankDelta: null,
      detail: 'Hero-query ranking coverage exists, but at least one endpoint rank value is missing.',
    };
  }

  const baselineRank = firstWithRank.organic_rank_value;
  const latestRank = latestWithRank.organic_rank_value;
  if (baselineRank === null || latestRank === null) {
    return {
      status: 'partial',
      keyword: hero.latest.keyword_raw ?? hero.keyword,
      searchVolume: hero.latest.search_volume ?? null,
      latestOrganicRank: latestRank,
      baselineOrganicRank: baselineRank,
      rankDelta: null,
      detail: 'Hero-query ranking coverage exists, but at least one endpoint rank value is missing.',
    };
  }

  const rankDelta = baselineRank - latestRank;
  const trendDirection =
    rankDelta >= 3 ? 'improved' : rankDelta <= -3 ? 'weakened' : 'held roughly flat';
  return {
    status: keywordRows.length >= 2 ? 'ready' : 'partial',
    keyword: hero.latest.keyword_raw ?? hero.keyword,
    searchVolume: hero.latest.search_volume ?? null,
    latestOrganicRank: latestRank,
    baselineOrganicRank: baselineRank,
    rankDelta,
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
    input.contributionAfterAds !== null ? safeRatio(input.contributionAfterAds, input.sales) : null;

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
      title: null,
      shortName: null,
      displayName: args.asin,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from('product_profile')
    .select('profile_json')
    .eq('product_id', typedProduct.product_id)
    .maybeSingle();

  const typedProfile = (profile ?? null) as ProductProfileRow | null;
  const shortName = parseShortName(typedProfile?.profile_json ?? null);
  return {
    title: typedProduct.title ?? null,
    shortName,
    displayName: shortName ?? typedProduct.title ?? args.asin,
  };
};

export const getAdsOptimizerOverviewData = async (args: {
  accountId: string;
  marketplace: string;
  asin: string;
  start: string;
  end: string;
  archetype?: AdsOptimizerArchetype | null;
}): Promise<AdsOptimizerOverviewData> => {
  const [meta, salesData, rankingRows, sqpWeekly] = await Promise.all([
    loadProductMeta(args),
    getSalesDaily({
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
      start: args.start,
      end: args.end,
    }),
    getProductSqpWeekly({
      accountId: args.accountId,
      marketplace: args.marketplace,
      asin: args.asin,
      start: args.start,
      end: args.end,
    }),
  ]);

  const warnings: string[] = [];
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
  const costCoverage =
    economicsDays > 0 ? coveredEconomicsDays / economicsDays : null;

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
    contributionBeforeAdsTotal !== null ? safeRatio(contributionBeforeAdsTotal, kpis.units) : null;
  const contributionAfterAds =
    kpis.profits ?? (contributionBeforeAdsTotal !== null ? contributionBeforeAdsTotal - kpis.ppc_cost : null);
  const breakEvenAcos =
    contributionBeforeAdsTotal !== null ? safeRatio(contributionBeforeAdsTotal, kpis.sales) : null;

  if (costCoverage === null) {
    warnings.push('No economics rows were available in the selected window.');
  } else if (costCoverage < 1) {
    warnings.push(
      `${coveredEconomicsDays}/${economicsDays} day(s) had complete payout/fees/COGS coverage, so economics-derived fields are partial.`
    );
  }

  const heroQueryTrend = buildHeroQueryTrend(rankingRows);
  const trackedRankingKeywords = new Set(
    rankingRows
      .map((row) => row.keyword_norm ?? row.keyword_raw ?? null)
      .filter((value): value is string => Boolean(value))
  ).size;
  const rankingCoverageStatus: AdsOptimizerCoverageStatus =
    rankingRows.length === 0 ? 'missing' : trackedRankingKeywords >= 3 ? 'ready' : 'partial';
  if (rankingCoverageStatus !== 'ready') {
    warnings.push(heroQueryTrend.detail);
  }

  const sqpRows = sqpWeekly.rows as SqpKnownKeywordRow[];
  const totalSqpSearchVolume =
    sqpRows.length > 0
      ? sqpRows.reduce((sum, row) => sum + numberValue(row.search_query_volume), 0)
      : null;
  const topSqpRow =
    sqpRows.length > 0
      ? [...sqpRows].sort(
          (left, right) =>
            numberValue(right.search_query_volume) - numberValue(left.search_query_volume)
        )[0]
      : null;
  const sqpCoverageStatus: AdsOptimizerCoverageStatus =
    sqpWeekly.availableWeeks.length === 0 ? 'missing' : sqpRows.length >= 10 ? 'ready' : 'partial';
  if (sqpCoverageStatus !== 'ready') {
    warnings.push(
      sqpWeekly.availableWeeks.length === 0
        ? 'SQP demand coverage is unavailable for this ASIN.'
        : `SQP demand coverage is partial for week ${sqpWeekly.selectedWeekEnd ?? '—'}.`
    );
  }

  const state = classifyAdsOptimizerProductState({
    sales: kpis.sales,
    orders: kpis.orders,
    units: kpis.units,
    acos: kpis.acos,
    breakEvenAcos,
    contributionAfterAds,
  });
  const objective = recommendAdsOptimizerObjective({
    state: state.value,
    acos: kpis.acos,
    breakEvenAcos,
    heroQueryTrend,
    totalSqpSearchVolume,
    archetype: args.archetype ?? null,
  });

  return {
    product: {
      asin: args.asin,
      title: meta.title,
      shortName: meta.shortName,
      displayName: meta.displayName,
    },
    economics: {
      sales: kpis.sales,
      orders: kpis.orders,
      units: kpis.units,
      adSpend: kpis.ppc_cost,
      adSales: kpis.ppc_sales,
      tacos: kpis.tacos,
      averagePrice: kpis.avg_price,
      costCoverage,
      breakEvenAcos,
      contributionBeforeAdsPerUnit,
      contributionAfterAds,
    },
    visibility: {
      rankingCoverage: {
        status: rankingCoverageStatus,
        trackedKeywords: trackedRankingKeywords,
        detail:
          rankingRows.length === 0
            ? 'No ranking coverage was available in the selected window.'
            : `${trackedRankingKeywords} tracked ranking keyword(s) were available in the selected window.`,
      },
      heroQueryTrend,
      sqpCoverage: {
        status: sqpCoverageStatus,
        selectedWeekEnd: sqpWeekly.selectedWeekEnd,
        trackedQueries: sqpRows.length,
        totalSearchVolume: totalSqpSearchVolume,
        topQuery: topSqpRow?.search_query_raw ?? topSqpRow?.search_query_norm ?? null,
        detail:
          sqpCoverageStatus === 'missing'
            ? 'No SQP weekly coverage was available for this ASIN.'
            : `Using SQP week ${sqpWeekly.selectedWeekEnd ?? '—'} with ${sqpRows.length} tracked query row(s).`,
      },
    },
    state,
    objective,
    warnings,
  };
};
