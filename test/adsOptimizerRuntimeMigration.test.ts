import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260310143000_ads_optimizer_runtime_backbone.sql'
);

describe('ads optimizer runtime migration', () => {
  it('creates the Phase 4 runtime tables', () => {
    const source = fs.readFileSync(migrationPath, 'utf-8');

    expect(source).toContain('create table if not exists public.ads_optimizer_runs');
    expect(source).toContain('create table if not exists public.ads_optimizer_product_snapshot');
    expect(source).toContain('create table if not exists public.ads_optimizer_target_snapshot');
    expect(source).toContain('create table if not exists public.ads_optimizer_role_transition_log');
    expect(source).toContain('create table if not exists public.ads_optimizer_recommendation_snapshot');
  });

  it('defines run statuses and append-only protections', () => {
    const source = fs.readFileSync(migrationPath, 'utf-8');

    expect(source).toContain("check (status in ('pending', 'running', 'completed', 'failed'))");
    expect(source).toContain('create or replace function public.ads_optimizer_run_mutable()');
    expect(source).toContain('create or replace function public.ads_optimizer_runtime_row_immutable()');
    expect(source).toContain(
      'ads_optimizer_runs are append-only except for status, diagnostics, counts, started_at, completed_at'
    );
    expect(source).toContain('create trigger ads_optimizer_product_snapshot_immutable_tg');
    expect(source).toContain('create trigger ads_optimizer_target_snapshot_immutable_tg');
    expect(source).toContain('create trigger ads_optimizer_recommendation_snapshot_immutable_tg');
  });
});
