-- Sponsored Brands bulk snapshot tables + name history

create table if not exists bulk_sb_campaigns (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  campaign_id text not null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  portfolio_id text null,
  state text null,
  daily_budget numeric null,
  bidding_strategy text null,
  constraint bulk_sb_campaigns_uq unique (account_id, snapshot_date, campaign_id)
);

create index if not exists bulk_sb_campaigns_account_snapshot_name_norm_idx
  on bulk_sb_campaigns (account_id, snapshot_date, campaign_name_norm);

create table if not exists bulk_sb_ad_groups (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  ad_group_id text not null,
  campaign_id text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  state text null,
  default_bid numeric null,
  constraint bulk_sb_ad_groups_uq unique (account_id, snapshot_date, ad_group_id)
);

create index if not exists bulk_sb_ad_groups_account_snapshot_campaign_name_norm_idx
  on bulk_sb_ad_groups (account_id, snapshot_date, campaign_id, ad_group_name_norm);

create table if not exists bulk_sb_targets (
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
  constraint bulk_sb_targets_uq unique (account_id, snapshot_date, target_id)
);

create index if not exists bulk_sb_targets_account_snapshot_ad_group_expression_match_neg_idx
  on bulk_sb_targets (account_id, snapshot_date, ad_group_id, expression_norm, match_type, is_negative);

create table if not exists bulk_sb_placements (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  campaign_id text not null,
  placement_raw text not null,
  placement_raw_norm text not null,
  placement_code text not null,
  percentage numeric not null,
  constraint bulk_sb_placements_uq unique (account_id, snapshot_date, campaign_id, placement_code, placement_raw_norm)
);

create table if not exists sb_campaign_name_history (
  account_id text not null references accounts(account_id),
  campaign_id text not null,
  name_raw text not null,
  name_norm text not null,
  valid_from date not null,
  valid_to date null,
  constraint sb_campaign_name_history_uq unique (account_id, campaign_id, valid_from)
);

create table if not exists sb_ad_group_name_history (
  account_id text not null references accounts(account_id),
  ad_group_id text not null,
  campaign_id text not null,
  name_raw text not null,
  name_norm text not null,
  valid_from date not null,
  valid_to date null,
  constraint sb_ad_group_name_history_uq unique (account_id, ad_group_id, valid_from)
);

create index if not exists sb_campaign_name_history_account_name_norm_idx
  on sb_campaign_name_history (account_id, name_norm);

create index if not exists sb_ad_group_name_history_account_campaign_name_norm_idx
  on sb_ad_group_name_history (account_id, campaign_id, name_norm);
