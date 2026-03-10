import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260310110000_ads_optimizer_config_foundation.sql'
);

describe('ads optimizer config migration', () => {
  it('creates the Phase 2 optimizer config tables and indexes', () => {
    const source = fs.readFileSync(migrationPath, 'utf-8');

    expect(source).toContain('create table if not exists public.ads_optimizer_rule_packs');
    expect(source).toContain('create table if not exists public.ads_optimizer_rule_pack_versions');
    expect(source).toContain('create table if not exists public.ads_optimizer_product_settings');
    expect(source).toContain('create table if not exists public.ads_optimizer_manual_overrides');
    expect(source).toContain('ads_optimizer_rule_pack_versions_active_unique_idx');
    expect(source).toContain('ads_optimizer_product_settings_scope_version_idx');
    expect(source).toContain('ads_optimizer_manual_overrides_active_unique_idx');
  });

  it('protects version history immutability after insert', () => {
    const source = fs.readFileSync(migrationPath, 'utf-8');

    expect(source).toContain('create or replace function public.ads_optimizer_rule_pack_version_immutable()');
    expect(source).toContain(
      'ads_optimizer_rule_pack_versions are immutable except for status, activated_at, archived_at'
    );
    expect(source).toContain('create trigger ads_optimizer_rule_pack_versions_immutable_tg');
    expect(source).toContain("check (status in ('draft', 'active', 'archived'))");
  });
});
