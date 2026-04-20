import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

export const RETAIL_SALES_TRAFFIC_TRUTH_CONTRACT_VERSION =
  'sp-api-retail-sales-traffic-truth/v1' as const;

export const SPAPI_RETAIL_SALES_TRAFFIC_BY_DATE_TRUTH_VIEW =
  'spapi_retail_sales_traffic_by_date_truth' as const;

export const SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW =
  'spapi_retail_sales_traffic_by_asin_truth' as const;

export const RETAIL_TRUTH_SOURCE = 'sp-api-sales-and-traffic' as const;

export type RetailSalesTrafficTruthQuery = {
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  asin?: string | null;
};

export type RetailSalesTrafficByDateTruthRow = {
  accountId: string;
  marketplace: string;
  date: string;
  reportId: string;
  ingestionJobId: string;
  canonicalRecordId: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  orderedProductSalesAmount: number | null;
  orderedProductSalesCurrency: string | null;
  unitsOrdered: number | null;
  totalOrderItems: number | null;
  sessions: number | null;
  pageViews: number | null;
  exportedAt: string;
  ingestedAt: string;
  retailTruthSource: typeof RETAIL_TRUTH_SOURCE;
  legacySalesTrendFallback: false;
};

export type RetailSalesTrafficByAsinTruthRow = {
  accountId: string;
  marketplace: string;
  asin: string | null;
  parentAsin: string | null;
  childAsin: string | null;
  sku: string | null;
  date: string | null;
  reportId: string;
  ingestionJobId: string;
  canonicalRecordId: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  orderedProductSalesAmount: number | null;
  orderedProductSalesCurrency: string | null;
  unitsOrdered: number | null;
  totalOrderItems: number | null;
  sessions: number | null;
  pageViews: number | null;
  exportedAt: string;
  ingestedAt: string;
  retailTruthSource: typeof RETAIL_TRUTH_SOURCE;
  legacySalesTrendFallback: false;
};

export interface RetailSalesTrafficTruthReader {
  readByDate(
    query: RetailSalesTrafficTruthQuery
  ): Promise<RetailSalesTrafficByDateTruthRow[]>;
  readByAsin(
    query: RetailSalesTrafficTruthQuery
  ): Promise<RetailSalesTrafficByAsinTruthRow[]>;
}

export type RetailSalesTrafficTruthProofSummary = {
  ok: boolean;
  contractVersion: typeof RETAIL_SALES_TRAFFIC_TRUTH_CONTRACT_VERSION;
  accountId: string;
  marketplace: string;
  startDate: string;
  endDate: string;
  asin: string | null;
  targetTruthSurfaceNames: string[];
  byDateRowCount: number;
  byAsinRowCount: number;
  sourceReportIds: string[];
  sourceIngestionJobIds: string[];
  sourceExportedAts: string[];
  retailTruthSource: typeof RETAIL_TRUTH_SOURCE;
  legacySalesTrendFallback: false;
  checksum: string;
};

export class RetailSalesTrafficTruthError extends Error {
  readonly code: 'invalid_input' | 'invalid_truth_source' | 'read_failed';

  constructor(
    code: 'invalid_input' | 'invalid_truth_source' | 'read_failed',
    message: string
  ) {
    super(message);
    this.name = 'RetailSalesTrafficTruthError';
    this.code = code;
  }
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const trimRequired = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RetailSalesTrafficTruthError(
      'invalid_input',
      `${field} must be a non-empty string`
    );
  }
  return trimmed;
};

const normalizeMarketplace = (value: string): string =>
  trimRequired(value, 'marketplace').toUpperCase();

const requireDate = (value: string, field: string): string => {
  const trimmed = trimRequired(value, field);
  if (!DATE_RE.test(trimmed)) {
    throw new RetailSalesTrafficTruthError(
      'invalid_input',
      `${field} must use YYYY-MM-DD`
    );
  }
  return trimmed;
};

const normalizeQuery = (
  query: RetailSalesTrafficTruthQuery
): Required<RetailSalesTrafficTruthQuery> => {
  const accountId = trimRequired(query.accountId, 'accountId');
  const marketplace = normalizeMarketplace(query.marketplace);
  const startDate = requireDate(query.startDate, 'startDate');
  const endDate = requireDate(query.endDate, 'endDate');
  if (startDate > endDate) {
    throw new RetailSalesTrafficTruthError(
      'invalid_input',
      'startDate must be on or before endDate'
    );
  }
  const asin = query.asin?.trim() || null;
  return { accountId, marketplace, startDate, endDate, asin };
};

const toNumberOrNull = (value: unknown): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const toRequiredString = (value: unknown, field: string): string => {
  const text = toStringOrNull(value);
  if (!text) {
    throw new RetailSalesTrafficTruthError(
      'read_failed',
      `Retail truth row is missing ${field}`
    );
  }
  return text;
};

const truthSource = (value: unknown): typeof RETAIL_TRUTH_SOURCE => {
  if (value !== RETAIL_TRUTH_SOURCE) {
    throw new RetailSalesTrafficTruthError(
      'invalid_truth_source',
      'Retail truth row did not come from the SP-API Sales and Traffic truth surface'
    );
  }
  return RETAIL_TRUTH_SOURCE;
};

const noLegacyFallback = (value: unknown): false => {
  if (value !== false) {
    throw new RetailSalesTrafficTruthError(
      'invalid_truth_source',
      'Retail truth row unexpectedly indicates legacy SalesTrend fallback'
    );
  }
  return false;
};

type RawDateTruthRow = {
  accountId?: string;
  account_id?: string;
  marketplace?: string;
  date?: string | null;
  reportId?: string;
  report_id?: string;
  ingestionJobId?: string;
  ingestion_job_id?: string;
  canonicalRecordId?: string;
  canonical_record_id?: string;
  reportWindowStart?: string;
  report_window_start?: string;
  reportWindowEnd?: string;
  report_window_end?: string;
  orderedProductSalesAmount?: unknown;
  ordered_product_sales_amount?: unknown;
  orderedProductSalesCurrency?: string | null;
  ordered_product_sales_currency?: string | null;
  unitsOrdered?: unknown;
  units_ordered?: unknown;
  totalOrderItems?: unknown;
  total_order_items?: unknown;
  sessions?: unknown;
  pageViews?: unknown;
  page_views?: unknown;
  exportedAt?: string;
  exported_at?: string;
  ingestedAt?: string;
  ingested_at?: string;
  retailTruthSource?: string;
  retail_truth_source?: string;
  legacySalesTrendFallback?: boolean;
  legacy_sales_trend_fallback?: boolean;
};

type RawAsinTruthRow = RawDateTruthRow & {
  asin?: string | null;
  parentAsin?: string | null;
  parent_asin?: string | null;
  childAsin?: string | null;
  child_asin?: string | null;
  sku?: string | null;
};

const mapDateRow = (
  row: RawDateTruthRow
): RetailSalesTrafficByDateTruthRow => ({
  accountId: toRequiredString(row.accountId ?? row.account_id, 'account_id'),
  marketplace: toRequiredString(row.marketplace, 'marketplace'),
  date: toRequiredString(row.date, 'date'),
  reportId: toRequiredString(row.reportId ?? row.report_id, 'report_id'),
  ingestionJobId: toRequiredString(
    row.ingestionJobId ?? row.ingestion_job_id,
    'ingestion_job_id'
  ),
  canonicalRecordId: toRequiredString(
    row.canonicalRecordId ?? row.canonical_record_id,
    'canonical_record_id'
  ),
  reportWindowStart: toRequiredString(
    row.reportWindowStart ?? row.report_window_start,
    'report_window_start'
  ),
  reportWindowEnd: toRequiredString(
    row.reportWindowEnd ?? row.report_window_end,
    'report_window_end'
  ),
  orderedProductSalesAmount: toNumberOrNull(
    row.orderedProductSalesAmount ?? row.ordered_product_sales_amount
  ),
  orderedProductSalesCurrency: toStringOrNull(
    row.orderedProductSalesCurrency ?? row.ordered_product_sales_currency
  ),
  unitsOrdered: toNumberOrNull(row.unitsOrdered ?? row.units_ordered),
  totalOrderItems: toNumberOrNull(
    row.totalOrderItems ?? row.total_order_items
  ),
  sessions: toNumberOrNull(row.sessions),
  pageViews: toNumberOrNull(row.pageViews ?? row.page_views),
  exportedAt: toRequiredString(row.exportedAt ?? row.exported_at, 'exported_at'),
  ingestedAt: toRequiredString(row.ingestedAt ?? row.ingested_at, 'ingested_at'),
  retailTruthSource: truthSource(
    row.retailTruthSource ?? row.retail_truth_source
  ),
  legacySalesTrendFallback: noLegacyFallback(
    row.legacySalesTrendFallback ?? row.legacy_sales_trend_fallback
  ),
});

const mapAsinRow = (
  row: RawAsinTruthRow
): RetailSalesTrafficByAsinTruthRow => ({
  accountId: toRequiredString(row.accountId ?? row.account_id, 'account_id'),
  marketplace: toRequiredString(row.marketplace, 'marketplace'),
  date: toStringOrNull(row.date),
  reportId: toRequiredString(row.reportId ?? row.report_id, 'report_id'),
  ingestionJobId: toRequiredString(
    row.ingestionJobId ?? row.ingestion_job_id,
    'ingestion_job_id'
  ),
  canonicalRecordId: toRequiredString(
    row.canonicalRecordId ?? row.canonical_record_id,
    'canonical_record_id'
  ),
  reportWindowStart: toRequiredString(
    row.reportWindowStart ?? row.report_window_start,
    'report_window_start'
  ),
  reportWindowEnd: toRequiredString(
    row.reportWindowEnd ?? row.report_window_end,
    'report_window_end'
  ),
  asin: toStringOrNull(row.asin),
  parentAsin: toStringOrNull(row.parentAsin ?? row.parent_asin),
  childAsin: toStringOrNull(row.childAsin ?? row.child_asin),
  sku: toStringOrNull(row.sku),
  orderedProductSalesAmount: toNumberOrNull(
    row.orderedProductSalesAmount ?? row.ordered_product_sales_amount
  ),
  orderedProductSalesCurrency: toStringOrNull(
    row.orderedProductSalesCurrency ?? row.ordered_product_sales_currency
  ),
  unitsOrdered: toNumberOrNull(row.unitsOrdered ?? row.units_ordered),
  totalOrderItems: toNumberOrNull(
    row.totalOrderItems ?? row.total_order_items
  ),
  sessions: toNumberOrNull(row.sessions),
  pageViews: toNumberOrNull(row.pageViews ?? row.page_views),
  exportedAt: toRequiredString(row.exportedAt ?? row.exported_at, 'exported_at'),
  ingestedAt: toRequiredString(row.ingestedAt ?? row.ingested_at, 'ingested_at'),
  retailTruthSource: truthSource(
    row.retailTruthSource ?? row.retail_truth_source
  ),
  legacySalesTrendFallback: noLegacyFallback(
    row.legacySalesTrendFallback ?? row.legacy_sales_trend_fallback
  ),
});

const compareTextDesc = (left: string, right: string): number =>
  right.localeCompare(left);

const dateKey = (row: RetailSalesTrafficByDateTruthRow): string =>
  `${row.accountId}\u0000${row.marketplace}\u0000${row.date}`;

const asinKey = (row: RetailSalesTrafficByAsinTruthRow): string =>
  [
    row.accountId,
    row.marketplace,
    row.asin ?? '',
    row.reportWindowStart,
    row.reportWindowEnd,
  ].join('\u0000');

const compareLatest = (
  left: RetailSalesTrafficByDateTruthRow | RetailSalesTrafficByAsinTruthRow,
  right: RetailSalesTrafficByDateTruthRow | RetailSalesTrafficByAsinTruthRow
): number =>
  compareTextDesc(left.exportedAt, right.exportedAt) ||
  compareTextDesc(left.ingestedAt, right.ingestedAt) ||
  compareTextDesc(left.reportId, right.reportId) ||
  compareTextDesc(left.canonicalRecordId, right.canonicalRecordId);

const sortDateRows = (
  rows: RetailSalesTrafficByDateTruthRow[]
): RetailSalesTrafficByDateTruthRow[] =>
  [...rows].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.reportId.localeCompare(right.reportId) ||
      left.canonicalRecordId.localeCompare(right.canonicalRecordId)
  );

const sortAsinRows = (
  rows: RetailSalesTrafficByAsinTruthRow[]
): RetailSalesTrafficByAsinTruthRow[] =>
  [...rows].sort(
    (left, right) =>
      (left.asin ?? '').localeCompare(right.asin ?? '') ||
      left.reportWindowStart.localeCompare(right.reportWindowStart) ||
      left.reportWindowEnd.localeCompare(right.reportWindowEnd) ||
      left.reportId.localeCompare(right.reportId) ||
      left.canonicalRecordId.localeCompare(right.canonicalRecordId)
  );

export const selectRetailSalesTrafficByDateTruthRows = (
  rows: RawDateTruthRow[],
  query: RetailSalesTrafficTruthQuery
): RetailSalesTrafficByDateTruthRow[] => {
  const normalized = normalizeQuery(query);
  const candidates = rows
    .map(mapDateRow)
    .filter(
      (row) =>
        row.accountId === normalized.accountId &&
        row.marketplace === normalized.marketplace &&
        row.date >= normalized.startDate &&
        row.date <= normalized.endDate
    );

  const latestByKey = new Map<string, RetailSalesTrafficByDateTruthRow>();
  for (const row of candidates) {
    const key = dateKey(row);
    const previous = latestByKey.get(key);
    if (!previous || compareLatest(row, previous) < 0) {
      latestByKey.set(key, row);
    }
  }
  return sortDateRows([...latestByKey.values()]);
};

export const selectRetailSalesTrafficByAsinTruthRows = (
  rows: RawAsinTruthRow[],
  query: RetailSalesTrafficTruthQuery
): RetailSalesTrafficByAsinTruthRow[] => {
  const normalized = normalizeQuery(query);
  const candidates = rows
    .map(mapAsinRow)
    .filter(
      (row) =>
        row.accountId === normalized.accountId &&
        row.marketplace === normalized.marketplace &&
        row.reportWindowEnd >= normalized.startDate &&
        row.reportWindowStart <= normalized.endDate &&
        (!normalized.asin || row.asin === normalized.asin)
    );

  const latestByKey = new Map<string, RetailSalesTrafficByAsinTruthRow>();
  for (const row of candidates) {
    const key = asinKey(row);
    const previous = latestByKey.get(key);
    if (!previous || compareLatest(row, previous) < 0) {
      latestByKey.set(key, row);
    }
  }
  return sortAsinRows([...latestByKey.values()]);
};

export class InMemoryRetailSalesTrafficTruthReader
  implements RetailSalesTrafficTruthReader
{
  constructor(
    private readonly byDateRows: RawDateTruthRow[],
    private readonly byAsinRows: RawAsinTruthRow[]
  ) {}

  async readByDate(
    query: RetailSalesTrafficTruthQuery
  ): Promise<RetailSalesTrafficByDateTruthRow[]> {
    return selectRetailSalesTrafficByDateTruthRows(this.byDateRows, query);
  }

  async readByAsin(
    query: RetailSalesTrafficTruthQuery
  ): Promise<RetailSalesTrafficByAsinTruthRow[]> {
    return selectRetailSalesTrafficByAsinTruthRows(this.byAsinRows, query);
  }
}

const rowToDateTruth = (row: Record<string, unknown>): RawDateTruthRow => ({
  account_id: toRequiredString(row.account_id, 'account_id'),
  marketplace: toRequiredString(row.marketplace, 'marketplace'),
  date: toRequiredString(row.date, 'date'),
  report_id: toRequiredString(row.report_id, 'report_id'),
  ingestion_job_id: toRequiredString(row.ingestion_job_id, 'ingestion_job_id'),
  canonical_record_id: toRequiredString(
    row.canonical_record_id,
    'canonical_record_id'
  ),
  report_window_start: toRequiredString(
    row.report_window_start,
    'report_window_start'
  ),
  report_window_end: toRequiredString(row.report_window_end, 'report_window_end'),
  ordered_product_sales_amount: row.ordered_product_sales_amount,
  ordered_product_sales_currency: row.ordered_product_sales_currency as
    | string
    | null,
  units_ordered: row.units_ordered,
  total_order_items: row.total_order_items,
  sessions: row.sessions,
  page_views: row.page_views,
  exported_at: toRequiredString(row.exported_at, 'exported_at'),
  ingested_at: toRequiredString(row.ingested_at, 'ingested_at'),
  retail_truth_source: row.retail_truth_source as string,
  legacy_sales_trend_fallback: row.legacy_sales_trend_fallback as boolean,
});

const rowToAsinTruth = (row: Record<string, unknown>): RawAsinTruthRow => ({
  account_id: toRequiredString(row.account_id, 'account_id'),
  marketplace: toRequiredString(row.marketplace, 'marketplace'),
  date: toStringOrNull(row.date),
  report_id: toRequiredString(row.report_id, 'report_id'),
  ingestion_job_id: toRequiredString(row.ingestion_job_id, 'ingestion_job_id'),
  canonical_record_id: toRequiredString(
    row.canonical_record_id,
    'canonical_record_id'
  ),
  report_window_start: toRequiredString(
    row.report_window_start,
    'report_window_start'
  ),
  report_window_end: toRequiredString(row.report_window_end, 'report_window_end'),
  asin: toStringOrNull(row.asin),
  parent_asin: toStringOrNull(row.parent_asin),
  child_asin: toStringOrNull(row.child_asin),
  sku: toStringOrNull(row.sku),
  ordered_product_sales_amount: row.ordered_product_sales_amount,
  ordered_product_sales_currency: row.ordered_product_sales_currency as
    | string
    | null,
  units_ordered: row.units_ordered,
  total_order_items: row.total_order_items,
  sessions: row.sessions,
  page_views: row.page_views,
  exported_at: toRequiredString(row.exported_at, 'exported_at'),
  ingested_at: toRequiredString(row.ingested_at, 'ingested_at'),
  retail_truth_source: row.retail_truth_source as string,
  legacy_sales_trend_fallback: row.legacy_sales_trend_fallback as boolean,
});

export class PostgresRetailSalesTrafficTruthReader
  implements RetailSalesTrafficTruthReader
{
  constructor(private readonly db: Queryable) {}

  async applySchema(): Promise<void> {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase',
      'migrations',
      '20260420143000_spapi_retail_sales_traffic_truth_contract.sql'
    );
    const sql = await fs.readFile(migrationPath, 'utf8');
    await this.db.query(sql);
  }

  async readByDate(
    query: RetailSalesTrafficTruthQuery
  ): Promise<RetailSalesTrafficByDateTruthRow[]> {
    const normalized = normalizeQuery(query);
    const result = await this.db.query(
      `
        select
          account_id,
          marketplace,
          date::text as date,
          report_id,
          ingestion_job_id::text as ingestion_job_id,
          canonical_record_id,
          report_window_start::text as report_window_start,
          report_window_end::text as report_window_end,
          ordered_product_sales_amount::text as ordered_product_sales_amount,
          ordered_product_sales_currency,
          units_ordered,
          total_order_items,
          sessions,
          page_views,
          exported_at::text as exported_at,
          ingested_at::text as ingested_at,
          retail_truth_source,
          legacy_sales_trend_fallback
        from public.${SPAPI_RETAIL_SALES_TRAFFIC_BY_DATE_TRUTH_VIEW}
        where account_id = $1
          and marketplace = $2
          and date >= $3::date
          and date <= $4::date
        order by date asc, report_id asc, canonical_record_id asc
      `,
      [
        normalized.accountId,
        normalized.marketplace,
        normalized.startDate,
        normalized.endDate,
      ]
    );
    return result.rows.map(rowToDateTruth).map(mapDateRow);
  }

  async readByAsin(
    query: RetailSalesTrafficTruthQuery
  ): Promise<RetailSalesTrafficByAsinTruthRow[]> {
    const normalized = normalizeQuery(query);
    const values: string[] = [
      normalized.accountId,
      normalized.marketplace,
      normalized.startDate,
      normalized.endDate,
    ];
    const asinFilter = normalized.asin
      ? 'and asin = $5'
      : '';
    if (normalized.asin) values.push(normalized.asin);
    const result = await this.db.query(
      `
        select
          account_id,
          marketplace,
          date::text as date,
          asin,
          parent_asin,
          child_asin,
          sku,
          report_id,
          ingestion_job_id::text as ingestion_job_id,
          canonical_record_id,
          report_window_start::text as report_window_start,
          report_window_end::text as report_window_end,
          ordered_product_sales_amount::text as ordered_product_sales_amount,
          ordered_product_sales_currency,
          units_ordered,
          total_order_items,
          sessions,
          page_views,
          exported_at::text as exported_at,
          ingested_at::text as ingested_at,
          retail_truth_source,
          legacy_sales_trend_fallback
        from public.${SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW}
        where account_id = $1
          and marketplace = $2
          and report_window_end >= $3::date
          and report_window_start <= $4::date
          ${asinFilter}
        order by asin asc nulls last,
          report_window_start asc,
          report_window_end asc,
          report_id asc,
          canonical_record_id asc
      `,
      values
    );
    return result.rows.map(rowToAsinTruth).map(mapAsinRow);
  }
}

const stableJsonStringify = (value: unknown): string => {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(',')}]`;
  }
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(objectValue[key])}`)
    .join(',')}}`;
};

const checksum = (value: unknown): string =>
  createHash('sha256').update(stableJsonStringify(value)).digest('hex');

const uniqueSorted = (values: Array<string | null | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

export async function runRetailSalesTrafficTruthProof(args: {
  reader: RetailSalesTrafficTruthReader;
  query: RetailSalesTrafficTruthQuery;
}): Promise<RetailSalesTrafficTruthProofSummary> {
  const normalized = normalizeQuery(args.query);
  const byDateRows = await args.reader.readByDate(normalized);
  const byAsinRows = await args.reader.readByAsin(normalized);
  const allRows = [...byDateRows, ...byAsinRows];

  for (const row of allRows) {
    truthSource(row.retailTruthSource);
    noLegacyFallback(row.legacySalesTrendFallback);
  }

  const summaryWithoutChecksum = {
    ok: true,
    contractVersion: RETAIL_SALES_TRAFFIC_TRUTH_CONTRACT_VERSION,
    accountId: normalized.accountId,
    marketplace: normalized.marketplace,
    startDate: normalized.startDate,
    endDate: normalized.endDate,
    asin: normalized.asin,
    targetTruthSurfaceNames: [
      SPAPI_RETAIL_SALES_TRAFFIC_BY_DATE_TRUTH_VIEW,
      SPAPI_RETAIL_SALES_TRAFFIC_BY_ASIN_TRUTH_VIEW,
    ],
    byDateRowCount: byDateRows.length,
    byAsinRowCount: byAsinRows.length,
    sourceReportIds: uniqueSorted(allRows.map((row) => row.reportId)),
    sourceIngestionJobIds: uniqueSorted(allRows.map((row) => row.ingestionJobId)),
    sourceExportedAts: uniqueSorted(allRows.map((row) => row.exportedAt)),
    retailTruthSource: RETAIL_TRUTH_SOURCE,
    legacySalesTrendFallback: false as const,
  };

  return {
    ...summaryWithoutChecksum,
    checksum: checksum(summaryWithoutChecksum),
  };
}

export const summarizeRetailSalesTrafficTruthProof = (
  summary: RetailSalesTrafficTruthProofSummary
): string =>
  [
    `ok=${summary.ok ? 'yes' : 'no'}`,
    `contract_version=${summary.contractVersion}`,
    `account_id=${summary.accountId}`,
    `marketplace=${summary.marketplace}`,
    `start_date=${summary.startDate}`,
    `end_date=${summary.endDate}`,
    `asin=${summary.asin ?? 'all'}`,
    `truth_surfaces=${summary.targetTruthSurfaceNames.join(',')}`,
    `by_date_row_count=${summary.byDateRowCount}`,
    `by_asin_row_count=${summary.byAsinRowCount}`,
    `source_report_ids=${summary.sourceReportIds.join(',') || 'none'}`,
    `source_ingestion_job_ids=${summary.sourceIngestionJobIds.join(',') || 'none'}`,
    `source_exported_ats=${summary.sourceExportedAts.join(',') || 'none'}`,
    `retail_truth_source=${summary.retailTruthSource}`,
    `legacy_sales_trend_fallback=${summary.legacySalesTrendFallback ? 'yes' : 'no'}`,
    `checksum=${summary.checksum}`,
  ].join('\n');
