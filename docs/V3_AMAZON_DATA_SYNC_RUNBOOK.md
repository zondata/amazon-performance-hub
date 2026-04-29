# V3 Amazon Data Sync Runbook

## Purpose

This runbook covers the Phase 9 manual and scheduled Amazon data pull system for V3.

## WSL manual pull

Run from the repo root:

```bash
npm run v3:pull:amazon -- --account-id sourbear --marketplace US --from YYYY-MM-DD --to YYYY-MM-DD --sources ads,sales,sqp --mode manual
```

Shortcut commands:

```bash
npm run v3:pull:today -- --account-id sourbear --marketplace US
npm run v3:pull:recent -- --account-id sourbear --marketplace US
npm run v3:pull:ads -- --account-id sourbear --marketplace US --from YYYY-MM-DD --to YYYY-MM-DD
npm run v3:pull:sales -- --account-id sourbear --marketplace US --from YYYY-MM-DD --to YYYY-MM-DD
npm run v3:pull:sqp -- --account-id sourbear --marketplace US --from YYYY-MM-DD --to YYYY-MM-DD
```

What each command does:

- `v3:pull:amazon`: unified Phase 9 entrypoint.
- `v3:pull:today`: current-day manual refresh preset plus latest complete SQP windows.
- `v3:pull:recent`: latest 30-day ads/sales refresh plus latest 4 SQP weeks and 2 SQP months.
- `v3:pull:ads`: ads-only sync wrapper.
- `v3:pull:sales`: Sales & Traffic-only sync wrapper.
- `v3:pull:sqp`: SQP weekly/monthly-only sync wrapper.

Ads diagnostics:

```bash
npm run v3:pull:amazon -- --account-id sourbear --marketplace US --sources ads --mode manual --from YYYY-MM-DD --to YYYY-MM-DD --diagnose
npm run v3:pull:amazon -- --account-id sourbear --marketplace US --sources ads --mode manual --from YYYY-MM-DD --to YYYY-MM-DD --resume-pending
npm run v3:resume:amazon -- --account-id sourbear --marketplace US --mode scheduled --soft-pending-exit
npm run v3:check:ads-pending-health -- --account-id sourbear --marketplace US
npm run adsapi:pull-sp-campaign-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD --diagnose
npm run adsapi:pull-sp-campaign-daily -- --start-date YYYY-MM-DD --end-date YYYY-MM-DD --resume-pending
```

- `--diagnose` keeps the sync in the normal Phase 9 path, but streams child Ads command stdout/stderr and preserves command tails in the final failure report.
- `--resume-pending` polls the most recent saved pending SP campaign report for the same account, marketplace, profile, and date window instead of creating a duplicate Amazon report request.
- `v3:resume:amazon` scans `public.ads_api_report_requests`, resumes active pending Ads report ids automatically, expires stale pending requests after the max pending age, and can exit successfully on recoverable `pending_timeout` states when `--soft-pending-exit` is enabled.
- `v3:check:ads-pending-health` writes `out/v3_ads_pending_resume_report.md` and fails only for unhealthy pending states such as `failed`, `stale_expired`, or `completed` rows that stay unimported past the grace window.
- SP campaign polling can also be tuned with:
  - `ADS_API_REPORT_MAX_ATTEMPTS`
  - `ADS_API_REPORT_POLL_INTERVAL_MS`
  - `ADS_API_MAX_PENDING_AGE_HOURS`

## GitHub Actions manual run

Workflow path:

- `.github/workflows/v3-amazon-data-sync.yml`
- `.github/workflows/v3_ads_pending_resume.yml`

Manual trigger:

1. Open GitHub Actions.
2. Select `V3 Amazon Data Sync`.
3. Use `Run workflow`.
4. Set `account_id`, `marketplace`, `from_date`, `to_date`, `sources`, `mode`, `recent_days`, and `dry_run` as needed.

## GitHub Actions scheduled run

- The workflow also runs once daily by cron.
- The daily workflow resumes saved pending Ads report ids before creating new requests and then runs the normal lookback sync with `--resume-pending` so active matching requests are reused instead of duplicated.
- `V3 Ads Pending Resume` runs every 30 minutes on a separate schedule, short-polls saved pending report ids, and keeps retrying them automatically until they import, fail, or age out.
- Both workflows use GitHub secrets for credentials and default account/marketplace values.

## Required GitHub secrets

- `DATABASE_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AMAZON_ADS_CLIENT_ID`
- `AMAZON_ADS_CLIENT_SECRET`
- `AMAZON_ADS_REFRESH_TOKEN`
- `AMAZON_ADS_API_BASE_URL`
- `AMAZON_ADS_PROFILE_ID`
- `SP_API_LWA_CLIENT_ID`
- `SP_API_LWA_CLIENT_SECRET`
- `SP_API_REFRESH_TOKEN`
- `SP_API_REGION`
- `SP_API_MARKETPLACE_ID`
- `APP_ACCOUNT_ID`
- `APP_MARKETPLACE`

## How to check data coverage

Read:

- `public.data_coverage_status`
- `public.v_mcp_data_coverage_status`
- `public.v_mcp_data_freshness`

Example:

```sql
select *
from public.v_mcp_data_coverage_status
where account_id = 'sourbear'
  and marketplace = 'US'
order by source_type, table_name, granularity;
```

## Freshness and status meanings

- `fresh`: data coverage is within the expected delay window.
- `delayed_expected`: data is late but still inside the allowed lag buffer.
- `stale`: latest available period is older than the allowed lag buffer.
- `blocked`: automation could not run, or Amazon kept the Ads report pending long enough that the source was left in a blocked state.
- `pending_timeout`: Amazon still has the saved Ads report id in progress; the retry workflow will keep polling it automatically while coverage stays blocked.
- `no_data`: no rows exist for that source/table scope yet.

## Troubleshooting missing env vars

- Local WSL runs: check `.env.local`.
- GitHub Actions runs: check repository secrets by name.
- Missing secret failures should show the missing secret name only, never its value.
- Ads failures: rerun with `--diagnose` to stream the underlying `adsapi:*` command output and capture stdout/stderr tails in the final error summary.
- Ads report timeout: check `out/ads-api-sp-campaign-daily/diagnostics/sp-campaign-daily.polling-diagnostic.json` in the workflow artifact or local `out/` folder for report id, last statuses, retry-after, and the redacted last response body tail.
- Ads report pending for a long time: the retry workflow will continue polling the saved report id automatically. Manual WSL resume is optional now and uses the same saved `public.ads_api_report_requests` row instead of creating a duplicate request.

## Safety

- `.env.local` must never be committed.
- Never print secret values into logs, docs, reports, or source files.
