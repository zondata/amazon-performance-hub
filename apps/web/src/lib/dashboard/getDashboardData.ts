import 'server-only';

import { env } from '@/lib/env';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';

type DashboardFilters = {
  start: string;
  end: string;
  asin: string;
};

type SalesRow = {
  date: string | null;
  asin: string | null;
  sales: number | string | null;
  orders: number | string | null;
  units: number | string | null;
  ppc_cost: number | string | null;
  avg_sales_price: number | string | null;
  profits: number | string | null;
  margin: number | string | null;
};

type SpendReconciliation =
  | { enabled: false }
  | { enabled: true; recent_flags_count: number; latest_flag_date?: string }
  | { enabled: true; error: 'timeout' };

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric;
};

const toDateString = (value: Date): string => value.toISOString().slice(0, 10);

const computeDefaultFilters = (): DashboardFilters => {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 30);
  return {
    start: toDateString(start),
    end: toDateString(end),
    asin: 'all',
  };
};

export const getDashboardData = async (filters?: Partial<DashboardFilters>) => {
  const defaults = computeDefaultFilters();
  let start = filters?.start ?? defaults.start;
  let end = filters?.end ?? defaults.end;
  const asin = filters?.asin ?? defaults.asin;

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const asinOptions = await fetchAsinOptions(env.accountId, env.marketplace);

  let spendReconciliation: SpendReconciliation = { enabled: false };
  if (env.enableSpendReconciliation) {
    try {
      const { data, error } = await supabaseAdmin
        .from('v_ppc_spend_reconciliation_daily')
        .select('date,flag_large_delta')
        .eq('account_id', env.accountId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false })
        .limit(500);

      if (error) throw error;

      const flagged = (data ?? []).filter((row) => row.flag_large_delta);
      spendReconciliation = {
        enabled: true,
        recent_flags_count: flagged.length,
        latest_flag_date: flagged[0]?.date ?? undefined,
      };
    } catch {
      spendReconciliation = { enabled: true, error: 'timeout' };
    }
  }

  let query = supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select(
      'date,asin,sales,orders,units,ppc_cost,avg_sales_price,profits,margin'
    )
    .eq('account_id', env.accountId)
    .eq('marketplace', env.marketplace)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .limit(5000);

  if (asin !== 'all') {
    query = query.eq('asin', asin);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load sales trend data: ${error.message}`);
  }

  const rows = (data ?? []) as SalesRow[];

  const dailyMap = new Map<
    string,
    { date: string; sales: number; ppc_cost: number; orders: number; units: number }
  >();

  let totalSales = 0;
  let totalOrders = 0;
  let totalUnits = 0;
  let totalPpcCost = 0;
  let totalProfit = 0;
  let profitSeen = false;

  let weightedPriceTotal = 0;
  let weightedUnitsTotal = 0;

  rows.forEach((row) => {
    if (!row.date) return;
    const dateKey = row.date;
    const sales = numberValue(row.sales);
    const orders = numberValue(row.orders);
    const units = numberValue(row.units);
    const ppcCost = numberValue(row.ppc_cost);

    const existing = dailyMap.get(dateKey) ?? {
      date: dateKey,
      sales: 0,
      ppc_cost: 0,
      orders: 0,
      units: 0,
    };

    existing.sales += sales;
    existing.ppc_cost += ppcCost;
    existing.orders += orders;
    existing.units += units;
    dailyMap.set(dateKey, existing);

    totalSales += sales;
    totalOrders += orders;
    totalUnits += units;
    totalPpcCost += ppcCost;

    if (row.avg_sales_price !== null && row.avg_sales_price !== undefined) {
      weightedPriceTotal += numberValue(row.avg_sales_price) * units;
      weightedUnitsTotal += units;
    }

    if (row.profits !== null && row.profits !== undefined) {
      totalProfit += numberValue(row.profits);
      profitSeen = true;
    }
  });

  const dailySeries = Array.from(dailyMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const avgSellingPrice =
    weightedUnitsTotal > 0 ? weightedPriceTotal / weightedUnitsTotal : null;

  const tacos = totalSales > 0 ? totalPpcCost / totalSales : null;
  const profitMargin = profitSeen && totalSales > 0 ? totalProfit / totalSales : null;

  return {
    filters: { start, end, asin },
    asinOptions,
    kpis: {
      total_sales: totalSales,
      total_orders: totalOrders,
      total_units: totalUnits,
      total_ppc_cost: totalPpcCost,
      avg_selling_price: avgSellingPrice,
      tacos,
      profit: profitSeen ? totalProfit : null,
      profit_margin: profitMargin,
    },
    dailySeries,
    spendReconciliation,
  };
};

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
