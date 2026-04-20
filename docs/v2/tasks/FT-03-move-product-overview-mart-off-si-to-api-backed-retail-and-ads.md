# FT-03 — Move the product overview mart off SI and onto API-backed retail plus Ads-backed sources

## Task ID
FT-03

## Title
Move the product overview mart off SI and onto API-backed retail plus Ads-backed sources

## Why this task exists
FT-01 completed the bounded SP-API Sales and Traffic ingest truth path.
FT-02 completed the bounded API-backed retail warehouse truth contract.

The next fast-track step is to stop product overview logic from depending on the legacy SI SalesTrend path and instead read from:
- API-backed retail truth for sales and traffic
- Ads-backed truth for ad spend and related ad fields already verified in the repo

This task is the key cutover step that removes the active product-overview dependency on `si_sales_trend_daily_latest`.

This task follows the fast-track control note in:
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`
- `docs/v2/BUILD_STATUS.md`

This is still a sequence adjustment, not an architecture change.

## Goal
Cut the product overview mart off `si_sales_trend_daily_latest` and move it onto:
- FT-02 API-backed retail warehouse truth surfaces for retail sales and traffic
- existing verified Ads-backed sources for ad spend inputs

The result of this task must make the product overview mart API-backed for the core product overview metrics needed for the first usable Overview path, while still staying bounded to mart cutover only.

## Source of truth
Use these repo files as source of truth:
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`

Also reuse the already-landed FT-01 and FT-02 retail truth path and the current verified Ads-backed truth sources already present in repo code.

Do not renumber tasks or alter stage definitions.

## Dependency
FT-01 is complete and pushed.
FT-02 is complete and pushed.

Reuse:
- FT-02 retail truth surfaces
- existing ads truth/fact/latest sources already used in the repo for Sponsored Products daily data
- existing bounded product overview mart pattern if an earlier transitional S4-01 mart exists in the worktree or repo

## In scope
Implement only the bounded work required to cut the product overview mart off SI and onto API-backed retail plus Ads-backed sources, including:
- product overview mart source cutover
- metric mapping updates required by that cutover
- safe derived metric math where needed
- explicit source contract showing retail comes from SP-API truth and ad spend comes from Ads-backed truth
- focused automated tests
- one bounded proof path or CLI verification if needed
- `docs/v2/BUILD_STATUS.md` update for FT-03 completion

## Out of scope
Do not add or change any of the following:
- V2 Overview page UI
- Queries UI
- root-cause mart
- query mart
- rank mart
- memory system
- diagnosis engine
- change logging
- MCP or agent surfaces
- scheduler, cron, workers, daemons
- SB or SD expansion
- Helium 10 automation
- deletion of legacy SI tables/views
- broad warehouse redesign
- retail and ads unification outside product overview mart needs
- any writeback to Amazon
- any task-registry renumbering

## Required implementation outcome
Create or finish one bounded product overview mart cutover such that:
1. product overview metrics no longer read from `si_sales_trend_daily_latest`,
2. sales and traffic inputs come from FT-02 API-backed retail truth,
3. ad spend inputs come from existing verified Ads-backed truth sources,
4. the mart remains deterministic and bounded,
5. the mart is ready to support the later Overview UI step.

## Required product overview metrics
At minimum, the cutover must support these metrics when the repo already supports them in the product overview mart contract:
- sales
- orders
- sessions
- conversion_rate
- ad_spend
- tacos

If the current mart contract already includes other compatible fields, keep them only if they can be supported without widening scope or falling back to SI.

Do not fabricate unsupported values.

## Source rules
### Retail source
Retail sales and traffic must come from FT-02 SP-API-backed retail truth surfaces.

### Ads source
Ad spend must come from the repo’s existing verified Ads-backed truth sources already used for Sponsored Products daily data.

### Forbidden fallback
Do not read from or silently fall back to:
- `si_sales_trend_daily_latest`
- SI SalesTrend import paths
- manual upload retail truth paths

## Derived metric rules
### conversion_rate
Compute only when sessions is non-zero.

Formula:
- conversion_rate = orders / sessions

If sessions is null or zero:
- conversion_rate must be null

### tacos
Compute only when sales is non-zero.

Formula:
- tacos = ad_spend / sales

If sales is null or zero:
- tacos must be null

Preserve any existing bounded diagnostic pattern already used in the mart if verified in repo code.

## Read semantics
The cutover mart must:
- preserve `account_id`
- preserve `marketplace`
- preserve `asin`
- support explicit date window inputs
- return deterministic rows for the same inputs
- expose enough source information in proof or diagnostics to confirm it is using SP-API retail truth and Ads-backed truth

## Scope guardrails
### Allowed file areas
Expected file areas include only what is required for FT-03, such as:
- `src/marts/**`
- `src/warehouse/**` if tiny reader wiring is strictly required
- directly related tests
- `docs/v2/BUILD_STATUS.md`

### Forbidden unrelated file areas
Do not touch:
- `apps/web/**`
- `src/memory/**`
- `src/diagnosis/**`
- `src/changes/**`
- Helium 10 files
- unrelated admin/import dashboard files
- scheduler or worker files

Keep the diff bounded to FT-03.

## Tests
Add focused tests covering:
1. product overview mart reads retail metrics from FT-02 truth surfaces
2. product overview mart reads ad spend from Ads-backed truth
3. no fallback to `si_sales_trend_daily_latest`
4. conversion_rate safe math
5. tacos safe math
6. deterministic output for repeated identical inputs
7. date-window behavior for the mart
8. proof/read summary output if a task-local CLI is added

## Required proof
Run one bounded proof in WSL outside sandbox against the configured database.

The proof must use the repo’s actual FT-03 command path.
If a new bounded CLI or verification path is needed, add one and keep it task-local.

The proof output must show:
- success status
- account_id
- marketplace
- asin or ASIN summary as applicable
- source summary proving retail truth is SP-API-backed
- source summary proving ad spend is Ads-backed
- explicit statement that legacy SI fallback is not used
- returned metric summary or row counts

## Acceptance criteria
FT-03 is accepted only if all of the following are true:

1. The product overview mart no longer depends on `si_sales_trend_daily_latest`.
2. Retail sales and traffic come from FT-02 API-backed retail truth.
3. Ad spend comes from existing verified Ads-backed truth.
4. The mart preserves explicit `account_id`, `marketplace`, `asin`, and date-window semantics.
5. The mart remains deterministic.
6. Focused FT-03 tests pass.
7. `npm test` passes.
8. `npm run web:lint` passes.
9. `npm run web:build` passes.
10. A real WSL proof passes and is captured in `docs/v2/BUILD_STATUS.md`.
11. No UI, memory, MCP, ranking automation, scheduler, or unrelated mart scope is added.

## Required checks
Run from WSL repo root:
- focused FT-03 tests
- `npm test`
- `npm run web:lint`
- `npm run web:build`

Also run:
- one real FT-03 WSL proof command outside sandbox

If a task-local CLI is added, also run:
- one success scenario
- one bounded negative scenario if stubbing is available

## BUILD_STATUS update requirements
Update `docs/v2/BUILD_STATUS.md` to include:
- current task: FT-03
- fast-track step status
- files changed
- commands run
- exact pass or fail results
- live WSL proof command and result
- whether FT-03 is complete or blocked
- next fast-track step: FT-04 only if FT-03 passes

Do not mark FT-03 complete unless the real WSL proof passes.

## Final report format
At the end, report:
- files changed
- tests run
- exact command results
- whether scope stayed within FT-03
- whether live WSL proof passed
- whether acceptance passed
- blockers, if any
- exact manual verification still required, if any

Stop before push and wait for operator approval.
