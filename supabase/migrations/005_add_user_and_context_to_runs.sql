-- Add user_id and pitch_context to pitch_runs table for authenticated practice sessions
ALTER TABLE pitch_runs
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pitch_context text;

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_pitch_runs_user_id ON pitch_runs(user_id);

-- Note: session_id is still used for anonymous /try runs
-- user_id is set for authenticated /app/practice runs

