# `src/connectors/sp-api`

Stage 2A auth/config skeleton plus one real Sellers API read-call boundary and one bounded first report-request path.

Included in this stage:
- typed environment contract loader
- region-to-endpoint resolver
- injected Login with Amazon refresh-token boundary
- minimal LWA-only request builder for one read-only SP-API call
- one first-call entrypoint for Sellers `getMarketplaceParticipations`
- one first-report-request entrypoint for `GET_SALES_AND_TRAFFIC_REPORT`
- unit tests that do not require real credentials or network access

Still out of scope here:
- report polling, download, parsing, or sync
- warehouse writes
- UI or admin flows
- Amazon Ads API work
