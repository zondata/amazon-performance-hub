# Amazon Performance Hub V3 — Database-Only Codex Build Plan

Save this file in the repo as:

```bash
/home/albert/code/amazon-performance-hub-v3/docs/v3_database_only_build_plan.md
```

Codex must update the checkboxes in this file after completing each checklist item. Codex must also write phase reports to:

```bash
/home/albert/code/amazon-performance-hub-v3/out/v3_phase_reports/
```

## 0. Build Summary

This build converts Amazon Performance Hub into a clean Supabase-first database system.

The system will:

- Pull Amazon data by API when API access exists.
- Accept manual uploads when API access does not exist or when the source is not automated yet.
- Store Amazon Sales & Traffic, current ads settings, SP/SB/SD ads reports, SQP weekly/monthly, and Helium 10 keyword rankings.
- Calculate missing metrics such as ACOS, ROAS, CPC, CTR, conversion rate, average selling price, and other derived metrics.
- Track whether data is live/preliminary/final because Amazon data is delayed and can change.
- Automatically detect ads setting changes and write them into the ads logbook.
- Support manual non-ads change logging for title, bullets, images, reviews, rating, and other listing/product changes.
- Expose clean MCP-readable views for Codex, Claude Code, Claude Co work, and other agents to analyze the data.

This build will not build a full dashboard, optimizer, recommendation engine, or complex UI. The priority is a fast, clean, reliable database.

## 1. Global Codex Operating Rules

Codex must follow these rules for every phase.

- Before starting each phase, tell Albert:
  - What this phase is.
  - What the system can do after this phase is complete.
  - What files, migrations, or data sources will be touched.
- Execute only the current approved phase.
- Fix errors automatically when possible.
- Do not ask for confirmation unless credentials, account permission, API access, or Amazon authorization is missing.
- Stop after the phase is complete.
- Report the result and tell Albert what the next phase is.
- Do not begin the next phase until Albert explicitly says to continue.
- Build one table or one pipeline at a time.
- For each table or pipeline:
  - Pull or insert one small sample first.
  - Validate the sample.
  - Fix errors.
  - Backfill missing historical data.
  - Validate again.
  - Mark the checklist item done.
- API source has priority over manual upload.
- Manual upload remains fallback.
- Do not drop tables until Phase 8.
- Do not store API secrets in normal tables. Store only secret references or environment variable names.
- Preserve unknown Amazon fields in `raw_json` when available.
- If a metric denominator is zero or missing, store `NULL`, not `0`.

## 2. Standard Metrics

Use these formulas across all tables where applicable:

```text
cpc = spend / clicks
ctr = clicks / impressions
acos = spend / sales
roas = sales / spend
conversion_rate = orders / clicks
avg_sales_price_calc = ordered_product_sales / units_ordered
unit_session_percentage_calc = units_ordered / sessions
```

## 3. Standard Checks

Run these after each phase unless impossible. If a command does not exist, document it and run the closest existing equivalent.

```bash
git status --short
npm run build
npm test
supabase migration list
supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql
```

For every new or changed table, run SQL checks for:

- Row count.
- Duplicate natural keys.
- Negative numeric metrics.
- Missing `account_id`, `marketplace`, `data_status`, or `last_refreshed_at` where applicable.
- Derived metric accuracy.
- Backfill coverage.
- Latest rolling refresh coverage.

Write every phase report to:

```bash
out/v3_phase_reports/phase_XX_<short_name>.md
```

Each phase report must include:

- Phase objective.
- Files changed.
- Migrations created or changed.
- Tables created or changed.
- API/manual sources used.
- Backfill date range.
- Validation commands and results.
- Errors found and how they were fixed.
- What the system can now do.
- Next recommended phase.

---

# Phase 0 — Repo, Supabase, and Migration Baseline

## What this phase is

This phase verifies the WSL worktree, GitHub branch, Supabase project link, current schema, current migrations, local migration health, and current database inventory.

## What the system can do after this phase

After this phase, Albert has a verified baseline. Codex knows exactly what exists now, what is broken, what can be safely changed, and what must not be dropped yet.

## Restrictions

- Do not apply remote/cloud schema changes in Phase 0.
- Do not drop tables.
- Do not start building API pullers yet.
- Local migration fixes are allowed only if needed to make local Supabase start/migration validation work.

## Checklist

- [x] Confirm worktree path is `/home/albert/code/amazon-performance-hub-v3`.
- [x] Confirm branch is `v3/database-only`.
- [x] Confirm Git remote is `https://github.com/zondata/amazon-performance-hub.git`.
- [x] Confirm `git status --short` is clean or document existing changes before editing.
- [x] Confirm `gh auth status` works.
- [x] Confirm Supabase CLI works.
- [x] Confirm Supabase project ref is `aghtxbvgcazlowpujtjk`.
- [x] Run `supabase migration list`.
- [x] Dump live public schema to `out/v3_live_schema_phase0.sql`.
- [x] Create `out/v3_schema_inventory.md` with current table list.
- [x] Create `out/v3_table_counts.md` with live row counts if SQL access is available.
- [x] Identify local migrations that Supabase skips because of invalid filenames.
- [x] Fix the local migration problem around `014_latest_tiebreak.sql` and `placement_raw_norm` if still present.
- [x] Run local migration validation or `supabase start` if Docker/Supabase local can run.
- [x] Create `out/v3_cleanup_candidates.md` listing tables that appear unrelated to the new database-only direction.
- [x] Create `out/v3_build_progress.md` and mark Phase 0 status.
- [x] Run standard checks.
- [x] Write `out/v3_phase_reports/phase_00_baseline.md`.
- [x] Stop and report to Albert. Do not continue to Phase 1.

## Phase 0 done criteria

Phase 0 is done only when:

- Repo and Supabase project are verified.
- Current schema inventory exists.
- Current migration state is documented.
- Local migration blocker is fixed or clearly documented as externally blocked.
- No destructive changes were made.
- Codex has reported what Phase 1 will do.

---

# Phase 1 — Database Control Layer

## What this phase is

This phase adds the control tables needed for API-first ingestion, manual fallback, sync tracking, data finality, and validation.

## What the system can do after this phase

After this phase, the database can record API/manual connections, every sync run, every backfill cursor, every data freshness/finality status, and every validation check.

## Tables to create or verify

- `api_connections`
- `api_sync_runs`
- `api_sync_cursors`
- `ads_settings_snapshot_runs`
- `report_data_status`
- `data_quality_checks`

## Checklist

- [x] Create migration for missing control tables only.
- [x] Use create-if-not-exists/idempotent SQL where practical.
- [x] Add indexes for `account_id`, `marketplace`, `source_type`, `table_name`, date/range columns, and sync status.
- [x] Add `data_status` convention: `live`, `preliminary`, `final`, `failed`, `manual_unknown`.
- [x] Add helper SQL or TypeScript utilities for creating sync runs and writing data quality checks.
- [x] Insert one test/manual-only connection row if safe.
- [x] Insert one test sync run and one data quality check if safe.
- [x] Validate no secrets are stored directly.
- [ ] Apply migration locally first.
- [x] Apply migration to linked Supabase project only after local validation passes.
- [x] Run standard checks.
- [x] Update this plan checklist and `out/v3_build_progress.md`.
- [x] Write `out/v3_phase_reports/phase_01_control_layer.md`.
- [x] Stop and report to Albert. Do not continue to Phase 2.

## Phase 1 done criteria

Phase 1 is done only when the control tables exist in Supabase, validation passes, and sync runs can be recorded.

---

# Phase 2 — Amazon Sales & Traffic

## What this phase is

This phase builds Amazon SP-API Sales & Traffic ingestion into Supabase.

## What the system can do after this phase

After this phase, the system can pull Sales & Traffic data from Amazon, store sales/traffic/session/Buy Box/order/refund metrics, calculate missing derived metrics, mark data as live/preliminary/final, and backfill missing history.

## Table

- `amazon_sales_traffic_timeseries`

Required column groups:

- Account/source: `account_id`, `marketplace`, `sync_run_id`, `source`, `report_type`
- Grain: `granularity`, `asin_granularity`, `period_start`, `period_end`, `date`, `parent_asin`, `child_asin`, `asin`, `sku`
- Sales/order metrics: ordered sales, B2B sales, units ordered, order items, shipped sales, shipped units, refunds, refund rate
- Traffic metrics: page views, sessions, Buy Box percentage, order item/session percentage, unit/session percentage
- Derived metrics: `avg_sales_price_calc`, `unit_session_percentage_calc`
- Status: `data_status`, `is_final`, `final_after_at`, `finalized_at`, `last_refreshed_at`
- Raw/audit: `raw_json`, `created_at`, `updated_at`

## Checklist

- [x] Inspect existing code for SP-API auth/report helpers.
- [x] Create or update table migration.
- [x] Build one-day sample pull for `GET_SALES_AND_TRAFFIC_REPORT`.
- [x] Insert/upsert sample rows from existing proven SP-API retail warehouse rows.
- [x] Validate derived metrics.
- [x] Validate natural key uniqueness.
- [x] Backfill maximum available Sales & Traffic history allowed by Amazon for this report.
- [x] Refresh the latest 7–30 days and mark them non-final when appropriate.
- [x] Write `report_data_status` rows.
- [x] Write `api_sync_runs` and `data_quality_checks`.
- [x] Add or update MCP-friendly view for sales traffic if simple and safe.
- [x] Run standard checks.
- [x] Update this plan checklist and `out/v3_build_progress.md`.
- [x] Write `out/v3_phase_reports/phase_02_sales_traffic.md`.
- [x] Stop and report to Albert. Do not continue to Phase 3.

## Phase 2 done criteria

Phase 2 is done only when Sales & Traffic sample pull, insert, validation, and backfill all pass.

---

# Phase 3 — Current Ads Settings and Automatic Ads Change Logbook

## What this phase is

This phase captures the latest ads settings and automatically detects setting changes.

## What the system can do after this phase

After this phase, the system knows current bids, budgets, bidding strategies, modifiers, states, campaign/ad group/target settings, and can automatically log ads changes when snapshots differ.

## Tables to use or verify

SP settings:

- `bulk_portfolios`
- `bulk_campaigns`
- `bulk_ad_groups`
- `bulk_targets`
- `bulk_placements`
- `bulk_product_ads`
- `campaign_name_history`
- `ad_group_name_history`
- `portfolio_name_history`

SB settings:

- `bulk_sb_campaigns`
- `bulk_sb_ad_groups`
- `bulk_sb_targets`
- `bulk_sb_placements`
- `sb_campaign_name_history`
- `sb_ad_group_name_history`

SD settings:

- `bulk_sd_campaigns`
- `bulk_sd_ad_groups`
- `bulk_sd_product_ads`
- `bulk_sd_targets`
- `sd_campaign_name_history`
- `sd_ad_group_name_history`

Logbook:

- `log_changes`
- `log_change_entities`
- `log_change_validations`

## Checklist

- [x] Inspect existing bulk/manual upload importers.
- [x] Inspect existing Ads API helpers, if any.
- [x] Verify API-first current settings puller scope for SP. No new Ads API puller was built; Phase 3 uses the existing bulk facts layer per database-only/current no-new-puller scope.
- [x] Build manual bulksheet fallback for SP if not already working.
- [x] Insert first SP snapshot without logging false changes.
- [x] Build SP snapshot diff and automatic ads log insert.
- [x] Repeat for SB.
- [x] Repeat for SD.
- [x] Detect changes for campaign name, state, budget, bidding strategy, portfolio, ad group name, default bid, target expression, keyword text, match type, target bid, negative/positive state, placement modifier, product ad SKU/ASIN, SD tactic, SD cost type, and SD bid optimization.
- [x] Ensure every automatic change has `before_json`, `after_json`, `entity_level`, `field_name`, `source`, `dedupe_key`, and linked entities.
- [x] Ensure repeated snapshots do not create duplicate logbook rows.
- [x] Write snapshot runs to `ads_settings_snapshot_runs`.
- [x] Write status rows to `report_data_status` where applicable.
- [x] Run standard checks.
- [x] Update this plan checklist and `out/v3_build_progress.md`.
- [x] Write `out/v3_phase_reports/phase_03_ads_settings_logbook.md`.
- [x] Stop and report to Albert. Do not continue to Phase 4.

## Phase 3 done criteria

Phase 3 is done only when SP, SB, and SD current settings can be captured and real changes can be logged automatically without duplicates.

---

# Phase 4 — SP/SB/SD Ads Performance Reports

## What this phase is

This phase builds API-first ingestion and backfill for all ads performance report tables.

## What the system can do after this phase

After this phase, the system has SP, SB, and SD performance data in Supabase, with derived metrics and data finality tracking.

## Build order

SP:

1. `sp_campaign_hourly_fact_gold`
2. `sp_placement_daily_fact`
3. `sp_targeting_daily_fact`
4. `sp_stis_daily_fact`
5. `sp_advertised_product_daily_fact`

SB:

6. `sb_campaign_daily_fact_gold`
7. `sb_campaign_placement_daily_fact`
8. `sb_keyword_daily_fact`
9. `sb_stis_daily_fact`
10. `sb_attributed_purchases_daily_fact`

SD:

11. `sd_campaign_daily_fact_gold`
12. `sd_advertised_product_daily_fact`
13. `sd_targeting_daily_fact`
14. `sd_matched_target_daily_fact`
15. `sd_purchased_product_daily_fact`

## Checklist for each table

Codex must complete this checklist for one table before moving to the next table.

- [ ] Verify table exists or create/alter migration.
- [ ] Verify natural key.
- [ ] Build or fix API puller.
- [ ] Build or verify manual upload fallback.
- [ ] Pull one date/hour sample.
- [ ] Insert/upsert sample.
- [ ] Calculate missing metrics.
- [ ] Validate no duplicate natural keys.
- [ ] Validate no negative metric values.
- [ ] Validate derived metrics.
- [ ] Backfill missing historical data using maximum available history from Amazon.
- [ ] Refresh latest 7–30 days.
- [ ] Write `api_sync_runs`, `report_data_status`, and `data_quality_checks`.
- [ ] Mark this table complete in `out/v3_build_progress.md`.

## Phase checklist

- [x] Complete SP table 1.
- [x] Complete SP table 2. Quality warning: 4 placement rows have negative impressions from source data.
- [x] Complete SP table 3.
- [x] Complete SP table 4.
- [x] Complete SP table 5. Quality warning: existing exact duplicate natural-key rows prevent a unique index; non-unique natural-key lookup index added.
- [x] Complete SB table 1.
- [x] Complete SB table 2.
- [x] Complete SB table 3.
- [x] Complete SB table 4.
- [x] Complete SB table 5.
- [x] Complete SD table 1.
- [x] Complete SD table 2.
- [x] Complete SD table 3. Blocked as zero-row source report content after rerun.
- [x] Complete SD table 4. Blocked as zero-row source report content after rerun.
- [x] Complete SD table 5. Blocked as zero-row source report content after rerun.
- [x] Run standard checks.
- [x] Update this plan checklist and `out/v3_build_progress.md`.
- [x] Write `out/v3_phase_reports/phase_04_ads_performance.md`.
- [x] Stop and report to Albert. Do not continue to Phase 5.

## Phase 4 done criteria

Phase 4 is done only when all listed ads performance tables are populated/backfilled or documented as blocked by Amazon permission/report availability.

---

# Phase 5 — SQP Weekly and Monthly

## What this phase is

This phase completes Search Query Performance data.

## What the system can do after this phase

After this phase, the system has weekly and monthly SQP query-funnel data in Supabase, including impressions, clicks, cart adds, purchases, share metrics, and query volume.

## Tables

- `sqp_weekly_raw`
- `sqp_monthly_raw`

## Checklist

- [x] Verify or create `sqp_monthly_raw`.
- [x] Verify weekly SQP importer.
- [x] Build SP-API SQP puller where API permission exists.
- [x] Keep manual upload fallback.
- [x] Pull one weekly sample.
- [x] Validate weekly boundaries.
- [x] Backfill weekly SQP to maximum available history or until Amazon returns unavailable.
- [x] Pull one monthly sample.
- [x] Validate monthly boundaries.
- [x] Backfill monthly SQP to maximum available history.
- [x] Refresh latest 4 weeks and latest 2 months.
- [x] Validate no duplicate query/period keys.
- [x] Write sync/status/check rows.
- [x] Run standard checks. Build/test passed; Supabase CLI migration list and dump were externally blocked.
- [x] Update this plan checklist and `out/v3_build_progress.md`.
- [x] Write `out/v3_phase_reports/phase_05_sqp.md`.
- [x] Stop and report to Albert. Do not continue to Phase 6.

## Phase 5 done criteria

Phase 5 is done only when weekly and monthly SQP sample pulls, inserts, validations, and backfills pass.

---

# Phase 6 — Helium 10 Keyword Ranking

## What this phase is

This phase keeps Helium 10 keyword ranking manual-upload only until automation is available.

## What the system can do after this phase

After this phase, the system can import H10 keyword ranking uploads into Supabase and expose organic/sponsored rank history for analysis.

## Table

- `h10_keyword_tracker_raw`

## Checklist

- [ ] Inspect existing H10 importer.
- [ ] Confirm required columns and natural key.
- [ ] Parse organic rank into `organic_rank_value` and `organic_rank_kind`.
- [ ] Parse sponsored rank into `sponsored_pos_value` and `sponsored_pos_kind`.
- [ ] Add duplicate protection.
- [ ] Import one sample if available.
- [ ] Validate no duplicate `account_id + marketplace + asin + keyword_norm + observed_date`.
- [ ] Write upload/import status.
- [ ] Run standard checks.
- [ ] Update this plan checklist and `out/v3_build_progress.md`.
- [ ] Write `out/v3_phase_reports/phase_06_h10.md`.
- [ ] Stop and report to Albert. Do not continue to Phase 7.

## Phase 6 done criteria

Phase 6 is done only when H10 manual upload import is stable and validated.

---

# Phase 7 — Manual Non-Ads Logbook

## What this phase is

This phase adds simple manual logging for product/listing changes that are not ads changes.

## What the system can do after this phase

After this phase, Albert can manually record listing/product changes such as title, bullets, images, review count, rating, A+, price, coupon, inventory notes, competitor notes, expected outcome, actual outcome, learning, and notes.

## Tables

- `log_changes`
- `log_change_entities`
- `change_outcome_evaluations`

## Checklist

- [ ] Verify existing `log_changes` structure.
- [ ] Add missing non-ads logbook fields only if needed.
- [ ] Create `change_outcome_evaluations` if missing.
- [ ] Build minimal UI or CLI form for manual non-ads entries.
- [ ] Do not build a dashboard.
- [ ] Manual entry must support product/ASIN/SKU linking.
- [ ] Manual entry must support why, reasoning, expected outcome, evaluation window, actual result, learning, and notes.
- [ ] Evaluation can be added later without modifying the original change row.
- [ ] Insert one test manual entry if safe.
- [ ] Validate linked entity row exists.
- [ ] Run standard checks.
- [ ] Update this plan checklist and `out/v3_build_progress.md`.
- [ ] Write `out/v3_phase_reports/phase_07_non_ads_logbook.md`.
- [ ] Stop and report to Albert. Do not continue to Phase 8.

## Phase 7 done criteria

Phase 7 is done only when a non-ads change can be manually recorded and evaluated later.

---

# Phase 8 — MCP Views and Cleanup

## What this phase is

This phase creates clean read-only MCP views and removes unrelated/deprecated tables only after backup and dependency checks.

## What the system can do after this phase

After this phase, Codex, Claude Code, Claude Co work, and other MCP clients can read clean analysis-ready data from Supabase. The database is lighter and unrelated old system tables are removed only if safe.

## MCP views to create

- `v_mcp_sales_traffic_daily`
- `v_mcp_ads_current_settings`
- `v_mcp_ads_performance_daily`
- `v_mcp_ads_performance_hourly`
- `v_mcp_sqp_weekly`
- `v_mcp_sqp_monthly`
- `v_mcp_h10_keyword_rankings`
- `v_mcp_ads_change_logbook`
- `v_mcp_non_ads_change_logbook`
- `v_mcp_data_freshness`

## Cleanup candidate tables

Codex must verify live dependencies before dropping any table. These are candidates, not automatic drops.

Raw duplicate report tables:

- `sp_campaign_daily_raw`
- `sp_placement_daily_raw`
- `sp_targeting_daily_raw`
- `sp_stis_daily_raw`
- `sb_campaign_daily_raw`
- `sb_campaign_placement_daily_raw`
- `sb_keyword_daily_raw`
- `sb_stis_daily_raw`
- `sd_campaign_daily_raw`
- `sd_advertised_product_daily_raw`
- `sd_targeting_daily_raw`
- `sd_matched_target_daily_raw`
- `sd_purchased_product_daily_raw`
- `si_sales_trend_daily_raw`

Duplicate/legacy fact tables:

- `sp_campaign_hourly_fact`
- `sb_campaign_daily_fact`
- `sd_campaign_daily_fact`
- `sp_placement_modifier_change_log`

Product/profile/keyword extras:

- `product_cost_history`
- `product_profile`
- `keyword_group_sets`
- `keyword_groups`
- `keyword_group_members`
- `ui_page_settings`

Experiment/UI/optimizer tables:

- `log_experiments`
- `log_experiment_changes`
- `log_evaluations`
- `log_experiment_phases`
- `log_experiment_events`
- `log_product_kiv_items`
- `log_driver_campaign_intents`
- `ads_change_sets`
- `ads_objective_presets`
- `ads_change_set_items`
- `ads_optimizer_rule_packs`
- `ads_optimizer_rule_pack_versions`
- `ads_optimizer_product_settings`
- `ads_optimizer_manual_overrides`
- `ads_optimizer_runs`
- `ads_optimizer_product_snapshot`
- `ads_optimizer_target_snapshot`
- `ads_optimizer_recommendation_snapshot`
- `ads_optimizer_role_transition_log`
- `ads_optimizer_recommendation_overrides`

## Checklist

- [ ] Create backup schema dump before cleanup.
- [ ] Create MCP views.
- [ ] Confirm MCP views return useful rows or valid empty results.
- [ ] Confirm MCP views do not expose secrets.
- [ ] Confirm MCP views do not depend on cleanup candidate tables.
- [ ] Generate dependency report for every cleanup candidate table.
- [ ] Generate row-count report for every cleanup candidate table.
- [ ] Generate backup/export for cleanup candidate tables.
- [ ] Drop only tables that are proven safe to drop.
- [ ] Do not drop tables with live dependencies or unclear purpose.
- [ ] Run standard checks.
- [ ] Update this plan checklist and `out/v3_build_progress.md`.
- [ ] Write `out/v3_phase_reports/phase_08_mcp_cleanup.md`.
- [ ] Stop and report to Albert.

## Phase 8 done criteria

Phase 8 is done only when MCP views work, cleanup is backed up, and no active dependency is broken.

---

# Final Completion Criteria

The full build is complete only when:

- API-first ingestion works for all available Amazon API sources.
- Manual fallback works where API is unavailable.
- Sales & Traffic is backfilled.
- Current ads settings snapshots work.
- Ads changes are automatically logged.
- SP/SB/SD ads reports are backfilled or documented as blocked by permissions.
- SQP weekly/monthly is backfilled or documented as blocked by permissions.
- H10 manual upload works.
- Manual non-ads logbook works.
- MCP views exist and are readable.
- Deprecated tables are either removed safely or documented as retained.
- All final validation checks pass.
