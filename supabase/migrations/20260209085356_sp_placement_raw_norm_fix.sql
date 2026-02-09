-- Fix: add placement_raw_norm and update uniqueness/indexing for placement raw.
-- (Previously skipped because old migration filenames didn't match Supabase pattern.)

ALTER TABLE sp_placement_daily_raw
  ADD COLUMN IF NOT EXISTS placement_raw_norm text;

UPDATE sp_placement_daily_raw
SET placement_raw_norm = lower(trim(placement_raw))
WHERE placement_raw_norm IS NULL;

ALTER TABLE sp_placement_daily_raw
  ALTER COLUMN placement_raw_norm SET NOT NULL;

ALTER TABLE sp_placement_daily_raw
  DROP CONSTRAINT IF EXISTS sp_placement_daily_raw_uq;

ALTER TABLE sp_placement_daily_raw
  ADD CONSTRAINT sp_placement_daily_raw_uq
  UNIQUE (account_id, date, campaign_name_norm, placement_code, placement_raw_norm, exported_at);

CREATE INDEX IF NOT EXISTS sp_placement_daily_raw_ix_acct_campaign_place_raw
  ON sp_placement_daily_raw (account_id, campaign_name_norm, placement_code, placement_raw_norm);
