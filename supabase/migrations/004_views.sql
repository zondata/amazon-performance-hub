CREATE OR REPLACE VIEW sp_campaign_hourly_latest AS
SELECT
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  impressions,
  clicks,
  spend,
  sales,
  orders,
  units,
  exported_at,
  start_time
FROM (
  SELECT
    r.*,
    row_number() OVER (
      PARTITION BY r.account_id, r.date, r.start_time, r.campaign_name_norm
      ORDER BY r.exported_at DESC
    ) AS rn
  FROM sp_campaign_daily_raw r
) t
WHERE t.rn = 1;


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
    else null
  end as row_count
from uploads u;
