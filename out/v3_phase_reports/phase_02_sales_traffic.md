# Phase 2 Report - Amazon Sales & Traffic

Generated: 2026-04-26T20:00:00+08:00

Project: `aghtxbvgcazlowpujtjk`

## Objective

Create the V3 canonical Amazon Sales & Traffic table, backfill any safe existing SP-API warehouse data, validate the facts layer contract, and document blockers for live Amazon pull/backfill work.

## Work Completed

- Inspected existing SP-API Sales & Traffic code paths:
  - `src/connectors/sp-api/firstReportRequest.ts`
  - `src/ingestion/firstSalesTrafficRetailIngest.ts`
  - `src/ingestion/firstSalesTrafficRetailIngestCli.ts`
  - `src/warehouse/firstSalesTrafficWarehouseWrite.ts`
- Added migration `supabase/migrations/20260426123000_v3_amazon_sales_traffic_timeseries.sql`.
- Created canonical table `public.amazon_sales_traffic_timeseries`.
- Created MCP-friendly view `public.amazon_sales_traffic_timeseries_latest`.
- Backfilled existing proven SP-API warehouse rows from:
  - `public.spapi_sales_and_traffic_by_date_report_rows`
  - `public.spapi_sales_and_traffic_by_asin_report_rows`
- Ran `npm run schema:snapshot` successfully by exporting env from `/home/albert/code/amazon-performance-hub/.env.local`.
- Ran a real one-day SP-API sample pull for `GET_SALES_AND_TRAFFIC_REPORT`.
- Downloaded, parsed, and ingested live report `489144020569`.
- Retried the latest 30-day SP-API refresh until Amazon accepted it.
- Downloaded, parsed, and ingested latest refresh report `489147020569`.
- Retried the maximum-history SP-API backfill until Amazon accepted it.
- Downloaded, parsed, and ingested max-history report `489150020569`.
- Refreshed the V3 canonical table from the updated SP-API warehouse rows.
- Wrote Phase 2 operational metadata:
  - four `api_sync_runs` rows
  - four `report_data_status` rows
  - twenty total passing `data_quality_checks`
- Added migration contract tests in `test/v3SalesTrafficMigration.test.ts`.

## Remote Data Result

- Canonical row count: `771`.
- Coverage: `2024-04-27` through `2026-04-25`.
- Date-grain rows: `759`.
- ASIN-grain rows: `12`.
- Live sample report id: `489144020569`.
- Live sample source rows: 1 by-date row and 2 by-ASIN rows.
- Latest refresh report id: `489147020569`.
- Latest refresh source rows: 29 by-date rows and 2 by-ASIN rows.
- Max-history report id: `489150020569`.
- Max-history source rows: 728 by-date rows and 6 by-ASIN rows.
- Rows linked to max-history sync run: `734`.
- Max-history sync run id: `4e32db7f-e0b2-4e0d-8a4c-b2017a7399c5`.
- Rows linked to latest refresh sync run: `31`.
- Latest refresh sync run id: `be9dbf46-1ebd-4cee-8a4e-17fcd09fe469`.
- Latest live sample sync run id: `1c03395b-7fc6-4cb9-9f3a-baf41490357b`.
- Initial Phase 2 backfill sync run id: `98304a6b-a58c-409f-961d-8f64a74779a4`.
- `report_data_status` status: `preliminary`, `is_final = false`, `warning_count = 0`.

## Validation

- Duplicate natural keys: `0`.
- Negative metric rows: `0`.
- Missing required identity/status fields: `0`.
- Derived metric mismatch rows: `0`.
- Max-history data quality checks written and passing:
  - `row_count_positive`
  - `duplicate_natural_keys`
  - `negative_numeric_metrics`
  - `required_identity_status_fields`
  - `derived_metric_accuracy`

## Commands Run

- `npm run schema:snapshot`
- `npm run spapi:first-report-request -- --start-date 2026-04-12 --end-date 2026-04-12`
- `npm run spapi:poll-first-report -- --report-id 489144020569 --max-attempts 30 --poll-interval-ms 10000`
- `npm run spapi:get-first-report-document -- --report-id 489144020569`
- `npm run spapi:parse-first-report -- --report-id 489144020569`
- `npm run spapi:ingest-sales-traffic-retail -- --account-id sourbear --marketplace US --start-date 2026-04-12 --end-date 2026-04-12 --report-id 489144020569 --ensure-schema`
- `npm run spapi:first-report-request -- --start-date 2026-03-27 --end-date 2026-04-25`
- `npm run spapi:poll-first-report -- --report-id 489147020569 --max-attempts 60 --poll-interval-ms 10000`
- `npm run spapi:get-first-report-document -- --report-id 489147020569`
- `npm run spapi:parse-first-report -- --report-id 489147020569`
- `npm run spapi:ingest-sales-traffic-retail -- --account-id sourbear --marketplace US --start-date 2026-03-27 --end-date 2026-04-25 --report-id 489147020569 --ensure-schema`
- `npm run spapi:first-report-request -- --start-date 2024-04-27 --end-date 2026-04-25`
- `npm run spapi:poll-first-report -- --report-id 489150020569 --max-attempts 90 --poll-interval-ms 10000`
- `npm run spapi:get-first-report-document -- --report-id 489150020569`
- `npm run spapi:parse-first-report -- --report-id 489150020569`
- `npm run spapi:ingest-sales-traffic-retail -- --account-id sourbear --marketplace US --start-date 2024-04-27 --end-date 2026-04-25 --report-id 489150020569 --ensure-schema`
- `npm run build`
- `npm test -- test/v3SalesTrafficMigration.test.ts test/v3DatabaseControlLayerMigration.test.ts`
- `npm test`
- Supabase connector SQL metadata and validation queries against project `aghtxbvgcazlowpujtjk`.
- Supabase connector migration apply for `20260426123000_v3_amazon_sales_traffic_timeseries.sql`.

## Errors Fixed

- Initial remote migration apply failed because existing by-date source rows had duplicate natural keys, causing `ON CONFLICT DO UPDATE command cannot affect row a second time`.
- Fixed safely by adding deterministic `select distinct on (...)` source selection ordered by `exported_at desc`, `ingested_at desc`, and `report_id desc`.
- Reapplied the migration successfully after verifying the failed apply did not leave the target table behind.
- The first local metadata SQL used stale column names for `api_sync_runs`; corrected it against `docs/schema_snapshot.md` and reran successfully.

## External Blockers

- The env file is available in the parent worktree at `/home/albert/code/amazon-performance-hub/.env.local`, not in this `amazon-performance-hub-v3` worktree root. Commands were run by exporting that env file into the process without copying it.
- A direct shell `source` of the parent env file emitted a malformed-line error because one quoted secret spans or contains shell-sensitive content. Subsequent commands used Node/dotenv parsing instead.
- Latest 30-day refresh request initially failed with Amazon SP-API status `429`, then succeeded on retry with report id `489147020569`.
- Maximum-history request initially failed with Amazon SP-API status `429`, then succeeded on retry attempt 9 with report id `489150020569`.
- Supabase CLI local/dump paths remain blocked by the WSL Docker daemon issue documented in Phase 0.

## What The System Can Do Now

The linked Supabase project now has a canonical Sales & Traffic timeseries table and latest view. Existing, live-sample, latest-refresh, and max-history SP-API retail warehouse rows are normalized into the V3 facts layer with natural-key duplicate protection, generated derived metrics, data status/finality fields, raw JSON retention, and operational status/quality metadata.

## What Phase 3 Will Do

Phase 3 will capture current ads settings from SP/SB/SD bulk snapshots and build the automatic ads setting change logbook.
