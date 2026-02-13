-- Amazon Brand Analytics Search Query Performance (weekly) raw ingestion + latest/enriched/continuity views

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
  'si_sales_trend',
  'sqp',
  'h10_keyword_tracker'
));

create table if not exists sqp_weekly_raw (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  marketplace text not null,
  scope_type text not null check (scope_type in ('brand', 'asin')),
  scope_value text not null,
  week_start date not null,
  week_end date not null,
  reporting_date date not null,
  search_query_raw text not null,
  search_query_norm text not null,
  search_query_score int null,
  search_query_volume int null,

  impressions_total int null,
  impressions_self int null,
  impressions_self_share numeric null,

  clicks_total int null,
  clicks_rate_per_query numeric null,
  clicks_self int null,
  clicks_self_share numeric null,
  clicks_price_median_total numeric null,
  clicks_price_median_self numeric null,
  clicks_same_day_ship int null,
  clicks_1d_ship int null,
  clicks_2d_ship int null,

  cart_adds_total int null,
  cart_add_rate_per_query numeric null,
  cart_adds_self int null,
  cart_adds_self_share numeric null,
  cart_adds_price_median_total numeric null,
  cart_adds_price_median_self numeric null,
  cart_adds_same_day_ship int null,
  cart_adds_1d_ship int null,
  cart_adds_2d_ship int null,

  purchases_total int null,
  purchases_rate_per_query numeric null,
  purchases_self int null,
  purchases_self_share numeric null,
  purchases_price_median_total numeric null,
  purchases_price_median_self numeric null,
  purchases_same_day_ship int null,
  purchases_1d_ship int null,
  purchases_2d_ship int null,

  exported_at timestamptz not null,

  constraint sqp_weekly_raw_uq unique (
    account_id,
    marketplace,
    scope_type,
    scope_value,
    week_end,
    search_query_norm,
    exported_at
  )
);

create index if not exists sqp_weekly_raw_account_market_week_end_idx
  on sqp_weekly_raw (account_id, marketplace, week_end);

create index if not exists sqp_weekly_raw_account_market_scope_week_end_idx
  on sqp_weekly_raw (account_id, marketplace, scope_type, scope_value, week_end);

create index if not exists sqp_weekly_raw_account_market_query_norm_idx
  on sqp_weekly_raw (account_id, marketplace, search_query_norm);

create index if not exists sqp_weekly_raw_upload_id_idx
  on sqp_weekly_raw (upload_id);

create or replace view sqp_weekly_latest as
select
  upload_id,
  account_id,
  marketplace,
  scope_type,
  scope_value,
  week_start,
  week_end,
  reporting_date,
  search_query_raw,
  search_query_norm,
  search_query_score,
  search_query_volume,
  impressions_total,
  impressions_self,
  impressions_self_share,
  clicks_total,
  clicks_rate_per_query,
  clicks_self,
  clicks_self_share,
  clicks_price_median_total,
  clicks_price_median_self,
  clicks_same_day_ship,
  clicks_1d_ship,
  clicks_2d_ship,
  cart_adds_total,
  cart_add_rate_per_query,
  cart_adds_self,
  cart_adds_self_share,
  cart_adds_price_median_total,
  cart_adds_price_median_self,
  cart_adds_same_day_ship,
  cart_adds_1d_ship,
  cart_adds_2d_ship,
  purchases_total,
  purchases_rate_per_query,
  purchases_self,
  purchases_self_share,
  purchases_price_median_total,
  purchases_price_median_self,
  purchases_same_day_ship,
  purchases_1d_ship,
  purchases_2d_ship,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.marketplace, r.scope_type, r.scope_value, r.week_end, r.search_query_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sqp_weekly_raw r
  join uploads u on u.upload_id = r.upload_id
) latest
where latest.rn = 1;

create or replace view sqp_weekly_latest_enriched as
select
  l.*,
  case
    when l.impressions_total is null or l.impressions_total = 0 then null
    else l.clicks_total::numeric / l.impressions_total::numeric
  end as market_ctr,
  case
    when l.impressions_self is null or l.impressions_self = 0 then null
    else l.clicks_self::numeric / l.impressions_self::numeric
  end as self_ctr,
  case
    when l.clicks_total is null or l.clicks_total = 0 then null
    else l.purchases_total::numeric / l.clicks_total::numeric
  end as market_cvr,
  case
    when l.clicks_self is null or l.clicks_self = 0 then null
    else l.purchases_self::numeric / l.clicks_self::numeric
  end as self_cvr,
  case
    when l.impressions_total is null or l.impressions_total = 0 then null
    else l.impressions_self::numeric / l.impressions_total::numeric
  end as self_impression_share_calc,
  case
    when l.clicks_total is null or l.clicks_total = 0 then null
    else l.clicks_self::numeric / l.clicks_total::numeric
  end as self_click_share_calc,
  case
    when l.purchases_total is null or l.purchases_total = 0 then null
    else l.purchases_self::numeric / l.purchases_total::numeric
  end as self_purchase_share_calc,
  case
    when l.impressions_total is null or l.impressions_total = 0 or l.impressions_self is null or l.impressions_self = 0 then null
    when l.clicks_total is null or l.clicks_self is null then null
    when (l.clicks_total::numeric / l.impressions_total::numeric) = 0 then null
    else (l.clicks_self::numeric / l.impressions_self::numeric)
      / (l.clicks_total::numeric / l.impressions_total::numeric)
  end as self_ctr_index,
  case
    when l.clicks_total is null or l.clicks_total = 0 or l.clicks_self is null or l.clicks_self = 0 then null
    when l.purchases_total is null or l.purchases_self is null then null
    when (l.purchases_total::numeric / l.clicks_total::numeric) = 0 then null
    else (l.purchases_self::numeric / l.clicks_self::numeric)
      / (l.purchases_total::numeric / l.clicks_total::numeric)
  end as self_cvr_index,
  case
    when l.clicks_total is null or l.clicks_total = 0 then null
    else l.cart_adds_total::numeric / l.clicks_total::numeric
  end as cart_add_rate_from_clicks_market,
  case
    when l.clicks_self is null or l.clicks_self = 0 then null
    else l.cart_adds_self::numeric / l.clicks_self::numeric
  end as cart_add_rate_from_clicks_self
from sqp_weekly_latest l;

create or replace view sqp_weekly_brand_agg_from_asin_latest as
select
  null::uuid as upload_id,
  l.account_id,
  l.marketplace,
  'brand'::text as scope_type,
  '__AGG_FROM_ASIN__'::text as scope_value,
  max(l.week_start) as week_start,
  l.week_end,
  max(l.reporting_date) as reporting_date,
  max(l.search_query_raw) as search_query_raw,
  l.search_query_norm,
  max(l.search_query_score) as search_query_score,
  max(l.search_query_volume) as search_query_volume,

  max(l.impressions_total) as impressions_total,
  sum(l.impressions_self) as impressions_self,
  case
    when max(l.impressions_total) is null or max(l.impressions_total) = 0 then null
    else sum(l.impressions_self)::numeric / max(l.impressions_total)::numeric
  end as impressions_self_share,

  max(l.clicks_total) as clicks_total,
  max(l.clicks_rate_per_query) as clicks_rate_per_query,
  sum(l.clicks_self) as clicks_self,
  case
    when max(l.clicks_total) is null or max(l.clicks_total) = 0 then null
    else sum(l.clicks_self)::numeric / max(l.clicks_total)::numeric
  end as clicks_self_share,
  max(l.clicks_price_median_total) as clicks_price_median_total,
  null::numeric as clicks_price_median_self,
  max(l.clicks_same_day_ship) as clicks_same_day_ship,
  max(l.clicks_1d_ship) as clicks_1d_ship,
  max(l.clicks_2d_ship) as clicks_2d_ship,

  max(l.cart_adds_total) as cart_adds_total,
  max(l.cart_add_rate_per_query) as cart_add_rate_per_query,
  sum(l.cart_adds_self) as cart_adds_self,
  case
    when max(l.cart_adds_total) is null or max(l.cart_adds_total) = 0 then null
    else sum(l.cart_adds_self)::numeric / max(l.cart_adds_total)::numeric
  end as cart_adds_self_share,
  max(l.cart_adds_price_median_total) as cart_adds_price_median_total,
  null::numeric as cart_adds_price_median_self,
  max(l.cart_adds_same_day_ship) as cart_adds_same_day_ship,
  max(l.cart_adds_1d_ship) as cart_adds_1d_ship,
  max(l.cart_adds_2d_ship) as cart_adds_2d_ship,

  max(l.purchases_total) as purchases_total,
  max(l.purchases_rate_per_query) as purchases_rate_per_query,
  sum(l.purchases_self) as purchases_self,
  case
    when max(l.purchases_total) is null or max(l.purchases_total) = 0 then null
    else sum(l.purchases_self)::numeric / max(l.purchases_total)::numeric
  end as purchases_self_share,
  max(l.purchases_price_median_total) as purchases_price_median_total,
  null::numeric as purchases_price_median_self,
  max(l.purchases_same_day_ship) as purchases_same_day_ship,
  max(l.purchases_1d_ship) as purchases_1d_ship,
  max(l.purchases_2d_ship) as purchases_2d_ship,

  max(l.exported_at) as exported_at
from sqp_weekly_latest l
join products p
  on p.account_id = l.account_id
 and p.marketplace = l.marketplace
 and upper(p.asin) = upper(l.scope_value)
where l.scope_type = 'asin'
group by l.account_id, l.marketplace, l.week_end, l.search_query_norm;

create or replace view sqp_weekly_brand_continuous_latest as
with brand_rows as (
  select *
  from sqp_weekly_latest
  where scope_type = 'brand'
),
agg_rows as (
  select *
  from sqp_weekly_brand_agg_from_asin_latest
)
select * from brand_rows
union all
select a.*
from agg_rows a
where not exists (
  select 1
  from brand_rows b
  where b.account_id = a.account_id
    and b.marketplace = a.marketplace
    and b.week_end = a.week_end
    and b.search_query_norm = a.search_query_norm
);

create or replace view sqp_weekly_latest_known_keywords as
select
  l.*,
  d.keyword_id
from sqp_weekly_latest l
left join dim_keyword d
  on d.keyword_norm = l.search_query_norm;

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
    when u.source_type = 'sqp' then (
      select count(1)
      from sqp_weekly_raw r
      where r.upload_id = u.upload_id
    )
    else null
  end as row_count
from uploads u;
