# Phase 4 Report - SP/SB/SD Ads Performance Reports

Generated: 2026-04-26T21:35:00+08:00

Project: `aghtxbvgcazlowpujtjk`

## Objective

Verify and complete the database layer for SP/SB/SD ads performance reporting tables, write sync/status/quality metadata, and document source-data blockers.

## Work Completed

- Verified all 15 Phase 4 target tables exist.
- Inspected existing local ingest/API surfaces for ads reports.
- Applied migration `supabase/migrations/20260426160000_v3_ads_performance_natural_keys.sql`.
- Added `sp_advertised_product_daily_fact_natural_idx` as a non-unique lookup index because existing exact duplicate rows prevent a safe unique index.
- Added `sb_attributed_purchases_daily_fact_uq` as a unique natural-key index.
- Reran SD backfill for local report folders `2026-02-11` through `2026-02-21`.
- Wrote `api_sync_runs`, `report_data_status`, and `data_quality_checks` for all 15 tables.

## Table Result

- `sp_campaign_hourly_fact_gold`: 92,883 rows, `2026-01-01` through `2026-04-16`.
- `sp_placement_daily_fact`: 252,038 rows, `2025-07-12` through `2026-04-06`.
- `sp_targeting_daily_fact`: 369,641 rows, `2025-07-12` through `2026-04-16`.
- `sp_stis_daily_fact`: 60,447 rows, `2025-07-12` through `2026-04-06`.
- `sp_advertised_product_daily_fact`: 60,675 rows, `2026-01-26` through `2026-04-05`.
- `sb_campaign_daily_fact_gold`: 3,296 rows, `2026-01-01` through `2026-04-06`.
- `sb_campaign_placement_daily_fact`: 13,884 rows, `2025-12-09` through `2026-04-06`.
- `sb_keyword_daily_fact`: 8,007 rows, `2025-12-08` through `2026-04-04`.
- `sb_stis_daily_fact`: 1,881 rows, `2025-12-09` through `2026-04-05`.
- `sb_attributed_purchases_daily_fact`: 300 rows, `2025-08-02` through `2026-04-03`.
- `sd_campaign_daily_fact_gold`: 365 rows, `2025-12-08` through `2026-02-18`.
- `sd_advertised_product_daily_fact`: 470 rows, `2025-12-08` through `2026-02-18`.
- `sd_targeting_daily_fact`: 0 rows; local source reports parsed with zero rows.
- `sd_matched_target_daily_fact`: 0 rows; local source reports parsed with zero rows.
- `sd_purchased_product_daily_fact`: 0 rows; local source reports parsed with zero rows.

## Quality Findings

- `sp_advertised_product_daily_fact` has 1,305 duplicate exact natural-key rows. No destructive cleanup was performed.
- `sp_placement_daily_fact` has 4 source rows with negative impressions for campaign `356605029959043`, placement `PP`, date `2025-12-07`.
- SD targeting, matched target, and purchased product report files exist for local dates `2026-02-11` and `2026-02-21`, but parser/ingest returned zero rows.

## Commands Run

- `npm run pipeline:backfill:sd -- --account-id sourbear --root /mnt/d/Dropbox/AmazonReports --from 2026-02-11 --to 2026-02-21 --concurrency 1 --continue-on-error`
- Applied `supabase/migrations/20260426160000_v3_ads_performance_natural_keys.sql` with `DATABASE_URL`.
- Wrote Phase 4 `api_sync_runs`, `report_data_status`, and `data_quality_checks` with direct SQL.
- `npm run schema:snapshot`
- `npm test -- test/v3AdsPerformanceMigration.test.ts`

## External / Source Blockers

- SD targeting, matched target, and purchased product are blocked by zero-row source report content in the available local files, not by table absence.
- Ads API pullers are only present for SP campaign and SP target daily paths; this phase used existing local/manual report ingestion where API pullers are not yet available.

## What The System Can Do Now

The database has verified SP/SB/SD ads performance fact tables, status rows, quality checks, natural-key coverage, and documented data-quality/source blockers for incomplete sources.

## What Phase 5 Will Do

Phase 5 will build and verify weekly/monthly SQP ingestion, backfill, status metadata, and quality checks.
