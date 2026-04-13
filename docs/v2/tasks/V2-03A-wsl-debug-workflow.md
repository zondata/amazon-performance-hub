# Task ID
`V2-03A`

## Title
Add WSL-first workflow and debug snapshot handoff only

## Objective
Encode the V2 WSL-first operating rules in repo files and add a single WSL-safe debug snapshot bundle command, without changing app code, business logic, UI, database behavior, or existing V2 feature task scopes.

## Why this task exists
V2 now needs durable repo-native workflow rules for clean pushed state versus broken unpushed local state. This task adds that control layer and the one-command debug handoff path without expanding any product task.

## In-scope files
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/ENV_SETUP.md`
- `docs/v2/CODEX_WORKFLOW.md`
- `docs/v2/DEBUG_HANDOFF.md`
- `docs/v2/tasks/V2-03A-wsl-debug-workflow.md`
- `docs/v2/BUILD_STATUS.md`
- `scripts/debug-snapshot.sh`
- `package.json`

## Out-of-scope files
- `apps/web/**`
- `src/**`
- `supabase/**`
- `.env*` files with real secrets
- any UI, business-logic, database, or Amazon API behavior change

## Constraints
- WSL is the canonical implementation and verification environment.
- Preferred implementation tool is Codex CLI in WSL.
- Do not change existing V2 feature task scopes.
- Do not add heavy tooling or new npm dependencies.
- Do not copy the full repo into the debug snapshot.
- Do not include `.env.local`, secrets, `node_modules`, or large irrelevant output trees in the snapshot.

## Required implementation
1. Update repo instruction files so V2 explicitly uses a WSL-first Codex CLI workflow.
2. Document that pushed GitHub `v2/*` branches are the clean accepted source of truth.
3. Document that broken unpushed local state must hand off through a WSL-generated debug snapshot bundle uploaded to ChatGPT web.
4. Add `npm run snapshot:debug` wired to a WSL-safe shell script.
5. Make the snapshot include:
   - current branch name
   - current HEAD commit SHA
   - `git status --short`
   - `git diff`
   - `git diff --cached`
   - `docs/v2/BUILD_STATUS.md` if it exists
   - the current bounded task file under `docs/v2/tasks/` if determinable
   - any available verification log
   - changed working-tree files copied into the snapshot
   - a short README for ChatGPT web handoff
6. Document `v2/*` for main task branches and `debug/*` for optional broken remote backups.

## Forbidden changes
- Do not change app code or business logic.
- Do not change existing V2 task scopes.
- Do not add UI.
- Do not add database or Supabase changes.
- Do not add heavy tooling or new package dependencies unless absolutely required.

## Required tests
- `npm run snapshot:debug`
- `ls -lah out/debug-snapshots || true`
- `unzip -l out/debug-snapshots/*.zip | sed -n '1,120p' || true`

## Acceptance checks
- Repo docs state that V2 implementation runs in WSL and prefers Codex CLI in WSL.
- Repo docs state that WSL is the verification authority.
- Repo docs state that pushed `v2/*` branches are the clean source of truth.
- Repo docs state that failed local verification should hand off through `npm run snapshot:debug` instead of pushing broken code to the main task branch.
- `npm run snapshot:debug` produces a timestamped folder and zip bundle and prints the final bundle path.
- The bundle contains diffs, status, task context, README, and copied changed files without including secrets or full-repo junk.

## Required status update
Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-03A`
- keep the current stage context intact
- append one task-log row
- record the snapshot validation commands actually run
- record that this task does not replace the pending `V2-03` product verification
