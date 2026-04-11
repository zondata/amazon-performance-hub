# Amazon Performance Hub V2 — Build Status

Last updated: 2026-04-10
Current owner: Codex + Albert
Current branch: _not started_
Current task: _none_
Current stage: _pre-stage-0_

## Locked decisions
- [x] V2 release 1 is human-first and agent-readable.
- [x] Primary pages are only `Overview` and `Queries`.
- [x] Release 1 keeps agent actions read-only against Amazon.
- [x] Sponsored Products is the first decision workflow.
- [x] `search_query`, `ad_target`, and `asin_query_goal` stay separate.
- [x] Memory must be structured and evidence-linked.
- [x] V2 must not recreate V1 surface sprawl.

## Stage checklist
- [ ] Stage 0 — scope freeze and control files
- [ ] Stage 1 — repo boundary for V2
- [ ] Stage 2A — SP-API auth + first Sales and Traffic pull
- [ ] Stage 2B — Ads API auth + first Sponsored Products pull
- [ ] Stage 3 — ingestion backbone
- [ ] Stage 4 — canonical marts
- [ ] Stage 5 — memory system
- [ ] Stage 6 — human UI
- [ ] Stage 7 — diagnosis + agent review loop
- [ ] Stage 8 — change logging + execution handoff
- [ ] Stage 9 — intraday pulse
- [ ] Stage 10 — ranking automation evaluation

## Current task card
### Task ID
_none_

### Objective
_none_

### Allowed files
- _fill before task starts_

### Forbidden changes
- _fill before task starts_

### Required checks
- [ ] `npm test`
- [ ] `npm run web:lint`
- [ ] `npm run web:build`
- [ ] browser test if UI changed

### Status
- [ ] planned
- [ ] in progress
- [ ] blocked
- [ ] complete

### Notes
- none

## Task log
| Date | Task ID | Branch | Scope | Result | Tests run | Manual follow-up |
|---|---|---|---|---|---|---|
| 2026-04-10 | INIT | _n/a_ | Created V2 build plan and control process | planned | none | add control files to repo |

## Decisions log
| Date | Decision | Reason |
|---|---|---|
| 2026-04-10 | Use one repo with a hard V2 boundary instead of extending V1 pages directly | preserve shared foundation while preventing V1 sprawl |
| 2026-04-10 | Use bounded Codex task slices instead of one giant “build V2” prompt | reduce drift and improve reviewability |

## Environment checklist
- [ ] GitHub repo connected to Codex cloud
- [ ] Codex app or Codex CLI installed locally
- [ ] project-local `.codex/config.toml` added
- [ ] browser testing tool installed
- [ ] Supabase project chosen for V2 work
- [ ] V2 environment variables documented
- [ ] Amazon SP-API app setup started
- [ ] Amazon Ads API app setup started

## Open blockers
- none
