# T-PLAYWRIGHT-01 — Ignore Playwright artifacts and formalize local browser-test workflow

## Objective
Add the minimum repo hygiene and workflow policy needed so the new local Playwright setup is safe and repeatable: ignore generated Playwright artifacts and document when and how Codex should use Playwright for browser-facing V2 tasks.

## Why this task exists
Playwright is now configured locally and a smoke test for `/v2/admin/imports` has passed. The repo still needs two bounded follow-ups:
1. ignore generated Playwright artifacts such as `test-results/`
2. formalize Playwright usage in the repo rules so future Codex UI tasks can run browser checks consistently

## Important local-read rule
Read these files from the LOCAL WSL working tree first:
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/BUILD_STATUS.md`

If local versions differ from GitHub, the LOCAL working-tree versions are the source of truth for this task.

## Allowed files
- `.gitignore`
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/T-PLAYWRIGHT-01-ignore-artifacts-and-formalize-browser-checks.md`

## Forbidden changes
Do not change:
- application code
- `apps/web/*`
- `src/connectors/*`
- `src/ingestion/*`
- database migrations
- product behavior
- Playwright test logic itself unless strictly required for repo hygiene
- any Amazon integration logic
- any scheduler/runner logic
- any warehouse or mart logic

Do not add:
- new product features
- new UI behavior
- broad refactors
- browser automation against Amazon Seller Central or Amazon Ads console

## Required implementation

### 1. Ignore generated Playwright artifacts
Update `.gitignore` to ignore the generated Playwright outputs used by the new local setup.

At minimum, ignore:
- `test-results/`

Also ignore Playwright report output if the current config generates it, but only if it actually applies to the repo’s setup.

Do not remove existing ignore rules.

### 2. Formalize Playwright usage in root AGENTS
Update `AGENTS.md` so it clearly states:
- Playwright may be used for browser-facing local app verification
- Playwright is for testing the local app only
- Playwright must not be used against Amazon Seller Central, Amazon Ads console, or other live external sites requiring real operator login
- For browser-facing V2 tasks, Codex should prefer automated local Playwright checks before asking for manual verification when the checks are machine-verifiable

### 3. Formalize Playwright usage in V2 AGENTS
Update `docs/v2/AGENTS.md` so it clearly states:
- browser-facing V2 tasks may use Playwright against the local or staging V2 app
- Playwright is allowed for routes like `/v2/*`
- Codex should include Playwright in automated verification for browser-facing V2 tasks when feasible
- manual verification is still required when acceptance depends on human judgment, external auth flows, or ambiguous UI behavior
- Playwright must not target Amazon-operated consoles

### 4. Formalize Playwright usage in the V2 task template
Update `docs/v2/CODEX_TASK_TEMPLATE.md` so future task specs can explicitly include Playwright when relevant.

The template should support:
- listing Playwright/browser checks under required tests when the task is browser-facing
- stating whether browser verification was auto-verified or still requires manual confirmation
- recording exact browser commands and results in the final output format when applicable

## Acceptance checks
The task is complete only if all of the following are true:
1. `.gitignore` ignores `test-results/`
2. root `AGENTS.md` explicitly allows local-app Playwright checks and forbids Amazon-console automation
3. `docs/v2/AGENTS.md` explicitly allows Playwright for browser-facing V2 local-app tasks
4. `docs/v2/CODEX_TASK_TEMPLATE.md` supports browser-check reporting when relevant
5. no application/product code changed
6. `docs/v2/BUILD_STATUS.md` is updated for this tooling/policy task

## Required commands
Run all of these in WSL if available:
1. `git diff -- .gitignore AGENTS.md docs/v2/AGENTS.md docs/v2/CODEX_TASK_TEMPLATE.md docs/v2/BUILD_STATUS.md`
2. `npm run test:e2e:v2-admin-imports`
3. `npm run web:lint`
4. `node scripts/v2-progress.mjs --write`

If any command is not relevant or not runnable, record the exact reason in `docs/v2/BUILD_STATUS.md`.

## Automated verification expectation
Codex must:
- verify only the allowed files changed
- verify `test-results/` is ignored
- rerun the existing Playwright smoke test
- report whether the policy changes are now in the working tree and ready for operator approval

## MANUAL TEST REQUIRED ONLY IF NEEDED
Only require manual verification if the policy text or ignore behavior cannot be confirmed automatically.
If manual verification is still required, provide exact steps and exact reason.

## Status file update requirements
Update `docs/v2/BUILD_STATUS.md` in the same task with:
- `Last updated`
- `Current task: T-PLAYWRIGHT-01 - Ignore Playwright artifacts and formalize browser checks`
- `Current stage: Stage 3 — ingestion backbone`
- a new task-log row
- tests actually run
- whether the task is auto-verified or still requires manual verification
- if manual verification is still required, the exact reason
- next bounded product task remains: `S3-06 - Build manual Helium 10 rank CSV import with validation and dedupe` unless the current local plan says otherwise

## Commit scope rule
Stage and commit only:
- `.gitignore`
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- the canonical tracked task spec for this tooling task

Do not stage unrelated scratch/spec files.
