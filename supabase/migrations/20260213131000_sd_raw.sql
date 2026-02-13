-- Sponsored Display raw reports + latest views + upload source types + upload_stats counts

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
  'sd_purchased_product'
));

create table if not exists sd_campaign_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  cost_type text null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  cpc numeric null,
  ctr numeric null,
  acos numeric null,
  roas numeric null,
  conversion_rate numeric null,
  exported_at timestamptz not null,
  constraint sd_campaign_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    cost_type,
    exported_at
  )
);

create index if not exists sd_campaign_daily_raw_account_date_idx
  on sd_campaign_daily_raw (account_id, date);

create index if not exists sd_campaign_daily_raw_account_campaign_norm_idx
  on sd_campaign_daily_raw (account_id, campaign_name_norm);

create index if not exists sd_campaign_daily_raw_upload_id_idx
  on sd_campaign_daily_raw (upload_id);

create table if not exists sd_advertised_product_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  advertised_sku_raw text null,
  advertised_sku_norm text null,
  advertised_asin_raw text null,
  advertised_asin_norm text null,
  cost_type text null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  cpc numeric null,
  ctr numeric null,
  acos numeric null,
  roas numeric null,
  conversion_rate numeric null,
  exported_at timestamptz not null,
  constraint sd_advertised_product_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    ad_group_name_norm,
    advertised_sku_norm,
    advertised_asin_norm,
    cost_type,
    exported_at
  )
);

create index if not exists sd_advertised_product_daily_raw_account_date_idx
  on sd_advertised_product_daily_raw (account_id, date);

create index if not exists sd_advertised_product_daily_raw_account_campaign_norm_idx
  on sd_advertised_product_daily_raw (account_id, campaign_name_norm);

create index if not exists sd_advertised_product_daily_raw_upload_id_idx
  on sd_advertised_product_daily_raw (upload_id);

create table if not exists sd_targeting_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  targeting_raw text not null,
  targeting_norm text not null,
  match_type_raw text null,
  match_type_norm text null,
  cost_type text null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  cpc numeric null,
  ctr numeric null,
  acos numeric null,
  roas numeric null,
  conversion_rate numeric null,
  exported_at timestamptz not null,
  constraint sd_targeting_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    ad_group_name_norm,
    targeting_norm,
    match_type_norm,
    cost_type,
    exported_at
  )
);

create index if not exists sd_targeting_daily_raw_account_date_idx
  on sd_targeting_daily_raw (account_id, date);

create index if not exists sd_targeting_daily_raw_account_campaign_norm_idx
  on sd_targeting_daily_raw (account_id, campaign_name_norm);

create index if not exists sd_targeting_daily_raw_upload_id_idx
  on sd_targeting_daily_raw (upload_id);

create table if not exists sd_matched_target_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  targeting_raw text not null,
  targeting_norm text not null,
  matched_target_raw text not null,
  matched_target_norm text not null,
  cost_type text null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  cpc numeric null,
  ctr numeric null,
  acos numeric null,
  roas numeric null,
  conversion_rate numeric null,
  exported_at timestamptz not null,
  constraint sd_matched_target_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    ad_group_name_norm,
    targeting_norm,
    matched_target_norm,
    cost_type,
    exported_at
  )
);

create index if not exists sd_matched_target_daily_raw_account_date_idx
  on sd_matched_target_daily_raw (account_id, date);

create index if not exists sd_matched_target_daily_raw_account_campaign_norm_idx
  on sd_matched_target_daily_raw (account_id, campaign_name_norm);

create index if not exists sd_matched_target_daily_raw_upload_id_idx
  on sd_matched_target_daily_raw (upload_id);

create table if not exists sd_purchased_product_daily_raw (
  upload_id uuid not null references uploads(upload_id),
  account_id text not null references accounts(account_id),
  date date not null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  ad_group_name_raw text not null,
  ad_group_name_norm text not null,
  purchased_sku_raw text null,
  purchased_sku_norm text null,
  purchased_asin_raw text null,
  purchased_asin_norm text null,
  cost_type text null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  cpc numeric null,
  ctr numeric null,
  acos numeric null,
  roas numeric null,
  conversion_rate numeric null,
  exported_at timestamptz not null,
  constraint sd_purchased_product_daily_raw_uq unique (
    account_id,
    date,
    campaign_name_norm,
    ad_group_name_norm,
    purchased_sku_norm,
    purchased_asin_norm,
    cost_type,
    exported_at
  )
);

create index if not exists sd_purchased_product_daily_raw_account_date_idx
  on sd_purchased_product_daily_raw (account_id, date);

create index if not exists sd_purchased_product_daily_raw_account_campaign_norm_idx
  on sd_purchased_product_daily_raw (account_id, campaign_name_norm);

create index if not exists sd_purchased_product_daily_raw_upload_id_idx
  on sd_purchased_product_daily_raw (upload_id);

-- Latest wins views (deterministic tie-break)
create or replace view sd_campaign_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  cost_type,
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
  conversion_rate,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.cost_type
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sd_campaign_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sd_advertised_product_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  ad_group_name_raw,
  ad_group_name_norm,
  advertised_sku_raw,
  advertised_sku_norm,
  advertised_asin_raw,
  advertised_asin_norm,
  cost_type,
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
  conversion_rate,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.advertised_sku_norm, r.advertised_asin_norm, r.cost_type
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sd_advertised_product_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sd_targeting_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  ad_group_name_raw,
  ad_group_name_norm,
  targeting_raw,
  targeting_norm,
  match_type_raw,
  match_type_norm,
  cost_type,
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
  conversion_rate,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.match_type_norm, r.cost_type
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sd_targeting_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sd_matched_target_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  ad_group_name_raw,
  ad_group_name_norm,
  targeting_raw,
  targeting_norm,
  matched_target_raw,
  matched_target_norm,
  cost_type,
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
  conversion_rate,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.matched_target_norm, r.cost_type
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sd_matched_target_daily_raw r
  join uploads u on u.upload_id = r.upload_id
) t
where t.rn = 1;

create or replace view sd_purchased_product_daily_latest as
select
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  ad_group_name_raw,
  ad_group_name_norm,
  purchased_sku_raw,
  purchased_sku_norm,
  purchased_asin_raw,
  purchased_asin_norm,
  cost_type,
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
  conversion_rate,
  exported_at
from (
  select
    r.*,
    u.ingested_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.purchased_sku_norm, r.purchased_asin_norm, r.cost_type
      order by r.exported_at desc, u.ingested_at desc, r.upload_id desc
    ) as rn
  from sd_purchased_product_daily_raw r
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
    else null
  end as row_count
from uploads u;
