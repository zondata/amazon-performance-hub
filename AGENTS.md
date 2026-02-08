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

## Git / Safety
- `.env.local` must be gitignored.
- Never commit real Dropbox files.
- Ensure `.gitignore` includes:
  - `.env.local`
  - `out/`
  - `data/` (if used)
