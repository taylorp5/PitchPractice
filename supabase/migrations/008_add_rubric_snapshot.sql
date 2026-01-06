-- Add rubric_snapshot_json column to pitch_runs table
-- This stores a snapshot of the rubric used for analysis when rubric_json is provided
-- instead of creating a new rubric row in the rubrics table

ALTER TABLE pitch_runs
ADD COLUMN IF NOT EXISTS rubric_snapshot_json jsonb;

-- Add comment for documentation
COMMENT ON COLUMN pitch_runs.rubric_snapshot_json IS 'Snapshot of rubric JSON used for analysis when provided via rubric_json instead of rubric_id';

-- Add index for queries that filter by snapshot presence
CREATE INDEX IF NOT EXISTS idx_pitch_runs_has_snapshot ON pitch_runs((rubric_snapshot_json IS NOT NULL));

