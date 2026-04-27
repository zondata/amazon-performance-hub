create or replace view public.amazon_sales_traffic_timeseries_latest as
select *
from (
  select
    t.*,
    row_number() over (
      partition by
        t.account_id,
        t.marketplace,
        t.granularity,
        t.asin_granularity,
        t.date,
        coalesce(t.parent_asin, ''),
        coalesce(t.child_asin, ''),
        coalesce(t.asin, ''),
        coalesce(t.sku, '')
      order by
        t.exported_at desc,
        t.ingested_at desc,
        t.is_final desc,
        t.report_id desc,
        t.canonical_record_id desc
    ) as rn
  from public.amazon_sales_traffic_timeseries t
) latest
where rn = 1;
