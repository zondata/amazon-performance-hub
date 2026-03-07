create or replace view public.sp_campaign_daily_fact_latest_gold as
with grouped as (
  select
    account_id,
    date,
    campaign_id,
    bool_or(start_time is not null) as has_hourly_rows,
    max(portfolio_id) filter (where start_time is not null) as portfolio_id_hourly,
    max(portfolio_id) filter (where start_time is null) as portfolio_id_daily,
    max(portfolio_name_raw) filter (where start_time is not null) as portfolio_name_raw_hourly,
    max(portfolio_name_raw) filter (where start_time is null) as portfolio_name_raw_daily,
    max(portfolio_name_norm) filter (where start_time is not null) as portfolio_name_norm_hourly,
    max(portfolio_name_norm) filter (where start_time is null) as portfolio_name_norm_daily,
    max(campaign_name_raw) filter (where start_time is not null) as campaign_name_raw_hourly,
    max(campaign_name_raw) filter (where start_time is null) as campaign_name_raw_daily,
    max(campaign_name_norm) filter (where start_time is not null) as campaign_name_norm_hourly,
    max(campaign_name_norm) filter (where start_time is null) as campaign_name_norm_daily,
    sum(coalesce(impressions, 0)) filter (where start_time is not null) as impressions_hourly,
    sum(coalesce(impressions, 0)) filter (where start_time is null) as impressions_daily,
    sum(coalesce(clicks, 0)) filter (where start_time is not null) as clicks_hourly,
    sum(coalesce(clicks, 0)) filter (where start_time is null) as clicks_daily,
    sum(coalesce(spend, 0)) filter (where start_time is not null) as spend_hourly,
    sum(coalesce(spend, 0)) filter (where start_time is null) as spend_daily,
    sum(coalesce(sales, 0)) filter (where start_time is not null) as sales_hourly,
    sum(coalesce(sales, 0)) filter (where start_time is null) as sales_daily,
    sum(coalesce(orders, 0)) filter (where start_time is not null) as orders_hourly,
    sum(coalesce(orders, 0)) filter (where start_time is null) as orders_daily,
    sum(units) filter (where start_time is not null) as units_hourly,
    sum(units) filter (where start_time is null) as units_daily,
    max(exported_at) filter (where start_time is not null) as exported_at_hourly,
    max(exported_at) filter (where start_time is null) as exported_at_daily
  from public.sp_campaign_hourly_fact_gold
  group by account_id, date, campaign_id
)
select
  account_id,
  date,
  campaign_id,
  case when has_hourly_rows then portfolio_id_hourly else portfolio_id_daily end as portfolio_id,
  case when has_hourly_rows then portfolio_name_raw_hourly else portfolio_name_raw_daily end as portfolio_name_raw,
  case when has_hourly_rows then portfolio_name_norm_hourly else portfolio_name_norm_daily end as portfolio_name_norm,
  case when has_hourly_rows then campaign_name_raw_hourly else campaign_name_raw_daily end as campaign_name_raw,
  case when has_hourly_rows then campaign_name_norm_hourly else campaign_name_norm_daily end as campaign_name_norm,
  case when has_hourly_rows then impressions_hourly else impressions_daily end::int as impressions,
  case when has_hourly_rows then clicks_hourly else clicks_daily end::int as clicks,
  case when has_hourly_rows then spend_hourly else spend_daily end as spend,
  case when has_hourly_rows then sales_hourly else sales_daily end as sales,
  case when has_hourly_rows then orders_hourly else orders_daily end::int as orders,
  case when has_hourly_rows then units_hourly else units_daily end::int as units,
  case when has_hourly_rows then exported_at_hourly else exported_at_daily end as exported_at
from grouped;
