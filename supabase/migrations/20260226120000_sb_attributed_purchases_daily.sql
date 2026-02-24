-- Sponsored Brands Attributed Purchases (purchased ASIN-level daily facts)

alter table uploads
  drop constraint if exists uploads_source_type_chk;

alter table uploads
  add constraint uploads_source_type_chk
  check (source_type in (
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
    'sb_attributed_purchases',
    'sd_campaign',
    'sd_advertised_product',
    'sd_targeting',
    'sd_matched_target',
    'sd_purchased_product',
    'si_sales_trend',
    'sqp',
    'h10_keyword_tracker'
  ));

create table if not exists sb_attributed_purchases_daily_fact (
  account_id text not null references accounts(account_id),
  date date not null,
  campaign_id text not null,
  campaign_name_raw text null,
  campaign_name_norm text null,
  purchased_sku_raw text null,
  purchased_sku_norm text null,
  purchased_asin_raw text not null,
  purchased_asin_norm text not null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  exported_at timestamptz not null
);

create index if not exists sb_attributed_purchases_daily_fact_account_date_idx
  on sb_attributed_purchases_daily_fact (account_id, date);

create index if not exists sb_attributed_purchases_daily_fact_account_asin_date_idx
  on sb_attributed_purchases_daily_fact (account_id, purchased_asin_norm, date);

create index if not exists sb_attributed_purchases_daily_fact_account_campaign_date_idx
  on sb_attributed_purchases_daily_fact (account_id, campaign_id, date);

create or replace view sb_attributed_purchases_daily_fact_latest as
select
  daily.*
from (
  select
    f.*,
    row_number() over (
      partition by
        f.account_id,
        f.date,
        f.campaign_id,
        f.purchased_asin_norm,
        coalesce(f.purchased_sku_norm, '')
      order by f.exported_at desc
    ) as rn
  from sb_attributed_purchases_daily_fact f
) daily
where daily.rn = 1;
