# Phase 5 — SQP Weekly and Monthly

## Objective

Complete Search Query Performance storage for weekly and monthly query-funnel data in Supabase.

## Files changed

- `supabase/migrations/20260426173000_v3_sqp_monthly_raw.sql`
- `src/sqp/parseSqpReport.ts`
- `src/ingest/ingestSqpWeeklyRaw.ts`
- `src/ingest/ingestSqpMonthlyRaw.ts`
- `src/cli/ingestSqpWeeklyDate.ts`
- `src/cli/ingestSqpMonthly.ts`
- `src/connectors/sp-api/firstSqpRealPull.ts`
- `src/connectors/sp-api/sqpMonthlyRealPullCli.ts`
- `src/connectors/sp-api/types.ts`
- `package.json`
- `test/parseSqpReport.test.ts`
- `test/v3SqpMonthlyMigration.test.ts`
- `docs/schema_snapshot.md`
- `docs/v3_database_only_build_plan.md`
- `out/v3_build_progress.md`
- `out/v3_schema_inventory.md`
- `out/v3_table_counts.md`
- `out/v3_schema_after_phase.sql`

## Migrations

- Created and applied `20260426173000_v3_sqp_monthly_raw.sql`.
- Added `sqp_monthly_raw`.
- Added `sqp_monthly_latest`.
- Added `sqp_monthly_latest_enriched`.

## Sources used

- Existing manual weekly SQP CSVs under `/mnt/d/Dropbox/AmazonReports`.
- SP-API `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT` weekly pull.
- SP-API `GET_BRAND_ANALYTICS_SEARCH_QUERY_PERFORMANCE_REPORT` monthly pull.

## Backfill and refresh

- Weekly manual history was already populated and rerun through the Dropbox backfill pipeline.
- Weekly SP-API sample refresh succeeded for ASIN `B0FYPRWPN1`, `2026-04-12` through `2026-04-18`, report `489161020569`, 62 rows.
- Monthly SP-API backfill succeeded for ASIN `B0FYPRWPN1`:
  - `2025-12-01` through `2025-12-31`, report `489169020569`, 4 rows.
  - `2026-01-01` through `2026-01-31`, report `489166020569`, 100 rows.
  - `2026-02-01` through `2026-02-28`, report `489164020569`, 100 rows.
  - `2026-03-01` through `2026-03-31`, report `489163020569`, 100 rows.
- November 2025 monthly returned an artifact without `dataByAsin` rows, so the monthly history boundary for this ASIN is documented at December 2025.

## Validation results

- `sqp_weekly_raw`: 38,154 total rows; `sourbear`/`US` coverage `2025-06-28` through `2026-04-18`.
- `sqp_monthly_raw`: 304 total rows; `sourbear`/`US` coverage `2025-12-31` through `2026-03-31`.
- Duplicate weekly natural keys: 0.
- Duplicate monthly natural keys: 0.
- Weekly negative metric rows: 0.
- Monthly negative metric rows: 0.
- Weekly period boundary failures: 0.
- Monthly period boundary failures: 0.
- Wrote Phase 5 rows to `api_sync_runs`, `report_data_status`, and `data_quality_checks`.

## Commands run

- `npm run pipeline:backfill:sqp -- --account-id sourbear --marketplace US --root /mnt/d/Dropbox/AmazonReports --from 2025-08-11 --to 2026-04-07 --continue-on-error`
- `npm run spapi:sqp-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2026-04-12 --end-date 2026-04-18 --max-attempts 60 --poll-interval-ms 5000`
- `npm run spapi:sqp-monthly-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2026-03-01 --end-date 2026-03-31 --max-attempts 60 --poll-interval-ms 5000`
- `npm run spapi:sqp-monthly-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2026-02-01 --end-date 2026-02-28 --max-attempts 60 --poll-interval-ms 5000`
- `npm run spapi:sqp-monthly-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2026-01-01 --end-date 2026-01-31 --max-attempts 120 --poll-interval-ms 5000`
- `npm run spapi:sqp-monthly-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2025-12-01 --end-date 2025-12-31 --max-attempts 120 --poll-interval-ms 5000`
- `npm run schema:snapshot`
- `npm run build`
- `npm test`
- `git diff --check`

## Errors fixed

- Fixed `ingestSqpWeeklyDate.ts` so importing it from the weekly backfill pipeline no longer runs the CLI `main()`.
- Fixed monthly SQP CLI environment handoff so `APP_ACCOUNT_ID` and `APP_MARKETPLACE` reach the monthly parse/ingest hook.
- Corrected Phase 5 control-row writes to use the actual control-layer columns and JSON warning array shape.

## External blockers

- `supabase migration list` failed because the Supabase CLI temp login role could not authenticate and eventually hit a temporary circuit breaker.
- `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql` failed because the Supabase CLI requires Docker for the dump path and Docker is unavailable in this WSL environment.
- Direct `pg_dump` fallback was also blocked while the Supabase pooler circuit breaker was active.

## System capability after Phase 5

The database now stores SQP weekly and monthly query-funnel data, supports manual weekly/monthly artifact ingestion paths, supports SP-API weekly/monthly SQP pulls where Amazon grants access, and has validation/status rows for SQP freshness and quality.

## Next recommended phase

Phase 6 — Helium 10 keyword ranking manual upload validation and stabilization.
