Task ID

V2-13

Title

Add one dry-run warehouse adapter execution only

Objective

Extend the existing local warehouse adapter mapping boundary so the system can execute exactly one bounded dry-run warehouse adapter execution step in `src/warehouse/**` that reads one local warehouse-ready contract artifact plus one local warehouse adapter mapping definition artifact and produces one deterministic local dry-run execution artifact, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

Why this task exists

V2-04 proved report request creation.
V2-05 proved report status polling.
V2-06 proved report document retrieval.
V2-07 proved report content parsing of the real gzip-compressed JSON artifact.
V2-08 proved a stable local structured handoff contract and deterministic handoff artifact.
V2-09 proved one bounded local non-warehouse staging ingestion path and deterministic local staging artifact.
V2-10 proved one explicit ingestion boundary in `src/ingestion/**` and deterministic local canonical ingest artifact.
V2-11 proved one bounded promotion step from the local canonical ingest shape to a local warehouse-ready contract artifact.
V2-12 proved one bounded warehouse adapter mapping definition path in `src/warehouse/**`.
The next bounded step is to define one explicit dry-run warehouse adapter execution boundary in `src/warehouse/**` while still keeping all outputs local and avoiding any actual database or warehouse writes.

In-scope files
- `src/warehouse/**`
- `src/ingestion/**` only where needed to wire the bounded entrypoint to the new dry-run execution boundary
- `src/testing/fixtures/**` only if needed for dry-run execution tests
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/V2-13-warehouse-adapter-dry-run-execution-only.md`
- `package.json`

Out-of-scope files
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

Constraints
- Keep the scope on one dry-run warehouse adapter execution path only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real dry-run artifacts containing account-sensitive data.
- Reuse the existing warehouse-ready contract and warehouse mapping boundary style instead of scattering logic.
- Keep this task bounded to the same `GET_SALES_AND_TRAFFIC_REPORT` family already proven in `V2-04` through `V2-12`.
- The dry-run artifact target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce DB clients, Supabase clients, or actual write execution in this task.
- Do not implement dry-run execution for multiple report families.

Required implementation

1. Add one bounded dry-run warehouse adapter execution path only

Add one bounded path that:
- reads the V2-11 warehouse-ready artifact
- reads the V2-12 warehouse adapter mapping artifact
- validates the two artifacts against each other
- builds one deterministic local dry-run execution artifact
- writes one deterministic local dry-run execution artifact
- prints one safe dry-run summary

Support exactly one bounded path for the same Sales and Traffic report family already proven in earlier tasks.

2. Put the core logic under `src/warehouse/**`

The primary implementation must live under `src/warehouse/**`.

Required file additions or updates:
- add one core module under `src/warehouse/**` for:
  - warehouse-ready artifact loading
  - warehouse-mapping artifact loading
  - cross-validation
  - dry-run execution shaping
  - output path building
  - output writing
  - safe summary generation
  - typed errors
- add one CLI entrypoint under `src/warehouse/**`
- update `src/warehouse/index.ts` exports
- update `src/warehouse/README.md`

3. Input resolution requirements

Support either:
- `--report-id <value>` that resolves deterministic local input paths, or
- explicit input artifact paths

For `--report-id`, resolve these deterministic local inputs:
- warehouse-ready input: `out/sp-api-warehouse-ready/report-<reportId>.warehouse-ready.json`
- warehouse-mapping input: `out/sp-api-warehouse-mapping/report-<reportId>.warehouse-mapping.json`

If explicit artifact paths are supplied:
- validate file existence
- derive `reportId` from deterministic filename when possible
- if both explicit `reportId` and derived `reportId` exist, require exact equality
- fail with typed error on mismatch
- require `--report-id` when the path does not match deterministic naming

4. Cross-validation requirements

Validate that both input artifacts agree on:
- `reportId`
- `reportFamily`
- `reportType`
- section names
- row counts
- target table names

Also validate:
- warehouse-ready contract version is the expected V2-11 version
- warehouse mapping version is the expected V2-12 version
- the count of section summaries matches the count of dry-run target operations
- the total row count equals the sum of section row counts
- each target mapping corresponds to exactly one warehouse-ready record batch by section name and target table name
- key columns defined in the mapping are present in the warehouse-ready record batch column list
- mapping column definitions refer only to columns present in the warehouse-ready record batch

5. Define the dry-run artifact contract

The dry-run artifact must include these top-level fields exactly:
- `warehouseAdapterDryRunVersion`
- `reportId`
- `reportFamily`
- `reportType`
- `lineage`
- `sections`
- `totalRowCount`
- `dryRunPayload`

Add one explicit version string in code:
- `warehouseAdapterDryRunVersion`

Validate required top-level fields before writing the artifact.

6. Define the dry-run payload shape

The dry-run payload must be:
- execution-oriented
- deterministic
- local-only
- explicit that it is dry-run mode
- explicit that no writes were attempted

Required dry-run payload behavior:
- derive one execution-oriented structure from warehouse-ready batches plus warehouse mapping definitions
- include target table names
- include key columns
- include deterministic target-level execution entries
- include stable row or batch identifiers derived from existing stable identifiers
- include explicit write mode metadata such as:
  - dry-run mode
  - writes attempted count
  - writes attempted flag
  - writes skipped reason or equivalent local-only execution status

Required dry-run payload content:
- enough metadata to prove what would be executed
- no actual execution side effects
- no SQL statements
- no DB client calls
- no warehouse adapter network calls

7. Preserve lineage metadata

The dry-run artifact must retain lineage back to:
- warehouse-ready artifact path
- warehouse adapter mapping artifact path
- canonical ingest artifact path
- staging artifact path
- handoff artifact path
- parsed artifact path
- raw artifact path

Also include:
- warehouse-ready contract version used
- warehouse adapter mapping version used

8. Define deterministic output path

Write the dry-run artifact only to a bounded local output path.

Required deterministic output path:
- `out/sp-api-warehouse-dry-run/report-<reportId>.warehouse-dry-run.json`

9. Safe summary requirements

Safe summary may include:
- report id used
- warehouse-ready artifact input path
- warehouse-mapping artifact input path
- dry-run artifact output path
- `warehouseAdapterDryRunVersion`
- section names
- section row counts
- total row count
- target table names

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full warehouse-ready payload
- full warehouse mapping payload
- full dry-run payload

10. Add targeted unit tests

Add tests that verify:
- path resolution is correct
- cross-validation between warehouse-ready and warehouse-mapping artifacts is enforced
- dry-run transformation is correct for fixture data
- lineage metadata is present and validated
- required top-level fields are enforced
- safe summary does not expose sensitive contents
- output path write is correct
- malformed or mismatched input raises the correct typed error

11. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:dry-run-first-report-warehouse-adapter`

Required tests
- `npm test`
- `npm run spapi:dry-run-first-report-warehouse-adapter -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded warehouse adapter dry-run execution boundary exists under `src/warehouse/**`
- `package.json` contains `spapi:dry-run-first-report-warehouse-adapter`
- The command can read one existing local warehouse-ready artifact and one existing local warehouse-mapping artifact
- The command writes one bounded local dry-run execution artifact
- Success output includes a safe preparation summary only
- The dry-run artifact is stored at a deterministic local output path
- Cross-validation between warehouse-ready and warehouse-mapping artifacts is enforced
- No Supabase, database, warehouse execution, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, local staging, canonical ingest, warehouse-ready contract, and warehouse mapping paths remain intact
- `npm run verify:wsl` passes

Required status update

Create `docs/v2/tasks/V2-13-warehouse-adapter-dry-run-execution-only.md`.

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-13`
- keep the current stage history intact
- append one task-log row for `V2-13`
- record that `V2-13` is limited to one dry-run warehouse adapter execution step only and still performs no real writes
- set next follow-up to one explicit adapter interface for future write execution, still without any actual write execution

Validation steps
Run all of these before finishing:
- `npm test`
- `npm run spapi:dry-run-first-report-warehouse-adapter -- --report-id 485677020556`
- `npm run verify:wsl`

If the warehouse-ready artifact shape and warehouse-mapping artifact shape are not stable enough for deterministic dry-run execution:
- do not fake success
- tighten the bounded dry-run contract around the actual observed artifacts
- state exactly what was validated
