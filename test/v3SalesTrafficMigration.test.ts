import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260426123000_v3_amazon_sales_traffic_timeseries.sql'
);

describe('V3 Amazon Sales and Traffic timeseries migration', () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  it('creates the canonical timeseries table and latest view', () => {
    expect(migrationSql).toContain(
      'create table if not exists public.amazon_sales_traffic_timeseries'
    );
    expect(migrationSql).toContain(
      'create or replace view public.amazon_sales_traffic_timeseries_latest'
    );
  });

  it('preserves required Phase 2 identity, status, and raw payload columns', () => {
    for (const column of [
      'account_id text not null',
      'marketplace text not null',
      'sync_run_id uuid null',
      'source text not null',
      'report_type text not null',
      'granularity text not null',
      'asin_granularity text not null',
      'data_status text not null',
      'last_refreshed_at timestamptz not null',
      'raw_json jsonb not null',
    ]) {
      expect(migrationSql).toContain(column);
    }
  });

  it('stores derived metrics as generated columns with null-safe denominators', () => {
    expect(migrationSql).toContain('avg_sales_price_calc numeric generated always as');
    expect(migrationSql).toContain('when units_ordered is null or units_ordered = 0 then null');
    expect(migrationSql).toContain('unit_session_percentage_calc numeric generated always as');
    expect(migrationSql).toContain('when sessions is null or sessions = 0 then null');
  });

  it('backfills from the existing proven SP-API retail warehouse rows', () => {
    expect(migrationSql).toContain(
      'from public.spapi_sales_and_traffic_by_date_report_rows'
    );
    expect(migrationSql).toContain(
      'from public.spapi_sales_and_traffic_by_asin_report_rows'
    );
    expect(migrationSql).toContain('select distinct on');
    expect(migrationSql).toContain('exported_at desc');
    expect(migrationSql).toContain("'sp-api-sales-and-traffic'");
  });

  it('adds duplicate protection and data finality constraints', () => {
    expect(migrationSql).toContain(
      'amazon_sales_traffic_timeseries_natural_uidx'
    );
    expect(migrationSql).toContain(
      "check (data_status in ('live', 'preliminary', 'final', 'failed', 'manual_unknown'))"
    );
    expect(migrationSql).toContain(
      'amazon_sales_traffic_timeseries_final_consistency_chk'
    );
  });
});
