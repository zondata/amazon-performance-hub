# Amazon Performance Hub V2 — Control Pack

This pack is for the **start of V2**.

It gives you a small control layer so Codex does not drift:
- one V2 instruction file,
- one build status file that Codex must update,
- one strict task template,
- one environment/setup guide,
- one recommended Codex config,
- one rules file for risky commands.

## Where to place these files

From your repo root:
- paste `ROOT_AGENTS_APPEND.md` content into the existing root `AGENTS.md`
- add `docs/v2/AGENTS.md`
- add `docs/v2/BUILD_STATUS.md`
- add `docs/v2/CODEX_TASK_TEMPLATE.md`
- add `docs/v2/CODEX_WORKFLOW.md`
- add `docs/v2/ENV_SETUP.md`
- add `.codex/config.toml`
- add `.codex/rules/default.rules`

## First usage order

1. Add these files to the repo.
2. Commit them on a new branch.
3. Set up Codex cloud/app/CLI access.
4. Ask for **Stage 0 only** as a strict Codex task.
5. Run that task in Codex.
6. Require the task branch to update `docs/v2/BUILD_STATUS.md`.
7. Review the diff, then move to the next task slice.

Do **not** ask Codex to “build V2”.
