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

## Core Principles
1) Facts layer first (bulksheets) before DB/Supabase *features*.
2) Deterministic outputs: stable IDs, normalized names, repeatable selection rules.
3) Rolling export overlap is expected (weekly 30-day exports). When overlapping, always prefer the *latest export* (“data finalizes late”).
4) Don’t build the web UI yet; keep ingestion as CLI and Supabase as read-only source for the UI later.
5) Never commit real Amazon reports/bulksheets to Git. Never commit Supabase keys.

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

### Milestone 2 — Snapshot Diff Engine
Command:
- `npm run bulk:diff -- <old.xlsx> <new.xlsx>`

Detects:
- campaign/adGroup renames
- budget/strategy/placement changes
- target bid/state changes
- added/removed entities
Writes JSON diff output to `out/`.

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
- `npm run map:sp:all:date -- --account-id US 2026-01-21`
- Inspect issues in `sp_mapping_issues`, add overrides in `sp_manual_name_overrides`, re-run mapping.
- `npm run pipeline:backfill:ads -- --account-id US --root /mnt/c/Users/User/Dropbox/AmazonReports --from 2025-01-01 --to 2025-03-31`

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

## Recent changes / Changelog
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
  - `npm run ingest:bulk:date -- --account-id US 2026-02-10`
  - `npm run ingest:sp:*:date` for 2026-02-10
  - `npm run map:sp:all:date -- --account-id US 2026-02-10` (0 issues)
  - `npm run map:sp:all:date -- --account-id US 2026-02-04` (0 issues after overrides)
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
