import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260312110000_ads_optimizer_recommendation_overrides.sql'
);

describe('ads optimizer recommendation override migration', () => {
  it('creates the dedicated target-level recommendation override table and indexes', () => {
    const source = fs.readFileSync(migrationPath, 'utf-8');

    expect(source).toContain(
      'create table if not exists public.ads_optimizer_recommendation_overrides'
    );
    expect(source).toContain(
      'ads_optimizer_recommendation_overrides_one_time_active_unique_idx'
    );
    expect(source).toContain(
      'ads_optimizer_recommendation_overrides_persistent_active_unique_idx'
    );
    expect(source).toContain('replacement_action_bundle_json jsonb not null');
    expect(source).toContain('operator_note text not null');
    expect(source).toContain('last_applied_change_set_id uuid null');
  });

  it('keeps account-scoped RLS around the override log', () => {
    const source = fs.readFileSync(migrationPath, 'utf-8');

    expect(source).toContain(
      'alter table public.ads_optimizer_recommendation_overrides enable row level security;'
    );
    expect(source).toContain('create policy ads_optimizer_recommendation_overrides_select');
    expect(source).toContain('create policy ads_optimizer_recommendation_overrides_insert');
    expect(source).toContain('create policy ads_optimizer_recommendation_overrides_update');
    expect(source).toContain('create policy ads_optimizer_recommendation_overrides_delete');
  });
});
