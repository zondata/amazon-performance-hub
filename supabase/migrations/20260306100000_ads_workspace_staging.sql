create table if not exists public.ads_change_sets (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  experiment_id uuid null
    references public.log_experiments(experiment_id) on delete set null,
  name text not null,
  status text not null,
  objective text null,
  hypothesis text null,
  forecast_window_days integer null,
  review_after_days integer null,
  notes text null,
  filters_json jsonb not null default '{}'::jsonb,
  generated_run_id text null,
  generated_artifact_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_change_sets_status_chk
    check (status in ('draft', 'review_ready', 'generated', 'cancelled'))
);

create table if not exists public.ads_objective_presets (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  channel text null,
  name text not null,
  objective text not null,
  hypothesis text null,
  forecast_json jsonb null,
  review_after_days integer null,
  notes text null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ads_change_set_items (
  id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null
    references public.ads_change_sets(id) on delete cascade,
  channel text not null,
  entity_level text not null,
  entity_key text not null,
  campaign_id text null,
  ad_group_id text null,
  target_id text null,
  target_key text null,
  placement_code text null,
  action_type text not null,
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  objective text null,
  hypothesis text null,
  forecast_json jsonb null,
  review_after_days integer null,
  notes text null,
  objective_preset_id uuid null
    references public.ads_objective_presets(id) on delete set null,
  ui_context_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_change_set_items_entity_level_chk
    check (entity_level in ('campaign', 'placement', 'ad_group', 'target', 'search_term_context'))
);

create index if not exists ads_change_sets_account_status_updated_idx
  on public.ads_change_sets (account_id, status, updated_at desc);

create index if not exists ads_change_sets_experiment_id_idx
  on public.ads_change_sets (experiment_id);

create index if not exists ads_change_set_items_change_set_created_idx
  on public.ads_change_set_items (change_set_id, created_at);

create index if not exists ads_change_set_items_channel_entity_level_idx
  on public.ads_change_set_items (channel, entity_level);

create index if not exists ads_change_set_items_campaign_id_idx
  on public.ads_change_set_items (campaign_id);

create index if not exists ads_change_set_items_ad_group_id_idx
  on public.ads_change_set_items (ad_group_id);

create index if not exists ads_change_set_items_target_id_idx
  on public.ads_change_set_items (target_id);

create index if not exists ads_objective_presets_scope_archived_updated_idx
  on public.ads_objective_presets (account_id, marketplace, is_archived, updated_at desc);

create or replace function public.ads_workspace_change_set_allowed(p_change_set_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.ads_change_sets s
    where s.id = p_change_set_id
      and public.logbook_account_scope_allowed(s.account_id, s.marketplace)
  );
$$;

alter table public.ads_change_sets enable row level security;
alter table public.ads_change_set_items enable row level security;
alter table public.ads_objective_presets enable row level security;

drop policy if exists ads_change_sets_select on public.ads_change_sets;
create policy ads_change_sets_select
  on public.ads_change_sets
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_change_sets_insert on public.ads_change_sets;
create policy ads_change_sets_insert
  on public.ads_change_sets
  for insert
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and (
      experiment_id is null
      or public.logbook_experiment_access_allowed(experiment_id)
    )
  );

drop policy if exists ads_change_sets_update on public.ads_change_sets;
create policy ads_change_sets_update
  on public.ads_change_sets
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and (
      experiment_id is null
      or public.logbook_experiment_access_allowed(experiment_id)
    )
  );

drop policy if exists ads_change_sets_delete on public.ads_change_sets;
create policy ads_change_sets_delete
  on public.ads_change_sets
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_change_set_items_select on public.ads_change_set_items;
create policy ads_change_set_items_select
  on public.ads_change_set_items
  for select
  using (public.ads_workspace_change_set_allowed(change_set_id));

drop policy if exists ads_change_set_items_insert on public.ads_change_set_items;
create policy ads_change_set_items_insert
  on public.ads_change_set_items
  for insert
  with check (
    public.ads_workspace_change_set_allowed(change_set_id)
    and (
      objective_preset_id is null
      or exists (
        select 1
        from public.ads_objective_presets p
        where p.id = objective_preset_id
          and public.logbook_account_scope_allowed(p.account_id, p.marketplace)
      )
    )
  );

drop policy if exists ads_change_set_items_update on public.ads_change_set_items;
create policy ads_change_set_items_update
  on public.ads_change_set_items
  for update
  using (public.ads_workspace_change_set_allowed(change_set_id))
  with check (
    public.ads_workspace_change_set_allowed(change_set_id)
    and (
      objective_preset_id is null
      or exists (
        select 1
        from public.ads_objective_presets p
        where p.id = objective_preset_id
          and public.logbook_account_scope_allowed(p.account_id, p.marketplace)
      )
    )
  );

drop policy if exists ads_change_set_items_delete on public.ads_change_set_items;
create policy ads_change_set_items_delete
  on public.ads_change_set_items
  for delete
  using (public.ads_workspace_change_set_allowed(change_set_id));

drop policy if exists ads_objective_presets_select on public.ads_objective_presets;
create policy ads_objective_presets_select
  on public.ads_objective_presets
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_objective_presets_insert on public.ads_objective_presets;
create policy ads_objective_presets_insert
  on public.ads_objective_presets
  for insert
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_objective_presets_update on public.ads_objective_presets;
create policy ads_objective_presets_update
  on public.ads_objective_presets
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_objective_presets_delete on public.ads_objective_presets;
create policy ads_objective_presets_delete
  on public.ads_objective_presets
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));
