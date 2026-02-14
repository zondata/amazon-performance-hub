-- logbook: convert product_id to text (ASIN) by removing uuid FK first

alter table public.log_change_entities
  drop constraint if exists log_change_entities_product_id_fkey;

alter table public.log_change_entities
  alter column product_id type text
  using product_id::text;

create index if not exists log_change_entities_product_id_idx
  on public.log_change_entities(product_id);
