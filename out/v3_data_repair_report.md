# V3 Data Repair Report

Generated: 2026-04-27

## Scope

Focused V3 data repair for `sourbear` / `US` on branch `v3/database-only`, following the latest coverage audit and the database-only rules:

- no table drops
- no unrelated migrations
- no schema changes except one proven view bug fix
- no negative-metric clamping
- no commit

## What Changed

### 1. SP campaign gold and SP daily fact repair

- Extended `sp_campaign_hourly_fact_gold` from `2026-04-16 00:00` to `2026-04-21 23:00`.
- Extended `sp_placement_daily_fact`, `sp_targeting_daily_fact`, and `sp_stis_daily_fact` from their prior April cutoffs to `2026-04-21`.
- Used local source files under:
  - `/mnt/d/Dropbox/AmazonReports/2026-04-19/`
  - `/mnt/d/Dropbox/AmazonReports/2026-04-21/`
  - `/mnt/d/Dropbox/AmazonReports/2026-04-23/`
- New upload ids used:
  - SP campaign: `76f9304c-9dd0-43a9-9a61-69a567b0ad24`, `3888f749-ee68-45d0-95f3-ec7dd5a73f98`, `684f1e9a-1054-42b1-905b-e6f96c25e7d3`
  - SP placement: `d091a08b-1420-4599-97de-027b00cc7602`, `c9d54688-ea84-43d1-833e-661c6209a1ba`, `a20cb844-5de4-4ac8-a51b-2549ff0c2a93`
  - SP targeting: `0fdf41c6-eeba-4446-99ca-4b58d5dde661`, `1adfaffb-814f-4838-b6f5-46fb41276546`, `70c7c0ee-3829-4d9c-92c4-f5c5a56bcdbd`
  - SP STIS: `c774ffc1-d090-4404-a245-cabf6e7d02e3`, `14fd3363-3eb5-4e04-812d-4b68cfb1d74b`, `e7ec3ce9-10a6-40b7-bd13-ce4fff6449b7`
- Rebuilt SP gold explicitly with:
  - `rebuild_sp_campaign_hourly_fact_gold('sourbear', '2026-03-07', '2026-04-21')`

### 2. Placement negative-row inspection

Exact rows:

| date | campaign_id | campaign_name_raw | placement_raw | placement_code | impressions | clicks | spend | sales | orders | units | upload_id | sync_run_id | source |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- |
| `2025-12-07` | `356605029959043` | `Retired \| B0B2K57W5R \| SPM \| PT \| STPP - Bid dn 09.12` | `Product pages on Amazon` | `PP` | `-1` | `0` | `NULL` | `0` | `0` | `0` | `e1675a97-39a6-46ed-a813-a91b9f71a8d6` | unavailable in current row-level schema | [/mnt/d/Dropbox/AmazonReports/2025-12-16/Sponsored_Products_Placement_report.xlsx](/mnt/d/Dropbox/AmazonReports/2025-12-16/Sponsored_Products_Placement_report.xlsx) |
| `2025-12-07` | `356605029959043` | same | `Product pages on Amazon` | `PP` | `-1` | `0` | `NULL` | `0` | `0` | `0` | `b98e67e7-d03f-4244-a3c9-4f125d3b91ce` | unavailable in current row-level schema | [/mnt/d/Dropbox/AmazonReports/2025-12-23/Sponsored_Products_Placement_report.xlsx](/mnt/d/Dropbox/AmazonReports/2025-12-23/Sponsored_Products_Placement_report.xlsx) |
| `2025-12-07` | `356605029959043` | same | `Product pages on Amazon` | `PP` | `-1` | `0` | `NULL` | `0` | `0` | `0` | `a0b53f8c-4087-4f9c-adac-9823a1091c61` | unavailable in current row-level schema | [/mnt/d/Dropbox/AmazonReports/2025-12-30/Sponsored_Products_Placement_report.xlsx](/mnt/d/Dropbox/AmazonReports/2025-12-30/Sponsored_Products_Placement_report.xlsx) |
| `2025-12-07` | `356605029959043` | same | `Product pages on Amazon` | `PP` | `-1` | `0` | `NULL` | `0` | `0` | `0` | `be1a4280-6df1-472a-8a78-324f26dec93e` | unavailable in current row-level schema | [/mnt/d/Dropbox/AmazonReports/2026-01-06/Sponsored_Products_Placement_report.xlsx](/mnt/d/Dropbox/AmazonReports/2026-01-06/Sponsored_Products_Placement_report.xlsx) |

Findings:

- The negative column is `impressions`.
- `clicks`, `spend`, `sales`, `orders`, and `units` are not negative on these rows.
- This looks like a source/parser integrity problem, not an Amazon returns/adjustments case.
- No clamping was applied.

Recommendation:

- Re-trace the SP placement parser/header mapping against these four legacy files specifically.
- If Albert wants this corrected, do it as a parser-and-reimport repair, not as a direct data patch.

### 3. SP advertised-product duplicate repair

- Natural-key duplicate rows before: `474`
- Exact duplicate rows before: `474`
- All duplicate groups had size `2`
- Deleted exact duplicates only: `474`
- Natural-key duplicate rows after: `0`

Delete method:

- `ctid`-based delete using `row_number()` over the full row payload
- no non-exact rows were deleted

### 4. Sales & Traffic view fix

Fixed a real latest-view bug:

- `amazon_sales_traffic_timeseries_latest` previously partitioned by `report_type` and report window
- overlapping SP-API refreshes therefore survived as multiple “latest” rows for the same analysis key
- `v_mcp_sales_traffic_daily` inherited that bug directly

Applied fix:

- added migration `supabase/migrations/20260427103000_fix_sales_traffic_latest_view_dedupe.sql`
- repartitioned latest-view logic to the true analysis key:
  - `account_id, marketplace, granularity, asin_granularity, date, parent_asin, child_asin, asin, sku`
- ordered by latest `exported_at`, `ingested_at`, `is_final`, `report_id`, `canonical_record_id`

Result:

- `amazon_sales_traffic_timeseries_latest` duplicate natural keys: `33 -> 0`
- `v_mcp_sales_traffic_daily` duplicate natural keys: `33 -> 0`
- `v_mcp_sales_traffic_daily` row count: `771 -> 738`

Important clarification:

- `2026-04-25` is still missing at date grain because the upstream by-date warehouse rows do not contain a `2026-04-25` date row.
- Child-ASIN rows for `2026-04-25` do exist in source data.
- This remaining issue is source availability, not latest-view logic.

## What Did Not Change

- No newer SB source exists after `2026-04-07`, so SB tables remain source-limited at their current cutoffs.
- No newer SD source exists after `2026-02-21`, so SD campaign and SD advertised-product remain source-limited at `2026-02-18`.
- `sd_targeting_daily_fact`, `sd_matched_target_daily_fact`, and `sd_purchased_product_daily_fact` remain zero-row tables.
  - Historical SD campaign activity does exist, so these cannot be treated as “no historical SD ever existed”.
  - The two historical local detail-upload dates (`2026-02-11`, `2026-02-21`) still correspond to zero-row source returns.
  - For the current no-active-SD state, these are not blockers.
- `sqp_monthly_raw` and `v_mcp_sqp_monthly` did not need repair.
  - Distinct stored monthly periods remain:
    - `2025-12-01 -> 2025-12-31`
    - `2026-01-01 -> 2026-01-31`
    - `2026-02-01 -> 2026-02-28`
    - `2026-03-01 -> 2026-03-31`
  - Missing earlier months are real source absence, not a `period_end` / `reporting_date` bug.
- `h10_keyword_rank_daily_latest` and `v_mcp_h10_keyword_rankings` remain clean with zero latest natural-key duplicates.
- `h10_keyword_tracker_raw` still has `144,923` overlapping daily rows, which remains expected rolling-export overlap.

## Remaining Blockers

- `sp_campaign_hourly_fact_gold` still has one raw-source hole at `2026-03-08 02:00`.
  - The direct Ads API campaign pull for `2026-03-08` did succeed late with `40` rows.
  - Ingest is still blocked by the existing shared Ads persistence path, which currently requires `out/ads-api-sp-target-daily/raw/sp-target-daily.raw.json` before `adsapi:ingest-sp-campaign-daily` can proceed.
- SP tables still do not reach `2026-04-25`; local source only extended through `2026-04-21`.
- `sp_advertised_product_daily_fact` still lacks any later source past `2026-04-04`.
- SB and SD tables remain source-limited by the currently available local files.
- Sales & Traffic still lacks a date-grain `2026-04-25` row in source warehouse data.

## Albert Action Needed

- `Yes` for the legacy placement negatives if you want them corrected. That should be approved as a parser + reimport task, not a direct row patch.
- `No` for the SP advertised-product dedupe; the exact duplicate repair is already completed safely.
- `No` for the Sales & Traffic view fix; the duplicate issue was proven to be view logic and is already corrected.
- `Optional` if you want additional source acquisition for:
  - SP dates `2026-04-22` -> `2026-04-25`
  - later SB source after `2026-04-07`
  - later SD source after `2026-02-21`
  - a date-grain Sales & Traffic source row for `2026-04-25`

## Priority Summary

1. Fixed items.
   - SP campaign gold extended to `2026-04-21 23:00`.
   - SP placement/targeting/STIS extended to `2026-04-21`.
   - SP advertised-product exact duplicates removed.
   - Sales & Traffic latest-view duplication fixed.
2. Items reclassified as expected no data.
   - Current SD detail-table zeros are not blockers for the present no-active-SD state.
3. Items still needing backfill.
   - SP `2026-04-22` -> `2026-04-25`
   - SB after `2026-04-07`
   - SD after `2026-02-21`
   - Sales & Traffic date-grain `2026-04-25`
4. Items needing Albert approval before changing.
   - Legacy negative `sp_placement_daily_fact` rows
5. Items that are view logic issues, not raw data issues.
   - `amazon_sales_traffic_timeseries_latest`
   - `v_mcp_sales_traffic_daily`
6. Whether the Supabase dump blocker affected this repair.
   - `No`. The Docker-based dump blocker did not block repair work.
