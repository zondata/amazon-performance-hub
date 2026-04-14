# `src/warehouse`

Bounded local-only warehouse-preparation boundaries that convert ingest-produced
artifacts into deterministic adapter metadata under `out/`.

Current V2 scope:
- `firstSalesTrafficWarehouseMapping.ts`
- Reads one V2-11 warehouse-ready contract artifact for the first
  `GET_SALES_AND_TRAFFIC_REPORT`
- Writes one deterministic warehouse adapter mapping artifact to
  `out/sp-api-warehouse-mapping/`
- Uses local-only `mappingPayload.targetMappings[]` with explicit
  `targetTableName`, `keyColumns`, and one-to-one `sourceField ->
  targetColumn` definitions for future write adapters
- Does not write to Supabase or any warehouse target; it only materializes the
  mapping definition locally
- `firstSalesTrafficWarehouseDryRun.ts`
- Reads one V2-11 warehouse-ready contract artifact plus one V2-12 warehouse
  adapter mapping artifact for the first `GET_SALES_AND_TRAFFIC_REPORT`
- Writes one deterministic dry-run execution artifact to
  `out/sp-api-warehouse-dry-run/`
- Uses local-only `dryRunPayload.targetOperations[]` with explicit
  `targetTableName`, `keyColumns`, row counts, and safe preview record ids to
  show what would be prepared for adapter execution
- Explicitly records `mode = dry_run`, `writesAttempted = false`, and
  `writesAttemptedCount = 0`; it does not perform any warehouse write
- `firstSalesTrafficWarehouseInterface.ts`
- Reads one V2-13 warehouse dry-run artifact for the first
  `GET_SALES_AND_TRAFFIC_REPORT`
- Writes one deterministic adapter interface artifact to
  `out/sp-api-warehouse-interface/`
- Uses local-only `interfacePayload.targetInterfaces[]` with explicit
  `operationName`, `keyColumns`, `mappedColumnCount`, `requestContract`,
  `responseContract`, and `executionFlags` so future adapter execution can be
  bounded without providing any actual implementation
- Explicitly records `mode = interface_only`, `writesAttempted = false`,
  `implementationPresent = false`, and `executionAllowed = false`; it does not
  perform any warehouse write or provide a real adapter client
- `firstSalesTrafficWarehouseNoop.ts`
- Reads one V2-14 warehouse interface artifact for the first
  `GET_SALES_AND_TRAFFIC_REPORT`
- Writes one deterministic no-op adapter artifact to
  `out/sp-api-warehouse-noop/`
- Uses local-only `noopPayload.targetHandlers[]` with explicit `operationName`,
  `keyColumns`, `mappedColumnCount`, `requestStub`, `responseStub`, and
  `executionState` to prove the adapter implementation boundary shape without
  introducing any transport or warehouse client
- Explicitly records `mode = noop`, `writesAttempted = false`,
  `implementationPresent = true`, `executionAllowed = false`,
  `executionResult = skipped_noop`, and `skipReason = no_real_write_allowed`;
  it does not perform any warehouse write or real adapter invocation
- `firstSalesTrafficWarehouseInvocation.ts`
- Reads one V2-15 warehouse no-op artifact for the first
  `GET_SALES_AND_TRAFFIC_REPORT`
- Writes one deterministic invocation-boundary artifact to
  `out/sp-api-warehouse-invocation/`
- Uses local-only `invocationPayload.targetInvocations[]` with explicit
  `operationName`, `keyColumns`, `mappedColumnCount`, `requestEnvelope`,
  `responseEnvelope`, and `invocationState` to prove what a future adapter
  invocation boundary would receive and return without introducing any real
  transport or warehouse client call
- Explicitly records `mode = invocation_boundary_only`,
  `writesAttempted = false`, `transportCalled = false`,
  `executionAllowed = false`, `invocationResult = blocked_no_write`, and
  `blockReason = no_real_write_allowed`; it does not perform any warehouse
  write or real adapter transport call
- `firstSalesTrafficWarehouseResultContract.ts`
- Reads one V2-16 warehouse invocation artifact for the first
  `GET_SALES_AND_TRAFFIC_REPORT`
- Writes one deterministic result-contract artifact to
  `out/sp-api-warehouse-result-contract/`
- Uses local-only `resultContractPayload.targetResults[]` with explicit
  `operationName`, `keyColumns`, `mappedColumnCount`, `expectedSuccessResult`,
  `expectedBlockedResult`, and `resultState` to prove what a future adapter
  invocation result must contain without introducing any real transport or
  warehouse client call
- Explicitly records `mode = result_contract_only`,
  `writesAttempted = false`, `transportCalled = false`,
  `executionAllowed = false`, `resultStatus = blocked_no_write`, and
  `statusReason = no_real_write_allowed`; it does not perform any warehouse
  write or real adapter transport call
