create table if not exists sp_mapping_issues (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references accounts(account_id),
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  report_type text not null,
  entity_level text not null,
  issue_type text not null,
  key_json jsonb not null,
  candidates_json jsonb null,
  row_count int not null default 1,
  created_at timestamptz not null default now(),
  constraint sp_mapping_issues_uq unique (upload_id, report_type, entity_level, key_json)
);

create index if not exists sp_mapping_issues_account_upload_idx
  on sp_mapping_issues (account_id, upload_id);

create index if not exists sp_mapping_issues_report_type_idx
  on sp_mapping_issues (report_type);

create index if not exists sp_mapping_issues_issue_type_idx
  on sp_mapping_issues (issue_type);

create table if not exists sp_manual_name_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id text not null references accounts(account_id),
  entity_level text not null,
  entity_id text not null,
  name_norm text not null,
  valid_from date null,
  valid_to date null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists sp_manual_name_overrides_lookup_idx
  on sp_manual_name_overrides (account_id, entity_level, name_norm);
