# H10 Keyword Tracker Import Source Status Repair

Use this only if the H10 keyword tracker upload imported successfully but `import_source_status` stayed stale.

Scope:
- `account_id = 'sourbear'`
- `source_type = 'h10_keyword_tracker'`

Do not run this unless you have confirmed the target environment and have database access for that account.

```sql
with latest_upload as (
  select
    upload_id,
    original_filename,
    ingested_at
  from uploads
  where account_id = 'sourbear'
    and source_type = 'h10_keyword_tracker'
  order by ingested_at desc
  limit 1
),
raw_counts as (
  select
    lu.upload_id,
    count(*)::integer as row_count
  from latest_upload lu
  left join h10_keyword_tracker_raw raw
    on raw.upload_id = lu.upload_id
  group by lu.upload_id
)
insert into import_source_status (
  account_id,
  source_type,
  last_attempted_at,
  last_original_filename,
  last_upload_id,
  ingest_status,
  ingest_row_count,
  ingest_message,
  map_status,
  map_fact_rows,
  map_issue_rows,
  map_message,
  unresolved,
  updated_at
)
select
  'sourbear',
  'h10_keyword_tracker',
  lu.ingested_at,
  lu.original_filename,
  lu.upload_id,
  'ok',
  coalesce(rc.row_count, 0),
  null,
  'not_required',
  null,
  null,
  'No mapping step required for H10 keyword tracker.',
  false,
  now()
from latest_upload lu
left join raw_counts rc
  on rc.upload_id = lu.upload_id
on conflict (account_id, source_type)
do update set
  last_attempted_at = excluded.last_attempted_at,
  last_original_filename = excluded.last_original_filename,
  last_upload_id = excluded.last_upload_id,
  ingest_status = excluded.ingest_status,
  ingest_row_count = excluded.ingest_row_count,
  ingest_message = excluded.ingest_message,
  map_status = excluded.map_status,
  map_fact_rows = excluded.map_fact_rows,
  map_issue_rows = excluded.map_issue_rows,
  map_message = excluded.map_message,
  unresolved = excluded.unresolved,
  updated_at = excluded.updated_at;
```
