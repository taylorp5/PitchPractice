-- Add fields for custom rubrics (guiding_questions and context_summary)
-- These fields support the custom rubric builder feature

ALTER TABLE user_rubrics
ADD COLUMN IF NOT EXISTS guiding_questions jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS context_summary text;

-- Add comment for documentation
COMMENT ON COLUMN user_rubrics.guiding_questions IS 'Array of guiding questions for the rubric (stored as JSONB array)';
COMMENT ON COLUMN user_rubrics.context_summary IS 'Summary of pitch context and audience';





