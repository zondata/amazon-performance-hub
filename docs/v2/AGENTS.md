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
- the current task file under `docs/v2/tasks/` if it exists
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/DEBUG_HANDOFF.md`
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

## Task spec file rule
There are two classes of task-spec files.

### 1. Canonical tracked task specs
These belong in git and may be committed:
- `docs/v2/tasks/S*.md`
- only when the file is the canonical source-of-truth spec for a real repo task or gate
- one canonical tracked task spec per real task id

Examples:
- `docs/v2/tasks/S2B-04-sp-campaign-daily-connector.md`
- `docs/v2/tasks/S2B-G2-first-sp-campaign-daily-ingest-gate.md`

### 2. Scratch drafts and handoff specs
These must stay outside commits and normally should stay outside the repo entirely:
- ad hoc `*-spec.md`
- downloaded handoff drafts
- duplicate task drafts
- one-off planning notes not intended as canonical repo history
- generated task files stored at repo root such as `docs/v2/S2B-04-...md` instead of `docs/v2/tasks/...`

Rules:
- Do not commit scratch drafts.
- Do not leave duplicate task specs in the repo root or `docs/v2/`.
- If a task spec is only a temporary handoff draft, store it outside the repo or delete it after use.
- Before commit, stage only the canonical tracked task spec for the active task, not scratch drafts.

### Pre-commit selection rule
Before every V2 task commit:
1. stage tracked source-of-truth task file only if it lives under `docs/v2/tasks/`
2. exclude:
   - `docs/v2/*-spec.md`
   - duplicate task files outside `docs/v2/tasks/`
   - scratch planning notes
   - downloaded prompt/spec handoff files
3. if both a canonical task file and a duplicate scratch draft exist, commit only the canonical `docs/v2/tasks/...` file

### Cleanup rule
After a task is accepted and pushed:
- keep the tracked canonical `docs/v2/tasks/...` file
- delete or move any untracked duplicate scratch drafts outside the repo
- maintain a clean worktree so later tasks do not risk accidental staging

### Codex commit rule
Codex must:
- include the canonical active task spec if it is part of the repo history for that task
- exclude untracked scratch drafts from staging and commit
- mention any remaining untracked scratch task files in the final push report
- never treat scratch drafts as source of truth over the tracked canonical task file

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
### Verification authority
- WSL is the canonical verification environment for all V2 work.
- Final pass/fail for a V2 task is based on the exact WSL commands listed in the task spec or status file.

### Always run when relevant
- `npm test`
- `npm run web:lint`
- `npm run web:build`

If you cannot run one of them, say exactly why in `docs/v2/BUILD_STATUS.md` under the task entry.

### Browser testing
- Browser-facing V2 tasks may use Playwright against the local or staging V2 app.
- Playwright is allowed for repo-controlled routes such as `/v2/*`.
- Codex should include Playwright in automated verification for browser-facing V2 tasks when feasible.
- Manual verification is still required when acceptance depends on human judgment, external auth flows, or ambiguous UI behavior.
- Do not use browser automation against Amazon Seller Central, Amazon Ads console, or other Amazon-operated consoles.

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
- The pushed GitHub task branch is the clean source of truth for accepted V2 state.
- If WSL verification passes, commit and push normally.
- If WSL verification fails, do not push broken work to the main task branch just for inspection.
- Generate a WSL debug handoff bundle with `npm run snapshot:debug` and upload that zip to ChatGPT web as the source of truth for the broken local state.
- If a remote backup of broken local work is still required, use a clearly named `debug/*` branch instead of the main `v2/*` task branch.

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

## WSL-first implementation policy
- All V2 implementation tasks for this repo must run in WSL.
- Preferred implementation tool is Codex CLI running inside WSL.
- WSL is the canonical verification environment for `npm test`, `npm run web:lint`, `npm run web:build`, and any task-specific acceptance command.
- GitHub task branches, normally `v2/*`, are the clean source of truth after verification passes and the branch is pushed.
- Unpushed broken local state is not assumed to exist on GitHub; when that state must be handed off, `npm run snapshot:debug` is the source of truth.
- Manual editor work is secondary to the Codex CLI path; do not treat ad hoc local edits as the canonical V2 workflow when Codex CLI can do the task.

## Push handoff workflow

### Canonical push workflow
- All V2 implementation and verification must run in WSL.
- Preferred implementation tool is Codex CLI running inside WSL.
- The current checked-out `v2/*` branch is the canonical working branch for the active task unless the task explicitly states otherwise.
- After implementation and automated checks pass, do not push immediately.
- Stop and ask the operator to perform the required manual verification steps.
- Wait for an explicit operator reply before pushing.

### Required operator reply before push
- The operator must explicitly reply with: `all passed`
- Do not treat vague approval as push authorization.

### Required behavior after operator replies `all passed`
- Re-check the current branch with `git branch --show-current`
- Re-check repo state with `git status`
- If the intended changes are not yet committed, stage only the intended task files and create the commit
- Push the currently checked-out branch with:
  - `git push origin HEAD`
- After push, print:
  - pushed branch name
  - latest commit SHA
  - final `git status`

### Failure path
- If automated checks fail, do not commit or push.
- If manual verification fails, do not push.
- If manual verification fails or the operator reports problems, generate a debug handoff bundle with:
  - `npm run snapshot:debug`
- Use the generated snapshot zip as the source of truth for the broken local state.
- Do not push broken work to the main `v2/*` task branch just for inspection.
- If a remote backup of broken work is absolutely needed, use a clearly named `debug/*` branch.

### Safety checks before push
- Push by current branch reference, not by manually typed branch name.
- Use:
  - `git push origin HEAD`
- Never assume `main` is the correct push target.
- Never assume GitHub contains the latest local broken state.

### Commit scope rule
- Stage and commit only the files intended for the current bounded task.
- Do not include unrelated local changes in the push-handoff commit.

### Minimum push report
- After a successful push, report:
  - branch name
  - commit SHA
  - commit message
  - whether the working tree is clean
