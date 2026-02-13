-- Sponsored Display mapping core + fact tables + deterministic latest views

create table if not exists sd_mapping_issues (
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
  constraint sd_mapping_issues_uq unique (upload_id, report_type, entity_level, key_json)
);

create index if not exists sd_mapping_issues_account_upload_idx
  on sd_mapping_issues (account_id, upload_id);

create index if not exists sd_mapping_issues_report_type_idx
  on sd_mapping_issues (report_type);

create index if not exists sd_mapping_issues_issue_type_idx
  on sd_mapping_issues (issue_type);

create table if not exists sd_manual_name_overrides (
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

create index if not exists sd_manual_name_overrides_lookup_idx
  on sd_manual_name_overrides (account_id, entity_level, name_norm);

create table if not exists sd_campaign_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  portfolio_id text null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  cost_type text null,
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
  constraint sd_campaign_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    cost_type
  )
);

create index if not exists sd_campaign_daily_fact_account_date_idx
  on sd_campaign_daily_fact (account_id, date);

create index if not exists sd_campaign_daily_fact_account_campaign_idx
  on sd_campaign_daily_fact (account_id, campaign_id);

create table if not exists sd_advertised_product_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  ad_group_id text not null,
  ad_id text null,
  ad_key text not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  advertised_sku_raw text null,
  advertised_sku_norm text null,
  advertised_asin_raw text null,
  advertised_asin_norm text null,
  cost_type text null,
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
  constraint sd_advertised_product_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    ad_key,
    cost_type
  )
);

create index if not exists sd_advertised_product_daily_fact_account_date_idx
  on sd_advertised_product_daily_fact (account_id, date);

create index if not exists sd_advertised_product_daily_fact_account_campaign_idx
  on sd_advertised_product_daily_fact (account_id, campaign_id);

create table if not exists sd_targeting_daily_fact (
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
  cost_type text null,
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
  constraint sd_targeting_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_key,
    cost_type
  )
);

create index if not exists sd_targeting_daily_fact_account_date_idx
  on sd_targeting_daily_fact (account_id, date);

create index if not exists sd_targeting_daily_fact_account_campaign_idx
  on sd_targeting_daily_fact (account_id, campaign_id);

create table if not exists sd_matched_target_daily_fact (
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
  matched_target_raw text not null,
  matched_target_norm text not null,
  cost_type text null,
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
  constraint sd_matched_target_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_key,
    matched_target_norm,
    cost_type
  )
);

create index if not exists sd_matched_target_daily_fact_account_date_idx
  on sd_matched_target_daily_fact (account_id, date);

create index if not exists sd_matched_target_daily_fact_account_campaign_idx
  on sd_matched_target_daily_fact (account_id, campaign_id);

create table if not exists sd_purchased_product_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  ad_group_id text not null,
  ad_id text null,
  ad_key text not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  advertised_sku_raw text null,
  advertised_sku_norm text null,
  advertised_asin_raw text null,
  advertised_asin_norm text null,
  purchased_sku_raw text null,
  purchased_sku_norm text null,
  purchased_asin_raw text null,
  purchased_asin_norm text null,
  cost_type text null,
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
  constraint sd_purchased_product_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    ad_key,
    purchased_sku_norm,
    purchased_asin_norm,
    cost_type
  )
);

create index if not exists sd_purchased_product_daily_fact_account_date_idx
  on sd_purchased_product_daily_fact (account_id, date);

create index if not exists sd_purchased_product_daily_fact_account_campaign_idx
  on sd_purchased_product_daily_fact (account_id, campaign_id);

create or replace view sd_campaign_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.cost_type
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sd_campaign_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sd_advertised_product_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.ad_key, f.cost_type
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sd_advertised_product_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sd_targeting_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_key, f.cost_type
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sd_targeting_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sd_matched_target_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_key, f.matched_target_norm, f.cost_type
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sd_matched_target_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sd_purchased_product_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.ad_key, f.purchased_sku_norm, f.purchased_asin_norm, f.cost_type
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sd_purchased_product_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;
