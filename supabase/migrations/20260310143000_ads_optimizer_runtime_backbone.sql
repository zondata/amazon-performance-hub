create table if not exists public.ads_optimizer_runs (
  run_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  channel text not null,
  scope_type text not null,
  selected_asin text not null,
  run_kind text not null,
  date_start date not null,
  date_end date not null,
  rule_pack_version_id uuid not null
    references public.ads_optimizer_rule_pack_versions(rule_pack_version_id) on delete restrict,
  rule_pack_version_label text not null,
  status text not null,
  input_summary_json jsonb not null default '{}'::jsonb,
  diagnostics_json jsonb null,
  product_snapshot_count integer not null default 0,
  target_snapshot_count integer not null default 0,
  recommendation_snapshot_count integer not null default 0,
  role_transition_count integer not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  constraint ads_optimizer_runs_channel_chk
    check (channel in ('sp')),
  constraint ads_optimizer_runs_scope_type_chk
    check (scope_type in ('product')),
  constraint ads_optimizer_runs_run_kind_chk
    check (run_kind in ('manual')),
  constraint ads_optimizer_runs_status_chk
    check (status in ('pending', 'running', 'completed', 'failed')),
  constraint ads_optimizer_runs_selected_asin_chk
    check (char_length(btrim(selected_asin)) > 0),
  constraint ads_optimizer_runs_rule_pack_version_label_chk
    check (char_length(btrim(rule_pack_version_label)) > 0),
  constraint ads_optimizer_runs_date_window_chk
    check (date_end >= date_start),
  constraint ads_optimizer_runs_status_metadata_chk
    check (
      (status = 'pending' and started_at is null and completed_at is null)
      or (status = 'running' and started_at is not null and completed_at is null)
      or (status = 'completed' and started_at is not null and completed_at is not null)
      or (status = 'failed' and started_at is not null and completed_at is not null)
    )
);

create index if not exists ads_optimizer_runs_scope_created_idx
  on public.ads_optimizer_runs (
    account_id,
    marketplace,
    channel,
    selected_asin,
    created_at desc
  );

create index if not exists ads_optimizer_runs_status_created_idx
  on public.ads_optimizer_runs (
    status,
    created_at desc
  );

create table if not exists public.ads_optimizer_product_snapshot (
  product_snapshot_id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.ads_optimizer_runs(run_id) on delete cascade,
  account_id text not null,
  marketplace text not null,
  product_id uuid null
    references public.products(product_id) on delete set null,
  asin text not null,
  snapshot_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ads_optimizer_product_snapshot_asin_chk
    check (char_length(btrim(asin)) > 0)
);

create unique index if not exists ads_optimizer_product_snapshot_run_asin_uidx
  on public.ads_optimizer_product_snapshot (run_id, asin);

create index if not exists ads_optimizer_product_snapshot_scope_created_idx
  on public.ads_optimizer_product_snapshot (
    account_id,
    marketplace,
    asin,
    created_at desc
  );

create table if not exists public.ads_optimizer_target_snapshot (
  target_snapshot_id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.ads_optimizer_runs(run_id) on delete cascade,
  account_id text not null,
  marketplace text not null,
  asin text not null,
  campaign_id text not null,
  ad_group_id text not null,
  target_id text not null,
  source_scope text not null,
  coverage_note text null,
  snapshot_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ads_optimizer_target_snapshot_asin_chk
    check (char_length(btrim(asin)) > 0),
  constraint ads_optimizer_target_snapshot_campaign_chk
    check (char_length(btrim(campaign_id)) > 0),
  constraint ads_optimizer_target_snapshot_ad_group_chk
    check (char_length(btrim(ad_group_id)) > 0),
  constraint ads_optimizer_target_snapshot_target_chk
    check (char_length(btrim(target_id)) > 0),
  constraint ads_optimizer_target_snapshot_source_scope_chk
    check (char_length(btrim(source_scope)) > 0)
);

create unique index if not exists ads_optimizer_target_snapshot_run_target_uidx
  on public.ads_optimizer_target_snapshot (run_id, target_id);

create index if not exists ads_optimizer_target_snapshot_scope_created_idx
  on public.ads_optimizer_target_snapshot (
    account_id,
    marketplace,
    asin,
    created_at desc
  );

create table if not exists public.ads_optimizer_recommendation_snapshot (
  recommendation_snapshot_id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.ads_optimizer_runs(run_id) on delete cascade,
  target_snapshot_id uuid not null
    references public.ads_optimizer_target_snapshot(target_snapshot_id) on delete cascade,
  account_id text not null,
  marketplace text not null,
  asin text not null,
  status text not null,
  action_type text null,
  reason_codes_json jsonb null,
  snapshot_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ads_optimizer_recommendation_snapshot_asin_chk
    check (char_length(btrim(asin)) > 0),
  constraint ads_optimizer_recommendation_snapshot_status_chk
    check (status in ('pending_phase5', 'generated', 'skipped'))
);

create unique index if not exists ads_optimizer_recommendation_snapshot_run_target_uidx
  on public.ads_optimizer_recommendation_snapshot (run_id, target_snapshot_id);

create index if not exists ads_optimizer_recommendation_snapshot_scope_created_idx
  on public.ads_optimizer_recommendation_snapshot (
    account_id,
    marketplace,
    asin,
    created_at desc
  );

create table if not exists public.ads_optimizer_role_transition_log (
  role_transition_log_id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.ads_optimizer_runs(run_id) on delete cascade,
  target_snapshot_id uuid null
    references public.ads_optimizer_target_snapshot(target_snapshot_id) on delete cascade,
  account_id text not null,
  marketplace text not null,
  asin text not null,
  target_id text null,
  from_role text null,
  to_role text null,
  transition_reason_json jsonb null,
  created_at timestamptz not null default now(),
  constraint ads_optimizer_role_transition_log_asin_chk
    check (char_length(btrim(asin)) > 0),
  constraint ads_optimizer_role_transition_log_from_role_chk
    check (
      from_role is null
      or from_role in ('Discover', 'Harvest', 'Scale', 'Rank Push', 'Rank Defend', 'Suppress')
    ),
  constraint ads_optimizer_role_transition_log_to_role_chk
    check (
      to_role is null
      or to_role in ('Discover', 'Harvest', 'Scale', 'Rank Push', 'Rank Defend', 'Suppress')
    )
);

create index if not exists ads_optimizer_role_transition_log_scope_created_idx
  on public.ads_optimizer_role_transition_log (
    account_id,
    marketplace,
    asin,
    created_at desc
  );

create or replace function public.ads_optimizer_run_allowed(p_run_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.ads_optimizer_runs r
    where r.run_id = p_run_id
      and public.logbook_account_scope_allowed(r.account_id, r.marketplace)
  );
$$;

create or replace function public.ads_optimizer_run_mutable()
returns trigger
language plpgsql
as $$
begin
  if (
    (to_jsonb(new)
      - 'status'
      - 'diagnostics_json'
      - 'product_snapshot_count'
      - 'target_snapshot_count'
      - 'recommendation_snapshot_count'
      - 'role_transition_count'
      - 'started_at'
      - 'completed_at')
    <>
    (to_jsonb(old)
      - 'status'
      - 'diagnostics_json'
      - 'product_snapshot_count'
      - 'target_snapshot_count'
      - 'recommendation_snapshot_count'
      - 'role_transition_count'
      - 'started_at'
      - 'completed_at')
  ) then
    raise exception 'ads_optimizer_runs are append-only except for status, diagnostics, counts, started_at, completed_at';
  end if;
  return new;
end;
$$;

create or replace function public.ads_optimizer_runtime_row_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ads optimizer runtime snapshot rows are immutable';
end;
$$;

drop trigger if exists ads_optimizer_runs_mutable_tg
  on public.ads_optimizer_runs;
create trigger ads_optimizer_runs_mutable_tg
  before update on public.ads_optimizer_runs
  for each row
  execute function public.ads_optimizer_run_mutable();

drop trigger if exists ads_optimizer_product_snapshot_immutable_tg
  on public.ads_optimizer_product_snapshot;
create trigger ads_optimizer_product_snapshot_immutable_tg
  before update on public.ads_optimizer_product_snapshot
  for each row
  execute function public.ads_optimizer_runtime_row_immutable();

drop trigger if exists ads_optimizer_target_snapshot_immutable_tg
  on public.ads_optimizer_target_snapshot;
create trigger ads_optimizer_target_snapshot_immutable_tg
  before update on public.ads_optimizer_target_snapshot
  for each row
  execute function public.ads_optimizer_runtime_row_immutable();

drop trigger if exists ads_optimizer_recommendation_snapshot_immutable_tg
  on public.ads_optimizer_recommendation_snapshot;
create trigger ads_optimizer_recommendation_snapshot_immutable_tg
  before update on public.ads_optimizer_recommendation_snapshot
  for each row
  execute function public.ads_optimizer_runtime_row_immutable();

drop trigger if exists ads_optimizer_role_transition_log_immutable_tg
  on public.ads_optimizer_role_transition_log;
create trigger ads_optimizer_role_transition_log_immutable_tg
  before update on public.ads_optimizer_role_transition_log
  for each row
  execute function public.ads_optimizer_runtime_row_immutable();

alter table public.ads_optimizer_runs enable row level security;
alter table public.ads_optimizer_product_snapshot enable row level security;
alter table public.ads_optimizer_target_snapshot enable row level security;
alter table public.ads_optimizer_recommendation_snapshot enable row level security;
alter table public.ads_optimizer_role_transition_log enable row level security;

drop policy if exists ads_optimizer_runs_select on public.ads_optimizer_runs;
create policy ads_optimizer_runs_select
  on public.ads_optimizer_runs
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_runs_insert on public.ads_optimizer_runs;
create policy ads_optimizer_runs_insert
  on public.ads_optimizer_runs
  for insert
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_runs_update on public.ads_optimizer_runs;
create policy ads_optimizer_runs_update
  on public.ads_optimizer_runs
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_runs_delete on public.ads_optimizer_runs;
create policy ads_optimizer_runs_delete
  on public.ads_optimizer_runs
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_product_snapshot_select on public.ads_optimizer_product_snapshot;
create policy ads_optimizer_product_snapshot_select
  on public.ads_optimizer_product_snapshot
  for select
  using (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_product_snapshot_insert on public.ads_optimizer_product_snapshot;
create policy ads_optimizer_product_snapshot_insert
  on public.ads_optimizer_product_snapshot
  for insert
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_product_snapshot_update on public.ads_optimizer_product_snapshot;
create policy ads_optimizer_product_snapshot_update
  on public.ads_optimizer_product_snapshot
  for update
  using (public.ads_optimizer_run_allowed(run_id))
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_product_snapshot_delete on public.ads_optimizer_product_snapshot;
create policy ads_optimizer_product_snapshot_delete
  on public.ads_optimizer_product_snapshot
  for delete
  using (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_target_snapshot_select on public.ads_optimizer_target_snapshot;
create policy ads_optimizer_target_snapshot_select
  on public.ads_optimizer_target_snapshot
  for select
  using (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_target_snapshot_insert on public.ads_optimizer_target_snapshot;
create policy ads_optimizer_target_snapshot_insert
  on public.ads_optimizer_target_snapshot
  for insert
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_target_snapshot_update on public.ads_optimizer_target_snapshot;
create policy ads_optimizer_target_snapshot_update
  on public.ads_optimizer_target_snapshot
  for update
  using (public.ads_optimizer_run_allowed(run_id))
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_target_snapshot_delete on public.ads_optimizer_target_snapshot;
create policy ads_optimizer_target_snapshot_delete
  on public.ads_optimizer_target_snapshot
  for delete
  using (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_recommendation_snapshot_select on public.ads_optimizer_recommendation_snapshot;
create policy ads_optimizer_recommendation_snapshot_select
  on public.ads_optimizer_recommendation_snapshot
  for select
  using (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_recommendation_snapshot_insert on public.ads_optimizer_recommendation_snapshot;
create policy ads_optimizer_recommendation_snapshot_insert
  on public.ads_optimizer_recommendation_snapshot
  for insert
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_recommendation_snapshot_update on public.ads_optimizer_recommendation_snapshot;
create policy ads_optimizer_recommendation_snapshot_update
  on public.ads_optimizer_recommendation_snapshot
  for update
  using (public.ads_optimizer_run_allowed(run_id))
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_recommendation_snapshot_delete on public.ads_optimizer_recommendation_snapshot;
create policy ads_optimizer_recommendation_snapshot_delete
  on public.ads_optimizer_recommendation_snapshot
  for delete
  using (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_role_transition_log_select on public.ads_optimizer_role_transition_log;
create policy ads_optimizer_role_transition_log_select
  on public.ads_optimizer_role_transition_log
  for select
  using (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_role_transition_log_insert on public.ads_optimizer_role_transition_log;
create policy ads_optimizer_role_transition_log_insert
  on public.ads_optimizer_role_transition_log
  for insert
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_role_transition_log_update on public.ads_optimizer_role_transition_log;
create policy ads_optimizer_role_transition_log_update
  on public.ads_optimizer_role_transition_log
  for update
  using (public.ads_optimizer_run_allowed(run_id))
  with check (public.ads_optimizer_run_allowed(run_id));

drop policy if exists ads_optimizer_role_transition_log_delete on public.ads_optimizer_role_transition_log;
create policy ads_optimizer_role_transition_log_delete
  on public.ads_optimizer_role_transition_log
  for delete
  using (public.ads_optimizer_run_allowed(run_id));
