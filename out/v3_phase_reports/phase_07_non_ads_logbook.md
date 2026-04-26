# Phase 7 — Manual Non-Ads Logbook

## Objective

Enable manual non-ads product/listing change logging with entity links and later append-only outcome evaluation.

## Files changed

- `supabase/migrations/20260426190000_v3_non_ads_logbook.sql`
- `src/logbook/types.ts`
- `src/logbook/validate.ts`
- `src/logbook/db.ts`
- `src/logbook/createChangeOutcomeEvaluation.ts`
- `src/cli/logCreateChangeEvaluation.ts`
- `package.json`
- `test/logbookValidation.test.ts`
- `test/v3NonAdsLogbookMigration.test.ts`
- `docs/schema_snapshot.md`
- `docs/v3_database_only_build_plan.md`
- `out/v3_build_progress.md`
- `out/v3_schema_after_phase.sql`
- `out/v3_schema_inventory.md`
- `out/v3_table_counts.md`

## Migrations

- Created and applied `20260426190000_v3_non_ads_logbook.sql`.
- Added `expected_outcome`, `evaluation_window_days`, and `notes` to `log_changes`.
- Added `asin` and `sku` to `log_change_entities`.
- Created `change_outcome_evaluations`.

## Sources used

- Manual CLI/JSON logbook path only.
- No dashboard, external automation, or Helium/Amazon browser automation was added.

## Smoke validation

- Verified the migration on Supabase project `aghtxbvgcazlowpujtjk`.
- Ran a rollback transaction that inserted:
  - one `log_changes` non-ads listing change,
  - one `log_change_entities` row with ASIN `B0FYPRWPN1` and SKU `PHASE7-SMOKE-SKU`,
  - one `change_outcome_evaluations` row.
- The transaction returned `changes_inserted=1`, `linked_entities_inserted=1`, and `evaluations_inserted=1`, then rolled back so no test rows remained.

## Validation results

- `log_changes`: 148 rows.
- `log_change_entities`: 149 rows.
- `change_outcome_evaluations`: 0 rows.
- Phase 7 `data_quality_checks`: 4 passed checks.
- `npm run log:change:create` now accepts non-ads planning fields in JSON.
- New CLI: `npm run log:change:evaluate -- --account-id <id> --marketplace <marketplace> --file <evaluation.json>`.

## Commands run

- `npm test -- test/logbookValidation.test.ts test/v3NonAdsLogbookMigration.test.ts`
- `npm run build`
- `npm run schema:snapshot`
- `supabase migration list`
- `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql`
- `npm test`
- `git diff --check`

## Errors fixed

- Existing manual change validation did not carry expected outcome, evaluation window, notes, ASIN, or SKU into the DB payload. Added those fields.
- Added append-only outcome evaluation support so actual result and learning can be recorded later without editing the original change.

## External blockers

- `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql` failed because the Supabase CLI temporary login role could not authenticate and then hit the pooler circuit breaker.

## System capability after Phase 7

Albert can record manual non-ads changes for listing/product work, link them to product/ASIN/SKU entities, include why/expected outcome/evaluation window/notes, and later append actual result/learning/metrics as a separate evaluation row.

## Next recommended phase

Phase 8 — MCP views and cleanup.
