import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';

import {
  readFirstSalesTrafficWarehouseReadyArtifact,
  resolveFirstSalesTrafficWarehouseReadyArtifactPath,
} from './firstSalesTrafficWarehouseMapping';

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type ParsedCellValue = string | number | boolean | null;

type WarehouseReadyRow = {
  warehouseRecordId: string;
  canonicalRecordId: string;
  rowValues: Record<string, ParsedCellValue>;
};

type WarehouseReadyRecordBatch = {
  sectionName: string;
  targetTableName: string;
  keyColumns: string[];
  columnNames: string[];
  rows: WarehouseReadyRow[];
};

type WarehouseReadyArtifact = {
  warehouseReadyContractVersion: string;
  reportFamily: 'sales_and_traffic';
  reportType: string;
  reportId: string;
  lineage: {
    canonicalIngestArtifactPath: string;
    canonicalIngestVersion: string;
    stagingArtifactPath: string;
    stagingVersion: string;
    handoffArtifactPath: string;
    handoffSchemaVersion: string;
    parsedArtifactPath: string;
    rawArtifactPath: string;
  };
  totalRowCount: number;
  warehouseReadyPayload: {
    recordBatches: WarehouseReadyRecordBatch[];
  };
};

export const FIRST_REPORT_WAREHOUSE_WRITE_VERSION =
  'sp-api-first-report-warehouse-write/v1' as const;

export const SPAPI_SALES_TRAFFIC_BY_DATE_TABLE =
  'spapi_sales_and_traffic_by_date_report_rows';
export const SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE =
  'spapi_sales_and_traffic_by_asin_report_rows';

export type FirstSalesTrafficByDateWarehouseRow = {
  ingestion_job_id: string;
  account_id: string;
  marketplace: string;
  report_id: string;
  report_family: string;
  report_type: string;
  section_name: string;
  canonical_record_id: string;
  source_record_index: number;
  report_window_start: string;
  report_window_end: string;
  date: string;
  ordered_product_sales_amount: number | null;
  ordered_product_sales_currency: string | null;
  units_ordered: number | null;
  total_order_items: number | null;
  sessions: number | null;
  page_views: number | null;
  buy_box_percentage: number | null;
  unit_session_percentage: number | null;
  row_values: JsonObject;
  source_metadata: JsonObject;
  exported_at: string;
};

export type FirstSalesTrafficByAsinWarehouseRow = {
  ingestion_job_id: string;
  account_id: string;
  marketplace: string;
  report_id: string;
  report_family: string;
  report_type: string;
  section_name: string;
  canonical_record_id: string;
  source_record_index: number;
  report_window_start: string;
  report_window_end: string;
  date: string | null;
  asin: string | null;
  parent_asin: string | null;
  child_asin: string | null;
  sku: string | null;
  ordered_product_sales_amount: number | null;
  ordered_product_sales_currency: string | null;
  units_ordered: number | null;
  total_order_items: number | null;
  sessions: number | null;
  page_views: number | null;
  buy_box_percentage: number | null;
  unit_session_percentage: number | null;
  row_values: JsonObject;
  source_metadata: JsonObject;
  exported_at: string;
};

export interface FirstSalesTrafficWarehouseSink {
  applySchema?(): Promise<void>;
  upsertAccount(args: {
    accountId: string;
    marketplace: string;
  }): Promise<void>;
  upsertByDateRows(rows: FirstSalesTrafficByDateWarehouseRow[]): Promise<number>;
  upsertByAsinRows(rows: FirstSalesTrafficByAsinWarehouseRow[]): Promise<number>;
}

export type FirstSalesTrafficWarehouseWriteSummary = {
  endpoint: 'writeFirstSalesTrafficWarehouseRows';
  warehouseWriteVersion: typeof FIRST_REPORT_WAREHOUSE_WRITE_VERSION;
  reportId: string;
  reportFamily: 'sales_and_traffic';
  reportType: string;
  accountId: string;
  marketplace: string;
  ingestionJobId: string;
  warehouseReadyArtifactPath: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  exportedAt: string;
  targetTableNames: string[];
  dateRowCount: number;
  asinRowCount: number;
  totalRowCount: number;
  upsertedDateRowCount: number;
  upsertedAsinRowCount: number;
  checksum: string;
  legacySalesTrendFallback: false;
};

export class FirstSalesTrafficWarehouseWriteError extends Error {
  readonly code:
    | 'invalid_input'
    | 'invalid_content'
    | 'validation_failed'
    | 'write_failed';
  readonly details?: unknown;

  constructor(
    code:
      | 'invalid_input'
      | 'invalid_content'
      | 'validation_failed'
      | 'write_failed',
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'FirstSalesTrafficWarehouseWriteError';
    this.code = code;
    this.details = details;
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const trimRequired = (value: string, field: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new FirstSalesTrafficWarehouseWriteError(
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
    throw new FirstSalesTrafficWarehouseWriteError(
      'invalid_input',
      `${field} must use YYYY-MM-DD`
    );
  }
  return trimmed;
};

const cellToJson = (value: ParsedCellValue): JsonValue => value;

const asJsonObject = (values: Record<string, ParsedCellValue>): JsonObject =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, cellToJson(value)])
  ) as JsonObject;

const stringValue = (
  values: Record<string, ParsedCellValue>,
  key: string
): string | null => {
  const value = values[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const numberValue = (
  values: Record<string, ParsedCellValue>,
  key: string
): number | null => {
  const value = values[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const intValue = (
  values: Record<string, ParsedCellValue>,
  key: string
): number | null => {
  const value = numberValue(values, key);
  return value == null ? null : Math.trunc(value);
};

const sourceRecordIndex = (values: Record<string, ParsedCellValue>): number => {
  const value = values.source_record_index;
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new FirstSalesTrafficWarehouseWriteError(
      'invalid_content',
      'source_record_index must be a non-negative integer'
    );
  }
  return Number(value);
};

const rowDate = (values: Record<string, ParsedCellValue>): string | null => {
  const value = stringValue(values, 'date');
  return value && DATE_RE.test(value) ? value : null;
};

const sourceMetadata = (args: {
  artifact: WarehouseReadyArtifact;
  warehouseReadyArtifactPath: string;
  reportWindowStart: string;
  reportWindowEnd: string;
}): JsonObject => ({
  warehouse_write_version: FIRST_REPORT_WAREHOUSE_WRITE_VERSION,
  warehouse_ready_artifact_path: path.resolve(args.warehouseReadyArtifactPath),
  warehouse_ready_contract_version: args.artifact.warehouseReadyContractVersion,
  canonical_ingest_artifact_path: args.artifact.lineage.canonicalIngestArtifactPath,
  canonical_ingest_version: args.artifact.lineage.canonicalIngestVersion,
  staging_artifact_path: args.artifact.lineage.stagingArtifactPath,
  staging_version: args.artifact.lineage.stagingVersion,
  handoff_artifact_path: args.artifact.lineage.handoffArtifactPath,
  handoff_schema_version: args.artifact.lineage.handoffSchemaVersion,
  parsed_artifact_path: args.artifact.lineage.parsedArtifactPath,
  raw_artifact_path: args.artifact.lineage.rawArtifactPath,
  report_window_start: args.reportWindowStart,
  report_window_end: args.reportWindowEnd,
  legacy_sales_trend_fallback: false,
});

const findBatch = (
  artifact: WarehouseReadyArtifact,
  targetTableName: string
): WarehouseReadyRecordBatch => {
  const batch = artifact.warehouseReadyPayload.recordBatches.find(
    (candidate) => candidate.targetTableName === targetTableName
  );
  if (!batch) {
    throw new FirstSalesTrafficWarehouseWriteError(
      'validation_failed',
      `Warehouse-ready artifact is missing target batch ${targetTableName}`
    );
  }
  return batch;
};

const buildDateRows = (args: {
  artifact: WarehouseReadyArtifact;
  batch: WarehouseReadyRecordBatch;
  accountId: string;
  marketplace: string;
  ingestionJobId: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  exportedAt: string;
  warehouseReadyArtifactPath: string;
}): FirstSalesTrafficByDateWarehouseRow[] => {
  const metadata = sourceMetadata(args);

  return args.batch.rows.map((row) => {
    const date = rowDate(row.rowValues);
    if (!date) {
      throw new FirstSalesTrafficWarehouseWriteError(
        'invalid_content',
        `Date row ${row.canonicalRecordId} is missing a valid date`
      );
    }

    return {
      ingestion_job_id: args.ingestionJobId,
      account_id: args.accountId,
      marketplace: args.marketplace,
      report_id: args.artifact.reportId,
      report_family: args.artifact.reportFamily,
      report_type: args.artifact.reportType,
      section_name: args.batch.sectionName,
      canonical_record_id: row.canonicalRecordId,
      source_record_index: sourceRecordIndex(row.rowValues),
      report_window_start: args.reportWindowStart,
      report_window_end: args.reportWindowEnd,
      date,
      ordered_product_sales_amount: numberValue(
        row.rowValues,
        'salesByDate.orderedProductSales.amount'
      ),
      ordered_product_sales_currency: stringValue(
        row.rowValues,
        'salesByDate.orderedProductSales.currencyCode'
      ),
      units_ordered: intValue(row.rowValues, 'salesByDate.unitsOrdered'),
      total_order_items: intValue(row.rowValues, 'salesByDate.totalOrderItems'),
      sessions: intValue(row.rowValues, 'trafficByDate.sessions'),
      page_views: intValue(row.rowValues, 'trafficByDate.pageViews'),
      buy_box_percentage: numberValue(
        row.rowValues,
        'trafficByDate.buyBoxPercentage'
      ),
      unit_session_percentage: numberValue(
        row.rowValues,
        'trafficByDate.unitSessionPercentage'
      ),
      row_values: asJsonObject(row.rowValues),
      source_metadata: metadata,
      exported_at: args.exportedAt,
    };
  });
};

const buildAsinRows = (args: {
  artifact: WarehouseReadyArtifact;
  batch: WarehouseReadyRecordBatch;
  accountId: string;
  marketplace: string;
  ingestionJobId: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  exportedAt: string;
  warehouseReadyArtifactPath: string;
}): FirstSalesTrafficByAsinWarehouseRow[] => {
  const metadata = sourceMetadata(args);

  return args.batch.rows.map((row) => {
    const parentAsin = stringValue(row.rowValues, 'parentAsin');
    const childAsin = stringValue(row.rowValues, 'childAsin');
    const asin = childAsin ?? parentAsin ?? stringValue(row.rowValues, 'asin');

    return {
      ingestion_job_id: args.ingestionJobId,
      account_id: args.accountId,
      marketplace: args.marketplace,
      report_id: args.artifact.reportId,
      report_family: args.artifact.reportFamily,
      report_type: args.artifact.reportType,
      section_name: args.batch.sectionName,
      canonical_record_id: row.canonicalRecordId,
      source_record_index: sourceRecordIndex(row.rowValues),
      report_window_start: args.reportWindowStart,
      report_window_end: args.reportWindowEnd,
      date: rowDate(row.rowValues),
      asin,
      parent_asin: parentAsin,
      child_asin: childAsin,
      sku: stringValue(row.rowValues, 'sku'),
      ordered_product_sales_amount: numberValue(
        row.rowValues,
        'salesByAsin.orderedProductSales.amount'
      ),
      ordered_product_sales_currency: stringValue(
        row.rowValues,
        'salesByAsin.orderedProductSales.currencyCode'
      ),
      units_ordered: intValue(row.rowValues, 'salesByAsin.unitsOrdered'),
      total_order_items: intValue(row.rowValues, 'salesByAsin.totalOrderItems'),
      sessions: intValue(row.rowValues, 'trafficByAsin.sessions'),
      page_views: intValue(row.rowValues, 'trafficByAsin.pageViews'),
      buy_box_percentage: numberValue(
        row.rowValues,
        'trafficByAsin.buyBoxPercentage'
      ),
      unit_session_percentage: numberValue(
        row.rowValues,
        'trafficByAsin.unitSessionPercentage'
      ),
      row_values: asJsonObject(row.rowValues),
      source_metadata: metadata,
      exported_at: args.exportedAt,
    };
  });
};

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

export async function writeFirstSalesTrafficWarehouseRows(args: {
  accountId: string;
  marketplace: string;
  ingestionJobId: string;
  reportWindowStart: string;
  reportWindowEnd: string;
  exportedAt?: string;
  reportId?: string;
  warehouseReadyArtifactPath?: string;
  warehouseReadyOutputRoot?: string;
  sink: FirstSalesTrafficWarehouseSink;
  applySchema?: boolean;
}): Promise<FirstSalesTrafficWarehouseWriteSummary> {
  const accountId = trimRequired(args.accountId, 'accountId');
  const marketplace = normalizeMarketplace(args.marketplace);
  const ingestionJobId = trimRequired(args.ingestionJobId, 'ingestionJobId');
  const reportWindowStart = requireDate(args.reportWindowStart, 'reportWindowStart');
  const reportWindowEnd = requireDate(args.reportWindowEnd, 'reportWindowEnd');
  if (reportWindowStart > reportWindowEnd) {
    throw new FirstSalesTrafficWarehouseWriteError(
      'invalid_input',
      'reportWindowStart must be on or before reportWindowEnd'
    );
  }

  const resolved = await resolveFirstSalesTrafficWarehouseReadyArtifactPath({
    reportId: args.reportId,
    warehouseReadyArtifactPath: args.warehouseReadyArtifactPath,
    warehouseReadyOutputRoot: args.warehouseReadyOutputRoot,
  });
  const artifact = (await readFirstSalesTrafficWarehouseReadyArtifact({
    warehouseReadyArtifactPath: resolved.warehouseReadyArtifactPath,
  })) as WarehouseReadyArtifact;
  const exportedAt = args.exportedAt ?? new Date().toISOString();

  const byDateBatch = findBatch(artifact, SPAPI_SALES_TRAFFIC_BY_DATE_TABLE);
  const byAsinBatch = findBatch(artifact, SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE);

  const byDateRows = buildDateRows({
    artifact,
    batch: byDateBatch,
    accountId,
    marketplace,
    ingestionJobId,
    reportWindowStart,
    reportWindowEnd,
    exportedAt,
    warehouseReadyArtifactPath: resolved.warehouseReadyArtifactPath,
  });
  const byAsinRows = buildAsinRows({
    artifact,
    batch: byAsinBatch,
    accountId,
    marketplace,
    ingestionJobId,
    reportWindowStart,
    reportWindowEnd,
    exportedAt,
    warehouseReadyArtifactPath: resolved.warehouseReadyArtifactPath,
  });

  if (args.applySchema) {
    if (!args.sink.applySchema) {
      throw new FirstSalesTrafficWarehouseWriteError(
        'invalid_input',
        'applySchema was requested but the configured sink cannot apply schema'
      );
    }
    await args.sink.applySchema();
  }

  await args.sink.upsertAccount({ accountId, marketplace });
  const upsertedDateRowCount = await args.sink.upsertByDateRows(byDateRows);
  const upsertedAsinRowCount = await args.sink.upsertByAsinRows(byAsinRows);

  const summaryWithoutChecksum = {
    endpoint: 'writeFirstSalesTrafficWarehouseRows' as const,
    warehouseWriteVersion: FIRST_REPORT_WAREHOUSE_WRITE_VERSION,
    reportId: artifact.reportId,
    reportFamily: artifact.reportFamily,
    reportType: artifact.reportType,
    accountId,
    marketplace,
    ingestionJobId,
    warehouseReadyArtifactPath: path.resolve(resolved.warehouseReadyArtifactPath),
    reportWindowStart,
    reportWindowEnd,
    exportedAt,
    targetTableNames: [
      SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
      SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
    ],
    dateRowCount: byDateRows.length,
    asinRowCount: byAsinRows.length,
    totalRowCount: byDateRows.length + byAsinRows.length,
    upsertedDateRowCount,
    upsertedAsinRowCount,
    legacySalesTrendFallback: false as const,
  };

  return {
    ...summaryWithoutChecksum,
    checksum: checksum(summaryWithoutChecksum),
  };
}

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

const insertRows = async <T extends Record<string, unknown>>(args: {
  db: Queryable;
  tableName: string;
  rows: T[];
  columns: Array<keyof T & string>;
  conflictColumns: string[];
}): Promise<number> => {
  if (args.rows.length === 0) return 0;

  const values: unknown[] = [];
  const rowPlaceholders = args.rows.map((row, rowIndex) => {
    const placeholders = args.columns.map((column, columnIndex) => {
      values.push(row[column]);
      return `$${rowIndex * args.columns.length + columnIndex + 1}`;
    });
    return `(${placeholders.join(', ')})`;
  });
  const updateColumns = args.columns.filter(
    (column) => !args.conflictColumns.includes(column)
  );
  const sql = `
    insert into public.${args.tableName} (${args.columns.join(', ')})
    values ${rowPlaceholders.join(', ')}
    on conflict (${args.conflictColumns.join(', ')})
    do update set
      ${updateColumns
        .map((column) => `${column} = excluded.${column}`)
        .join(', ')}
  `;
  const result = await args.db.query(sql, values);
  return result.rowCount ?? args.rows.length;
};

export class PostgresFirstSalesTrafficWarehouseSink
  implements FirstSalesTrafficWarehouseSink
{
  constructor(private readonly db: Queryable) {}

  async applySchema(): Promise<void> {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase',
      'migrations',
      '20260420120000_spapi_sales_traffic_retail_boundary.sql'
    );
    const sql = await fs.readFile(migrationPath, 'utf8');
    await this.db.query(sql);
  }

  async upsertAccount(args: {
    accountId: string;
    marketplace: string;
  }): Promise<void> {
    await this.db.query(
      `
        insert into public.accounts (account_id, marketplace)
        values ($1, $2)
        on conflict (account_id)
        do update set marketplace = excluded.marketplace
      `,
      [args.accountId, args.marketplace]
    );
  }

  async upsertByDateRows(
    rows: FirstSalesTrafficByDateWarehouseRow[]
  ): Promise<number> {
    return insertRows({
      db: this.db,
      tableName: SPAPI_SALES_TRAFFIC_BY_DATE_TABLE,
      rows,
      columns: [
        'ingestion_job_id',
        'account_id',
        'marketplace',
        'report_id',
        'report_family',
        'report_type',
        'section_name',
        'canonical_record_id',
        'source_record_index',
        'report_window_start',
        'report_window_end',
        'date',
        'ordered_product_sales_amount',
        'ordered_product_sales_currency',
        'units_ordered',
        'total_order_items',
        'sessions',
        'page_views',
        'buy_box_percentage',
        'unit_session_percentage',
        'row_values',
        'source_metadata',
        'exported_at',
      ],
      conflictColumns: [
        'account_id',
        'marketplace',
        'report_id',
        'canonical_record_id',
      ],
    });
  }

  async upsertByAsinRows(
    rows: FirstSalesTrafficByAsinWarehouseRow[]
  ): Promise<number> {
    return insertRows({
      db: this.db,
      tableName: SPAPI_SALES_TRAFFIC_BY_ASIN_TABLE,
      rows,
      columns: [
        'ingestion_job_id',
        'account_id',
        'marketplace',
        'report_id',
        'report_family',
        'report_type',
        'section_name',
        'canonical_record_id',
        'source_record_index',
        'report_window_start',
        'report_window_end',
        'date',
        'asin',
        'parent_asin',
        'child_asin',
        'sku',
        'ordered_product_sales_amount',
        'ordered_product_sales_currency',
        'units_ordered',
        'total_order_items',
        'sessions',
        'page_views',
        'buy_box_percentage',
        'unit_session_percentage',
        'row_values',
        'source_metadata',
        'exported_at',
      ],
      conflictColumns: [
        'account_id',
        'marketplace',
        'report_id',
        'canonical_record_id',
      ],
    });
  }
}
