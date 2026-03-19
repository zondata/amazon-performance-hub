create table if not exists public.import_source_status (
  account_id text not null
    references public.accounts(account_id),
  source_type text not null,
  last_attempted_at timestamptz not null default now(),
  last_original_filename text null,
  last_upload_id uuid null
    references public.uploads(upload_id) on delete set null,
  ingest_status text not null,
  ingest_row_count integer null,
  ingest_message text null,
  map_status text not null,
  map_fact_rows integer null,
  map_issue_rows integer null,
  map_message text null,
  unresolved boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_source_status_pkey
    primary key (account_id, source_type),
  constraint import_source_status_ingest_status_chk
    check (ingest_status in ('ok', 'already ingested', 'error')),
  constraint import_source_status_map_status_chk
    check (map_status in ('ok', 'not_required', 'missing_snapshot', 'skipped', 'error'))
);

create index if not exists import_source_status_account_unresolved_updated_idx
  on public.import_source_status (account_id, unresolved, updated_at desc);

create index if not exists import_source_status_account_source_updated_idx
  on public.import_source_status (account_id, source_type, updated_at desc);
