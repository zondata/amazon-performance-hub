create table if not exists public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null,
  source_name text not null,
  account_id text null,
  marketplace text null,
  requested_at timestamptz not null default now(),
  source_window_start timestamptz null,
  source_window_end timestamptz null,
  retrieved_at timestamptz null,
  started_at timestamptz null,
  finished_at timestamptz null,
  processing_status text not null,
  run_kind text not null default 'manual',
  idempotency_key text not null,
  checksum text null,
  row_count integer null,
  error_code text null,
  error_message text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ingestion_jobs_processing_status_chk
    check (processing_status in ('requested', 'processing', 'available', 'failed'))
);

create unique index if not exists ingestion_jobs_idempotency_key_uidx
  on public.ingestion_jobs (idempotency_key);

create index if not exists ingestion_jobs_source_requested_idx
  on public.ingestion_jobs (source_name, requested_at desc);

create index if not exists ingestion_jobs_scope_source_requested_idx
  on public.ingestion_jobs (account_id, marketplace, source_name, requested_at desc);

create table if not exists public.source_watermarks (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  account_id text null,
  marketplace text null,
  scope_key text not null default '',
  last_requested_at timestamptz null,
  last_available_at timestamptz null,
  last_success_at timestamptz null,
  last_job_id uuid null
    references public.ingestion_jobs(id) on delete set null,
  watermark_start timestamptz null,
  watermark_end timestamptz null,
  status text not null,
  notes text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_watermarks_status_chk
    check (status in ('unknown', 'requested', 'available', 'failed'))
);

create unique index if not exists source_watermarks_scope_uidx
  on public.source_watermarks (
    source_name,
    coalesce(account_id, ''),
    coalesce(marketplace, ''),
    scope_key
  );

create index if not exists source_watermarks_source_status_idx
  on public.source_watermarks (source_name, status);

create or replace function public.ingestion_backbone_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ingestion_jobs_set_updated_at_tg
  on public.ingestion_jobs;
create trigger ingestion_jobs_set_updated_at_tg
  before update on public.ingestion_jobs
  for each row
  execute function public.ingestion_backbone_set_updated_at();

drop trigger if exists source_watermarks_set_updated_at_tg
  on public.source_watermarks;
create trigger source_watermarks_set_updated_at_tg
  before update on public.source_watermarks
  for each row
  execute function public.ingestion_backbone_set_updated_at();
