Task ID

V2-16

Title

Add one explicit warehouse adapter invocation boundary only

Objective

Extend the existing local warehouse no-op adapter boundary so the system can execute exactly one bounded adapter-invocation step in `src/warehouse/**` that reads one local warehouse no-op artifact and produces one deterministic local warehouse invocation artifact proving the invocation boundary shape, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

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
V2-15 proved one bounded warehouse adapter no-op implementation path in `src/warehouse/**`.
The next bounded step is to define one explicit warehouse adapter invocation boundary in `src/warehouse/**` while still keeping all outputs local and avoiding any actual database or warehouse writes.

In-scope files
- `src/warehouse/**`
- `src/ingestion/**` only where needed to wire the bounded entrypoint to the new invocation boundary
- `src/testing/fixtures/**` only if needed for invocation-boundary tests
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/V2-16-warehouse-adapter-invocation-boundary-only.md`
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
- Keep the scope on one warehouse adapter invocation boundary path only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real invocation artifacts containing account-sensitive data.
- Reuse the existing warehouse no-op boundary style instead of scattering logic.
- Keep this task bounded to the same `GET_SALES_AND_TRAFFIC_REPORT` family already proven in `V2-04` through `V2-15`.
- The warehouse invocation artifact target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce DB clients, Supabase clients, or actual write execution in this task.
- Do not implement adapter invocation for multiple report families.

Required implementation

1. Add one bounded warehouse adapter invocation path only

Add one bounded path that:
- reads the V2-15 warehouse no-op artifact
- validates the no-op artifact against the expected V2-15 contract
- builds one deterministic local warehouse invocation artifact
- writes one deterministic local warehouse invocation artifact
- prints one safe invocation summary

Support exactly one bounded path for the same Sales and Traffic report family already proven in earlier tasks.

2. Put the core logic under `src/warehouse/**`

The primary implementation must live under `src/warehouse/**`.

Required file additions or updates:
- add one core module under `src/warehouse/**` for:
  - no-op artifact loading
  - invocation artifact shaping
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
- explicit no-op artifact path

For `--report-id`, resolve:
- `out/sp-api-warehouse-noop/report-<reportId>.warehouse-noop.json`

If an explicit path is supplied:
- validate file existence
- derive `reportId` from deterministic filename when possible
- if both explicit `reportId` and derived `reportId` exist, require exact equality
- fail with typed error on mismatch
- require `--report-id` when the path does not match deterministic naming

4. No-op validation requirements

Validate that the no-op artifact includes and matches:
- `warehouseAdapterNoopVersion`
- `reportId`
- `reportFamily`
- `reportType`
- section names
- row counts
- target table names
- `noopPayload.targetHandlers[]`

Also validate:
- no-op version is the expected V2-15 version
- section summary count matches target handler count
- total row count equals the sum of section row counts
- each target handler corresponds to exactly one section summary by section name and target table name
- each target handler includes `operationName`, `keyColumns`, `mappedColumnCount`, `requestStub`, `responseStub`, and `executionState`
- no-op artifact explicitly indicates `mode = noop`, `writesAttempted = false`, `implementationPresent = true`, `executionAllowed = false`, `executionResult = skipped_noop`, and `skipReason = no_real_write_allowed`

5. Define the invocation artifact contract

The invocation artifact must include these top-level fields exactly:
- `warehouseAdapterInvocationVersion`
- `reportId`
- `reportFamily`
- `reportType`
- `lineage`
- `sections`
- `totalRowCount`
- `invocationPayload`

Add one explicit version string in code:
- `warehouseAdapterInvocationVersion`

Validate required top-level fields before writing the artifact.

6. Define the invocation payload shape

The invocation payload must be:
- invocation-oriented
- deterministic
- local-only
- explicit that it is invocation-boundary only
- explicit that no writes were attempted
- explicit that no real adapter transport or warehouse client was called

The payload must include enough metadata to prove what a future adapter invocation boundary would receive and return, but must not include:
- actual execution side effects
- SQL statements
- DB client calls
- warehouse adapter network calls
- real warehouse client implementation

Use a structure such as `invocationPayload.targetInvocations[]` including:
- `sectionName`
- `targetTableName`
- `operationName`
- `keyColumns`
- `mappedColumnCount`
- `requestEnvelope`
- `responseEnvelope`
- `invocationState`

Required invocation-state fields include:
- `mode = invocation_boundary_only`
- `writesAttempted = false`
- `transportCalled = false`
- `executionAllowed = false`
- `invocationResult = blocked_no_write`
- `blockReason = no_real_write_allowed`

7. Preserve lineage metadata

The invocation artifact must retain lineage back to:
- warehouse no-op artifact path
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
- warehouse adapter no-op version used
- warehouse adapter interface version used
- warehouse adapter dry-run version used
- warehouse adapter mapping version used
- warehouse-ready contract version used

8. Define deterministic output path

Write the invocation artifact only to a bounded local output path.

Required deterministic output path:
- `out/sp-api-warehouse-invocation/report-<reportId>.warehouse-invocation.json`

9. Safe summary requirements

Safe summary may include:
- report id used
- no-op artifact input path
- invocation artifact output path
- `warehouseAdapterInvocationVersion`
- section names
- row counts
- total row count
- target table names
- operation names
- invocation-state flags

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full no-op payload
- full invocation payload

10. Add targeted unit tests

Add tests that verify:
- path resolution
- no-op artifact validation
- invocation transformation
- lineage metadata validation
- required-field validation
- safe-summary behavior
- output-path write
- malformed or mismatched input typed errors
- invocation payload explicitly states no writes attempted, no transport call, execution not allowed, and blocked invocation result

11. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:invoke-first-report-warehouse-adapter`

Required tests
- `npm test`
- `npm run spapi:invoke-first-report-warehouse-adapter -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded warehouse adapter invocation boundary exists under `src/warehouse/**`
- `package.json` contains `spapi:invoke-first-report-warehouse-adapter`
- The command can read one existing local warehouse no-op artifact and write one bounded local invocation artifact
- Success output includes a safe invocation summary only
- The invocation artifact is stored at a deterministic local output path
- No Supabase, database, warehouse execution, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, local staging, canonical ingest, warehouse-ready contract, warehouse mapping, warehouse dry-run, warehouse interface, and warehouse no-op paths remain intact
- `npm run verify:wsl` passes

Required status update

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-16`
- keep the current stage history intact
- append one task-log row for `V2-16`
- record that `V2-16` is invocation-boundary only and still performs no real writes
- set the next follow-up after `V2-16` as one bounded adapter result contract step or one explicit write-authority gate that still forbids any real warehouse write execution
