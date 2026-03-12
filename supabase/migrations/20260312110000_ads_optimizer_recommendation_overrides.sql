create table if not exists public.ads_optimizer_recommendation_overrides (
  recommendation_override_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  product_id uuid not null
    references public.products(product_id) on delete cascade,
  asin text not null,
  target_id text not null,
  run_id uuid not null
    references public.ads_optimizer_runs(run_id) on delete cascade,
  target_snapshot_id uuid not null
    references public.ads_optimizer_target_snapshot(target_snapshot_id) on delete cascade,
  recommendation_snapshot_id uuid not null
    references public.ads_optimizer_recommendation_snapshot(recommendation_snapshot_id) on delete cascade,
  override_scope text not null,
  replacement_action_bundle_json jsonb not null default '{"actions":[]}'::jsonb,
  operator_note text not null,
  is_archived boolean not null default false,
  last_applied_at timestamptz null,
  last_applied_change_set_id uuid null
    references public.ads_change_sets(id) on delete set null,
  apply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint ads_optimizer_recommendation_overrides_scope_chk
    check (override_scope in ('one_time', 'persistent')),
  constraint ads_optimizer_recommendation_overrides_bundle_object_chk
    check (jsonb_typeof(replacement_action_bundle_json) = 'object'),
  constraint ads_optimizer_recommendation_overrides_note_chk
    check (char_length(btrim(operator_note)) > 0),
  constraint ads_optimizer_recommendation_overrides_archive_metadata_chk
    check ((is_archived = false and archived_at is null) or (is_archived = true and archived_at is not null)),
  constraint ads_optimizer_recommendation_overrides_apply_count_chk
    check (apply_count >= 0)
);

create unique index if not exists ads_optimizer_recommendation_overrides_one_time_active_unique_idx
  on public.ads_optimizer_recommendation_overrides (recommendation_snapshot_id)
  where is_archived = false and override_scope = 'one_time';

create unique index if not exists ads_optimizer_recommendation_overrides_persistent_active_unique_idx
  on public.ads_optimizer_recommendation_overrides (product_id, target_id)
  where is_archived = false and override_scope = 'persistent';

create index if not exists ads_optimizer_recommendation_overrides_scope_created_idx
  on public.ads_optimizer_recommendation_overrides (
    account_id,
    marketplace,
    product_id,
    target_id,
    created_at desc
  );

create index if not exists ads_optimizer_recommendation_overrides_recommendation_idx
  on public.ads_optimizer_recommendation_overrides (
    recommendation_snapshot_id,
    created_at desc
  );

alter table public.ads_optimizer_recommendation_overrides enable row level security;

drop policy if exists ads_optimizer_recommendation_overrides_select on public.ads_optimizer_recommendation_overrides;
create policy ads_optimizer_recommendation_overrides_select
  on public.ads_optimizer_recommendation_overrides
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_recommendation_overrides_insert on public.ads_optimizer_recommendation_overrides;
create policy ads_optimizer_recommendation_overrides_insert
  on public.ads_optimizer_recommendation_overrides
  for insert
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and exists (
      select 1
      from public.products p
      where p.product_id = ads_optimizer_recommendation_overrides.product_id
        and p.account_id = ads_optimizer_recommendation_overrides.account_id
        and p.marketplace = ads_optimizer_recommendation_overrides.marketplace
    )
  );

drop policy if exists ads_optimizer_recommendation_overrides_update on public.ads_optimizer_recommendation_overrides;
create policy ads_optimizer_recommendation_overrides_update
  on public.ads_optimizer_recommendation_overrides
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and exists (
      select 1
      from public.products p
      where p.product_id = ads_optimizer_recommendation_overrides.product_id
        and p.account_id = ads_optimizer_recommendation_overrides.account_id
        and p.marketplace = ads_optimizer_recommendation_overrides.marketplace
    )
  );

drop policy if exists ads_optimizer_recommendation_overrides_delete on public.ads_optimizer_recommendation_overrides;
create policy ads_optimizer_recommendation_overrides_delete
  on public.ads_optimizer_recommendation_overrides
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));
