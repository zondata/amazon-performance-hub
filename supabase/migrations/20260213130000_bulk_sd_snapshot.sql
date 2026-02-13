-- Sponsored Display bulk snapshot tables + name history

create table if not exists bulk_sd_campaigns (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  campaign_id text not null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  portfolio_id text null,
  state text null,
  budget numeric null,
  tactic text null,
  cost_type text null,
  bid_optimization text null,
  constraint bulk_sd_campaigns_uq unique (account_id, snapshot_date, campaign_id)
);

create index if not exists bulk_sd_campaigns_account_snapshot_name_norm_idx
  on bulk_sd_campaigns (account_id, snapshot_date, campaign_name_norm);

create table if not exists bulk_sd_ad_groups (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  ad_group_id text not null,
  campaign_id text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  state text null,
  default_bid numeric null,
  constraint bulk_sd_ad_groups_uq unique (account_id, snapshot_date, ad_group_id)
);

create index if not exists bulk_sd_ad_groups_account_snapshot_campaign_name_norm_idx
  on bulk_sd_ad_groups (account_id, snapshot_date, campaign_id, ad_group_name_norm);

create table if not exists bulk_sd_product_ads (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  ad_id text not null,
  ad_group_id text not null,
  campaign_id text not null,
  sku_raw text null,
  asin_raw text null,
  constraint bulk_sd_product_ads_uq unique (account_id, snapshot_date, ad_id)
);

create index if not exists bulk_sd_product_ads_account_snapshot_ad_group_idx
  on bulk_sd_product_ads (account_id, snapshot_date, ad_group_id);

create table if not exists bulk_sd_targets (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  targeting_id text not null,
  ad_group_id text not null,
  campaign_id text not null,
  target_type text not null,
  expression_raw text not null,
  expression_norm text not null,
  bid numeric null,
  bid_optimization text null,
  cost_type text null,
  state text null,
  constraint bulk_sd_targets_uq unique (account_id, snapshot_date, targeting_id)
);

create index if not exists bulk_sd_targets_account_snapshot_ad_group_expression_type_idx
  on bulk_sd_targets (account_id, snapshot_date, ad_group_id, expression_norm, target_type);

create table if not exists sd_campaign_name_history (
  account_id text not null references accounts(account_id),
  campaign_id text not null,
  name_raw text not null,
  name_norm text not null,
  valid_from date not null,
  valid_to date null,
  constraint sd_campaign_name_history_uq unique (account_id, campaign_id, valid_from)
);

create table if not exists sd_ad_group_name_history (
  account_id text not null references accounts(account_id),
  ad_group_id text not null,
  campaign_id text not null,
  name_raw text not null,
  name_norm text not null,
  valid_from date not null,
  valid_to date null,
  constraint sd_ad_group_name_history_uq unique (account_id, ad_group_id, valid_from)
);

create index if not exists sd_campaign_name_history_account_name_norm_idx
  on sd_campaign_name_history (account_id, name_norm);

create index if not exists sd_ad_group_name_history_account_campaign_name_norm_idx
  on sd_ad_group_name_history (account_id, campaign_id, name_norm);
