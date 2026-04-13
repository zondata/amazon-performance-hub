# V2 Build Status

Last updated: `2026-04-13`
Current branch: `v2/02-sp-api-auth`
Current task: `V2-03B - Align the local Git commit guard with the WSL-first policy`
Current stage: `Stage 2A - SP-API auth + first Sales and Traffic pull`

## Stage checklist
- [x] `Stage 1` - Repo boundary and V2 route/module skeleton
- [ ] `Stage 2A` - SP-API auth + first Sales and Traffic pull

## Current task card
- Task ID: `V2-03B`
- Title: `Align the local Git commit guard with the WSL-first policy`
- Objective: Replace the obsolete V2 local commit block with WSL-first hook behavior that allows normal local commits on `v2/*` after WSL verification, while still blocking unsafe artifacts like secrets and debug bundles.
- Allowed files:
  - `.githooks/pre-commit`
  - `docs/v2/ENV_SETUP.md`
  - `docs/v2/BUILD_STATUS.md`
  - `docs/v2/tasks/V2-03B-align-wsl-commit-guard.md`
  - `docs/v2/BUILD_STATUS.md`
- Forbidden:
  - `apps/web/**`
  - `src/**`
  - `supabase/**`
  - `.env*` files with real secrets
  - any UI, business-logic, Amazon API, or admin feature changes
  - any database or Supabase change
- Required checks:
  - [x] `git config --get core.hooksPath`
  - [x] `sed -n '1,220p' .githooks/pre-commit || true`
  - [x] `git status`
  - [x] `git add AGENTS.md docs/v2/CODEX_WORKFLOW.md docs/v2/ENV_SETUP.md docs/v2/DEBUG_HANDOFF.md docs/v2/AGENTS.md docs/v2/BUILD_STATUS.md docs/v2/tasks/V2-03A-wsl-debug-workflow.md scripts/debug-snapshot.sh package.json .githooks/pre-commit 2>/dev/null || true`
  - [ ] `git commit -m "Add WSL-first workflow and align local commit guard"`
  - [ ] `git status`
- Status: `in progress`
- Notes:
  - This is a workflow hardening sidecar task only; it does not widen or replace the existing `V2-03` feature scope.
  - The old local V2 commit block and `ALLOW_LOCAL_V2_COMMIT` override are being removed from the active hook path.
  - The replacement hook will allow normal local commits on `v2/*`, block staged `.env*` files and staged debug snapshot artifacts, and warn when `docs/v2/BUILD_STATUS.md` is not staged on a `v2/*` branch.

## Task log
| Date | Task ID | Branch | Scope | Result | Tests run | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-04-12 | `V2-01` | `v2/01-repo-boundary` | Create V2 route boundary and placeholder module boundaries only. | `complete` | `operator later confirmed npm run verify:wsl passed` | Stage 2A depends on SP-API auth and first real call proof. |
| 2026-04-12 | `V2-02` | `v2/01-repo-boundary` | Create the SP-API auth skeleton only: typed env/config validation, endpoint resolution, and refresh-token exchange boundary. | `complete` | `operator confirmed npm run verify:wsl passed` | First real SP-API call proof is still required before Stage 2A can be completed. |
| 2026-04-12 | `V2-03` | `v2/01-repo-boundary` | Add one real SP-API Sellers read-call path with minimal SigV4 signing, safe summary output, and no report sync/warehouse/UI/Ads API scope expansion. | `in progress` | `operator confirmed npm run verify:wsl passed; npm run spapi:first-call initially failed because the CLI was not loading repo-local .env.local; rerun required after env-loader fix` | Next bounded task should be the first report call path after manual confirmation of the real-call proof. |
| 2026-04-13 | `V2-03` | `v2/02-sp-api-auth` | Correct the first-call boundary to LWA-only env + `x-amz-access-token`, keep Sellers `getMarketplaceParticipations` as the bounded first real call after the Selling Partner Insights role correction, and avoid any Reports API/SigV4 expansion in this task. | `in progress` | `npm test passed; npm run web:lint passed; npm run web:build passed after an unrestricted rerun because the sandboxed build could not fetch Google Fonts` | Operator still needs to run `npm run verify:wsl` and `npm run spapi:first-call`, then paste both results; next bounded task remains the first report call path only. |
| 2026-04-13 | `V2-03A` | `v2/02-sp-api-auth` | Add repo-level WSL-first workflow rules, a debug snapshot handoff command, and ChatGPT web handoff docs without changing app/business logic/UI/database scope. | `complete` | `npm run snapshot:debug passed; snapshot zip contents inspected with ls/unzip` | `V2-03` feature verification is still pending in WSL; after that, the next bounded product task remains the first report call path only. |
| 2026-04-13 | `V2-03B` | `v2/02-sp-api-auth` | Remove the obsolete local `v2/*` commit block, align `.githooks/pre-commit` with the WSL-first policy, and validate that a normal local commit can proceed without `ALLOW_LOCAL_V2_COMMIT`. | `in progress` | `git config --get core.hooksPath passed; pre-commit hook inspected; git add prepared requested workflow files` | Commit attempt and post-commit status still need to be recorded; `V2-03` product verification remains pending in WSL. |

## Tests and verification
- Codex in-task validation:
  - `npm run snapshot:debug` passed and produced a timestamped bundle in `out/debug-snapshots/`.
  - `ls -lah out/debug-snapshots || true` inspected the snapshot output directory.
  - `unzip -l out/debug-snapshots/*.zip | sed -n '1,120p' || true` inspected the generated bundle contents.
  - `git config --get core.hooksPath` returned `.githooks`.
  - `sed -n '1,220p' .githooks/pre-commit || true` inspected the active hook implementation before replacement.
- Pending product-task verification on this branch:
  - `npm run verify:wsl`
  - `npm run spapi:first-call`

## Open blockers
- `V2-03` still needs operator confirmation that both `npm run verify:wsl` and `npm run spapi:first-call` succeed in the trusted WSL environment with real credentials.
- The next bounded task should remain focused on the first report call path only after this proof-of-read step is confirmed.
