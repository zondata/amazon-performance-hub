-- Replace partial unique index with standard unique index so PostgREST/Supabase upsert can use onConflict=account_id,dedupe_key
drop index if exists public.log_changes_account_dedupe_key_uidx;

create unique index if not exists log_changes_account_dedupe_key_uidx
  on public.log_changes(account_id, dedupe_key);
