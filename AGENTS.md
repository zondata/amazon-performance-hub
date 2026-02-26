# Amazon Performance Hub — Project Memory (Facts Layer First)

## Goal
Build a local-first Amazon ads diagnostics app that explains changes like “ad spend rising” by creating a deterministic facts layer from Amazon Bulk Operations (bulksheets), then joining performance reports safely even when names change.
Current approach: local CLI ingestion → Supabase as the source of truth → web UI later (read-only from Supabase).

## Environment / Tooling
- OS: Windows + WSL2 Ubuntu
- Repo: `~/code/amazon-performance-hub`
- Runtime: Node + TypeScript
- CLI execution: `ts-node` (scripts run TS directly)
- Build: `tsc` outputs to `dist/`
- Tests: `vitest` (must remain green)
- Supabase: Postgres schema + ingestion CLIs (service role key in `.env.local`, never committed)

## UI (apps/web)
**Overview**
- Next.js App Router UI scaffold (read-only from Supabase).

### Latest shipped / UI status
- Products Center (`/products`) now shows headline KPIs and product rows from `si_sales_trend_daily_latest`.
- Products Center supports server-side search/sort and safe paging via Supabase `.range()` page iteration (no single-query truncation assumptions).
- Products Center warns when `SALES_HARD_CAP` is reached, so truncation is visible (no silent cut-off).
- Marketplace-aware default ranges now use `getDefaultMarketplaceDateRange(...)` with marketplace day semantics.
- `getDefaultMarketplaceDateRange(...)` derives `marketplaceToday` via `toMarketplaceDate(...)` and performs date-only `YYYY-MM-DD` math (no `toISOString()` defaults).
- Product detail overview (`/products/[asin]`) includes Profile Context, Driver Intents, and KIV backlog panels.
- Related overview components: `ProductProfileSkillsIntentEditor.tsx`, `ProductDriverIntentManager.tsx`, `ProductKivBacklogManager.tsx`.
- `/logbook/experiments` list now uses semantic token theming end-to-end (no slate styling drift) with consistent card/table styling.
- `/logbook/experiments/[id]` now includes a Phases table (run_id, effective_date, uploaded_at, notes).
- `/logbook/experiments/[id]` now includes an Events Timeline with `All events` vs `Interruptions only` filtering; interruption events are visually highlighted.
- New timeline component: `apps/web/src/components/logbook/ExperimentEventsTimeline.tsx`.
- `/logbook/experiments/[id]` now includes Quick Log Event presets (`Guardrail breach`, `Manual intervention`, `Stop-loss`, `Rollback`) with immediate timeline refresh after logging.
- Evaluation output-pack upload now shows an applied-changes summary after import (including KIV update counts and warnings).

**UI Layout System**
### Sidebar (global)
- Sidebar is sticky/locked and scrolls internally if long.
- Collapsible state stored in localStorage: `aph.sidebarCollapsed` ('1' collapsed, '0' expanded).
- `html[data-sidebar]` is set pre-hydration via beforeInteractive script in `apps/web/src/app/layout.tsx`.
- `<html suppressHydrationWarning>` avoids hydration mismatch.
- Toggle component: `apps/web/src/components/SidebarCollapseToggle.tsx`.
- Chevron direction is CSS-driven based on `html[data-sidebar]` (no initial client-side branching).

### Theme system (global palettes)
- Themes are token-based via CSS variables (semantic tokens), not per-component hard-coded colors.
- Theme is selected by `document.documentElement.dataset.theme`.
- Theme persists in localStorage key: `aph.theme` (allowed: `stripe` | `saas-analytics` | `real-time`).
- Theme is applied pre-hydration via `next/script` with `strategy="beforeInteractive"` in `apps/web/src/app/layout.tsx`.
- `<html ... suppressHydrationWarning>` avoids hydration mismatch when data-theme changes pre-hydration.

**Switcher UI**
- Theme switcher is mounted in the global header (top-right), visible on all pages.
- Component: `apps/web/src/components/ThemeSwitcher.tsx`.
- Selecting a theme updates `data-theme`, writes localStorage, and dispatches window event:
  - `aph:theme-change` (detail is the theme string).

**Theme tokens live in**
- `apps/web/src/app/globals.css` defines:
  - base semantic CSS variables
  - per-theme overrides via `html[data-theme="..."]`
  - mapping into Tailwind v4 color tokens (background/surface/border/foreground/muted/primary/etc.)

**How to theme new components (checklist)**
- Prefer semantic classes: `bg-background`, `bg-surface`, `border-border`, `text-foreground`, `text-muted`, `bg-primary`, `text-primary-foreground`, `ring-ring`.
- Avoid hard-coded `bg-white`, `border-slate-*`, `text-slate-*` in new UI.
- Heatmap/metric coloring can remain custom; do not tie it to theme unless explicitly intended.

### Horizontal scrolling (global)
- No page-level horizontal scrollbar: layout enforces `min-w-0` + `overflow-x-hidden`.
- Tables must use a dedicated horizontal scroll container tagged:
  - `data-aph-hscroll`
  - `data-aph-hscroll-axis="x"`
- If a table needs vertical + horizontal scrolling, split wrappers:
  - outer `overflow-y-auto`
  - inner `overflow-x-auto` (tag this inner div)
- Native table horizontal scrollbars are hidden via CSS, but the container remains scrollable via scrollLeft.
- Single sticky bottom scrollbar is global:
  - `apps/web/src/components/StickyHScrollBar.tsx`
  - Picks visible overflowing `[data-aph-hscroll]`, syncs scrollLeft both ways, updates on route change, window scroll/resize, and `aph:sidebar-toggle`.

### Adding a New Wide Table (Checklist)
- Use split wrappers if needed (y outer, x inner).
- Tag the overflow-x container with data-aph-hscroll + axis=x.
- Ensure the scroll container is the one with overflow-x-auto.
- Verify overflow: `scrollWidth > clientWidth`.

**Shared**
- Run from repo root: `npm run web:dev`, `npm run web:build`, `npm run web:lint`.
- Env: copy `apps/web/.env.local.example` to `apps/web/.env.local`. Required vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `APP_ACCOUNT_ID`, `APP_MARKETPLACE`.
- Example values:
  - `APP_ACCOUNT_ID=<account_slug>` (e.g., `sourbear`, `dynamix`)
  - `APP_MARKETPLACE=US`
- `account_id` is a logical partition key (brand or Amazon account slug), not the marketplace.
- `marketplace` is the marketplace code (e.g., `US`).
- Multiple accounts are supported by using different `account_id` values and separate web deployments if desired.
- Security: Supabase service role is server-only; never expose it in client components.
  Server client lives in `apps/web/src/lib/supabaseAdmin.ts`.
- URL filters: `start=YYYY-MM-DD`, `end=YYYY-MM-DD`, `asin=<ASIN|all>` (shareable dashboard state).
- `ui_page_settings` stores per-page default UI settings across devices (e.g., Sales Trend metric selections).

**Pages**
- Dashboard: `/dashboard` (primary UI). Uses `si_sales_trend_daily_latest` for sales KPIs.
- Products: `/products` list and `/products/[asin]` detail with tabs (overview, sales, logbook, costs, ads, keywords, SQP, ranking) using the same URL filters. Keywords is configuration; SQP is weekly Brand Analytics (Search Query Performance).
- Ads: `/ads/performance` with URL params `start`, `end`, `asin` (carried but ignored),
  `channel=sp|sb|sd`, `level=campaigns|adgroups|targets|placements|searchterms`.
  Campaigns table is implemented for SP/SB/SD; other levels are placeholders.
- Sales Center: `/sales`.
- Sales Trend (URL + params): `/sales/trend` supports `granularity=daily|weekly|monthly|quarterly`, `cols=<int>`, `last=YYYY-MM-DD`. When present, start/end are derived from calendar buckets and kept in the URL for tab switching.
- Sales Trend (chart): uses straight (linear) line segments (no curve smoothing).
- Sales Trend (KPI table): ordered to mirror Scale Insights; sticky KPI + Summary columns; Profits breakdown expandable.
  Analysis mini bar sparklines have instant hover tooltip (2 lines: date/period + formatted value).
- Sales Trend (KPI cards): collapsible and default to closed.
- Imports & Health: `/imports-health` (data heartbeat).
- Bulksheet Ops: `/bulksheet-ops/sp-update`, `/bulksheet-ops/sb-update`, `/bulksheet-ops/sp-create`, `/bulksheet-ops/reconcile`
  (local-first generators + reconcile queue).

### Products Ranking Tab
- Ranking heatmap is implemented on the product detail page (`tab=ranking`).
- Date columns are newest → oldest (latest on the left).
- Color bands: Top 10 highlight, then every 45 ranks shifts band (HSL-based).
- Each cell shows organic (top, color-coded) + sponsored (bottom, neutral).
- Date headers are compact (day over month) with full ISO date on hover.
- Header sorting supports keyword, search volume, and date columns (sorts by organic rank).
- Missing values sort last for numeric sorts.
- Ranking header is sticky during vertical scroll; left sticky columns stay aligned.
- Filters: keyword set scope, group filter, columns 14/30/60/∞, search, hide unranked.
- Wide table uses split wrappers with `data-aph-hscroll` for horizontal sync.

### Products SQP Tab
#### What's implemented (SQP)
- SQP is weekly cadence and week-driven (ignores product-level Start/End range).
- SQP tab is ASIN View only, powered by `sqp_weekly_latest_known_keywords` with `scope_type='asin'` and `scope_value=<asin>`.
- Week Ending selector uses ISO week labels in the form `Wxx YYYY (Mon)` (example: `W06 2026 (Feb)`).
- Snapshot table renders selected-week SQP rows with URL-driven state.
- Columns toggle is implemented: `Important` (default) vs `All`.
- Trend Inspector is implemented and opens from both the Trend button and row/query interaction.

#### Validated behavior (ASIN View)
- Week Ending dropdown lists all available weeks for the selected ASIN (newest first); week discovery is paginated and not limited by the snapshot row cap.
- Default week selection is the latest available `week_end`.
- Default table sort is `search_query_volume` descending, with missing values last.
- Columns toggle works as `Important` vs `All`.
- SQP table supports dual-axis scrolling with frozen/sticky header using the same split-wrapper scroll pattern as Ranking (`data-aph-hscroll`, `data-aph-hscroll-axis="x"`).
- Trend Inspector supports KPI selection plus From/To week range and applies changes via `Apply` (no re-render on each KPI checkbox change).
- Trend Inspector supports multi-KPI selection (chart presentation refinements are optional follow-up).

#### Known issues / WIP (Brand continuous)
- Brand (continuous) scope is currently disabled/hidden in the Products SQP UI due to unresolved week history and KPI rendering issues.

**Optional Flags**
- `ENABLE_SPEND_RECONCILIATION` (default `0`) toggles spend reconciliation query.
- `PENDING_RECONCILE_DIR` enables a local-only pending manifest count; if unset, UI shows "not configured".
- Bulksheet Ops env vars: `BULKGEN_OUT_ROOT`, `BULKGEN_PENDING_RECONCILE_DIR`, `BULKGEN_RECONCILED_DIR`, `BULKGEN_FAILED_DIR`,
  `BULKGEN_TEMPLATE_SP_UPDATE`, `BULKGEN_TEMPLATE_SB_UPDATE`, `BULKGEN_TEMPLATE_SP_CREATE`, `ENABLE_BULKGEN_SPAWN`.
- Local-first caveat: Bulksheet Ops depends on local filesystem paths (Dropbox). This will not work on Vercel/serverless.

## Core Principles
1) Facts layer first (bulksheets) before DB/Supabase *features*.
2) Deterministic outputs: stable IDs, normalized names, repeatable selection rules.
3) Rolling export overlap is expected (weekly 30-day exports). When overlapping, always prefer the *latest export* (“data finalizes late”).
4) Don’t build the web UI yet; keep ingestion as CLI and Supabase as read-only source for the UI later.
5) Never commit real Amazon reports/bulksheets to Git. Never commit Supabase keys.
6) Canonical SOPs live in `docs/sop/`.

## Experiment Core Spec
- Experiment-core scaffolding and phase checklist live in `docs/experiment-core/AGENTS.md`.
- Use that document as the implementation contract for experiment-core phases.

## Release Checklist (Phase 8 Final Hardening)
- Scope: Phase 8 is the final hardening phase. Future work is bugfix-only.
- Smoke test `/products`:
  - Load page with default dates and custom date params.
  - Confirm `warnings[]` are visible in-page (not console-only), including hard-cap truncation warning when triggered.
  - Confirm paging/sort/search still work and no silent empty state.
- Smoke test `/products/[asin]`:
  - Overview loads Profile Context + Driver Intents + KIV panels.
  - If optional panel fetch fails, confirm visible overview warning callout appears (with server logs still present).
  - Confirm default date range follows marketplace-day semantics from `getDefaultMarketplaceDateRange(...)`.
- Smoke test `/logbook/experiments`:
  - List renders with filters and outcome badges.
  - If list/link/evaluation hard cap is reached, confirm visible data warning banner appears.
- Smoke test `/logbook/experiments/[id]`:
  - Page renders phases table, events timeline, and interruption highlighting.
  - If optional recent-changes load fails, confirm visible page warning callout appears.
- Smoke test pack/event flows:
  - Baseline pack download.
  - Output pack upload.
  - `Uploaded to Amazon` action.
  - Quick log event presets.
  - Eval pack download.
  - Evaluation output pack upload and applied-changes summary.
  - Rollback pack generation.
  - For POST routes in these flows, verify response contract:
    - success: `{ ok: true, ... }`
    - failure: `{ ok: false, error: string, details?: object }`
- Operator-visible signals to verify:
  - Products/logbook warning banners are visible in UI.
  - Evaluation import shows applied-changes summary counts and warning list.
  - Interruptions are highlighted in timeline (`Interruptions only` filter works).
- Supabase checks before release:
  - Confirm logbook migrations/functions used by experiment-core are already applied in target environment.
  - Validate required tables are queryable from web routes:
    - `log_experiments`, `log_experiment_changes`, `log_experiment_phases`, `log_experiment_events`, `log_evaluations`
    - `log_driver_campaign_intents`, `log_product_kiv_items`
  - Spot-check one write action (`mark-uploaded`, `events`, `evaluation-import`) succeeds with `{ ok: true }`.

## Schema discipline (required for SQL correctness)
- Do not guess table/column names.
- Before writing/debugging any SQL, request the latest `docs/schema_snapshot.md`.
- If not provided, instruct the user to run `npm run schema:snapshot` and upload the file.
- Only use table/column names that exist in the snapshot.

## Data locations (Dropbox)
### Current folder structure (date folders)
Windows:
- `C:\Users\User\Dropbox\AmazonReports\YYYY-MM-DD\`

WSL:
- `/mnt/c/Users/User/Dropbox/AmazonReports/YYYY-MM-DD/`

Known report filenames (stable):
- `Sponsored_Products_Campaign_report.csv`  (hourly)
- `Sponsored_Products_Placement_report.xlsx`
- `Sponsored_Products_Search_Term_Impression_Share_report.csv`
- `Sponsored_Products_Targeting_report.xlsx`
- `Sponsored_Display_Campaign_report.xlsx`
- `Sponsored_Display_Advertised_product_report.xlsx`
- `Sponsored_Display_Targeting_report.xlsx`
- `Sponsored_Display_Matched_target_report.xlsx`
- `Sponsored_Display_Purchased_product_report.xlsx`
- Scale Insights SalesTrend CSVs (renamed to start with ASIN, filename includes `SalesTrend`)

Bulksheet filename (varies):
- `bulk-*.xlsx`

Env var:
- `.env.local` contains `AMAZON_REPORTS_ROOT=/mnt/c/Users/User/Dropbox/AmazonReports`

## Bulksheet Snapshot Rules
- Snapshot date inference:
  - If filename contains `YYYYMMDD-YYYYMMDD`, use the *second date* as `snapshotDate` (YYYY-MM-DD).
  - Otherwise fall back to file mtime (local date).
  - CLI can override with `--snapshot-date YYYY-MM-DD`.

- Coverage window (from filename):
  - coverageStart/coverageEnd = `YYYYMMDD-YYYYMMDD`

- Export timestamp:
  - trailing `-<digits>.xlsx` parsed as `exportTimestampMs` if present.

- ID cleanup:
  - All entity IDs are strings.
  - Excel numeric IDs like `"12345.0"` become `"12345"`.

- Name normalization:
  - Lowercase, trim, collapse whitespace (used for rename detection and joins).

## Implemented (DONE)

### Milestone 1 — Bulksheet → Canonical Snapshot
Command:
- `npm run bulk:parse -- <xlsx> [--snapshot-date YYYY-MM-DD]`

Parses sheet named exactly:
- `Sponsored Products Campaigns`

Outputs arrays:
- campaigns: campaignId, campaignNameRaw, campaignNameNorm, portfolioId, state, dailyBudget, biddingStrategy
- adGroups: adGroupId, campaignId, adGroupNameRaw, adGroupNameNorm, state, defaultBid
- targets: unified keywords + product targets:
  - targetId (Keyword ID or Product Targeting ID)
  - adGroupId, campaignId
  - expressionRaw (Keyword Text or Product Targeting Expression)
  - expressionNorm
  - matchType
  - isNegative
  - state, bid
- placements: campaignId, placementRaw/Code, percentage
- portfolios: portfolioId, portfolioNameRaw, portfolioNameNorm

### Sponsored Brands — Bulk Snapshot (SB)
Bulk parser reads (if present):
- `Sponsored Brands Campaigns`
- `SB Multi Ad Group Campaigns`

SB tables (separate from SP):
- `bulk_sb_campaigns`, `bulk_sb_ad_groups`, `bulk_sb_targets`, `bulk_sb_placements`
- `sb_campaign_name_history`, `sb_ad_group_name_history`

SB snapshot behavior:
- Campaigns: campaign ID/name, portfolio ID, state, daily budget, bidding strategy (bid optimization if present).
- Ad groups: from SB Multi sheet `Ad Group` rows; legacy single-ad-group campaigns synthesize name `Ad group` when only target rows contain an ad group ID.
- Targets: keyword, negative keyword, product targeting (`match_type=TARGETING_EXPRESSION`).
- Placements: from SB Multi sheet `Bidding Adjustment by Placement` rows; normalize placement code and keep `placement_raw_norm`.

### Milestone 2 — Snapshot Diff Engine
Command:
- `npm run bulk:diff -- <old.xlsx> <new.xlsx>`

Detects:
- campaign/adGroup renames
- budget/strategy/placement changes
- target bid/state changes
- added/removed entities
- Writes JSON diff output to `out/`.

### Milestone 3 — Name History Builder (SCD-style, local)
Command:
- `npm run bulk:history -- <folder>`

Builds name history rows with:
- entityType (campaign/adGroup/portfolio)
- entityId
- nameRaw, nameNorm
- validFrom (YYYY-MM-DD)
- validTo (YYYY-MM-DD or null)

### Milestone 4 — Tests / Fixtures
- Synthetic XLSX generator exists for tests (no real files in tests).
- `npm test` must pass.

### Milestone 5 — Overlap Handling: Latest Wins (local selector)
Selection rule for a metric date D:
- consider bulksheets whose coverageStart <= D <= coverageEnd
- pick highest exportTimestampMs (else fallback to snapshotDate/mtime)
Command:
- `npm run bulk:pick -- <folder> <YYYY-MM-DD>`

### Milestone 6 — Supabase facts layer (schema + ingestion)
Supabase migrations:
- `001_init.sql` (bulk snapshots + uploads + name history tables)
- `002_sp_campaign_raw.sql` (SP campaign raw table)
- `003_sp_campaign_hourly.sql` (adds hourly support / start_time + uniqueness)

Bulk ingestion:
- `npm run ingest:bulk -- --account-id <id> <bulk.xlsx> ...`
- date-folder wrapper: `npm run ingest:bulk:date -- --account-id <id> <YYYY-MM-DD or folder>`

SP Campaign raw ingestion (hourly):
- `npm run ingest:sp:campaign -- --account-id <id> <csv> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sp:campaign:date -- --account-id <id> <YYYY-MM-DD or folder>`
Notes:
- campaign CSV has Start Date/End Date/Start Time (hourly).
- coverageStart/coverageEnd are derived from file content; folder date is NOT trusted due to Amazon delay.
- re-run is allowed when an upload exists but had inserted 0 rows (safe retry).

SP Placement raw ingestion:
- `npm run ingest:sp:placement -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sp:placement:date -- --account-id <id> <YYYY-MM-DD or folder>`

SP Targeting raw ingestion:
- `npm run ingest:sp:targeting -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sp:targeting:date -- --account-id <id> <YYYY-MM-DD or folder>`

SP STIS raw ingestion:
- `npm run ingest:sp:stis -- --account-id <id> <csv> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sp:stis:date -- --account-id <id> <YYYY-MM-DD or folder>`

SB raw ingestion (daily):
- `npm run ingest:sb:campaign -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sb:campaign:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run ingest:sb:campaign:placement -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sb:campaign:placement:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run ingest:sb:keyword -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sb:keyword:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run ingest:sb:stis -- --account-id <id> <csv> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sb:stis:date -- --account-id <id> <YYYY-MM-DD or folder>`
Notes:
- SB date-folder wrappers default `exported_at` to the folder date at `T00:00:00Z`.
- Stable SB report filenames are required (see `src/fs/reportLocator.ts`).
- Ignore `Sponsored_Brands_Keyword_Placement_report.xlsx` (often empty) and `Sponsored_Brands_Category_benchmark_report.csv` in this module.
- SB bulk snapshot ingest must parse BOTH sheets: `Sponsored Brands Campaigns` and `SB Multi Ad Group Campaigns`.

SD raw ingestion (daily):
- `npm run ingest:sd:campaign -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sd:campaign:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run ingest:sd:advertised -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sd:advertised:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run ingest:sd:targeting -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sd:targeting:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run ingest:sd:matched -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sd:matched:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run ingest:sd:purchased -- --account-id <id> <xlsx> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sd:purchased:date -- --account-id <id> <YYYY-MM-DD or folder>`
Notes:
- SD date-folder wrappers default `exported_at` to the folder date at `T00:00:00Z`.
- Stable SD report filenames are required (see `src/fs/reportLocator.ts`).

Scale Insights SalesTrend raw ingestion (daily):
- `npm run ingest:sales:si -- --account-id <id> --marketplace <marketplace> <csv> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sales:si:date -- --account-id <id> --marketplace <marketplace> <YYYY-MM-DD or folder>`
Notes:
- CSV filename must start with the ASIN followed by a space (e.g. `B0B2K57W5R SalesTrend - Name.csv`); ASIN is parsed from the filename only.
- Date-folder wrapper scans for any `.csv` containing `SalesTrend` (case-insensitive) and uses folder date at `T00:00:00Z`.
- Prefer immutable exports per folder date (no master file edits or overwrites).

Helium 10 Keyword Tracker ranking ingestion (historical observations):
- `npm run ingest:rank:h10 -- --account-id <id> --marketplace <marketplace> <csv> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:rank:h10:date -- --account-id <id> --marketplace <marketplace> <YYYY-MM-DD or folder>`
- backfill pipeline: `npm run pipeline:backfill:rank:h10 -- --account-id <id> --marketplace <marketplace> --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--continue-on-error]`
Notes:
- Date-folder wrapper scans for `helium10-kt-*.csv` files.
- `Date Added` in CSV is the observation timestamp (`observed_at`) and supports multiple historical rows per keyword.
- Rank fields accept exact (`54`), lower-bound (`>306`/`>96`), or missing (`-`) and are stored as raw text + normalized kind/value.
- Recommended storage is the same immutable date-folder pattern used by other report modules.

Amazon Brand Analytics Search Query Performance (SQP) weekly raw ingestion:
- `npm run ingest:sqp:weekly -- --account-id <id> --marketplace <marketplace> <csv> [--exported-at ISO]`
- date-folder wrapper: `npm run ingest:sqp:weekly:date -- --account-id <id> --marketplace <marketplace> <YYYY-MM-DD or folder>`
- backfill pipeline: `npm run pipeline:backfill:sqp -- --account-id <id> --marketplace <marketplace> --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--continue-on-error]`
Notes:
- Supports both Brand View and ASIN View files in the same module (`source_type='sqp'`, with scope in raw rows).
- CSV layout is fixed: row 1 metadata, row 2 header, row 3+ data.
- SQP scope is stored on `sqp_weekly_raw` as `scope_type` and `scope_value`.
- Brand View scope: metadata includes `Brand=["..."]` and yields `scope_type='brand'`, `scope_value=<brand>`.
- ASIN View scope: metadata includes `ASIN or Product=["..."]` (or `ASIN=["..."]`) and yields `scope_type='asin'`, `scope_value=<asin>`.
- Metadata parsing extracts scope and week range; fallback uses filename (`Brand_View`/`ASIN_View` and `_YYYY_MM_DD` week-end suffix).
- Date-folder wrapper scans for `.csv` files containing `Search_Query_Performance` and uses folder date at `T00:00:00Z`.
- `sqp_weekly_latest_enriched` derives safe-divide metrics (market/self CTR/CVR, share calcs, index metrics, click-to-cart rates).
- Continuity support:
  - `sqp_weekly_brand_agg_from_asin_latest` outputs synthetic brand rows with `scope_value='__AGG_FROM_ASIN__'` by aggregating ASIN-scope rows.
  - `sqp_weekly_brand_continuous_latest` prefers true brand rows when present, else uses the aggregated ASIN row.
- Keyword linkage helper: `sqp_weekly_latest_known_keywords` left-joins `dim_keyword` by `search_query_norm`.
- ASIN View exports are per ASIN; to analyze multiple ASINs, download and ingest each ASIN's SQP export separately (can use `ingest:sqp:weekly:date`).

Supabase views (migrations):
- `sp_campaign_hourly_latest`: latest-wins by (account_id, date, start_time, campaign_name_norm) with max(exported_at)

### Milestone 7 — SP Mapping Layer (raw → stable IDs)
Goal: map name-based raw rows into deterministic ID-based facts using bulk snapshots.

New migrations:
- `011_sp_mapping_core.sql` (mapping issues + manual overrides)
- `012_sp_mapping_facts.sql` (fact tables + latest views)
- `013_sp_stis_rollup.sql` (STIS rollup support for targeting_norm="*")
- `014_latest_tiebreak.sql` (deterministic latest views + upload_stats expansion)

New commands:
- `npm run map:sp:campaign -- --upload-id <id>`
- `npm run map:sp:placement -- --upload-id <id>`
- `npm run map:sp:targeting -- --upload-id <id>`
- `npm run map:sp:stis -- --upload-id <id>`
- `npm run map:sp:all:date -- --account-id <id> <YYYY-MM-DD or folder>`

Mapping rules:
- Choose bulk snapshot by exported_at date:
  - prefer max(snapshot_date <= exported_at_date)
  - fallback min(snapshot_date > exported_at_date) within 7 days
- Overrides (`sp_manual_name_overrides`) take priority over snapshot, then name history.
- If mapping is ambiguous, log to `sp_mapping_issues` and skip insert.
- If missing snapshot, log `missing_bulk_snapshot` and skip insert.
- Latest views for facts use max(exported_at) partitioned by stable IDs, with tie-breaks on uploads.ingested_at then upload_id.

Inspecting issues:
- `select * from sp_mapping_issues where upload_id = '<id>';`
- `select * from sp_mapping_issues where issue_type != 'missing_bulk_snapshot';`

Commands (example):
- `npm run map:sp:all:date -- --account-id sourbear 2026-01-21`
- Inspect issues in `sp_mapping_issues`, add overrides in `sp_manual_name_overrides`, re-run mapping.
- `npm run pipeline:backfill:ads -- --account-id sourbear --root /mnt/c/Users/User/Dropbox/AmazonReports --from 2025-01-01 --to 2025-03-31`

Manual verification (category targeting exclusion):
- Re-run `npm run map:sb:all:date -- --account-id <id> <YYYY-MM-DD or folder>` and `npm run map:sp:all:date -- --account-id <id> <YYYY-MM-DD or folder>`; confirm `issueRows` are `0`.
- Confirm SB mapping issues are empty for the upload:
  - `select count(*) from sb_mapping_issues where upload_id = '<id>';` (expect `0`)

What we learned / common mapping issues & fixes:
- Campaign + Placement issue: report campaign_name_norm not found in chosen bulk snapshot/history (rename lag or suffix mismatch).
- Campaign + Placement fix: insert into `sp_manual_name_overrides` (campaign) using name_norm -> campaign_id; rerun mapping; issues drop to 0.
- Targeting issue: report match type often blank/“—” (normalized to UNKNOWN) for auto targeting clauses and product targeting.
- Targeting fix: resolver tries bulk match_type `TARGETING_EXPRESSION` for auto clauses (close-match, loose-match, substitutes, complements) and asin="..." expressions when match type is unknown/blank.
- Targeting result: target issues drop to 0; do not guess if ambiguous.
- STIS issue: targeting_norm="*" rows are roll-ups (“all targets”), not a real target_id.
- STIS fix: store them in `sp_stis_daily_fact` with target_id NULL (roll-up) via migration `013_sp_stis_rollup.sql`; do not log as mapping issues.
- STIS result: issues drop to 0 and factRows increase.
- STIS search-term rows:
  - If `customer_search_term_norm` is non-empty, target_id may be NULL and this is NOT an error.
  - Do NOT log mapping issues for target_id on STIS search-term rows.
  - When target_id is NULL, `target_key` must be deterministic (targeting signature). Do NOT use a constant like `"__ROLLUP__"` or it can violate `sp_stis_daily_fact_uq`.
- Category targeting is excluded (SP + SB):
  - Rationale: `category="name"` can map to multiple IDs; without API this is ambiguous and creates noisy unmapped issues; category targeting is not a primary sales driver.
  - Rule: any `targeting_norm` matching `/^category=\".*\"$/i` is skipped.
  - Where enforced:
    - Parser-side skip so it does not enter `*_daily_raw`: `src/ads/parseSpTargetingReport.ts`, `src/ads/parseSpStisReport.ts`, `src/ads/parseSbKeywordReport.ts`, `src/ads/parseSbStisReport.ts`.
    - Mapping-side skip so historical raw uploads do not create issues/facts: `src/mapping/mappers.ts` (SP targeting + SP STIS non-search-term), `src/mapping_sb/mappers.ts` (SB keyword + SB STIS non-search-term).
    - Shared helper: `src/ads/targetingFilters.ts` (`isCategoryTargetingExpression`).
  - Result: category targets do not appear in fact tables and do not produce mapping issues.

Official Health Check:
```sql
-- STIS: target_id is only required when there is NO search term
select
  count(*) filter (where campaign_id is null) as missing_campaign_id,
  count(*) filter (where ad_group_id is null) as missing_ad_group_id,
  count(*) filter (
    where (customer_search_term_norm is null or customer_search_term_norm = '')
      and target_id is null
  ) as missing_target_id_when_required
from public.sp_stis_daily_fact;
```

Example flow for a date folder:
1. `npm run ingest:bulk:date -- --account-id <id> <date>`
2. `npm run ingest:sp:campaign:date -- --account-id <id> <date>`
3. `npm run ingest:sp:placement:date -- --account-id <id> <date>`
4. `npm run ingest:sp:targeting:date -- --account-id <id> <date>`
5. `npm run ingest:sp:stis:date -- --account-id <id> <date>`
6. `npm run map:sp:all:date -- --account-id <id> <date>`
7. Inspect `sp_mapping_issues`, add overrides if needed, then re-run mapping.

### Milestone 9 — SB Mapping Layer (raw → stable IDs)
Goal: map SB raw rows into deterministic ID-based facts using SB bulk snapshots.

New migrations:
- `20260213120000_sb_mapping.sql` (SB mapping issues, overrides, facts, latest views)

New commands:
- `npm run map:sb:campaign -- --upload-id <id>`
- `npm run map:sb:campaign:placement -- --upload-id <id>`
- `npm run map:sb:keyword -- --upload-id <id>`
- `npm run map:sb:stis -- --upload-id <id>`
- `npm run map:sb:stis:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run map:sb:all:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run pipeline:backfill:sb -- --account-id <id> --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--concurrency N] [--dry-run] [--continue-on-error]`

Mapping rules:
- Choose bulk snapshot by exported_at date (same closest-before/after within 7 days logic as SP).
- Overrides (`sb_manual_name_overrides`) take priority over snapshot, then name history.
- If mapping is ambiguous, log to `sb_mapping_issues` and skip insert.
- If missing snapshot, log `missing_bulk_snapshot` and skip insert.
- Latest views for facts use max(exported_at) partitioned by stable IDs, with tie-breaks on uploads.ingested_at then upload_id.
- Category targeting rows are intentionally ignored by parse + map paths (see Category targeting exclusion note).

SB STIS rules:
- If `customer_search_term_norm` is non-empty, target_id may be NULL and this is NOT an error.
- Do NOT log mapping issues for target_id on SB STIS search-term rows.
- When target_id is NULL, `target_key` must be deterministic (targeting signature). Do NOT use a constant.

### Milestone 10 — SD Mapping Layer (raw → stable IDs)
Goal: map SD raw rows into deterministic ID-based facts using SD bulk snapshots.

New migrations:
- `20260213132000_sd_mapping.sql` (SD mapping issues, overrides, facts, latest views)

New commands:
- `npm run map:sd:campaign -- --upload-id <id>`
- `npm run map:sd:advertised -- --upload-id <id>`
- `npm run map:sd:targeting -- --upload-id <id>`
- `npm run map:sd:matched -- --upload-id <id>`
- `npm run map:sd:purchased -- --upload-id <id>`
- `npm run map:sd:all:date -- --account-id <id> <YYYY-MM-DD or folder>`
- `npm run pipeline:backfill:sd -- --account-id <id> --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--concurrency N] [--dry-run] [--continue-on-error]`

Mapping rules:
- Choose bulk snapshot by exported_at date:
  - prefer max(snapshot_date <= exported_at_date)
  - fallback min(snapshot_date > exported_at_date) within 7 days
- Overrides (`sd_manual_name_overrides`) take priority over snapshot, then name history.
- If mapping is ambiguous, log to `sd_mapping_issues`.
- If missing snapshot, log `missing_bulk_snapshot` and skip insert.
- Latest views for facts use max(exported_at) partitioned by stable IDs, with tie-breaks on uploads.ingested_at then upload_id.

SD targeting/ad rules:
- Missing target_id or ad_id should NOT block inserts; store deterministic `target_key` / `ad_key` signatures.
- Do not use constant keys; include targeting/ad signature fields for determinism.

### Milestone 11 — SQP Weekly Module (Amazon Brand Analytics)
Goal: ingest weekly SQP CSVs for both Brand View and ASIN View without ads-ID mapping.

Added migration:
- `20260213153000_sqp_weekly.sql`
  - expands `uploads.source_type` with `sqp`
  - creates `sqp_weekly_raw`
  - creates deterministic latest view `sqp_weekly_latest`
  - creates enriched metrics view `sqp_weekly_latest_enriched`
  - creates continuity views `sqp_weekly_brand_agg_from_asin_latest` and `sqp_weekly_brand_continuous_latest`
  - creates keyword helper view `sqp_weekly_latest_known_keywords`
  - extends `upload_stats` row_count for `source_type='sqp'`

New commands:
- `npm run ingest:sqp:weekly -- --account-id <id> --marketplace <marketplace> <csv> [--exported-at ISO]`
- `npm run ingest:sqp:weekly:date -- --account-id <id> --marketplace <marketplace> <YYYY-MM-DD or folder>`
- `npm run pipeline:backfill:sqp -- --account-id <id> --marketplace <marketplace> --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--continue-on-error]`

Parsing rules:
- SQP CSV row 1 is metadata, row 2 is header, row 3+ is data.
- Supports scope metadata keys `Brand`, `ASIN`, `Product`, or `ASIN or Product`.
- Brand View: `Brand=["..."]` -> `scope_type='brand'`, `scope_value=<brand>`.
- ASIN View: `ASIN or Product=["..."]` or `ASIN=["..."]` -> `scope_type='asin'`, `scope_value=<asin>`.
- Week range parsed from metadata `Select week`; fallback is filename `_YYYY_MM_DD` week-end (week-start = week-end - 6 days).
- Percent strings are interpreted as percentages and divided by 100 (e.g. `0.72` -> `0.0072`).

### Milestone 12 — Helium 10 Keyword Tracker Rankings
Goal: ingest keyword ranking observations from Helium 10 CSV exports with deterministic latest/daily views.

Added migration:
- `20260213210000_h10_keyword_tracker.sql`
  - expands `uploads.source_type` with `h10_keyword_tracker`
  - creates `h10_keyword_tracker_raw`
  - creates deterministic latest view `h10_keyword_tracker_latest`
  - creates per-day latest view `h10_keyword_rank_daily_latest`
  - creates helper view `h10_keyword_rank_daily_with_dims` (left joins to `products` and `dim_keyword`)
  - extends `upload_stats` row_count for `source_type='h10_keyword_tracker'`

New commands:
- `npm run ingest:rank:h10 -- --account-id <id> --marketplace <marketplace> <csv> [--exported-at ISO]`
- `npm run ingest:rank:h10:date -- --account-id <id> --marketplace <marketplace> <YYYY-MM-DD or folder>`
- `npm run pipeline:backfill:rank:h10 -- --account-id <id> --marketplace <marketplace> --root <path> --from YYYY-MM-DD --to YYYY-MM-DD [--dry-run] [--continue-on-error]`

Parsing rules:
- CSV columns include `Date Added` (observation timestamp) and may contain many historical observations per keyword.
- `Organic Rank` / `Sponsored Position` parse as:
  - exact numeric (`54`) -> kind=`exact`, value=54
  - lower-bound (`>306`, `>96`) -> kind=`gte`, value parsed from suffix
  - missing (`-` or blank) -> kind=`missing`, value=NULL
- Mixed ASIN rows in a single file are rejected (one ASIN per file required).

### Milestone 13 — Logbook (Experiments + Changes)
Goal: log experiments and operational changes, surfaced in the Product detail Logbook tab.

Tables:
- `log_experiments`: experiment metadata (objective, hypothesis, evaluation windows, metrics).
- `log_changes`: change events with `occurred_at` (defaults to now) and `source` (defaults to `manual`).
- `log_change_entities`: links changes to entities (campaigns, targets, products, keywords, etc.). `product_id` is stored as text (ASIN).
- `log_experiment_changes`: optional join between experiments and changes.
- `log_evaluations`: optional experiment evaluation snapshots.

Commands:
- `npm run log:experiment:create -- --account-id sourbear --marketplace US --file examples/logbook/experiment.ads.template.json`
- `npm run log:change:create -- --account-id sourbear --marketplace US --file examples/logbook/change.ads.template.json`
- `npm run log:experiment:link-change -- --account-id sourbear --marketplace US --experiment-id <uuid> --change-id <uuid>`
- `npm run log:change:list -- --account-id sourbear --marketplace US --limit 5`
- `npm run log:experiment:list -- --account-id sourbear --marketplace US --limit 5`

Workflow (validated):
- Download AI packs from Product Logbook.
- Upload AI Output Pack JSON to create experiment + optional manual changes.
- Review SP/SB plan previews (review + bulksheet tables).
- Generate bulksheet per SP/SB plan (`run_id` scoped).
- Upload generated bulksheet to Amazon.
- Ingest the next bulk snapshot.
- Auto validation runs after ingest and updates change statuses.
- Manual `Validate now` is available per bulkgen change in Product Logbook.

Sample JSON:
```json
{
  "name": "SP budget test week 6",
  "objective": "Improve ROAS without lowering volume",
  "hypothesis": "Higher budgets unlock extra top-of-search volume",
  "evaluation_lag_days": 2,
  "evaluation_window_days": 7,
  "primary_metrics": { "roas": "sp_campaign_hourly_latest" },
  "guardrails": { "acos": "<= 0.30" },
  "scope": { "channels": ["sp"], "campaigns": ["Brand - Core"] }
}
```

```json
{
  "occurred_at": "2026-02-04T00:00:00Z",
  "channel": "sp",
  "change_type": "budget_update",
  "summary": "Raised daily budget to $200",
  "why": "Avoiding budget cap during peak hours",
  "before_json": { "daily_budget": 120 },
  "after_json": { "daily_budget": 200 },
  "source": "manual",
  "source_upload_id": null,
  "entities": [
    { "entity_type": "campaign", "campaign_id": "1234567890", "note": "main campaign" },
    { "entity_type": "product", "product_id": "B0ABC12345" }
  ]
}
```

### Milestone 14 — Bulksheet Generator (SP Update, deterministic)
Goal: generate safe-to-upload SP bulksheet updates from stable IDs with strict headers.

Module:
- `src/bulksheet_gen_sp/` (types, current fetch, row builder, XLSX writer)

Commands:
- `npm run bulkgen:sp:update -- --account-id sourbear --marketplace US --template <xlsx> --out-dir <dir> --file <changes.json>`

Notes:
- Always writes two files: `upload_strict.xlsx` (template headers only) + `review.xlsx` (adds helper columns).
- Template headers are read from `--template` and preserved exactly.
- Fails fast if required columns or sheets are missing, or if any referenced IDs are not found.
- Generator merges duplicate entity rows by key (single row per entity for upload safety).
- Supported actions: update_campaign_budget, update_campaign_state, update_campaign_bidding_strategy, update_ad_group_state, update_ad_group_default_bid, update_target_bid, update_target_state, update_placement_modifier.
- Example changes.json snippet:
```json
{
  "exported_at": "2026-02-14T00:00:00Z",
  "actions": [
    { "type": "update_ad_group_state", "ad_group_id": "123456", "new_state": "paused" },
    { "type": "update_ad_group_default_bid", "ad_group_id": "123456", "new_bid": 1.25 },
    {
      "type": "update_campaign_bidding_strategy",
      "campaign_id": "987654",
      "new_strategy": "Dynamic bids - down only"
    }
  ]
}
```
Logging (optional):
- Add `--log` to write `log_changes` + `log_change_entities` for each merged upload row.
- Optional `--experiment-id <uuid>` to link all changes to an experiment.
- Optional `--run-id <string>` to force a stable run ID (defaults to timestamp+random when `--log` is present).

### Milestone 16 — SP Bulksheet Generator (Create, minimal)
Goal: generate safe-to-upload SP bulksheet create files with strict headers, defaults, caps, and a manifest.

Commands:
- `npm run bulkgen:sp:create -- --account-id sourbear --marketplace US --template <xlsx> --out-dir <dir> --file <changes.json> [--confirm-create] [--portfolio-id <id>]`
- `npm run sp:create:reconcile -- --account-id sourbear --snapshot-date YYYY-MM-DD --manifest <json>`
- `npm run sp:create:reconcile:pending -- --account-id sourbear --snapshot-date YYYY-MM-DD --pending-dir <path> [--dry-run] [--max-manifests N] [--verbose]`

Notes:
- Always writes `review.xlsx` + `creation_manifest.json` (includes `run_id` and temp IDs used).
- `upload_strict.xlsx` is only written when `--confirm-create` is provided (dry-run otherwise).
- Required create fields: campaign `targeting_type` (Auto/Manual).
- Optional: `--portfolio-id` writes `Portfolio ID` on campaign rows (template must include column).
- Temp linking IDs: Campaign ID + Ad Group ID are generated and used for child rows.
- Product Ad `State` is always set (Paused default).
- Manifest is used for read-only reconciliation after upload.

Logging (optional):
- Add `--log` to write `log_changes` for each merged create row.
- Optional `--experiment-id <uuid>` to link all changes to an experiment.

Pending reconcile (file-based queue):
- Folder convention:
  - `<base>/_PENDING_RECONCILE` (manifests)
  - `<base>/_RECONCILED` (manifest + `.reconcile_result.json`)
  - `<base>/_FAILED` (manifest + `.fail.json`)
- `sp:create:reconcile:pending` processes manifests in order; successful matches move to `_RECONCILED`, malformed manifests move to `_FAILED`, partial matches stay in `_PENDING_RECONCILE`.

Recommended flow:
- Generate create package with `bulkgen:sp:create`.
- Upload `upload_strict.xlsx`.
- Copy `creation_manifest.json` into `_PENDING_RECONCILE`.
- Download latest bulksheet snapshot (may lag).
- Run `sp:create:reconcile:pending` until files move to `_RECONCILED`.

### Milestone 15 — SB Bulksheet Generator (Update-only)
Goal: generate safe-to-upload SB bulksheet updates from stable IDs with strict headers.

Module:
- `src/bulksheet_gen_sb/` (types, current fetch, row builder, XLSX writer)

Command:
- `npm run bulkgen:sb:update -- --account-id sourbear --marketplace US --template <xlsx> --out-dir <dir> --file <changes.json> [--sheet "SB Multi Ad Group Campaigns"]`

Notes:
- Always writes two files: `upload_strict.xlsx` (template headers only) + `review.xlsx` (adds helper columns).
- Template headers are read from `--template` and preserved exactly.
- Fails fast if required columns or sheets are missing, or if any referenced IDs are not found.
- Generator merges duplicate entity rows by key (single row per entity for upload safety).
- Default target sheet is `SB Multi Ad Group Campaigns` (override with `--sheet`).
- Safe output folder pattern: `out/bulkgen/sb/<YYYY-MM-DD>/`.
- SB templates may use `Budget` instead of `Daily Budget` for campaign updates; the generator accepts either and writes into the header found (prefers `Daily Budget` if both exist).
Logging (optional):
- Add `--log` to write `log_changes` + `log_change_entities` for each merged upload row.
- Optional `--experiment-id <uuid>` to link all changes to an experiment.
- Optional `--run-id <string>` to force a stable run ID (defaults to timestamp+random when `--log` is present).

Recommended workflow:
1. `npm run log:experiment:create -- --account-id <id> --marketplace <mkt> --file <experiment.json>`
2. Generate bulksheet with `--log --experiment-id <uuid>`
3. Upload bulksheet to Amazon
4. Later evaluate with logbook views/evaluations

### Milestone 17 — Product Logbook Experiments (SP+SB) + Bulkgen Validation
Goal: Product Logbook experiment workflow is now end-to-end for SP and SB: AI packs → experiment/plans → plan preview + bulksheet generation → bulk ingest validation → evaluation packs/output → outcome UI.

Migration:
- `supabase/migrations/20260221130000_logbook_change_validations.sql`
  - creates `log_change_validations` (one row per `change_id`) with status, expected/actual/diff JSON, validated upload/snapshot, and check timestamps.

Validator:
- `src/logbook/validateBulkgenChanges.ts` (shared validation logic)
- `src/cli/logValidateBulkgenChanges.ts` (CLI wrapper)
- Command:
  - `npm run log:validate:bulkgen -- --account-id <id> [--mode auto|manual] [--upload-id <uuid>] [--change-id <uuid> ...] [--limit <n>]`
- Evaluation CLI:
  - No separate evaluation CLI in this phase (evaluation import is web route/server action).

Auto-validation hook:
- Triggered from bulk ingest flow in `src/ingest/ingestBulk.ts` (after successful new bulk ingest).
- Validation summary is surfaced in ingest CLI outputs:
  - `src/cli/ingestBulk.ts`
  - `src/cli/ingestBulkDate.ts`

Bulkgen logging improvements:
- `product_id` (ASIN) is carried through SP/SB update changes and written to `log_change_entities.product_id`.
- Placement identity is included for validation and traceability:
  - `log_change_entities.extra` (`placement_code`, `placement_raw_norm`, `placement_raw`)
  - `after_json` for placement updates
- Wired end-to-end for SP and SB via:
  - generator types (`src/bulksheet_gen_sp/types.ts`, `src/bulksheet_gen_sb/types.ts`)
  - generator CLIs (`src/cli/bulkGenSpUpdate.ts`, `src/cli/bulkGenSbUpdate.ts`)
  - web server generator wrapper (`apps/web/src/lib/bulksheets/runGenerators.ts`)

Product UI workflow:
- Product Prompt + Data packs:
  - `apps/web/src/app/products/[asin]/logbook/ai-prompt-pack/route.ts`
  - `apps/web/src/app/products/[asin]/logbook/ai-data-pack/route.ts`
- Product Output Pack upload/import creates experiment + optional manual changes, with SP/SB plans embedded in scope:
  - parser/importer:
    - `apps/web/src/lib/logbook/aiPack/parseProductExperimentOutputPack.ts`
    - `apps/web/src/lib/logbook/aiPack/importProductExperimentOutputPack.ts`
  - upload UI `apps/web/src/components/logbook/ProductLogbookAiPackImport.tsx`
  - Product tab action wiring in `apps/web/src/app/products/[asin]/page.tsx`
- Product Logbook experiment cards render SP/SB plan previews:
  - Review preview table + Bulksheet preview table
  - sticky table headers + `data-aph-hscroll` wide-table pattern
- Per-plan generate buttons exist for SP + SB and keep `run_id` linkage into bulkgen/logging:
  - web server generator wrapper: `apps/web/src/lib/bulksheets/runGenerators.ts`
  - Product tab action wiring in `apps/web/src/app/products/[asin]/page.tsx`
- Validation status is surfaced on changes (`pending|validated|mismatch|not_found`) with manual `Validate now`.
- Evaluation workflow (Phase 2):
  - Experiment Deep Dive pack download:
    - `apps/web/src/app/logbook/experiments/[id]/ai-deep-dive-pack/route.ts`
  - Evaluation Prompt/Data pack downloads:
    - `apps/web/src/app/logbook/experiments/[id]/ai-eval-prompt-pack/route.ts`
    - `apps/web/src/app/logbook/experiments/[id]/ai-eval-data-pack/route.ts`
  - Evaluation Output Pack upload/import:
    - parser/importer:
      - `apps/web/src/lib/logbook/aiPack/parseExperimentEvaluationOutputPack.ts`
      - `apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts`
    - upload UI:
      - `apps/web/src/components/logbook/ExperimentEvaluationOutputPackImport.tsx`
    - writes `log_evaluations`, stores computed KPIs + outcome in `metrics_json`, and updates experiment `scope.status='complete'` (default behavior) plus `scope.outcome_summary`.
  - Outcome score pill thresholds:
    - `0-39 red`, `40-69 yellow`, `70-100 green`
    - shared helper: `apps/web/src/lib/logbook/outcomePill.ts`

Workflow (current):
1. Download product Prompt/Data packs.
2. Brainstorm externally and produce Output Pack JSON.
3. Upload Output Pack (creates experiment + optional manual changes + plans).
4. Review plan previews (review + bulksheet).
5. Generate SP/SB bulksheets per plan and upload to Amazon.
6. Ingest next bulk snapshot.
7. Auto-validation runs after bulk ingest (manual `Validate now` available).
8. Download experiment evaluation packs (Deep Dive, Eval Prompt, Eval Data).
9. Upload Evaluation Output Pack.
10. Outcome/status is updated and shown in UI.

Phase 2 key files:
- `apps/web/src/lib/logbook/computeExperimentKpis.ts`
- `apps/web/src/lib/logbook/getExperimentContext.ts`
- `apps/web/src/app/logbook/experiments/[id]/ai-deep-dive-pack/route.ts`
- `apps/web/src/app/logbook/experiments/[id]/ai-eval-prompt-pack/route.ts`
- `apps/web/src/app/logbook/experiments/[id]/ai-eval-data-pack/route.ts`
- `apps/web/src/lib/logbook/aiPack/parseExperimentEvaluationOutputPack.ts`
- `apps/web/src/lib/logbook/aiPack/importExperimentEvaluationOutputPack.ts`
- `apps/web/src/components/logbook/ExperimentEvaluationOutputPackImport.tsx`
- `apps/web/src/app/products/[asin]/page.tsx`
- `apps/web/src/app/logbook/experiments/[id]/page.tsx`

Tests added/updated:
- `test/bulkGenLogbook.test.ts`
- `test/logbookChangeValidationLogic.test.ts`
- `test/productExperimentOutputPack.test.ts`
- `test/experimentKpiWindows.test.ts`
- `test/experimentEvaluationPack.test.ts`
- `test/outcomePillColor.test.ts`

### Milestone 18 — Product Changes Explorer + Account Baseline AI Packs
Goal: add a product-level change explorer and account-level baseline packs for first-run AI analysis, while preserving the Phase 2 logbook workflow.

Product Changes Explorer:
- New Product tab: `tab=changes` on `/products/[asin]`.
- URL-driven filters:
  - `ch_channel=all|sp|sb|sd|non_ads`
  - `ch_source=all|bulkgen|manual`
  - `ch_validation=all|pending|validated|mismatch|not_found|none`
  - `ch_q=<search>`
- Date scoping uses existing product `start/end` URL filters.
- Data loader:
  - `apps/web/src/lib/products/getProductChangesExplorerData.ts`
  - joins `log_changes` + `log_change_entities` (product_id ASIN) + optional `log_change_validations` + optional experiment join (`log_experiment_changes`, `log_experiments`).
- View-model/filter logic:
  - `apps/web/src/lib/products/buildProductChangesExplorerViewModel.ts`
- UI behavior:
  - sticky header table
  - wide table wrapper uses `data-aph-hscroll` + `data-aph-hscroll-axis="x"`
  - row detail includes human-readable before/after diff summary
  - raw `before_json`/`after_json` shown in collapsible `<details>`
  - validation status pill styling reuses existing pattern classes.

Account Baseline AI Packs:
- New download routes:
  - `apps/web/src/app/logbook/ai-baseline-prompt-pack/route.ts`
  - `apps/web/src/app/logbook/ai-baseline-data-pack/route.ts`
- Data computation:
  - `apps/web/src/lib/logbook/aiPack/getAccountBaselineDataPack.ts`
  - pack schema helper:
    - `apps/web/src/lib/logbook/aiPack/accountBaselinePack.ts`
- Data pack content (top-N / bounded):
  - sales KPI summaries for last 30d/90d
  - top products snapshot with revenue/orders/units and 30d-vs-prev30d deltas
  - SP + SB ads summaries for 30d/90d (spend, sales, ACOS, ROAS, combined)
  - recent experiments with status + latest outcome score (if present)
  - validation summary counts (`validated|mismatch|pending|not_found|none`)
  - ingestion heartbeat by `source_type` from `upload_stats`.
- Prompt pack enforces:
  - objective-driven analysis
  - required “Missing Info Checklist” when data is insufficient
  - structured markdown response with JSON appendix.

Baseline pack download entry points:
- Products header (`/products`) includes plain `<a download>` links for prompt/data packs.
- Logbook experiments header (`/logbook/experiments`) includes plain `<a download>` links for prompt/data packs.

Global Experiments Library (Phase 3C optional, implemented):
- Route remains `/logbook/experiments`.
- Added filters:
  - `status=all|<status>`
  - `outcome=all|win|mixed|loss|none`
  - `q=<search>`
- Table includes cross-product context (`scope.product_id`) and latest outcome score band.

Phase 3 tests added:
- `test/productChangesExplorerViewModel.test.ts`
- `test/accountBaselinePack.test.ts`

### Milestone 8 — Product Profile Module (Catalog) + Keyword Strategy Library
What was added (high-level):
- `products` (ASIN-level) + `product_skus` (SKU-level) supports multiple SKUs under one ASIN.
- `product_cost_history` (SKU cost history) + safe insert behavior (close previous current row; skip identical).
- `product_profile` (profile_json context).
- Saving product profile auto-creates missing `products` rows via:
  - `apps/web/src/lib/products/ensureProductId.ts`
- Cost helper views: `v_product_sku_base`, `v_product_sku_cost_current` (CURRENT_DATE; base-SKU fallback).
- Keyword grouping tables + exclusivity trigger (strategy-only; no Amazon status mirroring).

Scripts:
- `scripts/product_seed.ts` (`npm run product:seed`)
- `scripts/import_keyword_groups_from_csv.ts` (`npm run keywords:import`)
- `scripts/cleanup_test_skus.ts` (`npm run product:cleanup-test-skus`)

### Product → Keywords tab
- Keyword groups are managed under Product detail → Keywords tab (not SQP).
- Import UI component: `apps/web/src/components/KeywordGroupImport.tsx`
- Keyword Set Management UI: `apps/web/src/components/KeywordGroupSetManager.tsx`
  - Activate a set deactivates all other sets for the product.
  - Deactivate is supported; no delete/soft-delete.
  - Per-group keyword counts are displayed.
  - Per-set export uses `/products/[asin]/keywords/export?set=<group_set_id>`.
- CSV parsing helper used by UI import: `apps/web/src/lib/csv/parseCsv.ts`
- Downloads:
  - Template + AI pack are downloadable even when no group set exists.
  - Export grouped CSV requires an existing group set (otherwise 404 “No keyword group set found”).
  - Route handlers:
    - `apps/web/src/app/products/[asin]/keywords/export/route.ts`
    - `apps/web/src/app/products/[asin]/keywords/template/route.ts`
    - `apps/web/src/app/products/[asin]/keywords/ai-pack/route.ts`
  - Download links must be plain `<a>` anchors with the `download` attribute (do not use `next/link`) to prevent Next App Router navigation/POST behavior.

### Keyword Groups CSV Format (contract)
- CSV header is the FIRST row (no note row required).
- Backward compatible: importer auto-detects old format with a leading note row + header on row 2.
- Columns:
  - A: keyword (reserved)
  - B: group (reserved)
  - C: note (reserved)
  - D..O: group names (max 12 groups)
- Keywords are listed under each group column; blanks allowed; importer normalizes keywords and de-dupes.
- Source of truth:
  - Importer: `scripts/import_keyword_groups_from_csv.ts`
  - Export/template/AI-pack routes:
    - `apps/web/src/app/products/[asin]/keywords/export/route.ts`
    - `apps/web/src/app/products/[asin]/keywords/template/route.ts`
    - `apps/web/src/app/products/[asin]/keywords/ai-pack/route.ts`

Migrations:
- `20260211100000_remote_placeholder.sql` (history alignment placeholder)
- `20260211144000_create_product_profile_v1.sql`
- `20260211145248_product_profile_cost_views.sql`
- `20260211154552_keyword_grouping_v1.sql`

Verification:
- Cost fallback verified.
- Keyword CSV imported into 12 groups with 299 keywords/memberships, 0 failures.
- Cleanup removed test SKUs, leaving only real SKU.

## Recent changes / Changelog
### 2026-02-24
- Added Sponsored Brands Attributed Purchases ingestion.
  - `source_type`: `sb_attributed_purchases`
  - migration: `20260226120000_sb_attributed_purchases_daily.sql`
  - tables/views: `sb_attributed_purchases_daily_fact`, `sb_attributed_purchases_daily_fact_latest`
  - CLIs: `ingest:sb:attributed-purchases`, `ingest:sb:attributed-purchases:date`
  - filename: `Sponsored_Brands_Attributed_Purchases_report.csv`
- Added SB allocated ASIN spend for baseline analysis because the attributed purchases report does not include spend.
  - SQL view created manually in Supabase: `sb_allocated_asin_spend_daily_v3`
  - allocation rule: allocate `sb_campaign_daily_fact_latest.spend` to `purchased_asin_norm` by sales share (fallback orders/units)
  - Product baseline AI data pack now uses allocated spend for:
    - reconciliation SB rows
    - PPC attribution bridge `sbAttributedAsinSpendTotal`
- Added Reject-US account enforcement.
  - DB constraint: `uploads_account_id_not_us_chk` with rule `lower(account_id) <> 'us'`
  - CLI guard: `src/cli/_accountGuard.ts`, wired into common CLIs to throw on `--account-id US`
  - policy: `US` account_id is deprecated; use `sourbear` going forward
- Product baseline AI data pack robustness: heavy date-range queries now fetch in date chunks (default ~7 days) and merge rows, to reduce query size and keep pack downloads stable as data grows.
  - Why: prevents Supabase/Postgres `statement timeout` failures on large windows; baseline packs remain downloadable in web.
  - Behavior: chunk failures are non-fatal (continue with successful chunks), emit concise partial-data warnings, and avoid silently defaulting spend to `0` as if complete.
  - Where: helper `apps/web/src/lib/logbook/aiPack/fetchByDateChunks.ts`, used by `apps/web/src/app/products/[asin]/logbook/ai-data-pack/route.ts`.
  - Tests: `test/fetchByDateChunks.test.ts` (+ route coverage in `test/productBaselineDataPackRoute.test.ts`).

### 2026-02-23
- Added Logbook AI Prompt Pack templates with template selection in the Product Logbook AI workflow download area.
- Added template management page at `/settings/logbook-ai-packs` to edit prompt instructions and set a default template.
- Added prompt-pack renderer module for Product Experiment Prompt Packs with template-driven assistant instructions.
- Updated product logbook AI prompt-pack route to support `?template=` selection.
- Fixed Next.js hydration mismatch for Product download links (Keywords AI pack + Logbook prompt pack) by matching SSR and first client render (hydration gate; localStorage read after mount); added regression tests `test/keywordAiPackDownloadHydration.test.ts` and `test/productExperimentPromptPackDownloadHydration.test.ts`.

### 2026-02-13
- Added Sponsored Brands raw ingestion (campaign, campaign placement, keyword, STIS) with latest-wins views and upload_stats counts.
- SB parsers + CLIs + date-folder wrappers (exported_at defaults to folder date at T00:00:00Z).
- Added Sponsored Brands mapping layer: SB mapping issues/overrides, fact tables + latest views, SB mapping CLIs, and SB backfill pipeline.
- Added SQP weekly ingestion (Brand View + ASIN View), parser with metadata/header-row handling, raw/latest/enriched/continuity views, keyword-link helper view, and SQP backfill pipeline.
- Added Helium 10 Keyword Tracker ingestion (raw/latest/daily ranking views), rank parser for exact/gte/missing values, date-folder wrapper for `helium10-kt-*.csv`, and dim-link helper view.

### 2026-02-12
- Added Sponsored Brands bulk snapshot support (SB) with separate tables and name history.
- New parser for SB sheets and SB ingest upserts (no SP table changes).
- SB bulk snapshot tests with synthetic XLSX.

### 2026-02-11
- Product Profile module: products, SKUs, cost history, profile JSON, and cost views (base SKU + current cost).
- Safe cost insert behavior: close previous current row; skip identical.
- Keyword grouping tables + exclusivity trigger (strategy library; no status mirroring).
- Scripts: `product:seed`, `keywords:import`, `product:cleanup-test-skus`.
- Migrations: product profile v1, cost views, keyword grouping, remote placeholder.
- Verified: cost fallback, keyword CSV import (12 groups, 299 keywords/memberships, 0 failures), cleanup removed test SKUs.

### 2026-02-10
- Target resolver fix (expression targets with UNKNOWN match type)
  - Root cause: SP reports sometimes emit `match_type_norm="UNKNOWN"` for expression-based targets (asin-expanded, category, auto clauses), while `bulk_targets` stores them as `match_type="TARGETING_EXPRESSION"` with `expression_norm`.
  - Fix in `src/mapping/core.ts`:
    - `isTargetingExpression()` recognizes auto clauses + `asin=` + `asin-expanded=` + `category="..."`.
    - When `effectiveMatchType` is `UNKNOWN` and expression is expression-based, try match_type `TARGETING_EXPRESSION`.
  - Result: for 2026-02-10 folder, `sp_targeting` issueRows 45->0 and `sp_stis` 18->0.
- Bulk snapshot picker fix
  - Root cause: `pickBulkSnapshotFromList` always returned max(snapshot<=exportedAt) and never considered snapshots after exported_at within the allowed 7-day window.
  - Fix in `src/mapping/core.ts`: compare nearest-before vs nearest-after (within 7 days) and pick the closer (tie -> before).
  - Confirmed: `pickBulkSnapshotFromList('2026-02-04',['2026-01-31','2026-02-05'])` now returns `2026-02-05`.
- Manual overrides for rename drift
  - Added rows to `sp_manual_name_overrides` for remaining unmapped `campaign_name_norm` variants (rename drift / bulksheet gaps) for 2026-02-04.
  - After inserting overrides and rerunning mapping, 2026-02-04 maps clean (0 issues across campaign/placement/targeting/stis).
- Verification commands used
  - `npm run ingest:bulk:date -- --account-id sourbear 2026-02-10`
  - `npm run ingest:sp:*:date` for 2026-02-10
  - `npm run map:sp:all:date -- --account-id sourbear 2026-02-10` (0 issues)
  - `npm run map:sp:all:date -- --account-id sourbear 2026-02-04` (0 issues after overrides)
- Git
  - `60fdc52` Fix UNKNOWN expression targets by resolving as TARGETING_EXPRESSION
  - `9e8abc7` Pick closest bulk snapshot within +7d window

## Git / Safety
- `.env.local` must be gitignored.
- Never commit real Dropbox files.
- Ensure `.gitignore` includes:
  - `.env.local`
  - `out/`
  - `data/` (if used)
