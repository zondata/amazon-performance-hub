# Amazon Performance Hub V2 — Recommended Workflow

## Rule 1
Do not ask Codex to “start building V2”.

## Rule 2
Use ChatGPT thinking mode for:
- architecture decisions
- schema review
- Amazon API design review
- strict task-slice writing
- PR review and failure analysis

## Rule 3
Use Codex for:
- one bounded task at a time
- code changes
- migrations
- tests
- browser checks against your app
- updating `docs/v2/BUILD_STATUS.md`

## Exact loop
1. Pick one stage item from `docs/v2/BUILD_STATUS.md`.
2. Turn it into a strict task using `docs/v2/CODEX_TASK_TEMPLATE.md`.
3. Run the task in Codex cloud/app/CLI.
4. Require Codex to update `docs/v2/BUILD_STATUS.md` in the same branch.
5. Review the diff.
6. If accepted, merge or continue.
7. Only then start the next task.

## Recommended first three tasks
### Task 1
Create the V2 control layer only:
- add `docs/v2/*`
- add `.codex/*`
- update root `AGENTS.md`
- do not touch business logic

### Task 2
Create the V2 repo boundary only:
- add `/v2` routes
- add empty connector/warehouse module folders
- do not implement Amazon APIs yet

### Task 3
Implement SP-API auth skeleton only:
- env contract
- token refresh service
- one testable auth module
- no report ingestion yet

## Stop conditions
Stop the task instead of expanding scope when:
- the task starts needing external credentials
- the task needs product decisions not listed in the build plan
- the task starts touching unrelated V1 pages
- the task needs a second major feature to make the first feature work
