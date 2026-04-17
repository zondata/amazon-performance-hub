# Amazon Performance Hub V2 — Codex Task Spec

## Task ID
`S2B-G2`

## Title
Gate: first Sponsored Products campaign daily ingest succeeds

## Objective
Implement one bounded gate path that takes the existing local persisted Sponsored Products campaign daily data produced by `S2B-06`, ingests the campaign daily rows through the repo’s current Sponsored Products campaign ingest sink, and proves that one end-to-end command/job writes campaign daily facts successfully for one account/profile/date-range scope.

## Why this task exists
This is the next bounded task after `S2B-06` on branch `v2/02-sp-api-auth`.
`S2B-04`, `S2B-05`, and `S2B-06` already proved:
- bounded Ads auth,
- profile sync,
- campaign daily pull,
- target daily pull,
- local persistence.

The remaining Stage 2B gate now required is:
- `S2B-G2 — Gate: first Sponsored Products campaign daily ingest succeeds`

This task must prove one real ingest path succeeds. It must not widen into target ingest, Stage 3 orchestration, UI work, or a new schema.

## In-scope files
Codex may change only these files:

- `docs/v2/BUILD_STATUS.md`
- `docs/v2/TASK_REGISTRY.json`
- `docs/v2/TASK_PROGRESS.md`
- `docs/v2/tasks/S2B-G2-first-sp-campaign-daily-ingest-gate.md`
- `package.json`
- `src/connectors/ads-api/README.md`
- `src/connectors/ads-api/index.ts`
- `src/connectors/ads-api/types.ts`
- `src/connectors/ads-api/campaignIngestGate.ts`
- `src/connectors/ads-api/campaignIngestGateCli.ts`
- `src/connectors/ads-api/campaignIngestGate.test.ts`
- `src/connectors/ads-api/campaignIngestGateCli.test.ts`

Codex may also make minimal bounded changes to the existing current Sponsored Products campaign ingest sink only if required to reuse it from the gate command, and only in the smallest set of files necessary after inspecting the repo.

Allowed sink-touch files only if required:
- existing current SP campaign ingest implementation files already used by the repo
- existing current SP campaign mapping or persistence helper files already used by the repo
- no unrelated ingest modules

## Out-of-scope files
Codex must not change any of these:

- `.env*`
- `apps/web/**`
- `src/connectors/sp-api/**`
- `src/connectors/ads-api/spTargetDaily*`
- `src/connectors/ads-api/spCampaignDaily*`
- `src/warehouse/**`
- `src/marts/**`
- `src/diagnosis/**`
- `src/memory/**`
- `src/changes/**`
- any V1 app route or V1 business logic file unrelated to the current SP campaign ingest sink
- any GitHub workflow file
- any browser automation file
- any target ingest path
- any search-term or keyword Ads connector file
- any new table or migration unless the current repo already strictly requires a bounded additive migration for the existing SP campaign sink and there is no other safe reuse path

## Constraints
- No unrelated refactors.
- No design expansion.
- No hidden schema redesign.
- No new Amazon pull path.
- No target ingest.
- No Stage 3 job runner or backfill system.
- No UI changes.
- No browser automation.
- Do not commit secrets.
- Do not print full secrets in CLI output, tests, docs, or status files.
- Use WSL as the canonical verification environment.
- Reuse the existing local persisted artifact from `S2B-06`.
- Reuse the repo’s current Sponsored Products campaign ingest sink instead of inventing a parallel sink.
- Keep this task bounded to one real campaign daily ingest gate proof only.

## Required local-input contract for this task
Required existing local input artifact:
- `out/ads-api-persisted/normalized/ads-sp-daily.persisted.json`

Required validation:
- file exists
- JSON parses
- `campaignRowCount >= 1`
- `campaignRows` exists and is non-empty
- all campaign rows agree on:
  - `appAccountId`
  - `appMarketplace`
  - `profileId`
- the artifact date range matches the gate command inputs unless the command explicitly chooses to ingest the full persisted artifact range

## Required implementation

### 1. Build one bounded campaign ingest gate module
Create `src/connectors/ads-api/campaignIngestGate.ts`.

Required behavior:
- load and validate `out/ads-api-persisted/normalized/ads-sp-daily.persisted.json`
- extract only `campaignRows`
- transform those rows into the exact input shape required by the repo’s current SP campaign ingest sink
- call the current SP campaign ingest sink
- return a safe summary with:
  - app account id
  - app marketplace
  - profile id
  - requested date range
  - campaign row count
  - sink result summary
  - any upload id / job id / row counts returned by the sink if available

Rules:
- do not invent a parallel storage model if the repo already has a current SP campaign ingest sink
- if the existing sink requires an intermediate file, create only one bounded local temporary artifact under `out/ads-api-ingest-gate/`
- if the existing sink can be called in-process, prefer that
- this gate must ingest campaign daily data only

### 2. Reuse the current Sponsored Products campaign ingest sink
Codex must inspect the repo and determine the current SP campaign ingest sink already used by the existing manual report-import flow.

Required behavior:
- reuse the current sink
- do not create a second long-term campaign fact store
- do not widen into target, placement, STIS, or bulk scope
- if the sink expects a known report shape, perform only the minimum bounded transformation necessary from the persisted campaign rows into that shape

If the sink cannot be reused without a tiny bounded patch:
- keep the patch minimal
- document exactly why it was required
- do not broaden the sink’s public behavior beyond this gate

### 3. Add one bounded CLI command
Add this package script and CLI:

- `adsapi:ingest-sp-campaign-daily`

Required CLI behavior:
- do not call Amazon
- do not refresh tokens
- do not require network unless the current ingest sink itself writes to the existing backing store and that store is already part of the repo’s normal ingest path
- read the persisted artifact
- validate campaign metadata consistency
- ingest only campaign rows
- print a safe summary only

Required safe summary lines:
- campaign daily ingest succeeded
- app account id
- app marketplace
- profile id
- date range
- campaign row count
- sink result summary
- any upload id / job id if present

### 4. Export the new bounded surface
Update `src/connectors/ads-api/index.ts` to export:
- campaign ingest gate helper types
- persisted-artifact validation helpers if created here
- any normalized error types needed by the CLI

### 5. Keep the implementation bounded
This task must not implement:
- target ingest
- search-term ingest
- keyword ingest
- new Amazon pull commands
- Stage 3 ingestion scheduler or replay framework
- warehouse writes beyond the current repo’s existing SP campaign ingest sink
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
- do not invent a second campaign fact schema if one already exists in the repo
- do not widen into target ingest or Stage 3 job orchestration
- do not edit any SP-API file
- do not add Supabase schema or migrations unless absolutely required by the existing sink and there is no current compatible schema path
- do not change branch workflow files or AGENTS docs beyond the files explicitly allowed above

## Required tests
Codex must run all of the following in WSL and record actual results:

1. `npm test`
2. `npm run verify:wsl`
3. `npm run adsapi:ingest-sp-campaign-daily`

Notes:
- command 3 is the required real gate proof for this task
- command 3 must consume the existing persisted artifact from `S2B-06`
- command 3 must prove that one real campaign daily ingest succeeds

## Acceptance checks
The task is complete only if all of the following are true:

1. `package.json` exposes `adsapi:ingest-sp-campaign-daily`.
2. `src/connectors/ads-api/campaignIngestGate.ts` exists and contains:
   - persisted-artifact loader
   - campaign-row validator
   - sink adapter or sink caller
   - safe summary builder
3. The implementation reuses the repo’s current SP campaign ingest sink.
4. Unit tests cover:
   - missing persisted artifact failure
   - empty campaign rows failure
   - metadata mismatch failure
   - sink failure normalization
   - safe CLI summary formatting
5. `npm run adsapi:ingest-sp-campaign-daily` succeeds in WSL.
6. The command proves one real campaign daily ingest succeeded.
7. The CLI output does not print full token values or secrets.
8. `docs/v2/BUILD_STATUS.md` records `S2B-G2` as complete and names the next bounded task.
9. `docs/v2/TASK_REGISTRY.json` marks `S2B-G2` as `done`.
10. No file outside the allowed in-scope list is changed.

## Required status update
Codex must update `docs/v2/BUILD_STATUS.md` in the same branch:

- set `Last updated`
- keep `Current branch` as `v2/02-sp-api-auth`
- keep `Current stage` as `Stage 2B — Ads API auth + first Sponsored Products pulls`
- set `Current task` to `S2B-G2 - Gate: first Sponsored Products campaign daily ingest succeeds`
- mark the task as `complete` only if the required tests above actually passed
- append one row to `Task log`
- record tests actually run
- record that the real proof for this task was `npm run adsapi:ingest-sp-campaign-daily`
- state the next bounded task after `S2B-G2`

Codex must also update `docs/v2/TASK_REGISTRY.json` so:
- `S2B-G2` becomes `done`

Codex must regenerate `docs/v2/TASK_PROGRESS.md`.

## Manual test requirement
MANUAL TEST REQUIRED:
1. Run `export APP_ACCOUNT_ID=sourbear`
2. Run `npm run adsapi:ingest-sp-campaign-daily`
3. Confirm the command returns success
4. Confirm the printed account id, marketplace, and profile id match the persisted artifact
5. Confirm the printed campaign row count is greater than or equal to 1
6. Confirm the command reports a real sink success result
7. Confirm no token values or client secrets appear in the CLI output

## Output format
Codex final response for the task must include:
1. what changed
2. tests run and results
3. blockers or follow-up
4. exact manual test steps if needed
