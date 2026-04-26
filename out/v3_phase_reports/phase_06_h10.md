# Phase 6 — Helium 10 Keyword Ranking

## Objective

Stabilize Helium 10 Keyword Tracker ranking as a manual-upload pipeline and verify rank history is analysis-ready.

## Files changed

- `src/cli/ingestHelium10KeywordTrackerDate.ts`
- `docs/schema_snapshot.md`
- `docs/v3_database_only_build_plan.md`
- `out/v3_build_progress.md`
- `out/v3_table_counts.md`
- `out/v3_schema_after_phase.sql`
- `out/v3_phase_reports/phase_06_h10.md`

## Migrations

- No new migration was required.
- Existing schema already includes `h10_keyword_tracker_raw`, `h10_keyword_tracker_latest`, `h10_keyword_rank_daily_latest`, and `h10_keyword_rank_daily_with_dims`.

## Sources used

- Manual Helium 10 Keyword Tracker CSV files under `/mnt/d/Dropbox/AmazonReports`.
- No Helium 10 automation or external browser automation was added.

## Backfill and sample import

- Ran H10 backfill for `2026-02-11` through `2026-04-23`.
- Most files were already ingested.
- Newly inserted snapshots:
  - `2026-03-16`: `B0B2K57W5R` 918 rows, `B0FYPRWPN1` 6,423 rows.
  - `2026-04-19`: `B0FYPRWPN1` 10,650 rows.
  - `2026-04-21`: `B0FYPRWPN1` 10,842 rows.
  - `2026-04-23`: `B0FYPRWPN1` 11,107 rows.

## Validation results

- `h10_keyword_tracker_raw`: 230,620 total rows.
- `h10_keyword_tracker_raw` for `sourbear`/`US`: 157,451 rows, coverage `2025-08-12` through `2026-04-22`.
- `h10_keyword_rank_daily_latest` for `sourbear`/`US`: 12,528 rows, coverage `2025-08-12` through `2026-04-22`.
- Raw exact duplicate keys: 0.
- Daily latest natural-key duplicates on `account_id + marketplace + asin + keyword_norm + observed_date`: 0.
- Rank kind/value consistency failures: 0.
- Missing required identity/date fields: 0.
- Negative numeric metric rows: 0.
- Raw overlap warning: raw H10 contains 144,923 duplicate daily rows across rolling exports. This is expected source overlap; `h10_keyword_rank_daily_latest` resolves it to one row per analysis key.

## Commands run

- `npm test -- test/parseHelium10KeywordTracker.test.ts src/ingestion/manualHelium10RankImport.test.ts`
- `npm run pipeline:backfill:rank:h10 -- --account-id sourbear --marketplace US --root /mnt/d/Dropbox/AmazonReports --from 2026-02-11 --to 2026-04-23 --continue-on-error`
- `npm run schema:snapshot`
- `supabase migration list`
- `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql`

## Errors fixed

- Fixed `ingestHelium10KeywordTrackerDate.ts` so importing it from the H10 backfill pipeline no longer runs the CLI `main()`.
- Corrected Phase 6 quality metadata writes to use this project’s `severity='warn'` enum value.

## External blockers

- `supabase migration list` failed because the Supabase CLI temporary login role could not authenticate and then hit the pooler circuit breaker.
- `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql` failed because Docker is unavailable in this WSL environment.

## System capability after Phase 6

The database can import Helium 10 Keyword Tracker CSV uploads, parse exact/greater-than/missing organic and sponsored rank values, preserve raw overlapping exports, and expose deduped daily rank history through `h10_keyword_rank_daily_latest`.

## Next recommended phase

Phase 7 — manual non-ads logbook.
