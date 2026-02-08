create extension if not exists pgcrypto;

create table if not exists accounts (
  account_id text primary key,
  marketplace text null,
  created_at timestamptz not null default now()
);

create table if not exists uploads (
  upload_id uuid primary key default gen_random_uuid(),
  account_id text not null references accounts(account_id),
  source_type text not null,
  original_filename text not null,
  file_hash_sha256 text not null,
  exported_at timestamptz null,
  ingested_at timestamptz not null default now(),
  coverage_start date null,
  coverage_end date null,
  snapshot_date date null,
  notes text null,
  constraint uploads_source_type_chk check (source_type in (
    'bulk',
    'sp_campaign',
    'sp_targeting',
    'sp_placement',
    'sp_stis'
  )),
  constraint uploads_account_file_hash_uq unique (account_id, file_hash_sha256)
);

create table if not exists bulk_portfolios (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  portfolio_id text not null,
  portfolio_name_raw text not null,
  portfolio_name_norm text not null,
  constraint bulk_portfolios_uq unique (account_id, snapshot_date, portfolio_id)
);

create table if not exists bulk_campaigns (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  campaign_id text not null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  portfolio_id text null,
  state text null,
  daily_budget numeric null,
  bidding_strategy text null,
  constraint bulk_campaigns_uq unique (account_id, snapshot_date, campaign_id)
);

create table if not exists bulk_ad_groups (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  ad_group_id text not null,
  campaign_id text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  state text null,
  default_bid numeric null,
  constraint bulk_ad_groups_uq unique (account_id, snapshot_date, ad_group_id)
);

create table if not exists bulk_targets (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  target_id text not null,
  ad_group_id text not null,
  campaign_id text not null,
  expression_raw text not null,
  expression_norm text not null,
  match_type text not null,
  is_negative boolean not null default false,
  state text null,
  bid numeric null,
  constraint bulk_targets_uq unique (account_id, snapshot_date, target_id)
);

create table if not exists bulk_placements (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  campaign_id text not null,
  placement_raw text not null,
  placement_code text not null,
  percentage numeric not null,
  constraint bulk_placements_uq unique (account_id, snapshot_date, campaign_id, placement_code)
);

create table if not exists campaign_name_history (
  account_id text not null references accounts(account_id),
  campaign_id text not null,
  name_raw text not null,
  name_norm text not null,
  valid_from date not null,
  valid_to date null,
  constraint campaign_name_history_uq unique (account_id, campaign_id, valid_from)
);

create table if not exists ad_group_name_history (
  account_id text not null references accounts(account_id),
  ad_group_id text not null,
  campaign_id text not null,
  name_raw text not null,
  name_norm text not null,
  valid_from date not null,
  valid_to date null,
  constraint ad_group_name_history_uq unique (account_id, ad_group_id, valid_from)
);

create table if not exists portfolio_name_history (
  account_id text not null references accounts(account_id),
  portfolio_id text not null,
  name_raw text not null,
  name_norm text not null,
  valid_from date not null,
  valid_to date null,
  constraint portfolio_name_history_uq unique (account_id, portfolio_id, valid_from)
);

create index if not exists bulk_campaigns_account_snapshot_name_norm_idx
  on bulk_campaigns (account_id, snapshot_date, campaign_name_norm);

create index if not exists campaign_name_history_account_name_norm_idx
  on campaign_name_history (account_id, name_norm);

create index if not exists ad_group_name_history_account_campaign_name_norm_idx
  on ad_group_name_history (account_id, campaign_id, name_norm);
