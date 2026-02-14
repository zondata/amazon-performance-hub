create table if not exists log_experiments (
  experiment_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  name text not null,
  objective text not null,
  hypothesis text null,
  evaluation_lag_days int null,
  evaluation_window_days int null,
  primary_metrics jsonb null,
  guardrails jsonb null,
  scope jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists log_changes (
  change_id uuid primary key default gen_random_uuid(),
  account_id text not null,
  marketplace text not null,
  occurred_at timestamptz not null default now(),
  channel text not null,
  change_type text not null,
  summary text not null,
  why text null,
  before_json jsonb null,
  after_json jsonb null,
  source text not null default 'manual',
  source_upload_id text null,
  created_at timestamptz not null default now()
);

create table if not exists log_change_entities (
  change_entity_id uuid primary key default gen_random_uuid(),
  change_id uuid not null references log_changes(change_id) on delete cascade,
  entity_type text not null,
  product_id uuid null references products(product_id) on delete set null,
  campaign_id text null,
  ad_group_id text null,
  target_id text null,
  keyword_id uuid null references dim_keyword(keyword_id) on delete set null,
  note text null,
  extra jsonb null,
  created_at timestamptz not null default now()
);

create table if not exists log_experiment_changes (
  experiment_change_id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references log_experiments(experiment_id) on delete cascade,
  change_id uuid not null references log_changes(change_id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (experiment_id, change_id)
);

create table if not exists log_evaluations (
  evaluation_id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references log_experiments(experiment_id) on delete cascade,
  account_id text not null,
  marketplace text not null,
  evaluated_at timestamptz not null default now(),
  window_start date null,
  window_end date null,
  metrics_json jsonb null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists log_changes_account_occurred_at_idx
  on log_changes (account_id, occurred_at desc);

create index if not exists log_change_entities_change_id_idx
  on log_change_entities (change_id);

create index if not exists log_change_entities_entity_campaign_idx
  on log_change_entities (entity_type, campaign_id);

create index if not exists log_change_entities_entity_target_idx
  on log_change_entities (entity_type, target_id);

create index if not exists log_change_entities_product_id_idx
  on log_change_entities (product_id);

create index if not exists log_experiment_changes_experiment_id_idx
  on log_experiment_changes (experiment_id);
