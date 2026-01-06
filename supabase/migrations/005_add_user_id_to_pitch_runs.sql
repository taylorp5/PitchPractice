-- Add user_id column to pitch_runs table for authenticated users
ALTER TABLE pitch_runs 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_pitch_runs_user_id ON pitch_runs(user_id);

-- Add pitch_context column to store user's pitch context notes
ALTER TABLE pitch_runs
ADD COLUMN IF NOT EXISTS pitch_context text;


