create table if not exists public.ui_page_settings (
  account_id text not null references public.accounts(account_id),
  marketplace text not null,
  page_key text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (account_id, marketplace, page_key)
);
