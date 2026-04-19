# S3-G2 — Gate weekly query-intelligence jobs runnable end-to-end

## Task ID
`S3-G2`

## Title
Gate: run Stage 3 weekly SQP and Search Terms jobs end-to-end through the ingestion backbone

## Objective
Prove one operator-triggered Stage 3 weekly gate can run the already-built Stage 2A Brand Analytics query-intelligence paths through the existing ingestion job, state-envelope, and source-watermark model.

This task must connect the existing bounded Stage 2A real-pull and parse+ingest paths for:
- Search Query Performance (SQP)
- Search Terms

into one bounded Stage 3 weekly gate command.

This is a gate task.
It is not a scheduler build.
It is not a new connector family.
It is not a warehouse redesign.

## Why this is the next task
The branch already has:
- Stage 3 ingestion schema
- generic job runner
- backfill path
- state-envelope model
- status dashboard
- manual rank import
- daily retail + ads gate (`S3-G1`)

The missing Stage 3 backbone proof is the weekly query-intelligence family:
- SQP
- Search Terms

Those source families already exist as bounded Stage 2A pull + ingest paths on this branch.
They now need the same Stage 3 gate treatment that daily retail + ads already received.

## Required outcome
After this task, the repo must support one bounded weekly Stage 3 gate command that successfully runs these source families end-to-end for a requested account + marketplace + week window:

1. SQP weekly
2. Search Terms weekly

“End-to-end” in this task means:
- build or reuse deterministic ingestion jobs
- run the existing source-specific execution path
- persist ingestion job transitions
- persist state-envelope metadata
- update success-only source watermarks
- print deterministic operator summaries

It does not mean:
- cron or scheduler deployment
- background workers
- queue infra
- new UI controls
- new warehouse tables
- new marts
- new diagnosis features
- new Amazon source scope

## In-scope source paths
Reuse existing bounded commands and modules only.

SQP side:
- existing Stage 2A SQP real-pull + parse/ingest path

Search Terms side:
- existing Stage 2A Search Terms real-pull + parse/ingest path

Do not replace these source-specific paths with a different SP-API query-intelligence design in this task.

## Strict scope boundary

### Allowed files and directories
Only change files in these areas if required for this task:

- `src/ingestion/**`
- `src/connectors/sp-api/**`
- `src/testing/fixtures/**`
- `test/**`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/S3-G2-*.md`
- `package.json`

Only if needed to expose one bounded Stage 3 weekly gate command.

### Forbidden changes
Do not change or add anything in these areas:

- `apps/web/src/app/v1/**`
- monolithic V1 pages
- new `/v2/*` UI routes or new UI controls
- Ads API scope
- SB or SD scope
- new warehouse target tables
- new marts
- new memory features
- new diagnosis logic
- Helium 10 automation
- scheduler / cron / worker infrastructure
- generic orchestration systems for every future source
- Amazon writeback / mutation paths
- Playwright work unless an already-existing page touched by this task absolutely requires it

Do not widen the task into:
- a universal multi-source DAG engine
- hosted execution architecture
- Finances API work
- intraday stream work
- daily gate refactors unrelated to SQP/Search Terms

## Implementation requirements

### 1. Add one bounded weekly query-intelligence gate entrypoint
Create one synchronous operator-triggered Stage 3 weekly gate under `src/ingestion/**`.

The gate must accept:
- `account_id`
- `marketplace`
- `start_date`
- `end_date`

The path must run only these source groups in this order:
1. SQP weekly
2. Search Terms weekly

The gate must be synchronous and operator-invoked.
It must not daemonize.
It must not require a scheduler.

### 2. Job identity and idempotency
For each source group, build a deterministic Stage 3 job identity using at least:
- source family
- account_id
- marketplace
- start_date
- end_date

The gate must reuse the existing Stage 3 idempotent job-runner behavior.
If a matching successful job already exists, the command must report reuse instead of re-executing that job unless an explicit rerun path already exists in current Stage 3 primitives.

Do not invent a second idempotency system.

### 3. SQP weekly execution
The SQP branch must use the existing Stage 2A bounded real-pull + ingest path.

Required behavior:
- request or reuse the bounded SQP weekly execution path
- persist the ingestion job as `available` only when the SQP branch succeeds
- persist failure metadata when the SQP branch fails
- update the SQP source watermark only on success

The gate must preserve the existing bounded SQP source assumptions:
- week-window input
- current report family validation
- current ingest sink behavior

Do not redesign SQP storage or parser contracts in this task.

### 4. Search Terms weekly execution
The Search Terms branch must use the existing Stage 2A bounded real-pull + ingest path.

Required behavior:
- request or reuse the bounded Search Terms execution path
- persist the ingestion job as `available` only when the Search Terms branch succeeds
- persist failure metadata when the Search Terms branch fails
- update the Search Terms source watermark only on success

Do not redesign Search Terms storage or parser contracts in this task.

### 5. Gate failure behavior
If SQP fails:
- mark the SQP job failed
- do not update the SQP watermark
- stop the gate with a non-zero exit code
- do not continue into Search Terms as if the full weekly gate succeeded

If Search Terms fails:
- mark the Search Terms job failed
- do not update the Search Terms watermark
- return non-zero exit code
- keep any already-successful SQP state intact

Do not falsely mark the whole gate successful when one source group failed.

### 6. State-envelope metadata
Persist `metadata.state_envelope` for each resulting Stage 3 job using the existing Stage 3 state model.

Required semantics:
- success paths must show success-compatible collection state and appropriate freshness/finalization/confidence values for weekly query-intelligence sources
- failed paths must show failure-compatible collection state with explicit failure reason metadata
- the envelope must be derived from the actual execution result, not hard-coded as success

### 7. Deterministic operator summary
Expose one bounded CLI command for this gate.

The CLI summary must include:
- requested range
- created vs reused job ids
- final job statuses
- SQP result summary
- Search Terms result summary
- watermark update results
- upload ids and/or artifact paths when available
- explicit failure reason when failed

The CLI output must be stable enough for test assertions.
Do not print secrets or tokens.

### 8. Stubbed automated test path
Add a bounded local stub/scenario path so automated tests do not require live Amazon credentials.

At minimum support:
- weekly gate success
- SQP failure
- Search Terms failure
- reuse of already-available jobs

The stub path must be deterministic and local only.

### 9. Focused tests
Add focused tests for:
- successful full weekly gate execution
- SQP reuse without duplicate execution
- Search Terms reuse without duplicate execution
- SQP failure path
- Search Terms failure path
- watermark updates only on success
- deterministic job metadata/state-envelope persistence
- deterministic CLI summary formatting

Prefer pure unit/integration tests with stubbed executor boundaries.
Do not require live Amazon credentials for automated tests.

### 10. Real command proof
Add one bounded command that the operator can run in WSL for the real proof.

The task must define and support one real command in this pattern:
- one command for the weekly query-intelligence gate itself

The command may internally call the already-existing source-specific paths.
Do not require the operator to manually chain separate SQP and Search Terms commands after this task.

## Suggested source identifiers
Use explicit Stage 3 source-family names for this gate, not vague generic names.

Recommended direction:
- one source id for SQP weekly
- one source id for Search Terms weekly

They must be deterministic and readable in `ingestion_jobs` and `source_watermarks`.

## Acceptance checks

### Functional acceptance
The task is complete only if all of the following are true:

1. The repo has one bounded Stage 3 weekly gate CLI for account + marketplace + date window.
2. The CLI runs SQP then Search Terms using the already-built bounded source paths.
3. Each source group creates or reuses an ingestion job with deterministic identity.
4. Successful runs mark jobs `available`.
5. Failed runs mark jobs `failed`.
6. Watermarks update only on success.
7. Existing Stage 3 state-envelope metadata is persisted on the resulting jobs.
8. The gate returns non-zero when any required source group fails.
9. The gate does not add scheduler, worker, UI-control, warehouse-redesign, or new source-family scope.

### Test acceptance
The task is complete only if these pass in WSL:

- `npm test -- <new focused test files>`
- `npm test`
- `npm run web:lint`
- `npm run web:build`

If a dedicated CLI command is added, run it in at least one stubbed or fixture-backed success scenario and record the exact command in `docs/v2/BUILD_STATUS.md`.

### Live proof acceptance
The task is not complete until one real WSL proof is recorded in `docs/v2/BUILD_STATUS.md` for the new weekly gate command, using the current branch’s real Stage 2A prerequisites.

Expected proof shape:
- command run
- account_id
- marketplace
- date range
- SQP job result
- Search Terms job result
- resulting watermark result
- upload ids / artifact paths actually produced

## Required status-file update
Update `docs/v2/BUILD_STATUS.md` in the same task.

Minimum required edits:
- `Last updated`
- `Current task`
- current task card for `S3-G2`
- mark task result
- append one `Task log` row
- record tests actually run
- record any remaining manual follow-up
- set the next bounded task after `S3-G2`

Also clean up the stale `Open blockers` section if it still points to an older Stage 3 task that is already complete.
Do not leave status drift behind.

## Manual test handoff format
If manual verification is still required, write it in this exact shape:

MANUAL TEST REQUIRED:
1. Exact command(s) to run
2. Exact route to open
3. Exact click/input steps
4. Exact expected result
5. Exact anomaly to look for

For this task, prefer CLI-only manual verification.
Do not introduce browser checks unless they are truly required by touched scope.

## Codex execution rules
- Keep the patch bounded to this weekly gate.
- Reuse existing Stage 2A SQP and Search Terms execution paths instead of rebuilding them.
- Do not refactor unrelated ingestion code.
- Do not touch unrelated V1 or V2 pages.
- Do not change task IDs or branch naming.
- If you find a blocker, stop after the minimum bounded fix or record the blocker precisely in `docs/v2/BUILD_STATUS.md`.

## Recommended filename
`docs/v2/tasks/S3-G2-weekly-query-intelligence-jobs-runnable-end-to-end.md`
