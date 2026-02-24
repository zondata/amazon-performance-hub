-- Ads "gold layer" daily views for consistent spend reconciliation and baseline reporting.

create or replace view sp_campaign_daily_fact_latest as
with start_time_flags as (
  select
    account_id,
    date,
    campaign_id,
    bool_or(start_time is not null) as has_hourly_rows
  from sp_campaign_hourly_fact_latest
  group by account_id, date, campaign_id
),
sp_campaign_filtered as (
  select hourly.*
  from sp_campaign_hourly_fact_latest hourly
  join start_time_flags flags
    on flags.account_id = hourly.account_id
   and flags.date = hourly.date
   and flags.campaign_id = hourly.campaign_id
  where (flags.has_hourly_rows and hourly.start_time is not null)
     or ((not flags.has_hourly_rows) and hourly.start_time is null)
)
select
  account_id,
  date,
  campaign_id,
  max(portfolio_id) as portfolio_id,
  max(portfolio_name_raw) as portfolio_name_raw,
  max(portfolio_name_norm) as portfolio_name_norm,
  max(campaign_name_raw) as campaign_name_raw,
  max(campaign_name_norm) as campaign_name_norm,
  sum(coalesce(impressions, 0)) as impressions,
  sum(coalesce(clicks, 0)) as clicks,
  sum(coalesce(spend, 0)) as spend,
  sum(coalesce(sales, 0)) as sales,
  sum(coalesce(orders, 0)) as orders,
  sum(coalesce(units, 0)) as units,
  max(exported_at) as exported_at
from sp_campaign_filtered
group by account_id, date, campaign_id;


create or replace view ads_campaign_daily_fact_latest as
select
  channel,
  account_id,
  date,
  campaign_id,
  max(campaign_name_raw) as campaign_name_raw,
  max(campaign_name_norm) as campaign_name_norm,
  sum(coalesce(impressions, 0)) as impressions,
  sum(coalesce(clicks, 0)) as clicks,
  sum(coalesce(spend, 0)) as spend,
  sum(coalesce(sales, 0)) as sales,
  sum(coalesce(orders, 0)) as orders,
  sum(coalesce(units, 0)) as units
from (
  select
    'sp'::text as channel,
    account_id,
    date,
    campaign_id,
    campaign_name_raw,
    campaign_name_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units
  from sp_campaign_daily_fact_latest
  union all
  select
    'sb'::text as channel,
    account_id,
    date,
    campaign_id,
    campaign_name_raw,
    campaign_name_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units
  from sb_campaign_daily_fact_latest
  union all
  select
    'sd'::text as channel,
    account_id,
    date,
    campaign_id,
    campaign_name_raw,
    campaign_name_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units
  from sd_campaign_daily_fact_latest
) source_rows
group by channel, account_id, date, campaign_id;


create or replace view ads_target_daily_fact_latest as
select
  channel,
  account_id,
  date,
  campaign_id,
  ad_group_id,
  target_key,
  target_id,
  targeting_raw,
  targeting_norm,
  match_type_norm,
  sum(coalesce(impressions, 0)) as impressions,
  sum(coalesce(clicks, 0)) as clicks,
  sum(coalesce(spend, 0)) as spend,
  sum(coalesce(sales, 0)) as sales,
  sum(coalesce(orders, 0)) as orders,
  sum(coalesce(units, 0)) as units,
  max(top_of_search_impression_share) as top_of_search_impression_share
from (
  select
    'sp'::text as channel,
    account_id,
    date,
    campaign_id,
    ad_group_id,
    target_id as target_key,
    target_id,
    targeting_raw,
    targeting_norm,
    match_type_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units,
    top_of_search_impression_share
  from sp_targeting_daily_fact_latest
  union all
  select
    'sb'::text as channel,
    account_id,
    date,
    campaign_id,
    ad_group_id,
    target_id as target_key,
    target_id,
    targeting_raw,
    targeting_norm,
    match_type_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units,
    null::numeric as top_of_search_impression_share
  from sb_keyword_daily_fact_latest
  union all
  select
    'sd'::text as channel,
    account_id,
    date,
    campaign_id,
    ad_group_id,
    target_key,
    target_id,
    targeting_raw,
    targeting_norm,
    match_type_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units,
    null::numeric as top_of_search_impression_share
  from sd_targeting_daily_fact_latest
) source_rows
group by
  channel,
  account_id,
  date,
  campaign_id,
  ad_group_id,
  target_key,
  target_id,
  targeting_raw,
  targeting_norm,
  match_type_norm;


create or replace view ads_campaign_placement_daily_fact_latest as
select
  channel,
  account_id,
  date,
  campaign_id,
  placement_code,
  placement_raw,
  placement_raw_norm,
  sum(coalesce(impressions, 0)) as impressions,
  sum(coalesce(clicks, 0)) as clicks,
  sum(coalesce(spend, 0)) as spend,
  sum(coalesce(sales, 0)) as sales,
  sum(coalesce(orders, 0)) as orders,
  sum(coalesce(units, 0)) as units
from (
  select
    'sp'::text as channel,
    account_id,
    date,
    campaign_id,
    placement_code,
    placement_raw,
    placement_raw_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units
  from sp_placement_daily_fact_latest
  union all
  select
    'sb'::text as channel,
    account_id,
    date,
    campaign_id,
    placement_code,
    placement_raw,
    placement_raw_norm,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units
  from sb_campaign_placement_daily_fact_latest
) source_rows
group by channel, account_id, date, campaign_id, placement_code, placement_raw, placement_raw_norm;
