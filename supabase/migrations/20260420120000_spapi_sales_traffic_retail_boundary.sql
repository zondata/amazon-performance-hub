create table if not exists public.spapi_sales_and_traffic_by_date_report_rows (
  id uuid primary key default gen_random_uuid(),
  ingestion_job_id uuid not null
    references public.ingestion_jobs(id) on delete restrict,
  account_id text not null references public.accounts(account_id),
  marketplace text not null,
  report_id text not null,
  report_family text not null,
  report_type text not null,
  section_name text not null,
  canonical_record_id text not null,
  source_record_index integer not null,
  report_window_start date not null,
  report_window_end date not null,
  date date not null,
  ordered_product_sales_amount numeric null,
  ordered_product_sales_currency text null,
  units_ordered integer null,
  total_order_items integer null,
  sessions integer null,
  page_views integer null,
  buy_box_percentage numeric null,
  unit_session_percentage numeric null,
  row_values jsonb not null,
  source_metadata jsonb not null,
  exported_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  constraint spapi_sales_and_traffic_by_date_rows_uq unique (
    account_id,
    marketplace,
    report_id,
    canonical_record_id
  )
);

create index if not exists spapi_sales_and_traffic_by_date_scope_idx
  on public.spapi_sales_and_traffic_by_date_report_rows (
    account_id,
    marketplace,
    date
  );

create index if not exists spapi_sales_and_traffic_by_date_job_idx
  on public.spapi_sales_and_traffic_by_date_report_rows (ingestion_job_id);

create table if not exists public.spapi_sales_and_traffic_by_asin_report_rows (
  id uuid primary key default gen_random_uuid(),
  ingestion_job_id uuid not null
    references public.ingestion_jobs(id) on delete restrict,
  account_id text not null references public.accounts(account_id),
  marketplace text not null,
  report_id text not null,
  report_family text not null,
  report_type text not null,
  section_name text not null,
  canonical_record_id text not null,
  source_record_index integer not null,
  report_window_start date not null,
  report_window_end date not null,
  date date null,
  asin text null,
  parent_asin text null,
  child_asin text null,
  sku text null,
  ordered_product_sales_amount numeric null,
  ordered_product_sales_currency text null,
  units_ordered integer null,
  total_order_items integer null,
  sessions integer null,
  page_views integer null,
  buy_box_percentage numeric null,
  unit_session_percentage numeric null,
  row_values jsonb not null,
  source_metadata jsonb not null,
  exported_at timestamptz not null,
  ingested_at timestamptz not null default now(),
  constraint spapi_sales_and_traffic_by_asin_rows_uq unique (
    account_id,
    marketplace,
    report_id,
    canonical_record_id
  )
);

create index if not exists spapi_sales_and_traffic_by_asin_scope_idx
  on public.spapi_sales_and_traffic_by_asin_report_rows (
    account_id,
    marketplace,
    asin,
    report_window_end
  );

create index if not exists spapi_sales_and_traffic_by_asin_job_idx
  on public.spapi_sales_and_traffic_by_asin_report_rows (ingestion_job_id);

create or replace view public.spapi_sales_and_traffic_by_date_latest as
select *
from (
  select
    r.*,
    row_number() over (
      partition by r.account_id, r.marketplace, r.date
      order by r.exported_at desc, r.ingested_at desc, r.report_id desc
    ) as rn
  from public.spapi_sales_and_traffic_by_date_report_rows r
) latest
where rn = 1;

create or replace view public.spapi_sales_and_traffic_by_asin_latest as
select *
from (
  select
    r.*,
    row_number() over (
      partition by
        r.account_id,
        r.marketplace,
        coalesce(r.asin, ''),
        r.report_window_start,
        r.report_window_end
      order by r.exported_at desc, r.ingested_at desc, r.report_id desc
    ) as rn
  from public.spapi_sales_and_traffic_by_asin_report_rows r
) latest
where rn = 1;
