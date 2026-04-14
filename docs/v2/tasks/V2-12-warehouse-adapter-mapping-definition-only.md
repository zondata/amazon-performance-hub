Task ID

V2-12

Title

Add one warehouse adapter mapping definition only

Objective

Extend the existing local warehouse-ready contract boundary so the system can execute exactly one bounded preparation step in `src/warehouse/**` that reads one local warehouse-ready contract artifact and produces one local warehouse adapter mapping definition artifact, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

Why this task exists

V2-04 proved report request creation.
V2-05 proved report status polling.
V2-06 proved report document retrieval.
V2-07 proved report content parsing of the real gzip-compressed JSON artifact.
V2-08 proved a stable local structured handoff contract and deterministic handoff artifact.
V2-09 proved one bounded local non-warehouse staging ingestion path and deterministic local staging artifact.
V2-10 proved one explicit ingestion boundary in `src/ingestion/**` and deterministic local canonical ingest artifact.
V2-11 proved one bounded promotion step from the local canonical ingest shape to a local warehouse-ready contract artifact.
The next bounded step is to define one explicit warehouse adapter mapping in `src/warehouse/**`, while still keeping all outputs local and avoiding any actual database or warehouse writes.

In-scope files
- `src/warehouse/**`
- `src/ingestion/**` only where needed to wire the bounded entrypoint to the new warehouse-preparation boundary
- `src/testing/fixtures/**` only if needed for mapping-definition/unit tests
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/V2-12-warehouse-adapter-mapping-definition-only.md`
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
- any warehouse execution or adapter write call
- any warehouse schema migration work
- any UI or admin page
- any Amazon Ads API work
- any generic multi-report orchestration
- any downstream KPI interpretation or analytics layer

Constraints
- Keep the scope on one warehouse adapter mapping definition only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real mapping artifacts containing account-sensitive data.
- Reuse the existing warehouse-ready contract boundary style instead of scattering logic.
- Keep this task bounded to the same `GET_SALES_AND_TRAFFIC_REPORT` family already proven in V2-04 through V2-11.
- The warehouse adapter mapping target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce DB clients, Supabase clients, or actual write execution in this task.
- Do not implement mapping preparation for multiple report families.

Required implementation

1. Add one bounded warehouse adapter mapping definition path only

Add one bounded path that reads the V2-11 local warehouse-ready contract artifact and writes one local warehouse adapter mapping definition artifact intended to prove the warehouse-preparation boundary works.

Requirements:
- support exactly one bounded mapping-definition path for the same Sales and Traffic report family already proven in earlier tasks
- accept either a warehouse-ready artifact path or a report id that resolves to the deterministic local warehouse-ready artifact path created by V2-11
- limit the task to warehouse-adapter mapping proof only
- avoid generic orchestration for unrelated report types

The outcome of this task is only:
- warehouse-ready contract artifact located successfully
- warehouse adapter mapping definition built successfully
- bounded local mapping-definition artifact written successfully
- safe preparation summary printed

2. Put the new logic under `src/warehouse/**`

The core transformation and output writing for this task must live under `src/warehouse/**`.

Preferred responsibilities:
- `src/ingestion/**` may keep only thin CLI or wiring if needed
- `src/warehouse/**` must own warehouse-ready artifact loading, mapping-definition shaping, output writing, and safe summary generation
- add one CLI entrypoint or wiring path that clearly exercises the warehouse-preparation boundary

Do not leave the primary implementation entirely inside the ingestion folder.

3. Keep the warehouse-preparation boundary narrow

Requirements:
- keep warehouse-ready artifact loading isolated
- keep mapping-definition transformation isolated
- keep local output writing isolated
- fail with typed warehouse-preparation errors
- support only the minimum flow needed to prove one bounded warehouse-preparation boundary
- keep logs safe and human-readable

Do not introduce warehouse writes, Supabase, UI, or analytics helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for the warehouse-preparation boundary.

Acceptable examples:
- `prepareFirstSalesTrafficWarehouseAdapterMapping()`
- `runFirstSalesTrafficWarehouseAdapterPreparation()`

If a CLI/dev script is added, it must:
- call into `src/warehouse/**` as the real execution boundary
- accept a report id or warehouse-ready artifact path input
- print a redacted, human-readable preparation summary
- not dump full sensitive payload contents by default
- fail with clear typed errors

5. Build one bounded local warehouse adapter mapping target

Implement the smallest preparation flow that proves warehouse adapter mapping definition works.

Requirements:
- read the bounded warehouse-ready contract artifact from V2-11
- build one explicit warehouse adapter mapping definition structure from the warehouse-ready payload
- write the result to one controlled local mapping target
- clearly document what the mapping definition is and why it is still not a warehouse write
- keep the structure stable and deterministic for the same input

Acceptable local mapping target examples:
- one deterministic JSON file under `out/sp-api-warehouse-mapping/`
- one deterministic NDJSON file under `out/sp-api-warehouse-mapping/`
- one deterministic JSON-per-target export under `out/sp-api-warehouse-mapping/`

Do not:
- write to Supabase
- write to warehouse tables
- create SQL migrations
- create analytics-facing marts
- add multi-dataset orchestration

6. Define the warehouse adapter mapping contract

Requirements:
- define one explicit `warehouseAdapterMappingVersion` string in code
- include report id, report family, report type, lineage metadata, section metadata, target table names, key columns, column mappings, and mapping payload
- define the top-level contract fields clearly and deterministically
- validate required top-level fields before writing the mapping artifact

7. Preserve lineage metadata

Requirements:
- warehouse adapter mapping artifact must retain lineage back to the warehouse-ready artifact, canonical ingest artifact, staging artifact, handoff artifact, parsed artifact, and raw artifact paths if available
- include the warehouse-ready contract version used
- include source artifact path(s)
- include section names and row counts
- preserve enough metadata to prove the mapping artifact came from the bounded warehouse-ready contract path

8. Define one bounded warehouse mapping payload shape

Requirements:
- choose one explicit payload shape that is more warehouse-adapter-ready than the warehouse-ready contract artifact
- keep the payload local-only and deterministic
- include stable target names
- include explicit source-field to target-column mapping definitions
- include clear key-column definitions suitable for future write adapters
- document the shape in code and README text where appropriate

Do not:
- write any SQL
- call any DB client
- claim the shape is final for all future datasets
- widen into generic schema design across multiple report families

9. Parse only the minimal safe preparation summary

Safe summary may include:
- report id used
- warehouse-ready artifact input path
- warehouse mapping artifact output path
- warehouse adapter mapping version
- section names
- section row counts
- total row count
- target table names

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full mapping payload in console output

10. Add targeted unit tests

Add tests that verify:
- warehouse-ready artifact path resolution is correct
- warehouse adapter mapping transformation is correct for fixture data
- lineage metadata is present and validated
- required top-level contract fields are enforced
- section names and row counts remain consistent with the warehouse-ready artifact
- target table names, key columns, and column mappings are present and validated
- safe summary does not expose sensitive contents
- mapping artifact writes to the expected bounded output path
- malformed warehouse-ready input raises the correct typed error

Tests must not require real credentials or network access.

11. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:prepare-first-report-warehouse-mapping`

That script must invoke the new warehouse-preparation entrypoint and nothing broader.

Forbidden changes
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not expand into Ads API.
- Do not refactor unrelated connector files outside what is required to call the new warehouse-preparation boundary.
- Do not modify real `.env*` files.
- Do not mark warehouse execution stages complete in this task.

Required tests
- `npm test`
- `npm run spapi:prepare-first-report-warehouse-mapping -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded warehouse adapter mapping preparation boundary exists under `src/warehouse/**`
- `package.json` contains `spapi:prepare-first-report-warehouse-mapping`
- The command can read one existing local warehouse-ready artifact and write one bounded local warehouse adapter mapping definition artifact
- Success output includes a safe preparation summary only
- If an output artifact is written, it is stored in a bounded local output path with deterministic naming
- No Supabase, database, warehouse execution, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, local staging, canonical ingest, and warehouse-ready contract paths remain intact
- `npm run verify:wsl` passes

Required status update

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-12`
- keep the current stage history intact
- append one task-log row for `V2-12`
- record that `V2-12` is limited to one warehouse adapter mapping definition step only, still without warehouse writes
- set the next follow-up after `V2-12` as one bounded dry-run warehouse adapter execution step or one explicit adapter interface for future write execution, still without any actual write execution

Validation steps
Run these commands before finishing:
- `npm test`
- `npm run spapi:prepare-first-report-warehouse-mapping -- --report-id <real-report-id>`
- `npm run verify:wsl`

If the warehouse-ready contract artifact shape is not stable enough for a deterministic warehouse adapter mapping write, do not fake success. Tighten the bounded mapping contract around the actual observed warehouse-ready artifact and state clearly what was validated.

Completion rules
When finished:
- give a file-by-file change summary
- give exact validation results
- say explicitly whether `npm run verify:wsl` passed
- say explicitly whether `npm run spapi:prepare-first-report-warehouse-mapping` was actually run or only prepared
- do not claim Supabase, warehouse loading, analytics, or later stages are complete
