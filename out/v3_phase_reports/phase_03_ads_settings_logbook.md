# Phase 3 Report - Current Ads Settings and Automatic Ads Change Logbook

Generated: 2026-04-26T20:52:00+08:00

Project: `aghtxbvgcazlowpujtjk`

## Objective

Capture current SP/SB/SD ads settings from the existing bulk facts layer, detect changes between settings snapshots, and write deduped automatic logbook rows with linked entities.

## Work Completed

- Inspected existing bulk/manual import surfaces and bulk snapshot tables.
- Inspected existing Ads API helpers; no new Ads API puller was built in this database-only phase.
- Added migration `supabase/migrations/20260426143000_v3_ads_settings_snapshot_logbook.sql`.
- Added nullable structured metadata columns to `log_changes`: `entity_level`, `field_name`.
- Created view `public.v3_ads_settings_snapshot_rows`.
- Created function `public.v3_capture_ads_settings_snapshot(account_id, marketplace, channel, snapshot_date)`.
- Applied migration to the linked Supabase project.
- Ran latest snapshot capture for SP, SB, and SD.
- Re-ran the same captures to prove dedupe prevents duplicate logbook rows.

## Remote Result

- Latest snapshot date used: `2026-04-07`.
- Previous snapshot date used: `2026-04-03`.
- SP entities seen: `5657`; changes detected: `11`; log changes written on first run: `11`.
- SB entities seen: `566`; changes detected: `0`.
- SD entities seen: `190`; changes detected: `0`.
- Repeated SP capture detected `11` candidate changes and wrote `0` duplicate rows.
- Automatic ads log changes total: `11`.
- Automatic ads linked entities total: `11`.
- Duplicate automatic dedupe keys: `0`.

## Validation

- Automatic log rows missing `before_json`/`after_json`: `0`.
- Automatic log rows missing `entity_level`/`field_name`: `0`.
- Automatic log rows missing `source`/`dedupe_key`: `0`.
- Linked entities exist for all automatic changes.
- `ads_settings_snapshot_runs` rows were written for SP/SB/SD.
- `report_data_status` rows were written for SP/SB/SD settings snapshots.

## Commands Run

- `npm test -- test/v3AdsSettingsLogbookMigration.test.ts test/v3DatabaseControlLayerMigration.test.ts`
- Applied `supabase/migrations/20260426143000_v3_ads_settings_snapshot_logbook.sql` with `DATABASE_URL`.
- `select public.v3_capture_ads_settings_snapshot('sourbear', 'US', 'sp')`
- `select public.v3_capture_ads_settings_snapshot('sourbear', 'US', 'sb')`
- `select public.v3_capture_ads_settings_snapshot('sourbear', 'US', 'sd')`
- Repeated the SP/SB/SD capture query for dedupe verification.
- `npm run schema:snapshot`
- `npm run build`
- `git diff --check`

## Errors Fixed

- First capture failed because `report_data_status` enforces `is_final = true` only when `data_status = 'final'`; patched settings status rows to use live/non-final.
- Multi-channel capture in one SQL statement initially reused the same temp table names; patched the function to drop temp tables before recreating them.

## What The System Can Do Now

The database can normalize SP/SB/SD settings from bulk snapshots, compare a current snapshot to the previous snapshot, write snapshot run metadata, write freshness/status rows, create automatic logbook changes with before/after details, and safely rerun without duplicate logbook rows.

## What Phase 4 Will Do

Phase 4 will build SP/SB/SD ads performance report tables and backfill/report validation for campaign, ad group, target, placement, search term, advertised product, purchased product, and matched target reporting.
