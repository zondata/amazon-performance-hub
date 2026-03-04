create index if not exists sp_targeting_daily_fact_account_campaign_date_idx
  on sp_targeting_daily_fact (account_id, campaign_id, date);
