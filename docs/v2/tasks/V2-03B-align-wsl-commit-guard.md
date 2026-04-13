# Task ID
`V2-03B`

## Title
Align the local Git commit guard with the WSL-first policy

## Objective
Replace the obsolete V2 local commit block with WSL-first Git hook behavior that allows normal local commits on `v2/*` after WSL verification, while still blocking unsafe artifacts like secrets and debug bundles.

## Why this task exists
The repo workflow policy is now WSL-first. The old pre-commit hook still encoded the previous Codex-App-only model and blocked valid local work on `v2/*`, so the hook layer needed to be aligned with the repo docs.

## In-scope files
- `.githooks/pre-commit`
- `docs/v2/ENV_SETUP.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/V2-03B-align-wsl-commit-guard.md`

## Out-of-scope files
- `apps/web/**`
- `src/**`
- `supabase/**`
- `.env*` files with real secrets
- any UI, business-logic, database, or Amazon API behavior change

## Constraints
- Do not block all local commits on `v2/*` just because they are local.
- Keep only guardrails that match the WSL-first workflow.
- Do not change app code or business logic.

## Required implementation
1. Remove the old `ALLOW_LOCAL_V2_COMMIT` branch block from `.githooks/pre-commit`.
2. Add WSL-first hook messaging that allows normal local commits on `v2/*`.
3. Keep useful guardrails by blocking staged secrets and staged debug snapshot artifacts.
4. Warn on `v2/*` when `docs/v2/BUILD_STATUS.md` is not staged.
5. Update setup/status docs so the hook behavior matches the repo’s WSL-first policy.

## Forbidden changes
- Do not restore the Codex-App-only branch block.
- Do not add new tooling or npm dependencies.
- Do not change any V2 product scope.

## Required tests
- `git config --get core.hooksPath`
- `sed -n '1,220p' .githooks/pre-commit || true`
- `git status`
- `git add AGENTS.md docs/v2/CODEX_WORKFLOW.md docs/v2/ENV_SETUP.md docs/v2/DEBUG_HANDOFF.md docs/v2/AGENTS.md docs/v2/BUILD_STATUS.md docs/v2/tasks/V2-03A-wsl-debug-workflow.md scripts/debug-snapshot.sh package.json .githooks/pre-commit 2>/dev/null || true`
- `git commit -m "Add WSL-first workflow and align local commit guard"`
- `git status`

## Acceptance checks
- The hook no longer blocks local commits on `v2/*` simply because they are local.
- Old Codex-App-only hook messaging is removed.
- The hook still blocks staged secrets and debug snapshot artifacts.
- Repo docs and hook behavior both describe the same WSL-first workflow.
- The requested commit succeeds without using `ALLOW_LOCAL_V2_COMMIT`.

## Required status update
Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-03B`
- keep the current stage context intact
- append one task-log row
- record the hook validation and commit attempt
- note that `V2-03` product verification is still pending in WSL
