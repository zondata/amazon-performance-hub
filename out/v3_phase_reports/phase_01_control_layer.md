# Phase 1 Control Layer Report

Generated: 2026-04-26T18:56:17+08:00

Updated: 2026-04-26T19:07:12+08:00

## Phase Objective

Add the V3 database control layer for API/manual connections, sync runs, cursors, ads settings snapshot runs, report freshness/finality, and data quality checks.

## Files Changed

- `docs/v3_database_only_build_plan.md`
- `out/v3_build_progress.md`
- `out/v3_phase_reports/phase_01_control_layer.md`
- `supabase/migrations/20260426110000_v3_database_control_layer.sql`
- `test/v3DatabaseControlLayerMigration.test.ts`
- `out/v3_schema_after_phase.sql`

## Migrations Created Or Changed

- Created `supabase/migrations/20260426110000_v3_database_control_layer.sql`.

The migration is idempotent and creates only missing Phase 1 control tables. It was applied to linked Supabase project `aghtxbvgcazlowpujtjk` through the Supabase connector after local code checks passed.

## Tables Created Or Changed

The migration created these tables remotely:

- `api_connections`
- `api_sync_runs`
- `api_sync_cursors`
- `ads_settings_snapshot_runs`
- `report_data_status`
- `data_quality_checks`

No tables were dropped.

## API/Manual Sources Used

- Local schema snapshot: `docs/schema_snapshot.md`.
- Local migration inspection.
- No Amazon API pullers were built or run.
- No manual Amazon upload/import was run.

## Backfill Date Range

Not applicable for Phase 1.

## Validation Commands And Results

| Command | Result |
| --- | --- |
| `git status --short --branch` | Confirmed branch `v3/database-only`; existing unstaged `.codex/config.toml` remains. |
| `test -f docs/schema_snapshot.md` | Passed; local snapshot exists. |
| `rg ... api_connections...` | Confirmed the six V3 Phase 1 table names were not already present in migrations/code. |
| `npm run build` | Passed. |
| `npm test -- test/v3DatabaseControlLayerMigration.test.ts` | Passed: 5 tests. |
| `npm test` | Passed: 241 test files, 996 tests. |
| Supabase connector pre-check | Passed: the six Phase 1 tables were absent before apply. |
| Supabase connector apply migration | Passed: `v3_database_control_layer` applied successfully. |
| Supabase connector table verification | Passed: all six Phase 1 tables exist remotely. |
| Supabase connector catalog verification | Passed: constraints and indexes were returned for the Phase 1 tables. |
| Supabase connector smoke insert | Passed: inserted one manual connection, sync run, cursor, report status row, and data quality check. |
| Supabase connector row counts | Passed: one smoke row each in `api_connections`, `api_sync_runs`, `api_sync_cursors`, `report_data_status`, and `data_quality_checks`; zero rows in `ads_settings_snapshot_runs`. |
| `supabase start` | Blocked: Docker daemon unavailable at `/var/run/docker.sock`. |
| `supabase migration list` | Blocked on repeat by Supabase CLI temp-role auth failure and pooler circuit breaker. |
| `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql` | Blocked: Docker daemon unavailable for dump tooling. |

## Errors Found And How They Were Fixed

- Existing V2 ingestion observability tables (`ingestion_jobs`, `source_watermarks`) do not satisfy the explicit V3 Phase 1 table names. Fixed by adding and applying a dedicated V3 control-layer migration.
- The migration avoids storing direct API secrets by using `auth_secret_ref` rather than token/password columns, with a guardrail check against obvious inline secret assignment patterns.
- Added a migration contract test to ensure the required tables, indexes, `data_status` convention, secret-reference pattern, and data-quality helper remain present.

## External Blockers

- Docker is unavailable, so local Supabase validation cannot run.
- Supabase CLI temp-role authentication is failing and hitting a remote pooler auth circuit breaker on `supabase migration list`.
- Smoke rows remain in the Phase 1 control tables because the cleanup DELETE was blocked pending explicit destructive-action approval.

## What The System Can Now Do

The database can now record API/manual connections, sync runs, cursors, ads settings snapshot runs, report data status, and validation checks.

## Next Recommended Phase

Phase 2 will build Amazon Sales & Traffic ingestion. Before Phase 2, decide whether to keep or delete the Phase 1 smoke rows.
