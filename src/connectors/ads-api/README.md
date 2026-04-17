# `src/connectors/ads-api`

Bounded Stage 2B Amazon Ads auth, profile-sync, Sponsored Products campaign daily, Sponsored Products target daily, local persistence, and first campaign-ingest gate surface.

In scope through `S2B-G2`:
- build an operator-facing authorization URL
- exchange an authorization code for token payload data
- refresh an access token from the configured refresh token
- fetch the accessible Ads profiles list
- validate the configured `AMAZON_ADS_PROFILE_ID`
- build one deterministic local profile-sync mapping artifact
- validate the local profile-sync artifact before report scope use
- request one bounded Sponsored Products campaign daily report for an explicit date range
- poll the report to a terminal state and download it
- build one raw and one normalized local campaign-daily artifact
- request one bounded Sponsored Products target daily report for an explicit date range
- poll the target report to a terminal state and download it
- build one raw and one normalized local target-daily artifact
- validate the four existing campaign-daily and target-daily local artifacts
- build one deterministic local landed artifact and one deterministic local persisted normalization artifact
- validate the existing persisted campaign rows and hand them into the repo's current SP campaign ingest sink

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
- `adsapi:pull-sp-campaign-daily` validates `out/ads-api-profile-sync/ads-profiles.sync.json` before sending any report request.
- The campaign-daily path writes:
  - `out/ads-api-sp-campaign-daily/raw/sp-campaign-daily.raw.json`
  - `out/ads-api-sp-campaign-daily/normalized/sp-campaign-daily.normalized.json`
- `adsapi:pull-sp-target-daily` validates the same local profile-sync artifact before sending any report request.
- The target-daily path writes:
  - `out/ads-api-sp-target-daily/raw/sp-target-daily.raw.json`
  - `out/ads-api-sp-target-daily/normalized/sp-target-daily.normalized.json`
- `adsapi:persist-sp-daily` is fully local, does not call Amazon, and reuses the four existing `S2B-04` and `S2B-05` artifacts.
- The local persistence path writes:
  - `out/ads-api-persisted/raw/ads-sp-daily.landed.json`
  - `out/ads-api-persisted/normalized/ads-sp-daily.persisted.json`
- `adsapi:ingest-sp-campaign-daily` reuses the existing SP campaign ingest sink by writing one bounded temporary CSV under:
  - `out/ads-api-ingest-gate/sp-campaign-daily.ingest.csv`
- Search-term, keyword, warehouse, and UI work remain out of scope here.

Bounded CLIs:
- `npm run adsapi:print-auth-url -- --redirect-uri <uri> --scope <scope> [--state <state>]`
- `npm run adsapi:exchange-code -- --code <fresh_code> --redirect-uri <uri> [--scope <scope>]`
- `npm run adsapi:refresh-access-token`
- `npm run adsapi:sync-profiles`
- `npm run adsapi:pull-sp-campaign-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD`
- `npm run adsapi:pull-sp-target-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD`
- `npm run adsapi:persist-sp-daily`
- `npm run adsapi:ingest-sp-campaign-daily`
