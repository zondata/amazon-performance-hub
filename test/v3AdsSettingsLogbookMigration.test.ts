import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../supabase/migrations/20260426143000_v3_ads_settings_snapshot_logbook.sql'
);

describe('V3 ads settings snapshot logbook migration', () => {
  const migrationSql = fs.readFileSync(MIGRATION_PATH, 'utf8');

  it('adds structured logbook metadata needed by automatic settings changes', () => {
    expect(migrationSql).toContain('add column if not exists entity_level text');
    expect(migrationSql).toContain('add column if not exists field_name text');
    expect(migrationSql).toContain('automatic_ads_settings_snapshot');
    expect(migrationSql).toContain('dedupe_key');
  });

  it('normalizes SP, SB, and SD bulk snapshots into one settings row view', () => {
    expect(migrationSql).toContain(
      'create or replace view public.v3_ads_settings_snapshot_rows'
    );
    for (const tableName of [
      'public.bulk_campaigns',
      'public.bulk_targets',
      'public.bulk_placements',
      'public.bulk_product_ads',
      'public.bulk_sb_campaigns',
      'public.bulk_sb_targets',
      'public.bulk_sb_placements',
      'public.bulk_sd_campaigns',
      'public.bulk_sd_targets',
      'public.bulk_sd_product_ads',
    ]) {
      expect(migrationSql).toContain(tableName);
    }
  });

  it('captures snapshots, diffs against previous snapshots, and writes run/status rows', () => {
    expect(migrationSql).toContain(
      'create or replace function public.v3_capture_ads_settings_snapshot'
    );
    expect(migrationSql).toContain('public.ads_settings_snapshot_runs');
    expect(migrationSql).toContain('public.report_data_status');
    expect(migrationSql).toContain('previous_snapshot_date');
  });

  it('writes deduped log changes and linked entities', () => {
    expect(migrationSql).toContain('insert into public.log_changes');
    expect(migrationSql).toContain('on conflict (account_id, dedupe_key) do nothing');
    expect(migrationSql).toContain('insert into public.log_change_entities');
    expect(migrationSql).toContain("'ads_setting_changed'");
  });

  it('covers the required phase-three setting fields', () => {
    for (const fieldName of [
      'campaign_name',
      'state',
      'daily_budget',
      'bidding_strategy',
      'portfolio_id',
      'ad_group_name',
      'default_bid',
      'target_expression',
      'match_type',
      'is_negative',
      'bid',
      'placement_modifier_pct',
      'product_ad_sku',
      'product_ad_asin',
      'tactic',
      'cost_type',
      'bid_optimization',
    ]) {
      expect(migrationSql).toContain(fieldName);
    }
  });
});
