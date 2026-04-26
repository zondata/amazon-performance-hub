create table if not exists public.amazon_sales_traffic_timeseries (
  id uuid primary key default gen_random_uuid(),
  account_id text not null
    references public.accounts(account_id) on delete restrict,
  marketplace text not null,
  sync_run_id uuid null
    references public.api_sync_runs(sync_run_id) on delete set null,
  ingestion_job_id uuid null
    references public.ingestion_jobs(id) on delete set null,
  source text not null,
  report_type text not null,
  report_id text null,
  report_family text not null default 'sales_and_traffic',
  granularity text not null,
  asin_granularity text not null,
  period_start date not null,
  period_end date not null,
  date date not null,
  parent_asin text null,
  child_asin text null,
  asin text null,
  sku text null,
  ordered_product_sales numeric null,
  ordered_product_sales_currency text null,
  b2b_ordered_product_sales numeric null,
  units_ordered integer null,
  total_order_items integer null,
  shipped_product_sales numeric null,
  shipped_units integer null,
  refunds integer null,
  refund_rate numeric null,
  page_views integer null,
  sessions integer null,
  buy_box_percentage numeric null,
  order_item_session_percentage numeric null,
  unit_session_percentage numeric null,
  avg_sales_price_calc numeric generated always as (
    case
      when units_ordered is null or units_ordered = 0 then null
      else ordered_product_sales / units_ordered
    end
  ) stored,
  unit_session_percentage_calc numeric generated always as (
    case
      when sessions is null or sessions = 0 then null
      else units_ordered::numeric / sessions
    end
  ) stored,
  data_status text not null,
  is_final boolean not null default false,
  final_after_at timestamptz null,
  finalized_at timestamptz null,
  last_refreshed_at timestamptz not null default now(),
  raw_json jsonb not null default '{}'::jsonb,
  source_metadata jsonb not null default '{}'::jsonb,
  canonical_record_id text not null,
  source_record_index integer not null,
  exported_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint amazon_sales_traffic_timeseries_source_chk
    check (source in ('sp-api-sales-and-traffic', 'manual_upload')),
  constraint amazon_sales_traffic_timeseries_granularity_chk
    check (granularity in ('daily', 'weekly', 'monthly')),
  constraint amazon_sales_traffic_timeseries_asin_granularity_chk
    check (asin_granularity in ('date', 'parent_asin', 'child_asin', 'sku')),
  constraint amazon_sales_traffic_timeseries_data_status_chk
    check (data_status in ('live', 'preliminary', 'final', 'failed', 'manual_unknown')),
  constraint amazon_sales_traffic_timeseries_final_consistency_chk
    check (
      (is_final = false and finalized_at is null)
      or (is_final = true and data_status = 'final')
    ),
  constraint amazon_sales_traffic_timeseries_nonnegative_metrics_chk
    check (
      coalesce(ordered_product_sales, 0) >= 0
      and coalesce(b2b_ordered_product_sales, 0) >= 0
      and coalesce(units_ordered, 0) >= 0
      and coalesce(total_order_items, 0) >= 0
      and coalesce(shipped_product_sales, 0) >= 0
      and coalesce(shipped_units, 0) >= 0
      and coalesce(refunds, 0) >= 0
      and coalesce(page_views, 0) >= 0
      and coalesce(sessions, 0) >= 0
    ),
  constraint amazon_sales_traffic_timeseries_raw_object_chk
    check (jsonb_typeof(raw_json) = 'object'),
  constraint amazon_sales_traffic_timeseries_metadata_object_chk
    check (jsonb_typeof(source_metadata) = 'object')
);

create unique index if not exists amazon_sales_traffic_timeseries_natural_uidx
  on public.amazon_sales_traffic_timeseries (
    account_id,
    marketplace,
    source,
    report_type,
    granularity,
    asin_granularity,
    period_start,
    period_end,
    date,
    coalesce(asin, ''),
    coalesce(sku, '')
  );

create index if not exists amazon_sales_traffic_timeseries_scope_date_idx
  on public.amazon_sales_traffic_timeseries (account_id, marketplace, date desc);

create index if not exists amazon_sales_traffic_timeseries_asin_date_idx
  on public.amazon_sales_traffic_timeseries (account_id, marketplace, asin, date desc);

create index if not exists amazon_sales_traffic_timeseries_status_idx
  on public.amazon_sales_traffic_timeseries (data_status, is_final, last_refreshed_at desc);

create index if not exists amazon_sales_traffic_timeseries_sync_run_idx
  on public.amazon_sales_traffic_timeseries (sync_run_id);

drop trigger if exists amazon_sales_traffic_timeseries_set_updated_at_tg
  on public.amazon_sales_traffic_timeseries;
create trigger amazon_sales_traffic_timeseries_set_updated_at_tg
  before update on public.amazon_sales_traffic_timeseries
  for each row
  execute function public.v3_control_set_updated_at();

insert into public.amazon_sales_traffic_timeseries (
  account_id,
  marketplace,
  ingestion_job_id,
  source,
  report_type,
  report_id,
  report_family,
  granularity,
  asin_granularity,
  period_start,
  period_end,
  date,
  ordered_product_sales,
  ordered_product_sales_currency,
  units_ordered,
  total_order_items,
  sessions,
  page_views,
  buy_box_percentage,
  unit_session_percentage,
  data_status,
  is_final,
  final_after_at,
  finalized_at,
  last_refreshed_at,
  raw_json,
  source_metadata,
  canonical_record_id,
  source_record_index,
  exported_at,
  ingested_at
)
select
  r.account_id,
  r.marketplace,
  r.ingestion_job_id,
  'sp-api-sales-and-traffic',
  r.report_type,
  r.report_id,
  r.report_family,
  'daily',
  'date',
  r.report_window_start,
  r.report_window_end,
  r.date,
  r.ordered_product_sales_amount,
  r.ordered_product_sales_currency,
  r.units_ordered,
  r.total_order_items,
  r.sessions,
  r.page_views,
  r.buy_box_percentage,
  r.unit_session_percentage,
  case
    when r.date <= current_date - 30 then 'final'
    else 'preliminary'
  end,
  r.date <= current_date - 30,
  (r.date::timestamptz + interval '30 days'),
  case when r.date <= current_date - 30 then r.exported_at else null end,
  r.ingested_at,
  r.row_values,
  r.source_metadata,
  r.canonical_record_id,
  r.source_record_index,
  r.exported_at,
  r.ingested_at
from (
  select distinct on (
    account_id,
    marketplace,
    report_type,
    report_window_start,
    report_window_end,
    date
  )
    *
  from public.spapi_sales_and_traffic_by_date_report_rows
  order by
    account_id,
    marketplace,
    report_type,
    report_window_start,
    report_window_end,
    date,
    exported_at desc,
    ingested_at desc,
    report_id desc
) r
on conflict (
  account_id,
  marketplace,
  source,
  report_type,
  granularity,
  asin_granularity,
  period_start,
  period_end,
  date,
  coalesce(asin, ''),
  coalesce(sku, '')
)
do update set
  ingestion_job_id = excluded.ingestion_job_id,
  report_id = excluded.report_id,
  report_family = excluded.report_family,
  ordered_product_sales = excluded.ordered_product_sales,
  ordered_product_sales_currency = excluded.ordered_product_sales_currency,
  units_ordered = excluded.units_ordered,
  total_order_items = excluded.total_order_items,
  sessions = excluded.sessions,
  page_views = excluded.page_views,
  buy_box_percentage = excluded.buy_box_percentage,
  unit_session_percentage = excluded.unit_session_percentage,
  data_status = excluded.data_status,
  is_final = excluded.is_final,
  final_after_at = excluded.final_after_at,
  finalized_at = excluded.finalized_at,
  last_refreshed_at = excluded.last_refreshed_at,
  raw_json = excluded.raw_json,
  source_metadata = excluded.source_metadata,
  canonical_record_id = excluded.canonical_record_id,
  source_record_index = excluded.source_record_index,
  exported_at = excluded.exported_at,
  ingested_at = excluded.ingested_at;

insert into public.amazon_sales_traffic_timeseries (
  account_id,
  marketplace,
  ingestion_job_id,
  source,
  report_type,
  report_id,
  report_family,
  granularity,
  asin_granularity,
  period_start,
  period_end,
  date,
  parent_asin,
  child_asin,
  asin,
  sku,
  ordered_product_sales,
  ordered_product_sales_currency,
  units_ordered,
  total_order_items,
  sessions,
  page_views,
  buy_box_percentage,
  unit_session_percentage,
  data_status,
  is_final,
  final_after_at,
  finalized_at,
  last_refreshed_at,
  raw_json,
  source_metadata,
  canonical_record_id,
  source_record_index,
  exported_at,
  ingested_at
)
select
  r.account_id,
  r.marketplace,
  r.ingestion_job_id,
  'sp-api-sales-and-traffic',
  r.report_type,
  r.report_id,
  r.report_family,
  'daily',
  case
    when r.sku is not null then 'sku'
    when r.child_asin is not null then 'child_asin'
    when r.parent_asin is not null then 'parent_asin'
    else 'child_asin'
  end,
  r.report_window_start,
  r.report_window_end,
  coalesce(r.date, r.report_window_end),
  r.parent_asin,
  r.child_asin,
  coalesce(r.asin, r.child_asin, r.parent_asin),
  r.sku,
  r.ordered_product_sales_amount,
  r.ordered_product_sales_currency,
  r.units_ordered,
  r.total_order_items,
  r.sessions,
  r.page_views,
  r.buy_box_percentage,
  r.unit_session_percentage,
  case
    when coalesce(r.date, r.report_window_end) <= current_date - 30 then 'final'
    else 'preliminary'
  end,
  coalesce(r.date, r.report_window_end) <= current_date - 30,
  (coalesce(r.date, r.report_window_end)::timestamptz + interval '30 days'),
  case
    when coalesce(r.date, r.report_window_end) <= current_date - 30 then r.exported_at
    else null
  end,
  r.ingested_at,
  r.row_values,
  r.source_metadata,
  r.canonical_record_id,
  r.source_record_index,
  r.exported_at,
  r.ingested_at
from (
  select distinct on (
    account_id,
    marketplace,
    report_type,
    report_window_start,
    report_window_end,
    coalesce(date, report_window_end),
    case
      when sku is not null then 'sku'
      when child_asin is not null then 'child_asin'
      when parent_asin is not null then 'parent_asin'
      else 'child_asin'
    end,
    coalesce(asin, child_asin, parent_asin, ''),
    coalesce(sku, '')
  )
    *
  from public.spapi_sales_and_traffic_by_asin_report_rows
  order by
    account_id,
    marketplace,
    report_type,
    report_window_start,
    report_window_end,
    coalesce(date, report_window_end),
    case
      when sku is not null then 'sku'
      when child_asin is not null then 'child_asin'
      when parent_asin is not null then 'parent_asin'
      else 'child_asin'
    end,
    coalesce(asin, child_asin, parent_asin, ''),
    coalesce(sku, ''),
    exported_at desc,
    ingested_at desc,
    report_id desc
) r
on conflict (
  account_id,
  marketplace,
  source,
  report_type,
  granularity,
  asin_granularity,
  period_start,
  period_end,
  date,
  coalesce(asin, ''),
  coalesce(sku, '')
)
do update set
  ingestion_job_id = excluded.ingestion_job_id,
  report_id = excluded.report_id,
  report_family = excluded.report_family,
  parent_asin = excluded.parent_asin,
  child_asin = excluded.child_asin,
  ordered_product_sales = excluded.ordered_product_sales,
  ordered_product_sales_currency = excluded.ordered_product_sales_currency,
  units_ordered = excluded.units_ordered,
  total_order_items = excluded.total_order_items,
  sessions = excluded.sessions,
  page_views = excluded.page_views,
  buy_box_percentage = excluded.buy_box_percentage,
  unit_session_percentage = excluded.unit_session_percentage,
  data_status = excluded.data_status,
  is_final = excluded.is_final,
  final_after_at = excluded.final_after_at,
  finalized_at = excluded.finalized_at,
  last_refreshed_at = excluded.last_refreshed_at,
  raw_json = excluded.raw_json,
  source_metadata = excluded.source_metadata,
  canonical_record_id = excluded.canonical_record_id,
  source_record_index = excluded.source_record_index,
  exported_at = excluded.exported_at,
  ingested_at = excluded.ingested_at;

create or replace view public.amazon_sales_traffic_timeseries_latest as
select *
from (
  select
    t.*,
    row_number() over (
      partition by
        t.account_id,
        t.marketplace,
        t.source,
        t.report_type,
        t.granularity,
        t.asin_granularity,
        t.period_start,
        t.period_end,
        t.date,
        coalesce(t.asin, ''),
        coalesce(t.sku, '')
      order by t.exported_at desc, t.ingested_at desc, t.report_id desc
    ) as rn
  from public.amazon_sales_traffic_timeseries t
) latest
where rn = 1;
