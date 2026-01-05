-- Add duration_ms column to pitch_runs table
ALTER TABLE pitch_runs 
ADD COLUMN IF NOT EXISTS duration_ms integer;

-- Add index for faster queries on duration_ms
CREATE INDEX IF NOT EXISTS idx_pitch_runs_duration_ms ON pitch_runs(duration_ms);

