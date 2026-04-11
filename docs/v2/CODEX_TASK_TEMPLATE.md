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

## Acceptance checks
List exact checks that prove the task is done.

## Required status update
Codex must update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task`
- set `Current branch`
- set `Current stage`
- mark status
- append one row to `Task log`
- record tests actually run
- record any manual follow-up exactly

## Output format
Codex final response for the task must include:
1. what changed
2. tests run and results
3. blockers or follow-up
4. exact manual test steps if needed
