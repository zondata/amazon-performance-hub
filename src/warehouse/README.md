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
