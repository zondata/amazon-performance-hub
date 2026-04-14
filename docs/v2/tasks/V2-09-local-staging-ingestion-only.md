Task ID

V2-09

Title

Add one local non-warehouse staging write path only

Objective

Extend the existing local structured handoff boundary so the system can execute exactly one bounded ingestion path that reads one local Sales and Traffic handoff artifact and writes it to one local non-warehouse staging target, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

Why this task exists

V2-04 proved report request creation.
V2-05 proved report status polling.
V2-06 proved report document retrieval.
V2-07 proved report content parsing of the real gzip-compressed JSON artifact.
V2-08 proved a stable local structured handoff contract and deterministic handoff artifact.
The next bounded step is to prove one ingestion execution path end-to-end into a local non-warehouse staging target, without widening into database persistence, warehouse modeling, analytics, or UI.

In-scope files
- src/connectors/sp-api/**
- src/testing/fixtures/** only if needed for staging-ingestion/unit tests
- docs/v2/BUILD_STATUS.md
- docs/v2/tasks/V2-09-local-staging-ingestion-only.md
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
- Keep the scope on one local non-warehouse staging write path only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real staging artifacts containing account-sensitive data.
- Reuse the existing SP-API connector boundary style instead of scattering logic.
- Keep this task bounded to the same GET_SALES_AND_TRAFFIC_REPORT family already proven in V2-04 through V2-08.
- The staging target must remain local under out/ or another clearly bounded local generated-output path.
- Do not introduce warehouse abstractions, DB adapters, or Supabase clients in this task.
- Do not implement ingestion for multiple report families.

Required implementation

1. Add one bounded local staging ingestion path only

Add one bounded path that reads the V2-08 handoff artifact and writes one local non-warehouse staging artifact intended to prove ingestion execution works.

Requirements:
- support exactly one bounded ingestion execution path for the same Sales and Traffic report family already proven in earlier tasks
- accept either a handoff artifact path or a report id that resolves to the deterministic local handoff artifact path created by V2-08
- limit the task to staging-ingestion proof only
- avoid generic orchestration for unrelated report types

The outcome of this task is only:
- handoff artifact located successfully
- staging payload built successfully
- bounded local staging artifact written successfully
- safe ingestion summary printed

2. Keep boundaries intact

Extend the existing SP-API connector skeleton without collapsing responsibilities.

Preferred responsibilities:
- existing request/status/document/parser/handoff files remain focused on their current jobs
- add one small staging-ingestion file for handoff reading, local staging transformation, output writing, and safe summary
- add one CLI entrypoint in the same connector boundary

Do not scatter path-resolution or staging-shaping logic across multiple files.

3. Keep the staging-ingestion boundary narrow

Requirements:
- keep handoff artifact loading isolated
- keep staging transformation isolated
- keep local output writing isolated
- fail with typed connector/ingestion errors
- support only the minimum flow needed to prove one ingestion execution path
- keep logs safe and human-readable

Do not introduce warehouse, Supabase, UI, or analytics helpers in this task.

4. Implement one callable entrypoint

Create one explicit entrypoint for local staging ingestion.

Acceptable examples:
- ingestFirstSalesTrafficReportToLocalStage()
- runFirstSpApiLocalStageIngestion()

If a CLI/dev script is added, it must:
- live under the SP-API connector boundary
- accept a report id or handoff artifact path input
- print a redacted, human-readable ingestion summary
- not dump full sensitive payload contents by default
- fail with clear typed errors

5. Build one bounded local staging target

Implement the smallest ingestion flow that proves local staging execution works.

Requirements:
- read the bounded handoff artifact from V2-08
- build one explicit local staging structure from the handoff payload
- write the result to one controlled local staging target
- clearly document what the staging target is and why it is not a warehouse target
- keep the structure stable and deterministic for the same input

Acceptable local staging target examples:
- one deterministic JSON file under out/sp-api-staging/
- one deterministic NDJSON file under out/sp-api-staging/
- one deterministic CSV/JSON-per-section export under out/sp-api-staging/

Do not:
- write to Supabase
- write to warehouse tables
- create SQL migrations
- create analytics-facing marts
- add multi-dataset orchestration

6. Preserve lineage metadata

Requirements:
- staging artifact must retain lineage back to the handoff artifact and report id
- include schemaVersion or stagingVersion in the written artifact
- include source artifact path(s)
- include section names and row counts
- preserve enough metadata to prove the staged artifact came from the bounded handoff path

7. Parse only the minimal safe ingestion summary

Safe summary may include:
- report id used
- handoff artifact input path
- staging artifact output path
- staging schema/version
- section names
- section row counts
- total row count

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full staged dataset in console output

8. Add targeted unit tests

Add connector tests that verify:
- handoff artifact path resolution is correct
- staging transformation is correct for fixture data
- lineage metadata is present and validated
- required top-level staging fields are enforced
- section names and row counts remain consistent with the handoff artifact
- safe summary does not expose sensitive contents
- staging artifact writes to the expected bounded output path
- malformed handoff input raises the correct typed error

Tests must not require real credentials or network access.

9. Add one npm script

Add one explicit script to package.json.

Required script:
- spapi:ingest-first-report-local-stage

That script must invoke the new CLI entrypoint and nothing broader.

Forbidden changes
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not expand into Ads API.
- Do not refactor unrelated connector files.
- Do not modify real .env* files.
- Do not mark warehouse execution stages complete in this task.

Required tests
- npm test
- npm run spapi:ingest-first-report-local-stage -- --report-id <real-report-id>
- npm run verify:wsl

Acceptance checks
- One new bounded local staging-ingestion path exists under src/connectors/sp-api/**
- package.json contains spapi:ingest-first-report-local-stage
- The command can read one existing handoff artifact and write one bounded local non-warehouse staging artifact
- Success output includes a safe ingestion summary only
- If an output artifact is written, it is stored in a bounded local output path with deterministic naming
- No Supabase, database, warehouse, or UI scope is added
- Existing request, status, document-retrieval, parsing, and handoff paths remain intact
- npm run verify:wsl passes

Required status update

Update docs/v2/BUILD_STATUS.md in the same branch:
- set Current task = V2-09
- keep the current stage history intact
- append one task-log row for V2-09
- record that V2-09 is limited to one local non-warehouse staging ingestion path only
- set the next follow-up after V2-09 as either:
  - one explicit ingestion boundary implementation into src/ingestion/** without warehouse writes, or
  - one bounded promotion step from local staging to a defined non-warehouse canonical ingest shape

Additional required cleanup from the previous task

The previous push summary reported that docs/v2/tasks/V2-08-local-structured-handoff-only.md was left untracked and omitted from the commit.
As part of V2-09, add that missing V2-08 task file to the branch so the documented task chain is complete.
Do not rewrite its scope. Just add the missing file in committed form.

Validation steps
Run these commands before finishing:
- npm test
- npm run spapi:ingest-first-report-local-stage -- --report-id <real-report-id>
- npm run verify:wsl

If the handoff artifact shape is not stable enough for a deterministic local staging write, do not fake success. Tighten the bounded staging contract around the actual observed handoff artifact and state clearly what was validated.

Completion rules
When finished:
- give a file-by-file change summary
- give exact validation results
- say explicitly whether npm run verify:wsl passed
- say explicitly whether npm run spapi:ingest-first-report-local-stage was actually run or only prepared
- say explicitly that the missing V2-08 task markdown file was added to the commit or, if not, explain that it still remains missing
- do not claim Supabase, warehouse loading, analytics, or later stages are complete
