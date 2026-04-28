create table if not exists public.data_coverage_status (
  coverage_id uuid primary key default gen_random_uuid(),
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  source_type text not null,
  table_name text not null,
  granularity text not null,
  oldest_period_start timestamptz null,
  latest_period_end timestamptz null,
  latest_complete_period_end timestamptz null,
  last_attempted_run_at timestamptz null,
  last_successful_run_at timestamptz null,
  last_sync_run_id uuid null
    references public.api_sync_runs(sync_run_id) on delete set null,
  last_status text not null default 'unknown',
  freshness_status text not null default 'unknown',
  expected_delay_hours integer not null default 48,
  row_count bigint not null default 0,
  missing_ranges jsonb not null default '[]'::jsonb,
  warning_count integer not null default 0,
  error_count integer not null default 0,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint data_coverage_status_scope_uq
    unique (account_id, marketplace, source_type, table_name, granularity),
  constraint data_coverage_status_last_status_chk
    check (last_status in ('unknown', 'success', 'partial', 'failed', 'blocked', 'no_data')),
  constraint data_coverage_status_freshness_status_chk
    check (freshness_status in ('unknown', 'fresh', 'delayed_expected', 'stale', 'blocked', 'no_data')),
  constraint data_coverage_status_nonnegative_chk
    check (
      expected_delay_hours >= 0
      and row_count >= 0
      and warning_count >= 0
      and error_count >= 0
    ),
  constraint data_coverage_status_missing_ranges_array_chk
    check (jsonb_typeof(missing_ranges) = 'array'),
  constraint data_coverage_status_complete_not_after_latest_chk
    check (
      latest_complete_period_end is null
      or latest_period_end is null
      or latest_complete_period_end <= latest_period_end
    )
);

create index if not exists data_coverage_status_scope_idx
  on public.data_coverage_status (account_id, marketplace, source_type, granularity);

create index if not exists data_coverage_status_freshness_idx
  on public.data_coverage_status (freshness_status, latest_period_end desc nulls last);

drop trigger if exists data_coverage_status_set_updated_at_tg
  on public.data_coverage_status;
create trigger data_coverage_status_set_updated_at_tg
  before update on public.data_coverage_status
  for each row
  execute function public.v3_control_set_updated_at();

create or replace view public.v_mcp_data_coverage_status as
select
  account_id,
  marketplace,
  source_type,
  table_name,
  granularity,
  oldest_period_start,
  latest_period_end,
  latest_complete_period_end,
  last_attempted_run_at,
  last_successful_run_at,
  last_sync_run_id,
  last_status,
  freshness_status,
  expected_delay_hours,
  row_count,
  missing_ranges,
  warning_count,
  error_count,
  notes,
  updated_at
from public.data_coverage_status;

grant select on public.v_mcp_data_coverage_status to authenticated, service_role;
