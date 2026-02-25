create table if not exists public.log_product_kiv_items (
  kiv_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  asin_norm text not null,
  created_at timestamptz not null default now(),
  created_by text null,
  status text not null default 'open',
  title text not null,
  details text null,
  source text not null default 'ai',
  source_experiment_id uuid null
    references public.log_experiments(experiment_id) on delete set null,
  tags text[] not null default '{}'::text[],
  priority int null,
  due_date date null,
  resolved_at timestamptz null,
  resolution_notes text null,
  constraint log_product_kiv_items_status_chk check (status in ('open', 'done', 'dismissed')),
  constraint log_product_kiv_items_source_chk check (source in ('ai', 'manual'))
);

create index if not exists log_product_kiv_items_scope_status_created_idx
  on public.log_product_kiv_items (account_id, marketplace, asin_norm, status, created_at desc);

create index if not exists log_product_kiv_items_source_experiment_idx
  on public.log_product_kiv_items (source_experiment_id);

create index if not exists log_product_kiv_items_open_title_idx
  on public.log_product_kiv_items (account_id, marketplace, asin_norm, lower(title))
  where status = 'open';

create table if not exists public.log_driver_campaign_intents (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  asin_norm text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text null,
  updated_by text null,
  channel text not null,
  campaign_id text not null,
  intent text not null,
  is_driver boolean not null default true,
  notes text null,
  constraints_json jsonb not null default '{}'::jsonb,
  constraint log_driver_campaign_intents_channel_chk check (channel in ('sp', 'sb', 'sd')),
  unique (account_id, marketplace, asin_norm, channel, campaign_id)
);

create index if not exists log_driver_campaign_intents_scope_idx
  on public.log_driver_campaign_intents (account_id, marketplace, asin_norm, updated_at desc);

create or replace function public.logbook_account_scope_allowed(p_account_id text, p_marketplace text)
returns boolean
language sql
stable
as $$
  select
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or (
      nullif(current_setting('request.jwt.claim.account_id', true), '') is not null
      and p_account_id = current_setting('request.jwt.claim.account_id', true)
      and (
        nullif(current_setting('request.jwt.claim.marketplace', true), '') is null
        or p_marketplace = current_setting('request.jwt.claim.marketplace', true)
      )
    );
$$;

alter table public.log_product_kiv_items enable row level security;
alter table public.log_driver_campaign_intents enable row level security;

drop policy if exists log_product_kiv_items_select on public.log_product_kiv_items;
create policy log_product_kiv_items_select
  on public.log_product_kiv_items
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists log_product_kiv_items_insert on public.log_product_kiv_items;
create policy log_product_kiv_items_insert
  on public.log_product_kiv_items
  for insert
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and (
      source_experiment_id is null
      or public.logbook_experiment_access_allowed(source_experiment_id)
    )
  );

drop policy if exists log_product_kiv_items_update on public.log_product_kiv_items;
create policy log_product_kiv_items_update
  on public.log_product_kiv_items
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and (
      source_experiment_id is null
      or public.logbook_experiment_access_allowed(source_experiment_id)
    )
  );

drop policy if exists log_product_kiv_items_delete on public.log_product_kiv_items;
create policy log_product_kiv_items_delete
  on public.log_product_kiv_items
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists log_driver_campaign_intents_select on public.log_driver_campaign_intents;
create policy log_driver_campaign_intents_select
  on public.log_driver_campaign_intents
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists log_driver_campaign_intents_insert on public.log_driver_campaign_intents;
create policy log_driver_campaign_intents_insert
  on public.log_driver_campaign_intents
  for insert
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists log_driver_campaign_intents_update on public.log_driver_campaign_intents;
create policy log_driver_campaign_intents_update
  on public.log_driver_campaign_intents
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists log_driver_campaign_intents_delete on public.log_driver_campaign_intents;
create policy log_driver_campaign_intents_delete
  on public.log_driver_campaign_intents
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));
