# Task ID
`V2-00`

# Title
Install the V2 control layer without changing product logic

# Objective
Add the V2 instruction, status, workflow, and Codex config files so all future V2 work is controlled by repo files instead of chat memory.

# Why this task exists
This is the required first task before any V2 implementation. It prevents drift and creates the shared memory surface that both Albert and Codex will use.

# In-scope files
- `AGENTS.md`
- `docs/v2/AGENTS.md`
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/CODEX_TASK_TEMPLATE.md`
- `docs/v2/CODEX_WORKFLOW.md`
- `docs/v2/ENV_SETUP.md`
- `.codex/config.toml`
- `.codex/rules/default.rules`

# Out-of-scope files
- all application code
- all migrations
- all connectors
- all tests except if a docs/config check is needed

# Constraints
- No product logic changes.
- No route changes.
- No schema changes.
- No package changes unless strictly required to store the control files.
- Preserve all existing V1 instructions; do not replace them with a V2-only file.

# Required implementation
1. Create `docs/v2/`.
2. Add the V2 control files.
3. Add `.codex/config.toml`.
4. Add `.codex/rules/default.rules`.
5. Update root `AGENTS.md` with a short V2 pointer section, without deleting existing V1 guidance.
6. Update `docs/v2/BUILD_STATUS.md` to reflect this task as complete.

# Forbidden changes
- Do not touch `apps/web/src/app/*` routes.
- Do not touch `src/*` business logic.
- Do not create `/v2` pages yet.
- Do not add Amazon credentials or secrets.

# Required tests
- confirm the new files exist in the repo tree
- if available, run any lightweight repo docs/config validation only

# Acceptance checks
- root `AGENTS.md` points to `docs/v2/AGENTS.md`
- `docs/v2/BUILD_STATUS.md` exists and is updated
- `.codex/config.toml` exists
- `.codex/rules/default.rules` exists
- no product code changed

# Required status update
Update `docs/v2/BUILD_STATUS.md`:
- `Current task = V2-00`
- `Current stage = Stage 0`
- mark `Stage 0 — scope freeze and control files` complete only if all acceptance checks pass
- append a task-log row
- record whether any manual follow-up remains

# Output format
1. files added
2. root AGENTS change summary
3. acceptance checks result
4. manual follow-up if any
