import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260426110000_v3_database_control_layer.sql'
);

describe('V3 database control layer migration', () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  it('creates the required Phase 1 control tables idempotently', () => {
    for (const tableName of [
      'api_connections',
      'api_sync_runs',
      'api_sync_cursors',
      'ads_settings_snapshot_runs',
      'report_data_status',
      'data_quality_checks',
    ]) {
      expect(migrationSql).toContain(
        `create table if not exists public.${tableName}`
      );
    }
  });

  it('enforces the shared data_status convention', () => {
    expect(migrationSql).toContain(
      "check (data_status in ('live', 'preliminary', 'final', 'failed', 'manual_unknown'))"
    );
  });

  it('indexes source, scope, status, and freshness dimensions', () => {
    for (const indexName of [
      'api_connections_scope_uidx',
      'api_sync_runs_account_market_source_idx',
      'api_sync_cursors_scope_uidx',
      'ads_settings_snapshot_runs_scope_idx',
      'report_data_status_scope_uidx',
      'data_quality_checks_scope_idx',
    ]) {
      expect(migrationSql).toContain(indexName);
    }
  });

  it('stores secret references rather than direct secret material', () => {
    expect(migrationSql).toContain('auth_secret_ref text null');
    expect(migrationSql).toContain('api_connections_secret_ref_not_secret_chk');
    expect(migrationSql).not.toContain('access_token');
    expect(migrationSql).not.toContain('refresh_token');
  });

  it('provides helper SQL for validation check writes', () => {
    expect(migrationSql).toContain(
      'create or replace function public.record_data_quality_check'
    );
    expect(migrationSql).toContain('returns uuid');
    expect(migrationSql).toContain('insert into public.data_quality_checks');
  });
});
