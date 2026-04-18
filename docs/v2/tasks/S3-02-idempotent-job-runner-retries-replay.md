# S3-02 — Implement idempotent job runner with retries and replay

## Objective
Implement the first bounded Stage 3 runtime path on top of the new `ingestion_jobs` and `source_watermarks` schema by adding a minimal idempotent job runner contract, persistence path, retry state updates, and replay entrypoint without wiring any real Amazon connector execution, scheduler, UI, marts, or warehouse writes.

## Why this task now
`S3-01` is complete in the repo status, and the status file names `S3-02 - Implement idempotent job runner with retries and replay` as the single next bounded build task. The repo is now in `Stage 3 — ingestion backbone` and this task should build only the job-runner backbone, not Stage 3 dashboard/UI or source-specific ingestion orchestration.

## Scope
Build only a generic Stage 3 ingestion job runner boundary that:
- creates or reuses `ingestion_jobs` records by idempotency key
- transitions `processing_status` deterministically
- supports bounded retry accounting in metadata or explicit runner state
- supports bounded replay of failed jobs by creating a new attempt or rerunning a requested job path
- updates `source_watermarks` only through the runner boundary when a run reaches success
- uses a stub executor or fixture executor only
- does not call live Amazon APIs
- does not ingest real business data

This task is runner-infrastructure only.

## Allowed files
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S3-02-idempotent-job-runner-retries-replay.md`
- `src/ingestion/*`
- `src/testing/fixtures/*`
- `package.json` only if a bounded task-local command alias is strictly required
- `supabase/migrations/*` only if a minimal follow-up migration is strictly required to support bounded runner state and cannot be represented safely with existing `metadata`
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
- S3-03 backfill-by-date-range logic
- S3-04 freshness/finalization modeling beyond the minimum needed to keep runner outputs internally consistent
- queue workers
- background daemons
- Amazon writeback paths

## Required design rules

### 1. Generic runner only
The runner must be generic and source-agnostic.
It must operate on a small typed job request contract such as:
- `jobKey`
- `sourceName`
- `accountId`
- `marketplace`
- `sourceWindowStart`
- `sourceWindowEnd`
- `idempotencyKey`
- `runKind`
- `metadata`

It may include a bounded executor callback or stub-executor registry for tests.

### 2. Idempotency behavior
Implement deterministic behavior for repeated submissions with the same `idempotencyKey`.

Required rules:
- if no existing job exists for the idempotency key, create one with `processing_status = requested`
- if a matching job already exists in `requested`, `processing`, or `available`, do not create a duplicate
- repeated submission must return the existing job identity and a deterministic runner result flag such as:
  - `created`
  - `reused_existing`
  - `replayed`
- failed jobs must not silently duplicate unless the caller explicitly requests replay

### 3. Status transitions
Support this bounded lifecycle:
- `requested`
- `processing`
- `available`
- `failed`

Required transition rules:
- new job starts at `requested`
- runner marks it `processing` before executor work begins
- runner marks it `available` when executor succeeds
- runner marks it `failed` when executor throws or returns a failure result

Disallow invalid transitions in runner logic.

### 4. Retry handling
Implement bounded retry support without adding queue infrastructure.

Required rules:
- retry count must be tracked deterministically, either in a dedicated field added by a minimal migration or inside `metadata`
- failed attempts must capture error code/message and updated timestamps
- runner must expose one bounded retry path for a failed job
- retry path must preserve original idempotency lineage and make the result inspectable

### 5. Replay behavior
Implement one explicit replay entrypoint.

Allowed replay designs:
- create a new job attempt with a new id and metadata linking back to the original failed job, or
- rerun the same job row only if the contract stays deterministic and auditable

Required replay rules:
- replay must be explicit, not automatic
- replay must be allowed only from `failed` or another clearly documented bounded state
- replay must leave a clear audit trail in persisted records or metadata
- replay success must update `source_watermarks`

### 6. Watermark behavior
On successful completion only, update the matching `source_watermarks` row with:
- `last_requested_at`
- `last_available_at`
- `last_success_at`
- `last_job_id`
- `watermark_start`
- `watermark_end`
- `status = available`

On failure:
- do not advance success timestamps
- do update the watermark row status if your bounded design requires it, but keep failure audit explicit

## Required implementation pieces

### A. Typed runner contract
Add typed exports under `src/ingestion/*` for at least:
- `IngestionJobRunRequest`
- `IngestionJobRunResult`
- `IngestionExecutorResult`
- `IngestionJobRunner`
- any narrow status transition helpers needed by tests

### B. Persistence boundary
Add one bounded persistence boundary that can:
- insert a new `ingestion_jobs` row
- fetch by `idempotencyKey`
- update job status/timestamps/error fields
- upsert/update matching `source_watermarks`

This can be:
- an interface plus in-memory test implementation and one Supabase/Postgres-shaped repository boundary, or
- another narrow persistence design that stays fully bounded and testable

Do not widen into a full job framework.

### C. Stub executor path
Add one stub executor used only for tests and bounded CLI/manual proof.
The stub must support:
- deterministic success
- deterministic failure with error code/message
- optional deterministic row count or checksum output

### D. CLI or task-local command
Add one bounded CLI or task-local command to prove the runner works using the stub executor only.

The command must support at minimum:
- submit a job
- retry or replay a failed job
- print a safe summary with no secrets

## Required tests
Add bounded tests for all of the following:
1. first submission creates a new job
2. repeated submission with same idempotency key reuses existing non-failed job
3. successful run transitions `requested -> processing -> available`
4. failed run transitions to `failed` and captures error details
5. retry path is explicit and deterministic
6. replay path is explicit and auditable
7. watermark updates happen only on success
8. invalid transition or invalid replay request is rejected
9. runner does not call live connectors
10. any new CLI summary is safe and deterministic

Use the smallest possible surface. Prefer unit tests plus narrow integration-style tests around the persistence boundary.

## Acceptance checks
The task is complete only if all of the following are true:
1. A bounded generic job runner exists under `src/ingestion/*`.
2. Idempotent submission by `idempotencyKey` is implemented.
3. Job lifecycle transitions are enforced for `requested`, `processing`, `available`, and `failed`.
4. Failed jobs can be retried or replayed only through an explicit bounded path.
5. Replay or retry leaves an inspectable audit trail.
6. `source_watermarks` is updated only on successful completion.
7. A stub-executor command or equivalent bounded proof path exists.
8. No live Amazon connector call is added.
9. No UI, scheduler, or backfill logic is added.
10. `docs/v2/BUILD_STATUS.md` is updated for `S3-02`.

## Required commands
Run all of these in WSL if available:
1. `npm test`
2. `npm run web:lint`
3. `npm run web:build`
4. `node scripts/v2-progress.mjs --write`

If a task-local CLI is added, run it in both:
- one success path
- one failure then explicit replay/retry path

Record the exact commands and outcomes in `docs/v2/BUILD_STATUS.md`.

## MANUAL TEST REQUIRED
1. Open the runner files changed under `src/ingestion/*`.
2. Confirm the runner uses a generic request contract rather than a source-specific Amazon connector.
3. Confirm repeated submission with the same idempotency key does not create duplicate non-failed jobs.
4. Confirm failure handling records error details and does not mark watermark success timestamps.
5. Confirm replay or retry requires an explicit call path.
6. Confirm no `/apps/web` or connector runtime files were changed outside allowed scope.
7. Confirm `docs/v2/BUILD_STATUS.md` now lists current task `S3-02`.

## Status file update requirements
Update `docs/v2/BUILD_STATUS.md` in the same task with:
- `Last updated`
- `Current task: S3-02 - Implement idempotent job runner with retries and replay`
- `Current stage: Stage 3 — ingestion backbone`
- a new task-log row for `S3-02`
- tests actually run
- any manual follow-up still required
- next bounded task: `S3-03 - Implement backfill by date range and safe reruns`

## Commit scope rule
Stage and commit only:
- the canonical tracked task spec under `docs/v2/tasks/`
- bounded `src/ingestion/*` runner files
- directly related tests
- minimal migration follow-up only if strictly required
- required status/progress files

Do not stage scratch spec drafts outside `docs/v2/tasks/`.
