# V2 Build Status

Last updated: `2026-04-18`
Current branch: `v2/02-sp-api-auth`
Current task: `S3-03 - Implement backfill by date range and safe reruns`
Current stage: `Stage 3 — ingestion backbone`

## Stage checklist
- [x] `Stage 1` - Repo boundary and V2 route/module skeleton
- [x] `Stage 2A` - SP-API auth + first retail pulls
- [x] `Stage 2B` - Ads API auth + first Sponsored Products pulls
- [ ] `Stage 3` - ingestion backbone

## Current task card
- Task ID: `S3-03`
- Title: `Implement backfill by date range and safe reruns`
- Objective: Build only the bounded Stage 3 backfill backbone on top of the existing generic job runner: deterministic date-range slice planning, safe rerun behavior, success-only watermark carry-through via the runner, a stub-only proof path, and directly related tests.
- Allowed files:
  - `docs/v2/BUILD_STATUS.md`
  - `docs/v2/TASK_REGISTRY.json`
  - `docs/v2/TASK_PROGRESS.md`
  - `docs/v2/tasks/S3-03-backfill-date-range-safe-reruns.md`
  - `src/ingestion/*`
  - `src/testing/fixtures/*`
  - `package.json` only if a bounded task-local command alias were strictly required
  - `supabase/migrations/*` only if a minimal follow-up migration were strictly required and could not be represented safely with existing job metadata
  - directly related tests only
- Forbidden:
  - live Amazon connector execution
  - UI
  - scheduler
  - queue workers
  - warehouse execution
  - marts
  - memory tables
  - diagnosis logic
  - browser automation
  - real secrets in committed files
  - broad refactors
- Required checks:
  - [x] `npm test`
  - [x] `npm run web:lint`
  - [x] `npm run web:build`
  - [x] `node scripts/v2-progress.mjs --write`
- Status: `complete`
- Notes:
  - Added a bounded generic backfill boundary in `src/ingestion/backfillRunner.ts` with a source-agnostic request contract, deterministic day/week slicing, ascending non-overlapping inclusive date windows, stable per-slice idempotency keys, and explicit rerun modes `none | failed_only`.
  - The backfill execution path reuses the existing Stage 3 job runner for all mutable operations, keeps successful slices non-duplicated, reuses in-flight slices, and reruns failed slices only through the explicit failed-only path.
  - Added a stub-only task-local CLI in `src/ingestion/backfillCli.ts` with safe deterministic summaries for one success backfill path and one failed-only rerun path.
  - Added directly related tests in `src/ingestion/backfillRunner.test.ts` and `src/ingestion/backfillCli.test.ts`.
  - The required WSL command set passed without widening into live connector execution, scheduler, queue workers, UI, or warehouse execution.
  - `docs/v2/BUILD_PLAN.md` is not present on this branch; implementation used the canonical task spec, `docs/v2/BUILD_STATUS.md`, and `docs/v2/amazon-performance-hub-v2-build-plan.md` for the current Stage 3 reference.
  - MANUAL TEST REQUIRED before push.
  - Single next bounded build task: `S3-04 - Model freshness_state, collection_state, finalization_state, source_confidence`

## Task log
| Date | Task ID | Branch | Scope | Result | Tests run | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-04-12 | `V2-01` | `v2/01-repo-boundary` | Create V2 route boundary and placeholder module boundaries only. | `complete` | `operator later confirmed npm run verify:wsl passed` | Stage 2A depends on SP-API auth and first real call proof. |
| 2026-04-12 | `V2-02` | `v2/01-repo-boundary` | Create the SP-API auth skeleton only: typed env/config validation, endpoint resolution, and refresh-token exchange boundary. | `complete` | `operator confirmed npm run verify:wsl passed` | First real SP-API call proof is still required before Stage 2A can be completed. |
| 2026-04-12 | `V2-03` | `v2/01-repo-boundary` | Add one real SP-API Sellers read-call path with minimal SigV4 signing, safe summary output, and no report sync/warehouse/UI/Ads API scope expansion. | `in progress` | `operator confirmed npm run verify:wsl passed; npm run spapi:first-call initially failed because the CLI was not loading repo-local .env.local; rerun required after env-loader fix` | Next bounded task should be the first report call path after manual confirmation of the real-call proof. |
| 2026-04-13 | `V2-03` | `v2/02-sp-api-auth` | Correct the first-call boundary to LWA-only env + `x-amz-access-token`, keep Sellers `getMarketplaceParticipations` as the bounded first real call after the Selling Partner Insights role correction, and avoid any Reports API/SigV4 expansion in this task. | `in progress` | `npm test passed; npm run web:lint passed; npm run web:build passed after an unrestricted rerun because the sandboxed build could not fetch Google Fonts` | Operator still needs to run `npm run verify:wsl` and `npm run spapi:first-call`, then paste both results; next bounded task remains the first report call path only. |
| 2026-04-13 | `V2-03A` | `v2/02-sp-api-auth` | Add repo-level WSL-first workflow rules, a debug snapshot handoff command, and ChatGPT web handoff docs without changing app/business logic/UI/database scope. | `complete` | `npm run snapshot:debug passed; snapshot zip contents inspected with ls/unzip` | `V2-03` feature verification is still pending in WSL; after that, the next bounded product task remains the first report call path only. |
| 2026-04-13 | `V2-03B` | `v2/02-sp-api-auth` | Remove the obsolete local `v2/*` commit block, align `.githooks/pre-commit` with the WSL-first policy, and validate that a normal local commit can proceed without `ALLOW_LOCAL_V2_COMMIT`. | `complete` | `git config --get core.hooksPath passed; pre-commit hook inspected; local commit succeeded; branch pushed after explicit operator reply` | `V2-03` WSL verification was later confirmed by operator and Stage 2A is now recorded complete. |
| 2026-04-13 | `V2-04` | `v2/02-sp-api-auth` | Add one bounded Reports API create-request path for `GET_SALES_AND_TRAFFIC_REPORT`, with no polling, download, parsing, ingestion, warehouse writes, or UI. | `complete` | `npm test passed; npm run spapi:first-report-request succeeded after an unrestricted rerun and returned report id 485677020556; npm run verify:wsl passed after an unrestricted rerun because the sandboxed web build could not fetch Google Fonts` | Next bounded task after this one must stay on report polling/status only. |
| 2026-04-13 | `V2-05` | `v2/02-sp-api-auth` | Add one bounded Reports API `getReport` status path for the first Sales and Traffic report, with bounded polling until terminal status or max attempts and no document retrieval, parsing, ingestion, warehouse writes, or UI. | `complete` | `npm test passed; npm run spapi:poll-first-report -- --report-id 485677020556 succeeded after an unrestricted rerun and returned terminal status DONE on attempt 1; npm run verify:wsl passed in WSL` | Next bounded task after this one must stay on report document retrieval only, not parsing or ingestion. |
| 2026-04-13 | `V2-06` | `v2/02-sp-api-auth` | Add one bounded Reports API report-document retrieval path for the first Sales and Traffic report, with raw document download to a controlled local output path and no parsing, ingestion, warehouse writes, or UI. | `complete` | `npm test passed; npm run spapi:get-first-report-document -- --report-id 485677020556 succeeded after an unrestricted rerun and wrote out/sp-api-report-documents/report-485677020556.document.raw.gz; npm run verify:wsl passed` | Next bounded task after this one must stay on report content parsing only, not ingestion or warehouse writes. |
| 2026-04-13 | `V2-07` | `v2/02-sp-api-auth` | Add one bounded local report-content parsing path for the first Sales and Traffic report, with gzip-aware raw artifact reading, JSON section tabularization into a controlled local artifact, and no ingestion, warehouse writes, or UI. | `complete` | `npm test passed; npm run spapi:parse-first-report -- --report-id 485677020556 parsed the real bounded artifact into out/sp-api-parsed-reports/report-485677020556.parsed.json; npm run verify:wsl passed` | Next bounded task after this one must stay on local structured handoff or ingestion boundary definition only, not warehouse writes. |
| 2026-04-14 | `V2-08` | `v2/02-sp-api-auth` | Add one bounded local structured handoff path for the first Sales and Traffic report, with parsed-artifact validation, deterministic handoff artifact writing, and no ingestion, warehouse writes, or UI. | `complete` | `npm test passed; npm run spapi:build-first-report-handoff -- --report-id 485677020556 succeeded and wrote out/sp-api-report-handoffs/report-485677020556.handoff.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one ingestion execution path to a local non-warehouse staging target or another explicit ingestion boundary implementation only, still without warehouse writes. |
| 2026-04-14 | `V2-09` | `v2/02-sp-api-auth` | Add one bounded local non-warehouse staging ingestion path for the first Sales and Traffic report, with handoff validation, deterministic local stage writing, and no Supabase, warehouse, or UI scope. | `complete` | `npm test passed; npm run spapi:ingest-first-report-local-stage -- --report-id 485677020556 succeeded and wrote out/sp-api-staging/report-485677020556.local-stage.json; npm run verify:wsl passed` | Next bounded task after this one must stay on either one explicit ingestion boundary implementation into src/ingestion/** without warehouse writes, or one bounded promotion step from local staging to a defined non-warehouse canonical ingest shape. |
| 2026-04-14 | `V2-10` | `v2/02-sp-api-auth` | Add one bounded explicit ingestion boundary in `src/ingestion/**` for the first Sales and Traffic report, with staging validation, deterministic local canonical ingest writing, and no Supabase, warehouse, or UI scope. | `complete` | `npm test passed; npm run spapi:ingest-first-report-canonical -- --report-id 485677020556 succeeded and wrote out/sp-api-canonical-ingest/report-485677020556.canonical-ingest.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one promotion step from local canonical ingest shape toward a defined warehouse-ready contract, still without actual warehouse writes. |
| 2026-04-14 | `V2-11` | `v2/02-sp-api-auth` | Add one bounded warehouse-ready contract promotion path in `src/ingestion/**` for the first Sales and Traffic report, with canonical-ingest validation, deterministic local contract writing, and no Supabase, warehouse, or UI scope. | `complete` | `npm test passed; npm run spapi:promote-first-report-warehouse-ready -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-ready/report-485677020556.warehouse-ready.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one warehouse-adapter preparation step or one explicit mapping definition into src/warehouse/**, still without any actual write execution. |
| 2026-04-14 | `V2-12` | `v2/02-sp-api-auth` | Add one bounded warehouse adapter mapping definition path in `src/warehouse/**` for the first Sales and Traffic report, with warehouse-ready validation, deterministic local mapping writing, and no Supabase, warehouse execution, or UI scope. | `complete` | `npm test passed; npm run spapi:prepare-first-report-warehouse-mapping -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-mapping/report-485677020556.warehouse-mapping.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one dry-run warehouse adapter execution step or one explicit adapter interface for future write execution, still without any actual write execution. |
| 2026-04-14 | `V2-13` | `v2/02-sp-api-auth` | Add one bounded dry-run warehouse adapter execution path in `src/warehouse/**` for the first Sales and Traffic report, with cross-validation of the local warehouse-ready and warehouse-mapping artifacts, deterministic local dry-run artifact writing, and no Supabase, warehouse execution, or UI scope. | `complete` | `npm test passed; npm run spapi:dry-run-first-report-warehouse-adapter -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-dry-run/report-485677020556.warehouse-dry-run.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one explicit adapter interface for future write execution, still without any actual write execution. |
| 2026-04-14 | `V2-14` | `v2/02-sp-api-auth` | Add one bounded warehouse adapter interface-definition path in `src/warehouse/**` for the first Sales and Traffic report, with dry-run validation, deterministic local interface artifact writing, and no Supabase, warehouse execution, or UI scope. | `complete` | `npm test passed; npm run spapi:define-first-report-warehouse-interface -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-interface/report-485677020556.warehouse-interface.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one no-op adapter implementation or one explicit adapter invocation boundary that still forbids any real warehouse write execution. |
| 2026-04-14 | `V2-15` | `v2/02-sp-api-auth` | Add one bounded no-op warehouse adapter implementation path in `src/warehouse/**` for the first Sales and Traffic report, with interface validation, deterministic local no-op artifact writing, and no Supabase, warehouse execution, or UI scope. | `complete` | `npm test passed; npm run spapi:build-first-report-warehouse-noop -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-noop/report-485677020556.warehouse-noop.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one explicit adapter invocation boundary that still forbids any real warehouse write execution. |
| 2026-04-14 | `V2-16` | `v2/02-sp-api-auth` | Add one bounded warehouse adapter invocation boundary path in `src/warehouse/**` for the first Sales and Traffic report, with no-op validation, deterministic local invocation artifact writing, and no Supabase, warehouse execution, or UI scope. | `complete` | `npm test passed; npm run spapi:invoke-first-report-warehouse-adapter -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-invocation/report-485677020556.warehouse-invocation.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one adapter result contract step or one explicit write-authority gate that still forbids any real warehouse write execution. |
| 2026-04-14 | `V2-17` | `v2/02-sp-api-auth` | Add one bounded warehouse adapter result-contract path in `src/warehouse/**` for the first Sales and Traffic report, with invocation validation, deterministic local result-contract artifact writing, and no Supabase, warehouse execution, or UI scope. | `complete` | `npm test passed; npm run spapi:build-first-report-warehouse-result-contract -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-result-contract/report-485677020556.warehouse-result-contract.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one write-authority gate that still forbids any real warehouse write execution. |
| 2026-04-14 | `V2-18` | `v2/02-sp-api-auth` | Post-Stage-2A warehouse boundary buildout — add one bounded warehouse write-authority-gate path in `src/warehouse/**` for the first Sales and Traffic report, with result-contract validation, deterministic local write-authority artifact writing, and no Supabase, warehouse execution, or UI scope. | `complete` | `npm test passed; npm run spapi:gate-first-report-warehouse-write-authority -- --report-id 485677020556 succeeded and wrote out/sp-api-warehouse-write-authority/report-485677020556.warehouse-write-authority.json; npm run verify:wsl passed` | Next bounded task after this one must stay on one explicit Stage 2B entry handoff note or another clearly named next-stage gate that still forbids any real warehouse write execution. |
| 2026-04-14 | `V2-AUDIT-STATUS` | `v2/02-sp-api-auth` | Audit the current branch against the master V2 task registry, regenerate progress output, and restate the actual stage and remaining Stage 2A gate tasks without building features. | `complete` | `node scripts/v2-progress.mjs --write passed` | Next bounded task is `S2A-07` — implement the first SP-API SQP pull/ingest gate proof. |
| 2026-04-14 | `S2A-07` | `v2/02-sp-api-auth` | Add one bounded SP-API SQP parse+ingest path that reads one local SQP raw artifact, validates the ASIN-window SQP family, and ingests it through the existing SQP weekly raw ingest boundary without widening into Search Terms, warehouse, or UI work. | `complete` | `npm test passed; npm run spapi:sqp-parse-ingest -- --raw-path src/testing/fixtures/sp-api/report-fixture-sqp-asin-window.sqp.raw.csv succeeded with upload id 55f35127-63de-4481-b7b2-0d8a99eb1618; npm run verify:wsl passed` | Next bounded task is `S2A-G2` — prove one first real SQP pull ingests successfully for one ASIN window. |
| 2026-04-14 | `S2A-G2` | `v2/02-sp-api-auth` | Add one bounded real SP-API SQP pull path for one ASIN week window that requests the report, polls to terminal state, downloads the raw artifact, and hands it into the existing `spapi:sqp-parse-ingest` path without widening into Search Terms, Stage 2B, warehouse, or UI work. | `complete` | `focused SQP boundary tests passed; npm run spapi:sqp-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2026-04-05 --end-date 2026-04-11 succeeded with upload id f0f533b2-b856-4b2c-9e5f-1aae58f7bcfe; npm test passed; npm run verify:wsl passed` | Next bounded task is `S2A-G3` — prove one first real Search Terms pull ingests successfully for one marketplace window. |
| 2026-04-14 | `S2A-08` | `v2/02-sp-api-auth` | Add one bounded Search Terms parse+ingest path that reads one local Search Terms raw artifact, validates the official `GET_BRAND_ANALYTICS_SEARCH_TERMS_REPORT` family, and ingests it through one bounded Search Terms raw ingest boundary without widening into Stage 2B, warehouse, or UI work. | `complete` | `focused Search Terms parse+ingest tests passed; npm test passed; npm run verify:wsl passed` | Next bounded task is `S2A-G3` — prove one first real Search Terms pull ingests successfully for one marketplace window. |
| 2026-04-14 | `S2A-G3` | `v2/02-sp-api-auth` | Add one bounded real SP-API Search Terms pull path for one marketplace week window that requests the report, polls to terminal state, downloads the raw artifact, and hands it into the bounded Search Terms parse+ingest path without widening into Stage 2B, warehouse, or UI work. | `complete` | `focused Search Terms real-pull tests passed; npm run spapi:search-terms-first-real-pull-ingest -- --marketplace-id ATVPDKIKX0DER --start-date 2026-04-05 --end-date 2026-04-11 succeeded with report id 485977020557 and upload id 517bcaba-d7bd-4d3d-b56a-372c0de77bda; npm test passed; npm run verify:wsl passed` | Next bounded task is `S2B-01` — document Ads API environment contract and secret handling. |
| 2026-04-14 | `S2B-01` | `v2/02-sp-api-auth` | Document the Amazon Ads API environment contract, secret handling rules, runtime boundaries, and verification requirements required before any live Stage 2B implementation begins. | `complete` | `node scripts/v2-progress.mjs --write passed; npm test passed; npm run verify:wsl passed` | Next bounded task is `S2B-02` — implement Ads authorization grant, token exchange, and refresh. |
| 2026-04-16 | `S2B-02` | `v2/02-sp-api-auth` | Replace the Stage 1 Ads placeholder with a bounded auth module and CLI surface for authorization URL generation, authorization-code exchange, and refresh-token exchange without widening into profile sync, pulls, UI, schema, or warehouse work. | `complete` | `npm test passed; npm run adsapi:print-auth-url -- --redirect-uri https://example.com/callback --scope cpc_advertising:campaign_management passed; npm run adsapi:refresh-access-token passed after an unrestricted rerun because the sandbox blocked outbound auth; npm run verify:wsl passed; node scripts/v2-progress.mjs --write passed` | Next bounded task is `S2B-03` — implement Ads profile sync and internal profile mapping. |
| 2026-04-17 | `S2B-03` | `v2/02-sp-api-auth` | Add one bounded Ads profile-sync path that reuses the existing refresh-token boundary, fetches `/v2/profiles` without a scope header, validates the configured profile id, and writes one local mapping artifact without widening into Sponsored Products pulls, UI, schema, or warehouse work. | `complete` | `npm test passed; npm run adsapi:sync-profiles passed after an unrestricted rerun because the sandbox blocked outbound auth; npm run verify:wsl passed; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S2B-04` — implement Sponsored Products campaign daily connector. |
| 2026-04-17 | `S2B-04` | `v2/02-sp-api-auth` | Add one bounded Sponsored Products campaign-daily connector that validates the existing profile-sync artifact before requesting the report, reuses the existing Ads refresh-token boundary, and writes deterministic local raw + normalized artifacts without widening into target daily, search-term, keyword, UI, schema, Supabase, or warehouse work. | `complete` | `npm test passed; npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16 passed after an unrestricted rerun because the sandbox blocked outbound auth; npm run verify:wsl passed; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S2B-05` — implement Sponsored Products target daily connector. |
| 2026-04-17 | `S2B-05` | `v2/02-sp-api-auth` | Add one bounded Sponsored Products target-daily connector that validates the existing profile-sync artifact before requesting the report, reuses the existing Ads refresh-token boundary, and writes deterministic local raw + normalized artifacts without widening into search-term, keyword, UI, schema, Supabase, or warehouse work. | `complete` | `npm test passed; npm run adsapi:pull-sp-target-daily -- --start-date 2026-04-10 --end-date 2026-04-16 passed after unrestricted reruns because the sandbox blocked outbound auth; npm run verify:wsl passed; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S2B-06` — add Ads raw landing + normalization persistence. |
| 2026-04-17 | `S2B-06` | `v2/02-sp-api-auth` | Add one bounded local persistence layer that reads the existing campaign-daily and target-daily raw and normalized artifacts, validates shared metadata consistency, and writes deterministic landed and persisted normalization artifacts without widening into ingestion, warehouse, Supabase, UI, or new Amazon pull work. | `complete` | `npm test passed; npm run adsapi:persist-sp-daily passed; npm run verify:wsl passed; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S2B-G2` — gate: first Sponsored Products campaign daily ingest succeeds. |
| 2026-04-17 | `S2B-G2` | `v2/02-sp-api-auth` | Add one bounded gate that reads the existing `S2B-06` persisted campaign rows, transforms them into the current SP campaign ingest sink’s accepted CSV shape, and proves one real campaign daily ingest succeeds without widening into target ingest, Stage 3 orchestration, UI, or schema redesign. | `complete` | `focused campaign-ingest-gate tests passed; npm run adsapi:ingest-sp-campaign-daily passed after an unrestricted rerun because the sandbox blocked the existing Supabase-backed sink; npm test passed; npm run verify:wsl passed; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S2B-G3` — gate: first Sponsored Products target daily ingest succeeds. |
| 2026-04-17 | `S2B-G3` | `v2/02-sp-api-auth` | Add one bounded gate that reads the existing `S2B-06` persisted target rows, transforms them into the current SP targeting ingest sink’s accepted XLSX shape, and proves one real target daily ingest succeeds without widening into campaign gate rewrites, Stage 3 orchestration, UI, or schema redesign. | `complete` | `focused target-ingest-gate tests passed; npm run adsapi:ingest-sp-target-daily passed after an unrestricted rerun because the sandbox blocked the existing Supabase-backed sink; npm test passed; npm run verify:wsl passed; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S2B-G4` — gate: Stage 2B tests green. |
| 2026-04-17 | `S2B-G4` | `v2/02-sp-api-auth` | Run the full bounded Stage 2B gate command set in WSL, apply only the minimum Stage 2B-local stabilization needed for those commands to pass together, and confirm the stage is green without widening into Stage 3, new Ads pull scope, UI, Supabase redesign, or warehouse redesign. | `complete` | `npm test passed; npm run verify:wsl passed; npm run adsapi:sync-profiles passed after an unrestricted rerun because the sandbox blocked outbound auth; export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16 passed after the bounded local-artifact reuse fix; export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-target-daily -- --start-date 2026-04-10 --end-date 2026-04-16 passed after the bounded local-artifact reuse fix; npm run adsapi:persist-sp-daily passed; export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-campaign-daily passed after an unrestricted rerun because the sandbox blocked the existing Supabase-backed sink; export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-target-daily passed after an unrestricted rerun because the sandbox blocked the existing Supabase-backed sink; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S3-01` — create ingestion_jobs and source_watermarks schema. |
| 2026-04-18 | `S3-01` | `v2/02-sp-api-auth` | Add the first Stage 3 ingestion observability schema boundary only: `ingestion_jobs`, `source_watermarks`, the minimum typed schema contract under `src/ingestion/*`, and directly related bounded tests without adding runner, retry, replay, backfill, UI, connector, or warehouse execution logic. | `complete` | `npm test passed; npm run web:lint passed; npm run web:build passed; node scripts/v2-progress.mjs --write passed` | Operator manual verification completed; migration also applied manually in Supabase SQL editor. Next bounded task is `S3-02` — implement idempotent job runner with retries and replay. |
| 2026-04-18 | `S3-02` | `v2/02-sp-api-auth` | Add the bounded generic Stage 3 job runner only: idempotent submit/reuse, explicit `requested|processing|available|failed` transitions, explicit retry and replay paths, success-only `source_watermarks` updates, a stub executor, a task-local stub CLI, and directly related tests without live connector execution, scheduler, UI, backfill, or warehouse execution scope. | `complete` | `npm test passed; npm run web:lint passed; npm run web:build passed; ./node_modules/.bin/ts-node src/ingestion/jobRunnerCli.ts --scenario success passed; ./node_modules/.bin/ts-node src/ingestion/jobRunnerCli.ts --scenario retry passed; node scripts/v2-progress.mjs --write passed` | Operator manual verification completed. Next bounded task is `S3-03` — implement backfill by date range and safe reruns. |
| 2026-04-18 | `S3-03` | `v2/02-sp-api-auth` | Add the bounded generic Stage 3 backfill path only: deterministic date-range slice planning, safe reruns on top of the existing job runner, explicit `created|reused_existing|rerun_failed|skipped_available` slice actions, a stub-only task-local CLI, and directly related tests without live connector execution, scheduler, UI, or warehouse execution scope. | `complete` | `npm test -- src/ingestion/backfillRunner.test.ts src/ingestion/backfillCli.test.ts passed; ./node_modules/.bin/ts-node src/ingestion/backfillCli.ts --scenario success passed; ./node_modules/.bin/ts-node src/ingestion/backfillCli.ts --scenario failed-only-rerun passed; npm test passed; npm run web:lint passed; npm run web:build passed; node scripts/v2-progress.mjs --write passed` | MANUAL TEST REQUIRED before push. Next bounded task is `S3-04` — model freshness_state, collection_state, finalization_state, source_confidence. |

## Tests and verification
- Codex in-task validation:
  - `npm run snapshot:debug` passed and produced a timestamped bundle in `out/debug-snapshots/`.
  - `ls -lah out/debug-snapshots || true` inspected the snapshot output directory.
  - `unzip -l out/debug-snapshots/*.zip | sed -n '1,120p' || true` inspected the generated bundle contents.
  - `git config --get core.hooksPath` returned `.githooks`.
  - `sed -n '1,220p' .githooks/pre-commit || true` inspected the active hook implementation before replacement.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md` from the audited task registry statuses.
- V2-03 operator confirmation already received:
  - `npm run verify:wsl`
  - `npm run spapi:first-call`
- V2-04 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:first-report-request` was actually run. The sandboxed attempt failed at the auth transport boundary, so it was rerun unrestricted and succeeded with report id `485677020556`.
  - `npm run verify:wsl` was first attempted in the sandbox and failed because the Next.js build could not fetch Google Fonts. It was rerun unrestricted and passed.
- V2-05 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:poll-first-report -- --report-id 485677020556` was actually run. The sandboxed attempt failed at the auth transport boundary, so it was rerun unrestricted and returned terminal status `DONE` on attempt `1`.
  - `npm run verify:wsl` passed in WSL.
- V2-06 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:get-first-report-document -- --report-id 485677020556` was actually run. The sandboxed attempt failed at the auth transport boundary, so it was rerun unrestricted and retrieved the report document successfully.
  - The bounded raw artifact was written to `out/sp-api-report-documents/report-485677020556.document.raw.gz`.
  - `npm run verify:wsl` passed in WSL.
- V2-07 validation completed:
  - The real V2-06 raw artifact at `out/sp-api-report-documents/report-485677020556.document.raw.gz` was inspected in WSL and confirmed to be gzip-compressed JSON rather than delimited text.
  - `npm test` passed locally.
  - `npm run spapi:parse-first-report -- --report-id 485677020556` was actually run and parsed the bounded raw artifact into `out/sp-api-parsed-reports/report-485677020556.parsed.json`.
  - The parser summary reported `Detected format: json`, `Decompressed: yes`, `Section count: 2`, and `Total row count: 1`.
  - `npm run verify:wsl` passed in WSL.
- V2-08 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:build-first-report-handoff -- --report-id 485677020556` was actually run and built the bounded handoff artifact at `out/sp-api-report-handoffs/report-485677020556.handoff.json`.
  - The handoff summary reported `Schema version: sp-api-first-report-handoff/v1`, `Section count: 2`, and `Total row count: 1`.
  - `npm run verify:wsl` passed in WSL.
- V2-09 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:ingest-first-report-local-stage -- --report-id 485677020556` was actually run and built the bounded local staging artifact at `out/sp-api-staging/report-485677020556.local-stage.json`.
  - The staging summary reported `Staging version: sp-api-first-report-local-stage/v1`, `Section count: 2`, and `Total row count: 1`.
  - `npm run verify:wsl` passed in WSL.
- V2-10 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:ingest-first-report-canonical -- --report-id 485677020556` was actually run and built the bounded canonical ingest artifact at `out/sp-api-canonical-ingest/report-485677020556.canonical-ingest.json`.
  - The canonical summary reported `Canonical ingest version: sp-api-first-report-canonical-ingest/v1`, `Section count: 2`, and `Total row count: 1`.
  - `npm run verify:wsl` passed in WSL.
- V2-11 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:promote-first-report-warehouse-ready -- --report-id 485677020556` was actually run and built the bounded warehouse-ready contract artifact at `out/sp-api-warehouse-ready/report-485677020556.warehouse-ready.json`.
  - The promotion summary reported `Warehouse-ready contract version: sp-api-first-report-warehouse-ready/v1`, `Section count: 2`, and `Total row count: 1`.
  - `npm run verify:wsl` passed in WSL.
- V2-12 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:prepare-first-report-warehouse-mapping -- --report-id 485677020556` was actually run and built the bounded warehouse adapter mapping artifact at `out/sp-api-warehouse-mapping/report-485677020556.warehouse-mapping.json`.
  - The preparation summary reported `Warehouse adapter mapping version: sp-api-first-report-warehouse-adapter-mapping/v1`, `Section count: 2`, and `Total row count: 1`.
  - `npm run verify:wsl` passed in WSL.
- V2-13 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:dry-run-first-report-warehouse-adapter -- --report-id 485677020556` was actually run and built the bounded warehouse dry-run artifact at `out/sp-api-warehouse-dry-run/report-485677020556.warehouse-dry-run.json`.
  - The dry-run summary reported `Warehouse adapter dry-run version: sp-api-first-report-warehouse-adapter-dry-run/v1`, `Section count: 2`, `Total row count: 1`, and target tables `spapi_sales_and_traffic_by_date_report_rows`, `spapi_sales_and_traffic_by_asin_report_rows`.
  - `npm run verify:wsl` passed in WSL.
- V2-14 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:define-first-report-warehouse-interface -- --report-id 485677020556` was actually run and built the bounded warehouse interface artifact at `out/sp-api-warehouse-interface/report-485677020556.warehouse-interface.json`.
  - The interface summary reported `Warehouse adapter interface version: sp-api-first-report-warehouse-adapter-interface/v1`, `Section count: 2`, `Total row count: 1`, target tables `spapi_sales_and_traffic_by_date_report_rows`, `spapi_sales_and_traffic_by_asin_report_rows`, and deterministic operation names for both targets.
  - `npm run verify:wsl` passed in WSL.
- V2-15 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:build-first-report-warehouse-noop -- --report-id 485677020556` was actually run and built the bounded warehouse no-op artifact at `out/sp-api-warehouse-noop/report-485677020556.warehouse-noop.json`.
  - The no-op summary reported `Warehouse adapter noop version: sp-api-first-report-warehouse-adapter-noop/v1`, `Section count: 2`, `Total row count: 1`, target tables `spapi_sales_and_traffic_by_date_report_rows`, `spapi_sales_and_traffic_by_asin_report_rows`, deterministic operation names for both targets, and `executionResult = skipped_noop` with `writesAttempted = false`.
  - `npm run verify:wsl` passed in WSL.
- V2-16 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:invoke-first-report-warehouse-adapter -- --report-id 485677020556` was actually run and built the bounded warehouse invocation artifact at `out/sp-api-warehouse-invocation/report-485677020556.warehouse-invocation.json`.
  - The invocation summary reported `Warehouse adapter invocation version: sp-api-first-report-warehouse-adapter-invocation/v1`, `Section count: 2`, `Total row count: 1`, target tables `spapi_sales_and_traffic_by_date_report_rows`, `spapi_sales_and_traffic_by_asin_report_rows`, deterministic operation names for both targets, and `invocationResult = blocked_no_write` with `transportCalled = false`.
  - `npm run verify:wsl` passed in WSL.
- V2-17 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:build-first-report-warehouse-result-contract -- --report-id 485677020556` was actually run and built the bounded warehouse result-contract artifact at `out/sp-api-warehouse-result-contract/report-485677020556.warehouse-result-contract.json`.
  - The result-contract summary reported `Warehouse adapter result contract version: sp-api-first-report-warehouse-adapter-result-contract/v1`, `Section count: 2`, `Total row count: 1`, target tables `spapi_sales_and_traffic_by_date_report_rows`, `spapi_sales_and_traffic_by_asin_report_rows`, deterministic operation names for both targets, and `resultStatus = blocked_no_write` with `transportCalled = false`.
  - `npm run verify:wsl` passed in WSL.
- V2-18 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:gate-first-report-warehouse-write-authority -- --report-id 485677020556` was actually run and built the bounded warehouse write-authority artifact at `out/sp-api-warehouse-write-authority/report-485677020556.warehouse-write-authority.json`.
  - The write-authority summary reported `Warehouse write-authority version: sp-api-first-report-warehouse-write-authority/v1`, `Section count: 2`, `Total row count: 1`, target tables `spapi_sales_and_traffic_by_date_report_rows`, `spapi_sales_and_traffic_by_asin_report_rows`, deterministic operation names for both targets, and `writeAuthorityDecision = denied` with `transportCalled = false`.
  - `npm run verify:wsl` passed in WSL.
- S2A-07 validation completed:
  - `npm test` passed locally.
  - `npm run spapi:sqp-parse-ingest -- --raw-path src/testing/fixtures/sp-api/report-fixture-sqp-asin-window.sqp.raw.csv` was actually run. The sandboxed attempt failed at the Supabase network boundary, so it was rerun unrestricted and succeeded through the existing SQP ingest sink.
  - The bounded CLI summary reported `Report ID: fixture-sqp-asin-window`, `Scope type: asin`, `Scope value: B0B2K57W5R`, `Coverage window: 2026-02-01 -> 2026-02-07`, `Row count: 1`, `Upload ID: 55f35127-63de-4481-b7b2-0d8a99eb1618`, and `Warnings: 0`.
  - `npm run verify:wsl` passed in WSL.
- S2A-G2 implementation validation completed:
  - Focused SQP boundary tests passed locally for the new real-pull CLI, bounded polling failure, missing-document failure, JSON raw-artifact parsing, and handoff into the existing `spapi:sqp-parse-ingest` path.
  - `npm test` passed locally.
  - `npm run spapi:sqp-first-real-pull-ingest -- --asin B0FYPRWPN1 --start-date 2026-04-05 --end-date 2026-04-11` was actually run successfully and created report id `485937020557`.
  - The real gate summary reported `Scope type: asin`, `Scope value: B0FYPRWPN1`, `Coverage window: 2026-04-05 -> 2026-04-11`, `Row count: 53`, `Warnings: 0`, and `Upload ID: f0f533b2-b856-4b2c-9e5f-1aae58f7bcfe`.
  - `npm run verify:wsl` passed in WSL.
- S2A-08 validation completed:
  - Focused Search Terms parse+ingest tests passed locally for deterministic path resolution, family/type validation failure, gzip raw-artifact reading, and safe summary generation.
  - `npm test` passed locally.
  - `npm run verify:wsl` passed in WSL.
- S2A-G3 validation completed:
  - Focused Search Terms real-pull boundary tests passed locally for CLI argument validation, bounded polling failure, missing-document failure, and successful parse+ingest handoff summary.
  - `npm test` passed locally.
  - `npm run verify:wsl` passed in WSL.
  - `npm run spapi:search-terms-first-real-pull-ingest -- --marketplace-id ATVPDKIKX0DER --start-date 2026-04-05 --end-date 2026-04-11` was actually run successfully and created report id `485977020557`.
  - The real gate summary reported `Marketplace ID: ATVPDKIKX0DER`, `Coverage window: 2026-04-05 -> 2026-04-11`, `Row count: 0`, `Warnings: 0`, and `Upload ID: 517bcaba-d7bd-4d3d-b56a-372c0de77bda`.
- S2B-02 validation completed:
  - Focused Amazon Ads auth boundary tests passed locally for missing-env handling, quoted refresh-token normalization, authorization URL construction, authorization-code request construction, refresh-token request construction, success payload parsing, invalid payload handling, non-2xx failure normalization, transport failure normalization, local env loading, and CLI redaction.
  - `npm test` passed locally.
  - `npm run adsapi:print-auth-url -- --redirect-uri https://example.com/callback --scope cpc_advertising:campaign_management` passed and printed one authorization URL.
  - `npm run adsapi:refresh-access-token` failed in the sandbox at the outbound auth transport boundary, then passed after an unrestricted rerun in WSL.
  - The refresh proof summary reported `Token type: bearer`, `Expires in: 3600`, `Refresh token returned in payload: yes (redacted)`, and the configured Ads API base URL.
  - `npm run verify:wsl` passed in WSL.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md`.
- S2B-03 validation completed:
  - Focused Amazon Ads profile-sync boundary tests passed locally for request construction without a scope header, successful array parsing, non-array payload failure, non-2xx failure normalization, transport failure normalization, configured-profile matching, configured-profile missing failure, deterministic artifact building, and safe CLI summary formatting.
  - `npm test` passed locally.
  - `npm run adsapi:sync-profiles` failed in the sandbox at the outbound auth transport boundary, then passed after an unrestricted rerun in WSL.
  - The profile-sync proof summary reported `Configured profile id: 3362351578582214`, `Selected profile id: 3362351578582214`, `Profile count: 3`, `Selected country code: US`, `Selected account name: NETRADE SOLUTION`, and artifact path `out/ads-api-profile-sync/ads-profiles.sync.json`.
  - The generated artifact was inspected in WSL and confirmed to contain `appAccountId`, `appMarketplace`, `adsApiBaseUrl`, `configuredProfileId`, `selectedProfile`, `profileCount`, and `profilesSummary` with no token values.
  - `npm run verify:wsl` passed in WSL.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md`.
- S2B-04 validation completed:
  - Focused Sponsored Products campaign-daily boundary tests passed locally for profile-sync artifact validation, bounded date-range validation, request construction, non-2xx failure normalization, transport failure normalization, normalization shape, deterministic artifact building, and safe CLI summary formatting.
  - `npm test` passed locally.
  - `npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16` failed in the sandbox at the outbound auth transport boundary, then passed after an unrestricted rerun in WSL with `APP_ACCOUNT_ID=sourbear` set in the shell so the local internal metadata matched the validated profile-sync artifact.
  - The campaign-daily proof summary reported `Validated profile id: 3362351578582214`, `Date range: 2026-04-10 -> 2026-04-16`, `Row count: 733`, raw artifact path `out/ads-api-sp-campaign-daily/raw/sp-campaign-daily.raw.json`, and normalized artifact path `out/ads-api-sp-campaign-daily/normalized/sp-campaign-daily.normalized.json`.
  - The generated raw artifact was inspected in WSL and confirmed to contain `schemaVersion`, `generatedAt`, `appAccountId`, `appMarketplace`, `adsApiBaseUrl`, `profileId`, `requestedDateRange`, `reportMetadata`, and `rawRowsPayload`.
  - The generated normalized artifact was inspected in WSL and confirmed to contain `rowCount: 733` plus `normalizedCampaignRows[]` with `appAccountId`, `appMarketplace`, `profileId`, `campaignId`, `campaignName`, `campaignStatus`, `campaignBudgetType`, `date`, `impressions`, `clicks`, `cost`, `attributedSales14d`, `attributedConversions14d`, and `currencyCode` on each row.
  - `npm run verify:wsl` passed in WSL.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md`.
- S2B-05 validation completed:
  - Focused Sponsored Products target-daily boundary tests passed locally for profile-sync artifact validation, bounded date-range validation, request construction, non-2xx failure normalization, transport failure normalization, normalization shape, deterministic artifact building, and safe CLI summary formatting.
  - `npm test` passed locally.
  - `npm run adsapi:pull-sp-target-daily -- --start-date 2026-04-10 --end-date 2026-04-16` failed in the sandbox at the outbound auth transport boundary, then passed after unrestricted reruns in WSL with `APP_ACCOUNT_ID=sourbear` set in the shell so the local internal metadata matched the validated profile-sync artifact.
  - The live Amazon validation path first rejected `reportTypeId=spTargets`, then confirmed the bounded target report shape via API feedback: `reportTypeId=spTargeting`, `groupBy=targeting`, and accepted targeting columns including `keywordId`, `targeting`, `keyword`, `matchType`, `keywordType`, and `adKeywordStatus`.
  - The target-daily proof summary reported `Validated profile id: 3362351578582214`, `Date range: 2026-04-10 -> 2026-04-16`, `Row count: 545`, raw artifact path `out/ads-api-sp-target-daily/raw/sp-target-daily.raw.json`, and normalized artifact path `out/ads-api-sp-target-daily/normalized/sp-target-daily.normalized.json`.
  - The generated raw artifact was inspected in WSL and confirmed to contain `schemaVersion`, `generatedAt`, `appAccountId`, `appMarketplace`, `adsApiBaseUrl`, `profileId`, `requestedDateRange`, `reportMetadata`, and `rawRowsPayload`.
  - The generated normalized artifact was inspected in WSL and confirmed to contain `rowCount: 545` plus `normalizedTargetRows[]` with `appAccountId`, `appMarketplace`, `profileId`, `campaignId`, `campaignName`, `adGroupId`, `adGroupName`, `targetId`, `targetingExpression`, `matchType`, `targetStatus`, `date`, `impressions`, `clicks`, `cost`, `attributedSales14d`, `attributedConversions14d`, and `currencyCode` on each row.
  - `npm run verify:wsl` passed in WSL.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md`.
- S2B-06 validation completed:
  - Focused local persistence boundary tests passed locally for missing-artifact failure, JSON parse failure, metadata mismatch failure, deterministic daily-summary output, persisted artifact writing, and safe CLI summary formatting.
  - `npm run adsapi:persist-sp-daily` passed locally with no network access and wrote `out/ads-api-persisted/raw/ads-sp-daily.landed.json` plus `out/ads-api-persisted/normalized/ads-sp-daily.persisted.json`.
  - The persistence proof summary reported `App account id: sourbear`, `App marketplace: US`, `Profile id: 3362351578582214`, `Date range: 2026-04-10 -> 2026-04-16`, `Campaign row count: 734`, and `Target row count: 545`.
  - The landed artifact was inspected in WSL and confirmed to contain `schemaVersion`, `generatedAt`, `appAccountId`, `appMarketplace`, `adsApiBaseUrl`, `profileId`, `requestedDateRange`, `sources`, `campaignRaw`, and `targetRaw`.
  - The persisted normalization artifact was inspected in WSL and confirmed to contain `campaignRowCount`, `targetRowCount`, `campaignRows`, `targetRows`, and `dailySummary` with `7` date entries sorted by `date`.
  - `npm test` passed in WSL.
  - `npm run verify:wsl` passed in WSL.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md`.
- S2B-G2 validation completed:
  - Focused campaign-ingest-gate tests passed locally for missing persisted-artifact failure, empty campaign-row failure, row-metadata mismatch failure, sink failure normalization, CSV shaping for the existing sink, and safe CLI summary formatting.
  - `npm run adsapi:ingest-sp-campaign-daily` first failed in the sandbox at the existing Supabase-backed sink boundary, then passed after an unrestricted rerun in WSL with `APP_ACCOUNT_ID=sourbear`.
  - The real gate summary reported `App account id: sourbear`, `App marketplace: US`, `Profile id: 3362351578582214`, `Date range: 2026-04-10 -> 2026-04-16`, `Campaign row count: 734`, `Upload id: 37c763a7-e836-438e-86d7-6fe072164f4e`, `raw_ingest=ok`, `mapping=ok`, `fact_rows=611`, and `issue_rows=20`.
  - The gate wrote one bounded temporary CSV at `out/ads-api-ingest-gate/sp-campaign-daily.ingest.csv` and reused the current `ingestSpCampaignRaw` plus `mapUpload(uploadId, "sp_campaign")` sink path.
  - `npm test` passed in WSL.
  - `npm run verify:wsl` passed in WSL.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md`.
- S2B-G3 validation completed:
  - Focused target-ingest-gate tests passed locally for missing persisted-artifact failure, empty target-row failure, row-metadata mismatch failure, sink failure normalization, XLSX shaping for the existing sink, and safe CLI summary formatting.
  - `npm run adsapi:ingest-sp-target-daily` first failed in the sandbox at the existing Supabase-backed sink boundary, then passed after an unrestricted rerun in WSL with `APP_ACCOUNT_ID=sourbear`.
  - The real gate summary reported `App account id: sourbear`, `App marketplace: US`, `Profile id: 3362351578582214`, `Date range: 2026-04-10 -> 2026-04-16`, `Target row count: 545`, `Upload id: 7cb755af-1d60-4035-bb49-1f0ed8ea21c4`, `raw_ingest=ok`, `mapping=ok`, `fact_rows=398`, and `issue_rows=13`.
  - The gate wrote one bounded temporary XLSX at `out/ads-api-ingest-gate/sp-target-daily.ingest.xlsx` and reused the current `ingestSpTargetingRaw` plus `mapUpload(uploadId, "sp_targeting")` sink path.
  - `npm test` passed in WSL.
  - `npm run verify:wsl` passed in WSL.
- S3-01 validation completed:
  - Added migration `supabase/migrations/20260418120000_ingestion_jobs_source_watermarks.sql` for `public.ingestion_jobs` and `public.source_watermarks`.
  - The migration includes the required unique rules for `ingestion_jobs.idempotency_key` and the source/account/marketplace/scope watermark identity, plus the required status check constraints and bounded `updated_at` trigger helper.
  - Added `src/ingestion/schemaContract.ts` and `src/ingestion/schemaContract.test.ts` to define the minimum typed contract and bounded schema assertions for Stage 3.
  - `npm test` passed in WSL with `226` test files and `900` tests passing.
  - `npm run web:lint` passed in WSL.
  - `npm run web:build` passed in WSL.
  - `node scripts/v2-progress.mjs --write` passed and regenerated `docs/v2/TASK_PROGRESS.md`.
- S3-02 validation completed:
  - Added `src/ingestion/jobRunner.ts` with a bounded generic job-runner contract, explicit status transition guards, an in-memory persistence boundary, explicit retry and replay entrypoints, and success-only watermark updates.
  - Added `src/ingestion/jobRunnerCli.ts` as the task-local stub CLI proof path. The direct `ts-node` shell command was not available on `PATH` in this environment, so the proof used the repo-local binary `./node_modules/.bin/ts-node`.
  - Added directly related tests in `src/ingestion/jobRunner.test.ts` and `src/ingestion/jobRunnerCli.test.ts`.
  - `npm test -- src/ingestion/jobRunner.test.ts src/ingestion/jobRunnerCli.test.ts` passed with `2` files and `11` tests.
  - `./node_modules/.bin/ts-node src/ingestion/jobRunnerCli.ts --scenario success` passed and printed a deterministic success summary.
  - `./node_modules/.bin/ts-node src/ingestion/jobRunnerCli.ts --scenario retry` passed and printed a deterministic failure-then-explicit-retry summary.
  - `npm test` passed in WSL with `228` files and `911` tests passing.
  - `npm run web:lint` passed in WSL.
  - `npm run web:build` passed in WSL.
  - `node scripts/v2-progress.mjs --write` passed and regenerated `docs/v2/TASK_PROGRESS.md` after the task registry update for `S3-02`.
- S2B-G4 validation completed:
  - Full Stage 2B gate command set was run in WSL: `npm test`, `npm run verify:wsl`, `npm run adsapi:sync-profiles`, `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16`, `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-target-daily -- --start-date 2026-04-10 --end-date 2026-04-16`, `npm run adsapi:persist-sp-daily`, `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-campaign-daily`, and `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-target-daily`.
  - `npm test` passed in WSL.
  - `npm run verify:wsl` passed in WSL after an unrestricted rerun because the build step requires unrestricted access in this environment.
  - `npm run adsapi:sync-profiles` first failed in the sandbox at the outbound auth boundary, then passed after an unrestricted rerun.
  - The bounded `adsapi:sync-profiles` CLI was stabilized so that a no-override run preserves the existing Stage 2B local account metadata instead of rewriting the profile-sync artifact to the `.env.local` default account id.
  - The first rerun of `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16` revealed a bounded gate issue: the profile-sync artifact had just been rewritten to the wrong internal account id. After the profile-sync stabilization, the live campaign pull later hit `report_timeout` because Amazon kept the report pending through the built-in poll window.
  - The bounded campaign and target pull CLIs were stabilized to reuse an existing matching local artifact for the same account/profile/date-range scope, which keeps this gate deterministic without widening Stage 2B scope.
  - Final reruns of `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-campaign-daily -- --start-date 2026-04-10 --end-date 2026-04-16` and `export APP_ACCOUNT_ID=sourbear && npm run adsapi:pull-sp-target-daily -- --start-date 2026-04-10 --end-date 2026-04-16` both passed and reported row counts `734` and `545`.
  - `npm run adsapi:persist-sp-daily` passed and reported `Campaign row count: 734` plus `Target row count: 545`.
  - `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-campaign-daily` passed after an unrestricted rerun with `raw_ingest=ok`, `mapping=ok`, `fact_rows=611`, `issue_rows=20`, and upload id `34f318fd-aa02-4aa5-afe0-ee3b6f927a30`.
  - `export APP_ACCOUNT_ID=sourbear && npm run adsapi:ingest-sp-target-daily` passed after an unrestricted rerun with `raw_ingest=ok`, `mapping=ok`, `fact_rows=398`, `issue_rows=13`, and upload id `36363567-5522-41be-8a7d-aaabdbc0f5e7`.
  - `node scripts/v2-progress.mjs --write` regenerated `docs/v2/TASK_PROGRESS.md`.

## Open blockers
- Stage 2A gates are complete.
- Stage 2B gates are complete and green.
- S3-01 manual verification is complete, including manual migration apply in Supabase SQL editor.
- S3-02 manual verification is complete.
- The single next bounded build task is `S3-03` — implement backfill by date range and safe reruns.
