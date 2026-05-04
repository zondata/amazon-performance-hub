create table if not exists public.sp_api_sqp_report_requests (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  asin text not null,
  source_type text not null,
  report_period text not null,
  report_id text not null,
  report_document_id text null,
  start_date date not null,
  end_date date not null,
  status text not null,
  status_details text null,
  attempt_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  requested_at timestamptz null,
  last_polled_at timestamptz null,
  completed_at timestamptz null,
  imported_at timestamptz null,
  failed_at timestamptz null,
  retry_after_at timestamptz null,
  notes text null,
  raw_json jsonb null,
  constraint sp_api_sqp_report_requests_status_chk
    check (
      status in (
        'created',
        'requested',
        'polling',
        'pending_timeout',
        'completed',
        'imported',
        'unavailable',
        'failed',
        'stale_expired'
      )
    ),
  constraint sp_api_sqp_report_requests_attempt_count_chk
    check (attempt_count >= 0),
  constraint sp_api_sqp_report_requests_source_type_chk
    check (source_type in ('sp_api_sqp_weekly', 'sp_api_sqp_monthly')),
  constraint sp_api_sqp_report_requests_report_period_chk
    check (report_period in ('WEEK', 'MONTH')),
  constraint sp_api_sqp_report_requests_raw_json_object_chk
    check (raw_json is null or jsonb_typeof(raw_json) = 'object')
);

create index if not exists sp_api_sqp_report_requests_scope_idx
  on public.sp_api_sqp_report_requests (
    account_id,
    marketplace,
    source_type,
    start_date,
    end_date
  );

create index if not exists sp_api_sqp_report_requests_status_idx
  on public.sp_api_sqp_report_requests (status);

create index if not exists sp_api_sqp_report_requests_report_id_idx
  on public.sp_api_sqp_report_requests (report_id);

create index if not exists sp_api_sqp_report_requests_retry_after_idx
  on public.sp_api_sqp_report_requests (retry_after_at);

create index if not exists sp_api_sqp_report_requests_updated_at_idx
  on public.sp_api_sqp_report_requests (updated_at);

create unique index if not exists sp_api_sqp_report_requests_active_scope_uidx
  on public.sp_api_sqp_report_requests (
    account_id,
    marketplace,
    asin,
    source_type,
    start_date,
    end_date
  )
  where status in (
    'created',
    'requested',
    'polling',
    'pending_timeout',
    'completed'
  );

drop trigger if exists sp_api_sqp_report_requests_set_updated_at_tg
  on public.sp_api_sqp_report_requests;
create trigger sp_api_sqp_report_requests_set_updated_at_tg
  before update on public.sp_api_sqp_report_requests
  for each row
  execute function public.v3_control_set_updated_at();
