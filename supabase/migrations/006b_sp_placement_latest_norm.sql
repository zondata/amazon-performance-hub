CREATE OR REPLACE VIEW sp_placement_daily_latest AS
SELECT
  upload_id,
  account_id,
  date,
  portfolio_name_raw,
  portfolio_name_norm,
  campaign_name_raw,
  campaign_name_norm,
  bidding_strategy,
  placement_raw,
  placement_code,
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
  exported_at,
  rn
FROM (
  SELECT
    r.*,
    row_number() OVER (
      PARTITION BY account_id, date, campaign_name_norm, placement_code, placement_raw_norm
      ORDER BY exported_at DESC
    ) AS rn
  FROM sp_placement_daily_raw r
) t
WHERE t.rn = 1;
