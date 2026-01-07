-- Allow audio_path to be NULL temporarily during upload
-- This supports the new direct-to-storage upload flow where audio_path
-- is set after upload completes via /api/uploads/complete
ALTER TABLE pitch_runs
ALTER COLUMN audio_path DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN pitch_runs.audio_path IS 'Path to audio file in storage. Set to NULL initially, populated when upload completes.';

