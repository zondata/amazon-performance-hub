import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type SalesDailyFilters = {
  accountId: string;
  marketplace: string;
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
  ppc_sales: number | string | null;
  ppc_orders: number | string | null;
  ppc_units: number | string | null;
  ppc_impressions: number | string | null;
  ppc_clicks: number | string | null;
  sessions: number | string | null;
  organic_orders: number | string | null;
  organic_units: number | string | null;
  profits: number | string | null;
  payout: number | string | null;
  cost_of_goods: number | string | null;
  referral_fees: number | string | null;
  fulfillment_fees: number | string | null;
  refund_cost: number | string | null;
  promotion_value: number | string | null;
};

type AsinOption = {
  asin: string;
  label: string;
};

export type SalesDailyPoint = {
  date: string;
  sales: number;
  orders: number;
  units: number;
  ppc_cost: number;
  ppc_sales: number;
  ppc_orders: number;
  ppc_units: number;
  ppc_impressions: number;
  ppc_clicks: number;
  sessions: number;
  organic_orders: number;
  organic_units: number;
  avg_sales_price: number | null;
  avg_price: number | null;
  profits?: number | null;
  payout?: number | null;
  cost_of_goods?: number | null;
  referral_fees?: number | null;
  fulfillment_fees?: number | null;
  refund_cost?: number | null;
  promotion_value?: number | null;
  tacos: number | null;
  acos: number | null;
  ctr: number | null;
  cost_per_click: number | null;
  ppc_cost_per_order: number | null;
  margin?: number | null;
};

type SalesDailyKpis = {
  sales: number;
  orders: number;
  units: number;
  ppc_cost: number;
  ppc_sales: number;
  ppc_orders: number;
  ppc_units: number;
  ppc_impressions: number;
  ppc_clicks: number;
  sessions: number;
  organic_orders: number;
  organic_units: number;
  avg_sales_price: number | null;
  avg_price: number | null;
  profits?: number | null;
  payout?: number | null;
  cost_of_goods?: number | null;
  referral_fees?: number | null;
  fulfillment_fees?: number | null;
  refund_cost?: number | null;
  promotion_value?: number | null;
  tacos: number | null;
  acos: number | null;
  ctr: number | null;
  cost_per_click: number | null;
  ppc_cost_per_order: number | null;
  margin?: number | null;
};

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

const fetchAsinOptions = async (
  accountId: string,
  marketplace: string
): Promise<AsinOption[]> => {
  const { data: products, error } = await supabaseAdmin
    .from('products')
    .select('asin,title')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .order('asin', { ascending: true })
    .limit(500);

  if (!error && products && products.length > 0) {
    return products
      .filter((row) => row.asin)
      .map((row) => ({
        asin: row.asin,
        label: row.title ? `${row.asin} — ${row.title}` : row.asin,
      }));
  }

  const { data: salesRows } = await supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select('asin')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .not('asin', 'is', null)
    .order('asin', { ascending: true })
    .limit(2000);

  const seen = new Set<string>();
  const options: AsinOption[] = [];
  (salesRows ?? []).forEach((row) => {
    if (!row.asin) return;
    if (seen.has(row.asin)) return;
    seen.add(row.asin);
    options.push({ asin: row.asin, label: row.asin });
  });

  return options;
};

export const getSalesDaily = async ({
  accountId,
  marketplace,
  start,
  end,
  asin,
}: SalesDailyFilters) => {
  const asinOptions = await fetchAsinOptions(accountId, marketplace);

  let query = supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select(
      [
        'date',
        'asin',
        'sales',
        'orders',
        'units',
        'ppc_cost',
        'ppc_sales',
        'ppc_orders',
        'ppc_units',
        'ppc_impressions',
        'ppc_clicks',
        'sessions',
        'organic_orders',
        'organic_units',
        'profits',
        'payout',
        'cost_of_goods',
        'referral_fees',
        'fulfillment_fees',
        'refund_cost',
        'promotion_value',
      ].join(',')
    )
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .limit(10000);

  if (asin !== 'all') {
    query = query.eq('asin', asin);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load sales trend data: ${error.message}`);
  }

  const rows = (data ?? []) as unknown as SalesRow[];

  const dailyMap = new Map<
    string,
    {
      date: string;
      sales: number;
      orders: number;
      units: number;
      ppc_cost: number;
      ppc_sales: number;
      ppc_orders: number;
      ppc_units: number;
      ppc_impressions: number;
      ppc_clicks: number;
      sessions: number;
      organic_orders: number;
      organic_units: number;
      profits: number;
      payout: number;
      cost_of_goods: number;
      referral_fees: number;
      fulfillment_fees: number;
      refund_cost: number;
      promotion_value: number;
    }
  >();

  let totalSales = 0;
  let totalOrders = 0;
  let totalUnits = 0;
  let totalPpcCost = 0;
  let totalPpcSales = 0;
  let totalPpcOrders = 0;
  let totalPpcUnits = 0;
  let totalPpcClicks = 0;
  let totalPpcImpressions = 0;
  let totalSessions = 0;
  let totalOrganicOrders = 0;
  let totalOrganicUnits = 0;
  let totalProfits = 0;
  let totalPayout = 0;
  let totalCostOfGoods = 0;
  let totalReferralFees = 0;
  let totalFulfillmentFees = 0;
  let totalRefundCost = 0;
  let totalPromotionValue = 0;

  let profitSeen = false;
  let payoutSeen = false;
  let costOfGoodsSeen = false;
  let referralFeesSeen = false;
  let fulfillmentFeesSeen = false;
  let refundCostSeen = false;
  let promotionValueSeen = false;

  rows.forEach((row) => {
    if (!row.date) return;
    const dateKey = row.date;

    const sales = numberValue(row.sales);
    const orders = numberValue(row.orders);
    const units = numberValue(row.units);
    const ppcCost = numberValue(row.ppc_cost);
    const ppcSales = numberValue(row.ppc_sales);
    const ppcOrders = numberValue(row.ppc_orders);
    const ppcUnits = numberValue(row.ppc_units);
    const ppcClicks = numberValue(row.ppc_clicks);
    const ppcImpressions = numberValue(row.ppc_impressions);
    const sessions = numberValue(row.sessions);
    const organicOrders = numberValue(row.organic_orders);
    const organicUnits = numberValue(row.organic_units);

    const existing = dailyMap.get(dateKey) ?? {
      date: dateKey,
      sales: 0,
      orders: 0,
      units: 0,
      ppc_cost: 0,
      ppc_sales: 0,
      ppc_orders: 0,
      ppc_units: 0,
      ppc_impressions: 0,
      ppc_clicks: 0,
      sessions: 0,
      organic_orders: 0,
      organic_units: 0,
      profits: 0,
      payout: 0,
      cost_of_goods: 0,
      referral_fees: 0,
      fulfillment_fees: 0,
      refund_cost: 0,
      promotion_value: 0,
    };

    existing.sales += sales;
    existing.orders += orders;
    existing.units += units;
    existing.ppc_cost += ppcCost;
    existing.ppc_sales += ppcSales;
    existing.ppc_orders += ppcOrders;
    existing.ppc_units += ppcUnits;
    existing.ppc_clicks += ppcClicks;
    existing.ppc_impressions += ppcImpressions;
    existing.sessions += sessions;
    existing.organic_orders += organicOrders;
    existing.organic_units += organicUnits;

    if (row.profits !== null && row.profits !== undefined) {
      existing.profits += numberValue(row.profits);
      profitSeen = true;
    }

    if (row.payout !== null && row.payout !== undefined) {
      existing.payout += numberValue(row.payout);
      payoutSeen = true;
    }

    if (row.cost_of_goods !== null && row.cost_of_goods !== undefined) {
      existing.cost_of_goods += numberValue(row.cost_of_goods);
      costOfGoodsSeen = true;
    }

    if (row.referral_fees !== null && row.referral_fees !== undefined) {
      existing.referral_fees += numberValue(row.referral_fees);
      referralFeesSeen = true;
    }

    if (row.fulfillment_fees !== null && row.fulfillment_fees !== undefined) {
      existing.fulfillment_fees += numberValue(row.fulfillment_fees);
      fulfillmentFeesSeen = true;
    }

    if (row.refund_cost !== null && row.refund_cost !== undefined) {
      existing.refund_cost += numberValue(row.refund_cost);
      refundCostSeen = true;
    }

    if (row.promotion_value !== null && row.promotion_value !== undefined) {
      existing.promotion_value += numberValue(row.promotion_value);
      promotionValueSeen = true;
    }

    dailyMap.set(dateKey, existing);

    totalSales += sales;
    totalOrders += orders;
    totalUnits += units;
    totalPpcCost += ppcCost;
    totalPpcSales += ppcSales;
    totalPpcOrders += ppcOrders;
    totalPpcUnits += ppcUnits;
    totalPpcClicks += ppcClicks;
    totalPpcImpressions += ppcImpressions;
    totalSessions += sessions;
    totalOrganicOrders += organicOrders;
    totalOrganicUnits += organicUnits;

    if (row.profits !== null && row.profits !== undefined) {
      totalProfits += numberValue(row.profits);
    }

    if (row.payout !== null && row.payout !== undefined) {
      totalPayout += numberValue(row.payout);
    }

    if (row.cost_of_goods !== null && row.cost_of_goods !== undefined) {
      totalCostOfGoods += numberValue(row.cost_of_goods);
    }

    if (row.referral_fees !== null && row.referral_fees !== undefined) {
      totalReferralFees += numberValue(row.referral_fees);
    }

    if (row.fulfillment_fees !== null && row.fulfillment_fees !== undefined) {
      totalFulfillmentFees += numberValue(row.fulfillment_fees);
    }

    if (row.refund_cost !== null && row.refund_cost !== undefined) {
      totalRefundCost += numberValue(row.refund_cost);
    }

    if (row.promotion_value !== null && row.promotion_value !== undefined) {
      totalPromotionValue += numberValue(row.promotion_value);
    }
  });

  const dailySeries: SalesDailyPoint[] = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const avgSalesPrice = row.units > 0 ? row.sales / row.units : null;

      const result: SalesDailyPoint = {
        date: row.date,
        sales: row.sales,
        orders: row.orders,
        units: row.units,
        ppc_cost: row.ppc_cost,
        ppc_sales: row.ppc_sales,
        ppc_orders: row.ppc_orders,
        ppc_units: row.ppc_units,
        ppc_impressions: row.ppc_impressions,
        ppc_clicks: row.ppc_clicks,
        sessions: row.sessions,
        organic_orders: row.organic_orders,
        organic_units: row.organic_units,
        avg_sales_price: avgSalesPrice,
        avg_price: avgSalesPrice,
        tacos: safeRatio(row.ppc_cost, row.sales),
        acos: safeRatio(row.ppc_cost, row.ppc_sales),
        ctr: safeRatio(row.ppc_clicks, row.ppc_impressions),
        cost_per_click: safeRatio(row.ppc_cost, row.ppc_clicks),
        ppc_cost_per_order: safeRatio(row.ppc_cost, row.ppc_orders),
      };

      if (profitSeen) {
        result.profits = row.profits;
        result.margin = safeRatio(row.profits, row.sales);
      }

      if (payoutSeen) {
        result.payout = row.payout;
      }

      if (costOfGoodsSeen) {
        result.cost_of_goods = row.cost_of_goods;
      }

      if (referralFeesSeen) {
        result.referral_fees = row.referral_fees;
      }

      if (fulfillmentFeesSeen) {
        result.fulfillment_fees = row.fulfillment_fees;
      }

      if (refundCostSeen) {
        result.refund_cost = row.refund_cost;
      }

      if (promotionValueSeen) {
        result.promotion_value = row.promotion_value;
      }

      return result;
    });

  const avgSalesPriceTotal = totalUnits > 0 ? totalSales / totalUnits : null;

  const kpis: SalesDailyKpis = {
    sales: totalSales,
    orders: totalOrders,
    units: totalUnits,
    ppc_cost: totalPpcCost,
    ppc_sales: totalPpcSales,
    ppc_orders: totalPpcOrders,
    ppc_units: totalPpcUnits,
    ppc_impressions: totalPpcImpressions,
    ppc_clicks: totalPpcClicks,
    sessions: totalSessions,
    organic_orders: totalOrganicOrders,
    organic_units: totalOrganicUnits,
    avg_sales_price: avgSalesPriceTotal,
    avg_price: avgSalesPriceTotal,
    tacos: safeRatio(totalPpcCost, totalSales),
    acos: safeRatio(totalPpcCost, totalPpcSales),
    ctr: safeRatio(totalPpcClicks, totalPpcImpressions),
    cost_per_click: safeRatio(totalPpcCost, totalPpcClicks),
    ppc_cost_per_order: safeRatio(totalPpcCost, totalPpcOrders),
  };

  if (profitSeen) {
    kpis.profits = totalProfits;
    kpis.margin = safeRatio(totalProfits, totalSales);
  }

  if (payoutSeen) {
    kpis.payout = totalPayout;
  }

  if (costOfGoodsSeen) {
    kpis.cost_of_goods = totalCostOfGoods;
  }

  if (referralFeesSeen) {
    kpis.referral_fees = totalReferralFees;
  }

  if (fulfillmentFeesSeen) {
    kpis.fulfillment_fees = totalFulfillmentFees;
  }

  if (refundCostSeen) {
    kpis.refund_cost = totalRefundCost;
  }

  if (promotionValueSeen) {
    kpis.promotion_value = totalPromotionValue;
  }

  return {
    filters: { start, end, asin },
    asinOptions,
    dailySeries,
    kpis,
  };
};

export type SalesDailyData = Awaited<ReturnType<typeof getSalesDaily>>;
