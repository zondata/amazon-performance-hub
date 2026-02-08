create table if not exists sp_stis_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  targeting_raw text not null,
  targeting_norm text not null,
  match_type_raw text null,
  match_type_norm text null,
  customer_search_term_raw text not null,
  customer_search_term_norm text not null,
  search_term_impression_rank int null,
  search_term_impression_share numeric null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  cpc numeric null,
  ctr numeric null,
  acos numeric null,
  roas numeric null,
  conversion_rate numeric null,
  exported_at timestamptz not null,
  constraint sp_stis_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    ad_group_name_norm,
    targeting_norm,
    match_type_norm,
    customer_search_term_norm,
    exported_at
  )
);

create index if not exists sp_stis_daily_raw_account_date_idx
  on sp_stis_daily_raw (account_id, date);

create index if not exists sp_stis_daily_raw_account_search_term_norm_idx
  on sp_stis_daily_raw (account_id, customer_search_term_norm);

create index if not exists sp_stis_daily_raw_upload_id_idx
  on sp_stis_daily_raw (upload_id);
