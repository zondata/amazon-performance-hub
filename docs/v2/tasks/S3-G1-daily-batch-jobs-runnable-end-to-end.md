# S3-G1 — Gate daily batch jobs runnable end-to-end

## Task ID
`S3-G1`

## Title
Gate: run Stage 3 daily retail and ads batch jobs end-to-end through the ingestion backbone

## Objective
Prove that the Stage 3 ingestion backbone can run real daily batch jobs end-to-end for the already-built V2 connectors without introducing a scheduler, worker daemon, new UI controls, warehouse redesign, or new Amazon source scope.

This task must connect the existing bounded job-runner/backfill/state model work to the already-built Stage 2A and Stage 2B pull paths so one operator-triggered daily batch command can:
1. submit or reuse bounded ingestion jobs,
2. execute the bounded retail daily sync path,
3. execute the bounded ads daily sync path,
4. persist job status and state-envelope metadata,
5. update source watermarks only on success,
6. produce deterministic summaries for the operator.

This is a gate task, not a platform rewrite.

## Required outcome
After this task, the repo must support one bounded daily batch execution path that successfully runs these source families end-to-end for a requested account + marketplace + date window:

- retail sales and traffic daily batch
- Sponsored Products ads daily batch

“End-to-end” in this task means:
- build a job request,
- run the existing source-specific execution path,
- persist ingestion job transitions,
- persist state-envelope metadata,
- update success watermarks,
- print deterministic operator summaries.

It does not mean:
- cron or scheduler deployment,
- background workers,
- queue infra,
- UI-triggered run controls,
- new sources,
- warehouse redesign,
- autonomous replay loops.

## In-scope source paths
Reuse existing bounded commands and modules only.

Retail side:
- existing SP-API first report / canonical ingest / warehouse-ready local promotion path as the daily retail proof source
- do not replace the existing bounded SP-API report family in this task

Ads side:
- existing Ads API daily campaign pull
- existing Ads API daily target pull
- existing Ads daily persistence
- existing campaign ingest gate
- existing target ingest gate

## Strict scope boundary

### Allowed files and directories
Only change files in these areas if required for this task:

- `src/ingestion/**`
- `src/connectors/sp-api/**`
- `src/connectors/ads-api/**`
- `src/testing/fixtures/**`
- `test/**`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/S3-G1-*.md`

You may also update:
- `package.json`

Only if needed to expose one bounded Stage 3 gate command.

### Forbidden changes
Do not change or add anything in these areas:

- `apps/web/src/app/v1/**`
- monolithic V1 pages
- new `/v2/*` UI routes or new UI controls
- Supabase schema redesign beyond the existing Stage 3 ingestion tables
- new warehouse target tables
- new marts
- new memory system features
- new diagnosis logic
- SB or SD ingestion scope
- Helium 10 automation
- scheduler / cron / background worker infrastructure
- Amazon writeback / mutation paths
- Playwright work unless a browser test is absolutely required for an existing page already touched by this task

Do not widen the task into:
- generic orchestration for every future source
- dynamic plugin systems
- multi-step DAG builders
- job-priority frameworks
- distributed locking
- hosted execution architecture

## Implementation requirements

### 1. Add one bounded daily batch orchestration entrypoint
Create one Stage 3 operator-triggered orchestration path under `src/ingestion/**` that accepts:
- `account_id`
- `marketplace`
- `start_date`
- `end_date`

The path must run only the two supported source groups in this order:
1. retail daily batch
2. ads daily batch

The orchestration path must be synchronous and operator-invoked.
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

### 3. Retail daily batch execution
The retail branch must use the existing SP-API report path already proven in Stage 2A.

Minimum required behavior:
- request or reuse the bounded retail report execution path
- validate the generated artifact chain
- run the current bounded local ingest/promotion steps needed to reach the existing Stage 2A terminal local artifact for retail
- persist the ingestion job as `available` only when the retail branch succeeds
- persist failure metadata when the retail branch fails
- update the retail source watermark only on success

This task must not replace Stage 2A artifacts with a different retail connector design.

### 4. Ads daily batch execution
The ads branch must use the existing Stage 2B sequence already proven on this branch.

Required sequence:
1. validate or refresh the existing ads profile mapping prerequisite
2. pull Sponsored Products campaign daily
3. pull Sponsored Products target daily
4. persist ads daily landed + normalized artifacts
5. run campaign ingest gate
6. run target ingest gate

Required behavior:
- treat the ads batch as one bounded Stage 3 source-group run with a deterministic operator summary
- record internal step results in job metadata
- persist the job as `available` only when the required ads sequence succeeds
- update the ads source watermark only on success

Do not split this task into new SB/SD/generalized ad-channel abstractions.

### 5. State-envelope metadata
Persist `metadata.state_envelope` for each Stage 3 job using the existing Stage 3 state model.

Required semantics:
- success paths must show a success-compatible collection state and freshness/finalization/confidence values grounded in the source family
- failed paths must show a failure-compatible collection state with explicit failure reason metadata
- the envelope must be deterministic from the actual execution result, not hard-coded as success

### 6. Deterministic operator summary
Expose one bounded CLI command for this gate.

Example shape:
- source family summaries
- requested range
- created vs reused job ids
- final job statuses
- watermark update results
- key output artifact paths or upload ids when available
- failure reason when failed

The CLI output must be readable by an operator and stable enough for test assertions.
Do not print tokens or secrets.

### 7. Failure handling
If retail fails:
- mark the retail job failed
- do not update the retail watermark
- stop the gate with a non-zero exit code
- do not silently continue as if the full daily gate succeeded

If ads fails:
- mark the ads job failed
- do not update the ads watermark
- return non-zero exit code
- keep any already-successful retail result intact

Do not falsely mark the whole batch successful when one source group failed.

### 8. Testing
Add focused tests for:
- successful full daily gate execution
- retail reuse without duplicate execution
- ads reuse without duplicate execution
- retail failure path
- ads failure path
- watermark updates only on success
- deterministic job metadata/state-envelope persistence
- deterministic CLI summary formatting

Prefer pure unit/integration tests with stubbed executor boundaries.
Do not require live Amazon credentials for automated tests.

### 9. Real command proof
Add one bounded command that the operator can run in WSL for the real proof.

The task must define and support one real command in this pattern:
- one command for the daily batch gate itself

The command may internally call the already-existing source-specific paths.
Do not require the operator to manually chain five or six commands for the gate proof after this task.

## Suggested file outputs
You may add bounded artifacts under existing `out/` conventions for:
- retail batch gate summaries
- ads batch gate summaries
- combined daily gate summary

Do not create a new permanent storage system for this task.

## Acceptance checks

### Functional acceptance
The task is complete only if all of the following are true:

1. The repo has one bounded Stage 3 daily gate CLI for account + marketplace + date window.
2. The CLI runs retail then ads using the already-built bounded source paths.
3. Each source group creates or reuses an ingestion job with deterministic identity.
4. Successful runs mark jobs `available`.
5. Failed runs mark jobs `failed`.
6. Watermarks update only on success.
7. Existing Stage 3 state-envelope metadata is persisted on the resulting jobs.
8. The gate returns non-zero when any required source group fails.
9. The gate does not add scheduler, worker, UI-control, or warehouse-redesign scope.

### Test acceptance
The task is complete only if these pass in WSL:

- `npm test -- <new focused test files>`
- `npm test`
- `npm run web:lint`
- `npm run web:build`

If a dedicated CLI command is added, run it in at least one stubbed or fixture-backed success scenario and record the exact command in `docs/v2/BUILD_STATUS.md`.

### Live proof acceptance
The task is not complete until one real WSL proof is recorded in `docs/v2/BUILD_STATUS.md` for the new gate command, using the current branch’s real Stage 2A and Stage 2B prerequisites.

Expected proof shape:
- command run
- account_id
- marketplace
- date range
- retail job result
- ads job result
- resulting watermark result
- any upload ids / artifact paths actually produced

## Required status-file update
Update `docs/v2/BUILD_STATUS.md` in the same task.

Minimum required edits:
- `Last updated`
- `Current task`
- current task card for `S3-G1`
- mark task result
- append one `Task log` row
- record tests actually run
- record any remaining manual follow-up
- set the next bounded task after `S3-G1`

## Manual test handoff format
If manual verification is still required, write it in this exact shape:

MANUAL TEST REQUIRED:
1. Exact command(s) to run
2. Exact route to open
3. Exact click/input steps
4. Exact expected result
5. Exact anomaly to look for

For this task, route steps should be omitted unless some existing page is touched. Prefer CLI-only manual verification.

## Codex execution rules
- Keep the patch bounded to this gate.
- Reuse existing Stage 2A and Stage 2B execution paths instead of rebuilding them.
- Do not refactor unrelated ingestion code.
- Do not touch unrelated V1 or V2 pages.
- Do not change task IDs or branch naming.
- If you find a blocker, stop after the minimum bounded fix or record the blocker in `docs/v2/BUILD_STATUS.md`.

## Recommended filename
`docs/v2/tasks/S3-G1-daily-batch-jobs-runnable-end-to-end.md`
