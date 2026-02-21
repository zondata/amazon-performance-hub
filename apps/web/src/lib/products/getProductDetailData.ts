import 'server-only';

import {
  buildProductLogbookViewModel,
  ProductLogbookChangeRow,
  ProductLogbookEntityRow,
  ProductLogbookEvaluationRow,
  ProductLogbookExperimentLinkRow,
  ProductLogbookExperimentRow,
  ProductLogbookViewModel,
} from '@/lib/logbook/buildProductLogbookViewModel';
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
  short_name?: string | null;
  notes?: string | null;
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

type CombinedLog = Omit<ProductLogbookChangeRow, 'before_json' | 'after_json' | 'created_at'> & {
  note?: string | null;
  entity_type?: string;
};

const numberValue = (value: number | string | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric;
};

const parseProfile = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
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
        const parsed = parseProfile(data.profile_json);
        productMeta.short_name =
          typeof parsed?.short_name === 'string' ? parsed.short_name : null;
        productMeta.notes = typeof parsed?.notes === 'string' ? parsed.notes : null;
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
  let logbookViewModel: ProductLogbookViewModel = {
    experiments: [],
    unassigned: [],
  };
  try {
    const { data: productEntities, error: productEntityError } = await supabaseAdmin
      .from('log_change_entities')
      .select('change_id')
      .eq('product_id', asin)
      .order('created_at', { ascending: false })
      .limit(200);

    if (!productEntityError && productEntities && productEntities.length > 0) {
      const changeIds = Array.from(
        new Set((productEntities as Array<{ change_id: string }>).map((row) => row.change_id))
      );

      const { data: changes, error: changeError } = await supabaseAdmin
        .from('log_changes')
        .select(
          'change_id,occurred_at,channel,change_type,summary,why,source,before_json,after_json,created_at'
        )
        .eq('account_id', accountId)
        .eq('marketplace', marketplace)
        .in('change_id', changeIds)
        .order('occurred_at', { ascending: false })
        .limit(200);

      if (!changeError && changes && changes.length > 0) {
        const changeRows = changes as ProductLogbookChangeRow[];

        const { data: allEntities, error: allEntitiesError } = await supabaseAdmin
          .from('log_change_entities')
          .select(
            'change_entity_id,change_id,entity_type,product_id,campaign_id,ad_group_id,target_id,keyword_id,note,extra,created_at'
          )
          .in('change_id', changeIds)
          .order('created_at', { ascending: false });

        const entityRows = !allEntitiesError
          ? ((allEntities ?? []) as ProductLogbookEntityRow[])
          : [];

        const { data: experimentLinks, error: experimentLinksError } = await supabaseAdmin
          .from('log_experiment_changes')
          .select('experiment_change_id,experiment_id,change_id,created_at')
          .in('change_id', changeIds);

        const experimentLinkRows = !experimentLinksError
          ? ((experimentLinks ?? []) as ProductLogbookExperimentLinkRow[])
          : [];

        const experimentIds = Array.from(
          new Set(experimentLinkRows.map((row) => row.experiment_id))
        );

        let experimentRows: ProductLogbookExperimentRow[] = [];
        let evaluationRows: ProductLogbookEvaluationRow[] = [];

        if (experimentIds.length > 0) {
          const { data: experiments, error: experimentsError } = await supabaseAdmin
            .from('log_experiments')
            .select(
              'experiment_id,name,objective,hypothesis,evaluation_lag_days,evaluation_window_days,primary_metrics,guardrails,scope,created_at'
            )
            .eq('account_id', accountId)
            .eq('marketplace', marketplace)
            .in('experiment_id', experimentIds)
            .limit(200);

          if (!experimentsError && experiments) {
            experimentRows = experiments as ProductLogbookExperimentRow[];
          }

          const { data: evaluations, error: evaluationsError } = await supabaseAdmin
            .from('log_evaluations')
            .select(
              'evaluation_id,experiment_id,evaluated_at,window_start,window_end,metrics_json,notes,created_at'
            )
            .eq('account_id', accountId)
            .eq('marketplace', marketplace)
            .in('experiment_id', experimentIds)
            .order('evaluated_at', { ascending: false })
            .limit(200);

          if (!evaluationsError && evaluations) {
            evaluationRows = evaluations as ProductLogbookEvaluationRow[];
          }
        }

        logbookViewModel = buildProductLogbookViewModel({
          changes: changeRows,
          entities: entityRows,
          experimentLinks: experimentLinkRows,
          experiments: experimentRows,
          evaluations: evaluationRows,
        });

        const deduped = new Map<string, CombinedLog>();
        const flattened = [
          ...logbookViewModel.experiments.flatMap((group) => group.changes),
          ...logbookViewModel.unassigned,
        ];

        for (const item of flattened) {
          if (deduped.has(item.change.change_id)) continue;
          const firstEntity = item.entities[0];
          deduped.set(item.change.change_id, {
            change_id: item.change.change_id,
            occurred_at: item.change.occurred_at,
            channel: item.change.channel,
            change_type: item.change.change_type,
            summary: item.change.summary,
            why: item.change.why,
            source: item.change.source,
            note: firstEntity?.note ?? null,
            entity_type: firstEntity?.entity_type,
          });
        }

        logbook = Array.from(deduped.values()).sort((a, b) =>
          b.occurred_at.localeCompare(a.occurred_at)
        );
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
    logbookViewModel,
    logbook,
  };
};

export type ProductDetailData = Awaited<ReturnType<typeof getProductDetailData>>;
