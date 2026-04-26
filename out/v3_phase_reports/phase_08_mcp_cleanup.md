# Phase 08 Baseline Report - MCP Views and Cleanup

## Phase objective

Create clean read-only MCP views for analysis agents and evaluate cleanup candidate tables with dependency, count, and backup/export evidence.

## Files changed

- `supabase/migrations/20260426203000_v3_mcp_views.sql`
- `test/v3McpViewsMigration.test.ts`
- `docs/schema_snapshot.md`
- `docs/v3_database_only_build_plan.md`
- `out/v3_build_progress.md`
- `out/v3_cleanup_candidates.md`
- `out/v3_schema_after_phase.sql`
- `out/v3_schema_inventory.md`
- `out/v3_table_counts.md`
- `out/v3_phase_reports/phase_08_mcp_cleanup.md`

## Migrations created or changed

- Created `20260426203000_v3_mcp_views.sql`.
- Applied remote migration `v3_mcp_views` to Supabase project `aghtxbvgcazlowpujtjk` through the Supabase project connector.

## Tables and views created or changed

Created MCP views:

- `v_mcp_sales_traffic_daily`
- `v_mcp_ads_current_settings`
- `v_mcp_ads_performance_daily`
- `v_mcp_ads_performance_hourly`
- `v_mcp_sqp_weekly`
- `v_mcp_sqp_monthly`
- `v_mcp_h10_keyword_rankings`
- `v_mcp_ads_change_logbook`
- `v_mcp_non_ads_change_logbook`
- `v_mcp_data_freshness`

No tables were dropped.

## API/manual sources used

- Supabase project connector for DDL apply and SQL validation.
- Existing V3 database tables/views only; no Amazon API pulls or manual report imports were performed in Phase 8.

## Backfill date range

Not applicable. Phase 8 created read-only MCP views and cleanup reports only.

## Validation commands and results

- `npm test -- test/v3McpViewsMigration.test.ts`: passed, 3 tests.
- `npm run build`: passed.
- `node -r dotenv/config ./node_modules/.bin/ts-node scripts/schema_snapshot.ts dotenv_config_path=/home/albert/code/amazon-performance-hub/.env.local`: passed.
- `supabase migration list`: passed.
- `supabase db dump --schema public --data-only=false --file out/v3_schema_after_phase.sql`: failed due Supabase CLI temp-role authentication and pooler circuit breaker.

Remote MCP row counts:

| View | Rows |
| --- | ---: |
| `v_mcp_sales_traffic_daily` | 771 |
| `v_mcp_ads_current_settings` | 13437 |
| `v_mcp_ads_performance_daily` | 76167 |
| `v_mcp_ads_performance_hourly` | 92883 |
| `v_mcp_sqp_weekly` | 38154 |
| `v_mcp_sqp_monthly` | 304 |
| `v_mcp_h10_keyword_rankings` | 21140 |
| `v_mcp_ads_change_logbook` | 148 |
| `v_mcp_non_ads_change_logbook` | 3 |
| `v_mcp_data_freshness` | 38 |

Additional validation:

- Secret-column scan returned `0` findings.
- Recursive dependency scan found no `v_mcp_%` dependency on cleanup candidate tables.
- Exact row-count and dependency reports were generated for all `44` cleanup candidates.
- Phase 8 status rows were written to `api_sync_runs`, `report_data_status`, and `data_quality_checks`.

## Errors found and how they were fixed

- `npm run schema:snapshot` initially failed because this worktree does not have its own `.env.local` with `DATABASE_URL`. Reran the snapshot with the parent repo env path.
- First Phase 8 status insert violated `report_data_status_final_consistency_chk` because `is_final=true` was used without finalization fields. Rewrote Phase 8 view status rows as live non-final validation rows.
- Second status insert violated `api_sync_runs_account_id_fkey` because a synthetic account id was used. Rewrote status rows under existing account `sourbear` / marketplace `US`.
- Supabase CLI dump remains blocked by temp-role authentication/circuit breaker. Schema snapshot and connector validation were used as the safe alternative.

## Cleanup decision

No cleanup candidate tables were dropped. Several candidates still have dependent views, non-zero historical data, active UI/optimizer/logbook ownership, or unclear purpose. The safe Phase 8 result is to retain all candidates and provide a future backup/export manifest in `out/v3_cleanup_candidates.md`.

## What the system can now do

MCP clients can query clean analysis-ready read-only views for sales traffic, current ads settings, ads performance, SQP, H10 rankings, ads changes, non-ads changes, and data freshness.

## Next recommended phase

The V3 database-only build plan is complete. Next work should be release/ops review, operator-approved archival cleanup, or UI/API work from a separate approved plan.
