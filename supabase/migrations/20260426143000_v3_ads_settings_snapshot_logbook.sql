alter table public.log_changes
  add column if not exists entity_level text null,
  add column if not exists field_name text null;

create index if not exists log_changes_auto_ads_settings_idx
  on public.log_changes(account_id, marketplace, channel, source, occurred_at desc)
  where source = 'automatic_ads_settings_snapshot';

create index if not exists log_changes_entity_field_idx
  on public.log_changes(entity_level, field_name)
  where entity_level is not null and field_name is not null;

create or replace view public.v3_ads_settings_snapshot_rows as
select account_id, 'sp'::text as channel, snapshot_date, 'campaign'::text as entity_level,
  campaign_id as entity_key, campaign_id, null::text as ad_group_id, null::text as target_id, null::text as ad_id,
  field_name, field_value, to_jsonb(field_value) as field_value_json,
  campaign_name_raw as entity_label
from public.bulk_campaigns
cross join lateral (values
  ('campaign_name'::text, campaign_name_raw),
  ('campaign_name_norm'::text, campaign_name_norm),
  ('state'::text, state),
  ('daily_budget'::text, daily_budget::text),
  ('bidding_strategy'::text, bidding_strategy),
  ('portfolio_id'::text, portfolio_id)
) as fields(field_name, field_value)
union all
select account_id, 'sp', snapshot_date, 'ad_group',
  ad_group_id, campaign_id, ad_group_id, null::text, null::text,
  field_name, field_value, to_jsonb(field_value), ad_group_name_raw
from public.bulk_ad_groups
cross join lateral (values
  ('ad_group_name'::text, ad_group_name_raw),
  ('ad_group_name_norm'::text, ad_group_name_norm),
  ('state'::text, state),
  ('default_bid'::text, default_bid::text)
) as fields(field_name, field_value)
union all
select account_id, 'sp', snapshot_date, 'target',
  target_id, campaign_id, ad_group_id, target_id, null::text,
  field_name, field_value, to_jsonb(field_value), expression_raw
from public.bulk_targets
cross join lateral (values
  ('target_expression'::text, expression_raw),
  ('target_expression_norm'::text, expression_norm),
  ('match_type'::text, match_type),
  ('is_negative'::text, is_negative::text),
  ('state'::text, state),
  ('bid'::text, bid::text)
) as fields(field_name, field_value)
union all
select account_id, 'sp', snapshot_date, 'placement',
  campaign_id || '::' || placement_code, campaign_id, null::text, null::text, null::text,
  'placement_modifier_pct', percentage::text, to_jsonb(percentage::text), placement_raw
from public.bulk_placements
union all
select account_id, 'sp', snapshot_date, 'product_ad',
  ad_id, campaign_id, ad_group_id, null::text, ad_id,
  field_name, field_value, to_jsonb(field_value), coalesce(sku_raw, asin_raw, ad_id)
from public.bulk_product_ads
cross join lateral (values
  ('product_ad_sku'::text, sku_raw),
  ('product_ad_asin'::text, asin_raw)
) as fields(field_name, field_value)
union all
select account_id, 'sb', snapshot_date, 'campaign',
  campaign_id, campaign_id, null::text, null::text, null::text,
  field_name, field_value, to_jsonb(field_value), campaign_name_raw
from public.bulk_sb_campaigns
cross join lateral (values
  ('campaign_name'::text, campaign_name_raw),
  ('campaign_name_norm'::text, campaign_name_norm),
  ('state'::text, state),
  ('daily_budget'::text, daily_budget::text),
  ('bidding_strategy'::text, bidding_strategy),
  ('portfolio_id'::text, portfolio_id)
) as fields(field_name, field_value)
union all
select account_id, 'sb', snapshot_date, 'ad_group',
  ad_group_id, campaign_id, ad_group_id, null::text, null::text,
  field_name, field_value, to_jsonb(field_value), ad_group_name_raw
from public.bulk_sb_ad_groups
cross join lateral (values
  ('ad_group_name'::text, ad_group_name_raw),
  ('ad_group_name_norm'::text, ad_group_name_norm),
  ('state'::text, state),
  ('default_bid'::text, default_bid::text)
) as fields(field_name, field_value)
union all
select account_id, 'sb', snapshot_date, 'target',
  target_id, campaign_id, ad_group_id, target_id, null::text,
  field_name, field_value, to_jsonb(field_value), expression_raw
from public.bulk_sb_targets
cross join lateral (values
  ('target_expression'::text, expression_raw),
  ('target_expression_norm'::text, expression_norm),
  ('match_type'::text, match_type),
  ('is_negative'::text, is_negative::text),
  ('state'::text, state),
  ('bid'::text, bid::text)
) as fields(field_name, field_value)
union all
select account_id, 'sb', snapshot_date, 'placement',
  campaign_id || '::' || placement_code || '::' || placement_raw_norm, campaign_id, null::text, null::text, null::text,
  'placement_modifier_pct', percentage::text, to_jsonb(percentage::text), placement_raw
from public.bulk_sb_placements
union all
select account_id, 'sd', snapshot_date, 'campaign',
  campaign_id, campaign_id, null::text, null::text, null::text,
  field_name, field_value, to_jsonb(field_value), campaign_name_raw
from public.bulk_sd_campaigns
cross join lateral (values
  ('campaign_name'::text, campaign_name_raw),
  ('campaign_name_norm'::text, campaign_name_norm),
  ('state'::text, state),
  ('budget'::text, budget::text),
  ('portfolio_id'::text, portfolio_id),
  ('tactic'::text, tactic),
  ('cost_type'::text, cost_type),
  ('bid_optimization'::text, bid_optimization)
) as fields(field_name, field_value)
union all
select account_id, 'sd', snapshot_date, 'ad_group',
  ad_group_id, campaign_id, ad_group_id, null::text, null::text,
  field_name, field_value, to_jsonb(field_value), ad_group_name_raw
from public.bulk_sd_ad_groups
cross join lateral (values
  ('ad_group_name'::text, ad_group_name_raw),
  ('ad_group_name_norm'::text, ad_group_name_norm),
  ('state'::text, state),
  ('default_bid'::text, default_bid::text)
) as fields(field_name, field_value)
union all
select account_id, 'sd', snapshot_date, 'target',
  targeting_id, campaign_id, ad_group_id, targeting_id, null::text,
  field_name, field_value, to_jsonb(field_value), expression_raw
from public.bulk_sd_targets
cross join lateral (values
  ('target_expression'::text, expression_raw),
  ('target_expression_norm'::text, expression_norm),
  ('target_type'::text, target_type),
  ('state'::text, state),
  ('bid'::text, bid::text),
  ('bid_optimization'::text, bid_optimization),
  ('cost_type'::text, cost_type)
) as fields(field_name, field_value)
union all
select account_id, 'sd', snapshot_date, 'product_ad',
  ad_id, campaign_id, ad_group_id, null::text, ad_id,
  field_name, field_value, to_jsonb(field_value), coalesce(sku_raw, asin_raw, ad_id)
from public.bulk_sd_product_ads
cross join lateral (values
  ('product_ad_sku'::text, sku_raw),
  ('product_ad_asin'::text, asin_raw)
) as fields(field_name, field_value);

create or replace function public.v3_capture_ads_settings_snapshot(
  p_account_id text,
  p_marketplace text,
  p_channel text,
  p_snapshot_date date default null
)
returns jsonb
language plpgsql
as $$
declare
  v_channel text := lower(trim(p_channel));
  v_snapshot_date date;
  v_previous_snapshot_date date;
  v_snapshot_run_id uuid;
  v_previous_snapshot_run_id uuid;
  v_entities_seen integer := 0;
  v_changes_detected integer := 0;
  v_log_changes_written integer := 0;
begin
  if v_channel not in ('sp', 'sb', 'sd') then
    raise exception 'Unsupported ads settings channel: %', p_channel;
  end if;

  select coalesce(p_snapshot_date, max(snapshot_date))
  into v_snapshot_date
  from public.v3_ads_settings_snapshot_rows
  where account_id = p_account_id
    and channel = v_channel;

  if v_snapshot_date is null then
    raise exception 'No ads settings snapshots found for account_id=% channel=%', p_account_id, v_channel;
  end if;

  select max(snapshot_date)
  into v_previous_snapshot_date
  from public.v3_ads_settings_snapshot_rows
  where account_id = p_account_id
    and channel = v_channel
    and snapshot_date < v_snapshot_date;

  select snapshot_run_id
  into v_previous_snapshot_run_id
  from public.ads_settings_snapshot_runs
  where account_id = p_account_id
    and marketplace = p_marketplace
    and channel = v_channel
    and snapshot_date = v_previous_snapshot_date
    and status = 'succeeded'
  order by finished_at desc nulls last, created_at desc
  limit 1;

  select count(distinct entity_level || ':' || entity_key)
  into v_entities_seen
  from public.v3_ads_settings_snapshot_rows
  where account_id = p_account_id
    and channel = v_channel
    and snapshot_date = v_snapshot_date;

  insert into public.ads_settings_snapshot_runs (
    account_id,
    marketplace,
    channel,
    source_type,
    snapshot_date,
    started_at,
    status,
    data_status,
    entities_seen,
    previous_snapshot_run_id,
    summary_json
  )
  values (
    p_account_id,
    p_marketplace,
    v_channel,
    'bulk_snapshot',
    v_snapshot_date,
    now(),
    'running',
    'live',
    v_entities_seen,
    v_previous_snapshot_run_id,
    jsonb_build_object('previous_snapshot_date', v_previous_snapshot_date)
  )
  returning snapshot_run_id into v_snapshot_run_id;

  if v_previous_snapshot_date is not null then
    drop table if exists tmp_v3_inserted_log_changes;
    drop table if exists tmp_v3_ads_settings_changes;

    create temp table tmp_v3_ads_settings_changes on commit drop as
    select
      curr.account_id,
      curr.channel,
      curr.snapshot_date,
      v_previous_snapshot_date as previous_snapshot_date,
      curr.entity_level,
      curr.entity_key,
      curr.campaign_id,
      curr.ad_group_id,
      curr.target_id,
      curr.ad_id,
      curr.field_name,
      prev.field_value as before_value,
      curr.field_value as after_value,
      prev.field_value_json as before_value_json,
      curr.field_value_json as after_value_json,
      curr.entity_label
    from public.v3_ads_settings_snapshot_rows curr
    join public.v3_ads_settings_snapshot_rows prev
      on prev.account_id = curr.account_id
     and prev.channel = curr.channel
     and prev.snapshot_date = v_previous_snapshot_date
     and prev.entity_level = curr.entity_level
     and prev.entity_key = curr.entity_key
     and prev.field_name = curr.field_name
    where curr.account_id = p_account_id
      and curr.channel = v_channel
      and curr.snapshot_date = v_snapshot_date
      and prev.field_value is distinct from curr.field_value;

    select count(*) into v_changes_detected from tmp_v3_ads_settings_changes;

    create temp table tmp_v3_inserted_log_changes on commit drop as
    with inserted as (
      insert into public.log_changes (
        account_id,
        marketplace,
        occurred_at,
        channel,
        change_type,
        summary,
        why,
        before_json,
        after_json,
        source,
        dedupe_key,
        entity_level,
        field_name
      )
      select
        c.account_id,
        p_marketplace,
        c.snapshot_date::timestamptz,
        c.channel,
        'ads_setting_changed',
        upper(c.channel) || ' ' || c.entity_level || ' ' || c.field_name || ' changed',
        'Detected automatically by comparing bulk settings snapshots '
          || c.previous_snapshot_date::text || ' and ' || c.snapshot_date::text || '.',
        jsonb_build_object(
          'snapshot_date', c.previous_snapshot_date,
          'entity_level', c.entity_level,
          'entity_key', c.entity_key,
          'field_name', c.field_name,
          'value', c.before_value_json
        ),
        jsonb_build_object(
          'snapshot_date', c.snapshot_date,
          'entity_level', c.entity_level,
          'entity_key', c.entity_key,
          'field_name', c.field_name,
          'value', c.after_value_json,
          'snapshot_run_id', v_snapshot_run_id
        ),
        'automatic_ads_settings_snapshot',
        'v3_ads_settings:' || c.account_id || ':' || c.channel || ':' || c.snapshot_date::text
          || ':' || c.entity_level || ':' || c.entity_key || ':' || c.field_name,
        c.entity_level,
        c.field_name
      from tmp_v3_ads_settings_changes c
      on conflict (account_id, dedupe_key) do nothing
      returning change_id, dedupe_key
    )
    select i.change_id, c.*
    from inserted i
    join tmp_v3_ads_settings_changes c
      on i.dedupe_key = 'v3_ads_settings:' || c.account_id || ':' || c.channel || ':' || c.snapshot_date::text
        || ':' || c.entity_level || ':' || c.entity_key || ':' || c.field_name;

    get diagnostics v_log_changes_written = row_count;

    insert into public.log_change_entities (
      change_id,
      entity_type,
      campaign_id,
      ad_group_id,
      target_id,
      note,
      extra
    )
    select
      change_id,
      entity_level,
      campaign_id,
      ad_group_id,
      target_id,
      entity_label,
      jsonb_build_object(
        'channel', channel,
        'ad_id', ad_id,
        'entity_key', entity_key,
        'field_name', field_name,
        'snapshot_run_id', v_snapshot_run_id
      )
    from tmp_v3_inserted_log_changes;
  end if;

  update public.ads_settings_snapshot_runs
  set
    finished_at = now(),
    status = 'succeeded',
    changes_detected = v_changes_detected,
    log_changes_written = v_log_changes_written,
    summary_json = jsonb_build_object(
      'snapshot_date', v_snapshot_date,
      'previous_snapshot_date', v_previous_snapshot_date,
      'entities_seen', v_entities_seen,
      'changes_detected', v_changes_detected,
      'log_changes_written', v_log_changes_written,
      'source', 'bulk_snapshot'
    ),
    last_refreshed_at = now()
  where snapshot_run_id = v_snapshot_run_id;

  insert into public.report_data_status (
    account_id,
    marketplace,
    table_name,
    source_type,
    source_name,
    scope_key,
    period_start,
    period_end,
    data_status,
    is_final,
    last_sync_run_id,
    last_refreshed_at,
    row_count,
    coverage_json,
    warnings
  )
  values (
    p_account_id,
    p_marketplace,
    'ads_settings_snapshot_runs',
    'bulk_snapshot',
    'ads_settings_' || v_channel,
    v_channel,
    v_snapshot_date,
    v_snapshot_date,
    'live',
    false,
    null,
    now(),
    v_entities_seen,
    jsonb_build_object(
      'snapshot_run_id', v_snapshot_run_id,
      'snapshot_date', v_snapshot_date,
      'previous_snapshot_date', v_previous_snapshot_date,
      'changes_detected', v_changes_detected,
      'log_changes_written', v_log_changes_written
    ),
    '[]'::jsonb
  )
  on conflict (
    account_id,
    marketplace,
    table_name,
    source_type,
    source_name,
    scope_key,
    coalesce(period_start, date '0001-01-01'),
    coalesce(period_end, date '9999-12-31')
  )
  do update set
    data_status = excluded.data_status,
    is_final = excluded.is_final,
    last_refreshed_at = excluded.last_refreshed_at,
    row_count = excluded.row_count,
    coverage_json = excluded.coverage_json,
    warnings = excluded.warnings,
    updated_at = now();

  return jsonb_build_object(
    'snapshot_run_id', v_snapshot_run_id,
    'account_id', p_account_id,
    'marketplace', p_marketplace,
    'channel', v_channel,
    'snapshot_date', v_snapshot_date,
    'previous_snapshot_date', v_previous_snapshot_date,
    'entities_seen', v_entities_seen,
    'changes_detected', v_changes_detected,
    'log_changes_written', v_log_changes_written
  );
exception
  when others then
    if v_snapshot_run_id is not null then
      update public.ads_settings_snapshot_runs
      set
        finished_at = now(),
        status = 'failed',
        data_status = 'failed',
        error_message = sqlerrm,
        last_refreshed_at = now()
      where snapshot_run_id = v_snapshot_run_id;
    end if;
    raise;
end;
$$;
