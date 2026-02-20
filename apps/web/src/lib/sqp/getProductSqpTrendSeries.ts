import 'server-only';

import { enrichSqpRow } from '@/lib/sqp/enrichSqpRow';
import type { SqpKnownKeywordRow, SqpScope, SqpWeek } from '@/lib/sqp/getProductSqpWeekly';
import { normalizeSqpRow } from '@/lib/sqp/normalizeSqpRow';
import { selectSqpTrendRange } from '@/lib/sqp/sqpTrendRange';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export type SqpTrendRow = SqpKnownKeywordRow & {
  market_ctr?: number | null;
  self_ctr?: number | null;
  market_cvr?: number | null;
  self_cvr?: number | null;
  self_ctr_index?: number | null;
  self_cvr_index?: number | null;
  cart_add_rate_from_clicks_market?: number | null;
  cart_add_rate_from_clicks_self?: number | null;
};

export type SqpTrendResult = {
  availableWeeks: SqpWeek[];
  selectedFrom: string | null;
  selectedTo: string | null;
  series: SqpTrendRow[];
};

const dedupeWeeks = (rows: Array<{ week_start?: string | null; week_end?: string | null }>):
  SqpWeek[] => {
  const map = new Map<string, SqpWeek>();
  rows.forEach((row) => {
    const weekEnd = row.week_end ?? null;
    if (!weekEnd) return;
    if (!map.has(weekEnd)) {
      map.set(weekEnd, {
        week_start: row.week_start ?? weekEnd,
        week_end: weekEnd,
      });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.week_end.localeCompare(a.week_end));
};

export const getProductSqpTrendSeries = async ({
  accountId,
  marketplace,
  asin,
  scope,
  searchQueryNorm,
  fromWeekEnd,
  toWeekEnd,
}: {
  accountId: string;
  marketplace: string;
  asin: string;
  scope: SqpScope;
  searchQueryNorm: string;
  fromWeekEnd?: string | null;
  toWeekEnd?: string | null;
}): Promise<SqpTrendResult> => {
  const viewName =
    scope === 'asin'
      ? 'sqp_weekly_latest_known_keywords'
      : 'sqp_weekly_brand_continuous_latest';

  const weeksQuery = supabaseAdmin
    .from(viewName)
    .select('week_start,week_end')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('search_query_norm', searchQueryNorm)
    .order('week_end', { ascending: false });

  if (scope === 'asin') {
    weeksQuery.eq('scope_type', 'asin').eq('scope_value', asin);
  }

  const { data: weekRows, error: weekError } = await weeksQuery;
  const availableWeeks = weekError || !weekRows ? [] : dedupeWeeks(weekRows);

  const { from, to } = selectSqpTrendRange({
    availableWeeks,
    fromWeekEnd,
    toWeekEnd,
    windowSize: 12,
  });

  if (!from || !to) {
    return {
      availableWeeks,
      selectedFrom: from,
      selectedTo: to,
      series: [],
    };
  }

  const selectColumnsBase =
    'week_start,week_end,search_query_raw,search_query_norm,search_query_volume,search_query_score,' +
    'impressions_total,impressions_self,impressions_self_share,' +
    'clicks_total,clicks_self,clicks_self_share,clicks_rate_per_query,' +
    'clicks_price_median_total,clicks_price_median_self,' +
    'cart_adds_total,cart_adds_self,cart_adds_self_share,cart_add_rate_per_query,' +
    'cart_adds_price_median_total,cart_adds_price_median_self,' +
    'purchases_total,purchases_self,purchases_self_share,purchases_rate_per_query,' +
    'purchases_price_median_total,purchases_price_median_self';
  const selectColumns =
    scope === 'asin' ? `${selectColumnsBase},keyword_id` : selectColumnsBase;

  const buildBaseQuery = () => {
    const query = supabaseAdmin
      .from(viewName)
      .select(selectColumns)
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .gte('week_end', from)
      .lte('week_end', to)
      .order('week_end', { ascending: true });

    if (scope === 'asin') {
      query.eq('scope_type', 'asin').eq('scope_value', asin);
    }

    return query;
  };

  const { data, error } = await buildBaseQuery().eq('search_query_norm', searchQueryNorm);
  const rows = error || !data ? [] : (data as unknown as SqpKnownKeywordRow[]);

  const normalizedRows = rows.map((row) => normalizeSqpRow(row));

  return {
    availableWeeks,
    selectedFrom: from,
    selectedTo: to,
    series: normalizedRows.map((row) => enrichSqpRow(row)),
  };
};
