-- Allow roll-up rows where targeting_norm = '*' by supporting null target_id with a stable key.

alter table sp_stis_daily_fact
  add column if not exists target_key text not null default '__ROLLUP__';

update sp_stis_daily_fact
set target_key = coalesce(target_id, '__ROLLUP__');

alter table sp_stis_daily_fact
  alter column target_id drop not null;

alter table sp_stis_daily_fact
  drop constraint if exists sp_stis_daily_fact_uq;

alter table sp_stis_daily_fact
  add constraint sp_stis_daily_fact_uq unique (
    account_id,
    upload_id,
    date,
    campaign_id,
    ad_group_id,
    target_key,
    customer_search_term_norm
  );

drop view if exists sp_stis_daily_fact_latest;

create view sp_stis_daily_fact_latest as
select * from (
  select
    f.*,
    row_number() over (
      partition by f.account_id, f.date, f.campaign_id, f.ad_group_id, f.target_key, f.customer_search_term_norm
      order by f.exported_at desc
    ) as rn
  from sp_stis_daily_fact f
) latest
where latest.rn = 1;
