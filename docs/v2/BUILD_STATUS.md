# Amazon Performance Hub V2 - Build Status

Last updated: 2026-04-11
Current owner: Codex + Albert
Current branch: `v2/00-control-plane`
Current task: `V2-00B - Enforce Codex App-only V2 implementation policy`
Current stage: `Stage 0 - scope freeze and control files`

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
`V2-00B`

### Objective
Add a Codex App-only V2 implementation policy, document the local WSL limits, and block default local commits on `v2/*` branches with a repo hook.

### Allowed files
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/ENV_SETUP.md`
- `docs/v2/BUILD_STATUS.md`
- `.githooks/pre-commit`

### Forbidden changes
- do not modify files under `apps/`
- do not modify files under `src/`
- do not modify files under `supabase/`
- do not create V2 routes
- do not change package dependencies
- do not add Husky or any package-based hook manager
- do not edit business logic

### Required checks
- [x] `git diff --stat`
- [ ] `npm test` (not run; policy-only task)
- [ ] `npm run web:lint` (not run; policy-only task)
- [ ] `npm run web:build` (not run; policy-only task)
- [ ] browser test if UI changed

### Status
- [x] complete
- [ ] planned
- [ ] in progress
- [ ] blocked

### Notes
- Added the Codex App-only V2 workflow guardrail.
- Added `.githooks/pre-commit` to block default local commits on `v2/*` unless `ALLOW_LOCAL_V2_COMMIT=1` is set.
- No app build or test commands were run because this task only changes repo policy and setup docs.

## Task log
| Date | Task ID | Branch | Scope | Result | Tests run | Manual follow-up |
|---|---|---|---|---|---|---|
| 2026-04-10 | INIT | _n/a_ | Created V2 build plan and control process | planned | none | add control files to repo |
| 2026-04-11 | V2-00B | `v2/00-control-plane` | Added Codex App-only V2 workflow policy, WSL usage limits, and local commit guard hook for `v2/*` branches | complete | `git diff --stat`; hook executable check | set `git config core.hooksPath .githooks` locally |

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
