# Amazon Performance Hub V2 — Codex Task Template

Use this template for every V2 task.
Do not remove sections.

---

## Task ID
`V2-XX`

## Title
One-line task title.

## Objective
State one outcome only.

## Why this task exists
State the exact stage or checklist item it advances.

## In-scope files
List exact files or directories Codex may change.

## Out-of-scope files
List exact files or directories Codex must not change.

## Constraints
- No unrelated refactors.
- No design expansion.
- No hidden schema changes.
- No new environment variables unless the task explicitly requires them.
- No Amazon writeback logic unless the task explicitly requires it.

## Required implementation
List the concrete changes required.

## Forbidden changes
List concrete things that must not change.

## Required tests
List exact commands Codex must run.
If the task is browser-facing, include the exact Playwright or browser-smoke command here.

## Acceptance checks
List exact checks that prove the task is done.
If browser behavior is in scope, include the machine-checkable browser assertions separately from any human-only visual checks.

## Required status update
Codex must update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task`
- set `Current branch`
- set `Current stage`
- mark status
- append one row to `Task log`
- record tests actually run
- record exact browser-check commands and results when applicable
- record whether the task is auto-verified or still requires manual verification
- if manual verification is still required, record the exact reason

## Output format
Codex final response for the task must include:
1. what changed
2. exact tests run and results
3. exact browser-check commands and results when applicable
4. whether changed files stayed within task scope
5. whether acceptance checks passed
6. whether the task is ready for operator approval after automated verification
7. blockers or follow-up
8. exact manual test steps only if manual verification is still required
