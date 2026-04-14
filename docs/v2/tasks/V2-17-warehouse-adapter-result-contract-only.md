Task ID

V2-17

Title

Add one warehouse adapter result contract only

Objective

Extend the existing local warehouse adapter invocation boundary so the system can execute exactly one bounded result-contract step in `src/warehouse/**` that reads one local warehouse invocation artifact and produces one deterministic local warehouse adapter result-contract artifact proving the result boundary shape, with no Supabase writes, no warehouse writes, no UI, and no multi-report orchestration.

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
V2-16 proved one bounded warehouse adapter invocation boundary path in `src/warehouse/**`.
The next bounded step is to define one explicit warehouse adapter result contract boundary in `src/warehouse/**` while still keeping all outputs local and avoiding any actual database or warehouse writes.

In-scope files
- `src/warehouse/**`
- `src/ingestion/**` only where needed to wire the bounded entrypoint to the new result-contract boundary
- `src/testing/fixtures/**` only if needed for result-contract tests
- `docs/v2/BUILD_STATUS.md`
- `docs/v2/tasks/V2-17-warehouse-adapter-result-contract-only.md`
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
- Keep the scope on one warehouse adapter result-contract path only.
- Do not implement Supabase writes.
- Do not implement warehouse writes.
- Do not add UI.
- Do not add Ads API code.
- Do not log secrets, tokens, raw auth headers, refresh tokens, client secrets, pre-signed URLs, or full sensitive report contents.
- Do not commit real response payloads or real result-contract artifacts containing account-sensitive data.
- Reuse the existing warehouse invocation boundary style instead of scattering logic.
- Keep this task bounded to the same `GET_SALES_AND_TRAFFIC_REPORT` family already proven in `V2-04` through `V2-16`.
- The warehouse result-contract artifact target must remain local under `out/` or another clearly bounded local generated-output path.
- Do not introduce DB clients, Supabase clients, or actual write execution in this task.
- Do not implement result-contract preparation for multiple report families.

Required implementation

1. Add one bounded warehouse adapter result-contract path only

Add one bounded path that:
- reads the V2-16 warehouse invocation artifact
- validates the invocation artifact against the expected V2-16 contract
- builds one deterministic local warehouse adapter result-contract artifact
- writes one deterministic local warehouse adapter result-contract artifact
- prints one safe result summary

Support exactly one bounded path for the same Sales and Traffic report family already proven in earlier tasks.

2. Put the core logic under `src/warehouse/**`

The primary implementation must live under `src/warehouse/**`.

Required file additions or updates:
- add one core module under `src/warehouse/**` for:
  - invocation artifact loading
  - result-contract artifact shaping
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
- explicit invocation artifact path

For `--report-id`, resolve:
- `out/sp-api-warehouse-invocation/report-<reportId>.warehouse-invocation.json`

If an explicit path is supplied:
- validate file existence
- derive `reportId` from deterministic filename when possible
- if both explicit `reportId` and derived `reportId` exist, require exact equality
- fail with typed error on mismatch
- require `--report-id` when the path does not match deterministic naming

4. Invocation validation requirements

Validate that the invocation artifact includes and matches:
- `warehouseAdapterInvocationVersion`
- `reportId`
- `reportFamily`
- `reportType`
- section names
- row counts
- target table names
- `invocationPayload.targetInvocations[]`

Also validate:
- invocation version is the expected V2-16 version
- section summary count matches target invocation count
- total row count equals the sum of section row counts
- each target invocation corresponds to exactly one section summary by section name and target table name
- each target invocation includes `operationName`, `keyColumns`, `mappedColumnCount`, `requestEnvelope`, `responseEnvelope`, and `invocationState`
- invocation artifact explicitly indicates `mode = invocation_boundary_only`, `writesAttempted = false`, `transportCalled = false`, `executionAllowed = false`, `invocationResult = blocked_no_write`, and `blockReason = no_real_write_allowed`

5. Define the result-contract artifact contract

The result-contract artifact must include these top-level fields exactly:
- `warehouseAdapterResultContractVersion`
- `reportId`
- `reportFamily`
- `reportType`
- `lineage`
- `sections`
- `totalRowCount`
- `resultContractPayload`

Add one explicit version string in code:
- `warehouseAdapterResultContractVersion`

Validate required top-level fields before writing the artifact.

6. Define the result-contract payload shape

The result-contract payload must be:
- result-oriented
- deterministic
- local-only
- explicit that it is result-contract only
- explicit that no writes were attempted
- explicit that no real adapter transport or warehouse client was called

The payload must include enough metadata to prove what a future adapter invocation result must contain, but must not include:
- actual execution side effects
- SQL statements
- DB client calls
- warehouse adapter network calls
- real warehouse client implementation

Use a structure such as `resultContractPayload.targetResults[]` including:
- `sectionName`
- `targetTableName`
- `operationName`
- `keyColumns`
- `mappedColumnCount`
- `expectedSuccessResult`
- `expectedBlockedResult`
- `resultState`

Required result-state fields include:
- `mode = result_contract_only`
- `writesAttempted = false`
- `transportCalled = false`
- `executionAllowed = false`
- `resultStatus = blocked_no_write`
- `statusReason = no_real_write_allowed`

7. Preserve lineage metadata

The result-contract artifact must retain lineage back to:
- warehouse invocation artifact path
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
- warehouse adapter invocation version used
- warehouse adapter no-op version used
- warehouse adapter interface version used
- warehouse adapter dry-run version used
- warehouse adapter mapping version used
- warehouse-ready contract version used

8. Define deterministic output path

Write the result-contract artifact only to a bounded local output path.

Required deterministic output path:
- `out/sp-api-warehouse-result-contract/report-<reportId>.warehouse-result-contract.json`

9. Safe summary requirements

Safe summary may include:
- report id used
- invocation artifact input path
- result-contract artifact output path
- `warehouseAdapterResultContractVersion`
- section names
- row counts
- total row count
- target table names
- operation names
- result-state flags

Do not print:
- secrets
- tokens
- pre-signed URLs
- full raw file contents
- full invocation payload
- full result-contract payload

10. Add targeted unit tests

Add tests that verify:
- path resolution
- invocation artifact validation
- result-contract transformation
- lineage metadata validation
- required-field validation
- safe-summary behavior
- output-path write
- malformed or mismatched input typed errors
- result-contract payload explicitly states no writes attempted, no transport call, execution not allowed, and blocked result status

11. Add one npm script

Add one explicit script to `package.json`.

Required script:
- `spapi:build-first-report-warehouse-result-contract`

Required tests
- `npm test`
- `npm run spapi:build-first-report-warehouse-result-contract -- --report-id <real-report-id>`
- `npm run verify:wsl`

Acceptance checks
- One new bounded warehouse adapter result-contract boundary exists under `src/warehouse/**`
- `package.json` contains `spapi:build-first-report-warehouse-result-contract`
- The command can read one existing local warehouse invocation artifact and write one bounded local result-contract artifact
- Success output includes a safe result summary only
- The result-contract artifact is stored at a deterministic local output path
- No Supabase, database, warehouse execution, or UI scope is added
- Existing request, status, document-retrieval, parsing, handoff, local staging, canonical ingest, warehouse-ready contract, warehouse mapping, warehouse dry-run, warehouse interface, warehouse no-op, and warehouse invocation paths remain intact
- `npm run verify:wsl` passes

Required status update

Update `docs/v2/BUILD_STATUS.md` in the same branch:
- set `Current task = V2-17`
- keep the current stage history intact
- append one task-log row for `V2-17`
- record that `V2-17` is result-contract only and still performs no real writes
- set the next follow-up after `V2-17` as one bounded write-authority gate that still forbids any real warehouse write execution
