# S3-01 — Create ingestion_jobs and source_watermarks schema

## Objective
Create the first Stage 3 schema boundary for ingestion observability by adding database migrations for `ingestion_jobs` and `source_watermarks`, plus the minimum typed schema contract and test coverage needed to define those tables without adding runners, schedulers, UI, marts, warehouse writes, or changing existing Stage 2A and Stage 2B connector behavior.

## Why this task now
- Stage 2B is already complete and green.
- The next bounded repo task after `S2B-G4` is `S3-01`.
- This task starts Stage 3 without widening into job execution logic.

## Scope
Implement only the schema and schema-adjacent contract for:
- `ingestion_jobs`
- `source_watermarks`

This task is schema-first only.

## Allowed files
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S3-01-ingestion-jobs-and-source-watermarks-schema.md`
- `supabase/migrations/*`
- `src/ingestion/*`
- `src/testing/fixtures/*`
- `package.json` only if a test command alias is strictly required for this task
- existing test files directly related to the new schema contract

## Forbidden changes
Do not change:
- any V1 UI
- any `/apps/web/src/app/v2/*` page
- Ads API connector behavior
- SP-API connector behavior
- Stage 2A or Stage 2B command semantics
- warehouse execution logic
- marts
- memory tables
- diagnosis logic
- scheduler or cron setup
- job runner implementation
- retry engine
- backfill engine
- source data ingestion payload shapes
- existing fact-table schemas unless absolutely required for a foreign-key or enum reference and explicitly documented in the task notes

Do not add:
- `S3-02` runner logic
- `S3-03` rerun/backfill logic
- `S3-04` freshness/finalization modeling beyond the minimum columns needed to prepare for later work
- UI for job status
- browser automation
- real secrets in committed files
- broad refactors

## Required outputs

### 1. Supabase migration for `ingestion_jobs`
Create one migration that defines an `ingestion_jobs` table with, at minimum, the following columns:

Required identity and lineage columns:
- `id` UUID primary key
- `job_key` text not null
- `source_name` text not null
- `account_id` text null
- `marketplace` text null

Required request-window and timing columns:
- `requested_at` timestamptz not null default `now()`
- `source_window_start` timestamptz null
- `source_window_end` timestamptz null
- `retrieved_at` timestamptz null
- `started_at` timestamptz null
- `finished_at` timestamptz null

Required state columns:
- `processing_status` text not null
- `run_kind` text not null default `'manual'`
- `idempotency_key` text not null
- `checksum` text null

Required observability columns:
- `row_count` integer null
- `error_code` text null
- `error_message` text null
- `metadata` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

### 2. Supabase migration for `source_watermarks`
In the same migration or a second migration, create `source_watermarks` with, at minimum, the following columns:

Identity columns:
- `id` UUID primary key
- `source_name` text not null
- `account_id` text null
- `marketplace` text null
- `scope_key` text not null default `''`

Watermark columns:
- `last_requested_at` timestamptz null
- `last_available_at` timestamptz null
- `last_success_at` timestamptz null
- `last_job_id` UUID null
- `watermark_start` timestamptz null
- `watermark_end` timestamptz null

State and notes:
- `status` text not null
- `notes` text null
- `metadata` jsonb not null default `'{}'::jsonb`
- `created_at` timestamptz not null default `now()`
- `updated_at` timestamptz not null default `now()`

## Constraints and indexes

### `ingestion_jobs`
Add:
- unique index on `idempotency_key`
- index on `(source_name, requested_at desc)`
- index on `(account_id, marketplace, source_name, requested_at desc)`
- check constraint limiting `processing_status` to:
  - `requested`
  - `processing`
  - `available`
  - `failed`

### `source_watermarks`
Add:
- unique index on `(source_name, coalesce(account_id, ''), coalesce(marketplace, ''), scope_key)`
- index on `(source_name, status)`
- optional foreign key from `last_job_id` to `ingestion_jobs(id)` if that can be added cleanly in the same task

Limit `status` to:
- `unknown`
- `requested`
- `available`
- `failed`

## Updated-at handling
Implement deterministic `updated_at` maintenance for both tables using the repo’s existing migration style. If the repo does not already have a shared trigger helper in the active branch, add the minimum bounded helper needed inside this task’s migration. Do not refactor unrelated tables to use it.

## Typed contract
Add the minimum TypeScript contract under `src/ingestion/*` for the new schema so later Stage 3 work can import stable types without re-reading SQL manually.

Required exports:
- `IngestionProcessingStatus`
- `IngestionRunKind`
- `SourceWatermarkStatus`
- `IngestionJobRecord`
- `SourceWatermarkRecord`

Rules:
- Types must match the migration column names exactly.
- Do not add repositories, services, or runtime write paths in this task.
- The file may include narrow validation helpers only if needed for tests.

## Tests
Add bounded tests that verify:
- allowed status values are the exact expected set
- record types or schema helpers expose the expected fields
- any validation helper rejects unsupported statuses
- any generated SQL fixture or migration assertion used by this task references both tables and the required indexes or constraints

Use the smallest test surface possible. This task is not allowed to add a DB integration harness if one does not already exist.

## Acceptance checks
The task is complete only if all of the following are true:
1. `ingestion_jobs` exists in a committed migration.
2. `source_watermarks` exists in a committed migration.
3. `ingestion_jobs.idempotency_key` is unique.
4. `source_watermarks` has a uniqueness rule that prevents duplicate source/account/marketplace/scope rows.
5. `processing_status` is constrained to `requested | processing | available | failed`.
6. `status` is constrained to `unknown | requested | available | failed`.
7. TypeScript exports exist for the new schema contract.
8. No runner, scheduler, UI, or Stage 3 orchestration logic is added.
9. `docs/v2/BUILD_STATUS.md` is updated for `S3-01`.
10. `docs/v2/TASK_PROGRESS.md` and `docs/v2/TASK_REGISTRY.json` are updated if the repo workflow requires them after task completion.

## Required commands
Run all of these in WSL if they are available in the repo:
1. `npm test`
2. `npm run web:lint`
3. `npm run web:build`
4. `node scripts/v2-progress.mjs --write`

If a command is not runnable or is unrelated, record the exact reason in `docs/v2/BUILD_STATUS.md`.

## MANUAL TEST REQUIRED
1. Open the new migration file.
2. Confirm both tables exist: `ingestion_jobs` and `source_watermarks`.
3. Confirm the unique constraint for `idempotency_key` exists.
4. Confirm the watermark uniqueness rule includes source plus scope identity.
5. Confirm no UI files and no connector runtime files were changed outside the allowed scope.
6. Confirm `docs/v2/BUILD_STATUS.md` now lists current task `S3-01`.

## Status file update requirements
Update `docs/v2/BUILD_STATUS.md` in the same task with:
- `Last updated`
- `Current task: S3-01 - Create ingestion_jobs and source_watermarks schema`
- `Current stage: Stage 3 — ingestion backbone`
- a new task-log row for `S3-01`
- tests actually run
- any manual follow-up still required
- next bounded task: `S3-02 - Implement idempotent job runner with retries and replay`

## Commit scope rule
Stage and commit only:
- the canonical tracked task spec under `docs/v2/tasks/`
- the migration file or files
- the bounded `src/ingestion/*` schema contract files
- any directly related bounded tests
- required status/progress files

Do not stage scratch spec drafts outside `docs/v2/tasks/`.
