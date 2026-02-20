import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAvailableSqpWeeks } from '@/lib/sqp/fetchAvailableSqpWeeks';
import { normalizeSqpRow } from '@/lib/sqp/normalizeSqpRow';

export type SqpScope = 'asin' | 'brand';

type SqpWeek = {
  week_start: string;
  week_end: string;
};

type SqpRowBase = {
  upload_id: string | null;
  account_id: string | null;
  marketplace: string | null;
  scope_type: string | null;
  scope_value: string | null;
  week_start: string | null;
  week_end: string | null;
  reporting_date: string | null;
  search_query_raw: string | null;
  search_query_norm: string | null;
  search_query_score: number | null;
  search_query_volume: number | null;
  impressions_total: number | null;
  impressions_self: number | null;
  impressions_self_share: number | null;
  clicks_total: number | null;
  clicks_rate_per_query: number | null;
  clicks_self: number | null;
  clicks_self_share: number | null;
  clicks_price_median_total: number | null;
  clicks_price_median_self: number | null;
  clicks_same_day_ship: number | null;
  clicks_1d_ship: number | null;
  clicks_2d_ship: number | null;
  cart_adds_total: number | null;
  cart_add_rate_per_query: number | null;
  cart_adds_self: number | null;
  cart_adds_self_share: number | null;
  cart_adds_price_median_total: number | null;
  cart_adds_price_median_self: number | null;
  cart_adds_same_day_ship: number | null;
  cart_adds_1d_ship: number | null;
  cart_adds_2d_ship: number | null;
  purchases_total: number | null;
  purchases_rate_per_query: number | null;
  purchases_self: number | null;
  purchases_self_share: number | null;
  purchases_price_median_total: number | null;
  purchases_price_median_self: number | null;
  purchases_same_day_ship: number | null;
  purchases_1d_ship: number | null;
  purchases_2d_ship: number | null;
  exported_at: string | null;
};

type SqpKnownKeywordRow = SqpRowBase & {
  keyword_id?: string | null;
};

type SqpWeeklyResult = {
  scope: SqpScope;
  availableWeeks: SqpWeek[];
  selectedWeekEnd: string | null;
  rows: SqpKnownKeywordRow[];
};

export const getProductSqpWeekly = async ({
  accountId,
  marketplace,
  asin,
  start: _start,
  end: _end,
  scope,
  weekEnd,
}: {
  accountId: string;
  marketplace: string;
  asin: string;
  start: string;
  end: string;
  scope: SqpScope;
  weekEnd?: string;
}): Promise<SqpWeeklyResult> => {
  void _start;
  void _end;
  const availableWeeks = await fetchAvailableSqpWeeks({
    accountId,
    marketplace,
    scope,
    asin,
  });

  if (availableWeeks.length === 0) {
    return {
      scope,
      availableWeeks: [],
      selectedWeekEnd: null,
      rows: [],
    };
  }

  const weekEndSet = new Set(availableWeeks.map((row) => row.week_end));
  const selectedWeekEnd = weekEnd && weekEndSet.has(weekEnd)
    ? weekEnd
    : availableWeeks[0]?.week_end ?? null;

  if (!selectedWeekEnd) {
    return {
      scope,
      availableWeeks,
      selectedWeekEnd: null,
      rows: [],
    };
  }

  const viewName =
    scope === 'asin'
      ? 'sqp_weekly_latest_known_keywords'
      : 'sqp_weekly_brand_continuous_latest';

  const rowsQuery = supabaseAdmin
    .from(viewName)
    .select('*')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('week_end', selectedWeekEnd)
    .limit(1000);

  if (scope === 'asin') {
    rowsQuery.eq('scope_type', 'asin').eq('scope_value', asin);
  }

  const { data: rows, error: rowsError } = await rowsQuery;

  const normalizedRows =
    rowsError || !rows
      ? []
      : (rows as SqpKnownKeywordRow[]).map((row) => normalizeSqpRow(row));

  return {
    scope,
    availableWeeks,
    selectedWeekEnd,
    rows: normalizedRows,
  };
};

export type { SqpWeek, SqpRowBase, SqpKnownKeywordRow, SqpWeeklyResult };
