# Phase 0 Baseline Report

Generated: 2026-04-26T18:47:08+08:00

## Phase Objective

Verify the WSL worktree, GitHub branch, linked Supabase project, current schema inventory, migration health, and baseline checks for the V3 database-only build. Phase 0 did not apply remote schema changes, drop tables, or build API pullers.

## Files Changed

- `docs/v3_database_only_build_plan.md`
- `supabase/migrations/014_latest_tiebreak.sql`
- `supabase/migrations/006a_sp_placement_raw_norm.sql` deleted
- `supabase/migrations/006b_sp_placement_latest_norm.sql` deleted
- `apps/web/package.json`
- `apps/web/package-lock.json`
- `src/connectors/ads-api/campaignIngestGate.test.ts`
- `src/connectors/ads-api/targetIngestGate.test.ts`
- `src/connectors/sp-api/firstSearchTermsRealPull.test.ts`
- `src/connectors/sp-api/firstSqpRealPull.test.ts`
- `src/warehouse/retailSalesTrafficTruth.test.ts`
- `test/shims/server-only.ts`
- `vitest.config.ts`
- `out/v3_live_schema_phase0.sql`
- `out/v3_schema_after_phase.sql`
- `out/v3_schema_inventory.md`
- `out/v3_table_counts.md`
- `out/v3_cleanup_candidates.md`
- `out/v3_build_progress.md`
- `out/v3_phase_reports/phase_00_baseline.md`

## Migrations Created Or Changed

- Changed `supabase/migrations/014_latest_tiebreak.sql` so local reset/migration validation creates and backfills `sp_placement_daily_raw.placement_raw_norm` before any latest views partition by that column.
- Deleted skipped duplicate migration files with invalid Supabase names:
  - `supabase/migrations/006a_sp_placement_raw_norm.sql`
  - `supabase/migrations/006b_sp_placement_latest_norm.sql`

No remote/cloud Supabase schema changes were applied.

## Tables Created Or Changed

No live tables were created, altered, or dropped. The only schema change is a local migration-file correction for future local resets.

## API/Manual Sources Used

- Supabase project connector metadata for public schema inventory and row estimates.
- Supabase CLI for project/migration checks where available.
- No Amazon API pullers or manual Amazon data imports were run.

## Backfill Date Range

Not applicable for Phase 0.

## Validation Commands And Results

| Command | Result |
| --- | --- |
| `pwd` | Passed: `/home/albert/code/amazon-performance-hub-v3`. |
| `git branch --show-current` | Passed: `v3/database-only`. |
| `git remote -v` | Passed: origin is `https://github.com/zondata/amazon-performance-hub.git`. |
| `git status --short` before edits | Documented: modified `.codex/config.toml`, untracked duplicate plan file. |
| `gh auth status` | Passed: logged in to GitHub as `zondata`. |
| `supabase --version` | Passed: `2.75.0`. |
| `cat supabase/.temp/project-ref` | Passed: `aghtxbvgcazlowpujtjk`. |
| `supabase migration list` before fix | Passed with warnings for skipped invalid files `006a...` and `006b...`. |
| `supabase migration list` after fix | Passed once with no invalid filename warnings. Remote is applied through `20260215170000`; later local migrations are unapplied remotely. |
| `supabase start` | Blocked: Docker daemon unavailable at `/var/run/docker.sock`. |
| `supabase db dump --schema public --data-only=false --file out/v3_live_schema_phase0.sql` | Blocked: Supabase CLI temp-role auth failures/circuit breaker. |
| `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql` | Blocked: Docker daemon unavailable for dump tooling. |
| `npm ci` | Passed after installing root dependencies. |
| `npm --prefix apps/web ci --cache /tmp/npm-cache` | Passed after using writable npm cache. |
| `npm --prefix apps/web install server-only --cache /tmp/npm-cache` | Passed; added missing declared web dependency used by server modules. |
| `npm run build` | Passed. |
| `npm test` | Passed: 240 test files, 991 tests. |

## Errors Found And Fixed

- Missing expected plan path: `docs/v3_database_only_build_plan.md` did not exist. Fixed by creating it from the provided V3 build plan and removing the duplicate untracked draft path.
- Invalid local migration filenames: `006a_sp_placement_raw_norm.sql` and `006b_sp_placement_latest_norm.sql` were skipped by Supabase CLI. Fixed by deleting the skipped duplicate files.
- Local migration ordering blocker: `014_latest_tiebreak.sql` referenced `placement_raw_norm` before a valid local migration guaranteed the column. Fixed by making `014_latest_tiebreak.sql` self-contained for the column, unique constraint, and supporting index.
- Root dependencies missing: `tsc` and `vitest` were unavailable. Fixed with `npm ci`.
- Web dependencies missing for root Vitest imports. Fixed by installing web dependencies with a writable `/tmp` npm cache.
- `server-only` imports failed in Vitest. Fixed by adding the missing web dependency and aliasing `server-only` to a test shim in `vitest.config.ts`.
- Narrow TypeScript test expectation issues failed `tsc`. Fixed by replacing unsupported matcher type arguments with `satisfies`-checked expected objects and preserving literal return types in two mock implementations.

## External Blockers

- Docker is not running or not reachable from WSL, so `supabase start` and one dump path cannot run locally.
- Supabase CLI temp-role authentication failed and triggered a remote pooler auth circuit breaker on repeat dump/migration-list attempts. Earlier `supabase migration list` succeeded, and schema/count inventory was completed through the Supabase project connector.
- Npm audit reports vulnerabilities in installed dependency trees. No `npm audit fix` was run because that can introduce dependency changes outside Phase 0 scope.

## What The System Can Now Do

Albert has a documented Phase 0 database baseline: current public table inventory, row-count estimates, cleanup candidates, migration state, and known external blockers. The local repo now has a safer migration sequence for local resets around `placement_raw_norm`, and standard TypeScript/Vitest checks pass.

## Next Recommended Phase

Phase 1 is the Database Control Layer. It will create or verify control tables for API/manual connections, sync runs, cursors, data freshness/finality status, and validation checks. It must not start until Albert explicitly approves continuing to Phase 1.
