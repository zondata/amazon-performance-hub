# S3-06 — Build manual Helium 10 rank CSV import with validation and dedupe

## Objective
Implement the next bounded Stage 3 ingestion-backbone step by adding a manual Helium 10 rank CSV import workflow that validates input, deduplicates safely, and records bounded ingestion jobs through the existing Stage 3 backbone without adding automation, UI sprawl, Amazon connector execution, or warehouse redesign.

## Important sequencing note
The pushed repo says the next bounded product task is `S3-06`, but there may still be unpushed local work related to `S3-05` on `/v2/admin/imports`. Do not begin `S3-06` until the active working tree is clean for the intended task branch, or the operator explicitly decides to stack `S3-06` on top of the current local `S3-05` state.

## Important local-read rule
Read these files from the LOCAL WSL working tree first:
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/BUILD_STATUS.md`

If local versions differ from GitHub, the LOCAL working-tree versions are the source of truth for this task.

## Why this task now
The V2 task registry marks `S3-06 - Build manual Helium 10 rank CSV import with validation and dedupe` as a Stage 3 task that depends on the ingestion backbone and supports later query/rank marts.

## Scope
Build only a bounded manual import path for Helium 10 rank CSV files that:
- accepts a local CSV file
- validates the expected CSV shape
- rejects malformed or mixed-scope files
- deduplicates rows safely
- routes accepted rows through the existing Stage 3 ingestion job/state model
- records import results deterministically
- does not automate Helium 10 download
- does not build ranking UI
- does not widen into Stage 4 marts

This task is manual-import infrastructure only.

## Allowed files
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S3-06-manual-h10-rank-import-validation-dedupe.md`
- `src/ingestion/*`
- `src/testing/fixtures/*`
- `src/cli/*` only if a bounded task-local import CLI is required
- `package.json` only if a bounded task-local script is strictly required
- directly related tests only

## Forbidden changes
Do not change:
- any `apps/web/*` file
- any V1 UI
- any `/v2` page
- any SP-API connector behavior
- any Ads API connector behavior
- warehouse execution logic
- marts
- memory tables
- diagnosis logic
- scheduler or cron setup
- Playwright/browser test policy unless strictly required for task execution
- production secrets
- unrelated refactors

Do not add:
- automated Helium 10 fetching
- browser automation against Helium 10
- ranking mart logic
- charting or ranking UI
- queue workers
- background daemons
- broad backfill orchestration beyond the bounded import path

## Required design rules

### 1. Manual import only
The import path must require a local CSV input supplied by the operator.
Do not add any network pull or scraping path.

### 2. File validation
Implement bounded validation for at least:
- file extension must be CSV
- expected required columns exist
- required rank fields parse into the currently supported rank model
- one file must not silently mix incompatible ASIN or marketplace scope if the current repo rules require one-scope-per-file
- invalid rows must produce explicit errors or warnings, not silent drops

### 3. Safe dedupe
Implement deterministic dedupe rules for repeated rows within the same import file and for rerunning the same file through the bounded import path.

Required rules:
- duplicate rows in the same input must not create duplicated accepted outputs
- rerunning the same valid file should be idempotent or clearly marked as already imported/reused according to the existing Stage 3 job model
- dedupe behavior must be explicit and tested

### 4. Stage 3 integration
The import path must integrate with the current Stage 3 backbone where appropriate:
- bounded ingestion job creation/reuse
- bounded state envelope usage if applicable
- clear success/failure summary

Do not redesign the Stage 3 backbone in this task.

### 5. Safe summaries
The CLI or task-local proof path must print:
- file path or file label
- row counts
- accepted row count
- deduped row count
- rejected row count
- resulting job status
- no secrets

## Required implementation pieces

### A. Rank import module
Add a bounded import module under `src/ingestion/*` that:
- parses the CSV
- validates required columns
- normalizes rows into the existing rank-ingest shape
- applies dedupe
- returns a deterministic summary

### B. Task-local CLI
Add one bounded CLI or script entry that:
- accepts a CSV file path
- runs validation + dedupe + bounded import
- prints a safe deterministic summary
- exits non-zero on hard validation failure

### C. Fixture coverage
Add bounded fixture CSV(s) under `src/testing/fixtures/*` or the existing test-fixture location for:
- one valid file
- one duplicate-row file
- one malformed file

### D. Tests
Add directly related tests for at least:
1. valid CSV import succeeds
2. missing required column fails
3. malformed rank values fail or warn deterministically
4. duplicate rows are deduped deterministically
5. rerunning the same file does not create unsafe duplicates
6. CLI summary is safe and deterministic
7. Stage 3 job/state integration behaves as expected for this bounded path

## Acceptance checks
The task is complete only if all of the following are true:
1. A manual Helium 10 rank CSV import path exists.
2. Required input columns are validated.
3. Duplicate rows are deduped safely.
4. Re-running the same file does not create unsafe duplicates.
5. The import path stays manual-only.
6. No UI, scheduler, or automation path is added.
7. `docs/v2/BUILD_STATUS.md` is updated for `S3-06`.

## Required commands
Run all of these in WSL if available:
1. `npm test`
2. `npm run web:lint`
3. `npm run web:build`
4. `node scripts/v2-progress.mjs --write`

If a task-local CLI is added, also run:
- one valid import scenario
- one duplicate-row scenario
- one malformed-file scenario

Record exact commands and outcomes in `docs/v2/BUILD_STATUS.md`.

## Automated verification expectation
Codex must:
- verify changed files stayed within allowed scope
- verify no forbidden files changed
- run the required automated checks
- run the bounded rank-import proof scenarios
- report whether the task is ready for operator approval under the current local workflow rules
- request manual verification only if a true manual-only condition remains

## MANUAL TEST REQUIRED ONLY IF NEEDED
Only require manual verification if the bounded import behavior cannot be proven automatically.
If manual verification is still required, provide exact file path setup, exact command, and exact expected result.

## Status file update requirements
Update `docs/v2/BUILD_STATUS.md` in the same task with:
- `Last updated`
- `Current task: S3-06 - Build manual Helium 10 rank CSV import with validation and dedupe`
- `Current stage: Stage 3 — ingestion backbone`
- a new task-log row
- tests actually run
- whether the task is auto-verified or still requires manual verification
- if manual verification is still required, the exact reason
- next bounded task: `S3-G1 - Gate: daily batch jobs runnable end-to-end` only if the local plan still points there; otherwise record the next bounded task from the updated local source of truth

## Commit scope rule
Stage and commit only:
- the canonical tracked task spec under `docs/v2/tasks/`
- bounded `src/ingestion/*` and any strictly required task-local CLI files
- directly related fixtures/tests
- required status/progress files

Do not stage unrelated scratch/spec files.
