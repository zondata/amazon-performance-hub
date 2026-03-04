create table if not exists sp_placement_modifier_change_log (
  account_id text not null references accounts(account_id),
  upload_id uuid not null references uploads(upload_id),
  snapshot_date date not null,
  exported_at timestamptz not null,
  campaign_id text not null,
  placement_code text not null,
  placement_raw text null,
  old_pct numeric null,
  new_pct numeric not null,
  created_at timestamptz not null default now(),
  constraint sp_placement_modifier_change_log_uq unique (
    account_id,
    upload_id,
    campaign_id,
    placement_code
  )
);

create index if not exists sp_placement_modifier_change_log_account_snapshot_idx
  on sp_placement_modifier_change_log (account_id, snapshot_date);

create index if not exists sp_placement_modifier_change_log_account_campaign_snapshot_idx
  on sp_placement_modifier_change_log (account_id, campaign_id, snapshot_date);
