# T-PLAN-HELIUM10-01 — Update build plan with Helium 10 automation evaluation note

## Objective
Update the V2 build plan to record that Helium 10 has no API for this workflow, that Playwright-based CSV export automation is being evaluated in local WSL, and that manual CSV import remains the active fallback until the automation path is proven.

## Why this task exists
The current build plan already says Helium 10 remains an external dependency until ranking automation is proven and that Release 1 keeps manual CSV import. That is still correct. What is missing is an explicit evaluation note documenting the candidate Playwright export path and its constraints.

## Scope
Documentation-only task. No product code, no Playwright code, no ingestion code.

## Allowed files
- `docs/v2/amazon-performance-hub-v2-build-plan.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/tasks/T-PLAN-HELIUM10-01-build-plan-evaluation-note.md`

## Forbidden changes
- No application code
- No connector changes
- No ingestion logic changes
- No UI changes
- No tests required beyond doc-scope verification
- Do not claim automation is adopted or production-ready

## Required implementation

### 1. Add an evaluation note to the build plan
Update the build plan in the sections that talk about Helium 10 so it clearly states:
- Helium 10 has no API for the current keyword-tracker export need
- a Playwright-based Historical Data CSV export path is under evaluation
- the current evaluation target is local WSL using dedicated credentials from env/local secret storage
- the manual CSV import path remains the active supported fallback until automation is proven stable
- final hosted/cloud design must not depend on the operator’s personal Chrome session

### 2. Keep the current strategic position intact
Do not rewrite the build plan to say Helium 10 automation is already adopted.
This task must preserve:
- manual import remains supported
- automation is optional until proven
- scraping/automation maintenance risk remains real

### 3. Record the follow-up rule
Add a short note that once the export automation is proven, the build plan can be updated again to move the path from “under evaluation” to “proven local path”.

## Acceptance checks
1. Build plan now mentions Playwright-based Helium 10 export evaluation explicitly.
2. Build plan still keeps manual import as the active fallback.
3. Build plan does not falsely claim the export automation is already proven or adopted.
4. `docs/v2/BUILD_STATUS.md` is updated for this doc task.

## Required commands
Run in WSL:
1. `git diff -- docs/v2/amazon-performance-hub-v2-build-plan.md docs/v2/BUILD_STATUS.md`

## Status file update requirements
Update `docs/v2/BUILD_STATUS.md` with:
- current task
- a short task-log row
- note that this was a documentation-only evaluation-note task
- next bounded product task remains the Helium 10 export proof task

## Commit scope rule
Stage and commit only:
- `docs/v2/amazon-performance-hub-v2-build-plan.md`
- `docs/v2/BUILD_STATUS.md`
- progress files if required
- canonical task spec under `docs/v2/tasks/`
