create or replace view sp_targeting_daily_latest as
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
    r.top_of_search_impression_share,
    r.exported_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.ad_group_name_norm, r.targeting_norm, r.match_type_norm
      order by r.exported_at desc
    ) as rn
  from sp_targeting_daily_raw r
) latest
where latest.rn = 1;
