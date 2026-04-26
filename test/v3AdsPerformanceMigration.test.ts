import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260426160000_v3_ads_performance_natural_keys.sql'
);

describe('V3 ads performance natural key migration', () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  it('adds a non-destructive lookup index for SP advertised product rows', () => {
    expect(migrationSql).toContain(
      'create index if not exists sp_advertised_product_daily_fact_natural_idx'
    );
    expect(migrationSql).not.toContain(
      'create unique index if not exists sp_advertised_product_daily_fact_natural_idx'
    );
  });

  it('adds a unique natural key for SB attributed purchases where source rows are clean', () => {
    expect(migrationSql).toContain(
      'create unique index if not exists sb_attributed_purchases_daily_fact_uq'
    );
    for (const column of [
      'account_id',
      'date',
      'campaign_id',
      'purchased_sku_norm',
      'purchased_asin_norm',
      'exported_at',
    ]) {
      expect(migrationSql).toContain(column);
    }
  });
});
