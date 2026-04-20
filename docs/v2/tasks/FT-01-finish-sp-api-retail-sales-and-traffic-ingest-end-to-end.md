# FT-01 — Finish SP-API retail sales and traffic ingest end-to-end as the active retail truth path

## Task ID
FT-01

## Title
Finish SP-API retail sales and traffic ingest end-to-end as the active retail truth path

## Why this task exists
The repo has already completed:
- SP-API auth and first retail report pull boundaries
- Ads API daily Sponsored Products ingest
- SQP and Search Terms ingest
- Stage 3 ingestion backbone gates

But the current system is still blocked from minimum usable API-backed operation because product-level retail sales and traffic usage is still tied to the legacy SI SalesTrend path in active read paths, while the SP-API retail path is not yet completed as the active retail ingest path.

This task is the first fast-track execution step recorded in:
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`
- `docs/v2/BUILD_STATUS.md`

This task is a controlled sequence adjustment, not an architecture change.

## Goal
Complete the SP-API Sales and Traffic report ingest so that one real SP-API retail sales and traffic path can run end-to-end into the repo’s active retail ingest/warehouse boundary with deterministic job state, source watermarking, and reusable downstream read compatibility.

The result of this task must make the SP-API retail path the active ingest truth path for retail sales and traffic, even if existing marts/UI have not yet been cut over.

## Source of truth
Use these repo files as source of truth:
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`

Follow the fast-track control note. Do not change task numbering or stage definitions in this task.

## Current repo reality to preserve
The branch already has:
- bounded SP-API report create, poll, retrieve, parse, and earlier handoff artifacts
- Stage 3 daily gate plumbing
- existing Supabase-backed ingest patterns for other source families
- existing account_id + marketplace scoping rules
- existing watermark and ingestion_jobs model

Reuse those patterns wherever verified in repo code.

## In scope
Implement only the bounded work required to make SP-API Sales and Traffic ingest run end-to-end as the active retail ingest path, including:
- verified parse-to-ingest completion for Sales and Traffic
- integration into the current ingestion/state/watermark model if not already complete
- deterministic account_id + marketplace tagging on every written row
- one bounded real WSL proof command or gate command
- focused automated tests
- `docs/v2/BUILD_STATUS.md` update for FT-01

## Out of scope
Do not add or change any of the following:
- V2 Overview UI
- Queries UI
- product overview mart cutover
- query mart
- root-cause mart
- rank mart
- memory system
- diagnosis engine
- change logging
- MCP or agent surfaces
- scheduler, cron, workers, daemons
- SB or SD expansion
- Helium 10 automation
- deletion of legacy SI tables/views
- broad schema redesign
- retail/ads unified mart work
- any writeback to Amazon
- any task-registry renumbering

## Required implementation outcome
Create or finish one bounded end-to-end retail ingest path such that:
1. a real Sales and Traffic SP-API report can be pulled or consumed from the existing bounded path,
2. the parsed retail rows are ingested into the repo’s active retail ingest sink or canonical retail warehouse boundary,
3. each written row includes explicit `account_id` and `marketplace`,
4. the ingest is represented in `ingestion_jobs` / `source_watermarks` using existing repo conventions,
5. the final output is usable as the source foundation for FT-02.

## Data rules
### Required identity fields
Every retail row written by this path must carry:
- `account_id`
- `marketplace`
- report window or date identity
- deterministic source metadata sufficient to trace the ingest run

### Required scope
Support one account and one marketplace per run.
Do not widen to multi-account batch orchestration in this task.

### Required safety
- Do not fabricate retail values.
- Do not silently fall back to SI SalesTrend data.
- Do not write rows without explicit account_id and marketplace.
- Do not bypass the repo’s current ingest/state model.

## Ingest behavior
The completed path must:
- accept or reuse a real SP-API Sales and Traffic report path already present in the repo
- finish the parse + ingest boundary end-to-end
- produce deterministic success/failure summary output
- write or reuse job records via existing Stage 3 conventions
- update source watermarks only on successful completion
- be safely rerunnable without uncontrolled duplication

If an existing sink or retail target already exists in repo code, reuse it.
If part of the current retail path is only local-artifact based, complete the missing bounded promotion into the active ingest truth path.

## Scope guardrails
### Allowed file areas
Expected file areas include only what is required for FT-01, such as:
- `src/connectors/sp-api/**`
- `src/ingestion/**`
- `src/warehouse/**`
- directly related tests
- `docs/v2/BUILD_STATUS.md`

### Forbidden unrelated file areas
Do not touch:
- `apps/web/**`
- `src/marts/**`
- `src/memory/**`
- `src/diagnosis/**`
- `src/changes/**`
- Helium 10 files
- unrelated admin/import dashboard files

Unless a tiny existing type/export wiring change is strictly required for FT-01, keep the diff out of those areas.

## Tests
Add focused tests covering:
1. successful retail parse + ingest path
2. required account_id and marketplace propagation
3. duplicate or rerun behavior
4. source watermark success-only behavior
5. failure path normalization
6. deterministic summary output
7. any bounded transformation or sink-shaping logic added by this task

## Required live proof
Run one real WSL proof outside sandbox for one account + marketplace.

The proof must use the repo’s actual FT-01 command path.
If a new bounded CLI or gate command is required, add one and keep it task-local.

The proof output must show:
- success status
- account_id
- marketplace
- report identifier or equivalent source reference
- ingest/upload identifier if the sink provides one
- row count or row summary
- source watermark status
- no fallback to SI/manual SalesTrend

## Acceptance criteria
FT-01 is accepted only if all of the following are true:

1. The SP-API Sales and Traffic path runs end-to-end through parse + ingest.
2. The path writes to the active retail ingest/warehouse boundary instead of stopping at local artifacts only.
3. Every written retail row includes `account_id` and `marketplace`.
4. The path participates in existing ingestion job/state/watermark conventions.
5. Success-only watermark behavior is preserved.
6. Reruns are deterministic and do not create uncontrolled duplication.
7. Focused FT-01 tests pass.
8. `npm test` passes.
9. `npm run web:lint` passes.
10. `npm run web:build` passes.
11. A real WSL proof passes and is captured in `docs/v2/BUILD_STATUS.md`.
12. No UI, mart, memory, MCP, ranking automation, or scheduler scope is added.

## Required checks
Run from WSL repo root:
- focused FT-01 tests
- `npm test`
- `npm run web:lint`
- `npm run web:build`

Also run:
- one real FT-01 WSL proof command outside sandbox

If a task-local CLI is added, also run:
- one success scenario
- one failure scenario if stubbing is available

## BUILD_STATUS update requirements
Update `docs/v2/BUILD_STATUS.md` to include:
- current task: FT-01
- fast-track step status
- files changed
- commands run
- exact pass/fail results
- live WSL proof command and result
- whether FT-01 is complete or blocked
- next fast-track step: FT-02 only if FT-01 passes

Do not mark FT-01 complete unless the real WSL proof passes.

## Final report format
At the end, report:
- files changed
- tests run
- exact command results
- whether scope stayed within FT-01
- whether live WSL proof passed
- whether acceptance passed
- blockers, if any
- exact manual verification still required, if any

Stop before push and wait for operator approval.
