create or replace view public.spapi_retail_sales_traffic_by_date_truth as
select
  id,
  ingestion_job_id,
  account_id,
  marketplace,
  report_id,
  report_family,
  report_type,
  section_name,
  canonical_record_id,
  source_record_index,
  report_window_start,
  report_window_end,
  date,
  ordered_product_sales_amount,
  ordered_product_sales_currency,
  units_ordered,
  total_order_items,
  sessions,
  page_views,
  buy_box_percentage,
  unit_session_percentage,
  row_values,
  source_metadata,
  exported_at,
  ingested_at,
  'sp-api-sales-and-traffic'::text as retail_truth_source,
  false as legacy_sales_trend_fallback
from (
  select
    r.*,
    row_number() over (
      partition by r.account_id, r.marketplace, r.date
      order by
        r.exported_at desc,
        r.ingested_at desc,
        r.report_id desc,
        r.canonical_record_id desc
    ) as latest_rank
  from public.spapi_sales_and_traffic_by_date_report_rows r
) ranked
where latest_rank = 1;

create or replace view public.spapi_retail_sales_traffic_by_asin_truth as
select
  id,
  ingestion_job_id,
  account_id,
  marketplace,
  report_id,
  report_family,
  report_type,
  section_name,
  canonical_record_id,
  source_record_index,
  report_window_start,
  report_window_end,
  date,
  asin,
  parent_asin,
  child_asin,
  sku,
  ordered_product_sales_amount,
  ordered_product_sales_currency,
  units_ordered,
  total_order_items,
  sessions,
  page_views,
  buy_box_percentage,
  unit_session_percentage,
  row_values,
  source_metadata,
  exported_at,
  ingested_at,
  'sp-api-sales-and-traffic'::text as retail_truth_source,
  false as legacy_sales_trend_fallback
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
      order by
        r.exported_at desc,
        r.ingested_at desc,
        r.report_id desc,
        r.canonical_record_id desc
    ) as latest_rank
  from public.spapi_sales_and_traffic_by_asin_report_rows r
) ranked
where latest_rank = 1;
