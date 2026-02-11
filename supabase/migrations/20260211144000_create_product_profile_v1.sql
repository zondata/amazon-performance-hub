-- Product Profile v1 schema

-- Enum types
DO $$
BEGIN
  CREATE TYPE product_status AS ENUM ('active', 'paused', 'discontinued');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE currency_code AS ENUM ('CNY', 'USD', 'MYR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Extensions
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Tables
CREATE TABLE IF NOT EXISTS products (
  product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  marketplace text NOT NULL,
  asin text NOT NULL,
  status product_status NOT NULL DEFAULT 'active',
  brand text NULL,
  title text NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (account_id, marketplace, asin)
);

CREATE TABLE IF NOT EXISTS product_skus (
  sku_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(product_id) ON DELETE CASCADE,
  account_id text NOT NULL,
  marketplace text NOT NULL,
  sku text NOT NULL,
  status product_status NOT NULL DEFAULT 'active',
  is_bundle boolean NOT NULL DEFAULT false,
  bundle_note text NULL,
  inherits_cost_from_sku_id uuid NULL REFERENCES product_skus(sku_id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (account_id, marketplace, sku)
);

CREATE INDEX IF NOT EXISTS product_skus_product_id_created_at_idx
  ON product_skus (product_id, created_at);

CREATE TABLE IF NOT EXISTS product_cost_history (
  cost_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_id uuid REFERENCES product_skus(sku_id) ON DELETE CASCADE,
  valid_from date NOT NULL,
  valid_to date NULL,
  currency currency_code NOT NULL,
  landed_cost_per_unit numeric(12,4) NOT NULL,
  supplier_cost numeric(12,4) NULL,
  packaging_cost numeric(12,4) NULL,
  domestic_ship_cost numeric(12,4) NULL,
  intl_ship_cost numeric(12,4) NULL,
  duty_tax_cost numeric(12,4) NULL,
  prep_cost numeric(12,4) NULL,
  assembly_cost numeric(12,4) NULL,
  other_cost numeric(12,4) NULL,
  breakdown_lines jsonb NULL,
  notes text NULL,
  created_at timestamptz DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE INDEX IF NOT EXISTS product_cost_history_sku_id_valid_from_idx
  ON product_cost_history (sku_id, valid_from DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_cost_history_no_overlap'
  ) THEN
    ALTER TABLE product_cost_history
      ADD CONSTRAINT product_cost_history_no_overlap
      EXCLUDE USING gist (
        sku_id WITH =,
        daterange(valid_from, COALESCE(valid_to, 'infinity'::date), '[]') WITH &&
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS product_profile (
  product_id uuid PRIMARY KEY REFERENCES products(product_id) ON DELETE CASCADE,
  profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz DEFAULT now()
);
