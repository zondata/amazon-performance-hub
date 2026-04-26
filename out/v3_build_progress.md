# V3 Build Progress

Generated: 2026-04-26T18:47:08+08:00

## Phase Status

| Phase | Status | Notes |
| --- | --- | --- |
| Phase 0 - Repo, Supabase, and Migration Baseline | Complete with documented external blockers | Repo/branch/project verified, schema inventory and counts written, local invalid migration blocker fixed, build/test green. Supabase CLI dump/local start blocked externally. |
| Phase 1 - Database Control Layer | Applied and verified | Migration applied to linked Supabase project through the Supabase connector. Tables exist, contract tests pass, and a smoke insert path succeeded. |
| Phase 2 - Amazon Sales & Traffic | Complete | Canonical table/view created and applied remotely, existing SP-API warehouse rows backfilled, one-day live SP-API sample pulled and ingested, latest 30-day refresh pulled and ingested, max-history backfill pulled and ingested, status/run/quality rows written, schema snapshot/build/test green. |
| Phase 3 - Current Ads Settings and Automatic Ads Change Logbook | Applied and verified | Bulk snapshot settings view/function applied remotely, SP/SB/SD latest snapshots captured, SP wrote 11 automatic logbook changes, SB/SD captured with no changes, repeated snapshots created no duplicate log rows. |
| Phase 4 - SP/SB/SD Ads Performance Reports | Complete with documented data-quality/source blockers | All 15 target tables exist. 12 are populated and status/quality metadata was written. SD targeting/matched/purchased source files reran successfully but contained zero rows. SP placement has 4 negative-impression source rows; SP advertised product has duplicate exact rows, so only a non-unique natural-key index was added. |
| Phase 5 - SQP Weekly and Monthly | Not started | Not part of Phase 0. |
| Phase 6 - Helium 10 Keyword Ranking | Not started | Not part of Phase 0. |
| Phase 7 - Manual Non-Ads Logbook | Not started | Not part of Phase 0. |
| Phase 8 - MCP Views and Cleanup | Not started | No cleanup/drop actions allowed before Phase 8. |

## Phase 0 Checklist

- [x] Confirmed worktree path: `/home/albert/code/amazon-performance-hub-v3`.
- [x] Confirmed branch: `v3/database-only`.
- [x] Confirmed Git remote: `https://github.com/zondata/amazon-performance-hub.git`.
- [x] Documented pre-existing worktree changes: modified `.codex/config.toml`; untracked duplicate plan file.
- [x] Confirmed `gh auth status` works for account `zondata`.
- [x] Confirmed Supabase CLI exists: `2.75.0`.
- [x] Confirmed linked Supabase project ref: `aghtxbvgcazlowpujtjk`.
- [x] Ran `supabase migration list` successfully once after the migration filename fix.
- [x] Documented `supabase db dump` blocker in `out/v3_live_schema_phase0.sql` and `out/v3_schema_after_phase.sql`.
- [x] Created `out/v3_schema_inventory.md`.
- [x] Created `out/v3_table_counts.md` from SQL-accessible table statistics.
- [x] Identified skipped invalid local migrations: `006a_sp_placement_raw_norm.sql`, `006b_sp_placement_latest_norm.sql`.
- [x] Fixed the local `014_latest_tiebreak.sql` / `placement_raw_norm` migration-order issue.
- [x] Ran local Supabase validation attempt; blocked by unavailable Docker daemon.
- [x] Created `out/v3_cleanup_candidates.md`.
- [x] Created this progress file.
- [x] Ran standard checks; build/test passed, final migration list/dump blocked externally as documented.
- [x] Wrote `out/v3_phase_reports/phase_00_baseline.md`.

## Phase 1 Checklist

- [x] Created migration for missing control tables only: `20260426110000_v3_database_control_layer.sql`.
- [x] Used `create table if not exists`, `create index if not exists`, and idempotent trigger/function definitions where practical.
- [x] Added indexes for account, marketplace, source, table, date/range, freshness, and status dimensions.
- [x] Added shared `data_status` convention: `live`, `preliminary`, `final`, `failed`, `manual_unknown`.
- [x] Added helper SQL for data quality check writes: `record_data_quality_check(...)`.
- [x] Inserted one test/manual-only connection row, then deleted it after explicit cleanup approval.
- [x] Inserted one test sync run and one data quality check, then deleted all Phase 1 smoke rows after explicit cleanup approval.
- [x] Validated no direct secret columns are introduced; `api_connections` stores `auth_secret_ref`.
- [ ] Applied migration locally. Blocked because Docker daemon is unavailable.
- [x] Applied migration to linked Supabase project through Supabase connector after local code checks passed.
- [x] Ran standard code checks: `npm run build` and `npm test`.
- [x] Wrote `out/v3_phase_reports/phase_01_control_layer.md`.

## Phase 1 Remote Verification

- Verified tables exist remotely: `api_connections`, `api_sync_runs`, `api_sync_cursors`, `ads_settings_snapshot_runs`, `report_data_status`, `data_quality_checks`.
- Verified constraints and indexes are present through catalog queries.
- Smoke insert path succeeded for `api_connections`, `api_sync_runs`, `api_sync_cursors`, `report_data_status`, and `data_quality_checks`.
- Deleted Phase 1 smoke rows after explicit cleanup approval: one row each from `api_connections`, `api_sync_runs`, `api_sync_cursors`, `report_data_status`, and `data_quality_checks`.
- Verified final Phase 1 table row counts: all six Phase 1 control tables have `0` rows.

## Phase 2 Checklist

- [x] Inspected existing SP-API Sales & Traffic code: report request CLI, retail ingest CLI, and warehouse writer already exist.
- [x] Created migration `supabase/migrations/20260426123000_v3_amazon_sales_traffic_timeseries.sql`.
- [x] Applied the migration to linked Supabase project `aghtxbvgcazlowpujtjk` through the Supabase connector.
- [x] Created canonical table `amazon_sales_traffic_timeseries`.
- [x] Created latest view `amazon_sales_traffic_timeseries_latest`.
- [x] Backfilled existing proven SP-API warehouse rows from `spapi_sales_and_traffic_by_date_report_rows` and `spapi_sales_and_traffic_by_asin_report_rows`.
- [x] Ran one-day live Amazon sample pull for `GET_SALES_AND_TRAFFIC_REPORT`: report id `489144020569`.
- [x] Downloaded, parsed, and ingested the live sample report: 1 by-date row and 2 by-ASIN rows.
- [x] Retried latest 30-day refresh until Amazon accepted it: report id `489147020569`.
- [x] Downloaded, parsed, and ingested the latest 30-day refresh: 29 by-date rows and 2 by-ASIN rows.
- [x] Retried maximum-history backfill until Amazon accepted it: report id `489150020569`.
- [x] Downloaded, parsed, and ingested the maximum-history backfill: 728 by-date rows and 6 by-ASIN rows.
- [x] Refreshed the V3 canonical table from the updated SP-API warehouse rows.
- [x] Wrote Phase 2 `api_sync_runs` rows and linked the 734 max-history canonical rows to sync run `4e32db7f-e0b2-4e0d-8a4c-b2017a7399c5`.
- [x] Wrote `report_data_status` rows for `amazon_sales_traffic_timeseries`.
- [x] Wrote twenty total passing `data_quality_checks`.
- [x] Validated remote row counts, coverage dates, duplicate natural keys, required fields, nonnegative metrics, and derived metric accuracy.
- [x] Ran standard code checks: `npm run build` and `npm test`.
- [x] Ran `npm run schema:snapshot` by exporting env from `/home/albert/code/amazon-performance-hub/.env.local`.
- [x] Ran maximum Amazon history backfill for `2024-04-27` through `2026-04-25`.
- [x] Ran latest 7-30 day refresh for `2026-03-27` through `2026-04-25`.

## Phase 2 Remote Verification

- `amazon_sales_traffic_timeseries` row count: `771`.
- Coverage: `2024-04-27` through `2026-04-25`.
- Date-grain rows: `759`.
- ASIN-grain rows: `12`.
- Rows linked to max-history sync run: `734`.
- Live sample report id: `489144020569`.
- Latest refresh report id: `489147020569`.
- Max-history report id: `489150020569`.
- Duplicate natural keys: `0`.
- Negative metric rows: `0`.
- Missing required identity/status rows: `0`.
- Derived metric mismatch rows: `0`.
- `report_data_status`: preliminary non-final rows with coverage metadata and no warnings.
- `data_quality_checks`: twenty total passed checks; max-history sync run has five passed checks with `failing_rows = 0`.

## Phase 3 Checklist

- [x] Inspected existing bulk/manual upload importer and current bulk snapshot tables.
- [x] Inspected existing Ads API helpers; no new Ads API puller was built in this database-only phase.
- [x] Created migration `supabase/migrations/20260426143000_v3_ads_settings_snapshot_logbook.sql`.
- [x] Added nullable `entity_level` and `field_name` metadata columns to `log_changes`.
- [x] Created `v3_ads_settings_snapshot_rows` to normalize SP/SB/SD settings from existing bulk snapshot tables.
- [x] Created `v3_capture_ads_settings_snapshot(account_id, marketplace, channel, snapshot_date)` to compare against the previous snapshot and write automatic logbook rows.
- [x] Captured latest SP settings snapshot for `sourbear`/`US`: snapshot `2026-04-07`, previous `2026-04-03`, entities seen `5657`, changes detected `11`, log changes written `11`.
- [x] Captured latest SB settings snapshot: snapshot `2026-04-07`, previous `2026-04-03`, entities seen `566`, changes detected `0`.
- [x] Captured latest SD settings snapshot: snapshot `2026-04-07`, previous `2026-04-03`, entities seen `190`, changes detected `0`.
- [x] Re-ran SP/SB/SD captures to verify dedupe. SP still detected `11` candidate changes but wrote `0` duplicate log rows.
- [x] Verified automatic log changes have `before_json`, `after_json`, `entity_level`, `field_name`, `source`, `dedupe_key`, and linked `log_change_entities`.
- [x] Wrote status rows to `report_data_status`.
- [x] Ran schema snapshot, build, focused migration tests, and diff whitespace check.

## Phase 3 Remote Verification

- Automatic ads log changes: `11`.
- Automatic ads linked entities: `11`.
- Duplicate automatic dedupe keys: `0`.
- Automatic changes missing before/after JSON: `0`.
- Automatic changes missing entity/field metadata: `0`.
- `ads_settings_snapshot_runs` rows after proof rerun: `6`.
- `report_data_status` rows for ads settings snapshots: `3`.

## Phase 4 Checklist

- [x] Verified all 15 ads performance tables exist.
- [x] Added migration `supabase/migrations/20260426160000_v3_ads_performance_natural_keys.sql`.
- [x] Added non-unique natural-key lookup index for `sp_advertised_product_daily_fact` because existing duplicate exact rows prevent a safe unique index.
- [x] Added unique natural-key index for `sb_attributed_purchases_daily_fact`.
- [x] Reran SD local backfill for `2026-02-11` through `2026-02-21` using `/mnt/d/Dropbox/AmazonReports`.
- [x] Confirmed SD targeting, matched target, and purchased product source files exist but parse to zero rows for available local dates.
- [x] Wrote `api_sync_runs`, `report_data_status`, and `data_quality_checks` for all 15 Phase 4 tables.
- [x] Ran schema snapshot, focused migration test, and diff whitespace check.

## Phase 4 Remote Verification

- Populated tables: 12 of 15.
- Zero-row/source-blocked tables: `sd_targeting_daily_fact`, `sd_matched_target_daily_fact`, `sd_purchased_product_daily_fact`.
- `sp_campaign_hourly_fact_gold`: 92,883 rows, coverage `2026-01-01` through `2026-04-16`.
- `sp_placement_daily_fact`: 252,038 rows, coverage `2025-07-12` through `2026-04-06`, 4 negative-impression source rows.
- `sp_targeting_daily_fact`: 369,641 rows, coverage `2025-07-12` through `2026-04-16`.
- `sp_stis_daily_fact`: 60,447 rows, coverage `2025-07-12` through `2026-04-06`.
- `sp_advertised_product_daily_fact`: 60,675 rows, coverage `2026-01-26` through `2026-04-05`, 1,305 duplicate exact natural-key rows.
- `sb_campaign_daily_fact_gold`: 3,296 rows, coverage `2026-01-01` through `2026-04-06`.
- `sb_campaign_placement_daily_fact`: 13,884 rows, coverage `2025-12-09` through `2026-04-06`.
- `sb_keyword_daily_fact`: 8,007 rows, coverage `2025-12-08` through `2026-04-04`.
- `sb_stis_daily_fact`: 1,881 rows, coverage `2025-12-09` through `2026-04-05`.
- `sb_attributed_purchases_daily_fact`: 300 rows, coverage `2025-08-02` through `2026-04-03`.
- `sd_campaign_daily_fact_gold`: 365 rows, coverage `2025-12-08` through `2026-02-18`.
- `sd_advertised_product_daily_fact`: 470 rows, coverage `2025-12-08` through `2026-02-18`.
