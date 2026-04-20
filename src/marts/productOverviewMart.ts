import {
  RETAIL_TRUTH_SOURCE,
  SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
} from '../warehouse/retailSalesTrafficTruth';

export const PRODUCT_OVERVIEW_MART_SCHEMA_VERSION =
  'product-overview-mart/v1';

export const PRODUCT_OVERVIEW_ADS_SPEND_SOURCE =
  'sp_advertised_product_daily_fact_latest' as const;

export type ProductOverviewMetricKey =
  | 'sales'
  | 'orders'
  | 'sessions'
  | 'conversion_rate'
  | 'ad_spend'
  | 'tacos';

export type ProductOverviewDiagnosticCode =
  | 'incomplete_source_coverage'
  | 'missing_sales_data'
  | 'missing_orders_data'
  | 'missing_sessions_data'
  | 'missing_ads_data'
  | 'zero_sessions_denominator'
  | 'zero_sales_denominator';

export type ProductOverviewSourceName =
  | typeof SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW
  | typeof PRODUCT_OVERVIEW_ADS_SPEND_SOURCE;

export interface ProductOverviewDiagnostic {
  code: ProductOverviewDiagnosticCode;
  severity: 'warning';
  source: ProductOverviewSourceName;
  metric?: ProductOverviewMetricKey;
  message: string;
  expected_days?: number;
  observed_days?: number;
  missing_dates?: string[];
}

export interface ProductOverviewMartRequest {
  account_id: string;
  marketplace: string;
  start_date: string;
  end_date: string;
  asin?: string;
}

export interface ProductOverviewRetailTruthSourceRow {
  account_id: string | null;
  marketplace: string | null;
  asin: string | null;
  date?: string | null;
  report_window_start: string | null;
  report_window_end: string | null;
  ordered_product_sales_amount: number | string | null;
  total_order_items: number | string | null;
  sessions: number | string | null;
  report_id?: string | null;
  canonical_record_id?: string | null;
  exported_at?: string | null;
  ingested_at?: string | null;
  retail_truth_source: string | null;
  legacy_sales_trend_fallback: boolean | null;
}

export interface ProductOverviewAdsSpendSourceRow {
  account_id: string | null;
  date: string | null;
  advertised_asin_norm: string | null;
  spend: number | string | null;
  campaign_id?: string | null;
  ad_group_id?: string | null;
  exported_at?: string | null;
}

export interface ProductOverviewSourceCoverage {
  retail_source: typeof SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW;
  ads_source: typeof PRODUCT_OVERVIEW_ADS_SPEND_SOURCE;
  expected_days: number;
  retail_observed_days: number;
  ads_observed_days: number;
  retail_missing_dates: string[];
  ads_missing_dates: string[];
}

export interface ProductOverviewSourceSummary {
  retail_source: typeof SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW;
  retail_truth_source: typeof RETAIL_TRUTH_SOURCE;
  ads_source: typeof PRODUCT_OVERVIEW_ADS_SPEND_SOURCE;
  legacy_sales_trend_fallback: false;
  retail_row_count: number;
  ads_row_count: number;
}

export interface ProductOverviewMartRow {
  schema_version: typeof PRODUCT_OVERVIEW_MART_SCHEMA_VERSION;
  account_id: string;
  marketplace: string;
  asin: string;
  start_date: string;
  end_date: string;
  sales: number | null;
  orders: number | null;
  sessions: number | null;
  conversion_rate: number | null;
  ad_spend: number | null;
  tacos: number | null;
  source_coverage: ProductOverviewSourceCoverage;
  diagnostics: ProductOverviewDiagnostic[];
}

export interface ProductOverviewMartResult {
  schema_version: typeof PRODUCT_OVERVIEW_MART_SCHEMA_VERSION;
  request: ProductOverviewMartRequest;
  source_summary: ProductOverviewSourceSummary;
  rows: ProductOverviewMartRow[];
  row_count: number;
  diagnostics_count: number;
  diagnostics: ProductOverviewDiagnostic[];
}

export interface ProductOverviewMartSource {
  fetchRetailTruthRows(
    request: ProductOverviewMartRequest
  ): Promise<ProductOverviewRetailTruthSourceRow[]>;
  fetchAdsSpendRows(
    request: ProductOverviewMartRequest
  ): Promise<ProductOverviewAdsSpendSourceRow[]>;
}

export const PRODUCT_OVERVIEW_MART_CONTRACT = {
  schema_version: PRODUCT_OVERVIEW_MART_SCHEMA_VERSION,
  sources: {
    retail: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
    retail_truth_source: RETAIL_TRUTH_SOURCE,
    ads_spend: PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
    legacy_sales_trend_fallback: false,
  },
  row_key: ['account_id', 'marketplace', 'asin', 'start_date', 'end_date'],
  deterministic_order: [
    'account_id ASC',
    'marketplace ASC',
    'asin ASC',
    'start_date ASC',
    'end_date ASC',
  ],
  metric_nullability: {
    sales:
      'null when no non-null ordered_product_sales_amount exists in the retail truth window',
    orders:
      'null when no non-null total_order_items value exists in the retail truth window',
    sessions:
      'null when no non-null sessions value exists in the retail truth window',
    conversion_rate:
      'orders / sessions; null when orders or sessions are null, or sessions is zero',
    ad_spend:
      'sum of Ads-backed SP advertised product spend; null when no non-null spend exists in the ads source window',
    tacos:
      'ad_spend / sales; null when ad_spend or sales are null, or sales is zero',
  },
  diagnostics: [
    'incomplete_source_coverage',
    'missing_sales_data',
    'missing_orders_data',
    'missing_sessions_data',
    'missing_ads_data',
    'zero_sessions_denominator',
    'zero_sales_denominator',
  ],
} as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

interface AggregateAccumulator {
  account_id: string;
  marketplace: string;
  asin: string;
  retail_dates: Set<string>;
  ads_dates: Set<string>;
  sales: NullableSum;
  orders: NullableSum;
  sessions: NullableSum;
  ad_spend: NullableSum;
}

interface NullableSum {
  value: number;
  has_value: boolean;
}

const emptySum = (): NullableSum => ({
  value: 0,
  has_value: false,
});

const addNullable = (sum: NullableSum, value: unknown): void => {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return;
  sum.value += parsed;
  sum.has_value = true;
};

const nullableValue = (sum: NullableSum): number | null =>
  sum.has_value ? sum.value : null;

const asFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const trimRequired = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return trimmed;
};

const normalizeAsin = (value: string): string =>
  trimRequired(value, 'asin').toUpperCase();

export const normalizeProductOverviewMartRequest = (
  request: ProductOverviewMartRequest
): ProductOverviewMartRequest => {
  const account_id = trimRequired(request.account_id, 'account_id');
  const marketplace = trimRequired(request.marketplace, 'marketplace').toUpperCase();
  const start_date = trimRequired(request.start_date, 'start_date');
  const end_date = trimRequired(request.end_date, 'end_date');
  const asin =
    request.asin === undefined || request.asin === null
      ? undefined
      : normalizeAsin(request.asin);

  if (!DATE_RE.test(start_date)) {
    throw new Error('start_date must use YYYY-MM-DD');
  }
  if (!DATE_RE.test(end_date)) {
    throw new Error('end_date must use YYYY-MM-DD');
  }
  if (start_date > end_date) {
    throw new Error('start_date must be on or before end_date');
  }

  return {
    account_id,
    marketplace,
    start_date,
    end_date,
    ...(asin ? { asin } : {}),
  };
};

const parseDateUtc = (date: string): number => {
  const [year, month, day] = date.split('-').map((part) => Number(part));
  return Date.UTC(year, month - 1, day);
};

export const enumerateDateWindow = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  for (
    let current = parseDateUtc(startDate), end = parseDateUtc(endDate);
    current <= end;
    current += DAY_MS
  ) {
    dates.push(new Date(current).toISOString().slice(0, 10));
  }
  return dates;
};

const clampDateWindow = (
  startDate: string,
  endDate: string,
  request: ProductOverviewMartRequest
): string[] => {
  const start = startDate > request.start_date ? startDate : request.start_date;
  const end = endDate < request.end_date ? endDate : request.end_date;
  if (!DATE_RE.test(start) || !DATE_RE.test(end) || start > end) {
    return [];
  }
  return enumerateDateWindow(start, end);
};

const getAggregate = (
  byAsin: Map<string, AggregateAccumulator>,
  request: ProductOverviewMartRequest,
  asin: string
): AggregateAccumulator => {
  const key = [request.account_id, request.marketplace, asin].join('\u001f');
  const existing = byAsin.get(key);
  if (existing) return existing;

  const created: AggregateAccumulator = {
    account_id: request.account_id,
    marketplace: request.marketplace,
    asin,
    retail_dates: new Set<string>(),
    ads_dates: new Set<string>(),
    sales: emptySum(),
    orders: emptySum(),
    sessions: emptySum(),
    ad_spend: emptySum(),
  };
  byAsin.set(key, created);
  return created;
};

const validateRetailTruthRows = (
  rows: ProductOverviewRetailTruthSourceRow[]
): void => {
  for (const row of rows) {
    if (row.retail_truth_source !== RETAIL_TRUTH_SOURCE) {
      throw new Error(
        `Retail truth row uses unsupported source ${row.retail_truth_source ?? 'null'}`
      );
    }
    if (row.legacy_sales_trend_fallback !== false) {
      throw new Error('Retail truth row attempted to use legacy SalesTrend fallback.');
    }
  }
};

const retailObservedDates = (
  request: ProductOverviewMartRequest,
  row: ProductOverviewRetailTruthSourceRow
): string[] => {
  if (row.date && DATE_RE.test(row.date)) {
    return row.date >= request.start_date && row.date <= request.end_date
      ? [row.date]
      : [];
  }

  const start = row.report_window_start ?? '';
  const end = row.report_window_end ?? '';
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return [];

  return start >= request.start_date && end <= request.end_date
    ? clampDateWindow(start, end, request)
    : [];
};

const aggregateRows = (
  request: ProductOverviewMartRequest,
  retailRows: ProductOverviewRetailTruthSourceRow[],
  adsSpendRows: ProductOverviewAdsSpendSourceRow[]
): AggregateAccumulator[] => {
  validateRetailTruthRows(retailRows);
  const byAsin = new Map<string, AggregateAccumulator>();

  for (const row of retailRows) {
    const accountId = (row.account_id ?? '').trim();
    const marketplace = (row.marketplace ?? '').trim().toUpperCase();
    const asin = (row.asin ?? '').trim().toUpperCase();
    const dates = retailObservedDates(request, row);

    if (accountId !== request.account_id) continue;
    if (marketplace !== request.marketplace) continue;
    if (!asin) continue;
    if (request.asin && asin !== request.asin) continue;
    if (dates.length === 0) continue;

    const aggregate = getAggregate(byAsin, request, asin);
    for (const date of dates) {
      aggregate.retail_dates.add(date);
    }
    addNullable(aggregate.sales, row.ordered_product_sales_amount);
    addNullable(aggregate.orders, row.total_order_items);
    addNullable(aggregate.sessions, row.sessions);
  }

  for (const row of adsSpendRows) {
    const accountId = (row.account_id ?? '').trim();
    const asin = (row.advertised_asin_norm ?? '').trim().toUpperCase();
    const date = row.date ?? '';

    if (accountId !== request.account_id) continue;
    if (!asin) continue;
    if (request.asin && asin !== request.asin) continue;
    if (!DATE_RE.test(date)) continue;
    if (date < request.start_date || date > request.end_date) continue;

    const aggregate = getAggregate(byAsin, request, asin);
    aggregate.ads_dates.add(date);
    addNullable(aggregate.ad_spend, row.spend);
  }

  return [...byAsin.values()].sort((left, right) => {
    const account = left.account_id.localeCompare(right.account_id);
    if (account !== 0) return account;
    const marketplace = left.marketplace.localeCompare(right.marketplace);
    if (marketplace !== 0) return marketplace;
    return left.asin.localeCompare(right.asin);
  });
};

const buildDiagnostic = (
  args: Omit<ProductOverviewDiagnostic, 'severity'>
): ProductOverviewDiagnostic => ({
  severity: 'warning',
  ...args,
});

const buildCoverage = (
  expectedDates: string[],
  aggregate: AggregateAccumulator
): ProductOverviewSourceCoverage => ({
  retail_source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
  ads_source: PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
  expected_days: expectedDates.length,
  retail_observed_days: aggregate.retail_dates.size,
  ads_observed_days: aggregate.ads_dates.size,
  retail_missing_dates: expectedDates.filter(
    (date) => !aggregate.retail_dates.has(date)
  ),
  ads_missing_dates: expectedDates.filter((date) => !aggregate.ads_dates.has(date)),
});

const buildDiagnostics = (args: {
  coverage: ProductOverviewSourceCoverage;
  sales: number | null;
  orders: number | null;
  sessions: number | null;
  adSpend: number | null;
}): ProductOverviewDiagnostic[] => {
  const diagnostics: ProductOverviewDiagnostic[] = [];

  if (args.coverage.retail_missing_dates.length > 0) {
    diagnostics.push(
      buildDiagnostic({
        code: 'incomplete_source_coverage',
        source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
        message: `Missing retail truth coverage for ${args.coverage.retail_missing_dates.length} of ${args.coverage.expected_days} dates in source window.`,
        expected_days: args.coverage.expected_days,
        observed_days: args.coverage.retail_observed_days,
        missing_dates: args.coverage.retail_missing_dates,
      })
    );
  }

  if (args.coverage.ads_missing_dates.length > 0) {
    diagnostics.push(
      buildDiagnostic({
        code: 'incomplete_source_coverage',
        source: PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
        message: `Missing ads spend coverage for ${args.coverage.ads_missing_dates.length} of ${args.coverage.expected_days} dates in source window.`,
        expected_days: args.coverage.expected_days,
        observed_days: args.coverage.ads_observed_days,
        missing_dates: args.coverage.ads_missing_dates,
      })
    );
  }

  if (args.sales === null) {
    diagnostics.push(
      buildDiagnostic({
        code: 'missing_sales_data',
        source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
        metric: 'sales',
        message:
          'No non-null ordered_product_sales_amount values were present in the retail truth window.',
      })
    );
  }

  if (args.orders === null) {
    diagnostics.push(
      buildDiagnostic({
        code: 'missing_orders_data',
        source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
        metric: 'orders',
        message:
          'No non-null total_order_items values were present in the retail truth window.',
      })
    );
  }

  if (args.sessions === null) {
    diagnostics.push(
      buildDiagnostic({
        code: 'missing_sessions_data',
        source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
        metric: 'sessions',
        message: 'No non-null sessions values were present in the retail truth window.',
      })
    );
  } else if (args.sessions === 0) {
    diagnostics.push(
      buildDiagnostic({
        code: 'zero_sessions_denominator',
        source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
        metric: 'conversion_rate',
        message: 'sessions is zero, so conversion_rate is null.',
      })
    );
  }

  if (args.adSpend === null) {
    diagnostics.push(
      buildDiagnostic({
        code: 'missing_ads_data',
        source: PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
        metric: 'ad_spend',
        message:
          'No non-null spend values were present in the Ads-backed source window.',
      })
    );
  }

  if (args.sales === 0) {
    diagnostics.push(
      buildDiagnostic({
        code: 'zero_sales_denominator',
        source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
        metric: 'tacos',
        message: 'sales is zero, so tacos is null.',
      })
    );
  }

  return diagnostics;
};

const safeDivide = (numerator: number | null, denominator: number | null): number | null => {
  if (numerator === null || denominator === null || denominator === 0) {
    return null;
  }
  return numerator / denominator;
};

export const buildProductOverviewMartFromRows = (args: {
  request: ProductOverviewMartRequest;
  retailTruthRows: ProductOverviewRetailTruthSourceRow[];
  adsSpendRows: ProductOverviewAdsSpendSourceRow[];
}): ProductOverviewMartResult => {
  const request = normalizeProductOverviewMartRequest(args.request);
  const expectedDates = enumerateDateWindow(request.start_date, request.end_date);
  const aggregates = aggregateRows(
    request,
    args.retailTruthRows,
    args.adsSpendRows
  );

  const rows: ProductOverviewMartRow[] = aggregates.map((aggregate) => {
    const coverage = buildCoverage(expectedDates, aggregate);
    const sales = nullableValue(aggregate.sales);
    const orders = nullableValue(aggregate.orders);
    const sessions = nullableValue(aggregate.sessions);
    const adSpend = nullableValue(aggregate.ad_spend);
    const diagnostics = buildDiagnostics({
      coverage,
      sales,
      orders,
      sessions,
      adSpend,
    });

    return {
      schema_version: PRODUCT_OVERVIEW_MART_SCHEMA_VERSION,
      account_id: aggregate.account_id,
      marketplace: aggregate.marketplace,
      asin: aggregate.asin,
      start_date: request.start_date,
      end_date: request.end_date,
      sales,
      orders,
      sessions,
      conversion_rate: safeDivide(orders, sessions),
      ad_spend: adSpend,
      tacos: safeDivide(adSpend, sales),
      source_coverage: coverage,
      diagnostics,
    };
  });

  const diagnostics = rows.flatMap((row) => row.diagnostics);

  return {
    schema_version: PRODUCT_OVERVIEW_MART_SCHEMA_VERSION,
    request,
    source_summary: {
      retail_source: SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
      retail_truth_source: RETAIL_TRUTH_SOURCE,
      ads_source: PRODUCT_OVERVIEW_ADS_SPEND_SOURCE,
      legacy_sales_trend_fallback: false,
      retail_row_count: args.retailTruthRows.length,
      ads_row_count: args.adsSpendRows.length,
    },
    rows,
    row_count: rows.length,
    diagnostics_count: diagnostics.length,
    diagnostics,
  };
};

export const buildProductOverviewMart = async (args: {
  request: ProductOverviewMartRequest;
  source: ProductOverviewMartSource;
}): Promise<ProductOverviewMartResult> => {
  const request = normalizeProductOverviewMartRequest(args.request);
  const [retailTruthRows, adsSpendRows] = await Promise.all([
    args.source.fetchRetailTruthRows(request),
    args.source.fetchAdsSpendRows(request),
  ]);
  return buildProductOverviewMartFromRows({
    request,
    retailTruthRows,
    adsSpendRows,
  });
};

export const summarizeProductOverviewMart = (
  result: ProductOverviewMartResult
): string => {
  const lines = [
    'Product overview mart build',
    'ok=yes',
    `Schema version: ${result.schema_version}`,
    `Account ID: ${result.request.account_id}`,
    `Marketplace: ${result.request.marketplace}`,
    `Date window: ${result.request.start_date} -> ${result.request.end_date}`,
    `ASIN filter: ${result.request.asin ?? 'all'}`,
    `Retail source: ${result.source_summary.retail_source}`,
    `Retail truth source: ${result.source_summary.retail_truth_source}`,
    `Retail source row count: ${result.source_summary.retail_row_count}`,
    `Ads source: ${result.source_summary.ads_source}`,
    `Ads source row count: ${result.source_summary.ads_row_count}`,
    `Legacy SI fallback: ${
      result.source_summary.legacy_sales_trend_fallback ? 'yes' : 'no'
    }`,
    `Row count: ${result.row_count}`,
    `Diagnostics count: ${result.diagnostics_count}`,
  ];

  for (const row of result.rows) {
    lines.push(
      [
        `Row ${row.asin}`,
        `sales=${row.sales ?? 'null'}`,
        `orders=${row.orders ?? 'null'}`,
        `sessions=${row.sessions ?? 'null'}`,
        `ad_spend=${row.ad_spend ?? 'null'}`,
        `conversion_rate=${row.conversion_rate ?? 'null'}`,
        `tacos=${row.tacos ?? 'null'}`,
        `diagnostics=${row.diagnostics.length}`,
      ].join(' ')
    );
  }

  return lines.join('\n');
};
