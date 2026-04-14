# V2-18 - Post-Stage-2A warehouse boundary buildout — Add one explicit write-authority gate only

## Objective
Extend the existing local warehouse adapter result-contract boundary so the
system can execute exactly one bounded write-authority-gate step in
`src/warehouse/**` that reads one local warehouse result-contract artifact and
produces one deterministic local warehouse write-authority artifact proving the
gate boundary shape, with no Supabase writes, no warehouse writes, no UI, and
no multi-report orchestration.

## Scope
- In scope:
  - `src/warehouse/**`
  - `src/ingestion/**` only where needed to wire the bounded entrypoint to the
    new write-authority-gate boundary
  - `src/testing/fixtures/**` only if needed for write-authority-gate tests
  - `docs/v2/BUILD_STATUS.md`
  - `docs/v2/tasks/V2-18-write-authority-gate-only.md`
  - `package.json`
- Out of scope:
  - `apps/web/**`
  - `src/marts/**`
  - `src/diagnosis/**`
  - `src/memory/**`
  - `src/changes/**`
  - `supabase/**`
  - `.env*` files with real secrets
  - any database write
  - any warehouse execution against a real warehouse
  - any warehouse schema migration work
  - any UI or admin page
  - any Amazon Ads API work
  - any generic multi-report orchestration
  - any downstream KPI interpretation or analytics layer

## Required outcome
- Read the V2-17 warehouse result-contract artifact.
- Validate the result-contract artifact against the expected V2-17 contract.
- Build one deterministic local write-authority artifact.
- Write one deterministic local write-authority artifact.
- Print one safe gate summary.
- Keep the boundary limited to the same Sales and Traffic report family already
  proven in earlier tasks.

## Required validation
- `npm test`
- `npm run spapi:gate-first-report-warehouse-write-authority -- --report-id 485677020556`
- `npm run verify:wsl`

## Artifact contract
Top-level fields:
- `warehouseWriteAuthorityVersion`
- `reportId`
- `reportFamily`
- `reportType`
- `lineage`
- `sections`
- `totalRowCount`
- `writeAuthorityPayload`

Payload expectations:
- local-only
- deterministic
- gate-oriented
- explicit no writes attempted
- explicit no transport call
- explicit denied decision for all targets
