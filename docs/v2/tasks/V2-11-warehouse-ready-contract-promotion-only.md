Task ID

V2-11

Title

Add one warehouse-ready contract promotion only

Objective

Extend the existing local canonical ingest boundary so the system can execute exactly one bounded promotion step that reads one local canonical ingest artifact and writes one local warehouse-ready contract artifact, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

Why this task exists

V2-04 proved report request creation.
V2-05 proved report status polling.
V2-06 proved report document retrieval.
V2-07 proved report content parsing of the real gzip-compressed JSON artifact.
V2-08 proved a stable local structured handoff contract and deterministic handoff artifact.
V2-09 proved one bounded local non-warehouse staging ingestion path and deterministic local staging artifact.
V2-10 proved one explicit ingestion boundary in `src/ingestion/**` and deterministic local canonical ingest artifact.
The next bounded step is to promote the canonical ingest shape into one explicit warehouse-ready contract artifact while still keeping all outputs local and avoiding any actual database or warehouse writes.

In-scope files
- src/ingestion/**
- src/connectors/sp-api/** only where needed to wire the bounded entrypoint to the new promotion step
- src/testing/fixtures/** only if needed for contract-promotion/unit tests
- docs/v2/BUILD_STATUS.md
- docs/v2/tasks/V2-11-warehouse-ready-contract-promotion-only.md
- package.json

Out-of-scope files
- apps/web/**
- src/warehouse/**
- src/marts/**
- src/diagnosis/**
- src/memory/**
- src/changes/**
- supabase/**
- .env* files with real secrets
- any database write
- any warehouse schema migration work
- any UI or admin page
- any Amazon Ads API work
- any generic multi-report orchestration
- any downstream KPI interpretation or analytics layer

Constraints
- Keep the scope on one warehouse-ready contract promotion only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real contract artifacts containing account-sensitive data.
- Reuse the existing canonical ingest boundary style instead of scattering logic.
- Keep this task bounded to the same GET_SALES_AND_TRAFFIC_REPORT family already proven in V2-04 through V2-10.
- The warehouse-ready contract target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce warehouse adapters, DB clients, or Supabase clients in this task.
- Do not implement promotion for multiple report families.

Required implementation

1. Add one bounded warehouse-ready contract promotion path only

Add one bounded path that reads the V2-10 local canonical ingest artifact and writes one local warehouse-ready contract artifact intended to prove the promotion boundary works.

Requirements:
- support exactly one bounded promotion path for the same Sales and Traffic report family already proven in earlier tasks
- accept either a canonical ingest artifact path or a report id that resolves to the deterministic local canonical ingest artifact path created by V2-10
- limit the task to warehouse-ready contract proof only
- avoid generic orchestration for unrelated report types

The outcome of this task is only:
- canonical ingest artifact located successfully
- warehouse-ready contract payload built successfully
- bounded local warehouse-ready contract artifact written successfully
- safe promotion summary printed

2. Put the new logic under src/ingestion/**

The core transformation and output writing for this task must live under `src/ingestion/**`.

Preferred responsibilities:
- `src/connectors/sp-api/**` may keep only thin CLI or handoff wiring if needed
- `src/ingestion/**` must own canonical ingest artifact loading, warehouse-ready contract shaping, output writing, and safe summary generation
- add one CLI entrypoint or wiring path that clearly exercises the promotion boundary

Do not leave the primary implementation entirely inside the connector folder.

3. Keep the promotion boundary narrow

Requirements:
- keep canonical ingest artifact loading isolated
- keep warehouse-ready contract transformation isolated
- keep local output writing isolated
- fail with typed ingestion/promotion errors
- support only the minimum flow needed to prove one bounded promotion boundary
- keep logs safe and human-readable

Do not introduce warehouse writes, Supabase, UI, or analytics helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for the promotion boundary.

Acceptable examples:
- `promoteFirstSalesTrafficCanonicalToWarehouseReadyContract()`
- `runFirstSalesTrafficWarehouseReadyContractPromotion()`

If a CLI/dev script is added, it must:
- call into `src/ingestion/**` as the real execution boundary
- accept a report id or canonical ingest artifact path input
- print a redacted, human-readable promotion summary
- not dump full sensitive payload contents by default
- fail with clear typed errors

5. Build one bounded local warehouse-ready contract target

Implement the smallest promotion flow that proves warehouse-ready contract shaping works.

Requirements:
- read the bounded canonical ingest artifact from V2-10
- build one explicit warehouse-ready contract structure from the canonical payload
- write the result to one controlled local contract target
- clearly document what the warehouse-ready contract is and why it is still not a warehouse write
- keep the structure stable and deterministic for the same input

Acceptable local contract target examples:
- one deterministic JSON file under `out/sp-api-warehouse-ready/`
- one deterministic NDJSON file under `out/sp-api-warehouse-ready/`
- one deterministic JSON-per-entity export under `out/sp-api-warehouse-ready/`

Do not:
- write to Supabase
- write to warehouse tables
- create SQL migrations
- create analytics-facing marts
- add multi-dataset orchestration

6. Define the warehouse-ready contract

Requirements:
- define one explicit `warehouseReadyContractVersion` string in code
- include report id, report family, report type, lineage metadata, section metadata, and warehouse-ready payload
- define the top-level contract fields clearly and deterministically
- validate required top-level fields before writing the contract artifact

7. Preserve lineage metadata

Requirements:
- warehouse-ready contract artifact must retain lineage back to the canonical ingest artifact, staging artifact, handoff artifact, parsed artifact, and raw artifact paths if available
- include the canonical ingest version used
- include source artifact path(s)
- include section names and row counts
- preserve enough metadata to prove the contract artifact came from the bounded canonical ingest path

8. Define one bounded warehouse-ready payload shape

Requirements:
- choose one explicit payload shape that is more warehouse-ready than the canonical ingest artifact
- keep the payload local-only and deterministic
- include stable record identifiers
- include a clear record collection shape suitable for future warehouse loading
- document the shape in code and README text where appropriate

Do not:
- write any SQL
- call any DB client
- claim the shape is final for all future datasets
- widen into generic schema design across multiple report families

9. Parse only the minimal safe promotion summary

Safe summary may include:
- report id used
- canonical ingest artifact input path
- warehouse-ready contract artifact output path
- warehouse-ready contract version
- section names
- section row counts
- total row count

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full warehouse-ready dataset in console output

10. Add targeted unit tests

Add tests that verify:
- canonical ingest artifact path resolution is correct
- warehouse-ready contract transformation is correct for fixture data
- lineage metadata is present and validated
- required top-level contract fields are enforced
- section names and row counts remain consistent with the canonical ingest artifact
- safe summary does not expose sensitive contents
- contract artifact writes to the expected bounded output path
- malformed canonical ingest input raises the correct typed error

Tests must not require real credentials or network access.

11. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:promote-first-report-warehouse-ready`

That script must invoke the new promotion-boundary entrypoint and nothing broader.

Forbidden changes
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not expand into Ads API.
- Do not refactor unrelated connector files outside what is required to call the new promotion boundary.
- Do not modify real `.env*` files.
- Do not mark warehouse execution stages complete in this task.

Required tests
- `npm test`
- `npm run spapi:promote-first-report-warehouse-ready -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded warehouse-ready contract promotion boundary exists under `src/ingestion/**`
- `package.json` contains `spapi:promote-first-report-warehouse-ready`
- The command can read one existing local canonical ingest artifact and write one bounded local warehouse-ready contract artifact
- Success output includes a safe promotion summary only
- If an output artifact is written, it is stored in a bounded local output path with deterministic naming
- No Supabase, database, warehouse, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, local staging, and canonical ingest paths remain intact
- `npm run verify:wsl` passes

Required status update

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-11`
- keep the current stage history intact
- append one task-log row for `V2-11`
- record that `V2-11` is limited to one warehouse-ready contract promotion step only, still without warehouse writes
- set the next follow-up after `V2-11` as one bounded warehouse-adapter preparation step or one explicit mapping definition into `src/warehouse/**`, still without any actual write execution

Validation steps
Run these commands before finishing:
- `npm test`
- `npm run spapi:promote-first-report-warehouse-ready -- --report-id <real-report-id>`
- `npm run verify:wsl`

If the canonical ingest artifact shape is not stable enough for a deterministic warehouse-ready contract write, do not fake success. Tighten the bounded contract around the actual observed canonical ingest artifact and state clearly what was validated.

Completion rules
When finished:
- give a file-by-file change summary
- give exact validation results
- say explicitly whether `npm run verify:wsl` passed
- say explicitly whether `npm run spapi:promote-first-report-warehouse-ready` was actually run or only prepared
- do not claim Supabase, warehouse loading, analytics, or later stages are complete
