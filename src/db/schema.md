# Facts Layer Schema (Bulksheet First)

## Core Entities
- `accounts`
  - Primary key: `account_id`

- `uploads`
  - Primary key: `upload_id`
  - Foreign key: `account_id -> accounts.account_id`
  - Uniqueness: `(account_id, file_hash_sha256)`
  - Purpose: tracks raw file ingestion and coverage metadata

## Bulk Snapshot Tables (SCD Snapshot Facts)
All bulk snapshot tables are keyed by `(account_id, snapshot_date, <entity_id>)`.

- `bulk_portfolios`
  - Key: `(account_id, snapshot_date, portfolio_id)`

- `bulk_campaigns`
  - Key: `(account_id, snapshot_date, campaign_id)`

- `bulk_ad_groups`
  - Key: `(account_id, snapshot_date, ad_group_id)`

- `bulk_targets`
  - Key: `(account_id, snapshot_date, target_id)`

- `bulk_placements`
  - Key: `(account_id, snapshot_date, campaign_id, placement_code)`

## Name History Tables (Incremental SCD)
Name history tables capture renames over time.

- `campaign_name_history`
  - Key: `(account_id, campaign_id, valid_from)`

- `ad_group_name_history`
  - Key: `(account_id, ad_group_id, valid_from)`

- `portfolio_name_history`
  - Key: `(account_id, portfolio_id, valid_from)`

## Latest Wins / Overwrite Rules
- Snapshot data is stored per `snapshot_date`.
- If multiple files cover the same date range, the newest export (or latest snapshot) is selected during ingestion.
- Ingestion should upsert into the bulk tables using the uniqueness keys above, treating the selected file as the canonical snapshot for that date.
- Name history rows are appended only when a normalized name changes; otherwise the existing row remains open.

## Indexes
- `bulk_campaigns (account_id, snapshot_date, campaign_name_norm)`
- `campaign_name_history (account_id, name_norm)`
- `ad_group_name_history (account_id, campaign_id, name_norm)`
