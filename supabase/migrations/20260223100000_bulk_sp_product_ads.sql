create table if not exists bulk_product_ads (
  account_id text not null references accounts(account_id),
  snapshot_date date not null,
  ad_id text not null,
  ad_group_id text not null,
  campaign_id text not null,
  sku_raw text null,
  asin_raw text null,
  constraint bulk_product_ads_uq unique (account_id, snapshot_date, ad_id)
);

create index if not exists bulk_product_ads_account_snapshot_asin_idx
  on bulk_product_ads (account_id, snapshot_date, asin_raw);

create index if not exists bulk_product_ads_account_snapshot_ad_group_idx
  on bulk_product_ads (account_id, snapshot_date, ad_group_id);
