# Amazon Performance Hub V2 — Codex Task Spec

## Task ID
`S2B-G3`

## Title
Gate: first Sponsored Products target daily ingest succeeds

## Objective
Implement one bounded gate path that takes the existing local persisted Sponsored Products target daily data produced by `S2B-06`, ingests the target daily rows through the repo’s current Sponsored Products targeting ingest sink, and proves that one end-to-end command/job writes target daily facts successfully for one account/profile/date-range scope.

## Why this task exists
This is the next bounded task after `S2B-G2` on branch `v2/02-sp-api-auth`.
`S2B-04`, `S2B-05`, and `S2B-06` already proved:
- bounded Ads auth,
- profile sync,
- campaign daily pull,
- target daily pull,
- local persistence.

`S2B-G2` then proved one real Sponsored Products campaign daily ingest succeeds.

The remaining Stage 2B ingest gate now required is:
- `S2B-G3 — Gate: first Sponsored Products target daily ingest succeeds`

This task must prove one real target ingest path succeeds. It must not widen into campaign ingest changes beyond what is already shipped, Stage 3 orchestration, UI work, or a schema redesign.

## In-scope files
Codex may change only these files:

- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S2B-G3-first-sp-target-daily-ingest-gate.md`
- `package.json`
- `src/connectors/ads-api/README.md`
- `src/connectors/ads-api/index.ts`
- `src/connectors/ads-api/types.ts`
- `src/connectors/ads-api/targetIngestGate.ts`
- `src/connectors/ads-api/targetIngestGateCli.ts`
- `src/connectors/ads-api/targetIngestGate.test.ts`
- `src/connectors/ads-api/targetIngestGateCli.test.ts`

Codex may also make minimal bounded changes to the existing current Sponsored Products targeting ingest sink only if required to reuse it from the gate command, and only in the smallest set of files necessary after inspecting the repo.

Allowed sink-touch files only if required:
- existing current SP targeting ingest implementation files already used by the repo
- existing current SP targeting mapping or persistence helper files already used by the repo
- no unrelated ingest modules

## Out-of-scope files
Codex must not change any of these:

- `.env*`
- `apps/web/**`
- `src/connectors/sp-api/**`
- `src/connectors/ads-api/spCampaignDaily*`
- `src/connectors/ads-api/spTargetDaily*`
- `src/connectors/ads-api/campaignIngestGate*`
- `src/warehouse/**`
- `src/marts/**`
- `src/diagnosis/**`
- `src/memory/**`
- `src/changes/**`
- any V1 app route or V1 business logic file unrelated to the current SP targeting ingest sink
- any GitHub workflow file
- any browser automation file
- any campaign gate or Stage 3 orchestration file
- any search-term or keyword Ads connector file

## Constraints
- No unrelated refactors.
- No design expansion.
- No hidden schema redesign.
- No new Amazon pull path.
- No campaign gate rewrites.
- No Stage 3 orchestration.
- No UI changes.
- No browser automation.
- Do not commit secrets.
- Do not print full secrets in CLI output, tests, docs, or status files.
- Use WSL as the canonical verification environment.
- Reuse the existing local persisted artifact from `S2B-06`.
- Reuse the repo’s current Sponsored Products targeting ingest sink instead of inventing a parallel sink.
- Keep this task bounded to one real target daily ingest gate proof only.

## Required local-input contract for this task
Required existing local input artifact:
- `out/ads-api-persisted/normalized/ads-sp-daily.persisted.json`

Required validation:
- file exists
- JSON parses
- `targetRowCount >= 1`
- `targetRows` exists and is non-empty
- all target rows agree on:
  - `appAccountId`
  - `appMarketplace`
  - `profileId`
- the artifact date range matches the gate command inputs unless the command explicitly chooses to ingest the full persisted artifact range

## Required implementation

### 1. Build one bounded target ingest gate module
Create `src/connectors/ads-api/targetIngestGate.ts`.

Required behavior:
- load and validate `out/ads-api-persisted/normalized/ads-sp-daily.persisted.json`
- extract only `targetRows`
- transform those rows into the exact input shape required by the repo’s current SP targeting ingest sink
- call the current SP targeting ingest sink
- return a safe summary with:
  - app account id
  - app marketplace
  - profile id
  - requested date range
  - target row count
  - sink result summary
  - any upload id / job id / row counts returned by the sink if available

Rules:
- do not invent a parallel storage model if the repo already has a current SP targeting ingest sink
- if the existing sink requires an intermediate file, create only one bounded local temporary artifact under `out/ads-api-ingest-gate/`
- if the existing sink can be called in-process, prefer that
- this gate must ingest target daily data only

### 2. Reuse the current Sponsored Products targeting ingest sink
Codex must inspect the repo and determine the current SP targeting ingest sink already used by the existing manual report-import flow.

Required behavior:
- reuse the current sink
- do not create a second long-term targeting fact store
- do not widen into campaign, placement, STIS, or bulk scope
- if the sink expects a known report shape, perform only the minimum bounded transformation necessary from the persisted target rows into that shape

If the sink cannot be reused without a tiny bounded patch:
- keep the patch minimal
- document exactly why it was required
- do not broaden the sink’s public behavior beyond this gate

### 3. Add one bounded CLI command
Add this package script and CLI:

- `adsapi:ingest-sp-target-daily`

Required CLI behavior:
- do not call Amazon
- do not refresh tokens
- do not require network unless the current ingest sink itself writes to the existing backing store and that store is already part of the repo’s normal ingest path
- read the persisted artifact
- validate target metadata consistency
- ingest only target rows
- print a safe summary only

Required safe summary lines:
- target daily ingest succeeded
- app account id
- app marketplace
- profile id
- date range
- target row count
- sink result summary
- any upload id / job id if present

### 4. Export the new bounded surface
Update `src/connectors/ads-api/index.ts` to export:
- target ingest gate helper types
- persisted-artifact validation helpers if created here
- any normalized error types needed by the CLI

### 5. Keep the implementation bounded
This task must not implement:
- campaign gate rewrites
- search-term ingest
- keyword ingest
- new Amazon pull commands
- Stage 3 ingestion scheduler or replay framework
- warehouse writes beyond the current repo’s existing SP targeting ingest sink
- UI pages
- scheduled syncs
- Ads writeback

## Forbidden changes
Codex must not do any of the following:

- do not add any new env variable unless strictly required and justified
- do not rename the operator’s working `AMAZON_ADS_*` or `APP_*` env keys
- do not commit `.env.local`
- do not write token payloads into docs or artifacts
- do not skip validation of the existing persisted artifact
- do not invent a second targeting fact schema if one already exists in the repo
- do not widen into campaign gate scope or Stage 3 job orchestration
- do not edit any SP-API file
- do not add Supabase schema or migrations unless absolutely required by the existing sink and there is no current compatible schema path
- do not change branch workflow files or AGENTS docs beyond the files explicitly allowed above

## Required tests
Codex must run all of the following in WSL and record actual results:

1. `npm test`
2. `npm run verify:wsl`
3. `npm run adsapi:ingest-sp-target-daily`

Notes:
- command 3 is the required real gate proof for this task
- command 3 must consume the existing persisted artifact from `S2B-06`
- command 3 must prove that one real target daily ingest succeeds

## Acceptance checks
The task is complete only if all of the following are true:

1. `package.json` exposes `adsapi:ingest-sp-target-daily`.
2. `src/connectors/ads-api/targetIngestGate.ts` exists and contains:
   - persisted-artifact loader
   - target-row validator
   - sink adapter or sink caller
   - safe summary builder
3. The implementation reuses the repo’s current SP targeting ingest sink.
4. Unit tests cover:
   - missing persisted-artifact failure
   - empty target rows failure
   - row-metadata mismatch failure
   - sink failure normalization
   - safe CLI summary formatting
5. `npm run adsapi:ingest-sp-target-daily` succeeds in WSL.
6. The command proves one real target daily ingest succeeded.
7. The CLI output does not print full token values or secrets.
8. `docs/v2/BUILD_STATUS.md` records `S2B-G3` as complete and names the next bounded task.
9. `docs/v2/TASK_REGISTRY.json` marks `S2B-G3` as `done`.
10. No file outside the allowed in-scope list is changed.

## Required status update
Codex must update `docs/v2/BUILD_STATUS.md` in the same branch:

- set `Last updated`
- keep `Current branch` as `v2/02-sp-api-auth`
- keep `Current stage` as `Stage 2B — Ads API auth + first Sponsored Products pulls`
- set `Current task` to `S2B-G3 - Gate: first Sponsored Products target daily ingest succeeds`
- mark the task as `complete` only if the required tests above actually passed
- append one row to `Task log`
- record tests actually run
- record that the real proof for this task was `npm run adsapi:ingest-sp-target-daily`
- state the next bounded task after `S2B-G3`

Codex must also update `docs/v2/TASK_REGISTRY.json` so:
- `S2B-G3` becomes `done`

Codex must regenerate `docs/v2/TASK_PROGRESS.md`.

## Manual test requirement
MANUAL TEST REQUIRED:
1. Run `export APP_ACCOUNT_ID=sourbear`
2. Run `npm run adsapi:ingest-sp-target-daily`
3. Confirm the command returns success
4. Confirm the printed account id, marketplace, and profile id match the persisted artifact
5. Confirm the printed target row count is greater than or equal to 1
6. Confirm the command reports a real sink success result
7. Confirm no token values or client secrets appear in the CLI output

## Output format
Codex final response for the task must include:
1. what changed
2. tests run and results
3. blockers or follow-up
4. exact manual test steps if needed
