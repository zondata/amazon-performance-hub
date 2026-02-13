-- Scale Insights SalesTrend (Daily) raw ingestion + latest views + upload source type + reconciliation diagnostics

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
  'sb_stis',
  'sd_campaign',
  'sd_advertised_product',
  'sd_targeting',
  'sd_matched_target',
  'sd_purchased_product',
  'si_sales_trend'
));

create table if not exists si_sales_trend_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  marketplace text not null,
  asin text not null,
  date date not null,
  referral_fees numeric null,
  fulfillment_fees numeric null,
  cost_of_goods numeric null,
  payout numeric null,
  profits numeric null,
  roi numeric null,
  margin numeric null,
  sales numeric null,
  orders int null,
  units int null,
  organic_orders int null,
  organic_units int null,
  sessions int null,
  conversions numeric null,
  unit_session_pct numeric null,
  ppc_cost numeric null,
  ppc_sales numeric null,
  ppc_orders int null,
  ppc_units int null,
  ppc_impressions int null,
  ppc_clicks int null,
  cost_per_click numeric null,
  ppc_conversions numeric null,
  acos numeric null,
  tacos numeric null,
  ctr numeric null,
  ppc_cost_per_order numeric null,
  promotions int null,
  promotion_value numeric null,
  refund_units int null,
  refund_cost numeric null,
  refund_per_unit numeric null,
  avg_sales_price numeric null,
  exported_at timestamptz not null,
  constraint si_sales_trend_daily_raw_uq unique (
    account_id,
    marketplace,
    asin,
    date,
    exported_at
  )
);

create index if not exists si_sales_trend_daily_raw_account_date_idx
  on si_sales_trend_daily_raw (account_id, date);

create index if not exists si_sales_trend_daily_raw_account_asin_date_idx
  on si_sales_trend_daily_raw (account_id, marketplace, asin, date);

create index if not exists si_sales_trend_daily_raw_upload_id_idx
  on si_sales_trend_daily_raw (upload_id);

create or replace view si_sales_trend_daily_latest as
select
  upload_id,
  account_id,
  marketplace,
  asin,
  date,
  referral_fees,
  fulfillment_fees,
  cost_of_goods,
  payout,
  profits,
  roi,
  margin,
  sales,
  orders,
  units,
  organic_orders,
  organic_units,
  sessions,
  conversions,
  unit_session_pct,
  ppc_cost,
  ppc_sales,
  ppc_orders,
  ppc_units,
  ppc_impressions,
  ppc_clicks,
  cost_per_click,
  ppc_conversions,
  acos,
  tacos,
  ctr,
  ppc_cost_per_order,
  promotions,
  promotion_value,
  refund_units,
  refund_cost,
  refund_per_unit,
  avg_sales_price,
  exported_at,
  ingested_at,
  rn
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.marketplace, r.asin, r.date
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from si_sales_trend_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

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
    when u.source_type = 'sd_campaign' then (
      select count(1)
      from sd_campaign_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sd_advertised_product' then (
      select count(1)
      from sd_advertised_product_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sd_targeting' then (
      select count(1)
      from sd_targeting_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sd_matched_target' then (
      select count(1)
      from sd_matched_target_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'sd_purchased_product' then (
      select count(1)
      from sd_purchased_product_daily_raw r
      where r.upload_id = u.upload_id
    )
    when u.source_type = 'si_sales_trend' then (
      select count(1)
      from si_sales_trend_daily_raw r
      where r.upload_id = u.upload_id
    )
    else null
  end as row_count
from uploads u;

create or replace view v_ppc_spend_reconciliation_daily as
with scale as (
  select
    account_id,
    date,
    sum(ppc_cost) as ppc_cost_scale_insights
  from si_sales_trend_daily_latest
  group by account_id, date
),
ads as (
  select
    account_id,
    date,
    sum(spend) as spend_ads_reports
  from (
    select account_id, date, spend from sp_campaign_hourly_fact_latest
    union all
    select account_id, date, spend from sb_campaign_daily_fact_latest
    union all
    select account_id, date, spend from sd_campaign_daily_latest
  ) t
  group by account_id, date
)
select
  coalesce(scale.account_id, ads.account_id) as account_id,
  coalesce(scale.date, ads.date) as date,
  scale.ppc_cost_scale_insights,
  ads.spend_ads_reports,
  coalesce(scale.ppc_cost_scale_insights, 0) - coalesce(ads.spend_ads_reports, 0) as delta,
  case
    when scale.ppc_cost_scale_insights is null or scale.ppc_cost_scale_insights = 0 then null
    else (coalesce(scale.ppc_cost_scale_insights, 0) - coalesce(ads.spend_ads_reports, 0))
      / scale.ppc_cost_scale_insights
  end as delta_pct,
  case
    when scale.ppc_cost_scale_insights is null or ads.spend_ads_reports is null then false
    when abs(coalesce(scale.ppc_cost_scale_insights, 0) - coalesce(ads.spend_ads_reports, 0)) > 10 then true
    when scale.ppc_cost_scale_insights = 0 then false
    when abs(
      (coalesce(scale.ppc_cost_scale_insights, 0) - coalesce(ads.spend_ads_reports, 0))
      / scale.ppc_cost_scale_insights
    ) > 0.15 then true
    else false
  end as flag_large_delta
from scale
full outer join ads on ads.account_id = scale.account_id and ads.date = scale.date;
