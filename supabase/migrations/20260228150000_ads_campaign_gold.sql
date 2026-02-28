-- Campaign latest-gold cache tables and refresh/rebuild functions.
-- Goal: avoid expensive latest-window stacks in pack generation paths.

create index if not exists sp_campaign_hourly_fact_upload_id_idx
  on public.sp_campaign_hourly_fact (upload_id);

create index if not exists sb_campaign_daily_fact_upload_id_idx
  on public.sb_campaign_daily_fact (upload_id);

create index if not exists sd_campaign_daily_fact_upload_id_idx
  on public.sd_campaign_daily_fact (upload_id);

create table if not exists public.sp_campaign_hourly_fact_gold (
  upload_id uuid not null references public.uploads(upload_id) on delete cascade,
  account_id text not null references public.accounts(account_id),
  date date not null,
  start_time time null,
  start_time_key time generated always as (coalesce(start_time, '00:00:00'::time)) stored,
  start_time_is_null boolean generated always as (start_time is null) stored,
  campaign_id text not null,
  portfolio_id text null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  exported_at timestamptz not null,
  ingested_at timestamptz not null,
  constraint sp_campaign_hourly_fact_gold_uq unique (
    account_id,
    date,
    campaign_id,
    start_time_key,
    start_time_is_null
  )
);

create index if not exists sp_campaign_hourly_fact_gold_account_date_idx
  on public.sp_campaign_hourly_fact_gold (account_id, date);

create index if not exists sp_campaign_hourly_fact_gold_account_campaign_date_idx
  on public.sp_campaign_hourly_fact_gold (account_id, campaign_id, date);

create index if not exists sp_campaign_hourly_fact_gold_upload_id_idx
  on public.sp_campaign_hourly_fact_gold (upload_id);

create table if not exists public.sb_campaign_daily_fact_gold (
  upload_id uuid not null references public.uploads(upload_id) on delete cascade,
  account_id text not null references public.accounts(account_id),
  date date not null,
  campaign_id text not null,
  portfolio_id text null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  exported_at timestamptz not null,
  ingested_at timestamptz not null,
  constraint sb_campaign_daily_fact_gold_uq unique (account_id, date, campaign_id)
);

create index if not exists sb_campaign_daily_fact_gold_account_date_idx
  on public.sb_campaign_daily_fact_gold (account_id, date);

create index if not exists sb_campaign_daily_fact_gold_account_campaign_date_idx
  on public.sb_campaign_daily_fact_gold (account_id, campaign_id, date);

create index if not exists sb_campaign_daily_fact_gold_upload_id_idx
  on public.sb_campaign_daily_fact_gold (upload_id);

create table if not exists public.sd_campaign_daily_fact_gold (
  upload_id uuid not null references public.uploads(upload_id) on delete cascade,
  account_id text not null references public.accounts(account_id),
  date date not null,
  campaign_id text not null,
  cost_type text null,
  cost_type_key text generated always as (coalesce(cost_type, '__NULL__')) stored,
  cost_type_is_null boolean generated always as (cost_type is null) stored,
  portfolio_id text null,
  portfolio_name_raw text null,
  portfolio_name_norm text null,
  campaign_name_raw text not null,
  campaign_name_norm text not null,
  impressions int null,
  clicks int null,
  spend numeric null,
  sales numeric null,
  orders int null,
  units int null,
  cpc numeric null,
  ctr numeric null,
  acos numeric null,
  roas numeric null,
  conversion_rate numeric null,
  exported_at timestamptz not null,
  ingested_at timestamptz not null,
  constraint sd_campaign_daily_fact_gold_uq unique (
    account_id,
    date,
    campaign_id,
    cost_type_key,
    cost_type_is_null
  )
);

create index if not exists sd_campaign_daily_fact_gold_account_date_idx
  on public.sd_campaign_daily_fact_gold (account_id, date);

create index if not exists sd_campaign_daily_fact_gold_account_campaign_date_idx
  on public.sd_campaign_daily_fact_gold (account_id, campaign_id, date);

create index if not exists sd_campaign_daily_fact_gold_account_campaign_cost_date_idx
  on public.sd_campaign_daily_fact_gold (account_id, campaign_id, cost_type_key, date);

create index if not exists sd_campaign_daily_fact_gold_upload_id_idx
  on public.sd_campaign_daily_fact_gold (upload_id);

create or replace function public.refresh_sp_campaign_hourly_fact_gold(p_upload_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_updated int := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  with source_rows as (
    select
      f.upload_id,
      f.account_id,
      f.date,
      f.start_time,
      f.campaign_id,
      f.portfolio_id,
      f.portfolio_name_raw,
      f.portfolio_name_norm,
      f.campaign_name_raw,
      f.campaign_name_norm,
      f.impressions,
      f.clicks,
      f.spend,
      f.sales,
      f.orders,
      f.units,
      f.exported_at,
      u.ingested_at
    from public.sp_campaign_hourly_fact f
    join public.uploads u on u.upload_id = f.upload_id
    where f.upload_id = p_upload_id
  ),
  upserted as (
    insert into public.sp_campaign_hourly_fact_gold (
      upload_id,
      account_id,
      date,
      start_time,
      campaign_id,
      portfolio_id,
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
      ingested_at
    )
    select
      upload_id,
      account_id,
      date,
      start_time,
      campaign_id,
      portfolio_id,
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
      ingested_at
    from source_rows
    on conflict (account_id, date, campaign_id, start_time_key, start_time_is_null)
    do update
      set
        upload_id = excluded.upload_id,
        start_time = excluded.start_time,
        portfolio_id = excluded.portfolio_id,
        portfolio_name_raw = excluded.portfolio_name_raw,
        portfolio_name_norm = excluded.portfolio_name_norm,
        campaign_name_raw = excluded.campaign_name_raw,
        campaign_name_norm = excluded.campaign_name_norm,
        impressions = excluded.impressions,
        clicks = excluded.clicks,
        spend = excluded.spend,
        sales = excluded.sales,
        orders = excluded.orders,
        units = excluded.units,
        exported_at = excluded.exported_at,
        ingested_at = excluded.ingested_at
      where (excluded.exported_at, excluded.ingested_at, excluded.upload_id)
        > (sp_campaign_hourly_fact_gold.exported_at, sp_campaign_hourly_fact_gold.ingested_at, sp_campaign_hourly_fact_gold.upload_id)
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted),
    count(*) filter (where not inserted)
  into v_inserted, v_updated
  from upserted;

  return jsonb_build_object(
    'inserted', coalesce(v_inserted, 0),
    'updated', coalesce(v_updated, 0)
  );
end;
$$;

create or replace function public.refresh_sb_campaign_daily_fact_gold(p_upload_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_updated int := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  with source_rows as (
    select
      f.upload_id,
      f.account_id,
      f.date,
      f.campaign_id,
      f.portfolio_id,
      f.portfolio_name_raw,
      f.portfolio_name_norm,
      f.campaign_name_raw,
      f.campaign_name_norm,
      f.impressions,
      f.clicks,
      f.spend,
      f.sales,
      f.orders,
      f.units,
      f.exported_at,
      u.ingested_at
    from public.sb_campaign_daily_fact f
    join public.uploads u on u.upload_id = f.upload_id
    where f.upload_id = p_upload_id
  ),
  upserted as (
    insert into public.sb_campaign_daily_fact_gold (
      upload_id,
      account_id,
      date,
      campaign_id,
      portfolio_id,
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
      ingested_at
    )
    select
      upload_id,
      account_id,
      date,
      campaign_id,
      portfolio_id,
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
      ingested_at
    from source_rows
    on conflict (account_id, date, campaign_id)
    do update
      set
        upload_id = excluded.upload_id,
        portfolio_id = excluded.portfolio_id,
        portfolio_name_raw = excluded.portfolio_name_raw,
        portfolio_name_norm = excluded.portfolio_name_norm,
        campaign_name_raw = excluded.campaign_name_raw,
        campaign_name_norm = excluded.campaign_name_norm,
        impressions = excluded.impressions,
        clicks = excluded.clicks,
        spend = excluded.spend,
        sales = excluded.sales,
        orders = excluded.orders,
        units = excluded.units,
        exported_at = excluded.exported_at,
        ingested_at = excluded.ingested_at
      where (excluded.exported_at, excluded.ingested_at, excluded.upload_id)
        > (sb_campaign_daily_fact_gold.exported_at, sb_campaign_daily_fact_gold.ingested_at, sb_campaign_daily_fact_gold.upload_id)
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted),
    count(*) filter (where not inserted)
  into v_inserted, v_updated
  from upserted;

  return jsonb_build_object(
    'inserted', coalesce(v_inserted, 0),
    'updated', coalesce(v_updated, 0)
  );
end;
$$;

create or replace function public.refresh_sd_campaign_daily_fact_gold(p_upload_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted int := 0;
  v_updated int := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;

  with source_rows as (
    select
      f.upload_id,
      f.account_id,
      f.date,
      f.campaign_id,
      f.cost_type,
      f.portfolio_id,
      f.portfolio_name_raw,
      f.portfolio_name_norm,
      f.campaign_name_raw,
      f.campaign_name_norm,
      f.impressions,
      f.clicks,
      f.spend,
      f.sales,
      f.orders,
      f.units,
      f.cpc,
      f.ctr,
      f.acos,
      f.roas,
      f.conversion_rate,
      f.exported_at,
      u.ingested_at
    from public.sd_campaign_daily_fact f
    join public.uploads u on u.upload_id = f.upload_id
    where f.upload_id = p_upload_id
  ),
  upserted as (
    insert into public.sd_campaign_daily_fact_gold (
      upload_id,
      account_id,
      date,
      campaign_id,
      cost_type,
      portfolio_id,
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
      cpc,
      ctr,
      acos,
      roas,
      conversion_rate,
      exported_at,
      ingested_at
    )
    select
      upload_id,
      account_id,
      date,
      campaign_id,
      cost_type,
      portfolio_id,
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
      cpc,
      ctr,
      acos,
      roas,
      conversion_rate,
      exported_at,
      ingested_at
    from source_rows
    on conflict (account_id, date, campaign_id, cost_type_key, cost_type_is_null)
    do update
      set
        upload_id = excluded.upload_id,
        cost_type = excluded.cost_type,
        portfolio_id = excluded.portfolio_id,
        portfolio_name_raw = excluded.portfolio_name_raw,
        portfolio_name_norm = excluded.portfolio_name_norm,
        campaign_name_raw = excluded.campaign_name_raw,
        campaign_name_norm = excluded.campaign_name_norm,
        impressions = excluded.impressions,
        clicks = excluded.clicks,
        spend = excluded.spend,
        sales = excluded.sales,
        orders = excluded.orders,
        units = excluded.units,
        cpc = excluded.cpc,
        ctr = excluded.ctr,
        acos = excluded.acos,
        roas = excluded.roas,
        conversion_rate = excluded.conversion_rate,
        exported_at = excluded.exported_at,
        ingested_at = excluded.ingested_at
      where (excluded.exported_at, excluded.ingested_at, excluded.upload_id)
        > (sd_campaign_daily_fact_gold.exported_at, sd_campaign_daily_fact_gold.ingested_at, sd_campaign_daily_fact_gold.upload_id)
    returning (xmax = 0) as inserted
  )
  select
    count(*) filter (where inserted),
    count(*) filter (where not inserted)
  into v_inserted, v_updated
  from upserted;

  return jsonb_build_object(
    'inserted', coalesce(v_inserted, 0),
    'updated', coalesce(v_updated, 0)
  );
end;
$$;

create or replace function public.rebuild_sp_campaign_hourly_fact_gold(
  p_account_id text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
  v_inserted int := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_account_id is null or p_start_date is null or p_end_date is null then
    raise exception 'account_id, start_date, and end_date are required';
  end if;
  if p_start_date > p_end_date then
    raise exception 'start_date must be <= end_date';
  end if;

  set local statement_timeout = 0;

  delete from public.sp_campaign_hourly_fact_gold g
  where g.account_id = p_account_id
    and g.date between p_start_date and p_end_date;
  get diagnostics v_deleted = row_count;

  insert into public.sp_campaign_hourly_fact_gold (
    upload_id,
    account_id,
    date,
    start_time,
    campaign_id,
    portfolio_id,
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
    ingested_at
  )
  select distinct on (
    f.account_id,
    f.date,
    f.campaign_id,
    coalesce(f.start_time, '00:00:00'::time),
    (f.start_time is null)
  )
    f.upload_id,
    f.account_id,
    f.date,
    f.start_time,
    f.campaign_id,
    f.portfolio_id,
    f.portfolio_name_raw,
    f.portfolio_name_norm,
    f.campaign_name_raw,
    f.campaign_name_norm,
    f.impressions,
    f.clicks,
    f.spend,
    f.sales,
    f.orders,
    f.units,
    f.exported_at,
    u.ingested_at
  from public.sp_campaign_hourly_fact f
  join public.uploads u on u.upload_id = f.upload_id
  where f.account_id = p_account_id
    and f.date between p_start_date and p_end_date
  order by
    f.account_id,
    f.date,
    f.campaign_id,
    coalesce(f.start_time, '00:00:00'::time),
    (f.start_time is null),
    f.exported_at desc,
    u.ingested_at desc,
    f.upload_id desc;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'deleted', coalesce(v_deleted, 0),
    'inserted', coalesce(v_inserted, 0)
  );
end;
$$;

create or replace function public.rebuild_sb_campaign_daily_fact_gold(
  p_account_id text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
  v_inserted int := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_account_id is null or p_start_date is null or p_end_date is null then
    raise exception 'account_id, start_date, and end_date are required';
  end if;
  if p_start_date > p_end_date then
    raise exception 'start_date must be <= end_date';
  end if;

  set local statement_timeout = 0;

  delete from public.sb_campaign_daily_fact_gold g
  where g.account_id = p_account_id
    and g.date between p_start_date and p_end_date;
  get diagnostics v_deleted = row_count;

  insert into public.sb_campaign_daily_fact_gold (
    upload_id,
    account_id,
    date,
    campaign_id,
    portfolio_id,
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
    ingested_at
  )
  select distinct on (
    f.account_id,
    f.date,
    f.campaign_id
  )
    f.upload_id,
    f.account_id,
    f.date,
    f.campaign_id,
    f.portfolio_id,
    f.portfolio_name_raw,
    f.portfolio_name_norm,
    f.campaign_name_raw,
    f.campaign_name_norm,
    f.impressions,
    f.clicks,
    f.spend,
    f.sales,
    f.orders,
    f.units,
    f.exported_at,
    u.ingested_at
  from public.sb_campaign_daily_fact f
  join public.uploads u on u.upload_id = f.upload_id
  where f.account_id = p_account_id
    and f.date between p_start_date and p_end_date
  order by
    f.account_id,
    f.date,
    f.campaign_id,
    f.exported_at desc,
    u.ingested_at desc,
    f.upload_id desc;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'deleted', coalesce(v_deleted, 0),
    'inserted', coalesce(v_inserted, 0)
  );
end;
$$;

create or replace function public.rebuild_sd_campaign_daily_fact_gold(
  p_account_id text,
  p_start_date date,
  p_end_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted int := 0;
  v_inserted int := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'service_role required';
  end if;
  if p_account_id is null or p_start_date is null or p_end_date is null then
    raise exception 'account_id, start_date, and end_date are required';
  end if;
  if p_start_date > p_end_date then
    raise exception 'start_date must be <= end_date';
  end if;

  set local statement_timeout = 0;

  delete from public.sd_campaign_daily_fact_gold g
  where g.account_id = p_account_id
    and g.date between p_start_date and p_end_date;
  get diagnostics v_deleted = row_count;

  insert into public.sd_campaign_daily_fact_gold (
    upload_id,
    account_id,
    date,
    campaign_id,
    cost_type,
    portfolio_id,
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
    cpc,
    ctr,
    acos,
    roas,
    conversion_rate,
    exported_at,
    ingested_at
  )
  select distinct on (
    f.account_id,
    f.date,
    f.campaign_id,
    coalesce(f.cost_type, '__NULL__'),
    (f.cost_type is null)
  )
    f.upload_id,
    f.account_id,
    f.date,
    f.campaign_id,
    f.cost_type,
    f.portfolio_id,
    f.portfolio_name_raw,
    f.portfolio_name_norm,
    f.campaign_name_raw,
    f.campaign_name_norm,
    f.impressions,
    f.clicks,
    f.spend,
    f.sales,
    f.orders,
    f.units,
    f.cpc,
    f.ctr,
    f.acos,
    f.roas,
    f.conversion_rate,
    f.exported_at,
    u.ingested_at
  from public.sd_campaign_daily_fact f
  join public.uploads u on u.upload_id = f.upload_id
  where f.account_id = p_account_id
    and f.date between p_start_date and p_end_date
  order by
    f.account_id,
    f.date,
    f.campaign_id,
    coalesce(f.cost_type, '__NULL__'),
    (f.cost_type is null),
    f.exported_at desc,
    u.ingested_at desc,
    f.upload_id desc;

  get diagnostics v_inserted = row_count;

  return jsonb_build_object(
    'deleted', coalesce(v_deleted, 0),
    'inserted', coalesce(v_inserted, 0)
  );
end;
$$;

create or replace view public.sp_campaign_hourly_fact_latest_gold as
select
  g.upload_id,
  g.account_id,
  g.date,
  g.start_time,
  g.campaign_id,
  g.portfolio_id,
  g.portfolio_name_raw,
  g.portfolio_name_norm,
  g.campaign_name_raw,
  g.campaign_name_norm,
  g.impressions,
  g.clicks,
  g.spend,
  g.sales,
  g.orders,
  g.units,
  g.exported_at,
  g.ingested_at,
  1::bigint as rn
from public.sp_campaign_hourly_fact_gold g;

create or replace view public.sp_campaign_daily_fact_latest_gold as
with grouped as (
  select
    account_id,
    date,
    campaign_id,
    bool_or(start_time is not null) as has_hourly_rows,
    max(portfolio_id) filter (where start_time is not null) as portfolio_id_hourly,
    max(portfolio_id) filter (where start_time is null) as portfolio_id_daily,
    max(portfolio_name_raw) filter (where start_time is not null) as portfolio_name_raw_hourly,
    max(portfolio_name_raw) filter (where start_time is null) as portfolio_name_raw_daily,
    max(portfolio_name_norm) filter (where start_time is not null) as portfolio_name_norm_hourly,
    max(portfolio_name_norm) filter (where start_time is null) as portfolio_name_norm_daily,
    max(campaign_name_raw) filter (where start_time is not null) as campaign_name_raw_hourly,
    max(campaign_name_raw) filter (where start_time is null) as campaign_name_raw_daily,
    max(campaign_name_norm) filter (where start_time is not null) as campaign_name_norm_hourly,
    max(campaign_name_norm) filter (where start_time is null) as campaign_name_norm_daily,
    sum(coalesce(impressions, 0)) filter (where start_time is not null) as impressions_hourly,
    sum(coalesce(impressions, 0)) filter (where start_time is null) as impressions_daily,
    sum(coalesce(clicks, 0)) filter (where start_time is not null) as clicks_hourly,
    sum(coalesce(clicks, 0)) filter (where start_time is null) as clicks_daily,
    sum(coalesce(spend, 0)) filter (where start_time is not null) as spend_hourly,
    sum(coalesce(spend, 0)) filter (where start_time is null) as spend_daily,
    sum(coalesce(sales, 0)) filter (where start_time is not null) as sales_hourly,
    sum(coalesce(sales, 0)) filter (where start_time is null) as sales_daily,
    sum(coalesce(orders, 0)) filter (where start_time is not null) as orders_hourly,
    sum(coalesce(orders, 0)) filter (where start_time is null) as orders_daily,
    sum(coalesce(units, 0)) filter (where start_time is not null) as units_hourly,
    sum(coalesce(units, 0)) filter (where start_time is null) as units_daily,
    max(exported_at) filter (where start_time is not null) as exported_at_hourly,
    max(exported_at) filter (where start_time is null) as exported_at_daily
  from public.sp_campaign_hourly_fact_gold
  group by account_id, date, campaign_id
)
select
  account_id,
  date,
  campaign_id,
  case when has_hourly_rows then portfolio_id_hourly else portfolio_id_daily end as portfolio_id,
  case when has_hourly_rows then portfolio_name_raw_hourly else portfolio_name_raw_daily end as portfolio_name_raw,
  case when has_hourly_rows then portfolio_name_norm_hourly else portfolio_name_norm_daily end as portfolio_name_norm,
  case when has_hourly_rows then campaign_name_raw_hourly else campaign_name_raw_daily end as campaign_name_raw,
  case when has_hourly_rows then campaign_name_norm_hourly else campaign_name_norm_daily end as campaign_name_norm,
  case when has_hourly_rows then impressions_hourly else impressions_daily end::int as impressions,
  case when has_hourly_rows then clicks_hourly else clicks_daily end::int as clicks,
  case when has_hourly_rows then spend_hourly else spend_daily end as spend,
  case when has_hourly_rows then sales_hourly else sales_daily end as sales,
  case when has_hourly_rows then orders_hourly else orders_daily end::int as orders,
  case when has_hourly_rows then units_hourly else units_daily end::int as units,
  case when has_hourly_rows then exported_at_hourly else exported_at_daily end as exported_at
from grouped;

create or replace view public.sb_campaign_daily_fact_latest_gold as
select
  g.upload_id,
  g.account_id,
  g.date,
  g.campaign_id,
  g.portfolio_id,
  g.portfolio_name_raw,
  g.portfolio_name_norm,
  g.campaign_name_raw,
  g.campaign_name_norm,
  g.impressions,
  g.clicks,
  g.spend,
  g.sales,
  g.orders,
  g.units,
  g.exported_at,
  g.ingested_at,
  1::bigint as rn
from public.sb_campaign_daily_fact_gold g;

create or replace view public.sd_campaign_daily_fact_latest_gold as
select
  g.upload_id,
  g.account_id,
  g.date,
  g.campaign_id,
  g.portfolio_id,
  g.portfolio_name_raw,
  g.portfolio_name_norm,
  g.campaign_name_raw,
  g.campaign_name_norm,
  g.cost_type,
  g.impressions,
  g.clicks,
  g.spend,
  g.sales,
  g.orders,
  g.units,
  g.cpc,
  g.ctr,
  g.acos,
  g.roas,
  g.conversion_rate,
  g.exported_at,
  g.ingested_at,
  1::bigint as rn
from public.sd_campaign_daily_fact_gold g;

revoke all on function public.refresh_sp_campaign_hourly_fact_gold(uuid) from public, anon, authenticated;
revoke all on function public.refresh_sb_campaign_daily_fact_gold(uuid) from public, anon, authenticated;
revoke all on function public.refresh_sd_campaign_daily_fact_gold(uuid) from public, anon, authenticated;
revoke all on function public.rebuild_sp_campaign_hourly_fact_gold(text, date, date) from public, anon, authenticated;
revoke all on function public.rebuild_sb_campaign_daily_fact_gold(text, date, date) from public, anon, authenticated;
revoke all on function public.rebuild_sd_campaign_daily_fact_gold(text, date, date) from public, anon, authenticated;

grant execute on function public.refresh_sp_campaign_hourly_fact_gold(uuid) to service_role;
grant execute on function public.refresh_sb_campaign_daily_fact_gold(uuid) to service_role;
grant execute on function public.refresh_sd_campaign_daily_fact_gold(uuid) to service_role;
grant execute on function public.rebuild_sp_campaign_hourly_fact_gold(text, date, date) to service_role;
grant execute on function public.rebuild_sb_campaign_daily_fact_gold(text, date, date) to service_role;
grant execute on function public.rebuild_sd_campaign_daily_fact_gold(text, date, date) to service_role;
