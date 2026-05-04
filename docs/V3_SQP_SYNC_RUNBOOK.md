# V3 SQP Sync Runbook

## What It Does

V3 SQP sync pulls Amazon SP-API Search Query Performance reports for ASIN scope.

- Weekly SQP writes `sqp_weekly_raw` and coverage rows with `source_type = 'sp_api_sqp_weekly'`.
- Monthly SQP writes `sqp_monthly_raw` and coverage rows with `source_type = 'sp_api_sqp_monthly'`.
- Weekly windows are Sunday through Saturday.
- Monthly windows are the first through last day of a calendar month.

## Availability Is Sometimes Late

Weekly SQP usually becomes eligible on Monday US time after the week ends. Monthly SQP usually becomes eligible on the first day of the following month US time. Amazon can publish later than those gates.

When Amazon has not published an eligible SQP period yet, the sync records `freshness_status = 'delayed_expected'` in `data_coverage_status` and leaves this note:

```text
Amazon has not published this SQP period yet; the next scheduled run will retry.
```

Scheduled workflows run with `--soft-unavailable-exit`, so expected SQP delay does not fail the workflow.

## Pending Resume

If Amazon accepts a report request but keeps it `IN_QUEUE` or `IN_PROGRESS` beyond the configured polling attempts, the sync saves the `report_id` in `public.sp_api_sqp_report_requests` with `status = 'pending_timeout'`.

The pending resume workflow reruns `npm run v3:resume:sqp` and polls those saved report ids. It does not create duplicate active report requests for the same account, marketplace, ASIN, SQP source, start date, and end date.

## Manual Weekly Run

Use a bounded window and ASIN limit:

```bash
npm run v3:sync:sqp -- \
  --account-id sourbear \
  --marketplace US \
  --source weekly \
  --mode manual \
  --from 2026-04-19 \
  --to 2026-04-25 \
  --resume-pending \
  --soft-unavailable-exit \
  --max-windows-per-run 1 \
  --max-asins-per-run 5
```

If weekly SQP has no existing data, the sync will not start a large historical backfill unless `--from` is supplied.

## Monthly Jan 2024 Backfill

Monthly SQP defaults to `--monthly-backfill-start 2024-01-01` when `sqp_monthly_raw` has no data. Keep limits small and rerun until caught up:

```bash
npm run v3:backfill:sqp -- \
  --account-id sourbear \
  --marketplace US \
  --source monthly \
  --monthly-backfill-start 2024-01-01 \
  --resume-pending \
  --soft-unavailable-exit \
  --max-windows-per-run 2 \
  --max-asins-per-run 5
```

Do not run unlimited monthly backfill in one run.

## Safe Limits

- Scheduled weekly: `--max-windows-per-run 1`
- Scheduled monthly: `--max-windows-per-run 1`
- Manual/backfill: start with `--max-windows-per-run 2`
- Keep `--max-asins-per-run` conservative until report volume and runtime are known.

Use `--dry-run` to inspect selected windows and ASIN count without contacting Amazon.

## Report Artifact

Each run writes:

```text
out/v3_sqp_sync_report.md
```

Read it for account, marketplace, source, mode, selected windows, selected ASIN count, created and resumed report requests, imported windows, unavailable windows, pending windows, failures, and the next action.

## Coverage Verification

```sql
select source_type, table_name, granularity, last_status, freshness_status, latest_period_end, notes
from public.data_coverage_status
where account_id = 'sourbear'
  and marketplace = 'US'
  and source_type in ('sp_api_sqp_weekly', 'sp_api_sqp_monthly')
order by source_type;
```

Expected delayed periods should show `freshness_status = 'delayed_expected'`, not `failed`.
