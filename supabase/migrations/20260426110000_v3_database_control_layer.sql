create table if not exists public.api_connections (
  connection_id uuid primary key default gen_random_uuid(),
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  source_type text not null,
  provider text not null,
  connection_name text not null,
  auth_secret_ref text null,
  status text not null default 'manual_unknown',
  scopes jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  last_verified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_connections_source_type_chk
    check (source_type in ('amazon_ads_api', 'amazon_sp_api', 'manual_upload', 'helium10_manual')),
  constraint api_connections_status_chk
    check (status in ('active', 'inactive', 'needs_auth', 'failed', 'manual_unknown')),
  constraint api_connections_scopes_array_chk
    check (jsonb_typeof(scopes) = 'array'),
  constraint api_connections_metadata_object_chk
    check (jsonb_typeof(metadata) = 'object'),
  constraint api_connections_secret_ref_not_secret_chk
    check (
      auth_secret_ref is null
      or auth_secret_ref !~* '(access|refresh|token|secret|password|credential)[=:]'
    )
);

create unique index if not exists api_connections_scope_uidx
  on public.api_connections (account_id, marketplace, source_type, provider, connection_name);

create index if not exists api_connections_account_marketplace_idx
  on public.api_connections (account_id, marketplace);

create index if not exists api_connections_source_status_idx
  on public.api_connections (source_type, status);

create table if not exists public.api_sync_runs (
  sync_run_id uuid primary key default gen_random_uuid(),
  connection_id uuid null
    references public.api_connections(connection_id) on delete set null,
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  source_type text not null,
  source_name text not null,
  table_name text not null,
  sync_kind text not null,
  status text not null,
  data_status text not null,
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  finished_at timestamptz null,
  source_window_start timestamptz null,
  source_window_end timestamptz null,
  backfill_start date null,
  backfill_end date null,
  rows_read integer null,
  rows_written integer null,
  rows_failed integer null,
  error_code text null,
  error_message text null,
  request_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  raw_json jsonb null,
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_sync_runs_sync_kind_chk
    check (sync_kind in ('sample', 'backfill', 'refresh', 'manual_upload', 'repair', 'validation')),
  constraint api_sync_runs_status_chk
    check (status in ('requested', 'running', 'succeeded', 'failed', 'skipped')),
  constraint api_sync_runs_data_status_chk
    check (data_status in ('live', 'preliminary', 'final', 'failed', 'manual_unknown')),
  constraint api_sync_runs_nonnegative_counts_chk
    check (
      coalesce(rows_read, 0) >= 0
      and coalesce(rows_written, 0) >= 0
      and coalesce(rows_failed, 0) >= 0
    ),
  constraint api_sync_runs_request_object_chk
    check (jsonb_typeof(request_json) = 'object'),
  constraint api_sync_runs_result_object_chk
    check (jsonb_typeof(result_json) = 'object')
);

create index if not exists api_sync_runs_account_market_source_idx
  on public.api_sync_runs (account_id, marketplace, source_type, source_name, requested_at desc);

create index if not exists api_sync_runs_table_status_idx
  on public.api_sync_runs (table_name, status, requested_at desc);

create index if not exists api_sync_runs_data_status_idx
  on public.api_sync_runs (data_status, last_refreshed_at desc);

create table if not exists public.api_sync_cursors (
  cursor_id uuid primary key default gen_random_uuid(),
  connection_id uuid null
    references public.api_connections(connection_id) on delete set null,
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  source_type text not null,
  source_name text not null,
  scope_key text not null default '',
  cursor_kind text not null,
  cursor_value text null,
  window_start timestamptz null,
  window_end timestamptz null,
  last_sync_run_id uuid null
    references public.api_sync_runs(sync_run_id) on delete set null,
  last_refreshed_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint api_sync_cursors_metadata_object_chk
    check (jsonb_typeof(metadata) = 'object')
);

create unique index if not exists api_sync_cursors_scope_uidx
  on public.api_sync_cursors (
    account_id,
    marketplace,
    source_type,
    source_name,
    scope_key,
    cursor_kind
  );

create index if not exists api_sync_cursors_refresh_idx
  on public.api_sync_cursors (account_id, marketplace, source_type, last_refreshed_at desc);

create table if not exists public.ads_settings_snapshot_runs (
  snapshot_run_id uuid primary key default gen_random_uuid(),
  sync_run_id uuid null
    references public.api_sync_runs(sync_run_id) on delete set null,
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  channel text not null,
  source_type text not null,
  snapshot_date date not null,
  exported_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  status text not null,
  data_status text not null,
  entities_seen integer not null default 0,
  changes_detected integer not null default 0,
  log_changes_written integer not null default 0,
  source_upload_id uuid null
    references public.uploads(upload_id) on delete set null,
  previous_snapshot_run_id uuid null
    references public.ads_settings_snapshot_runs(snapshot_run_id) on delete set null,
  summary_json jsonb not null default '{}'::jsonb,
  error_message text null,
  last_refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_settings_snapshot_runs_channel_chk
    check (channel in ('sp', 'sb', 'sd')),
  constraint ads_settings_snapshot_runs_status_chk
    check (status in ('requested', 'running', 'succeeded', 'failed', 'skipped')),
  constraint ads_settings_snapshot_runs_data_status_chk
    check (data_status in ('live', 'preliminary', 'final', 'failed', 'manual_unknown')),
  constraint ads_settings_snapshot_runs_nonnegative_counts_chk
    check (
      entities_seen >= 0
      and changes_detected >= 0
      and log_changes_written >= 0
    ),
  constraint ads_settings_snapshot_runs_summary_object_chk
    check (jsonb_typeof(summary_json) = 'object')
);

create index if not exists ads_settings_snapshot_runs_scope_idx
  on public.ads_settings_snapshot_runs (account_id, marketplace, channel, snapshot_date desc);

create index if not exists ads_settings_snapshot_runs_status_idx
  on public.ads_settings_snapshot_runs (status, last_refreshed_at desc);

create table if not exists public.report_data_status (
  status_id uuid primary key default gen_random_uuid(),
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  table_name text not null,
  source_type text not null,
  source_name text not null,
  scope_key text not null default '',
  period_start date null,
  period_end date null,
  data_status text not null,
  is_final boolean not null default false,
  final_after_at timestamptz null,
  finalized_at timestamptz null,
  last_sync_run_id uuid null
    references public.api_sync_runs(sync_run_id) on delete set null,
  last_refreshed_at timestamptz not null default now(),
  row_count integer null,
  coverage_json jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_data_status_data_status_chk
    check (data_status in ('live', 'preliminary', 'final', 'failed', 'manual_unknown')),
  constraint report_data_status_final_consistency_chk
    check (
      (is_final = false and finalized_at is null)
      or (is_final = true and data_status = 'final')
    ),
  constraint report_data_status_row_count_chk
    check (row_count is null or row_count >= 0),
  constraint report_data_status_coverage_object_chk
    check (jsonb_typeof(coverage_json) = 'object'),
  constraint report_data_status_warnings_array_chk
    check (jsonb_typeof(warnings) = 'array')
);

create unique index if not exists report_data_status_scope_uidx
  on public.report_data_status (
    account_id,
    marketplace,
    table_name,
    source_type,
    source_name,
    scope_key,
    coalesce(period_start, date '0001-01-01'),
    coalesce(period_end, date '9999-12-31')
  );

create index if not exists report_data_status_freshness_idx
  on public.report_data_status (account_id, marketplace, table_name, last_refreshed_at desc);

create index if not exists report_data_status_data_status_idx
  on public.report_data_status (data_status, is_final, last_refreshed_at desc);

create table if not exists public.data_quality_checks (
  check_id uuid primary key default gen_random_uuid(),
  sync_run_id uuid null
    references public.api_sync_runs(sync_run_id) on delete set null,
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  table_name text not null,
  check_name text not null,
  check_category text not null,
  status text not null,
  severity text not null default 'info',
  checked_at timestamptz not null default now(),
  period_start date null,
  period_end date null,
  rows_checked integer null,
  failing_rows integer null,
  metric_name text null,
  expected_json jsonb not null default '{}'::jsonb,
  actual_json jsonb not null default '{}'::jsonb,
  details_json jsonb not null default '{}'::jsonb,
  message text null,
  created_at timestamptz not null default now(),
  constraint data_quality_checks_status_chk
    check (status in ('passed', 'warning', 'failed', 'skipped')),
  constraint data_quality_checks_severity_chk
    check (severity in ('info', 'warn', 'error')),
  constraint data_quality_checks_nonnegative_counts_chk
    check (
      coalesce(rows_checked, 0) >= 0
      and coalesce(failing_rows, 0) >= 0
    ),
  constraint data_quality_checks_expected_object_chk
    check (jsonb_typeof(expected_json) = 'object'),
  constraint data_quality_checks_actual_object_chk
    check (jsonb_typeof(actual_json) = 'object'),
  constraint data_quality_checks_details_object_chk
    check (jsonb_typeof(details_json) = 'object')
);

create index if not exists data_quality_checks_scope_idx
  on public.data_quality_checks (account_id, marketplace, table_name, checked_at desc);

create index if not exists data_quality_checks_status_idx
  on public.data_quality_checks (status, severity, checked_at desc);

create index if not exists data_quality_checks_sync_run_idx
  on public.data_quality_checks (sync_run_id);

create or replace function public.v3_control_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists api_connections_set_updated_at_tg
  on public.api_connections;
create trigger api_connections_set_updated_at_tg
  before update on public.api_connections
  for each row
  execute function public.v3_control_set_updated_at();

drop trigger if exists api_sync_runs_set_updated_at_tg
  on public.api_sync_runs;
create trigger api_sync_runs_set_updated_at_tg
  before update on public.api_sync_runs
  for each row
  execute function public.v3_control_set_updated_at();

drop trigger if exists api_sync_cursors_set_updated_at_tg
  on public.api_sync_cursors;
create trigger api_sync_cursors_set_updated_at_tg
  before update on public.api_sync_cursors
  for each row
  execute function public.v3_control_set_updated_at();

drop trigger if exists ads_settings_snapshot_runs_set_updated_at_tg
  on public.ads_settings_snapshot_runs;
create trigger ads_settings_snapshot_runs_set_updated_at_tg
  before update on public.ads_settings_snapshot_runs
  for each row
  execute function public.v3_control_set_updated_at();

drop trigger if exists report_data_status_set_updated_at_tg
  on public.report_data_status;
create trigger report_data_status_set_updated_at_tg
  before update on public.report_data_status
  for each row
  execute function public.v3_control_set_updated_at();

create or replace function public.record_data_quality_check(
  p_sync_run_id uuid,
  p_account_id text,
  p_marketplace text,
  p_table_name text,
  p_check_name text,
  p_check_category text,
  p_status text,
  p_severity text default 'info',
  p_period_start date default null,
  p_period_end date default null,
  p_rows_checked integer default null,
  p_failing_rows integer default null,
  p_metric_name text default null,
  p_expected_json jsonb default '{}'::jsonb,
  p_actual_json jsonb default '{}'::jsonb,
  p_details_json jsonb default '{}'::jsonb,
  p_message text default null
)
returns uuid
language plpgsql
as $$
declare
  v_check_id uuid;
begin
  insert into public.data_quality_checks (
    sync_run_id,
    account_id,
    marketplace,
    table_name,
    check_name,
    check_category,
    status,
    severity,
    period_start,
    period_end,
    rows_checked,
    failing_rows,
    metric_name,
    expected_json,
    actual_json,
    details_json,
    message
  )
  values (
    p_sync_run_id,
    p_account_id,
    p_marketplace,
    p_table_name,
    p_check_name,
    p_check_category,
    p_status,
    p_severity,
    p_period_start,
    p_period_end,
    p_rows_checked,
    p_failing_rows,
    p_metric_name,
    p_expected_json,
    p_actual_json,
    p_details_json,
    p_message
  )
  returning check_id into v_check_id;

  return v_check_id;
end;
$$;
