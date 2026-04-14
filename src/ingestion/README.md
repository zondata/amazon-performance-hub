# `src/ingestion`

Bounded local-only ingestion boundaries that promote connector-produced artifacts
into deterministic non-warehouse ingest shapes under `out/`.

Current V2 scope:
- `firstSalesTrafficCanonical.ts`
- Reads one V2-09 local staging artifact for the first
  `GET_SALES_AND_TRAFFIC_REPORT`
- Writes one deterministic canonical ingest artifact to
  `out/sp-api-canonical-ingest/`
- Preserves lineage back to staging, handoff, parsed, and raw artifacts
- Does not write to Supabase, a warehouse, or any UI-facing contract
