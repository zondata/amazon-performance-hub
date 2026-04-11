# Task ID
`V2-01`

# Title
Create the V2 repo boundary only

# Objective
Create the folder and route boundaries for V2 without implementing Amazon APIs or product logic yet.

# Why this task exists
V2 must stop landing inside monolithic V1 pages. This task creates the boundary before any connector or UI feature work starts.

# In-scope files
- `apps/web/src/app/v2/**`
- `src/connectors/**`
- `src/ingestion/**`
- `src/warehouse/**`
- `src/marts/**`
- `src/diagnosis/**`
- `src/memory/**`
- `src/changes/**`
- `src/testing/fixtures/**`
- `docs/v2/BUILD_STATUS.md`

# Out-of-scope files
- existing V1 pages except minimal navigation link wiring if explicitly needed
- Amazon auth code
- report ingestion code
- migrations
- marts logic

# Constraints
- Create placeholders only.
- No live data fetching.
- No schema decisions hidden inside stubs.
- No package installation unless absolutely required for empty route compilation.

# Required implementation
1. Create `/v2` app route group with skeleton pages or placeholders for:
   - `/v2/overview/[asin]`
   - `/v2/queries/[asin]`
   - `/v2/admin/connections`
   - `/v2/admin/imports`
   - `/v2/admin/history`
2. Create empty module boundaries with README or placeholder exports for:
   - `src/connectors/sp-api`
   - `src/connectors/ads-api`
   - `src/connectors/helium10`
   - `src/ingestion`
   - `src/warehouse`
   - `src/marts`
   - `src/diagnosis`
   - `src/memory`
   - `src/changes`
   - `src/testing/fixtures`
3. Do not wire real functionality yet.
4. Update `docs/v2/BUILD_STATUS.md`.

# Forbidden changes
- Do not implement auth.
- Do not implement report sync.
- Do not modify monolithic V1 product pages for new features.
- Do not create any Amazon API calls.

# Required tests
- `npm run web:build`
- `npm run web:lint`

# Acceptance checks
- `/v2` routes compile
- V2 directories exist
- no real Amazon logic exists yet
- status file updated

# Required status update
Update `docs/v2/BUILD_STATUS.md`:
- `Current task = V2-01`
- `Current stage = Stage 1`
- mark `Stage 1 — repo boundary for V2` complete only if acceptance checks pass
- append a task-log row
- record tests actually run

# Output format
1. routes created
2. module boundaries created
3. tests run
4. blockers or follow-up
