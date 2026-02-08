create or replace view sp_placement_daily_latest as
select * from (
  select
    r.upload_id,
    r.account_id,
    r.date,
    r.portfolio_name_raw,
    r.portfolio_name_norm,
    r.campaign_name_raw,
    r.campaign_name_norm,
    r.bidding_strategy,
    r.placement_raw,
    r.placement_code,
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
    r.exported_at,
    row_number() over (
      partition by r.account_id, r.date, r.campaign_name_norm, r.placement_code
      order by r.exported_at desc
    ) as rn
  from sp_placement_daily_raw r
) latest
where latest.rn = 1;
