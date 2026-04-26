-- V3 Phase 5: monthly Search Query Performance raw table and latest/enriched views.

create table if not exists sqp_monthly_raw (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  marketplace text not null,
  scope_type text not null check (scope_type in ('brand', 'asin')),
  scope_value text not null,
  period_start date not null,
  period_end date not null,
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

  constraint sqp_monthly_raw_uq unique (
    account_id,
    marketplace,
    scope_type,
    scope_value,
    period_end,
    search_query_norm,
    exported_at
  )
);

create index if not exists sqp_monthly_raw_account_market_period_end_idx
  on sqp_monthly_raw (account_id, marketplace, period_end);

create index if not exists sqp_monthly_raw_account_market_scope_period_end_idx
  on sqp_monthly_raw (account_id, marketplace, scope_type, scope_value, period_end);

create index if not exists sqp_monthly_raw_account_market_query_norm_idx
  on sqp_monthly_raw (account_id, marketplace, search_query_norm);

create index if not exists sqp_monthly_raw_upload_id_idx
  on sqp_monthly_raw (upload_id);

create or replace view sqp_monthly_latest as
select
  upload_id,
  account_id,
  marketplace,
  scope_type,
  scope_value,
  period_start,
  period_end,
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
      partition by r.account_id, r.marketplace, r.scope_type, r.scope_value, r.period_end, r.search_query_norm
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sqp_monthly_raw r
  join uploads u on u.upload_id = r.upload_id
) latest
where latest.rn = 1;

create or replace view sqp_monthly_latest_enriched as
select
  l.*,
  case when l.impressions_total is null or l.impressions_total = 0 then null else l.clicks_total::numeric / l.impressions_total::numeric end as market_ctr,
  case when l.impressions_self is null or l.impressions_self = 0 then null else l.clicks_self::numeric / l.impressions_self::numeric end as self_ctr,
  case when l.clicks_total is null or l.clicks_total = 0 then null else l.purchases_total::numeric / l.clicks_total::numeric end as market_cvr,
  case when l.clicks_self is null or l.clicks_self = 0 then null else l.purchases_self::numeric / l.clicks_self::numeric end as self_cvr,
  case when l.impressions_total is null or l.impressions_total = 0 then null else l.impressions_self::numeric / l.impressions_total::numeric end as self_impression_share_calc,
  case when l.clicks_total is null or l.clicks_total = 0 then null else l.clicks_self::numeric / l.clicks_total::numeric end as self_click_share_calc,
  case when l.purchases_total is null or l.purchases_total = 0 then null else l.purchases_self::numeric / l.purchases_total::numeric end as self_purchase_share_calc
from sqp_monthly_latest l;
