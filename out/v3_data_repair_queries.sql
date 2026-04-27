-- V3 data repair queries
-- Generated: 2026-04-27

-- SP gold rebuild used after new raw campaign uploads were mapped:
select public.rebuild_sp_campaign_hourly_fact_gold('sourbear', date '2026-03-07', date '2026-04-21');

-- SP advertised-product exact duplicate proof:
with base as (
  select
    account_id,
    date,
    campaign_id,
    coalesce(ad_group_id, '') as ad_group_id_key,
    campaign_name_raw,
    campaign_name_norm,
    ad_group_name_raw,
    ad_group_name_norm,
    advertised_asin_raw,
    advertised_asin_norm,
    coalesce(sku_raw, '') as sku_key,
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units,
    exported_at,
    count(*) as row_count
  from public.sp_advertised_product_daily_fact
  where account_id = 'sourbear'
  group by
    account_id,
    date,
    campaign_id,
    coalesce(ad_group_id, ''),
    campaign_name_raw,
    campaign_name_norm,
    ad_group_name_raw,
    ad_group_name_norm,
    advertised_asin_raw,
    advertised_asin_norm,
    coalesce(sku_raw, ''),
    impressions,
    clicks,
    spend,
    sales,
    orders,
    units,
    exported_at
  having count(*) > 1
)
select count(*) as exact_duplicate_groups, coalesce(sum(row_count - 1), 0) as exact_duplicate_rows
from base;

-- SP advertised-product exact dedupe executed:
with ranked as (
  select
    ctid,
    row_number() over (
      partition by
        account_id,
        date,
        campaign_id,
        coalesce(ad_group_id, ''),
        campaign_name_raw,
        campaign_name_norm,
        ad_group_name_raw,
        ad_group_name_norm,
        advertised_asin_raw,
        advertised_asin_norm,
        coalesce(sku_raw, ''),
        impressions,
        clicks,
        spend,
        sales,
        orders,
        units,
        exported_at
      order by ctid
    ) as rn
  from public.sp_advertised_product_daily_fact
  where account_id = 'sourbear'
),
deleted as (
  delete from public.sp_advertised_product_daily_fact t
  using ranked r
  where t.ctid = r.ctid
    and r.rn > 1
  returning 1
)
select count(*) as deleted_rows
from deleted;

-- Sales & Traffic latest-view bug diagnosis:
with d as (
  select
    account_id,
    marketplace,
    date,
    granularity,
    asin_granularity,
    coalesce(parent_asin, '') as parent_asin_key,
    coalesce(child_asin, '') as child_asin_key,
    coalesce(asin, '') as asin_key,
    coalesce(sku, '') as sku_key,
    count(*) as row_count
  from public.amazon_sales_traffic_timeseries_latest
  where account_id = 'sourbear'
    and marketplace = 'US'
  group by
    account_id,
    marketplace,
    date,
    granularity,
    asin_granularity,
    coalesce(parent_asin, ''),
    coalesce(child_asin, ''),
    coalesce(asin, ''),
    coalesce(sku, '')
  having count(*) > 1
)
select *
from d
order by date desc, asin_granularity, asin_key, sku_key;

-- Sales & Traffic raw proof for missing date-grain 2026-04-25:
select
  report_id,
  report_type,
  report_window_start,
  report_window_end,
  date,
  ordered_product_sales_amount,
  units_ordered,
  total_order_items,
  sessions,
  exported_at
from public.spapi_sales_and_traffic_by_date_report_rows
where account_id = 'sourbear'
  and marketplace = 'US'
  and date between date '2026-04-24' and date '2026-04-25'
order by exported_at desc, date desc;
