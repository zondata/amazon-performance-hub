-- Helium 10 Keyword Tracker ranking ingestion (raw + latest/daily views + dims + upload_stats)

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

create table if not exists h10_keyword_tracker_raw (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  marketplace text not null,
  marketplace_domain_raw text null,
  asin text not null,
  title text null,
  keyword_raw text not null,
  keyword_norm text not null,
  keyword_sales int null,
  search_volume int null,

  organic_rank_raw text null,
  organic_rank_value int null,
  organic_rank_kind text not null default 'missing' check (organic_rank_kind in ('exact', 'gte', 'missing')),
  sponsored_pos_raw text null,
  sponsored_pos_value int null,
  sponsored_pos_kind text not null default 'missing' check (sponsored_pos_kind in ('exact', 'gte', 'missing')),

  observed_at timestamp without time zone not null,
  observed_date date not null,

  exported_at timestamptz not null,

  constraint h10_keyword_tracker_raw_uq unique (
    account_id,
    marketplace,
    asin,
    keyword_norm,
    observed_at,
    exported_at
  )
);

create index if not exists h10_keyword_tracker_raw_account_market_asin_date_idx
  on h10_keyword_tracker_raw (account_id, marketplace, asin, observed_date);

create index if not exists h10_keyword_tracker_raw_account_market_keyword_norm_idx
  on h10_keyword_tracker_raw (account_id, marketplace, keyword_norm);

create index if not exists h10_keyword_tracker_raw_upload_id_idx
  on h10_keyword_tracker_raw (upload_id);

create or replace view h10_keyword_tracker_latest as
select * from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.marketplace, r.asin, r.keyword_norm, r.observed_at
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from h10_keyword_tracker_raw r
  join uploads u on u.upload_id = r.upload_id
) latest
where latest.rn = 1;

create or replace view h10_keyword_rank_daily_latest as
select * from (
  select
    l.*,
    row_number() over (
      partition by l.account_id, l.marketplace, l.asin, l.keyword_norm, l.observed_date
      order by l.observed_at desc, l.exported_at desc, l.ingested_at desc, l.upload_id desc
    ) as rn_daily
  from h10_keyword_tracker_latest l
) daily
where daily.rn_daily = 1;

create or replace view h10_keyword_rank_daily_with_dims as
select
  d.*,
  p.product_id,
  k.keyword_id
from h10_keyword_rank_daily_latest d
left join products p
  on p.account_id = d.account_id
 and p.marketplace = d.marketplace
 and upper(p.asin) = upper(d.asin)
left join dim_keyword k
  on k.keyword_norm = d.keyword_norm;

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
    when u.source_type = 'h10_keyword_tracker' then (
      select count(1)
      from h10_keyword_tracker_raw r
      where r.upload_id = u.upload_id
    )
    else null
  end as row_count
from uploads u;
