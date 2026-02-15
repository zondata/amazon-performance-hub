alter table public.log_changes
  add column if not exists dedupe_key text;

create unique index if not exists log_changes_account_dedupe_key_uidx
  on public.log_changes(account_id, dedupe_key)
  where dedupe_key is not null;
