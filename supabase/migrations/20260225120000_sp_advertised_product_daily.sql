alter table uploads drop constraint if exists uploads_source_type_chk;

alter table uploads add constraint uploads_source_type_chk check (source_type in (
  'bulk',
  'sp_campaign',
  'sp_targeting',
  'sp_placement',
  'sp_stis',
  'sp_advertised_product',
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

create table if not exists sp_advertised_product_daily_fact (
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  ad_group_id text null,
  campaign_name_raw text null,
  campaign_name_norm text null,
  ad_group_name_raw text null,
  ad_group_name_norm text null,
  advertised_asin_raw text not null,
  advertised_asin_norm text not null,
  sku_raw text null,
  impressions numeric null,
  clicks numeric null,
  spend numeric null,
  sales numeric null,
  orders numeric null,
  units numeric null,
  exported_at timestamptz not null
);

create index if not exists sp_advertised_product_daily_fact_account_date_idx
  on sp_advertised_product_daily_fact (account_id, date);

create index if not exists sp_advertised_product_daily_fact_account_asin_date_idx
  on sp_advertised_product_daily_fact (account_id, advertised_asin_norm, date);

create index if not exists sp_advertised_product_daily_fact_account_campaign_date_idx
  on sp_advertised_product_daily_fact (account_id, campaign_id, date);

create or replace view sp_advertised_product_daily_fact_latest as
select * from (
  select
    f.*,
    row_number() over (
      partition by
        f.account_id,
        f.date,
        f.campaign_id,
        coalesce(f.ad_group_id, ''),
        f.advertised_asin_norm
      order by f.exported_at desc
    ) as rn
  from sp_advertised_product_daily_fact f
) latest
where latest.rn = 1;
