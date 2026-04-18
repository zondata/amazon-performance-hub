# S3-04 — Model freshness_state, collection_state, finalization_state, source_confidence

## Objective
Implement the next bounded Stage 3 ingestion-backbone step by defining the canonical Stage 3 status-state model for ingestion outputs and job summaries: `freshness_state`, `collection_state`, `finalization_state`, and `source_confidence`, with typed contracts, bounded persistence/storage shape, and no live Amazon connector execution, scheduler, UI, marts, or warehouse writes.

## Why this task now
`S3-03` is complete in the repo status and task registry, and the next bounded Stage 3 task is `S3-04 - Model freshness_state, collection_state, finalization_state, source_confidence` fileciteturn14file0L1-L1 fileciteturn15file0L1-L1

## Scope
Build only the Stage 3 status-model boundary that:
- defines the canonical enum/state sets for freshness, collection, finalization, and source confidence
- provides typed contracts under `src/ingestion/*`
- adds the minimum persistence/storage shape needed so Stage 3 jobs and later marts can record these states deterministically
- adds state-derivation helpers for the bounded Stage 3 runner/backfill context only
- does not call live Amazon APIs
- does not ingest real business data
- does not build UI or dashboards

This task is status-model infrastructure only.

## Allowed files
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S3-04-freshness-collection-finalization-confidence.md`
- `src/ingestion/*`
- `src/testing/fixtures/*`
- `package.json` only if a bounded task-local command alias is strictly required
- `supabase/migrations/*` only if a minimal migration is strictly required for the bounded state model
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
- live source orchestration
- dashboard/status UI
- queue workers
- background daemons
- Amazon writeback paths
- S3-05 dashboard implementation
- S3-G1 end-to-end daily batch orchestration

## Required design rules

### 1. Canonical state sets
Define these canonical state families and keep them narrow.

#### freshness_state
Allowed values:
- `live`
- `hourly`
- `daily`
- `weekly`

#### collection_state
Allowed values:
- `requested`
- `processing`
- `available`
- `failed`

#### finalization_state
Allowed values:
- `partial_period`
- `provisional`
- `revisable`
- `final`

#### source_confidence
Allowed values:
- `high`
- `medium`
- `low`
- `unknown`

Do not add more states in this task.

### 2. Exact typing
Add exact typed exports under `src/ingestion/*` for at least:
- `FreshnessState`
- `CollectionState`
- `FinalizationState`
- `SourceConfidence`
- `IngestionStateEnvelope`
- any narrow helpers needed for validation or derivation

Types must match the canonical state strings exactly.

### 3. Bounded persistence shape
Add the minimum persistence/storage support required for the Stage 3 model.

Allowed designs:
- add a minimal migration extending `ingestion_jobs` and/or `source_watermarks`, or
- store the new state envelope in existing job/watermark metadata, if that stays deterministic and inspectable

Required rule:
- the chosen design must let later Stage 3 and Stage 4 code read one stable state envelope without guessing

Do not widen into a broad schema redesign.

### 4. State derivation helpers
Add bounded derivation helpers for the current Stage 3 runner/backfill context only.

Required examples:
- derive `collection_state` from current job status
- derive `finalization_state` for stub/manual bounded backfill outputs
- assign `freshness_state` from source cadence input or request metadata
- assign `source_confidence` from explicit bounded rules, not vague heuristics

Keep the rules simple, deterministic, and inspectable.

### 5. Runner/backfill integration only
Integrate the state model only where needed so the existing Stage 3 runner/backfill layers can emit or persist the new state envelope.

Required rules:
- no live connector execution
- no source-specific ingestion logic
- no dashboard rendering
- no mart reads

### 6. Safe defaults
If a state cannot be derived in the bounded task, use a documented safe default rather than inventing hidden heuristics.
Example:
- `source_confidence = unknown` when no explicit confidence rule exists

## Required implementation pieces

### A. State contract module
Add one bounded module under `src/ingestion/*` that defines:
- all four state families
- validators/guards
- one stable `IngestionStateEnvelope` shape

The envelope should include at minimum:
- `freshnessState`
- `collectionState`
- `finalizationState`
- `sourceConfidence`

### B. Minimal persistence/storage support
Implement the minimum bounded persistence/storage shape so the state envelope can be stored or reconstructed deterministically for current Stage 3 runner/backfill outputs.

If you add a migration, keep it minimal and task-local.
If you use metadata, make the persisted structure explicit and tested.

### C. Derivation helpers
Add bounded helper functions that:
- validate state strings
- derive state envelope from current Stage 3 runner/backfill context
- reject unsupported values

### D. Task-local proof path
Add one bounded CLI or extend an existing Stage 3 task-local CLI to print a safe deterministic state-envelope summary for:
- one success scenario
- one failed or provisional scenario

The proof path must use stub/local logic only.

## Required tests
Add bounded tests for all of the following:
1. exact allowed values for all four state families
2. validation failure for unsupported state values
3. deterministic derivation of `collection_state`
4. deterministic derivation of `finalization_state`
5. deterministic derivation/defaulting of `source_confidence`
6. stable shape of `IngestionStateEnvelope`
7. persistence/storage shape contains the expected state envelope
8. existing Stage 3 runner/backfill code can expose the envelope without live connectors
9. CLI summary is deterministic and safe
10. no UI or source connector runtime changes are required

Use the smallest possible surface. Prefer unit tests plus narrow integration-style tests around the current Stage 3 runner/backfill boundary.

## Acceptance checks
The task is complete only if all of the following are true:
1. Canonical state families exist for freshness, collection, finalization, and source confidence.
2. Exact typed exports exist under `src/ingestion/*`.
3. A stable `IngestionStateEnvelope` contract exists.
4. The state envelope can be stored or reconstructed deterministically for current Stage 3 runner/backfill outputs.
5. Validation rejects unsupported values.
6. Bounded derivation helpers exist and are inspectable.
7. A stub/local proof path exists.
8. No live Amazon connector call is added.
9. No UI, scheduler, or warehouse execution logic is added.
10. `docs/v2/BUILD_STATUS.md` is updated for `S3-04`.

## Required commands
Run all of these in WSL if available:
1. `npm test`
2. `npm run web:lint`
3. `npm run web:build`
4. `node scripts/v2-progress.mjs --write`

If a task-local CLI is added or extended, run:
- one success state-envelope scenario
- one failed or provisional state-envelope scenario

Record exact commands and outcomes in `docs/v2/BUILD_STATUS.md`.

## MANUAL TEST REQUIRED
1. Open the changed state-model files under `src/ingestion/*`.
2. Confirm all four canonical state families exist with the exact allowed values only.
3. Confirm the state envelope shape is stable and explicit.
4. Confirm unsupported state values are rejected.
5. Confirm the proof path uses only stub/local logic and no source-specific Amazon connector imports.
6. Confirm no `/apps/web` or connector runtime files were changed outside the allowed scope.
7. Confirm `docs/v2/BUILD_STATUS.md` now lists current task `S3-04`.

## Status file update requirements
Update `docs/v2/BUILD_STATUS.md` in the same task with:
- `Last updated`
- `Current task: S3-04 - Model freshness_state, collection_state, finalization_state, source_confidence`
- `Current stage: Stage 3 — ingestion backbone`
- a new task-log row for `S3-04`
- tests actually run
- any manual follow-up still required
- next bounded task: `S3-05 - Build ingestion dashboard/status view`

## Commit scope rule
Stage and commit only:
- the canonical tracked task spec under `docs/v2/tasks/`
- bounded `src/ingestion/*` state-model files
- directly related tests
- minimal migration follow-up only if strictly required
- required status/progress files

Do not stage scratch spec drafts outside `docs/v2/tasks/`.
