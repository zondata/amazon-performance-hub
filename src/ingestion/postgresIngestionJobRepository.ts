import { Pool, type PoolClient, type QueryResultRow } from 'pg';

import type {
  IngestionJobRecord,
  SourceWatermarkRecord,
} from './schemaContract';
import {
  isIngestionProcessingStatus,
  isSourceWatermarkStatus,
} from './schemaContract';
import {
  IngestionJobRunnerError,
  type IngestionJobRepository,
  type IngestionWatermarkScope,
} from './jobRunner';

type Queryable = Pick<Pool, 'query'> | Pick<PoolClient, 'query'>;

type JsonObject = IngestionJobRecord['metadata'];

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const normalizeJsonObject = (value: unknown): JsonObject => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return cloneJson(value as JsonObject);
};

const asStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  return null;
};

const requireString = (row: QueryResultRow, field: string): string => {
  const value = asStringOrNull(row[field]);
  if (!value) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `Database row is missing required field ${field}`
    );
  }
  return value;
};

const normalizeJobRow = (row: QueryResultRow): IngestionJobRecord => {
  const processingStatus = requireString(row, 'processing_status');
  if (!isIngestionProcessingStatus(processingStatus)) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `Unsupported ingestion job status from database: ${processingStatus}`
    );
  }

  return {
    id: requireString(row, 'id'),
    job_key: requireString(row, 'job_key'),
    source_name: requireString(row, 'source_name'),
    account_id: asStringOrNull(row.account_id),
    marketplace: asStringOrNull(row.marketplace),
    requested_at: requireString(row, 'requested_at'),
    source_window_start: asStringOrNull(row.source_window_start),
    source_window_end: asStringOrNull(row.source_window_end),
    retrieved_at: asStringOrNull(row.retrieved_at),
    started_at: asStringOrNull(row.started_at),
    finished_at: asStringOrNull(row.finished_at),
    processing_status: processingStatus,
    run_kind: requireString(row, 'run_kind'),
    idempotency_key: requireString(row, 'idempotency_key'),
    checksum: asStringOrNull(row.checksum),
    row_count:
      row.row_count == null ? null : Number.parseInt(String(row.row_count), 10),
    error_code: asStringOrNull(row.error_code),
    error_message: asStringOrNull(row.error_message),
    metadata: normalizeJsonObject(row.metadata),
    created_at: requireString(row, 'created_at'),
    updated_at: requireString(row, 'updated_at'),
  };
};

const normalizeWatermarkRow = (row: QueryResultRow): SourceWatermarkRecord => {
  const status = requireString(row, 'status');
  if (!isSourceWatermarkStatus(status)) {
    throw new IngestionJobRunnerError(
      'invalid_request',
      `Unsupported source watermark status from database: ${status}`
    );
  }

  return {
    id: requireString(row, 'id'),
    source_name: requireString(row, 'source_name'),
    account_id: asStringOrNull(row.account_id),
    marketplace: asStringOrNull(row.marketplace),
    scope_key: requireString(row, 'scope_key'),
    last_requested_at: asStringOrNull(row.last_requested_at),
    last_available_at: asStringOrNull(row.last_available_at),
    last_success_at: asStringOrNull(row.last_success_at),
    last_job_id: asStringOrNull(row.last_job_id),
    watermark_start: asStringOrNull(row.watermark_start),
    watermark_end: asStringOrNull(row.watermark_end),
    status,
    notes: asStringOrNull(row.notes),
    metadata: normalizeJsonObject(row.metadata),
    created_at: requireString(row, 'created_at'),
    updated_at: requireString(row, 'updated_at'),
  };
};

const jobSelect = `
  select
    id::text,
    job_key,
    source_name,
    account_id,
    marketplace,
    requested_at::text,
    source_window_start::text,
    source_window_end::text,
    retrieved_at::text,
    started_at::text,
    finished_at::text,
    processing_status,
    run_kind,
    idempotency_key,
    checksum,
    row_count,
    error_code,
    error_message,
    metadata,
    created_at::text,
    updated_at::text
  from public.ingestion_jobs
`;

const watermarkSelect = `
  select
    id::text,
    source_name,
    account_id,
    marketplace,
    scope_key,
    last_requested_at::text,
    last_available_at::text,
    last_success_at::text,
    last_job_id::text,
    watermark_start::text,
    watermark_end::text,
    status,
    notes,
    metadata,
    created_at::text,
    updated_at::text
  from public.source_watermarks
`;

export class PostgresIngestionJobRepository
  implements IngestionJobRepository
{
  constructor(private readonly db: Queryable) {}

  async findJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<IngestionJobRecord | null> {
    const result = await this.db.query(
      `${jobSelect} where idempotency_key = $1 limit 1`,
      [idempotencyKey]
    );
    return result.rows[0] ? normalizeJobRow(result.rows[0]) : null;
  }

  async findJobById(jobId: string): Promise<IngestionJobRecord | null> {
    const result = await this.db.query(`${jobSelect} where id = $1 limit 1`, [
      jobId,
    ]);
    return result.rows[0] ? normalizeJobRow(result.rows[0]) : null;
  }

  async insertJob(job: IngestionJobRecord): Promise<IngestionJobRecord> {
    const result = await this.db.query(
      `
        insert into public.ingestion_jobs (
          id,
          job_key,
          source_name,
          account_id,
          marketplace,
          requested_at,
          source_window_start,
          source_window_end,
          retrieved_at,
          started_at,
          finished_at,
          processing_status,
          run_kind,
          idempotency_key,
          checksum,
          row_count,
          error_code,
          error_message,
          metadata,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          $20, $21
        )
        returning *
      `,
      [
        job.id,
        job.job_key,
        job.source_name,
        job.account_id,
        job.marketplace,
        job.requested_at,
        job.source_window_start,
        job.source_window_end,
        job.retrieved_at,
        job.started_at,
        job.finished_at,
        job.processing_status,
        job.run_kind,
        job.idempotency_key,
        job.checksum,
        job.row_count,
        job.error_code,
        job.error_message,
        job.metadata,
        job.created_at,
        job.updated_at,
      ]
    );

    return normalizeJobRow(result.rows[0]);
  }

  async updateJob(
    jobId: string,
    updater: (job: IngestionJobRecord) => IngestionJobRecord
  ): Promise<IngestionJobRecord> {
    const current = await this.findJobById(jobId);
    if (!current) {
      throw new IngestionJobRunnerError('job_not_found', `Job not found: ${jobId}`);
    }

    const next = updater(current);
    const result = await this.db.query(
      `
        update public.ingestion_jobs
        set
          job_key = $2,
          source_name = $3,
          account_id = $4,
          marketplace = $5,
          requested_at = $6,
          source_window_start = $7,
          source_window_end = $8,
          retrieved_at = $9,
          started_at = $10,
          finished_at = $11,
          processing_status = $12,
          run_kind = $13,
          idempotency_key = $14,
          checksum = $15,
          row_count = $16,
          error_code = $17,
          error_message = $18,
          metadata = $19
        where id = $1
        returning *
      `,
      [
        next.id,
        next.job_key,
        next.source_name,
        next.account_id,
        next.marketplace,
        next.requested_at,
        next.source_window_start,
        next.source_window_end,
        next.retrieved_at,
        next.started_at,
        next.finished_at,
        next.processing_status,
        next.run_kind,
        next.idempotency_key,
        next.checksum,
        next.row_count,
        next.error_code,
        next.error_message,
        next.metadata,
      ]
    );

    return normalizeJobRow(result.rows[0]);
  }

  async listJobsByLineageRootIdempotencyKey(
    lineageRootIdempotencyKey: string
  ): Promise<IngestionJobRecord[]> {
    const result = await this.db.query(
      `${jobSelect} where metadata ->> 'lineage_root_idempotency_key' = $1 order by requested_at asc`,
      [lineageRootIdempotencyKey]
    );
    return result.rows.map(normalizeJobRow);
  }

  async findWatermarkByScope(
    scope: IngestionWatermarkScope
  ): Promise<SourceWatermarkRecord | null> {
    const result = await this.db.query(
      `
        ${watermarkSelect}
        where source_name = $1
          and coalesce(account_id, '') = coalesce($2, '')
          and coalesce(marketplace, '') = coalesce($3, '')
          and scope_key = $4
        limit 1
      `,
      [scope.sourceName, scope.accountId, scope.marketplace, scope.scopeKey]
    );
    return result.rows[0] ? normalizeWatermarkRow(result.rows[0]) : null;
  }

  async upsertWatermark(
    watermark: SourceWatermarkRecord
  ): Promise<SourceWatermarkRecord> {
    const result = await this.db.query(
      `
        insert into public.source_watermarks (
          id,
          source_name,
          account_id,
          marketplace,
          scope_key,
          last_requested_at,
          last_available_at,
          last_success_at,
          last_job_id,
          watermark_start,
          watermark_end,
          status,
          notes,
          metadata,
          created_at,
          updated_at
        )
        values (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16
        )
        on conflict (
          source_name,
          (coalesce(account_id, '')),
          (coalesce(marketplace, '')),
          scope_key
        )
        do update set
          last_requested_at = excluded.last_requested_at,
          last_available_at = excluded.last_available_at,
          last_success_at = excluded.last_success_at,
          last_job_id = excluded.last_job_id,
          watermark_start = excluded.watermark_start,
          watermark_end = excluded.watermark_end,
          status = excluded.status,
          notes = excluded.notes,
          metadata = excluded.metadata
        returning *
      `,
      [
        watermark.id,
        watermark.source_name,
        watermark.account_id,
        watermark.marketplace,
        watermark.scope_key,
        watermark.last_requested_at,
        watermark.last_available_at,
        watermark.last_success_at,
        watermark.last_job_id,
        watermark.watermark_start,
        watermark.watermark_end,
        watermark.status,
        watermark.notes,
        watermark.metadata,
        watermark.created_at,
        watermark.updated_at,
      ]
    );

    return normalizeWatermarkRow(result.rows[0]);
  }
}

export const createPostgresPool = (databaseUrl: string): Pool =>
  new Pool({
    connectionString: databaseUrl,
  });
