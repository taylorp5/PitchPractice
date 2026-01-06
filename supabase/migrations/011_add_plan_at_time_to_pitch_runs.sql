-- Add plan_at_time column to pitch_runs table
-- This stores the user's plan at the time of analysis for accurate feature gating
ALTER TABLE pitch_runs
ADD COLUMN IF NOT EXISTS plan_at_time text CHECK (plan_at_time IN ('free', 'starter', 'coach', 'daypass'));

-- Add comment for documentation
COMMENT ON COLUMN pitch_runs.plan_at_time IS 'User plan at the time of analysis: free, starter, coach, or daypass';

-- Create index for filtering by plan
CREATE INDEX IF NOT EXISTS idx_pitch_runs_plan_at_time ON pitch_runs(plan_at_time);

