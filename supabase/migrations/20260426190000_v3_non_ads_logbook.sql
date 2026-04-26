-- V3 Phase 7: manual non-ads logbook fields and later outcome evaluations.

alter table public.log_changes
  add column if not exists expected_outcome text null,
  add column if not exists evaluation_window_days integer null,
  add column if not exists notes text null;

alter table public.log_change_entities
  add column if not exists asin text null,
  add column if not exists sku text null;

create table if not exists public.change_outcome_evaluations (
  evaluation_id uuid primary key default gen_random_uuid(),
  change_id uuid not null references public.log_changes(change_id) on delete cascade,
  account_id text not null,
  marketplace text not null,
  evaluated_at timestamptz not null default now(),
  window_start date null,
  window_end date null,
  actual_result text null,
  learning text null,
  notes text null,
  metrics_json jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists change_outcome_evaluations_change_id_idx
  on public.change_outcome_evaluations(change_id);

create index if not exists change_outcome_evaluations_account_market_eval_idx
  on public.change_outcome_evaluations(account_id, marketplace, evaluated_at desc);

create index if not exists log_change_entities_asin_idx
  on public.log_change_entities(asin);

create index if not exists log_change_entities_sku_idx
  on public.log_change_entities(sku);
