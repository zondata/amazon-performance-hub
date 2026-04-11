# `src/connectors/sp-api`

Stage 2A auth/config skeleton for future Selling Partner API work.

Included in this task:
- typed environment contract loader
- region-to-endpoint resolver
- injected Login with Amazon refresh-token boundary
- unit tests that do not require real credentials or network access

Still out of scope here:
- live Amazon API calls
- report creation, polling, download, parsing, or sync
- warehouse writes
- UI or admin flows
- Amazon Ads API work
