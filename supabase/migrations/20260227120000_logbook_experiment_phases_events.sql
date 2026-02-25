create table if not exists public.log_experiment_phases (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null
    references public.log_experiments(experiment_id) on delete cascade,
  run_id text not null,
  title text null,
  notes text null,
  effective_date date null,
  uploaded_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by text null,
  unique (experiment_id, run_id)
);

create table if not exists public.log_experiment_events (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null
    references public.log_experiments(experiment_id) on delete cascade,
  run_id text null,
  phase_id uuid null
    references public.log_experiment_phases(id) on delete set null,
  event_type text not null,
  event_date date null,
  occurred_at timestamptz not null default now(),
  payload_json jsonb not null default '{}'::jsonb,
  created_by text null,
  constraint log_experiment_events_event_type_chk check (
    event_type in (
      'uploaded_to_amazon',
      'guardrail_breach',
      'manual_intervention',
      'stop_loss',
      'rollback'
    )
  )
);

create index if not exists log_experiment_phases_experiment_id_idx
  on public.log_experiment_phases (experiment_id);

create index if not exists log_experiment_phases_effective_date_idx
  on public.log_experiment_phases (experiment_id, effective_date desc);

create index if not exists log_experiment_events_experiment_occurred_idx
  on public.log_experiment_events (experiment_id, occurred_at desc);

create index if not exists log_experiment_events_run_id_idx
  on public.log_experiment_events (experiment_id, run_id, occurred_at desc);

create or replace function public.logbook_experiment_access_allowed(p_experiment_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.log_experiments e
    where e.experiment_id = p_experiment_id
      and (
        current_setting('request.jwt.claim.role', true) = 'service_role'
        or (
          nullif(current_setting('request.jwt.claim.account_id', true), '') is not null
          and e.account_id = current_setting('request.jwt.claim.account_id', true)
          and (
            nullif(current_setting('request.jwt.claim.marketplace', true), '') is null
            or e.marketplace = current_setting('request.jwt.claim.marketplace', true)
          )
        )
      )
  );
$$;

alter table public.log_experiment_phases enable row level security;
alter table public.log_experiment_events enable row level security;

drop policy if exists log_experiment_phases_select on public.log_experiment_phases;
create policy log_experiment_phases_select
  on public.log_experiment_phases
  for select
  using (public.logbook_experiment_access_allowed(experiment_id));

drop policy if exists log_experiment_phases_insert on public.log_experiment_phases;
create policy log_experiment_phases_insert
  on public.log_experiment_phases
  for insert
  with check (public.logbook_experiment_access_allowed(experiment_id));

drop policy if exists log_experiment_phases_update on public.log_experiment_phases;
create policy log_experiment_phases_update
  on public.log_experiment_phases
  for update
  using (public.logbook_experiment_access_allowed(experiment_id))
  with check (public.logbook_experiment_access_allowed(experiment_id));

drop policy if exists log_experiment_phases_delete on public.log_experiment_phases;
create policy log_experiment_phases_delete
  on public.log_experiment_phases
  for delete
  using (public.logbook_experiment_access_allowed(experiment_id));

drop policy if exists log_experiment_events_select on public.log_experiment_events;
create policy log_experiment_events_select
  on public.log_experiment_events
  for select
  using (public.logbook_experiment_access_allowed(experiment_id));

drop policy if exists log_experiment_events_insert on public.log_experiment_events;
create policy log_experiment_events_insert
  on public.log_experiment_events
  for insert
  with check (public.logbook_experiment_access_allowed(experiment_id));

drop policy if exists log_experiment_events_update on public.log_experiment_events;
create policy log_experiment_events_update
  on public.log_experiment_events
  for update
  using (public.logbook_experiment_access_allowed(experiment_id))
  with check (public.logbook_experiment_access_allowed(experiment_id));

drop policy if exists log_experiment_events_delete on public.log_experiment_events;
create policy log_experiment_events_delete
  on public.log_experiment_events
  for delete
  using (public.logbook_experiment_access_allowed(experiment_id));
