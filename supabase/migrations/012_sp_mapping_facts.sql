create table if not exists sp_campaign_hourly_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  start_time time null,
  campaign_id text not null,
  portfolio_id text null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  exported_at timestamptz not null,
  constraint sp_campaign_hourly_fact_uq unique (
    account_id,
    upload_id,
    date,
    start_time,
    campaign_id
  )
);

create index if not exists sp_campaign_hourly_fact_account_date_idx
  on sp_campaign_hourly_fact (account_id, date);

create index if not exists sp_campaign_hourly_fact_account_campaign_idx
  on sp_campaign_hourly_fact (account_id, campaign_id);

create or replace view sp_campaign_hourly_fact_latest as
select * from (
  select
    f.*,
    row_number() over (
      partition by f.account_id, f.date, f.start_time, f.campaign_id
      order by f.exported_at desc
    ) as rn
  from sp_campaign_hourly_fact f
) latest
where latest.rn = 1;

create table if not exists sp_placement_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  bidding_strategy text null,
  placement_raw text not null,
  placement_raw_norm text not null,
  placement_code text not null,
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
  exported_at timestamptz not null,
  constraint sp_placement_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    placement_code,
    placement_raw_norm
  )
);

create index if not exists sp_placement_daily_fact_account_date_idx
  on sp_placement_daily_fact (account_id, date);

create index if not exists sp_placement_daily_fact_account_campaign_idx
  on sp_placement_daily_fact (account_id, campaign_id);

create or replace view sp_placement_daily_fact_latest as
select * from (
  select
    f.*,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.placement_code, f.placement_raw_norm
      order by f.exported_at desc
    ) as rn
  from sp_placement_daily_fact f
) latest
where latest.rn = 1;

create table if not exists sp_targeting_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  ad_group_id text not null,
  target_id text not null,
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
  top_of_search_impression_share numeric null,
  exported_at timestamptz not null,
  constraint sp_targeting_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_id
  )
);

create index if not exists sp_targeting_daily_fact_account_date_idx
  on sp_targeting_daily_fact (account_id, date);

create index if not exists sp_targeting_daily_fact_account_campaign_idx
  on sp_targeting_daily_fact (account_id, campaign_id);

create or replace view sp_targeting_daily_fact_latest as
select * from (
  select
    f.*,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_id
      order by f.exported_at desc
    ) as rn
  from sp_targeting_daily_fact f
) latest
where latest.rn = 1;

create table if not exists sp_stis_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  ad_group_id text not null,
  target_id text not null,
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
  constraint sp_stis_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_id,
    customer_search_term_norm
  )
);

create index if not exists sp_stis_daily_fact_account_date_idx
  on sp_stis_daily_fact (account_id, date);

create index if not exists sp_stis_daily_fact_account_campaign_idx
  on sp_stis_daily_fact (account_id, campaign_id);

create or replace view sp_stis_daily_fact_latest as
select * from (
  select
    f.*,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_id, f.customer_search_term_norm
      order by f.exported_at desc
    ) as rn
  from sp_stis_daily_fact f
) latest
where latest.rn = 1;
