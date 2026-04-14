alter table uploads drop constraint if exists uploads_source_type_chk;

alter table uploads add constraint uploads_source_type_chk check (source_type in (
  'bulk',
  'sp_campaign',
  'sp_targeting',
  'sp_placement',
  'sp_stis',
  'sp_advertised_product',
  'sb_campaign',
  'sb_campaign_placement',
  'sb_keyword',
  'sb_stis',
  'sd_campaign',
  'sd_advertised_product',
  'sd_targeting',
  'sd_matched_target',
  'sd_purchased_product',
  'si_sales_trend',
  'sqp',
  'search_terms',
  'h10_keyword_tracker'
));

create table if not exists search_terms_market_weekly_raw (
  upload_id uuid not null references uploads(upload_id) on delete cascade,
  account_id text not null references accounts(account_id),
  marketplace text not null,
  marketplace_id text not null,
  week_start date not null,
  week_end date not null,
  department_name_raw text not null,
  department_name_norm text not null,
  search_term_raw text not null,
  search_term_norm text not null,
  search_frequency_rank int not null,
  clicked_asin text not null,
  click_share_rank int not null,
  click_share numeric not null,
  conversion_share numeric not null,
  exported_at timestamptz not null,

  constraint search_terms_market_weekly_raw_uq unique (
    account_id,
    marketplace,
    marketplace_id,
    week_end,
    department_name_norm,
    search_term_norm,
    clicked_asin,
    click_share_rank,
    exported_at
  )
);

create index if not exists search_terms_market_weekly_raw_account_market_week_end_idx
  on search_terms_market_weekly_raw (account_id, marketplace, week_end);

create index if not exists search_terms_market_weekly_raw_account_market_term_idx
  on search_terms_market_weekly_raw (account_id, marketplace, search_term_norm);

create index if not exists search_terms_market_weekly_raw_account_market_dept_idx
  on search_terms_market_weekly_raw (account_id, marketplace, department_name_norm);

create index if not exists search_terms_market_weekly_raw_upload_id_idx
  on search_terms_market_weekly_raw (upload_id);
