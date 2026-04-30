alter table uploads drop constraint if exists uploads_source_type_chk;

alter table uploads add constraint uploads_source_type_chk check (source_type in (
  'bulk',
  'sp_campaign',
  'sp_targeting',
  'sp_placement',
  'sp_stis',
  'sp_search_term',
  'sp_advertised_product',
  'sb_campaign',
  'sb_campaign_placement',
  'sb_keyword',
  'sb_stis',
  'sd_campaign',
  'sd_advertised_product',
  'sd_targeting',
  'sd_matched_target',
  'sd_purchased_product',
  'si_sales_trend',
  'sqp',
  'h10_keyword_tracker'
));

create table if not exists sp_search_term_daily_raw (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
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
  keyword_type text null,
  target_status text null,
  search_term_raw text not null,
  search_term_norm text not null,
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
  constraint sp_search_term_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    ad_group_name_norm,
    targeting_norm,
    match_type_norm,
    search_term_norm,
    exported_at
  )
);

create index if not exists sp_search_term_daily_raw_account_date_idx
  on sp_search_term_daily_raw (account_id, date);

create index if not exists sp_search_term_daily_raw_account_search_term_norm_idx
  on sp_search_term_daily_raw (account_id, search_term_norm);

create index if not exists sp_search_term_daily_raw_upload_id_idx
  on sp_search_term_daily_raw (upload_id);

create table if not exists sp_search_term_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  ad_group_id text not null,
  target_id text null,
  target_key text not null,
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
  keyword_type text null,
  target_status text null,
  search_term_raw text not null,
  search_term_norm text not null,
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
  constraint sp_search_term_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_key,
    search_term_norm
  )
);

create index if not exists sp_search_term_daily_fact_account_date_idx
  on sp_search_term_daily_fact (account_id, date);

create index if not exists sp_search_term_daily_fact_account_campaign_idx
  on sp_search_term_daily_fact (account_id, campaign_id);

create index if not exists sp_search_term_daily_fact_account_search_term_idx
  on sp_search_term_daily_fact (account_id, search_term_norm);

create or replace view sp_search_term_daily_fact_latest as
select * from (
  select
    f.*,
    row_number() over (
      partition by
        f.account_id,
        f.date,
        f.campaign_id,
        f.ad_group_id,
        f.target_key,
        f.search_term_norm
      order by f.exported_at desc
    ) as rn
  from sp_search_term_daily_fact f
) latest
where latest.rn = 1;
