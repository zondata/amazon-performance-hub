# Amazon Performance Hub V2 — Debug Snapshot Handoff

Use this file when a V2 task is broken locally and another ChatGPT web chat needs the exact WSL state.

## Normal path
- If the required WSL verification commands pass, commit and push the task branch normally.
- Treat the pushed GitHub task branch, normally `v2/*`, as the clean source of truth for accepted state.

## Broken local path
- If build, test, lint, or any task-specific WSL verification fails, do not push broken code to the main task branch just for inspection.
- Run `npm run snapshot:debug` from the repo root in WSL.
- Upload the generated zip bundle from `out/debug-snapshots/` to a fresh ChatGPT web chat.
- Tell the new chat: `Use the uploaded debug snapshot bundle as the source of truth for the current broken local state. Do not assume GitHub has the latest local changes.`

## Optional remote backup
- Main task branches should use the `v2/*` naming convention.
- If a broken remote backup is still needed, push it to a clearly named `debug/*` branch instead of the main `v2/*` task branch.
