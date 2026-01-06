-- Add timing analysis fields to pitch_runs
ALTER TABLE pitch_runs
ADD COLUMN IF NOT EXISTS word_count integer,
ADD COLUMN IF NOT EXISTS words_per_minute numeric;





