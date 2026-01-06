-- Migration: Unified rubrics table for templates and custom rubrics
-- This migration updates the rubrics table to support both template and custom rubrics

-- Step 1: Add new columns to rubrics table
ALTER TABLE rubrics
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS rubric_json jsonb,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Step 2: Migrate existing data
-- Convert existing rubrics to templates with proper structure
UPDATE rubrics
SET 
  title = name,
  is_template = true,
  rubric_json = jsonb_build_object(
    'criteria', criteria,
    'guiding_questions', '[]'::jsonb,
    'scoring_scale', jsonb_build_object('min', 0, 'max', 10)
  ),
  updated_at = created_at
WHERE title IS NULL;

-- Step 3: Make title NOT NULL after migration (for new records)
-- We'll allow NULL temporarily for existing records, but enforce it for new ones via application logic

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_rubrics_user_id ON rubrics(user_id);
CREATE INDEX IF NOT EXISTS idx_rubrics_is_template ON rubrics(is_template);
CREATE INDEX IF NOT EXISTS idx_rubrics_created_at ON rubrics(created_at DESC);

-- Step 5: Enable RLS
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Templates are readable by everyone" ON rubrics;
DROP POLICY IF EXISTS "Custom rubrics are readable by owner" ON rubrics;
DROP POLICY IF EXISTS "Custom rubrics are writable by owner" ON rubrics;
DROP POLICY IF EXISTS "Users can insert custom rubrics" ON rubrics;
DROP POLICY IF EXISTS "Users can update custom rubrics" ON rubrics;
DROP POLICY IF EXISTS "Users can delete custom rubrics" ON rubrics;

-- Step 7: Create RLS policies

-- Policy: Templates are readable by everyone
CREATE POLICY "Templates are readable by everyone"
  ON rubrics
  FOR SELECT
  USING (is_template = true);

-- Policy: Custom rubrics are readable by owner
CREATE POLICY "Custom rubrics are readable by owner"
  ON rubrics
  FOR SELECT
  USING (
    is_template = false AND 
    (user_id = auth.uid() OR user_id IS NULL)
  );

-- Policy: Users can insert custom rubrics (with their user_id)
CREATE POLICY "Users can insert custom rubrics"
  ON rubrics
  FOR INSERT
  WITH CHECK (
    is_template = false AND 
    user_id = auth.uid()
  );

-- Policy: Users can update their own custom rubrics
CREATE POLICY "Users can update custom rubrics"
  ON rubrics
  FOR UPDATE
  USING (
    is_template = false AND 
    user_id = auth.uid()
  )
  WITH CHECK (
    is_template = false AND 
    user_id = auth.uid()
  );

-- Policy: Users can delete their own custom rubrics
CREATE POLICY "Users can delete custom rubrics"
  ON rubrics
  FOR DELETE
  USING (
    is_template = false AND 
    user_id = auth.uid()
  );

-- Step 8: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_rubrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Step 9: Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_rubrics_updated_at ON rubrics;
CREATE TRIGGER update_rubrics_updated_at
  BEFORE UPDATE ON rubrics
  FOR EACH ROW
  EXECUTE FUNCTION update_rubrics_updated_at();

-- Step 10: Seed template rubrics (only if they don't exist)
-- Elevator Pitch template
INSERT INTO rubrics (name, title, description, is_template, rubric_json, criteria, target_duration_seconds, max_duration_seconds)
SELECT 
  'Elevator Pitch',
  'Elevator Pitch',
  'A concise 30-60 second pitch to quickly communicate your idea',
  true,
  jsonb_build_object(
    'criteria', '[
      {"name": "Hook", "description": "Does the opening immediately capture attention?"},
      {"name": "Problem", "description": "Is the problem clearly and compellingly stated?"},
      {"name": "Solution", "description": "Is the solution clear and directly addresses the problem?"},
      {"name": "Value Proposition", "description": "Is the unique value clearly communicated?"},
      {"name": "Call to Action", "description": "Is there a clear next step or ask?"}
    ]'::jsonb,
    'guiding_questions', '[
      "What problem are you solving?",
      "Who is your target audience?",
      "What makes your solution unique?",
      "What do you want the listener to do next?"
    ]'::jsonb,
    'scoring_scale', jsonb_build_object('min', 0, 'max', 10)
  ),
  '[
    {"name": "Hook", "description": "Does the opening immediately capture attention?"},
    {"name": "Problem", "description": "Is the problem clearly and compellingly stated?"},
    {"name": "Solution", "description": "Is the solution clear and directly addresses the problem?"},
    {"name": "Value Proposition", "description": "Is the unique value clearly communicated?"},
    {"name": "Call to Action", "description": "Is there a clear next step or ask?"}
  ]'::jsonb,
  45,
  90
WHERE NOT EXISTS (
  SELECT 1 FROM rubrics WHERE name = 'Elevator Pitch' AND is_template = true
);

-- Class Intro template
INSERT INTO rubrics (name, title, description, is_template, rubric_json, criteria, target_duration_seconds, max_duration_seconds)
SELECT 
  'Class Intro',
  'Class Intro',
  'A brief introduction for a class or educational setting',
  true,
  jsonb_build_object(
    'criteria', '[
      {"name": "Name and Background", "description": "Is your name and relevant background clearly stated?"},
      {"name": "Relevance to Class", "description": "Do you explain why you are taking this class?"},
      {"name": "Goals", "description": "Are your learning goals or expectations clear?"},
      {"name": "Engagement", "description": "Is the introduction engaging and memorable?"},
      {"name": "Clarity", "description": "Is the message clear and easy to understand?"}
    ]'::jsonb,
    'guiding_questions', '[
      "What is your name and background?",
      "Why are you taking this class?",
      "What do you hope to learn or achieve?",
      "What unique perspective or experience do you bring?"
    ]'::jsonb,
    'scoring_scale', jsonb_build_object('min', 0, 'max', 10)
  ),
  '[
    {"name": "Name and Background", "description": "Is your name and relevant background clearly stated?"},
    {"name": "Relevance to Class", "description": "Do you explain why you are taking this class?"},
    {"name": "Goals", "description": "Are your learning goals or expectations clear?"},
    {"name": "Engagement", "description": "Is the introduction engaging and memorable?"},
    {"name": "Clarity", "description": "Is the message clear and easy to understand?"}
  ]'::jsonb,
  60,
  120
WHERE NOT EXISTS (
  SELECT 1 FROM rubrics WHERE name = 'Class Intro' AND is_template = true
);

-- Sales/Client Opener template
INSERT INTO rubrics (name, title, description, is_template, rubric_json, criteria, target_duration_seconds, max_duration_seconds)
SELECT 
  'Sales/Client Opener',
  'Sales/Client Opener',
  'An opening pitch for sales calls or client meetings',
  true,
  jsonb_build_object(
    'criteria', '[
      {"name": "Rapport Building", "description": "Do you establish rapport and connection?"},
      {"name": "Understanding Client Needs", "description": "Do you demonstrate understanding of the client''s situation?"},
      {"name": "Value Proposition", "description": "Is the value you can provide clearly communicated?"},
      {"name": "Credibility", "description": "Do you establish credibility and trust?"},
      {"name": "Engagement", "description": "Is the opening engaging and does it invite conversation?"},
      {"name": "Clear Next Steps", "description": "Are the next steps or agenda clear?"}
    ]'::jsonb,
    'guiding_questions', '[
      "What do you know about the client''s needs or challenges?",
      "What value can you provide to this client?",
      "What makes you or your solution credible?",
      "What do you want to accomplish in this meeting?"
    ]'::jsonb,
    'scoring_scale', jsonb_build_object('min', 0, 'max', 10)
  ),
  '[
    {"name": "Rapport Building", "description": "Do you establish rapport and connection?"},
    {"name": "Understanding Client Needs", "description": "Do you demonstrate understanding of the client''s situation?"},
    {"name": "Value Proposition", "description": "Is the value you can provide clearly communicated?"},
    {"name": "Credibility", "description": "Do you establish credibility and trust?"},
    {"name": "Engagement", "description": "Is the opening engaging and does it invite conversation?"},
    {"name": "Clear Next Steps", "description": "Are the next steps or agenda clear?"}
  ]'::jsonb,
  120,
  300
WHERE NOT EXISTS (
  SELECT 1 FROM rubrics WHERE name = 'Sales/Client Opener' AND is_template = true
);

-- Update existing "General Pitch" to be a template if it isn't already
UPDATE rubrics
SET 
  is_template = true,
  rubric_json = jsonb_build_object(
    'criteria', criteria,
    'guiding_questions', '[]'::jsonb,
    'scoring_scale', jsonb_build_object('min', 0, 'max', 10)
  )
WHERE name = 'General Pitch (3–5 min)' AND (is_template IS NULL OR is_template = false);

