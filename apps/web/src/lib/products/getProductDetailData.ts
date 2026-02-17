import 'server-only';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

type DetailFilters = {
  accountId: string;
  marketplace: string;
  asin: string;
  start: string;
  end: string;
};

type SalesRow = {
  date: string | null;
  sales: number | string | null;
  orders: number | string | null;
  units: number | string | null;
  ppc_cost: number | string | null;
  ppc_sales: number | string | null;
  avg_sales_price: number | string | null;
};

type ProductMeta = {
  product_id?: string;
  asin: string;
  title?: string | null;
  brand?: string | null;
  profile_json?: unknown | null;
};

type SkuRow = {
  sku_id: string;
  sku: string;
  status: string;
  is_bundle: boolean;
};

type CostRow = {
  sku: string | null;
  currency: string | null;
  landed_cost_per_unit: number | string | null;
  valid_from: string | null;
  valid_to: string | null;
  notes: string | null;
};

type CostHistoryRow = {
  sku_id: string | null;
  valid_from: string | null;
  valid_to: string | null;
  currency: string | null;
  landed_cost_per_unit: number | string | null;
  supplier_cost: number | string | null;
  created_at: string | null;
};

type LogChange = {
  change_id: string;
  occurred_at: string;
  change_type: string;
  summary: string;
  why: string | null;
  source: string;
};

type LogEntity = {
  change_id: string;
  note: string | null;
  created_at: string;
  entity_type: string;
  extra: unknown | null;
};

type CombinedLog = LogChange & { note?: string | null; entity_type?: string };

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric;
};

export const getProductDetailData = async ({
  accountId,
  marketplace,
  asin,
  start,
  end,
}: DetailFilters) => {
  const productMeta: ProductMeta = { asin };
  let skuRows: SkuRow[] = [];
  let currentCosts: CostRow[] = [];
  let costHistory: CostHistoryRow[] = [];

  let productId: string | undefined;

  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('product_id,asin,title,brand')
      .eq('account_id', accountId)
      .eq('marketplace', marketplace)
      .eq('asin', asin)
      .maybeSingle();

    if (!error && data) {
      productId = data.product_id;
      productMeta.product_id = data.product_id;
      productMeta.title = data.title ?? null;
      productMeta.brand = data.brand ?? null;
    }
  } catch {
    // ignore
  }

  if (productId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('product_profile')
        .select('profile_json')
        .eq('product_id', productId)
        .maybeSingle();

      if (!error && data) {
        productMeta.profile_json = data.profile_json ?? null;
      }
    } catch {
      // ignore
    }
  }

  if (productId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('product_skus')
        .select('sku_id,sku,status,is_bundle')
        .eq('account_id', accountId)
        .eq('marketplace', marketplace)
        .eq('product_id', productId)
        .order('sku', { ascending: true });

      if (!error && data) {
        skuRows = data as SkuRow[];
      }
    } catch {
      // ignore
    }
  }

  if (productId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('v_product_sku_cost_current')
        .select('sku,currency,landed_cost_per_unit,valid_from,valid_to,notes')
        .eq('account_id', accountId)
        .eq('marketplace', marketplace)
        .eq('product_id', productId)
        .order('sku', { ascending: true });

      if (!error && data) {
        currentCosts = data as CostRow[];
      }
    } catch {
      // ignore
    }
  }

  if (skuRows.length > 0) {
    const skuIds = skuRows.map((row) => row.sku_id);
    try {
      const { data, error } = await supabaseAdmin
        .from('product_cost_history')
        .select('sku_id,valid_from,valid_to,currency,landed_cost_per_unit,supplier_cost,created_at')
        .in('sku_id', skuIds)
        .order('valid_from', { ascending: false })
        .limit(200);

      if (!error && data) {
        costHistory = data as CostHistoryRow[];
      }
    } catch {
      // ignore
    }
  }

  const { data: salesRows, error: salesError } = await supabaseAdmin
    .from('si_sales_trend_daily_latest')
    .select('date,sales,orders,units,ppc_cost,ppc_sales,avg_sales_price')
    .eq('account_id', accountId)
    .eq('marketplace', marketplace)
    .eq('asin', asin)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })
    .limit(5000);

  if (salesError) {
    throw new Error(`Failed to load sales series: ${salesError.message}`);
  }

  const salesSeries = (salesRows ?? []) as SalesRow[];

  let totalSales = 0;
  let totalOrders = 0;
  let totalUnits = 0;
  let totalPpcCost = 0;
  let weightedPriceTotal = 0;
  let weightedUnitsTotal = 0;

  salesSeries.forEach((row) => {
    const units = numberValue(row.units);
    totalSales += numberValue(row.sales);
    totalOrders += numberValue(row.orders);
    totalUnits += units;
    totalPpcCost += numberValue(row.ppc_cost);

    if (row.avg_sales_price !== null && row.avg_sales_price !== undefined) {
      weightedPriceTotal += numberValue(row.avg_sales_price) * units;
      weightedUnitsTotal += units;
    }
  });

  const avgSellingPrice =
    weightedUnitsTotal > 0 ? weightedPriceTotal / weightedUnitsTotal : null;
  const tacos = totalSales > 0 ? totalPpcCost / totalSales : null;

  let logbook: CombinedLog[] = [];
  try {
    const { data: entities, error: entityError } = await supabaseAdmin
      .from('log_change_entities')
      .select('change_id,note,created_at,entity_type,extra')
      .eq('product_id', asin)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!entityError && entities && entities.length > 0) {
      const entityRows = entities as LogEntity[];
      const changeIds = Array.from(new Set(entityRows.map((row) => row.change_id)));
      const { data: changes, error: changeError } = await supabaseAdmin
        .from('log_changes')
        .select('change_id,occurred_at,change_type,summary,why,source')
        .eq('account_id', accountId)
        .eq('marketplace', marketplace)
        .in('change_id', changeIds)
        .order('occurred_at', { ascending: false })
        .limit(200);

      if (!changeError && changes) {
        const changeMap = new Map(
          (changes as LogChange[]).map((row) => [row.change_id, row])
        );
        logbook = entityRows
          .map((entity) => {
            const change = changeMap.get(entity.change_id);
            if (!change) return null;
            return {
              ...change,
              note: entity.note ?? null,
              entity_type: entity.entity_type,
            } as CombinedLog;
          })
          .filter((row): row is CombinedLog => Boolean(row))
          .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
      }
    }
  } catch {
    // ignore
  }

  return {
    productMeta,
    skuRows,
    currentCosts,
    costHistory,
    salesSeries,
    kpis: {
      total_sales: totalSales,
      total_orders: totalOrders,
      total_units: totalUnits,
      total_ppc_cost: totalPpcCost,
      avg_selling_price: avgSellingPrice,
      tacos,
    },
    logbook,
  };
};

export type ProductDetailData = Awaited<ReturnType<typeof getProductDetailData>>;
