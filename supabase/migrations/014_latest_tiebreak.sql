-- Ensure deterministic latest views by breaking exported_at ties with uploads.ingested_at and upload_id.

-- Local reset safety: older non-timestamped migration 006a was skipped by Supabase CLI,
-- but these latest views partition by placement_raw_norm.
alter table sp_placement_daily_raw
  add column if not exists placement_raw_norm text;

update sp_placement_daily_raw
set placement_raw_norm = lower(trim(placement_raw))
where placement_raw_norm is null;

alter table sp_placement_daily_raw
  alter column placement_raw_norm set not null;

alter table sp_placement_daily_raw
  drop constraint if exists sp_placement_daily_raw_uq;

alter table sp_placement_daily_raw
  add constraint sp_placement_daily_raw_uq
  unique (account_id, date, campaign_name_norm, placement_code, placement_raw_norm, exported_at);

create index if not exists sp_placement_daily_raw_ix_acct_campaign_place_raw
  on sp_placement_daily_raw (account_id, campaign_name_norm, placement_code, placement_raw_norm);

-- Drop latest views first to avoid CREATE OR REPLACE column shape conflicts
drop view if exists
  sp_campaign_hourly_latest,
  sp_placement_daily_latest,
  sp_targeting_daily_latest,
  sp_stis_daily_latest,
  sp_campaign_hourly_fact_latest,
  sp_placement_daily_fact_latest,
  sp_targeting_daily_fact_latest,
  sp_stis_daily_fact_latest
cascade;


create or replace view sp_campaign_hourly_latest as
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
  exported_at,
  start_time
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.start_time, r.campaign_name_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sp_campaign_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sp_placement_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  bidding_strategy,
  placement_raw,
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
  exported_at,
  rn
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.placement_code, r.placement_raw_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sp_placement_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sp_targeting_daily_latest as
select * from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.match_type_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sp_targeting_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) latest
where latest.rn = 1;

create or replace view sp_stis_daily_latest as
select * from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.match_type_norm, r.customer_search_term_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sp_stis_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) latest
where latest.rn = 1;

create or replace view sp_campaign_hourly_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.start_time, f.campaign_id
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sp_campaign_hourly_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sp_placement_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.placement_code, f.placement_raw_norm
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sp_placement_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sp_targeting_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_id
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sp_targeting_daily_fact f
  join uploads u on u.upload_id = f.upload_id
) latest
where latest.rn = 1;

create or replace view sp_stis_daily_fact_latest as
select * from (
  select
    f.*,
    u.ingested_at,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_key, f.customer_search_term_norm
      order by f.exported_at desc, u.ingested_at desc, f.upload_id desc
    ) as rn
  from sp_stis_daily_fact f
  join uploads u on u.upload_id = f.upload_id
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
    else null
  end as row_count
from uploads u;
