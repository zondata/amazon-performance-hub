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

## Phase 5 Checklist

- [x] Created and applied migration `supabase/migrations/20260426173000_v3_sqp_monthly_raw.sql`.
- [x] Verified existing weekly SQP importer and fixed safe import guard in `src/cli/ingestSqpWeeklyDate.ts`.
- [x] Added monthly SQP parser support, monthly manual ingest CLI, and monthly SP-API pull/ingest CLI.
- [x] Confirmed weekly manual upload fallback by rerunning Dropbox backfill over available SQP folders.
- [x] Pulled weekly SP-API sample for ASIN `B0FYPRWPN1`, week `2026-04-12` through `2026-04-18`, report `489161020569`, 62 rows.
- [x] Backfilled monthly SP-API SQP for ASIN `B0FYPRWPN1` from `2025-12-01` through `2026-03-31`.
- [x] Refreshed latest two complete monthly periods: February and March 2026.
- [x] Validated period boundaries, duplicate natural keys, and negative SQP metrics.
- [x] Wrote Phase 5 `api_sync_runs`, `report_data_status`, and `data_quality_checks`.
- [x] Ran `npm run schema:snapshot`, `npm run build`, `npm test`, and `git diff --check`.
- [x] Documented Supabase CLI blockers: `supabase migration list` failed temp-role auth, and `supabase db dump` failed because Docker is unavailable.

## Phase 5 Remote Verification

- `sqp_weekly_raw`: 38,154 total rows; `sourbear`/`US` coverage `2025-06-28` through `2026-04-18`.
- `sqp_monthly_raw`: 304 total rows; `sourbear`/`US` coverage `2025-12-31` through `2026-03-31`.
- Weekly duplicate natural keys: `0`.
- Monthly duplicate natural keys: `0`.
- Weekly negative metric rows: `0`.
- Monthly negative metric rows: `0`.
- Weekly period boundary failures: `0`.
- Monthly period boundary failures: `0`.
- November 2025 monthly boundary: SP-API returned an artifact without `dataByAsin` rows for `B0FYPRWPN1`.

## Phase 6 Checklist

- [x] Inspected existing H10 table, parser, CLIs, backfill pipeline, fixtures, and tests.
- [x] Confirmed `h10_keyword_tracker_raw` required identity/date/rank columns and raw uniqueness.
- [x] Confirmed organic rank parsing into `organic_rank_value` and `organic_rank_kind`.
- [x] Confirmed sponsored rank parsing into `sponsored_pos_value` and `sponsored_pos_kind`.
- [x] Confirmed duplicate protection through upload file hash idempotency, raw exact uniqueness, and daily latest dedupe view.
- [x] Fixed `src/cli/ingestHelium10KeywordTrackerDate.ts` import guard so backfill imports do not execute CLI `main()`.
- [x] Ran H10 backfill from `/mnt/d/Dropbox/AmazonReports` for `2026-02-11` through `2026-04-23`.
- [x] Imported missing H10 snapshots for `2026-03-16`, `2026-04-19`, `2026-04-21`, and `2026-04-23`.
- [x] Validated rank kind/value consistency, required fields, negative values, raw exact duplicates, and daily latest natural-key duplicates.
- [x] Wrote Phase 6 `api_sync_runs`, `report_data_status`, and `data_quality_checks`.
- [x] Ran `npm run schema:snapshot`; Supabase CLI migration list and dump remain externally blocked.

## Phase 6 Remote Verification

- `h10_keyword_tracker_raw`: 230,620 total rows.
- `h10_keyword_tracker_raw` for `sourbear`/`US`: 157,451 rows, coverage `2025-08-12` through `2026-04-22`.
- `h10_keyword_rank_daily_latest` for `sourbear`/`US`: 12,528 rows, coverage `2025-08-12` through `2026-04-22`.
- Raw exact duplicate keys `(account_id, marketplace, asin, keyword_norm, observed_at, exported_at)`: `0`.
- Daily latest duplicate keys `(account_id, marketplace, asin, keyword_norm, observed_date)`: `0`.
- Raw overlapping daily duplicate rows across rolling exports: `144,923` warning rows; expected because H10 exports include history and latest view resolves them.
- Rank kind/value consistency failures: `0`.
- Missing required identity/date fields: `0`.
- Negative numeric metric rows: `0`.

## Phase 7 Checklist

- [x] Verified existing `log_changes`, `log_change_entities`, and `log_evaluations` structure.
- [x] Added migration `supabase/migrations/20260426190000_v3_non_ads_logbook.sql`.
- [x] Added `expected_outcome`, `evaluation_window_days`, and `notes` to `log_changes`.
- [x] Added `asin` and `sku` links to `log_change_entities`.
- [x] Created `change_outcome_evaluations` for append-only later evaluation.
- [x] Extended logbook validation/types/db helpers for non-ads planning fields and evaluations.
- [x] Added CLI command `npm run log:change:evaluate`.
- [x] Applied the migration to linked Supabase project `aghtxbvgcazlowpujtjk` through the Supabase project connector.
- [x] Validated a manual non-ads change insert, ASIN/SKU entity link, and outcome evaluation insert inside a rollback transaction.
- [x] Wrote Phase 7 `api_sync_runs`, `report_data_status`, and `data_quality_checks`.
- [x] Ran focused tests, `npm run schema:snapshot`, `supabase migration list`, `npm run build`, `npm test`, and `git diff --check`.
- [x] Documented `supabase db dump` blocker.

## Phase 7 Remote Verification

- `log_changes` rows: `148`.
- `log_change_entities` rows: `149`.
- `change_outcome_evaluations` rows: `0`.
- Smoke transaction inserted and rolled back: one non-ads change, one ASIN/SKU entity link, and one outcome evaluation.
- Phase 7 quality checks written: `4`, all passed.
- `supabase migration list` passed and showed remote migration `20260426142141 | v3_non_ads_logbook`.
- `supabase db dump` failed because the Supabase CLI temporary login role could not authenticate and then hit the pooler circuit breaker.

## Phase 8 Checklist

- [x] Created migration `supabase/migrations/20260426203000_v3_mcp_views.sql`.
- [x] Applied MCP view migration to linked Supabase project `aghtxbvgcazlowpujtjk` through the Supabase project connector.
- [x] Created all 10 required MCP views.
- [x] Confirmed each MCP view returns rows or a valid empty result.
- [x] Confirmed MCP view columns do not expose secret/token/password/auth fields.
- [x] Confirmed recursive MCP view dependencies do not include cleanup candidate tables.
- [x] Generated dependency report for every cleanup candidate table in `out/v3_cleanup_candidates.md`.
- [x] Generated exact row-count report for every cleanup candidate table in `out/v3_cleanup_candidates.md`.
- [x] Generated backup/export manifest for future cleanup in `out/v3_cleanup_candidates.md`.
- [x] Dropped no tables because dependencies, live data, active UI/optimizer ownership, or unclear purpose remain.
- [x] Wrote Phase 8 `api_sync_runs`, `report_data_status`, and `data_quality_checks`.
- [x] Ran focused MCP migration tests, `npm run build`, schema snapshot, `supabase migration list`, and `supabase db dump`.
- [x] Documented `supabase db dump` blocker.

## Phase 8 Remote Verification

- `v_mcp_sales_traffic_daily`: `771` rows.
- `v_mcp_ads_current_settings`: `13,437` rows.
- `v_mcp_ads_performance_daily`: `76,167` rows.
- `v_mcp_ads_performance_hourly`: `92,883` rows.
- `v_mcp_sqp_weekly`: `38,154` rows.
- `v_mcp_sqp_monthly`: `304` rows.
- `v_mcp_h10_keyword_rankings`: `21,140` rows.
- `v_mcp_ads_change_logbook`: `148` rows.
- `v_mcp_non_ads_change_logbook`: `3` rows.
- `v_mcp_data_freshness`: `38` rows after Phase 8 status rows.
- Secret-column scan returned `0` findings.
- Cleanup candidate dependency scan showed no MCP-view dependency on candidate tables.
- Cleanup candidate exact row-count report covered `44` candidate tables.
- Tables dropped: `0`.
