-- Phase 8: analysis-ready, read-only MCP views.
-- These views intentionally avoid secret-bearing control fields and cleanup-candidate raw tables.

create or replace view public.v_mcp_sales_traffic_daily as
select
  account_id,
  marketplace,
  date,
  granularity,
  asin_granularity,
  parent_asin,
  child_asin,
  asin,
  sku,
  ordered_product_sales,
  ordered_product_sales_currency,
  units_ordered,
  total_order_items,
  shipped_product_sales,
  shipped_units,
  refunds,
  refund_rate,
  page_views,
  sessions,
  buy_box_percentage,
  order_item_session_percentage,
  unit_session_percentage,
  avg_sales_price_calc,
  unit_session_percentage_calc,
  data_status,
  is_final,
  last_refreshed_at,
  exported_at
from public.amazon_sales_traffic_timeseries_latest;

create or replace view public.v_mcp_ads_current_settings as
with sp_campaign_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_campaigns
  group by account_id
),
sp_ad_group_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_ad_groups
  group by account_id
),
sp_target_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_targets
  group by account_id
),
sp_placement_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_placements
  group by account_id
),
sp_product_ad_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_product_ads
  group by account_id
),
sp_portfolio_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_portfolios
  group by account_id
),
sb_campaign_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sb_campaigns
  group by account_id
),
sb_ad_group_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sb_ad_groups
  group by account_id
),
sb_target_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sb_targets
  group by account_id
),
sb_placement_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sb_placements
  group by account_id
),
sd_campaign_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sd_campaigns
  group by account_id
),
sd_ad_group_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sd_ad_groups
  group by account_id
),
sd_target_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sd_targets
  group by account_id
),
sd_product_ad_snapshot as (
  select account_id, max(snapshot_date) as snapshot_date
  from public.bulk_sd_product_ads
  group by account_id
)
select
  'sp'::text as channel,
  'campaign'::text as entity_level,
  c.account_id,
  null::text as marketplace,
  c.snapshot_date,
  c.campaign_id,
  null::text as ad_group_id,
  null::text as target_id,
  null::text as ad_id,
  c.portfolio_id,
  c.campaign_name_raw as name_raw,
  c.campaign_name_norm as name_norm,
  c.state,
  c.daily_budget as budget,
  null::numeric as bid,
  c.bidding_strategy,
  null::text as placement_code,
  null::numeric as placement_percentage,
  null::text as match_type,
  null::boolean as is_negative,
  null::text as asin,
  null::text as sku
from public.bulk_campaigns c
join sp_campaign_snapshot s using (account_id, snapshot_date)
union all
select
  'sp', 'ad_group', g.account_id, null::text, g.snapshot_date, g.campaign_id,
  g.ad_group_id, null::text, null::text, null::text,
  g.ad_group_name_raw, g.ad_group_name_norm, g.state, null::numeric,
  g.default_bid, null::text, null::text, null::numeric, null::text,
  null::boolean, null::text, null::text
from public.bulk_ad_groups g
join sp_ad_group_snapshot s using (account_id, snapshot_date)
union all
select
  'sp', 'target', t.account_id, null::text, t.snapshot_date, t.campaign_id,
  t.ad_group_id, t.target_id, null::text, null::text,
  t.expression_raw, t.expression_norm, t.state, null::numeric, t.bid,
  null::text, null::text, null::numeric, t.match_type, t.is_negative,
  null::text, null::text
from public.bulk_targets t
join sp_target_snapshot s using (account_id, snapshot_date)
union all
select
  'sp', 'placement', p.account_id, null::text, p.snapshot_date, p.campaign_id,
  null::text, null::text, null::text, null::text,
  p.placement_raw, null::text, null::text, null::numeric, null::numeric,
  null::text, p.placement_code, p.percentage, null::text, null::boolean,
  null::text, null::text
from public.bulk_placements p
join sp_placement_snapshot s using (account_id, snapshot_date)
union all
select
  'sp', 'product_ad', a.account_id, null::text, a.snapshot_date, a.campaign_id,
  a.ad_group_id, null::text, a.ad_id, null::text,
  null::text, null::text, null::text, null::numeric, null::numeric,
  null::text, null::text, null::numeric, null::text, null::boolean,
  a.asin_raw, a.sku_raw
from public.bulk_product_ads a
join sp_product_ad_snapshot s using (account_id, snapshot_date)
union all
select
  'sp', 'portfolio', p.account_id, null::text, p.snapshot_date, null::text,
  null::text, null::text, null::text, p.portfolio_id,
  p.portfolio_name_raw, p.portfolio_name_norm, null::text, null::numeric,
  null::numeric, null::text, null::text, null::numeric, null::text,
  null::boolean, null::text, null::text
from public.bulk_portfolios p
join sp_portfolio_snapshot s using (account_id, snapshot_date)
union all
select
  'sb', 'campaign', c.account_id, null::text, c.snapshot_date, c.campaign_id,
  null::text, null::text, null::text, c.portfolio_id,
  c.campaign_name_raw, c.campaign_name_norm, c.state, c.daily_budget,
  null::numeric, c.bidding_strategy, null::text, null::numeric, null::text,
  null::boolean, null::text, null::text
from public.bulk_sb_campaigns c
join sb_campaign_snapshot s using (account_id, snapshot_date)
union all
select
  'sb', 'ad_group', g.account_id, null::text, g.snapshot_date, g.campaign_id,
  g.ad_group_id, null::text, null::text, null::text,
  g.ad_group_name_raw, g.ad_group_name_norm, g.state, null::numeric,
  g.default_bid, null::text, null::text, null::numeric, null::text,
  null::boolean, null::text, null::text
from public.bulk_sb_ad_groups g
join sb_ad_group_snapshot s using (account_id, snapshot_date)
union all
select
  'sb', 'target', t.account_id, null::text, t.snapshot_date, t.campaign_id,
  t.ad_group_id, t.target_id, null::text, null::text,
  t.expression_raw, t.expression_norm, t.state, null::numeric, t.bid,
  null::text, null::text, null::numeric, t.match_type, t.is_negative,
  null::text, null::text
from public.bulk_sb_targets t
join sb_target_snapshot s using (account_id, snapshot_date)
union all
select
  'sb', 'placement', p.account_id, null::text, p.snapshot_date, p.campaign_id,
  null::text, null::text, null::text, null::text,
  p.placement_raw, p.placement_raw_norm, null::text, null::numeric,
  null::numeric, null::text, p.placement_code, p.percentage, null::text,
  null::boolean, null::text, null::text
from public.bulk_sb_placements p
join sb_placement_snapshot s using (account_id, snapshot_date)
union all
select
  'sd', 'campaign', c.account_id, null::text, c.snapshot_date, c.campaign_id,
  null::text, null::text, null::text, c.portfolio_id,
  c.campaign_name_raw, c.campaign_name_norm, c.state, c.budget,
  null::numeric, c.bid_optimization, null::text, null::numeric, null::text,
  null::boolean, null::text, null::text
from public.bulk_sd_campaigns c
join sd_campaign_snapshot s using (account_id, snapshot_date)
union all
select
  'sd', 'ad_group', g.account_id, null::text, g.snapshot_date, g.campaign_id,
  g.ad_group_id, null::text, null::text, null::text,
  g.ad_group_name_raw, g.ad_group_name_norm, g.state, null::numeric,
  g.default_bid, null::text, null::text, null::numeric, null::text,
  null::boolean, null::text, null::text
from public.bulk_sd_ad_groups g
join sd_ad_group_snapshot s using (account_id, snapshot_date)
union all
select
  'sd', 'target', t.account_id, null::text, t.snapshot_date, t.campaign_id,
  t.ad_group_id, t.targeting_id, null::text, null::text,
  t.expression_raw, t.expression_norm, t.state, null::numeric, t.bid,
  t.bid_optimization, null::text, null::numeric, t.target_type,
  null::boolean, null::text, null::text
from public.bulk_sd_targets t
join sd_target_snapshot s using (account_id, snapshot_date)
union all
select
  'sd', 'product_ad', a.account_id, null::text, a.snapshot_date, a.campaign_id,
  a.ad_group_id, null::text, a.ad_id, null::text,
  null::text, null::text, null::text, null::numeric, null::numeric,
  null::text, null::text, null::numeric, null::text, null::boolean,
  a.asin_raw, a.sku_raw
from public.bulk_sd_product_ads a
join sd_product_ad_snapshot s using (account_id, snapshot_date);

create or replace view public.v_mcp_ads_performance_daily as
select
  'sp'::text as channel,
  'campaign'::text as performance_level,
  account_id,
  null::text as marketplace,
  date,
  campaign_id,
  null::text as ad_group_id,
  null::text as target_id,
  null::text as target_key,
  null::text as placement_code,
  campaign_name_raw as entity_name,
  campaign_name_norm as entity_name_norm,
  null::text as targeting_raw,
  null::text as targeting_norm,
  null::text as match_type_norm,
  null::text as cost_type,
  impressions::numeric,
  clicks::numeric,
  spend,
  sales,
  orders::numeric,
  units::numeric,
  case when clicks > 0 then spend / clicks else null end as cpc,
  case when impressions > 0 then clicks::numeric / impressions else null end as ctr,
  case when sales > 0 then spend / sales else null end as acos,
  case when spend > 0 then sales / spend else null end as roas,
  case when clicks > 0 then orders::numeric / clicks else null end as conversion_rate,
  null::numeric as top_of_search_impression_share,
  exported_at
from public.sp_campaign_daily_fact_latest_gold
union all
select
  'sb', 'campaign', account_id, null::text, date, campaign_id, null::text,
  null::text, null::text, null::text, campaign_name_raw, campaign_name_norm,
  null::text, null::text, null::text, null::text, impressions::numeric,
  clicks::numeric, spend, sales, orders::numeric, units::numeric,
  case when clicks > 0 then spend / clicks else null end,
  case when impressions > 0 then clicks::numeric / impressions else null end,
  case when sales > 0 then spend / sales else null end,
  case when spend > 0 then sales / spend else null end,
  case when clicks > 0 then orders::numeric / clicks else null end,
  null::numeric, exported_at
from public.sb_campaign_daily_fact_latest_gold
union all
select
  'sd', 'campaign', account_id, null::text, date, campaign_id, null::text,
  null::text, null::text, null::text, campaign_name_raw, campaign_name_norm,
  null::text, null::text, null::text, cost_type, impressions::numeric,
  clicks::numeric, spend, sales, orders::numeric, units::numeric, cpc, ctr,
  acos, roas, conversion_rate, null::numeric, exported_at
from public.sd_campaign_daily_fact_latest_gold
union all
select
  'sp', 'placement', account_id, null::text, date, campaign_id, null::text,
  null::text, null::text, placement_code, campaign_name_raw, campaign_name_norm,
  null::text, null::text, null::text, null::text, impressions::numeric,
  clicks::numeric, spend, sales, orders::numeric, units::numeric, cpc, ctr,
  acos, roas, null::numeric, null::numeric, exported_at
from public.sp_placement_daily_fact_latest
union all
select
  'sb', 'placement', account_id, null::text, date, campaign_id, null::text,
  null::text, null::text, placement_code, campaign_name_raw, campaign_name_norm,
  null::text, null::text, null::text, null::text, impressions::numeric,
  clicks::numeric, spend, sales, orders::numeric, units::numeric, cpc, ctr,
  acos, roas, null::numeric, null::numeric, exported_at
from public.sb_campaign_placement_daily_fact_latest
union all
select
  'sp', 'target', account_id, null::text, date, campaign_id, ad_group_id,
  target_id, target_id, null::text, ad_group_name_raw, ad_group_name_norm,
  targeting_raw, targeting_norm, match_type_norm, null::text,
  impressions::numeric, clicks::numeric, spend, sales, orders::numeric,
  units::numeric, cpc, ctr, acos, roas, conversion_rate,
  top_of_search_impression_share, exported_at
from public.sp_targeting_daily_fact_latest
union all
select
  'sb', 'keyword', account_id, null::text, date, campaign_id, ad_group_id,
  target_id, target_id, null::text, ad_group_name_raw, ad_group_name_norm,
  targeting_raw, targeting_norm, match_type_norm, null::text,
  impressions::numeric, clicks::numeric, spend, sales, orders::numeric,
  units::numeric, cpc, ctr, acos, roas, conversion_rate, null::numeric,
  exported_at
from public.sb_keyword_daily_fact_latest
union all
select
  'sb', 'search_term_impression_share', account_id, null::text, date,
  campaign_id, ad_group_id, target_id, target_key, null::text,
  customer_search_term_raw, customer_search_term_norm, targeting_raw,
  targeting_norm, match_type_norm, null::text, impressions::numeric,
  clicks::numeric, spend, sales, orders::numeric, units::numeric, cpc, ctr,
  acos, roas, conversion_rate, search_term_impression_share, exported_at
from public.sb_stis_daily_fact_latest
union all
select
  'sd', 'advertised_product', account_id, null::text, date, campaign_id,
  ad_group_id, ad_id, ad_key, null::text, advertised_asin_raw,
  advertised_asin_norm, null::text, null::text, null::text, cost_type,
  impressions::numeric, clicks::numeric, spend, sales, orders::numeric,
  units::numeric, cpc, ctr, acos, roas, conversion_rate, null::numeric,
  exported_at
from public.sd_advertised_product_daily_fact_latest
union all
select
  'sd', 'target', account_id, null::text, date, campaign_id, ad_group_id,
  target_id, target_key, null::text, ad_group_name_raw, ad_group_name_norm,
  targeting_raw, targeting_norm, match_type_norm, cost_type,
  impressions::numeric, clicks::numeric, spend, sales, orders::numeric,
  units::numeric, cpc, ctr, acos, roas, conversion_rate, null::numeric,
  exported_at
from public.sd_targeting_daily_fact_latest
union all
select
  'sd', 'matched_target', account_id, null::text, date, campaign_id,
  ad_group_id, target_id, target_key, null::text, matched_target_raw,
  matched_target_norm, targeting_raw, targeting_norm, null::text, cost_type,
  impressions::numeric, clicks::numeric, spend, sales, orders::numeric,
  units::numeric, cpc, ctr, acos, roas, conversion_rate, null::numeric,
  exported_at
from public.sd_matched_target_daily_fact_latest
union all
select
  'sd', 'purchased_product', account_id, null::text, date, campaign_id,
  ad_group_id, ad_id, ad_key, null::text, purchased_asin_raw,
  purchased_asin_norm, null::text, null::text, null::text, cost_type,
  impressions::numeric, clicks::numeric, spend, sales, orders::numeric,
  units::numeric, cpc, ctr, acos, roas, conversion_rate, null::numeric,
  exported_at
from public.sd_purchased_product_daily_fact_latest;

create or replace view public.v_mcp_ads_performance_hourly as
select
  'sp'::text as channel,
  'campaign'::text as performance_level,
  account_id,
  null::text as marketplace,
  date,
  start_time,
  campaign_id,
  campaign_name_raw,
  campaign_name_norm,
  impressions::numeric,
  clicks::numeric,
  spend,
  sales,
  orders::numeric,
  units::numeric,
  case when clicks > 0 then spend / clicks else null end as cpc,
  case when impressions > 0 then clicks::numeric / impressions else null end as ctr,
  case when sales > 0 then spend / sales else null end as acos,
  case when spend > 0 then sales / spend else null end as roas,
  case when clicks > 0 then orders::numeric / clicks else null end as conversion_rate,
  exported_at,
  ingested_at
from public.sp_campaign_hourly_fact_latest_gold;

create or replace view public.v_mcp_sqp_weekly as
select
  account_id,
  marketplace,
  scope_type,
  scope_value,
  week_start,
  week_end,
  reporting_date,
  search_query_raw,
  search_query_norm,
  search_query_score,
  search_query_volume,
  impressions_total,
  impressions_self,
  impressions_self_share,
  clicks_total,
  clicks_rate_per_query,
  clicks_self,
  clicks_self_share,
  cart_adds_total,
  cart_add_rate_per_query,
  cart_adds_self,
  cart_adds_self_share,
  purchases_total,
  purchases_rate_per_query,
  purchases_self,
  purchases_self_share,
  exported_at
from public.sqp_weekly_latest;

create or replace view public.v_mcp_sqp_monthly as
select
  account_id,
  marketplace,
  scope_type,
  scope_value,
  period_start,
  period_end,
  reporting_date,
  search_query_raw,
  search_query_norm,
  search_query_score,
  search_query_volume,
  impressions_total,
  impressions_self,
  impressions_self_share,
  clicks_total,
  clicks_rate_per_query,
  clicks_self,
  clicks_self_share,
  cart_adds_total,
  cart_add_rate_per_query,
  cart_adds_self,
  cart_adds_self_share,
  purchases_total,
  purchases_rate_per_query,
  purchases_self,
  purchases_self_share,
  exported_at
from public.sqp_monthly_latest;

create or replace view public.v_mcp_h10_keyword_rankings as
select
  account_id,
  marketplace,
  asin,
  title,
  keyword_raw,
  keyword_norm,
  keyword_sales,
  search_volume,
  organic_rank_raw,
  organic_rank_value,
  organic_rank_kind,
  sponsored_pos_raw,
  sponsored_pos_value,
  sponsored_pos_kind,
  observed_at,
  observed_date,
  exported_at,
  ingested_at
from public.h10_keyword_rank_daily_latest;

create or replace view public.v_mcp_ads_change_logbook as
select
  c.change_id,
  c.account_id,
  c.marketplace,
  c.occurred_at,
  c.channel,
  c.entity_level,
  c.change_type,
  c.field_name,
  c.summary,
  c.why,
  c.expected_outcome,
  c.evaluation_window_days,
  c.notes,
  c.source,
  c.dedupe_key,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'entity_type', e.entity_type,
        'product_id', e.product_id,
        'asin', e.asin,
        'sku', e.sku,
        'campaign_id', e.campaign_id,
        'ad_group_id', e.ad_group_id,
        'target_id', e.target_id,
        'note', e.note
      )
      order by e.created_at
    ) filter (where e.change_entity_id is not null),
    '[]'::jsonb
  ) as linked_entities,
  c.created_at
from public.log_changes c
left join public.log_change_entities e using (change_id)
where c.channel in ('sp', 'sb', 'sd', 'sponsored_products', 'sponsored_brands', 'sponsored_display', 'ads')
group by c.change_id;

create or replace view public.v_mcp_non_ads_change_logbook as
select
  c.change_id,
  c.account_id,
  c.marketplace,
  c.occurred_at,
  c.channel,
  c.entity_level,
  c.change_type,
  c.field_name,
  c.summary,
  c.why,
  c.expected_outcome,
  c.evaluation_window_days,
  c.notes,
  c.source,
  c.dedupe_key,
  coalesce(
    jsonb_agg(
      distinct jsonb_build_object(
        'entity_type', e.entity_type,
        'product_id', e.product_id,
        'asin', e.asin,
        'sku', e.sku,
        'campaign_id', e.campaign_id,
        'ad_group_id', e.ad_group_id,
        'target_id', e.target_id,
        'note', e.note
      )
    ) filter (where e.change_entity_id is not null),
    '[]'::jsonb
  ) as linked_entities,
  count(distinct o.evaluation_id)::integer as evaluation_count,
  max(o.evaluated_at) as latest_evaluated_at,
  coalesce(
    jsonb_agg(
      distinct jsonb_build_object(
        'evaluation_id', o.evaluation_id,
        'evaluated_at', o.evaluated_at,
        'window_start', o.window_start,
        'window_end', o.window_end,
        'actual_result', o.actual_result,
        'learning', o.learning,
        'notes', o.notes,
        'metrics_json', o.metrics_json
      )
    ) filter (where o.evaluation_id is not null),
    '[]'::jsonb
  ) as evaluations,
  c.created_at
from public.log_changes c
left join public.log_change_entities e using (change_id)
left join public.change_outcome_evaluations o using (change_id)
where c.channel not in ('sp', 'sb', 'sd', 'sponsored_products', 'sponsored_brands', 'sponsored_display', 'ads')
   or e.asin is not null
   or e.sku is not null
   or e.product_id is not null
group by c.change_id;

create or replace view public.v_mcp_data_freshness as
select
  s.account_id,
  s.marketplace,
  s.table_name,
  s.source_type,
  s.source_name,
  s.scope_key,
  s.period_start,
  s.period_end,
  s.data_status,
  s.is_final,
  s.final_after_at,
  s.finalized_at,
  s.last_refreshed_at,
  s.row_count,
  s.coverage_json,
  s.warnings,
  r.status as latest_sync_status,
  r.finished_at as latest_sync_finished_at,
  r.rows_read as latest_rows_read,
  r.rows_written as latest_rows_written,
  r.rows_failed as latest_rows_failed,
  r.error_code as latest_error_code,
  r.error_message as latest_error_message
from public.report_data_status s
left join public.api_sync_runs r
  on r.sync_run_id = s.last_sync_run_id;

grant select on
  public.v_mcp_sales_traffic_daily,
  public.v_mcp_ads_current_settings,
  public.v_mcp_ads_performance_daily,
  public.v_mcp_ads_performance_hourly,
  public.v_mcp_sqp_weekly,
  public.v_mcp_sqp_monthly,
  public.v_mcp_h10_keyword_rankings,
  public.v_mcp_ads_change_logbook,
  public.v_mcp_non_ads_change_logbook,
  public.v_mcp_data_freshness
to authenticated, service_role;
