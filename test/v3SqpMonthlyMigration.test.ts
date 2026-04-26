import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260426173000_v3_sqp_monthly_raw.sql'
);

describe('V3 SQP monthly migration', () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  it('creates the monthly raw table without destructive statements', () => {
    expect(migrationSql).toContain('create table if not exists sqp_monthly_raw');
    expect(migrationSql.toLowerCase()).not.toContain('drop table');
  });

  it('uses the monthly natural key and latest views', () => {
    expect(migrationSql).toContain('constraint sqp_monthly_raw_uq unique');
    for (const column of [
      'account_id',
      'marketplace',
      'scope_type',
      'scope_value',
      'period_end',
      'search_query_norm',
      'exported_at',
    ]) {
      expect(migrationSql).toContain(column);
    }
    expect(migrationSql).toContain('create or replace view sqp_monthly_latest');
    expect(migrationSql).toContain('create or replace view sqp_monthly_latest_enriched');
  });
});
