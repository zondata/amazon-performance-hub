# `src/connectors/sp-api`

Stage 2A auth/config skeleton plus one real Sellers API read-call boundary.

Included in this stage:
- typed environment contract loader
- region-to-endpoint resolver
- injected Login with Amazon refresh-token boundary
- minimal LWA-only request builder for one read-only SP-API call
- one first-call entrypoint for Sellers `getMarketplaceParticipations`
- unit tests that do not require real credentials or network access

Still out of scope here:
- report creation, polling, download, parsing, or sync
- warehouse writes
- UI or admin flows
- Amazon Ads API work
