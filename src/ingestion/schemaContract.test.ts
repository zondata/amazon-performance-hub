import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  INGESTION_JOB_RECORD_FIELDS,
  INGESTION_PROCESSING_STATUSES,
  SOURCE_WATERMARK_RECORD_FIELDS,
  SOURCE_WATERMARK_STATUSES,
  isIngestionProcessingStatus,
  isSourceWatermarkStatus,
  type IngestionJobRecord,
  type SourceWatermarkRecord,
} from './schemaContract';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../supabase/migrations/20260418120000_ingestion_jobs_source_watermarks.sql'
);

describe('ingestion schema contract', () => {
  it('exposes the exact supported ingestion status values', () => {
    expect(INGESTION_PROCESSING_STATUSES).toEqual([
      'requested',
      'processing',
      'available',
      'failed',
    ]);
    expect(SOURCE_WATERMARK_STATUSES).toEqual([
      'unknown',
      'requested',
      'available',
      'failed',
    ]);
  });

  it('rejects unsupported status values', () => {
    expect(isIngestionProcessingStatus('requested')).toBe(true);
    expect(isIngestionProcessingStatus('queued')).toBe(false);
    expect(isSourceWatermarkStatus('available')).toBe(true);
    expect(isSourceWatermarkStatus('stale')).toBe(false);
  });

  it('exposes the expected ingestion record fields', () => {
    const ingestionJobRecord: IngestionJobRecord = {
      id: '00000000-0000-0000-0000-000000000001',
      job_key: 'sp_campaign_daily',
      source_name: 'ads_api_sp_campaign_daily',
      account_id: 'sourbear',
      marketplace: 'US',
      requested_at: '2026-04-18T00:00:00.000Z',
      source_window_start: '2026-04-10T00:00:00.000Z',
      source_window_end: '2026-04-16T23:59:59.999Z',
      retrieved_at: null,
      started_at: null,
      finished_at: null,
      processing_status: 'requested',
      run_kind: 'manual',
      idempotency_key: 'sp_campaign_daily:sourbear:2026-04-10:2026-04-16',
      checksum: null,
      row_count: null,
      error_code: null,
      error_message: null,
      metadata: {},
      created_at: '2026-04-18T00:00:00.000Z',
      updated_at: '2026-04-18T00:00:00.000Z',
    };

    const sourceWatermarkRecord: SourceWatermarkRecord = {
      id: '00000000-0000-0000-0000-000000000002',
      source_name: 'ads_api_sp_campaign_daily',
      account_id: 'sourbear',
      marketplace: 'US',
      scope_key: '',
      last_requested_at: '2026-04-18T00:00:00.000Z',
      last_available_at: null,
      last_success_at: null,
      last_job_id: ingestionJobRecord.id,
      watermark_start: '2026-04-10T00:00:00.000Z',
      watermark_end: '2026-04-16T23:59:59.999Z',
      status: 'requested',
      notes: null,
      metadata: {},
      created_at: '2026-04-18T00:00:00.000Z',
      updated_at: '2026-04-18T00:00:00.000Z',
    };

    expect(Object.keys(ingestionJobRecord)).toEqual(INGESTION_JOB_RECORD_FIELDS);
    expect(Object.keys(sourceWatermarkRecord)).toEqual(
      SOURCE_WATERMARK_RECORD_FIELDS
    );
  });

  it('defines both tables, their constraints, and required indexes in the migration', () => {
    const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

    expect(migrationSql).toContain(
      'create table if not exists public.ingestion_jobs'
    );
    expect(migrationSql).toContain(
      'create table if not exists public.source_watermarks'
    );
    expect(migrationSql).toContain(
      'create unique index if not exists ingestion_jobs_idempotency_key_uidx'
    );
    expect(migrationSql).toContain(
      'create unique index if not exists source_watermarks_scope_uidx'
    );
    expect(migrationSql).toContain(
      "check (processing_status in ('requested', 'processing', 'available', 'failed'))"
    );
    expect(migrationSql).toContain(
      "check (status in ('unknown', 'requested', 'available', 'failed'))"
    );
    expect(migrationSql).toContain(
      'create or replace function public.ingestion_backbone_set_updated_at()'
    );
    expect(migrationSql).toContain(
      'create trigger ingestion_jobs_set_updated_at_tg'
    );
    expect(migrationSql).toContain(
      'create trigger source_watermarks_set_updated_at_tg'
    );
    expect(migrationSql).toContain(
      'references public.ingestion_jobs(id) on delete set null'
    );
  });
});
