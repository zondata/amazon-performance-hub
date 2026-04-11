# Amazon Performance Hub V2 - Build Status

Last updated: 2026-04-11
Current owner: Codex + Albert
Current branch: `v2/01-repo-boundary`
Current task: `V2-02 - Create the SP-API auth skeleton only`
Current stage: `Stage 2A - SP-API auth + first Sales and Traffic pull`

## Locked decisions
- [x] V2 release 1 is human-first and agent-readable.
- [x] Primary pages are only `Overview` and `Queries`.
- [x] Release 1 keeps agent actions read-only against Amazon.
- [x] Sponsored Products is the first decision workflow.
- [x] `search_query`, `ad_target`, and `asin_query_goal` stay separate.
- [x] Memory must be structured and evidence-linked.
- [x] V2 must not recreate V1 surface sprawl.
- [x] V2 implementation is Codex App-first, with local WSL reserved for test/debug/review work.

## Stage checklist
- [ ] Stage 0 - scope freeze and control files
- [ ] Stage 1 - repo boundary for V2
- [ ] Stage 2A - SP-API auth + first Sales and Traffic pull
- [ ] Stage 2B - Ads API auth + first Sponsored Products pull
- [ ] Stage 3 - ingestion backbone
- [ ] Stage 4 - canonical marts
- [ ] Stage 5 - memory system
- [ ] Stage 6 - human UI
- [ ] Stage 7 - diagnosis + agent review loop
- [ ] Stage 8 - change logging + execution handoff
- [ ] Stage 9 - intraday pulse
- [ ] Stage 10 - ranking automation evaluation

## Current task card
### Task ID
`V2-02`

### Objective
Create the V2 Sponsored Products API authentication skeleton and environment contract without implementing report sync, warehouse writes, UI flows, or production data pulls.

### Allowed files
- `src/connectors/sp-api/**`
- `src/testing/fixtures/**` only if needed for auth/config unit tests
- `docs/v2/BUILD_STATUS.md`

### Forbidden changes
- `apps/web/**`
- `src/ingestion/**`
- `src/warehouse/**`
- `src/marts/**`
- `src/diagnosis/**`
- `src/memory/**`
- `src/changes/**`
- `supabase/**`
- `.env*` files with real secrets
- any Amazon write/execution code
- any real report ingestion code
- any real UI or admin page
- any Ads API code

### Required checks
- [x] `npm run verify:wsl` (passed in WSL via operator handoff)

### Status
- [ ] planned
- [ ] in progress
- [ ] blocked
- [x] complete

### Notes
- Added only the SP-API auth/config skeleton under `src/connectors/sp-api/`.
- Added typed env validation, region endpoint resolution, and an injected token refresh boundary with unit tests.
- This task covers only the auth skeleton portion of Stage 2A.
- `npm run verify:wsl` passed via operator handoff.
- Stage 2A is not marked complete because this task does not include the first real SP-API call.

## Task log
| Date | Task ID | Branch | Scope | Result | Tests run | Manual follow-up |
|---|---|---|---|---|---|---|
| 2026-04-10 | INIT | _n/a_ | Created V2 build plan and control process | planned | none | add control files to repo |
| 2026-04-11 | V2-00B | `v2/00-control-plane` | Added Codex App-only V2 workflow policy, WSL usage limits, and local commit guard hook for `v2/*` branches | complete | `git diff --stat`; hook executable check | set `git config core.hooksPath .githooks` locally |
| 2026-04-11 | V2-01 | `v2/01-repo-boundary` | Created placeholder `/v2` routes and placeholder module boundaries without auth, report sync, or marts logic | blocked | `npm run web:lint` pass; `npm run web:build` fail (`lightningcss.win32-x64-msvc.node` missing during Next build) | resolve the existing local Next/native-module build environment and rerun `npm run web:build` |
| 2026-04-11 | V2-02 | `v2/01-repo-boundary` | Added typed SP-API auth/config skeleton, endpoint resolver, and injected token refresh boundary without report sync, warehouse writes, UI, or Ads API work | complete | `npm run verify:wsl` (passed via operator handoff) | later bounded task must handle the first real SP-API call |

## Decisions log
| Date | Decision | Reason |
|---|---|---|
| 2026-04-10 | Use one repo with a hard V2 boundary instead of extending V1 pages directly | preserve shared foundation while preventing V1 sprawl |
| 2026-04-10 | Use bounded Codex task slices instead of one giant "build V2" prompt | reduce drift and improve reviewability |
| 2026-04-11 | Enforce Codex App as the default V2 implementation environment and block default local commits on `v2/*` | keep the stable implementation path consistent and reduce accidental VS Code drift |

## Environment checklist
- [ ] GitHub repo connected to Codex cloud
- [ ] Codex app or Codex CLI installed locally
- [ ] project-local `.codex/config.toml` added
- [ ] browser testing tool installed
- [ ] Supabase project chosen for V2 work
- [x] V2 environment variables documented
- [ ] Amazon SP-API app setup started
- [ ] Amazon Ads API app setup started
- [x] local V2 commit guard documented

## Open blockers
- none
