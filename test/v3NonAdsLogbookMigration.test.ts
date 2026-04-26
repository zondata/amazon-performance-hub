import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260426190000_v3_non_ads_logbook.sql'
);

describe('V3 non-ads logbook migration', () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  it('adds manual planning fields to log_changes without dropping tables', () => {
    expect(migrationSql).toContain('add column if not exists expected_outcome');
    expect(migrationSql).toContain('add column if not exists evaluation_window_days');
    expect(migrationSql).toContain('add column if not exists notes');
    expect(migrationSql.toLowerCase()).not.toContain('drop table');
  });

  it('creates change outcome evaluations and ASIN/SKU entity links', () => {
    expect(migrationSql).toContain('create table if not exists public.change_outcome_evaluations');
    expect(migrationSql).toContain('change_id uuid not null references public.log_changes(change_id)');
    expect(migrationSql).toContain('actual_result text null');
    expect(migrationSql).toContain('learning text null');
    expect(migrationSql).toContain('add column if not exists asin');
    expect(migrationSql).toContain('add column if not exists sku');
  });
});
