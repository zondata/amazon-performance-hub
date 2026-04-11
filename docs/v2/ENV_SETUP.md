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
- Use Codex cloud for long-running background tasks and PR creation.
- Use Codex app or Codex CLI locally when you want direct access to your machine and local browser.

### Why
This removes most manual copy-paste between chat and the coding agent.
The repo files become the shared memory surface.

## 3. Local machine tools to install
### Required
- Node LTS and npm
- GitHub CLI (`gh`)
- Playwright test dependency for deterministic browser tests
- one local browser installed for Playwright use
- Codex app or Codex CLI

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

## 9. Enable the local V2 branch commit guard
Run:
- `git config core.hooksPath .githooks`
- `chmod +x .githooks/pre-commit`

Why this exists:
- `v2/*` branches in this repo are intended to be implemented in Codex App, not manually in VS Code / WSL.
- WSL local remains available for fetch, checkout, diff, test, lint, build, debugging, and manual verification.

Emergency override:
- `ALLOW_LOCAL_V2_COMMIT=1 git commit -m "..."`

Use the override only for an intentional emergency local fix on a `v2/*` branch.
