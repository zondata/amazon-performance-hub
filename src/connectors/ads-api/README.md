# `src/connectors/ads-api`

Bounded Stage 2B Amazon Ads auth and profile-sync surface.

In scope through `S2B-03`:
- build an operator-facing authorization URL
- exchange an authorization code for token payload data
- refresh an access token from the configured refresh token
- fetch the accessible Ads profiles list
- validate the configured `AMAZON_ADS_PROFILE_ID`
- build one deterministic local profile-sync mapping artifact

Required environment:
- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_API_BASE_URL`
- `AMAZON_ADS_REFRESH_TOKEN` for refresh flows only
- `AMAZON_ADS_PROFILE_ID` for profile sync
- `APP_ACCOUNT_ID` for profile sync
- `APP_MARKETPLACE` for profile sync

Notes:
- `AMAZON_ADS_API_BASE_URL` stays separate from the LWA token endpoint.
- `AMAZON_ADS_REFRESH_TOKEN` may be wrapped in one matching pair of surrounding quotes in `.env.local`; the loader trims whitespace and removes that outer pair before use.
- `GET {AMAZON_ADS_API_BASE_URL}/v2/profiles` uses `Authorization` and `Amazon-Advertising-API-ClientId` headers only; it must not send `Amazon-Advertising-API-Scope`.
- `adsapi:sync-profiles` writes a safe local artifact to `out/ads-api-profile-sync/ads-profiles.sync.json`.
- Region handling and Sponsored Products pulls are still out of scope here.

Bounded CLIs:
- `npm run adsapi:print-auth-url -- --redirect-uri <uri> --scope <scope> [--state <state>]`
- `npm run adsapi:exchange-code -- --code <fresh_code> --redirect-uri <uri> [--scope <scope>]`
- `npm run adsapi:refresh-access-token`
- `npm run adsapi:sync-profiles`
