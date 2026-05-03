# Deployment Branch And Workflow Policy

## Production branch

- Production branch is `v3/database-only`.

## Scheduled GitHub Actions

- Scheduled GitHub Actions run from the production/default branch.
- A local fix does nothing for scheduled Actions until that fix is pushed and merged into `v3/database-only`.

## Vercel deployment

- Vercel production should deploy the same branch, or a known production commit from that branch.
- If Vercel is deploying a different branch or commit, the UI can disagree with the GitHub Actions behavior.

## Pipeline Status manual runs

- Pipeline Status manual buttons only work if Vercel has the GitHub dispatch env vars.
- Required env vars:
  - `GITHUB_ACTIONS_DISPATCH_TOKEN`
  - `GITHUB_ACTIONS_REPO_OWNER`
  - `GITHUB_ACTIONS_REPO_NAME`
  - `GITHUB_ACTIONS_WORKFLOW_FILE`
  - `GITHUB_ACTIONS_WORKFLOW_REF`
- `GITHUB_ACTIONS_WORKFLOW_REF` should be `v3/database-only` unless intentionally changed.

## Before debugging a future failure

Verify these first:

1. Current local branch.
2. GitHub Actions checked-out branch and commit.
3. Vercel deployed branch and commit.
4. Whether the fix already exists on `v3/database-only`.

## Why this matters

- A fix on another local branch will not repair scheduled workflows.
- A fix on GitHub will not repair the deployed UI if Vercel is serving a different branch or older commit.
- Manual Pipeline Status buttons can look broken when the deployed branch, workflow ref, and GitHub Actions branch do not match.
