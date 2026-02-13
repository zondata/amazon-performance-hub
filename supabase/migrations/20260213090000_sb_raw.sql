-- Sponsored Brands raw reports + latest views + upload source types + upload_stats counts

-- Expand upload source types to include SB raw sources
alter table uploads drop constraint if exists uploads_source_type_chk;

alter table uploads add constraint uploads_source_type_chk check (source_type in (
  'bulk',
  'sp_campaign',
  'sp_targeting',
  'sp_placement',
  'sp_stis',
  'sb_campaign',
  'sb_campaign_placement',
  'sb_keyword',
  'sb_stis'
));

create table if not exists sb_campaign_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
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
  constraint sb_campaign_daily_raw_uq unique (account_id, date, campaign_name_norm, exported_at)
);

create index if not exists sb_campaign_daily_raw_account_date_idx
  on sb_campaign_daily_raw (account_id, date);

create index if not exists sb_campaign_daily_raw_account_campaign_norm_idx
  on sb_campaign_daily_raw (account_id, campaign_name_norm);

create index if not exists sb_campaign_daily_raw_upload_id_idx
  on sb_campaign_daily_raw (upload_id);

create table if not exists sb_campaign_placement_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
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
  constraint sb_campaign_placement_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    placement_code,
    placement_raw_norm,
    exported_at
  )
);

create index if not exists sb_campaign_placement_daily_raw_account_date_idx
  on sb_campaign_placement_daily_raw (account_id, date);

create index if not exists sb_campaign_placement_daily_raw_account_campaign_norm_idx
  on sb_campaign_placement_daily_raw (account_id, campaign_name_norm);

create index if not exists sb_campaign_placement_daily_raw_upload_id_idx
  on sb_campaign_placement_daily_raw (upload_id);

create table if not exists sb_keyword_daily_raw (
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
  constraint sb_keyword_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    ad_group_name_norm,
    targeting_norm,
    match_type_norm,
    exported_at
  )
);

create index if not exists sb_keyword_daily_raw_account_date_idx
  on sb_keyword_daily_raw (account_id, date);

create index if not exists sb_keyword_daily_raw_account_campaign_norm_idx
  on sb_keyword_daily_raw (account_id, campaign_name_norm);

create index if not exists sb_keyword_daily_raw_upload_id_idx
  on sb_keyword_daily_raw (upload_id);

create table if not exists sb_stis_daily_raw (
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
  constraint sb_stis_daily_raw_uq unique (
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

create index if not exists sb_stis_daily_raw_account_date_idx
  on sb_stis_daily_raw (account_id, date);

create index if not exists sb_stis_daily_raw_account_search_term_norm_idx
  on sb_stis_daily_raw (account_id, customer_search_term_norm);

create index if not exists sb_stis_daily_raw_upload_id_idx
  on sb_stis_daily_raw (upload_id);

-- Latest wins views (deterministic tie-break)
create or replace view sb_campaign_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  impressions,
  clicks,
  spend,
  sales,
  orders,
  units,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sb_campaign_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sb_campaign_placement_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  placement_raw,
  placement_raw_norm,
  placement_code,
  impressions,
  clicks,
  spend,
  sales,
  orders,
  units,
  cpc,
  ctr,
  acos,
  roas,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.placement_code, r.placement_raw_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sb_campaign_placement_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sb_keyword_daily_latest as
select * from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.match_type_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sb_keyword_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) latest
where latest.rn = 1;

create or replace view sb_stis_daily_latest as
select * from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.match_type_norm, r.customer_search_term_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sb_stis_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) latest
where latest.rn = 1;

create or replace view upload_stats as
select
  u.upload_id,
  u.account_id,
  u.source_type,
  u.original_filename,
  u.exported_at,
  u.ingested_at,
  u.coverage_start,
  u.coverage_end,
  u.snapshot_date,
  case
    when u.source_type = 'sp_campaign' then (
      select count(1)
      from sp_campaign_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sp_placement' then (
      select count(1)
      from sp_placement_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sp_targeting' then (
      select count(1)
      from sp_targeting_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sp_stis' then (
      select count(1)
      from sp_stis_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sb_campaign' then (
      select count(1)
      from sb_campaign_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sb_campaign_placement' then (
      select count(1)
      from sb_campaign_placement_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sb_keyword' then (
      select count(1)
      from sb_keyword_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sb_stis' then (
      select count(1)
      from sb_stis_daily_raw r
      where r.upload_id = u.upload_id
    )
    else null
  end as row_count
from uploads u;
