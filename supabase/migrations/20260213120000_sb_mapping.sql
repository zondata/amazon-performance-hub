-- Sponsored Brands mapping core + fact tables + deterministic latest views

create table if not exists sb_mapping_issues (
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
  constraint sb_mapping_issues_uq unique (upload_id, report_type, entity_level, key_json)
);

create index if not exists sb_mapping_issues_account_upload_idx
  on sb_mapping_issues (account_id, upload_id);

create index if not exists sb_mapping_issues_report_type_idx
  on sb_mapping_issues (report_type);

create index if not exists sb_mapping_issues_issue_type_idx
  on sb_mapping_issues (issue_type);

create table if not exists sb_manual_name_overrides (
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

create index if not exists sb_manual_name_overrides_lookup_idx
  on sb_manual_name_overrides (account_id, entity_level, name_norm);

create table if not exists sb_campaign_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
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
  constraint sb_campaign_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id
  )
);

create index if not exists sb_campaign_daily_fact_account_date_idx
  on sb_campaign_daily_fact (account_id, date);

create index if not exists sb_campaign_daily_fact_account_campaign_idx
  on sb_campaign_daily_fact (account_id, campaign_id);

create table if not exists sb_campaign_placement_daily_fact (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
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
  constraint sb_campaign_placement_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    placement_code,
    placement_raw_norm
  )
);

create index if not exists sb_campaign_placement_daily_fact_account_date_idx
  on sb_campaign_placement_daily_fact (account_id, date);

create index if not exists sb_campaign_placement_daily_fact_account_campaign_idx
  on sb_campaign_placement_daily_fact (account_id, campaign_id);

create table if not exists sb_keyword_daily_fact (
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
  exported_at timestamptz not null,
  constraint sb_keyword_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_id
  )
);

create index if not exists sb_keyword_daily_fact_account_date_idx
  on sb_keyword_daily_fact (account_id, date);

create index if not exists sb_keyword_daily_fact_account_campaign_idx
  on sb_keyword_daily_fact (account_id, campaign_id);

create table if not exists sb_stis_daily_fact (
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
  constraint sb_stis_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_key,
    customer_search_term_norm
  )
);

create index if not exists sb_stis_daily_fact_account_date_idx
  on sb_stis_daily_fact (account_id, date);

create index if not exists sb_stis_daily_fact_account_campaign_idx
  on sb_stis_daily_fact (account_id, campaign_id);

create or replace view sb_campaign_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sb_campaign_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sb_campaign_placement_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.placement_code, f.placement_raw_norm
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sb_campaign_placement_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sb_keyword_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_id
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sb_keyword_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sb_stis_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_key, f.customer_search_term_norm
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sb_stis_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;
