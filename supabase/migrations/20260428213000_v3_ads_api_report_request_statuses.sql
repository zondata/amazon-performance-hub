alter table public.ads_api_report_requests
  drop constraint if exists ads_api_report_requests_status_chk;

alter table public.ads_api_report_requests
  add constraint ads_api_report_requests_status_chk
  check (
    status in (
      'created',
      'requested',
      'pending',
      'polling',
      'completed',
      'imported',
      'failed',
      'pending_timeout',
      'stale_expired'
    )
  );
