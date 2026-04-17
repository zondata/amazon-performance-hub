# Amazon Performance Hub V2 — Codex Task Spec

## Task ID
`S2B-G4`

## Title
Gate: Stage 2B tests green

## Objective
Implement one bounded Stage 2B gate task that:
1. verifies all completed Stage 2B deliverables run together without regression,
2. adds any minimal missing glue strictly required for the existing Stage 2B commands to pass together,
3. proves the full Stage 2B bounded command set is green in WSL,
without widening into Stage 3 orchestration, new Amazon pull scope, UI work, schema redesign, or new product features.

## Why this task exists
This is the next bounded task after `S2B-G3` on branch `v2/02-sp-api-auth`.

Stage 2B has already completed the bounded feature and ingest tasks:
- `S2B-02` Ads auth boundary
- `S2B-03` profile sync and internal profile mapping
- `S2B-04` campaign daily connector
- `S2B-05` target daily connector
- `S2B-06` local landing + normalization persistence
- `S2B-G2` first Sponsored Products campaign daily ingest succeeds
- `S2B-G3` first Sponsored Products target daily ingest succeeds

The remaining Stage 2B gate now required is:
- `S2B-G4 — Gate: Stage 2B tests green`

This task is a gate-only verification and stabilization step. It must not introduce new product scope.

## In-scope files
Codex may change only these files:

- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S2B-G4-stage-2b-tests-green.md`
- `package.json`
- `src/connectors/ads-api/README.md`
- `src/connectors/ads-api/index.ts`
- `src/connectors/ads-api/types.ts`

Codex may also make the smallest necessary bounded fixes in existing `src/connectors/ads-api/**` implementation files only if one of the required Stage 2B commands fails and the failure is caused by a real regression or missing glue inside current Stage 2B scope.

Allowed implementation files only if required:
- `src/connectors/ads-api/auth.ts`
- `src/connectors/ads-api/env.ts`
- `src/connectors/ads-api/loadLocalEnv.ts`
- `src/connectors/ads-api/profiles.ts`
- `src/connectors/ads-api/profileSyncCli.ts`
- `src/connectors/ads-api/spCampaignDaily.ts`
- `src/connectors/ads-api/spCampaignDailyCli.ts`
- `src/connectors/ads-api/spTargetDaily.ts`
- `src/connectors/ads-api/spTargetDailyCli.ts`
- `src/connectors/ads-api/adsPersistence.ts`
- `src/connectors/ads-api/adsPersistenceCli.ts`
- `src/connectors/ads-api/campaignIngestGate.ts`
- `src/connectors/ads-api/campaignIngestGateCli.ts`
- `src/connectors/ads-api/targetIngestGate.ts`
- `src/connectors/ads-api/targetIngestGateCli.ts`

## Out-of-scope files
Codex must not change any of these:

- `.env*`
- `apps/web/**`
- `src/connectors/sp-api/**`
- `src/ingestion/**`
- `src/warehouse/**`
- `src/marts/**`
- `src/diagnosis/**`
- `src/memory/**`
- `src/changes/**`
- `supabase/**`
- any V1 app route or V1 business logic file unrelated to current Stage 2B commands
- any GitHub workflow file
- any browser automation file
- any new Stage 3 file
- any new Amazon pull connector beyond the already completed Stage 2B commands

## Constraints
- No unrelated refactors.
- No design expansion.
- No hidden schema redesign.
- No new Amazon pull scope.
- No new ingestion family.
- No new warehouse sink.
- No UI changes.
- No browser automation.
- Do not commit secrets.
- Do not print full secrets in CLI output, tests, docs, or status files.
- Use WSL as the canonical verification environment.
- Keep this task gate-only.
- Prefer fixing only the exact failure that blocks the Stage 2B gate.
- If all required commands already pass, do not invent extra code changes.

## Required Stage 2B gate command set
Codex must verify this exact command set in WSL:

1. `npm test`
2. `npm run verify:wsl`
3. `npm run adsapi:sync-profiles`
4. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16`
5. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-target-daily -- --start-date 2026-04-10 --end-date 2026-04-16`
6. `npm run adsapi:persist-sp-daily`
7. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-campaign-daily`
8. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-target-daily`

Rules:
- Commands 4, 5, 7, and 8 must use `APP_ACCOUNT_ID=sourbear` in the shell for this gate unless the implementation is explicitly updated so that the local default is already correct and no override is needed.
- If a command fails, fix only the minimum bounded Stage 2B issue required, then rerun the full gate set.
- Record actual results for each command.

## Required implementation
Only implement changes if needed after running the gate set.

Allowed stabilization work:
- fix a broken import/export inside current Stage 2B files
- fix a bounded local artifact path mismatch
- fix a bounded metadata consistency bug inside current Stage 2B commands
- fix a bounded CLI summary or validation issue that causes the gate to fail
- fix a bounded regression in the current ingest gate wrappers

Not allowed:
- adding new feature scope
- adding new external integrations
- changing task IDs or stage structure
- broad cleanup unrelated to a gate failure

## Required acceptance evidence
Codex must produce a short gate summary that states:
- all Stage 2B commands run
- which commands required unrestricted reruns
- whether `APP_ACCOUNT_ID=sourbear` override was required
- final status: Stage 2B gate green or not green

## Forbidden changes
Codex must not do any of the following:

- do not add any new env variable unless strictly required and justified
- do not rename the operator’s working `AMAZON_ADS_*` or `APP_*` env keys
- do not commit `.env.local`
- do not widen into Stage 3
- do not add new Ads connector scope
- do not edit SP-API files
- do not add Supabase schema or migrations unless absolutely required to repair the already-existing Stage 2B sink path and there is no current compatible path
- do not change branch workflow files or AGENTS docs beyond the files explicitly allowed above

## Required tests
Codex must run all of the following in WSL and record actual results:

1. `npm test`
2. `npm run verify:wsl`
3. `npm run adsapi:sync-profiles`
4. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16`
5. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-target-daily -- --start-date 2026-04-10 --end-date 2026-04-16`
6. `npm run adsapi:persist-sp-daily`
7. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-campaign-daily`
8. `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-target-daily`

## Acceptance checks
The task is complete only if all of the following are true:

1. All required Stage 2B commands succeed in WSL.
2. No new Stage 2B feature scope was added beyond minimal stabilization work.
3. `docs/v2/BUILD_STATUS.md` records `S2B-G4` as complete.
4. `docs/v2/TASK_REGISTRY.json` marks `S2B-G4` as `done`.
5. `docs/v2/TASK_PROGRESS.md` is regenerated.
6. The final task log states Stage 2B tests are green.
7. No file outside the allowed in-scope list is changed.

## Required status update
Codex must update `docs/v2/BUILD_STATUS.md` in the same branch:

- set `Last updated`
- keep `Current branch` as `v2/02-sp-api-auth`
- keep `Current stage` as `Stage 2B — Ads API auth + first Sponsored Products pulls`
- set `Current task` to `S2B-G4 - Gate: Stage 2B tests green`
- mark the task as `complete` only if the required gate command set above actually passed
- append one row to `Task log`
- record all tests actually run
- state whether the Stage 2B gate is green
- state the next bounded task after `S2B-G4`

Codex must also update `docs/v2/TASK_REGISTRY.json` so:
- `S2B-G4` becomes `done`

Codex must regenerate `docs/v2/TASK_PROGRESS.md`.

## Manual test requirement
MANUAL TEST REQUIRED:
1. Run the same Stage 2B gate command set in WSL if Codex asks for operator confirmation
2. Confirm all commands succeed
3. Confirm no token values or client secrets appear in CLI output
4. Confirm the gate summary says Stage 2B is green

## Output format
Codex final response for the task must include:
1. what changed
2. every gate command run and result
3. blockers or follow-up
4. exact manual test steps if needed
