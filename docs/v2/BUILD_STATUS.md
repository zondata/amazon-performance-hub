# V2 Build Status

Last updated: `2026-04-14`
Current branch: `v2/02-sp-api-auth`
Current task: `V2-13 - Add one dry-run warehouse adapter execution only`
Current stage: `Stage 2A - SP-API auth + first Sales and Traffic pull`

## Stage checklist
- [x] `Stage 1` - Repo boundary and V2 route/module skeleton
- [x] `Stage 2A` - SP-API auth + first Sales and Traffic pull

## Current task card
- Task ID: `V2-13`
- Title: `Add one dry-run warehouse adapter execution only`
- Objective: Extend the existing local warehouse adapter mapping boundary so the system can execute exactly one bounded dry-run warehouse adapter execution step in `src/warehouse/**` that reads one local warehouse-ready contract artifact plus one local warehouse adapter mapping definition artifact and produces one deterministic local dry-run execution artifact, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.
- Allowed files:
  - `src/warehouse/**`
  - `src/ingestion/**` only where needed to wire the bounded entrypoint to the new dry-run execution boundary
  - `src/testing/fixtures/**` only if needed for unit tests
  - `docs/v2/BUILD_STATUS.md`
  - `docs/v2/tasks/V2-13-warehouse-adapter-dry-run-execution-only.md`
  - `package.json`
- Forbidden:
  - `apps/web/**`
  - `src/marts/**`
  - `src/diagnosis/**`
  - `src/memory/**`
  - `src/changes/**`
  - `supabase/**`
  - `.env*` files with real secrets
  - any database write
  - any UI
  - any Ads API work
  - any generic multi-report orchestration
  - any downstream business logic or KPI interpretation
  - any warehouse schema or migration work
  - any real warehouse execution
- Required checks:
  - [x] `npm test`
  - [x] `npm run spapi:dry-run-first-report-warehouse-adapter -- --report-id <real-report-id>`
  - [x] `npm run verify:wsl`
- Status: `complete`
- Notes:
  - Stage 2A remains recorded complete from the earlier successful `npm run verify:wsl` and `npm run spapi:first-call` confirmation on `2026-04-13`.
  - V2-13 is limited to one warehouse adapter dry-run execution step for the same `GET_SALES_AND_TRAFFIC_REPORT` family proven in V2-04 through V2-12, still with no real warehouse writes.
  - The dry-run target is intentionally local-only at `out/sp-api-warehouse-dry-run/`; it is a deterministic JSON dry-run execution artifact and not a warehouse write or adapter execution against any real target.
  - The dry-run boundary reads both the V2-11 warehouse-ready contract artifact and the V2-12 warehouse adapter mapping artifact, cross-validates `reportId`, `reportFamily`, `reportType`, section names, row counts, and target table names, and prints only a redacted summary to the console.
  - The bounded payload shape is `dryRunPayload.targetOperations[]`, with explicit `targetTableName`, `keyColumns`, `mappedColumnCount`, `sourceRowCount`, safe preview record ids, `mode = dry_run`, `writesAttempted = false`, and `writesAttemptedCount = 0`.
  - The next follow-up after this task must stay bounded to one explicit adapter interface for future write execution, still without any actual write execution.

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

## Tests and verification
- Codex in-task validation:
  - `npm run snapshot:debug` passed and produced a timestamped bundle in `out/debug-snapshots/`.
  - `ls -lah out/debug-snapshots || true` inspected the snapshot output directory.
  - `unzip -l out/debug-snapshots/*.zip | sed -n '1,120p' || true` inspected the generated bundle contents.
  - `git config --get core.hooksPath` returned `.githooks`.
  - `sed -n '1,220p' .githooks/pre-commit || true` inspected the active hook implementation before replacement.
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

## Open blockers
- No blocker is open for V2-13 implementation itself.
- The next bounded task after V2-13 must remain focused on one explicit adapter interface for future write execution, still without any actual write execution.
