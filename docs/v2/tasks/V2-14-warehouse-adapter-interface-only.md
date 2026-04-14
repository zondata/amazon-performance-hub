Task ID

V2-14

Title

Add one explicit warehouse adapter interface only

Objective

Extend the existing local warehouse dry-run boundary so the system can execute exactly one bounded interface-definition step in `src/warehouse/**` that reads one local warehouse dry-run artifact and produces one deterministic local warehouse adapter interface artifact for future write execution, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

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
V2-13 proved one bounded warehouse adapter dry-run execution path in `src/warehouse/**`.
The next bounded step is to define one explicit warehouse adapter interface boundary in `src/warehouse/**` while still keeping all outputs local and avoiding any actual database or warehouse writes.

In-scope files
- `src/warehouse/**`
- `src/ingestion/**` only where needed to wire the bounded entrypoint to the new interface-definition boundary
- `src/testing/fixtures/**` only if needed for interface-definition tests
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/V2-14-warehouse-adapter-interface-only.md`
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
- Keep the scope on one warehouse adapter interface-definition path only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real interface artifacts containing account-sensitive data.
- Reuse the existing warehouse dry-run boundary style instead of scattering logic.
- Keep this task bounded to the same `GET_SALES_AND_TRAFFIC_REPORT` family already proven in `V2-04` through `V2-13`.
- The warehouse interface artifact target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce DB clients, Supabase clients, or actual write execution in this task.
- Do not implement interface definition for multiple report families.

Required implementation

1. Add one bounded warehouse adapter interface-definition path only

Add one bounded path that:
- reads the V2-13 warehouse dry-run artifact
- validates the dry-run artifact against the expected V2-13 contract
- builds one deterministic local warehouse adapter interface artifact
- writes one deterministic local warehouse adapter interface artifact
- prints one safe interface summary

Support exactly one bounded path for the same Sales and Traffic report family already proven in earlier tasks.

2. Put the core logic under `src/warehouse/**`

The primary implementation must live under `src/warehouse/**`.

Required file additions or updates:
- add one core module under `src/warehouse/**` for:
  - dry-run artifact loading
  - interface artifact shaping
  - output path building
  - output writing
  - safe summary generation
  - typed errors
- add one CLI entrypoint under `src/warehouse/**`
- update `src/warehouse/index.ts` exports
- update `src/warehouse/README.md`

3. Input resolution requirements

Support either:
- `--report-id <value>` that resolves deterministic local input path, or
- explicit dry-run artifact path

For `--report-id`, resolve:
- `out/sp-api-warehouse-dry-run/report-<reportId>.warehouse-dry-run.json`

If an explicit path is supplied:
- validate file existence
- derive `reportId` from deterministic filename when possible
- if both explicit `reportId` and derived `reportId` exist, require exact equality
- fail with typed error on mismatch
- require `--report-id` when the path does not match deterministic naming

4. Dry-run validation requirements

Validate that the dry-run artifact includes and matches:
- `warehouseAdapterDryRunVersion`
- `reportId`
- `reportFamily`
- `reportType`
- section names
- row counts
- target table names
- `dryRunPayload.targetOperations[]`

Also validate:
- dry-run version is the expected V2-13 version
- section summary count matches target operation count
- total row count equals the sum of section row counts
- each target operation corresponds to exactly one section summary by section name and target table name
- each target operation includes key columns and mapped-column count
- dry-run artifact explicitly indicates dry-run mode and no writes attempted

5. Define the interface artifact contract

The interface artifact must include these top-level fields exactly:
- `warehouseAdapterInterfaceVersion`
- `reportId`
- `reportFamily`
- `reportType`
- `lineage`
- `sections`
- `totalRowCount`
- `interfacePayload`

Add one explicit version string in code:
- `warehouseAdapterInterfaceVersion`

Validate required top-level fields before writing the artifact.

6. Define the interface payload shape

The interface payload must be:
- execution-adjacent
- deterministic
- local-only
- explicit that it is interface-definition only
- explicit that no writes were attempted
- explicit that no real adapter implementation is present

The payload must include enough metadata to prove what a future adapter must accept and return, but must not include:
- actual execution side effects
- SQL statements
- DB client calls
- warehouse adapter network calls
- real warehouse client implementation

Use an interface-oriented structure such as `targetInterfaces[]` including:
- `sectionName`
- `targetTableName`
- `operationName`
- `keyColumns`
- `mappedColumnCount`
- `requestContract`
- `responseContract`
- `executionFlags`

Required execution flags include metadata such as:
- `mode = interface_only`
- `writesAttempted = false`
- `implementationPresent = false`
- `executionAllowed = false`

7. Preserve lineage metadata

The interface artifact must retain lineage back to:
- warehouse dry-run artifact path
- warehouse mapping artifact path
- warehouse-ready artifact path
- canonical ingest artifact path
- staging artifact path
- handoff artifact path
- parsed artifact path
- raw artifact path

Also include:
- warehouse adapter dry-run version used
- warehouse adapter mapping version used
- warehouse-ready contract version used

8. Define deterministic output path

Write the interface artifact only to a bounded local output path.

Required deterministic output path:
- `out/sp-api-warehouse-interface/report-<reportId>.warehouse-interface.json`

9. Safe summary requirements

Safe summary may include:
- report id used
- dry-run artifact input path
- interface artifact output path
- `warehouseAdapterInterfaceVersion`
- section names
- row counts
- total row count
- target table names
- interface operation names

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full dry-run payload
- full interface payload

10. Add targeted unit tests

Add tests that verify:
- path resolution
- dry-run artifact validation
- interface transformation
- lineage metadata validation
- required-field validation
- safe-summary behavior
- output-path write
- malformed or mismatched input typed errors
- interface payload explicitly states no writes attempted and no implementation present

11. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:define-first-report-warehouse-interface`

Required tests
- `npm test`
- `npm run spapi:define-first-report-warehouse-interface -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded warehouse adapter interface boundary exists under `src/warehouse/**`
- `package.json` contains `spapi:define-first-report-warehouse-interface`
- The command can read one existing local warehouse dry-run artifact and write one bounded local interface artifact
- Success output includes a safe interface summary only
- The interface artifact is stored at a deterministic local output path
- No Supabase, database, warehouse execution, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, local staging, canonical ingest, warehouse-ready contract, warehouse mapping, and warehouse dry-run paths remain intact
- `npm run verify:wsl` passes

Required status update

Create `docs/v2/tasks/V2-14-warehouse-adapter-interface-only.md`.

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-14`
- keep the current stage history intact
- append one task-log row for `V2-14`
- record that `V2-14` is interface-only and still performs no real writes
- set next follow-up to one bounded no-op adapter implementation or one explicit adapter invocation boundary that still forbids any real warehouse write execution

Validation steps
Run all of these before finishing:
- `npm test`
- `npm run spapi:define-first-report-warehouse-interface -- --report-id 485677020556`
- `npm run verify:wsl`

If the V2-13 dry-run artifact shape is not stable enough for deterministic interface-definition output:
- do not fake success
- tighten the interface contract around the actual observed dry-run artifact
- state exactly what was validated
