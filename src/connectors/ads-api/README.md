# `src/connectors/ads-api`

Bounded Stage 2B Amazon Ads auth surface.

In scope for `S2B-02`:
- build an operator-facing authorization URL
- exchange an authorization code for token payload data
- refresh an access token from the configured refresh token

Required environment:
- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_API_BASE_URL`
- `AMAZON_ADS_REFRESH_TOKEN` for refresh flows only

Notes:
- `AMAZON_ADS_API_BASE_URL` stays separate from the LWA token endpoint.
- `AMAZON_ADS_REFRESH_TOKEN` may be wrapped in one matching pair of surrounding quotes in `.env.local`; the loader trims whitespace and removes that outer pair before use.
- `AMAZON_ADS_PROFILE_ID` is allowed in local env but is not required or used by `S2B-02`.
- Region handling, profile sync, and Sponsored Products pulls are out of scope here.

Bounded CLIs:
- `npm run adsapi:print-auth-url -- --redirect-uri <uri> --scope <scope> [--state <state>]`
- `npm run adsapi:exchange-code -- --code <fresh_code> --redirect-uri <uri> [--scope <scope>]`
- `npm run adsapi:refresh-access-token`
