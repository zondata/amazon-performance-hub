import 'server-only';

import { env } from '@/lib/env';
import { normalizeOutcomeScorePercent } from '@/lib/logbook/outcomePill';
import { fetchAllRows } from '@/lib/supabaseFetchAll';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { extractOutcomeScore } from './parseLogbookAiPack';
import {
  AccountBaselineDataPack,
  buildAccountBaselineDataPack,
} from './accountBaselinePack';

type SalesRow = {
  asin: string | null;
  date: string | null;
  sales: number | string | null;
  orders: number | string | null;
  units: number | string | null;
  ppc_cost: number | string | null;
};

type AdsRow = {
  date: string | null;
  spend: number | string | null;
  sales: number | string | null;
};

type ProductRow = {
  product_id: string;
  asin: string | null;
  title: string | null;
};

type ProductProfileRow = {
  product_id: string;
  profile_json: unknown | null;
};

type ExperimentRow = {
  experiment_id: string;
  name: string;
  scope: unknown | null;
  created_at: string;
};

type EvaluationRow = {
  experiment_id: string;
  evaluated_at: string;
  metrics_json: unknown | null;
};

type ChangeRow = {
  change_id: string;
};

type ValidationRow = {
  change_id: string;
  status: 'pending' | 'validated' | 'mismatch' | 'not_found';
  checked_at: string;
};

type UploadStatRow = {
  source_type: string | null;
  exported_at: string | null;
  ingested_at: string | null;
  snapshot_date: string | null;
  coverage_start: string | null;
  coverage_end: string | null;
  row_count: number | string | null;
};

type ProductAggregate = {
  asin: string;
  revenueLast30: number;
  revenueLast90: number;
  revenuePrev30: number;
  ordersLast30: number;
  ordersPrev30: number;
  unitsLast30: number;
  unitsPrev30: number;
};

const TOP_PRODUCTS_LIMIT = 25;

const toDateString = (value: Date) => value.toISOString().slice(0, 10);

const dayOffset = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return toDateString(date);
};

const inWindow = (date: string, start: string, end: string) => date >= start && date <= end;

const num = (value: number | string | null | undefined): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const pctDelta = (current: number, previous: number): number | null => {
  if (!Number.isFinite(previous) || previous === 0) return null;
  return (current - previous) / previous;
};

const parseScopeString = (scope: unknown, key: string) => {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) return null;
  const value = (scope as Record<string, unknown>)[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const parseShortName = (profileJson: unknown): string | null => {
  if (!profileJson || typeof profileJson !== 'object' || Array.isArray(profileJson)) return null;
  const shortName = (profileJson as Record<string, unknown>).short_name;
  if (typeof shortName !== 'string') return null;
  const trimmed = shortName.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const calcAcos = (spend: number, sales: number) => (sales > 0 ? spend / sales : null);
const calcRoas = (spend: number, sales: number) => (spend > 0 ? sales / spend : null);

const latestStamp = (row: UploadStatRow): Date | null => {
  if (row.exported_at) {
    const parsed = new Date(row.exported_at);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (row.snapshot_date) {
    const parsed = new Date(`${row.snapshot_date}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  if (row.ingested_at) {
    const parsed = new Date(row.ingested_at);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
};

const isMoreRecent = (candidate: UploadStatRow, existing: UploadStatRow): boolean => {
  const left = latestStamp(candidate);
  const right = latestStamp(existing);
  if (left && right) return left.getTime() > right.getTime();
  if (left) return true;
  return false;
};

const chunk = <T,>(items: T[], size: number): T[][] => {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
};

export const getAccountBaselineDataPack = async (): Promise<AccountBaselineDataPack> => {
  const windowLast30 = {
    start: dayOffset(-29),
    end: dayOffset(0),
    days: 30,
  };
  const windowLast90 = {
    start: dayOffset(-89),
    end: dayOffset(0),
    days: 90,
  };
  const windowPrev30 = {
    start: dayOffset(-59),
    end: dayOffset(-30),
    days: 30,
  };

  const [salesRows, spAdsRows, sbAdsRows, experimentsRows, uploadStatsRows, changesRows] =
    await Promise.all([
      fetchAllRows<SalesRow>((from, to) =>
        supabaseAdmin
          .from('si_sales_trend_daily_latest')
          .select('asin,date,sales,orders,units,ppc_cost')
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .gte('date', windowLast90.start)
          .lte('date', windowLast90.end)
          .range(from, to)
      ),
      fetchAllRows<AdsRow>((from, to) =>
        supabaseAdmin
          .from('sp_campaign_hourly_fact_latest')
          .select('date,spend,sales')
          .eq('account_id', env.accountId)
          .gte('date', windowLast90.start)
          .lte('date', windowLast90.end)
          .range(from, to)
      ),
      fetchAllRows<AdsRow>((from, to) =>
        supabaseAdmin
          .from('sb_campaign_daily_fact_latest')
          .select('date,spend,sales')
          .eq('account_id', env.accountId)
          .gte('date', windowLast90.start)
          .lte('date', windowLast90.end)
          .range(from, to)
      ),
      fetchAllRows<ExperimentRow>((from, to) =>
        supabaseAdmin
          .from('log_experiments')
          .select('experiment_id,name,scope,created_at')
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .order('created_at', { ascending: false })
          .range(from, to)
      ),
      fetchAllRows<UploadStatRow>((from, to) =>
        supabaseAdmin
          .from('upload_stats')
          .select('source_type,exported_at,ingested_at,snapshot_date,coverage_start,coverage_end,row_count')
          .eq('account_id', env.accountId)
          .range(from, to)
      ),
      fetchAllRows<ChangeRow>((from, to) =>
        supabaseAdmin
          .from('log_changes')
          .select('change_id')
          .eq('account_id', env.accountId)
          .eq('marketplace', env.marketplace)
          .gte('occurred_at', `${windowLast90.start}T00:00:00Z`)
          .lte('occurred_at', `${windowLast90.end}T23:59:59Z`)
          .range(from, to)
      ),
    ]);

  const salesTotals = {
    last30: { sales: 0, orders: 0, units: 0, ppc_cost: 0 },
    last90: { sales: 0, orders: 0, units: 0, ppc_cost: 0 },
  };

  const productByAsin = new Map<string, ProductAggregate>();
  for (const row of salesRows) {
    if (!row.asin || !row.date) continue;
    const asin = row.asin;
    const aggregate =
      productByAsin.get(asin) ??
      ({
        asin,
        revenueLast30: 0,
        revenueLast90: 0,
        revenuePrev30: 0,
        ordersLast30: 0,
        ordersPrev30: 0,
        unitsLast30: 0,
        unitsPrev30: 0,
      } as ProductAggregate);

    const sales = num(row.sales);
    const orders = num(row.orders);
    const units = num(row.units);
    const ppcCost = num(row.ppc_cost);

    if (inWindow(row.date, windowLast90.start, windowLast90.end)) {
      salesTotals.last90.sales += sales;
      salesTotals.last90.orders += orders;
      salesTotals.last90.units += units;
      salesTotals.last90.ppc_cost += ppcCost;
      aggregate.revenueLast90 += sales;
    }

    if (inWindow(row.date, windowLast30.start, windowLast30.end)) {
      salesTotals.last30.sales += sales;
      salesTotals.last30.orders += orders;
      salesTotals.last30.units += units;
      salesTotals.last30.ppc_cost += ppcCost;
      aggregate.revenueLast30 += sales;
      aggregate.ordersLast30 += orders;
      aggregate.unitsLast30 += units;
    }

    if (inWindow(row.date, windowPrev30.start, windowPrev30.end)) {
      aggregate.revenuePrev30 += sales;
      aggregate.ordersPrev30 += orders;
      aggregate.unitsPrev30 += units;
    }

    productByAsin.set(asin, aggregate);
  }

  const sortedProducts = Array.from(productByAsin.values()).sort((left, right) => {
    if (right.revenueLast30 !== left.revenueLast30) return right.revenueLast30 - left.revenueLast30;
    return right.revenueLast90 - left.revenueLast90;
  });
  const topProducts = sortedProducts.slice(0, TOP_PRODUCTS_LIMIT);

  const asins = topProducts.map((row) => row.asin);
  const productNameByAsin = new Map<string, string | null>();
  if (asins.length > 0) {
    const { data: productRows, error: productError } = await supabaseAdmin
      .from('products')
      .select('product_id,asin,title')
      .eq('account_id', env.accountId)
      .eq('marketplace', env.marketplace)
      .in('asin', asins);

    if (productError) {
      throw new Error(`Failed to load product names for baseline pack: ${productError.message}`);
    }

    const products = (productRows ?? []) as ProductRow[];
    const productIdByAsin = new Map<string, string>();
    const titleByAsin = new Map<string, string | null>();
    for (const row of products) {
      if (!row.asin) continue;
      productIdByAsin.set(row.asin, row.product_id);
      titleByAsin.set(row.asin, row.title ?? null);
    }

    const productIds = products.map((row) => row.product_id);
    let shortNameByProductId = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: profileRows, error: profileError } = await supabaseAdmin
        .from('product_profile')
        .select('product_id,profile_json')
        .in('product_id', productIds);

      if (profileError) {
        throw new Error(
          `Failed to load product profiles for baseline pack: ${profileError.message}`
        );
      }

      shortNameByProductId = new Map(
        ((profileRows ?? []) as ProductProfileRow[])
          .map((row) => [row.product_id, parseShortName(row.profile_json)] as const)
          .filter((entry): entry is readonly [string, string] => Boolean(entry[1]))
      );
    }

    for (const asin of asins) {
      const productId = productIdByAsin.get(asin);
      const shortName = productId ? shortNameByProductId.get(productId) : null;
      productNameByAsin.set(asin, shortName ?? titleByAsin.get(asin) ?? null);
    }
  }

  const aggregateAdsWindow = (rows: AdsRow[], start: string, end: string) => {
    const totals = rows.reduce(
      (acc, row) => {
        if (!row.date || !inWindow(row.date, start, end)) return acc;
        return {
          spend: acc.spend + num(row.spend),
          sales: acc.sales + num(row.sales),
        };
      },
      { spend: 0, sales: 0 }
    );
    return {
      spend: totals.spend,
      sales: totals.sales,
      acos: calcAcos(totals.spend, totals.sales),
      roas: calcRoas(totals.spend, totals.sales),
    };
  };

  const spLast30 = aggregateAdsWindow(spAdsRows, windowLast30.start, windowLast30.end);
  const sbLast30 = aggregateAdsWindow(sbAdsRows, windowLast30.start, windowLast30.end);
  const spLast90 = aggregateAdsWindow(spAdsRows, windowLast90.start, windowLast90.end);
  const sbLast90 = aggregateAdsWindow(sbAdsRows, windowLast90.start, windowLast90.end);

  const combineAds = (
    left: { spend: number; sales: number },
    right: { spend: number; sales: number }
  ) => {
    const spend = left.spend + right.spend;
    const sales = left.sales + right.sales;
    return {
      spend,
      sales,
      acos: calcAcos(spend, sales),
      roas: calcRoas(spend, sales),
    };
  };

  const experimentIds = experimentsRows.map((row) => row.experiment_id);
  let evaluationsRows: EvaluationRow[] = [];
  if (experimentIds.length > 0) {
    evaluationsRows = await fetchAllRows<EvaluationRow>((from, to) =>
      supabaseAdmin
        .from('log_evaluations')
        .select('experiment_id,evaluated_at,metrics_json')
        .eq('account_id', env.accountId)
        .eq('marketplace', env.marketplace)
        .in('experiment_id', experimentIds)
        .order('evaluated_at', { ascending: false })
        .range(from, to)
    );
  }

  const latestEvaluationByExperiment = new Map<string, EvaluationRow>();
  for (const evaluation of evaluationsRows) {
    if (!latestEvaluationByExperiment.has(evaluation.experiment_id)) {
      latestEvaluationByExperiment.set(evaluation.experiment_id, evaluation);
    }
  }

  const changeIds = changesRows.map((row) => row.change_id);
  const validationByChangeId = new Map<string, ValidationRow>();
  if (changeIds.length > 0) {
    const validationChunks = chunk(changeIds, 500);
    const validationRowsNested = await Promise.all(
      validationChunks.map((ids) =>
        fetchAllRows<ValidationRow>((from, to) =>
          supabaseAdmin
            .from('log_change_validations')
            .select('change_id,status,checked_at')
            .in('change_id', ids)
            .order('checked_at', { ascending: false })
            .range(from, to)
        )
      )
    );

    for (const rows of validationRowsNested) {
      for (const row of rows) {
        if (!validationByChangeId.has(row.change_id)) {
          validationByChangeId.set(row.change_id, row);
        }
      }
    }
  }

  const validationSummary = {
    validated: 0,
    mismatch: 0,
    pending: 0,
    not_found: 0,
    none: 0,
  };

  for (const changeId of changeIds) {
    const validation = validationByChangeId.get(changeId);
    if (!validation) {
      validationSummary.none += 1;
      continue;
    }
    if (validation.status === 'validated') validationSummary.validated += 1;
    else if (validation.status === 'mismatch') validationSummary.mismatch += 1;
    else if (validation.status === 'not_found') validationSummary.not_found += 1;
    else validationSummary.pending += 1;
  }

  const latestBySource = new Map<string, UploadStatRow>();
  for (const row of uploadStatsRows) {
    if (!row.source_type) continue;
    const existing = latestBySource.get(row.source_type);
    if (!existing || isMoreRecent(row, existing)) {
      latestBySource.set(row.source_type, row);
    }
  }

  return buildAccountBaselineDataPack({
    generated_at: new Date().toISOString(),
    account_id: env.accountId,
    marketplace: env.marketplace,
    windows: {
      last_30d: windowLast30,
      last_90d: windowLast90,
      prev_30d: windowPrev30,
    },
    sales_kpis_summary: {
      last_30d: {
        sales: salesTotals.last30.sales,
        orders: salesTotals.last30.orders,
        units: salesTotals.last30.units,
        ppc_cost: salesTotals.last30.ppc_cost,
        tacos: calcAcos(salesTotals.last30.ppc_cost, salesTotals.last30.sales),
      },
      last_90d: {
        sales: salesTotals.last90.sales,
        orders: salesTotals.last90.orders,
        units: salesTotals.last90.units,
        ppc_cost: salesTotals.last90.ppc_cost,
        tacos: calcAcos(salesTotals.last90.ppc_cost, salesTotals.last90.sales),
      },
    },
    top_products_snapshot: topProducts.map((row) => ({
      asin: row.asin,
      name: productNameByAsin.get(row.asin) ?? null,
      revenue_last_30d: row.revenueLast30,
      revenue_last_90d: row.revenueLast90,
      orders_last_30d: row.ordersLast30,
      units_last_30d: row.unitsLast30,
      deltas_vs_prev_30d: {
        revenue_abs: row.revenueLast30 - row.revenuePrev30,
        revenue_pct: pctDelta(row.revenueLast30, row.revenuePrev30),
        orders_abs: row.ordersLast30 - row.ordersPrev30,
        orders_pct: pctDelta(row.ordersLast30, row.ordersPrev30),
        units_abs: row.unitsLast30 - row.unitsPrev30,
        units_pct: pctDelta(row.unitsLast30, row.unitsPrev30),
      },
    })),
    ads_summary: {
      last_30d: {
        sp: spLast30,
        sb: sbLast30,
        combined: combineAds(spLast30, sbLast30),
      },
      last_90d: {
        sp: spLast90,
        sb: sbLast90,
        combined: combineAds(spLast90, sbLast90),
      },
    },
    recent_experiments: experimentsRows.slice(0, 60).map((row) => {
      const latestEvaluation = latestEvaluationByExperiment.get(row.experiment_id);
      return {
        experiment_id: row.experiment_id,
        name: row.name,
        status: parseScopeString(row.scope, 'status') ?? 'planned',
        product_id: parseScopeString(row.scope, 'product_id'),
        created_at: row.created_at,
        latest_evaluated_at: latestEvaluation?.evaluated_at ?? null,
        outcome_score: normalizeOutcomeScorePercent(
          extractOutcomeScore(latestEvaluation?.metrics_json ?? null)
        ),
      };
    }),
    validation_summary: {
      window_start: windowLast90.start,
      window_end: windowLast90.end,
      total_changes: changeIds.length,
      validated: validationSummary.validated,
      mismatch: validationSummary.mismatch,
      pending: validationSummary.pending,
      not_found: validationSummary.not_found,
      none: validationSummary.none,
    },
    ingestion_heartbeat: Array.from(latestBySource.entries())
      .map(([sourceType, row]) => ({
        source_type: sourceType,
        latest_timestamp: row.exported_at ?? (row.snapshot_date ? `${row.snapshot_date}T00:00:00Z` : row.ingested_at),
        coverage_start: row.coverage_start ?? null,
        coverage_end: row.coverage_end ?? null,
        row_count: num(row.row_count),
      }))
      .sort((left, right) => left.source_type.localeCompare(right.source_type)),
  });
};
