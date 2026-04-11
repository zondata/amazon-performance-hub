# Amazon Performance Hub V2 — AGENTS

## Mission
Build a lean V2 for Amazon performance and query/rank control without recreating V1 surface sprawl.

V2 release 1 must be:
- human-first,
- agent-readable,
- deterministic-first for diagnosis,
- strict about source-of-truth and evidence,
- read-only for agent actions against Amazon.

## Non-negotiable product rules
1. V2 is not a generic rebuild of V1.
2. V2 primary pages are only:
   - `Overview`
   - `Queries`
3. All other surfaces are secondary utilities or admin.
4. Do not make `keyword` the only core entity.
   Use distinct concepts for:
   - `search_query`
   - `ad_target`
   - `asin_query_goal`
5. Release 1 supports diagnosis + recommendation + logging first.
   Do not add autonomous campaign execution.
6. Keep ranking import manual-first if automation is not reliable.
7. Do not hide evidence behind AI summaries.
8. Memory must be structured and traceable to evidence.

## Build discipline
### Before coding
Read these files first:
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- the current stage section in `docs/v2/BUILD_PLAN.md` if present

### Allowed V2 shape
Prefer these boundaries:
- `apps/web/src/app/v2/*`
- `src/connectors/sp-api/*`
- `src/connectors/ads-api/*`
- `src/connectors/helium10/*`
- `src/ingestion/*`
- `src/warehouse/*`
- `src/marts/*`
- `src/diagnosis/*`
- `src/memory/*`
- `src/changes/*`
- `src/testing/fixtures/*`

### Forbidden defaults
- Do not add new V2 features to monolithic V1 pages just because it is faster.
- Do not create new UI truth layers that bypass marts.
- Do not let raw Amazon payloads drive page rendering directly.
- Do not let agent-authored free text become memory without evidence links.
- Do not add SB/SD decision workflow before Sponsored Products flow is stable.
- Do not add Amazon writeback automation in release 1.
- Do not expand scope because a task feels adjacent.

## Required task slicing
Every Codex task must be bounded.

A valid task must define:
- one objective,
- exact allowed files or directories,
- explicit forbidden changes,
- required test commands,
- acceptance checks,
- required status-file update.

If the task is too large to meet those conditions, split it.

## Required status updates
If you changed any V2 file, you must update `docs/v2/BUILD_STATUS.md` in the same branch.

Minimum required updates:
- update `Last updated`
- update `Current task`
- mark completed checklist items
- append one row to `Task log`
- record tests actually run
- record any manual follow-up still required

Do not end a V2 task with silent status drift.

## Testing rules
### Always run when relevant
- `npm test`
- `npm run web:lint`
- `npm run web:build`

If you cannot run one of them, say exactly why in `docs/v2/BUILD_STATUS.md` under the task entry.

### Browser testing
Use browser testing against the local or staging V2 app.
Do not use browser automation against Amazon Seller Central or Amazon Ads console.

### Manual testing handoff
If manual testing is needed, write it in this exact shape:

MANUAL TEST REQUIRED:
1. Exact command(s) to run
2. Exact route to open
3. Exact click/input steps
4. Exact expected result
5. Exact anomaly to look for

## Git discipline
- One task branch per bounded task.
- One commit series per bounded task.
- Do not bundle unrelated work.
- Do not “clean up nearby code” unless the task explicitly allows it.
- Prefer small reviewable PRs.

## Recommended branch naming
- `v2/00-control-plane`
- `v2/01-repo-boundary`
- `v2/02-sp-api-auth`
- `v2/03-ads-api-auth`
- `v2/04-core-warehouse`
- `v2/05-sqp-search-terms`
- `v2/06-rank-import`
- `v2/07-overview-mart`
- `v2/08-query-mart`

## What to do when blocked
If blocked by credentials, external approval, Amazon app setup, Supabase project settings, or a product decision:
1. stop expanding the task,
2. finish everything else that is in scope,
3. update `docs/v2/BUILD_STATUS.md`,
4. write one precise blocker entry,
5. state the minimum human action required.

## Decision priority
When instructions conflict, use this order:
1. task spec for the current bounded task
2. this file
3. `docs/v2/BUILD_STATUS.md`
4. root `AGENTS.md`
5. older V1 docs

## Codex App-only implementation policy
- All V2 implementation tasks for this repo must run in Codex App.
- If you are about to implement a V2 task manually in VS Code, stop and redirect the task back to Codex App.
- Local WSL work on `v2/*` branches is limited to:
  - `git fetch`
  - `git checkout`
  - `git pull`
  - `git diff`
  - `npm test`
  - `npm run web:lint`
  - `npm run web:build`
  - debugging and manual verification
- Manual code edits in VS Code are not the default V2 workflow.
- Local commits to `v2/*` are blocked unless explicitly overridden with `ALLOW_LOCAL_V2_COMMIT=1`.
