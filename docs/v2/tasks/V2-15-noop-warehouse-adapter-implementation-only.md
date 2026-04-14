Task ID

V2-15

Title

Add one no-op warehouse adapter implementation only

Objective

Extend the existing local warehouse adapter interface boundary so the system can execute exactly one bounded no-op adapter implementation step in `src/warehouse/**` that reads one local warehouse adapter interface artifact and produces one deterministic local no-op adapter artifact proving the adapter implementation boundary shape, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

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
V2-14 proved one bounded warehouse adapter interface-definition path in `src/warehouse/**`.
The next bounded step is to define one explicit no-op warehouse adapter implementation boundary in `src/warehouse/**` while still keeping all outputs local and avoiding any actual database or warehouse writes.

In-scope files
- `src/warehouse/**`
- `src/ingestion/**` only where needed to wire the bounded entrypoint to the new no-op adapter boundary
- `src/testing/fixtures/**` only if needed for no-op adapter tests
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/V2-15-noop-warehouse-adapter-implementation-only.md`
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
- Keep the scope on one no-op warehouse adapter implementation path only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real no-op artifacts containing account-sensitive data.
- Reuse the existing warehouse adapter interface boundary style instead of scattering logic.
- Keep this task bounded to the same `GET_SALES_AND_TRAFFIC_REPORT` family already proven in `V2-04` through `V2-14`.
- The warehouse no-op artifact target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce DB clients, Supabase clients, or actual write execution in this task.
- Do not implement no-op adapter preparation for multiple report families.

Required implementation

1. Add one bounded no-op warehouse adapter implementation path only

Add one bounded path that:
- reads the V2-14 warehouse interface artifact
- validates the interface artifact against the expected V2-14 contract
- builds one deterministic local no-op adapter artifact
- writes one deterministic local no-op adapter artifact
- prints one safe no-op summary

Support exactly one bounded path for the same Sales and Traffic report family already proven in earlier tasks.

2. Put the core logic under `src/warehouse/**`

The primary implementation must live under `src/warehouse/**`.

Required file additions or updates:
- add one core module under `src/warehouse/**` for:
  - interface artifact loading
  - no-op adapter artifact shaping
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
- explicit interface artifact path

For `--report-id`, resolve:
- `out/sp-api-warehouse-interface/report-<reportId>.warehouse-interface.json`

If an explicit path is supplied:
- validate file existence
- derive `reportId` from deterministic filename when possible
- if both explicit `reportId` and derived `reportId` exist, require exact equality
- fail with typed error on mismatch
- require `--report-id` when the path does not match deterministic naming

4. Interface validation requirements

Validate that the interface artifact includes and matches:
- `warehouseAdapterInterfaceVersion`
- `reportId`
- `reportFamily`
- `reportType`
- section names
- row counts
- target table names
- `interfacePayload.targetInterfaces[]`

Also validate:
- interface version is the expected V2-14 version
- section summary count matches target interface count
- total row count equals the sum of section row counts
- each target interface corresponds to exactly one section summary by section name and target table name
- each target interface includes `operationName`, `keyColumns`, `mappedColumnCount`, `requestContract`, `responseContract`, and `executionFlags`
- interface artifact explicitly indicates `mode = interface_only`, `writesAttempted = false`, `implementationPresent = false`, and `executionAllowed = false`

5. Define the no-op artifact contract

The no-op artifact must include these top-level fields exactly:
- `warehouseAdapterNoopVersion`
- `reportId`
- `reportFamily`
- `reportType`
- `lineage`
- `sections`
- `totalRowCount`
- `noopPayload`

Add one explicit version string in code:
- `warehouseAdapterNoopVersion`

Validate required top-level fields before writing the artifact.

6. Define the no-op payload shape

The no-op payload must be:
- implementation-oriented
- deterministic
- local-only
- explicit that it is no-op only
- explicit that no writes were attempted
- explicit that no real adapter transport or warehouse client is present

The payload must include enough metadata to prove what a future adapter implementation boundary would expose, but must not include:
- actual execution side effects
- SQL statements
- DB client calls
- warehouse adapter network calls
- real warehouse client implementation

Use a structure such as `noopPayload.targetHandlers[]` including:
- `sectionName`
- `targetTableName`
- `operationName`
- `keyColumns`
- `mappedColumnCount`
- `requestStub`
- `responseStub`
- `executionState`

Required execution-state fields include:
- `mode = noop`
- `writesAttempted = false`
- `implementationPresent = true`
- `executionAllowed = false`
- `executionResult = skipped_noop`
- `skipReason = no_real_write_allowed`

7. Preserve lineage metadata

The no-op artifact must retain lineage back to:
- warehouse interface artifact path
- warehouse dry-run artifact path
- warehouse mapping artifact path
- warehouse-ready artifact path
- canonical ingest artifact path
- staging artifact path
- handoff artifact path
- parsed artifact path
- raw artifact path

Also include:
- warehouse adapter interface version used
- warehouse adapter dry-run version used
- warehouse adapter mapping version used
- warehouse-ready contract version used

8. Define deterministic output path

Write the no-op artifact only to a bounded local output path.

Required deterministic output path:
- `out/sp-api-warehouse-noop/report-<reportId>.warehouse-noop.json`

9. Safe summary requirements

Safe summary may include:
- report id used
- interface artifact input path
- no-op artifact output path
- `warehouseAdapterNoopVersion`
- section names
- row counts
- total row count
- target table names
- operation names
- execution-state flags

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full interface payload
- full no-op payload

10. Add targeted unit tests

Add tests that verify:
- path resolution
- interface artifact validation
- no-op transformation
- lineage metadata validation
- required-field validation
- safe-summary behavior
- output-path write
- malformed or mismatched input typed errors
- no-op payload explicitly states no writes attempted, execution not allowed, and skipped no-op result

11. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:build-first-report-warehouse-noop`

Required tests
- `npm test`
- `npm run spapi:build-first-report-warehouse-noop -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded warehouse adapter no-op implementation boundary exists under `src/warehouse/**`
- `package.json` contains `spapi:build-first-report-warehouse-noop`
- The command can read one existing local warehouse interface artifact and write one bounded local no-op artifact
- Success output includes a safe no-op summary only
- The no-op artifact is stored at a deterministic local output path
- No Supabase, database, warehouse execution, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, local staging, canonical ingest, warehouse-ready contract, warehouse mapping, warehouse dry-run, and warehouse interface paths remain intact
- `npm run verify:wsl` passes

Required status update

Create `docs/v2/tasks/V2-15-noop-warehouse-adapter-implementation-only.md`.

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-15`
- keep the current stage history intact
- append one task-log row for `V2-15`
- record that `V2-15` is no-op only and still performs no real writes
- set next follow-up to one explicit adapter invocation boundary that still forbids any real warehouse write execution

Validation steps
Run all of these before finishing:
- `npm test`
- `npm run spapi:build-first-report-warehouse-noop -- --report-id 485677020556`
- `npm run verify:wsl`

If the V2-14 interface artifact shape is not stable enough for deterministic no-op output:
- do not fake success
- tighten the no-op contract around the actual observed interface artifact
- state exactly what was validated
