# `src/connectors/sp-api`

Stage 2A auth/config skeleton plus one real Sellers API read-call boundary, one bounded first report-request path, one bounded report-status polling path, and one bounded report-document retrieval path.

Included in this stage:
- typed environment contract loader
- region-to-endpoint resolver
- injected Login with Amazon refresh-token boundary
- minimal LWA-only request builder for one read-only SP-API call
- one first-call entrypoint for Sellers `getMarketplaceParticipations`
- one first-report-request entrypoint for `GET_SALES_AND_TRAFFIC_REPORT`
- one first-report-status entrypoint for Reports `getReport`
- one first-report-document entrypoint for Reports `getReportDocument` plus raw document download
- unit tests that do not require real credentials or network access

Still out of scope here:
- report document parsing, normalization, or sync
- warehouse writes
- UI or admin flows
- Amazon Ads API work
