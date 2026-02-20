import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type SqpWeek = {
  week_start: string;
  week_end: string;
};

type FetchAvailableSqpWeeksParams = {
  accountId: string;
  marketplace: string;
  asin: string;
  pageSize?: number;
};

export const fetchAvailableSqpWeeks = async ({
  accountId,
  marketplace,
  asin,
  pageSize = 5000,
}: FetchAvailableSqpWeeksParams): Promise<SqpWeek[]> => {
  const weekMap = new Map<string, SqpWeek>();
  const effectivePageSize = Math.max(pageSize, 1);
  const asinWeekCap = 120;
  const safetyPageCap = 500;
  let totalWeekRowsScanned = 0;
  let totalPagesScanned = 0;
  let offset = 0;

  for (
    let page = 0;
    page < safetyPageCap && weekMap.size < asinWeekCap;
    page += 1
  ) {
    const from = offset;
    const to = from + effectivePageSize - 1;
    const { data, error } = await supabaseAdmin
      .from('sqp_weekly_latest_known_keywords')
      .select('week_start,week_end')
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .eq('scope_type', 'asin')
      .eq('scope_value', asin)
      .order('week_end', { ascending: false })
      .range(from, to);

    if (error || !data || data.length === 0) {
      break;
    }

    totalPagesScanned += 1;
    totalWeekRowsScanned += data.length;
    data.forEach((row) => {
      const weekEnd = row.week_end ?? null;
      if (!weekEnd || weekMap.has(weekEnd)) return;
      weekMap.set(weekEnd, {
        week_start: row.week_start ?? weekEnd,
        week_end: weekEnd,
      });
    });

    if (weekMap.size >= asinWeekCap) {
      break;
    }
    offset += data.length;
  }

  if (process.env.NODE_ENV === 'development') {
    console.info('[fetchAvailableSqpWeeks]', {
      accountId,
      marketplace,
      asin,
      totalPagesScanned,
      totalWeekRowsScanned,
      distinctWeeksFound: weekMap.size,
    });
  }

  return Array.from(weekMap.values()).sort((a, b) => b.week_end.localeCompare(a.week_end));
};
