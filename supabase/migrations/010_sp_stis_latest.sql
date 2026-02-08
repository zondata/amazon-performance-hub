create or replace view sp_stis_daily_latest as
select * from (
  select
    r.upload_id,
    r.account_id,
    r.date,
    r.portfolio_name_raw,
    r.portfolio_name_norm,
    r.campaign_name_raw,
    r.campaign_name_norm,
    r.ad_group_name_raw,
    r.ad_group_name_norm,
    r.targeting_raw,
    r.targeting_norm,
    r.match_type_raw,
    r.match_type_norm,
    r.customer_search_term_raw,
    r.customer_search_term_norm,
    r.search_term_impression_rank,
    r.search_term_impression_share,
    r.impressions,
    r.clicks,
    r.spend,
    r.sales,
    r.orders,
    r.units,
    r.cpc,
    r.ctr,
    r.acos,
    r.roas,
    r.conversion_rate,
    r.exported_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.match_type_norm, r.customer_search_term_norm
      order by r.exported_at desc
    ) as rn
  from sp_stis_daily_raw r
) latest
where latest.rn = 1;
