create index if not exists sp_advertised_product_daily_fact_natural_idx
  on public.sp_advertised_product_daily_fact (
    account_id,
    date,
    campaign_id,
    coalesce(ad_group_id, ''),
    advertised_asin_norm,
    coalesce(sku_raw, ''),
    exported_at
  );

create unique index if not exists sb_attributed_purchases_daily_fact_uq
  on public.sb_attributed_purchases_daily_fact (
    account_id,
    date,
    campaign_id,
    purchased_sku_norm,
    purchased_asin_norm,
    exported_at
  );
