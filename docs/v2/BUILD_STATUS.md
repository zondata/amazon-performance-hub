# V2 Build Status

Last updated: `2026-04-13`
Current branch: `v2/02-sp-api-auth`
Current task: `V2-06 - Add report document retrieval only`
Current stage: `Stage 2A - SP-API auth + first Sales and Traffic pull`

## Stage checklist
- [x] `Stage 1` - Repo boundary and V2 route/module skeleton
- [x] `Stage 2A` - SP-API auth + first Sales and Traffic pull

## Current task card
- Task ID: `V2-06`
- Title: `Add report document retrieval only`
- Objective: Extend the existing first report-request and report-status boundaries so the system can retrieve the report document metadata and download the raw report document bytes for one completed Sales and Traffic report, with no decryption beyond what the API/document flow minimally requires for access, no parsing, no normalization, no ingestion, no warehouse writes, and no UI.
- Allowed files:
  - `src/connectors/sp-api/**`
  - `src/testing/fixtures/**` only if needed for unit tests
  - `docs/v2/BUILD_STATUS.md`
  - `docs/v2/tasks/V2-06-report-document-retrieval-only.md`
  - `package.json`
- Forbidden:
  - `apps/web/**`
  - `src/ingestion/**`
  - `src/warehouse/**`
  - `src/marts/**`
  - `src/diagnosis/**`
  - `src/memory/**`
  - `src/changes/**`
  - `supabase/**`
  - `.env*` files with real secrets
  - any report content parsing or normalization
  - any database write
  - any UI
  - any Ads API work
  - any generic multi-report orchestration
  - any downstream business logic that interprets the report content
- Required checks:
  - [x] `npm test`
  - [x] `npm run spapi:get-first-report-document -- --report-id <real-report-id>`
  - [x] `npm run verify:wsl`
- Status: `complete`
- Notes:
  - Stage 2A remains recorded complete from the earlier successful `npm run verify:wsl` and `npm run spapi:first-call` confirmation on `2026-04-13`.
  - V2-06 is limited to one Reports API report-document retrieval path for the same `GET_SALES_AND_TRAFFIC_REPORT` family proven in V2-04 and V2-05.
  - V2-06 downloads the raw document bytes and stores them under `out/sp-api-report-documents/` without parsing or ingestion.
  - The follow-up after this task must stay bounded to report content parsing only, not ingestion or warehouse writes.

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

## Open blockers
- No blocker is open for V2-06 itself.
- The next bounded task must remain focused on report content parsing only, without widening into ingestion or warehouse writes.
