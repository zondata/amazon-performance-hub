# Amazon Performance Hub V2 - Build Status

Last updated: 2026-04-11
Current owner: Codex + Albert
Current branch: `v2/01-repo-boundary`
Current task: `V2-01 - Create the V2 repo boundary only`
Current stage: `Stage 1 - repo boundary for V2`

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
`V2-01`

### Objective
Create the folder and route boundaries for V2 without implementing Amazon APIs or product logic yet.

### Allowed files
- `apps/web/src/app/v2/**`
- `src/connectors/**`
- `src/ingestion/**`
- `src/warehouse/**`
- `src/marts/**`
- `src/diagnosis/**`
- `src/memory/**`
- `src/changes/**`
- `src/testing/fixtures/**`
- `docs/v2/BUILD_STATUS.md`

### Forbidden changes
- existing V1 pages except minimal navigation link wiring if explicitly needed
- Amazon auth code
- report ingestion code
- migrations
- marts logic

### Required checks
- [x] `npm run web:lint`
- [ ] `npm run web:build` (blocked by existing Windows-node/native-module mismatch for `lightningcss`)

### Status
- [ ] planned
- [ ] in progress
- [x] blocked
- [ ] complete

### Notes
- Added placeholder `/v2` routes only.
- Added placeholder module boundaries only.
- No Amazon auth, report sync, migrations, or real data-fetching logic was added.
- Stage 1 is not marked complete because the required `npm run web:build` acceptance check did not pass in this environment.

## Task log
| Date | Task ID | Branch | Scope | Result | Tests run | Manual follow-up |
|---|---|---|---|---|---|---|
| 2026-04-10 | INIT | _n/a_ | Created V2 build plan and control process | planned | none | add control files to repo |
| 2026-04-11 | V2-00B | `v2/00-control-plane` | Added Codex App-only V2 workflow policy, WSL usage limits, and local commit guard hook for `v2/*` branches | complete | `git diff --stat`; hook executable check | set `git config core.hooksPath .githooks` locally |
| 2026-04-11 | V2-01 | `v2/01-repo-boundary` | Created placeholder `/v2` routes and placeholder module boundaries without auth, report sync, or marts logic | blocked | `npm run web:lint` pass; `npm run web:build` fail (`lightningcss.win32-x64-msvc.node` missing during Next build) | resolve the existing local Next/native-module build environment and rerun `npm run web:build` |

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
- `npm run web:build` currently fails in the local environment before full route compilation because Next/Tailwind resolves a missing native module: `lightningcss.win32-x64-msvc.node`.
