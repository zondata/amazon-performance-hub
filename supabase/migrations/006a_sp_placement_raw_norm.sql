-- Add normalized raw placement field so we can keep distinct placement labels
-- (e.g., "Rest of Search" vs "Rest of search on Amazon") without unique-key collisions.

ALTER TABLE sp_placement_daily_raw
  ADD COLUMN IF NOT EXISTS placement_raw_norm text;

-- Backfill existing rows (if any)
UPDATE sp_placement_daily_raw
SET placement_raw_norm = lower(trim(placement_raw))
WHERE placement_raw_norm IS NULL;

ALTER TABLE sp_placement_daily_raw
  ALTER COLUMN placement_raw_norm SET NOT NULL;

-- Replace unique constraint to include placement_raw_norm
ALTER TABLE sp_placement_daily_raw
  DROP CONSTRAINT IF EXISTS sp_placement_daily_raw_uq;

ALTER TABLE sp_placement_daily_raw
  ADD CONSTRAINT sp_placement_daily_raw_uq
  UNIQUE (account_id, date, campaign_name_norm, placement_code, placement_raw_norm, exported_at);

-- Helpful index
CREATE INDEX IF NOT EXISTS sp_placement_daily_raw_ix_acct_campaign_place_raw
  ON sp_placement_daily_raw (account_id, campaign_name_norm, placement_code, placement_raw_norm);
