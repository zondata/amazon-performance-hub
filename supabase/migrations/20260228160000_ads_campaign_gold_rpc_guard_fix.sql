-- depends on supabase auth schema; auth.role() available in Supabase

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
  if auth.role() <> 'service_role' then
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
  if auth.role() <> 'service_role' then
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
  if auth.role() <> 'service_role' then
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
  if auth.role() <> 'service_role' then
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
  if auth.role() <> 'service_role' then
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
  if auth.role() <> 'service_role' then
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
