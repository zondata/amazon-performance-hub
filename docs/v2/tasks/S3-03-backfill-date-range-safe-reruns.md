# S3-03 — Implement backfill by date range and safe reruns

## Objective
Implement the next bounded Stage 3 ingestion-backbone step by adding a generic backfill-by-date-range path on top of the existing Stage 3 job runner, with deterministic slicing, safe rerun behavior, and no live Amazon connector execution, scheduler, UI, marts, or warehouse writes.

## Why this task now
`S3-02` is complete in the repo status, and the status file explicitly names the single next bounded build task as `S3-03 - Implement backfill by date range and safe reruns`.

## Scope
Build only a generic backfill planning and execution boundary that:
- accepts a bounded date range
- splits the range into deterministic slices
- submits or reuses ingestion jobs through the existing Stage 3 generic job runner
- prevents unsafe duplicate reruns
- supports safe rerun behavior for failed or incomplete slices
- uses stub executor paths only
- does not call live Amazon APIs
- does not ingest real business data

This task is backfill-runner infrastructure only.

## Allowed files
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S3-03-backfill-date-range-safe-reruns.md`
- `src/ingestion/*`
- `src/testing/fixtures/*`
- `package.json` only if a bounded task-local command alias is strictly required
- `supabase/migrations/*` only if a minimal follow-up migration is strictly required and cannot be represented safely with existing job metadata
- directly related tests only

## Forbidden changes
Do not change:
- any `apps/web/*` file
- any V1 UI
- any `/v2` page
- any SP-API connector behavior
- any Ads API connector behavior
- Stage 2A or Stage 2B command semantics
- warehouse execution logic
- marts
- memory tables
- diagnosis logic
- scheduling or cron setup
- browser automation
- production secrets
- unrelated refactors

Do not add:
- real source orchestration for SP-API or Ads API jobs
- dashboard/status UI
- S3-04 freshness/finalization modeling beyond the minimum metadata needed for this bounded backfill path
- queue workers
- background daemons
- Amazon writeback paths

## Required design rules

### 1. Generic backfill only
The backfill path must be generic and source-agnostic.

It must operate on a small typed request contract such as:
- `jobKey`
- `sourceName`
- `accountId`
- `marketplace`
- `rangeStart`
- `rangeEnd`
- `sliceUnit`
- `sliceSize`
- `runKind`
- `baseMetadata`

Allowed slice units:
- `day`
- `week`

Do not add month-level or custom-calendar logic in this task.

### 2. Deterministic slicing
Implement deterministic slicing for a bounded date range.

Required rules:
- identical input must always produce identical slice boundaries
- slices must be ordered ascending by window start
- slices must be non-overlapping
- slices must fully cover the requested range
- each slice must produce a deterministic idempotency key derivation

The task may treat the end of the user range as inclusive, but the chosen convention must be explicit and tested.

### 3. Safe rerun behavior
Implement bounded rerun safety rules on top of the existing job runner.

Required rules:
- already successful slices must not create duplicate new jobs when rerun with the same request
- already `requested` or `processing` slices must be reused, not duplicated
- failed slices may be explicitly rerun
- rerun behavior must be deterministic and auditable
- rerun output must clearly separate:
  - `created`
  - `reused_existing`
  - `rerun_failed`
  - `skipped_available`

Do not allow silent duplication of successful slices.

### 4. Backfill plan/result contract
Add typed exports for at least:
- `IngestionBackfillRequest`
- `IngestionBackfillSlice`
- `IngestionBackfillPlan`
- `IngestionBackfillRunResult`
- `IngestionBackfillSliceResult`

Each slice result must expose at minimum:
- slice window
- idempotency key
- job id
- action taken
- final observed job status

### 5. Runner integration only
The backfill path must reuse the existing bounded Stage 3 job runner rather than bypassing it.

Required rules:
- all slice submissions go through the runner boundary
- safe reruns depend on the same idempotency/job-state rules introduced in `S3-02`
- watermark changes remain success-only and continue to flow through the runner path

### 6. Stub executor only
The backfill proof must use only the stub executor or fixture executor path.
Do not wire any live connector execution.

## Required implementation pieces

### A. Backfill planning module
Add one bounded module under `src/ingestion/*` that:
- validates the backfill request
- builds the deterministic slice plan
- derives idempotency keys per slice

Validation must reject at minimum:
- missing dates
- end before start
- unsupported slice unit
- zero or negative slice size

### B. Backfill execution module
Add one bounded execution path that:
- iterates the deterministic slice plan
- submits each slice through the existing runner
- returns a structured summary of actions taken
- supports one explicit rerun mode for failed slices only

Allowed rerun modes:
- `none`
- `failed_only`

Do not add broad retry policies in this task.

### C. Task-local CLI proof path
Add one bounded CLI or extend a task-local Stage 3 CLI to prove:
- one backfill success path
- one backfill rerun path

The CLI must print a safe deterministic summary and no secrets.

### D. Minimal persistence/state follow-up
Only if strictly required, add the smallest bounded state extension needed to keep rerun decisions explicit and testable.
Prefer using existing job metadata and current runner outputs.
Do not widen schema casually.

## Required tests
Add bounded tests for all of the following:
1. deterministic slicing for a day-based range
2. deterministic slicing for a week-based range
3. invalid range validation failure
4. invalid slice unit failure
5. repeated identical backfill request reuses existing successful slices
6. in-flight slices are reused instead of duplicated
7. failed slices are rerun only when explicit rerun mode allows it
8. successful slices are skipped or reused on rerun, not duplicated
9. backfill path routes all work through the existing job runner
10. CLI summary is deterministic and safe

Use the smallest possible surface. Prefer unit tests plus narrow integration-style tests around the runner/backfill interaction.

## Acceptance checks
The task is complete only if all of the following are true:
1. A bounded generic backfill-by-date-range path exists under `src/ingestion/*`.
2. Date ranges are split deterministically into non-overlapping ascending slices.
3. Slice submissions reuse the existing Stage 3 job runner.
4. Safe reruns do not duplicate successful slices.
5. Failed slices can be rerun only through an explicit bounded path.
6. Backfill outputs clearly show action taken per slice.
7. A task-local stub-only proof path exists.
8. No live Amazon connector call is added.
9. No UI, scheduler, or warehouse execution logic is added.
10. `docs/v2/BUILD_STATUS.md` is updated for `S3-03`.

## Required commands
Run all of these in WSL if available:
1. `npm test`
2. `npm run web:lint`
3. `npm run web:build`
4. `node scripts/v2-progress.mjs --write`

If a task-local CLI is added or extended, run:
- one success backfill scenario
- one rerun scenario with explicit failed-only rerun mode

Record exact commands and outcomes in `docs/v2/BUILD_STATUS.md`.

## MANUAL TEST REQUIRED
1. Open the changed backfill files under `src/ingestion/*`.
2. Confirm the backfill path is generic and does not import or call source-specific Amazon connectors.
3. Confirm the same range request produces the same slice boundaries and idempotency keys.
4. Confirm successful slices are not duplicated on rerun.
5. Confirm failed slices rerun only when explicit rerun mode is enabled.
6. Confirm no `/apps/web` or connector runtime files were changed outside the allowed scope.
7. Confirm `docs/v2/BUILD_STATUS.md` now lists current task `S3-03`.

## Status file update requirements
Update `docs/v2/BUILD_STATUS.md` in the same task with:
- `Last updated`
- `Current task: S3-03 - Implement backfill by date range and safe reruns`
- `Current stage: Stage 3 — ingestion backbone`
- a new task-log row for `S3-03`
- tests actually run
- any manual follow-up still required
- next bounded task: `S3-04 - Model freshness_state, collection_state, finalization_state, source_confidence`

## Commit scope rule
Stage and commit only:
- the canonical tracked task spec under `docs/v2/tasks/`
- bounded `src/ingestion/*` backfill files
- directly related tests
- minimal migration follow-up only if strictly required
- required status/progress files

Do not stage scratch spec drafts outside `docs/v2/tasks/`.
