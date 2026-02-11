-- Keyword Grouping v1 schema

CREATE TABLE IF NOT EXISTS dim_keyword (
  keyword_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marketplace text NOT NULL,
  keyword_raw text NOT NULL,
  keyword_norm text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (marketplace, keyword_norm)
);

CREATE INDEX IF NOT EXISTS dim_keyword_keyword_norm_idx
  ON dim_keyword (keyword_norm);

CREATE TABLE IF NOT EXISTS keyword_group_sets (
  group_set_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_exclusive boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, name)
);

CREATE INDEX IF NOT EXISTS keyword_group_sets_product_active_idx
  ON keyword_group_sets (product_id, is_active);

CREATE TABLE IF NOT EXISTS keyword_groups (
  group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_set_id uuid NOT NULL REFERENCES keyword_group_sets(group_set_id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_set_id, name)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'keyword_groups_group_set_uq'
  ) THEN
    ALTER TABLE keyword_groups
      ADD CONSTRAINT keyword_groups_group_set_uq
      UNIQUE (group_id, group_set_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS keyword_group_members (
  member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES keyword_groups(group_id) ON DELETE CASCADE,
  group_set_id uuid NOT NULL REFERENCES keyword_group_sets(group_set_id) ON DELETE CASCADE,
  keyword_id uuid NOT NULL REFERENCES dim_keyword(keyword_id) ON DELETE CASCADE,
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, keyword_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'keyword_group_members_group_set_fk'
  ) THEN
    ALTER TABLE keyword_group_members
      ADD CONSTRAINT keyword_group_members_group_set_fk
      FOREIGN KEY (group_id, group_set_id)
      REFERENCES keyword_groups(group_id, group_set_id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS keyword_group_members_set_keyword_idx
  ON keyword_group_members (group_set_id, keyword_id);

CREATE OR REPLACE FUNCTION enforce_keyword_group_exclusive()
RETURNS trigger AS $$
DECLARE
  is_exclusive_set boolean;
BEGIN
  SELECT kgs.is_exclusive
  INTO is_exclusive_set
  FROM keyword_group_sets kgs
  WHERE kgs.group_set_id = NEW.group_set_id;

  IF is_exclusive_set THEN
    IF EXISTS (
      SELECT 1
      FROM keyword_group_members kgm
      WHERE kgm.group_set_id = NEW.group_set_id
        AND kgm.keyword_id = NEW.keyword_id
        AND kgm.group_id <> NEW.group_id
    ) THEN
      RAISE EXCEPTION 'Exclusive group set: keyword already assigned to another group in this set.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_keyword_group_exclusive ON keyword_group_members;
CREATE TRIGGER trg_enforce_keyword_group_exclusive
BEFORE INSERT OR UPDATE ON keyword_group_members
FOR EACH ROW
EXECUTE FUNCTION enforce_keyword_group_exclusive();
