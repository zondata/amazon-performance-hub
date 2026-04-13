# Amazon Performance Hub V2 — Environment Setup

## 1. Repo and branching
- Use the existing repo.
- Build V2 behind a hard boundary instead of continuing the V1 page sprawl.
- Create a dedicated V2 branch for each bounded task.

Recommended branch pattern:
- `v2/00-control-plane`
- `v2/01-repo-boundary`
- `v2/02-sp-api-auth`
- `v2/03-ads-api-auth`

## 2. GitHub + Codex setup
### Required
- Connect the GitHub repository to Codex cloud.
- Use WSL as the canonical repo execution environment.
- Use Codex CLI inside WSL as the preferred implementation tool.
- Use the pushed GitHub task branch as the clean source of truth after verification passes.

### Why
The repo files become the durable shared memory surface.
WSL is the stable local authority for implementation and verification.

## 3. Local machine tools to install
### Required
- WSL2 Ubuntu with the repo checked out inside WSL
- Node LTS and npm in WSL
- GitHub CLI (`gh`)
- `zip` and `unzip` in WSL for debug handoff bundles
- one local browser installed for app verification when needed
- Codex CLI in WSL

### Recommended
- keep one Node version pinned for local, CI, and Codex setup scripts
- use one consistent package manager for all V2 work

## 4. Codex project files
Add these files:
- `.codex/config.toml`
- `.codex/rules/default.rules`
- `docs/v2/AGENTS.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/CODEX_WORKFLOW.md`
- `docs/v2/DEBUG_HANDOFF.md`

## 5. Browser testing setup
### Recommended approach
Use browser tests against your app only.

Required local targets:
- local dev server
- local preview server or staging server
- Playwright-based tests for Overview / Queries pages

Do not use browser automation against Amazon Seller Central or Amazon Ads console.
Use official APIs for Amazon data.

## 6. Supabase / database setup
Before V2 coding, decide:
- reuse current Supabase project or create a fresh V2 project
- naming convention for V2 schemas / tables / migrations
- secret storage location for Amazon credentials

Minimum required secrets planning:
- SP-API LWA client id
- SP-API LWA client secret
- SP-API refresh token(s)
- Ads API refresh/access token setup
- Ads profile mapping records
- Supabase service-role handling

## 7. Amazon setup tasks that Albert must do
These are human-owned, not Codex-owned:
- create/register the SP-API app
- create/register the Amazon Ads app
- complete LWA authorization
- approve or request required roles
- store credentials in your chosen secret store
- decide whether one deployment or separate deployments are needed for account isolation

## 8. Minimum human/manual steps left in the loop
Human work should be limited to:
- credentials and external account setup
- approvals for risky commands
- reviewing merged behavior
- true product decisions
- final live-account smoke checks

Everything else should be done by Codex when the task spec is bounded.

## 9. Verification and debug handoff
- Run the task’s exact verification commands in WSL. When relevant, that includes `npm run verify:wsl`.
- If WSL verification passes, commit and push the task branch normally.
- If WSL verification fails, do not push broken work to the main task branch just so another chat can inspect it.
- Instead run `npm run snapshot:debug` in WSL and upload the generated zip bundle to ChatGPT web.
- In the new chat, state that the uploaded snapshot bundle is the source of truth for the broken local state and GitHub may not contain those latest unpushed changes.
- Main task branches should use the `v2/*` naming convention.
- Optional broken remote backup branches should use the `debug/*` naming convention.

## 10. Repo hook guardrails
- Recommended once per clone: `git config core.hooksPath .githooks`
- The repo pre-commit hook no longer blocks local commits on `v2/*` just because they are local.
- Current hook guardrails are narrow:
  - block staged `.env*` files and dependency artifacts
  - block staged `out/debug-snapshots/*` bundles
  - warn on `v2/*` when `docs/v2/BUILD_STATUS.md` is not staged
  - remind operators that broken WSL state should hand off through `npm run snapshot:debug`
