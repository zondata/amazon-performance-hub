alter table public.sp_api_sqp_report_requests
  drop constraint if exists sp_api_sqp_report_requests_status_chk;

alter table public.sp_api_sqp_report_requests
  add constraint sp_api_sqp_report_requests_status_chk
    check (
      status in (
        'created',
        'requested',
        'polling',
        'pending_timeout',
        'completed',
        'imported',
        'no_data',
        'unavailable',
        'failed',
        'stale_expired',
        'ignored'
      )
    );
