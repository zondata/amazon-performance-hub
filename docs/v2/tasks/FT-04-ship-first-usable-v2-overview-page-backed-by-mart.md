# FT-04 — Ship the first usable V2 Overview page backed only by the product overview mart

## Task ID
FT-04

## Title
Ship the first usable V2 Overview page backed only by the product overview mart

## Why this task exists
FT-01 completed the SP-API retail sales and traffic ingest truth path.
FT-02 completed the API-backed retail warehouse truth contract.
FT-03 completed the product overview mart cutover off SI and onto API-backed retail plus Ads-backed sources.

The next fast-track step is to expose that mart through the first usable V2 Overview page so the operator can actually use the system without relying on manual sales imports.

This task follows the fast-track control note in:
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`
- `docs/v2/BUILD_STATUS.md`

This is still a sequence adjustment, not an architecture change.

## Goal
Implement the first usable V2 Overview page at the existing V2 Overview route, backed only by the FT-03 product overview mart.

The page must let the operator load one ASIN and one explicit date window and see the core product overview metrics from the mart, with source and fallback state visible enough to confirm the page is using API-backed truth rather than SI.

## Source of truth
Use these repo files as source of truth:
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/V2-fast-track-minimum-usable-api-path.md`

Also reuse the already-landed FT-03 product overview mart contract and any existing V2 route skeleton already present in the repo.

Do not renumber tasks or alter stage definitions.

## Dependency
FT-01 is complete and pushed.
FT-02 is complete and pushed.
FT-03 is complete and pushed.

Reuse:
- FT-03 product overview mart
- existing V2 route boundary for `/v2/overview/[asin]`
- existing repo UI patterns only where strictly needed

## In scope
Implement only the bounded work required to make the first V2 Overview page usable, including:
- V2 Overview page read path wired to the FT-03 product overview mart only
- explicit date-window controls or URL query parameters for start and end date
- ASIN-scoped loading at the V2 Overview route
- rendering of the core overview metrics already supported by the mart
- visible source/fallback status sufficient to confirm API-backed truth and no SI fallback
- bounded empty-state and no-data handling
- focused automated tests
- `docs/v2/BUILD_STATUS.md` update for FT-04 completion

## Out of scope
Do not add or change any of the following:
- Queries page
- root-cause panel
- query mart
- rank mart
- memory system
- diagnosis engine
- change logging
- MCP or agent surfaces
- scheduler, cron, workers, daemons
- SB or SD expansion
- Helium 10 automation
- broad UI redesign outside the V2 Overview page
- execution handoff flows
- writeback to Amazon
- task-registry renumbering

## Required implementation outcome
Create or finish one bounded Overview page such that:
1. `/v2/overview/[asin]` reads only from the FT-03 product overview mart,
2. the page does not read from `si_sales_trend_daily_latest`,
3. the page shows the core overview metrics returned by the mart,
4. the page accepts an explicit date window,
5. the page handles no-data and partial-data states safely,
6. the page is usable enough for the operator to inspect one ASIN’s core overview metrics.

## Required Overview page contents
The first usable page must show at minimum:
- ASIN identity
- selected date window
- sales
- orders
- sessions
- conversion rate
- ad spend
- TACOS

The page must also show a bounded source/state section that includes:
- retail truth source summary
- ads truth source summary
- explicit legacy SI fallback state

If the FT-03 mart already exposes diagnostics, show them in a bounded readable section.
Do not invent a large analytics dashboard in this task.

## URL and input behavior
The page must support:
- route param ASIN from `/v2/overview/[asin]`
- explicit start date
- explicit end date

Acceptable implementations:
- URL search params
- bounded form controls reflected into the URL
- another existing repo convention for route-driven filters

The date window must be explicit and reproducible.
Do not use hidden rolling windows.

## Data-source rules
### Required source
The page must read from the FT-03 product overview mart only.

### Forbidden fallback
Do not read from or silently fall back to:
- `si_sales_trend_daily_latest`
- legacy SI SalesTrend-based product loaders
- raw retail tables directly
- raw ads tables directly

The page must consume the mart, not rebuild the metrics in the page layer.

## UI behavior rules
### Loading
Show a bounded loading state while the mart data is loading.

### Empty or missing data
If the mart returns no rows or only partial rows:
- show a clear no-data or partial-data state
- do not crash
- do not fabricate metrics

### Errors
Show a bounded operator-readable error state if the page load fails.

### Scope
Do not build tabs, drilldowns, side panels, cards for unrelated systems, or multi-page navigation in this task.
Keep the page narrowly focused on first usable Overview.

## Scope guardrails
### Allowed file areas
Expected file areas include only what is required for FT-04, such as:
- `apps/web/**` for the bounded V2 Overview route and components
- `src/marts/**` only if tiny mart read wiring is strictly required
- directly related tests
- `docs/v2/BUILD_STATUS.md`

### Forbidden unrelated file areas
Do not touch:
- `src/memory/**`
- `src/diagnosis/**`
- `src/changes/**`
- Helium 10 files
- unrelated admin/import dashboard files
- scheduler or worker files
- query-facing UI files unless a tiny shared helper is strictly required

Keep the diff bounded to FT-04.

## Tests
Add focused tests covering:
1. Overview page reads from the product overview mart path
2. Overview page does not use SI fallback
3. Overview page renders the required metrics
4. explicit start/end date behavior
5. no-data state
6. partial-data or diagnostics rendering if supported
7. bounded error state
8. any route loader or page-level helper added in this task

If browser coverage is practical within existing repo patterns, add one bounded smoke test for the Overview route using seeded or stubbed data.
Do not test Amazon sites.

## Required proof
Run one bounded proof in WSL outside sandbox.

The proof must include:
- one real page-backed verification path for `/v2/overview/[asin]` using the FT-03 mart data path, or
- one bounded browser smoke test against the local app if the repo already supports it

The proof must show:
- the Overview route loads
- the page uses the mart-backed API truth path
- the page shows explicit source/fallback state
- the page handles the proof ASIN/date window successfully

If browser proof is not yet practical, use the strongest bounded route or server-side proof path available and state exactly what was proved.

## Acceptance criteria
FT-04 is accepted only if all of the following are true:

1. The V2 Overview page is usable at the existing V2 Overview route.
2. The page reads only from the FT-03 product overview mart.
3. The page does not depend on `si_sales_trend_daily_latest`.
4. The page shows the required core overview metrics.
5. The page supports explicit date-window input.
6. The page exposes bounded source/fallback state proving API-backed truth and no SI fallback.
7. Focused FT-04 tests pass.
8. `npm test` passes.
9. `npm run web:lint` passes.
10. `npm run web:build` passes.
11. A real WSL proof passes and is captured in `docs/v2/BUILD_STATUS.md`.
12. No Queries UI, memory, MCP, ranking automation, scheduler, or unrelated scope is added.

## Required checks
Run from WSL repo root:
- focused FT-04 tests
- `npm test`
- `npm run web:lint`
- `npm run web:build`

Also run:
- one real FT-04 WSL proof outside sandbox

If a browser smoke test is added, run it against the local app only.

## BUILD_STATUS update requirements
Update `docs/v2/BUILD_STATUS.md` to include:
- current task: FT-04
- fast-track step status
- files changed
- commands run
- exact pass or fail results
- live WSL proof command and result
- whether FT-04 is complete or blocked
- next fast-track step after FT-04 only if FT-04 passes

Do not mark FT-04 complete unless the real WSL proof passes.

## Final report format
At the end, report:
- files changed
- tests run
- exact command results
- whether scope stayed within FT-04
- whether live WSL proof passed
- whether acceptance passed
- blockers, if any
- exact manual verification still required, if any

Stop before push and wait for operator approval.
