# `src/connectors/sp-api`

Stage 2A auth/config skeleton plus one real Sellers API read-call boundary, one bounded first report-request path, one bounded report-status polling path, one bounded report-document retrieval path, and one bounded local report-content parsing path.

Included in this stage:
- typed environment contract loader
- region-to-endpoint resolver
- injected Login with Amazon refresh-token boundary
- minimal LWA-only request builder for one read-only SP-API call
- one first-call entrypoint for Sellers `getMarketplaceParticipations`
- one first-report-request entrypoint for `GET_SALES_AND_TRAFFIC_REPORT`
- one first-report-status entrypoint for Reports `getReport`
- one first-report-document entrypoint for Reports `getReportDocument` plus raw document download
- one first-report parser entrypoint that reads the bounded raw artifact, decompresses it if needed, and tabularizes the observed Sales and Traffic JSON sections into a local parsed artifact
- one first-report handoff entrypoint that reads the bounded parsed artifact and writes a local structured handoff artifact for future ingestion boundary proof
- one first-report local-stage ingestion entrypoint that reads the bounded handoff artifact and writes a deterministic local non-warehouse staging artifact under `out/`
- unit tests that do not require real credentials or network access

Still out of scope here:
- ingestion, warehouse writes, or sync
- UI or admin flows
- Amazon Ads API work

Observed bounded artifact format for this repo's first real Sales and Traffic report:
- V2-06 retrieved a gzip-compressed JSON document, not TSV/CSV
- the V2-07 parser is intentionally limited to that observed raw format for the `GET_SALES_AND_TRAFFIC_REPORT` family proven so far
