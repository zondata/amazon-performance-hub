# FT-02 — Land the API-backed retail fact/latest-view contract as the warehouse truth for retail sales and traffic

## Task ID
FT-02

## Title
Land the API-backed retail fact/latest-view contract as the warehouse truth for retail sales and traffic

## Why this task exists
FT-01 completed the bounded SP-API Sales and Traffic parse plus ingest path into the active retail write boundary.

The next fast-track step is to make the API-backed retail warehouse contract the stable retail truth that downstream reads can depend on.

This task must establish the bounded retail fact/latest-view layer for SP-API sales and traffic so later cutover work can stop depending on the legacy SI SalesTrend path.

This task follows the fast-track control note in:
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`
- `docs/v2/BUILD_STATUS.md`

This is still a sequence adjustment, not an architecture change.

## Goal
Create the bounded warehouse truth contract for API-backed retail sales and traffic by landing:
- stable retail fact table usage if not already present,
- deterministic latest views or equivalent bounded warehouse read contract,
- explicit account and marketplace identity,
- predictable date-level and ASIN-level read semantics,
- compatibility for the next step that cuts product overview reads off `si_sales_trend_daily_latest`.

The result of this task must make the SP-API retail warehouse layer the declared active warehouse truth for retail sales and traffic, even if marts and UI are not yet switched over.

## Source of truth
Use these repo files as source of truth:
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`

Follow the fast-track control note. Do not renumber tasks or alter stage definitions.

## Dependency
FT-01 is already complete and pushed.

Reuse the FT-01 retail boundary objects and ingest path where verified:
- the FT-01 migration and warehouse boundary tables/views,
- the FT-01 retail ingest/write path,
- current ingestion_jobs and source_watermarks model,
- current account_id and marketplace scoping rules.

## In scope
Implement only the bounded work required to establish the API-backed retail warehouse truth contract, including:
- warehouse fact/latest-view contract for SP-API retail sales and traffic
- deterministic latest selection or replacement semantics
- bounded typed repository or reader contract for retail truth reads
- explicit date-level and ASIN-level read semantics
- focused automated tests
- one bounded proof command or read verification path
- `docs/v2/BUILD_STATUS.md` update for FT-02 completion

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
- broad schema redesign outside the bounded retail truth contract
- retail and ads mart joining
- any writeback to Amazon
- any task-registry renumbering

## Required implementation outcome
Create or finish one bounded API-backed retail warehouse truth contract such that:
1. retail sales and traffic rows written by FT-01 can be read from stable warehouse truth surfaces,
2. the truth surfaces are explicit for both by-date and by-ASIN retail scopes if both are part of the FT-01 schema,
3. latest or replacement semantics are deterministic and tested,
4. the read contract is safe for the next step that cuts reads away from `si_sales_trend_daily_latest`,
5. the contract clearly does not depend on legacy SI manual upload data.

## Warehouse truth rules
### Identity
Every truth surface must preserve:
- `account_id`
- `marketplace`
- source export or ingest identity sufficient for audit
- date identity
- ASIN identity where applicable

### Determinism
If multiple ingests exist for the same logical retail grain, the warehouse truth must define one deterministic result using verified repo conventions.

Examples of acceptable deterministic behavior:
- latest `exported_at` wins
- latest successful ingest wins
- explicit latest view over fact rows
- another already-established repo convention

Do not invent ambiguous merge behavior.

### Separation from legacy SI
FT-02 must not silently read from or fall back to:
- `si_sales_trend_daily_latest`
- Scale Insights manual upload truth paths

This task is specifically to establish the API-backed warehouse truth contract.

## Required bounded outputs
The implementation must provide bounded warehouse truth outputs for the SP-API retail path.

Expected shapes may include:
- fact tables
- latest views
- typed warehouse reader module
- bounded verification CLI

Use the repo’s existing patterns where verified in code.

If the FT-01 migration already created base tables/views but the read contract is incomplete, finish only the missing bounded contract pieces.

## Read contract behavior
The warehouse truth read contract must:
- support `account_id`
- support `marketplace`
- support a bounded date or date-range filter as appropriate
- support ASIN-scoped reads where the schema includes ASIN-grain rows
- return deterministic rows
- expose enough metadata to prove the data came from the SP-API retail path

If a repository or read helper is added, keep it bounded to retail sales and traffic only.

## Scope guardrails
### Allowed file areas
Expected file areas include only what is required for FT-02, such as:
- `supabase/migrations/**`
- `src/warehouse/**`
- `src/ingestion/**` only if a tiny wiring change is strictly required
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

Keep the diff bounded to FT-02.

## Tests
Add focused tests covering:
1. retail truth surface returns expected by-date rows
2. retail truth surface returns expected by-ASIN rows if applicable
3. deterministic latest selection behavior
4. account_id and marketplace filtering
5. no fallback to SI SalesTrend
6. proof/read summary output if a task-local CLI is added
7. any bounded warehouse repository logic added in this task

## Required proof
Run one bounded proof in WSL outside sandbox against the configured database.

The proof must use the repo’s actual FT-02 command path.
If a new bounded CLI or verification path is needed, add one and keep it task-local.

The proof output must show:
- success status
- account_id
- marketplace
- target retail truth surface names
- returned row counts or summaries
- evidence that the retail truth surface is reading SP-API-backed rows
- no fallback to SI/manual SalesTrend

## Acceptance criteria
FT-02 is accepted only if all of the following are true:

1. The API-backed retail warehouse truth contract exists.
2. The contract exposes stable by-date and by-ASIN retail truth semantics where applicable.
3. Deterministic latest selection or replacement semantics are implemented and tested.
4. The contract preserves explicit `account_id` and `marketplace`.
5. The contract does not depend on `si_sales_trend_daily_latest`.
6. Focused FT-02 tests pass.
7. `npm test` passes.
8. `npm run web:lint` passes.
9. `npm run web:build` passes.
10. A real WSL proof passes and is captured in `docs/v2/BUILD_STATUS.md`.
11. No UI, mart cutover, memory, MCP, ranking automation, or scheduler scope is added.

## Required checks
Run from WSL repo root:
- focused FT-02 tests
- `npm test`
- `npm run web:lint`
- `npm run web:build`

Also run:
- one real FT-02 WSL proof command outside sandbox

If a task-local CLI is added, also run:
- one success scenario
- one bounded negative scenario if stubbing is available

## BUILD_STATUS update requirements
Update `docs/v2/BUILD_STATUS.md` to include:
- current task: FT-02
- fast-track step status
- files changed
- commands run
- exact pass or fail results
- live WSL proof command and result
- whether FT-02 is complete or blocked
- next fast-track step: FT-03 only if FT-02 passes

Do not mark FT-02 complete unless the real WSL proof passes.

## Final report format
At the end, report:
- files changed
- tests run
- exact command results
- whether scope stayed within FT-02
- whether live WSL proof passed
- whether acceptance passed
- blockers, if any
- exact manual verification still required, if any

Stop before push and wait for operator approval.
