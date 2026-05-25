-- Add dataset column to cycle2_skymap_sources and cycle2_skymap_schedule
-- to support multiple datasets (cycle2, gf) in the same tables.

-- 1. Add dataset columns with default 'cycle2' to backfill existing rows
ALTER TABLE cycle2_skymap_sources
  ADD COLUMN IF NOT EXISTS dataset varchar(32) NOT NULL DEFAULT 'cycle2';

ALTER TABLE cycle2_skymap_schedule
  ADD COLUMN IF NOT EXISTS dataset varchar(32) NOT NULL DEFAULT 'cycle2';

-- 2. Drop old single-column unique constraint on sources
ALTER TABLE cycle2_skymap_sources
  DROP CONSTRAINT IF EXISTS cycle2_skymap_sources_source_id_unique;

-- 3. Add composite unique constraint (dataset, source_id)
ALTER TABLE cycle2_skymap_sources
  ADD CONSTRAINT cycle2_skymap_sources_dataset_source_id_unique UNIQUE (dataset, source_id);

-- 4. Replace single-column indexes with composite ones
DROP INDEX IF EXISTS cycle2_skymap_sources_source_id_idx;
CREATE INDEX IF NOT EXISTS cycle2_skymap_sources_dataset_source_id_idx
  ON cycle2_skymap_sources (dataset, source_id);

DROP INDEX IF EXISTS cycle2_skymap_schedule_source_id_idx;
CREATE INDEX IF NOT EXISTS cycle2_skymap_schedule_dataset_source_id_idx
  ON cycle2_skymap_schedule (dataset, source_id);
