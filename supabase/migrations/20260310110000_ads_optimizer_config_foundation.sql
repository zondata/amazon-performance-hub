create table if not exists public.ads_optimizer_rule_packs (
  rule_pack_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  channel text not null,
  scope_type text not null,
  scope_value text null,
  name text not null,
  description text null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_optimizer_rule_packs_channel_chk
    check (channel in ('sp')),
  constraint ads_optimizer_rule_packs_scope_type_chk
    check (scope_type in ('account', 'product')),
  constraint ads_optimizer_rule_packs_scope_value_chk
    check (
      (scope_type = 'account' and scope_value is null)
      or (scope_type = 'product' and scope_value is not null)
    ),
  constraint ads_optimizer_rule_packs_name_chk
    check (char_length(btrim(name)) > 0)
);

create unique index if not exists ads_optimizer_rule_packs_scope_unique_idx
  on public.ads_optimizer_rule_packs (
    account_id,
    marketplace,
    channel,
    scope_type,
    coalesce(scope_value, '')
  );

create index if not exists ads_optimizer_rule_packs_scope_archived_updated_idx
  on public.ads_optimizer_rule_packs (
    account_id,
    marketplace,
    channel,
    scope_type,
    is_archived,
    updated_at desc
  );

create table if not exists public.ads_optimizer_rule_pack_versions (
  rule_pack_version_id uuid primary key default gen_random_uuid(),
  rule_pack_id uuid not null
    references public.ads_optimizer_rule_packs(rule_pack_id) on delete cascade,
  version_label text not null,
  status text not null,
  change_summary text not null,
  change_payload_json jsonb not null default '{}'::jsonb,
  created_from_version_id uuid null
    references public.ads_optimizer_rule_pack_versions(rule_pack_version_id) on delete set null,
  created_at timestamptz not null default now(),
  activated_at timestamptz null,
  archived_at timestamptz null,
  constraint ads_optimizer_rule_pack_versions_status_chk
    check (status in ('draft', 'active', 'archived')),
  constraint ads_optimizer_rule_pack_versions_version_label_chk
    check (char_length(btrim(version_label)) > 0),
  constraint ads_optimizer_rule_pack_versions_change_summary_chk
    check (char_length(btrim(change_summary)) > 0),
  constraint ads_optimizer_rule_pack_versions_state_metadata_chk
    check (
      (status = 'draft' and activated_at is null and archived_at is null)
      or (status = 'active' and activated_at is not null and archived_at is null)
      or (status = 'archived' and archived_at is not null)
    )
);

create unique index if not exists ads_optimizer_rule_pack_versions_active_unique_idx
  on public.ads_optimizer_rule_pack_versions (rule_pack_id)
  where status = 'active';

create unique index if not exists ads_optimizer_rule_pack_versions_label_unique_idx
  on public.ads_optimizer_rule_pack_versions (rule_pack_id, version_label);

create index if not exists ads_optimizer_rule_pack_versions_rule_pack_created_idx
  on public.ads_optimizer_rule_pack_versions (rule_pack_id, created_at desc);

create index if not exists ads_optimizer_rule_pack_versions_status_activated_idx
  on public.ads_optimizer_rule_pack_versions (status, activated_at desc nulls last);

create table if not exists public.ads_optimizer_product_settings (
  product_id uuid primary key
    references public.products(product_id) on delete cascade,
  account_id text not null,
  marketplace text not null,
  archetype text not null,
  optimizer_enabled boolean not null default false,
  default_objective_mode text null,
  rule_pack_version_id uuid not null
    references public.ads_optimizer_rule_pack_versions(rule_pack_version_id) on delete restrict,
  strategic_notes text null,
  guardrail_overrides_json jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_optimizer_product_settings_archetype_chk
    check (archetype in ('design_led', 'visibility_led', 'hybrid'))
);

create index if not exists ads_optimizer_product_settings_scope_version_idx
  on public.ads_optimizer_product_settings (
    account_id,
    marketplace,
    rule_pack_version_id
  );

create index if not exists ads_optimizer_product_settings_updated_idx
  on public.ads_optimizer_product_settings (
    account_id,
    marketplace,
    updated_at desc
  );

create table if not exists public.ads_optimizer_manual_overrides (
  manual_override_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  product_id uuid not null
    references public.products(product_id) on delete cascade,
  override_key text not null,
  override_value_json jsonb not null default '{}'::jsonb,
  notes text null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz null,
  constraint ads_optimizer_manual_overrides_key_chk
    check (char_length(btrim(override_key)) > 0),
  constraint ads_optimizer_manual_overrides_archive_metadata_chk
    check ((is_archived = false and archived_at is null) or (is_archived = true and archived_at is not null))
);

create unique index if not exists ads_optimizer_manual_overrides_active_unique_idx
  on public.ads_optimizer_manual_overrides (product_id, override_key)
  where is_archived = false;

create index if not exists ads_optimizer_manual_overrides_scope_created_idx
  on public.ads_optimizer_manual_overrides (
    account_id,
    marketplace,
    product_id,
    created_at desc
  );

create or replace function public.ads_optimizer_rule_pack_allowed(p_rule_pack_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.ads_optimizer_rule_packs p
    where p.rule_pack_id = p_rule_pack_id
      and public.logbook_account_scope_allowed(p.account_id, p.marketplace)
  );
$$;

create or replace function public.ads_optimizer_rule_pack_version_immutable()
returns trigger
language plpgsql
as $$
begin
  if (
    (to_jsonb(new) - 'status' - 'activated_at' - 'archived_at')
    <>
    (to_jsonb(old) - 'status' - 'activated_at' - 'archived_at')
  ) then
    raise exception 'ads_optimizer_rule_pack_versions are immutable except for status, activated_at, archived_at';
  end if;
  return new;
end;
$$;

drop trigger if exists ads_optimizer_rule_pack_versions_immutable_tg
  on public.ads_optimizer_rule_pack_versions;
create trigger ads_optimizer_rule_pack_versions_immutable_tg
  before update on public.ads_optimizer_rule_pack_versions
  for each row
  execute function public.ads_optimizer_rule_pack_version_immutable();

alter table public.ads_optimizer_rule_packs enable row level security;
alter table public.ads_optimizer_rule_pack_versions enable row level security;
alter table public.ads_optimizer_product_settings enable row level security;
alter table public.ads_optimizer_manual_overrides enable row level security;

drop policy if exists ads_optimizer_rule_packs_select on public.ads_optimizer_rule_packs;
create policy ads_optimizer_rule_packs_select
  on public.ads_optimizer_rule_packs
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_rule_packs_insert on public.ads_optimizer_rule_packs;
create policy ads_optimizer_rule_packs_insert
  on public.ads_optimizer_rule_packs
  for insert
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_rule_packs_update on public.ads_optimizer_rule_packs;
create policy ads_optimizer_rule_packs_update
  on public.ads_optimizer_rule_packs
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_rule_packs_delete on public.ads_optimizer_rule_packs;
create policy ads_optimizer_rule_packs_delete
  on public.ads_optimizer_rule_packs
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_rule_pack_versions_select on public.ads_optimizer_rule_pack_versions;
create policy ads_optimizer_rule_pack_versions_select
  on public.ads_optimizer_rule_pack_versions
  for select
  using (public.ads_optimizer_rule_pack_allowed(rule_pack_id));

drop policy if exists ads_optimizer_rule_pack_versions_insert on public.ads_optimizer_rule_pack_versions;
create policy ads_optimizer_rule_pack_versions_insert
  on public.ads_optimizer_rule_pack_versions
  for insert
  with check (
    public.ads_optimizer_rule_pack_allowed(rule_pack_id)
    and (
      created_from_version_id is null
      or exists (
        select 1
        from public.ads_optimizer_rule_pack_versions v
        where v.rule_pack_version_id = created_from_version_id
          and public.ads_optimizer_rule_pack_allowed(v.rule_pack_id)
      )
    )
  );

drop policy if exists ads_optimizer_rule_pack_versions_update on public.ads_optimizer_rule_pack_versions;
create policy ads_optimizer_rule_pack_versions_update
  on public.ads_optimizer_rule_pack_versions
  for update
  using (public.ads_optimizer_rule_pack_allowed(rule_pack_id))
  with check (
    public.ads_optimizer_rule_pack_allowed(rule_pack_id)
    and (
      created_from_version_id is null
      or exists (
        select 1
        from public.ads_optimizer_rule_pack_versions v
        where v.rule_pack_version_id = created_from_version_id
          and public.ads_optimizer_rule_pack_allowed(v.rule_pack_id)
      )
    )
  );

drop policy if exists ads_optimizer_rule_pack_versions_delete on public.ads_optimizer_rule_pack_versions;
create policy ads_optimizer_rule_pack_versions_delete
  on public.ads_optimizer_rule_pack_versions
  for delete
  using (public.ads_optimizer_rule_pack_allowed(rule_pack_id));

drop policy if exists ads_optimizer_product_settings_select on public.ads_optimizer_product_settings;
create policy ads_optimizer_product_settings_select
  on public.ads_optimizer_product_settings
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_product_settings_insert on public.ads_optimizer_product_settings;
create policy ads_optimizer_product_settings_insert
  on public.ads_optimizer_product_settings
  for insert
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and exists (
      select 1
      from public.products p
      where p.product_id = ads_optimizer_product_settings.product_id
        and p.account_id = ads_optimizer_product_settings.account_id
        and p.marketplace = ads_optimizer_product_settings.marketplace
    )
    and exists (
      select 1
      from public.ads_optimizer_rule_pack_versions v
      join public.ads_optimizer_rule_packs p
        on p.rule_pack_id = v.rule_pack_id
      where v.rule_pack_version_id = ads_optimizer_product_settings.rule_pack_version_id
        and p.account_id = ads_optimizer_product_settings.account_id
        and p.marketplace = ads_optimizer_product_settings.marketplace
    )
  );

drop policy if exists ads_optimizer_product_settings_update on public.ads_optimizer_product_settings;
create policy ads_optimizer_product_settings_update
  on public.ads_optimizer_product_settings
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and exists (
      select 1
      from public.products p
      where p.product_id = ads_optimizer_product_settings.product_id
        and p.account_id = ads_optimizer_product_settings.account_id
        and p.marketplace = ads_optimizer_product_settings.marketplace
    )
    and exists (
      select 1
      from public.ads_optimizer_rule_pack_versions v
      join public.ads_optimizer_rule_packs p
        on p.rule_pack_id = v.rule_pack_id
      where v.rule_pack_version_id = ads_optimizer_product_settings.rule_pack_version_id
        and p.account_id = ads_optimizer_product_settings.account_id
        and p.marketplace = ads_optimizer_product_settings.marketplace
    )
  );

drop policy if exists ads_optimizer_product_settings_delete on public.ads_optimizer_product_settings;
create policy ads_optimizer_product_settings_delete
  on public.ads_optimizer_product_settings
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_manual_overrides_select on public.ads_optimizer_manual_overrides;
create policy ads_optimizer_manual_overrides_select
  on public.ads_optimizer_manual_overrides
  for select
  using (public.logbook_account_scope_allowed(account_id, marketplace));

drop policy if exists ads_optimizer_manual_overrides_insert on public.ads_optimizer_manual_overrides;
create policy ads_optimizer_manual_overrides_insert
  on public.ads_optimizer_manual_overrides
  for insert
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and exists (
      select 1
      from public.products p
      where p.product_id = ads_optimizer_manual_overrides.product_id
        and p.account_id = ads_optimizer_manual_overrides.account_id
        and p.marketplace = ads_optimizer_manual_overrides.marketplace
    )
  );

drop policy if exists ads_optimizer_manual_overrides_update on public.ads_optimizer_manual_overrides;
create policy ads_optimizer_manual_overrides_update
  on public.ads_optimizer_manual_overrides
  for update
  using (public.logbook_account_scope_allowed(account_id, marketplace))
  with check (
    public.logbook_account_scope_allowed(account_id, marketplace)
    and exists (
      select 1
      from public.products p
      where p.product_id = ads_optimizer_manual_overrides.product_id
        and p.account_id = ads_optimizer_manual_overrides.account_id
        and p.marketplace = ads_optimizer_manual_overrides.marketplace
    )
  );

drop policy if exists ads_optimizer_manual_overrides_delete on public.ads_optimizer_manual_overrides;
create policy ads_optimizer_manual_overrides_delete
  on public.ads_optimizer_manual_overrides
  for delete
  using (public.logbook_account_scope_allowed(account_id, marketplace));
