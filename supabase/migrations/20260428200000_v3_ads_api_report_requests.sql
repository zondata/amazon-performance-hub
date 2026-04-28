create table if not exists public.ads_api_report_requests (
  id uuid primary key default gen_random_uuid(),
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  profile_id_hash text not null,
  profile_id_masked text not null,
  ad_product text not null,
  report_type_id text not null,
  source_type text not null,
  target_table text not null,
  start_date date not null,
  end_date date not null,
  report_id text not null,
  status text not null,
  status_details text null,
  request_payload_json jsonb not null default '{}'::jsonb,
  last_response_json jsonb not null default '{}'::jsonb,
  diagnostic_path text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_polled_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  retry_after_at timestamptz null,
  attempt_count integer not null default 0,
  notes text null,
  constraint ads_api_report_requests_status_chk
    check (
      status in (
        'created',
        'pending',
        'polling',
        'completed',
        'failed',
        'pending_timeout'
      )
    ),
  constraint ads_api_report_requests_attempt_count_chk
    check (attempt_count >= 0),
  constraint ads_api_report_requests_request_object_chk
    check (jsonb_typeof(request_payload_json) = 'object'),
  constraint ads_api_report_requests_response_object_chk
    check (jsonb_typeof(last_response_json) = 'object')
);

create unique index if not exists ads_api_report_requests_scope_uidx
  on public.ads_api_report_requests (
    account_id,
    marketplace,
    profile_id_hash,
    report_type_id,
    start_date,
    end_date,
    source_type
  );

create unique index if not exists ads_api_report_requests_report_id_uidx
  on public.ads_api_report_requests (report_id);

create index if not exists ads_api_report_requests_status_idx
  on public.ads_api_report_requests (status, last_polled_at desc nulls last);

create index if not exists ads_api_report_requests_scope_status_idx
  on public.ads_api_report_requests (
    account_id,
    marketplace,
    profile_id_hash,
    report_type_id,
    status,
    updated_at desc
  );

drop trigger if exists ads_api_report_requests_set_updated_at_tg
  on public.ads_api_report_requests;
create trigger ads_api_report_requests_set_updated_at_tg
  before update on public.ads_api_report_requests
  for each row
  execute function public.v3_control_set_updated_at();
