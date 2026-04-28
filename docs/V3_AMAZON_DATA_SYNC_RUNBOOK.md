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

## GitHub Actions manual run

Workflow path:

- `.github/workflows/v3-amazon-data-sync.yml`

Manual trigger:

1. Open GitHub Actions.
2. Select `V3 Amazon Data Sync`.
3. Use `Run workflow`.
4. Set `account_id`, `marketplace`, `from_date`, `to_date`, `sources`, `mode`, `recent_days`, and `dry_run` as needed.

## GitHub Actions scheduled run

- The workflow also runs once daily by cron.
- Scheduled runs use GitHub secrets for credentials and default account/marketplace values.

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
- `blocked`: automation could not run because code support or required env was missing.
- `no_data`: no rows exist for that source/table scope yet.

## Troubleshooting missing env vars

- Local WSL runs: check `.env.local`.
- GitHub Actions runs: check repository secrets by name.
- Missing secret failures should show the missing secret name only, never its value.

## Safety

- `.env.local` must never be committed.
- Never print secret values into logs, docs, reports, or source files.
