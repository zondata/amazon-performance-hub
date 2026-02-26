import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { fetchAsinOptions } from '@/lib/products/fetchAsinOptions';

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
  product_id: string;
  asin: string | null;
  title: string | null;
};

type ProfileRow = {
  product_id: string;
  profile_json: unknown | null;
};

type ProductKpiRow = {
  asin: string;
  title?: string | null;
  short_name?: string | null;
  display_name?: string | null;
  sales: number;
  orders: number;
  units: number;
  ppc_cost: number;
  ppc_sales: number;
  avg_sales_price: number | null;
  tacos: number | null;
  acos: number | null;
};

const SALES_PAGE_SIZE = 5000;
const SALES_HARD_CAP = 250000;
const PRODUCTS_PAGE_SIZE = 1000;
const PRODUCT_PROFILE_CHUNK_SIZE = 500;

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric;
};

const parseShortName = (value: unknown): string | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const shortName = (value as Record<string, unknown>).short_name;
  return typeof shortName === 'string' && shortName.trim().length > 0
    ? shortName.trim()
    : null;
};

export const getProductsData = async ({
  accountId,
  marketplace,
  start,
  end,
  asinFilter,
}: ProductsFilters) => {
  const warnings: string[] = [];
  const asinOptions = await fetchAsinOptions(accountId, marketplace);
  const productTitleByAsin = new Map<string, string>();
  const productShortNameByAsin = new Map<string, string>();

  try {
    const productRows: ProductRow[] = [];
    for (let pageIndex = 0; ; pageIndex += 1) {
      const from = pageIndex * PRODUCTS_PAGE_SIZE;
      const to = from + PRODUCTS_PAGE_SIZE - 1;
      const { data: pageData, error: pageError } = await supabaseAdmin
        .from('products')
        .select('product_id,asin,title')
        .eq('account_id', accountId)
        .eq('marketplace', marketplace)
        .order('asin', { ascending: true })
        .range(from, to);

      if (pageError) {
        warnings.push(`Could not load full product metadata: ${pageError.message}`);
        break;
      }

      const pageRows = (pageData ?? []) as ProductRow[];
      productRows.push(...pageRows);
      if (pageRows.length < PRODUCTS_PAGE_SIZE) {
        break;
      }
    }

    if (productRows.length > 0) {
      const productIds = productRows.map((row) => row.product_id);

      productRows.forEach((row) => {
        if (!row.asin) return;
        productTitleByAsin.set(row.asin, row.title ?? '');
      });

      const asinByProductId = new Map<string, string>();
      productRows.forEach((row) => {
        if (!row.asin) return;
        asinByProductId.set(row.product_id, row.asin);
      });

      for (let index = 0; index < productIds.length; index += PRODUCT_PROFILE_CHUNK_SIZE) {
        const chunk = productIds.slice(index, index + PRODUCT_PROFILE_CHUNK_SIZE);
        if (chunk.length === 0) continue;

        try {
          const { data: profiles, error: profileError } = await supabaseAdmin
            .from('product_profile')
            .select('product_id,profile_json')
            .in('product_id', chunk);

          if (profileError) {
            warnings.push(`Could not load full product profile metadata: ${profileError.message}`);
            continue;
          }

          (profiles as ProfileRow[] | null)?.forEach((profile) => {
            const asin = asinByProductId.get(profile.product_id);
            if (!asin) return;
            const shortName = parseShortName(profile.profile_json);
            if (shortName) {
              productShortNameByAsin.set(asin, shortName);
            }
          });
        } catch {
          // ignore
        }
      }
    }
  } catch {
    // ignore and fallback to sales data
  }

  const rows: SalesRow[] = [];
  let reachedSalesHardCap = false;
  for (let pageIndex = 0; ; pageIndex += 1) {
    const from = pageIndex * SALES_PAGE_SIZE;
    const to = from + SALES_PAGE_SIZE - 1;

    let query = supabaseAdmin
      .from('si_sales_trend_daily_latest')
      .select('asin,sales,orders,units,ppc_cost,ppc_sales,avg_sales_price')
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true })
      .order('asin', { ascending: true })
      .range(from, to);

    if (asinFilter !== 'all') {
      query = query.eq('asin', asinFilter);
    }

    const { data: pageRowsData, error: pageError } = await query;
    if (pageError) {
      throw new Error(`Failed to load product KPIs: ${pageError.message}`);
    }

    const pageRows = (pageRowsData ?? []) as SalesRow[];
    rows.push(...pageRows);

    if (rows.length >= SALES_HARD_CAP) {
      reachedSalesHardCap = true;
      rows.length = SALES_HARD_CAP;
      break;
    }

    if (pageRows.length < SALES_PAGE_SIZE) {
      break;
    }
  }

  if (reachedSalesHardCap) {
    warnings.push(
      `Sales rows reached hard cap (${SALES_HARD_CAP.toLocaleString('en-US')}). Results may be truncated.`
    );
  }

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
    const acos = row.ppc_sales > 0 ? row.ppc_cost / row.ppc_sales : null;
    const shortName = productShortNameByAsin.get(row.asin);
    const title = productTitleByAsin.get(row.asin);
    return {
      asin: row.asin,
      title,
      short_name: shortName,
      display_name: shortName || title || row.asin,
      sales: row.sales,
      orders: row.orders,
      units: row.units,
      ppc_cost: row.ppc_cost,
      ppc_sales: row.ppc_sales,
      avg_sales_price: avgPrice,
      tacos,
      acos,
    };
  });

  productRows.sort((a, b) => b.sales - a.sales);

  return {
    asinOptions,
    products: productRows,
    warnings,
  };
};

export type ProductsData = Awaited<ReturnType<typeof getProductsData>>;
