import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type ProductsFilters = {
  accountId: string;
  marketplace: string;
  start: string;
  end: string;
  asinFilter: string;
};

type SalesRow = {
  asin: string | null;
  sales: number | string | null;
  orders: number | string | null;
  units: number | string | null;
  ppc_cost: number | string | null;
  ppc_sales: number | string | null;
  avg_sales_price: number | string | null;
};

type ProductRow = {
  asin: string | null;
  title: string | null;
};

type ProductKpiRow = {
  asin: string;
  title?: string | null;
  sales: number;
  orders: number;
  units: number;
  ppc_cost: number;
  ppc_sales: number;
  avg_sales_price: number | null;
  tacos: number | null;
};

type AsinOption = {
  asin: string;
  label: string;
};

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric;
};

const safeLabel = (asin: string, title?: string | null) =>
  title ? `${asin} — ${title}` : asin;

export const getProductsData = async ({
  accountId,
  marketplace,
  start,
  end,
  asinFilter,
}: ProductsFilters) => {
  let asinOptions: AsinOption[] = [];
  const productTitleByAsin = new Map<string, string>();

  try {
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('asin,title')
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .order('asin', { ascending: true })
      .limit(500);

    if (!error && products && products.length > 0) {
      asinOptions = (products as ProductRow[])
        .filter((row) => row.asin)
        .map((row) => {
          productTitleByAsin.set(row.asin as string, row.title ?? '');
          return {
            asin: row.asin as string,
            label: safeLabel(row.asin as string, row.title),
          };
        });
    }
  } catch {
    // ignore and fallback to sales data
  }

  if (asinOptions.length === 0) {
    const { data: salesRows } = await supabaseAdmin
      .from('si_sales_trend_daily_latest')
      .select('asin')
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .not('asin', 'is', null)
      .order('asin', { ascending: true })
      .limit(2000);

    const seen = new Set<string>();
    (salesRows ?? []).forEach((row) => {
      if (!row.asin) return;
      if (seen.has(row.asin)) return;
      seen.add(row.asin);
      asinOptions.push({ asin: row.asin, label: row.asin });
    });
  }

  let query = supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select('asin,sales,orders,units,ppc_cost,ppc_sales,avg_sales_price')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .gte('date', start)
    .lte('date', end)
    .limit(5000);

  if (asinFilter !== 'all') {
    query = query.eq('asin', asinFilter);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to load product KPIs: ${error.message}`);
  }

  const rows = (data ?? []) as SalesRow[];
  const byAsin = new Map<
    string,
    {
      asin: string;
      sales: number;
      orders: number;
      units: number;
      ppc_cost: number;
      ppc_sales: number;
      weighted_price_total: number;
      weighted_units_total: number;
    }
  >();

  rows.forEach((row) => {
    if (!row.asin) return;
    const key = row.asin;
    const existing = byAsin.get(key) ?? {
      asin: key,
      sales: 0,
      orders: 0,
      units: 0,
      ppc_cost: 0,
      ppc_sales: 0,
      weighted_price_total: 0,
      weighted_units_total: 0,
    };

    const units = numberValue(row.units);
    existing.sales += numberValue(row.sales);
    existing.orders += numberValue(row.orders);
    existing.units += units;
    existing.ppc_cost += numberValue(row.ppc_cost);
    existing.ppc_sales += numberValue(row.ppc_sales);

    if (row.avg_sales_price !== null && row.avg_sales_price !== undefined) {
      existing.weighted_price_total += numberValue(row.avg_sales_price) * units;
      existing.weighted_units_total += units;
    }

    byAsin.set(key, existing);
  });

  const productRows: ProductKpiRow[] = Array.from(byAsin.values()).map((row) => {
    const avgPrice =
      row.weighted_units_total > 0
        ? row.weighted_price_total / row.weighted_units_total
        : null;
    const tacos = row.sales > 0 ? row.ppc_cost / row.sales : null;
    return {
      asin: row.asin,
      title: productTitleByAsin.get(row.asin),
      sales: row.sales,
      orders: row.orders,
      units: row.units,
      ppc_cost: row.ppc_cost,
      ppc_sales: row.ppc_sales,
      avg_sales_price: avgPrice,
      tacos,
    };
  });

  productRows.sort((a, b) => b.sales - a.sales);

  return {
    asinOptions,
    products: productRows,
  };
};

export type ProductsData = Awaited<ReturnType<typeof getProductsData>>;
