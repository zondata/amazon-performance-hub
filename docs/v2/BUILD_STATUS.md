# V2 Build Status

Last updated: `2026-04-13`
Current branch: `v2/02-sp-api-auth`
Current task: `V2-03 - Make the first real SP-API call only`
Current stage: `Stage 2A - SP-API auth + first Sales and Traffic pull`

## Stage checklist
- [x] `Stage 1` - Repo boundary and V2 route/module skeleton
- [ ] `Stage 2A` - SP-API auth + first Sales and Traffic pull

## Current task card
- Task ID: `V2-03`
- Title: `Make the first real SP-API call only`
- Objective: Use the existing SP-API auth skeleton and local production credentials to perform one minimal real SP-API read call successfully, with no ingestion, no warehouse writes, no UI, and no Amazon write actions.
- Allowed files:
  - `src/connectors/sp-api/**`
  - `src/testing/fixtures/**` only if needed for unit tests
  - `docs/v2/BUILD_STATUS.md`
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
  - any UI or admin page
  - any Ads API code
  - any report create/poll/download/parse/ingest code
- Required checks:
  - [ ] `npm run verify:wsl` (operator handoff required)
  - [ ] `npm run spapi:first-call` (operator handoff required)
- Status: `in progress`
- Notes:
  - This task is the first real SP-API call proof for V2.
  - The connector now targets Sellers `getMarketplaceParticipations` as the single minimal production read call path.
  - Amazon documents Sellers `getMarketplaceParticipations` behind Selling Partner Insights or Product Listing in NA/EU; the app has now been corrected to Selling Partner Insights and re-authorized.
  - Because that role correction is now in place, `V2-03` should stay on the existing Sellers first-call path and should not switch to Reports API.
  - Corrected `V2-03` contract for this use case: the first-call path is LWA-only and does not require AWS env vars or SigV4 signing.
  - Required env for the first-call boundary is now limited to LWA client id, LWA client secret, refresh token, region, and marketplace id.
  - The first-call request now uses `x-amz-access-token` with a safe redacted success summary and no AWS authorization header path.
  - The first-call CLI loads repo-local `.env.local` before env validation so the operator can run the bounded proof command from repo root.
  - Stage `2A` must remain incomplete until the operator confirms both `npm run verify:wsl` and `npm run spapi:first-call` succeed.

## Task log
| Date | Task ID | Branch | Scope | Result | Tests run | Follow-up |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-04-12 | `V2-01` | `v2/01-repo-boundary` | Create V2 route boundary and placeholder module boundaries only. | `complete` | `operator later confirmed npm run verify:wsl passed` | Stage 2A depends on SP-API auth and first real call proof. |
| 2026-04-12 | `V2-02` | `v2/01-repo-boundary` | Create the SP-API auth skeleton only: typed env/config validation, endpoint resolution, and refresh-token exchange boundary. | `complete` | `operator confirmed npm run verify:wsl passed` | First real SP-API call proof is still required before Stage 2A can be completed. |
| 2026-04-12 | `V2-03` | `v2/01-repo-boundary` | Add one real SP-API Sellers read-call path with minimal SigV4 signing, safe summary output, and no report sync/warehouse/UI/Ads API scope expansion. | `in progress` | `operator confirmed npm run verify:wsl passed; npm run spapi:first-call initially failed because the CLI was not loading repo-local .env.local; rerun required after env-loader fix` | Next bounded task should be the first report call path after manual confirmation of the real-call proof. |
| 2026-04-13 | `V2-03` | `v2/02-sp-api-auth` | Correct the first-call boundary to LWA-only env + `x-amz-access-token`, keep Sellers `getMarketplaceParticipations` as the bounded first real call after the Selling Partner Insights role correction, and avoid any Reports API/SigV4 expansion in this task. | `in progress` | `npm test passed; npm run web:lint passed; npm run web:build passed after an unrestricted rerun because the sandboxed build could not fetch Google Fonts` | Operator still needs to run `npm run verify:wsl` and `npm run spapi:first-call`, then paste both results; next bounded task remains the first report call path only. |

## Tests and verification
- Codex in-task validation:
  - `npm test` passed.
  - `npm run web:lint` passed.
  - `npm run web:build` passed after an unrestricted rerun; the initial sandboxed run failed because Next.js could not fetch Google Fonts.
  - SP-API connector tests now cover env validation without AWS keys, token exchange error surfacing, endpoint resolution, local env loading, and LWA-only safe first-call request behavior.
- Operator verification required:
  - `npm run verify:wsl`
  - `npm run spapi:first-call`

## Open blockers
- `V2-03` still needs operator confirmation that both `npm run verify:wsl` and `npm run spapi:first-call` succeed in the trusted WSL environment with real credentials.
- The next bounded task should remain focused on the first report call path only after this proof-of-read step is confirmed.
