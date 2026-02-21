create table if not exists public.log_change_validations (
  change_id uuid primary key
    references public.log_changes(change_id) on delete cascade,
  status text not null default 'pending',
  expected_json jsonb null,
  actual_json jsonb null,
  diff_json jsonb null,
  validated_upload_id uuid null
    references public.uploads(upload_id) on delete set null,
  validated_snapshot_date date null,
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint log_change_validations_status_chk
    check (status in ('pending', 'validated', 'mismatch', 'not_found'))
);

create index if not exists log_change_validations_status_idx
  on public.log_change_validations(status);

create index if not exists log_change_validations_checked_at_idx
  on public.log_change_validations(checked_at desc);
