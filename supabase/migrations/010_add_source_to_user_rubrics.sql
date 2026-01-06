-- Add source column to user_rubrics table
-- Source can be: 'ai', 'uploaded', 'pasted', 'manual'
ALTER TABLE user_rubrics
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Add comment for documentation
COMMENT ON COLUMN user_rubrics.source IS 'How the rubric was created: ai, uploaded, pasted, or manual';

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_user_rubrics_source ON user_rubrics(source);

