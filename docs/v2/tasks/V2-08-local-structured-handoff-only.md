Task ID

V2-08

Title

Add local structured handoff only

Objective

Extend the existing bounded report-content parsing path so the system can produce one stable local structured handoff artifact and one explicit handoff contract for the first Sales and Traffic report, without any ingestion pipeline execution, without any Supabase or warehouse writes, and without any UI.

Why this task exists

V2-04 proved report request creation.
V2-05 proved report status polling.
V2-06 proved report document retrieval.
V2-07 proved parsing of the real bounded raw artifact into a local structured parsed artifact.
The next bounded step is to define and materialize the handoff boundary between local parsing and future ingestion, without widening into warehouse persistence or analytics behavior.

In-scope files
- src/connectors/sp-api/**
- src/testing/fixtures/** only if needed for handoff/unit tests
- docs/v2/BUILD_STATUS.md
- docs/v2/tasks/V2-08-local-structured-handoff-only.md
- package.json

Out-of-scope files
- apps/web/**
- src/ingestion/**
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
- Keep the scope on local structured handoff only.
- Do not implement ingestion execution.
- Do not implement database writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real handoff artifacts containing account-sensitive data.
- Reuse the existing SP-API connector boundary style instead of scattering logic.
- Keep this task bounded to the same GET_SALES_AND_TRAFFIC_REPORT family already proven in V2-04 through V2-07.
- The output of this task must stay local under out/ and serve only as a future ingestion handoff contract plus bounded artifact.
- Do not introduce warehouse abstractions or DB adapters in this task.

Required implementation

1. Add one bounded local structured handoff path only

Add one bounded path that reads the V2-07 parsed artifact and produces one stable local handoff artifact intended for future ingestion.

Requirements:
- support exactly one bounded handoff path for the same Sales and Traffic report family already proven in earlier tasks
- accept either a parsed artifact path or a report id that resolves to the deterministic local parsed artifact path created by V2-07
- limit the task to handoff proof only
- avoid generic orchestration for unrelated report types

The outcome of this task is only:
- parsed artifact located successfully
- a stable handoff structure built successfully
- a safe handoff summary printed
- a bounded handoff artifact written locally for future ingestion use

2. Keep boundaries intact

Extend the existing SP-API connector skeleton without collapsing responsibilities.

Preferred responsibilities:
- existing request/status/document/parser files remain focused on their current jobs
- add one small handoff file for parsed artifact reading, contract shaping, metadata envelope creation, and safe summary
- add one CLI entrypoint in the same connector boundary

Do not scatter path-resolution or contract-shaping logic across multiple files.

3. Keep the handoff boundary narrow

Requirements:
- keep parsed artifact loading isolated
- keep handoff contract shaping isolated
- keep envelope metadata isolated
- fail with typed connector/handoff errors
- support only the minimum handoff flow needed to prove a future ingestion boundary
- keep logs safe and human-readable

Do not introduce ingestion execution, warehouse, UI, or analytics helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for local structured handoff generation.

Acceptable examples:
- buildFirstSalesTrafficReportHandoff()
- runFirstSpApiReportHandoff()

If a CLI/dev script is added, it must:
- live under the SP-API connector boundary
- accept a report id or parsed artifact path input
- print a redacted, human-readable handoff summary
- not dump full sensitive parsed contents by default
- fail with clear typed errors

5. Build one bounded handoff contract

Implement the smallest handoff flow that proves the future ingestion boundary works.

Requirements:
- read the bounded parsed artifact from V2-07
- build one explicit handoff envelope containing:
  - report metadata
  - source artifact paths
  - report family identifier
  - generation timestamp
  - section summaries
  - a stable payload structure intended for later ingestion
- preserve the parsed business rows only inside the bounded local handoff artifact as needed for future ingestion
- clearly separate envelope metadata from payload data

Do not:
- write to Supabase
- call ingestion modules
- map into warehouse tables
- add metric interpretation logic

6. Persist only a controlled local handoff artifact

If a handoff artifact is written to disk, keep the output bounded and explicit.

Requirements:
- write only to a controlled local output path under the repo boundary or a clearly documented generated-output folder
- use deterministic naming that includes the report id
- avoid overwriting unrelated files
- make the artifact easy for the operator to inspect manually

Acceptable handoff artifact examples:
- JSON with an envelope object plus structured payload sections
- JSON with top-level keys such as schemaVersion, reportType, reportId, sourceArtifacts, sections, payload

Do not:
- create warehouse-ready insert scripts
- create DB seed files
- create UI-facing contracts

7. Define a bounded schema version and validation rule

Requirements:
- define one explicit handoff schemaVersion string in code
- validate required top-level fields before writing the handoff artifact
- validate that the section names and row counts in the handoff remain consistent with the parsed artifact
- keep validation local and lightweight

8. Parse only the minimal safe handoff summary

Safe summary may include:
- report id used
- parsed artifact input path
- handoff artifact output path
- schema version
- section names
- section row counts
- total row count

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full parsed dataset in console output

9. Add targeted unit tests

Add connector tests that verify:
- parsed artifact path resolution is correct
- handoff contract shaping is correct for fixture data
- schemaVersion is present and validated
- required top-level fields are enforced
- section names and row counts remain consistent with the parsed artifact
- safe summary does not expose sensitive contents
- handoff artifact writes to the expected bounded output path
- malformed parsed input raises the correct typed error

Tests must not require real credentials or network access.

10. Add one npm script

Add one explicit script to package.json.

Required script:
- spapi:build-first-report-handoff

That script must invoke the new CLI entrypoint and nothing broader.

Forbidden changes
- Do not implement ingestion execution.
- Do not implement database or Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not expand into Ads API.
- Do not refactor unrelated connector files.
- Do not modify real .env* files.
- Do not mark ingestion or warehouse execution stages complete in this task.

Required tests
- npm test
- npm run spapi:build-first-report-handoff -- --report-id <real-report-id>
- npm run verify:wsl

Acceptance checks
- One new bounded local handoff path exists under src/connectors/sp-api/**
- package.json contains spapi:build-first-report-handoff
- The command can read one existing parsed report artifact and build one bounded local handoff artifact
- Success output includes a safe handoff summary only
- If an output artifact is written, it is stored in a bounded local output path with deterministic naming
- No ingestion, database, warehouse, or UI scope is added
- Existing request, status, document-retrieval, and parsing paths remain intact
- npm run verify:wsl passes

Required status update

Update docs/v2/BUILD_STATUS.md in the same branch:
- set Current task = V2-08
- keep the current stage history intact
- append one task-log row for V2-08
- record that V2-08 is limited to local structured handoff only
- set the next follow-up after V2-08 as one bounded ingestion execution path to a local non-warehouse staging target or explicit ingestion boundary implementation only, still without warehouse writes
