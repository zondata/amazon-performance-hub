Task ID

V2-10

Title

Add one explicit non-warehouse ingestion boundary only

Objective

Extend the existing local non-warehouse staging boundary so the system can execute exactly one explicit ingestion boundary implementation in `src/ingestion/**` that reads one local Sales and Traffic staging artifact and promotes it into one local canonical ingest artifact, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

Why this task exists

V2-04 proved report request creation.
V2-05 proved report status polling.
V2-06 proved report document retrieval.
V2-07 proved report content parsing of the real gzip-compressed JSON artifact.
V2-08 proved a stable local structured handoff contract and deterministic handoff artifact.
V2-09 proved one bounded local non-warehouse staging ingestion path and deterministic local staging artifact.
The next bounded step is to prove one explicit ingestion boundary implementation inside `src/ingestion/**`, while still keeping all outputs local and avoiding warehouse persistence, analytics, or UI.

In-scope files
- src/ingestion/**
- src/connectors/sp-api/** only where needed to wire the bounded entrypoint to the new ingestion boundary
- src/testing/fixtures/** only if needed for ingestion-boundary/unit tests
- docs/v2/BUILD_STATUS.md
- docs/v2/tasks/V2-10-explicit-ingestion-boundary-only.md
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
- any warehouse schema or migration work
- any UI or admin page
- any Amazon Ads API work
- any generic multi-report orchestration
- any downstream KPI interpretation or analytics layer

Constraints
- Keep the scope on one explicit non-warehouse ingestion boundary only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real ingest artifacts containing account-sensitive data.
- Reuse the existing staged artifact and connector boundary style instead of scattering logic.
- Keep this task bounded to the same GET_SALES_AND_TRAFFIC_REPORT family already proven in V2-04 through V2-09.
- The canonical ingest target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce warehouse abstractions, DB adapters, or Supabase clients in this task.
- Do not implement ingestion for multiple report families.

Required implementation

1. Add one bounded explicit ingestion boundary only

Add one bounded ingestion boundary implementation in `src/ingestion/**` that reads the V2-09 local staging artifact and writes one local canonical ingest artifact intended to prove the ingestion boundary works.

Requirements:
- support exactly one bounded ingestion boundary path for the same Sales and Traffic report family already proven in earlier tasks
- accept either a staging artifact path or a report id that resolves to the deterministic local staging artifact path created by V2-09
- limit the task to ingestion-boundary proof only
- avoid generic orchestration for unrelated report types

The outcome of this task is only:
- staging artifact located successfully
- canonical ingest payload built successfully
- bounded local canonical ingest artifact written successfully
- safe ingestion-boundary summary printed

2. Put the new logic under src/ingestion/**

The core transformation and output writing for this task must live under `src/ingestion/**`.

Preferred responsibilities:
- `src/connectors/sp-api/**` may keep only thin CLI or handoff wiring if needed
- `src/ingestion/**` must own staging artifact loading, canonical ingest shaping, output writing, and safe summary generation
- add one CLI entrypoint or wiring path that clearly exercises the ingestion boundary

Do not leave the primary implementation entirely inside the connector folder.

3. Keep the ingestion boundary narrow

Requirements:
- keep staging artifact loading isolated
- keep canonical ingest transformation isolated
- keep local output writing isolated
- fail with typed ingestion errors
- support only the minimum flow needed to prove one explicit ingestion boundary
- keep logs safe and human-readable

Do not introduce warehouse, Supabase, UI, or analytics helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for the ingestion boundary.

Acceptable examples:
- `ingestFirstSalesTrafficLocalStageToCanonical()`
- `runFirstSalesTrafficCanonicalIngestBoundary()`

If a CLI/dev script is added, it must:
- call into `src/ingestion/**` as the real execution boundary
- accept a report id or staging artifact path input
- print a redacted, human-readable ingestion-boundary summary
- not dump full sensitive payload contents by default
- fail with clear typed errors

5. Build one bounded local canonical ingest target

Implement the smallest ingestion flow that proves explicit ingestion-boundary execution works.

Requirements:
- read the bounded staging artifact from V2-09
- build one explicit canonical ingest structure from the staged payload
- write the result to one controlled local canonical ingest target
- clearly document what the canonical ingest target is and why it is still not a warehouse target
- keep the structure stable and deterministic for the same input

Acceptable local canonical ingest target examples:
- one deterministic JSON file under `out/sp-api-canonical-ingest/`
- one deterministic NDJSON file under `out/sp-api-canonical-ingest/`
- one deterministic JSON-per-section export under `out/sp-api-canonical-ingest/`

Do not:
- write to Supabase
- write to warehouse tables
- create SQL migrations
- create analytics-facing marts
- add multi-dataset orchestration

6. Define the canonical ingest contract

Requirements:
- define one explicit `canonicalIngestVersion` string in code
- include report id, report family, report type, lineage metadata, section metadata, and canonical payload
- keep the contract consistent and deterministic
- validate required top-level fields before writing the canonical ingest artifact

7. Preserve lineage metadata

Requirements:
- canonical ingest artifact must retain lineage back to the staging artifact, handoff artifact, parsed artifact, and raw artifact paths if available
- include the staging version used
- include source artifact path(s)
- include section names and row counts
- preserve enough metadata to prove the canonical ingest artifact came from the bounded staging path

8. Parse only the minimal safe ingestion-boundary summary

Safe summary may include:
- report id used
- staging artifact input path
- canonical ingest artifact output path
- canonical ingest version
- section names
- section row counts
- total row count

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full canonical ingest dataset in console output

9. Add targeted unit tests

Add tests that verify:
- staging artifact path resolution is correct
- canonical ingest transformation is correct for fixture data
- lineage metadata is present and validated
- required top-level canonical ingest fields are enforced
- section names and row counts remain consistent with the staging artifact
- safe summary does not expose sensitive contents
- canonical ingest artifact writes to the expected bounded output path
- malformed staging input raises the correct typed error

Tests must not require real credentials or network access.

10. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:ingest-first-report-canonical`

That script must invoke the new ingestion-boundary entrypoint and nothing broader.

Forbidden changes
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not expand into Ads API.
- Do not refactor unrelated connector files outside what is required to call the new ingestion boundary.
- Do not modify real `.env*` files.
- Do not mark warehouse execution stages complete in this task.

Required tests
- `npm test`
- `npm run spapi:ingest-first-report-canonical -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded explicit ingestion boundary exists under `src/ingestion/**`
- `package.json` contains `spapi:ingest-first-report-canonical`
- The command can read one existing local staging artifact and write one bounded local canonical ingest artifact
- Success output includes a safe ingestion-boundary summary only
- If an output artifact is written, it is stored in a bounded local output path with deterministic naming
- No Supabase, database, warehouse, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, and local staging paths remain intact
- `npm run verify:wsl` passes

Required status update

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-10`
- keep the current stage history intact
- append one task-log row for `V2-10`
- record that `V2-10` is limited to one explicit ingestion boundary implementation into `src/ingestion/**` without warehouse writes
- set the next follow-up after `V2-10` as one bounded promotion step from local canonical ingest shape toward a defined warehouse-ready contract, still without actual warehouse writes

Validation steps
Run these commands before finishing:
- `npm test`
- `npm run spapi:ingest-first-report-canonical -- --report-id <real-report-id>`
- `npm run verify:wsl`

If the staging artifact shape is not stable enough for a deterministic canonical ingest write, do not fake success. Tighten the bounded canonical ingest contract around the actual observed staging artifact and state clearly what was validated.

Completion rules
When finished:
- give a file-by-file change summary
- give exact validation results
- say explicitly whether `npm run verify:wsl` passed
- say explicitly whether `npm run spapi:ingest-first-report-canonical` was actually run or only prepared
- do not claim Supabase, warehouse loading, analytics, or later stages are complete
