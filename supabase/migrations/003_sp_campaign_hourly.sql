alter table sp_campaign_daily_raw
  add column if not exists start_time time null;

alter table sp_campaign_daily_raw
  drop constraint if exists sp_campaign_daily_raw_uq;

alter table sp_campaign_daily_raw
  add constraint sp_campaign_daily_raw_uq unique (account_id, date, start_time, campaign_name_norm, exported_at);

create index if not exists sp_campaign_daily_raw_account_date_time_idx
  on sp_campaign_daily_raw (account_id, date, start_time);
