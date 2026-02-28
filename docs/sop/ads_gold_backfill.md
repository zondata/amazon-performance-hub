# Ads Campaign Gold Backfill SOP

## Purpose
Populate and maintain campaign `*_latest_gold` cache objects used by Product Baseline Data Pack routes.

## 1) Apply migration
Apply `supabase/migrations/20260228150000_ads_campaign_gold.sql` in the target environment.
Then apply `supabase/migrations/20260228160000_ads_campaign_gold_rpc_guard_fix.sql`.

This migration adds:
- gold cache tables:
  - `sp_campaign_hourly_fact_gold`
  - `sb_campaign_daily_fact_gold`
  - `sd_campaign_daily_fact_gold`
- refresh RPCs (single upload):
  - `refresh_sp_campaign_hourly_fact_gold(p_upload_id uuid)`
  - `refresh_sb_campaign_daily_fact_gold(p_upload_id uuid)`
  - `refresh_sd_campaign_daily_fact_gold(p_upload_id uuid)`
- rebuild RPCs (account/date range):
  - `rebuild_sp_campaign_hourly_fact_gold(p_account_id text, p_start_date date, p_end_date date)`
  - `rebuild_sb_campaign_daily_fact_gold(...)`
  - `rebuild_sd_campaign_daily_fact_gold(...)`
- pack-facing views:
  - `sp_campaign_daily_fact_latest_gold`
  - `sb_campaign_daily_fact_latest_gold`
  - `sd_campaign_daily_fact_latest_gold`

Backfill must be triggered via service role (supabaseAdmin / service key RPC). SQL editor cannot call these safely.

## 2) One-time backfill for existing data
Run from repo root:

```bash
npm run pipeline:backfill:ads:gold -- --account <account_id> --start YYYY-MM-DD --end YYYY-MM-DD
```

Notes:
- Default chunk size is 30 days.
- Override chunk size if needed:

```bash
npm run pipeline:backfill:ads:gold -- --account <account_id> --start YYYY-MM-DD --end YYYY-MM-DD --chunk-days 14
```

- Command output includes per-chunk SP/SB/SD rebuild results.

## 3) Ongoing maintenance (automatic)
After this migration, mapping writes refresh gold automatically:
- SP mapping refreshes SP gold after `sp_campaign_hourly_fact` insert.
- SB mapping refreshes SB gold after `sb_campaign_daily_fact` upsert.
- SD mapping refreshes SD gold after `sd_campaign_daily_fact` upsert.

If refresh RPC fails, mapping fails (no silent skip).

## 4) Repair a single upload
Use service-role RPC (supabaseAdmin / service key) to refresh gold for one upload:

```sql
select public.refresh_sp_campaign_hourly_fact_gold('<upload_id>'::uuid);
select public.refresh_sb_campaign_daily_fact_gold('<upload_id>'::uuid);
select public.refresh_sd_campaign_daily_fact_gold('<upload_id>'::uuid);
```

Run only the function(s) matching the upload source type.

## 5) Troubleshooting
If pack routes return `status: "pack_incomplete"` with `code: "GOLD_NOT_BACKFILLED"`:
1. Run the one-time backfill command for the affected account/date range.
2. Re-run the pack request.
3. If still failing, run single-upload refresh for recently ingested uploads.
