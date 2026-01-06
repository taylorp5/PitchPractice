-- Create user_rubrics table for user-owned rubrics
CREATE TABLE IF NOT EXISTS user_rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  target_duration_seconds integer,
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_user_rubrics_user_id ON user_rubrics(user_id);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_user_rubrics_created_at ON user_rubrics(created_at DESC);

-- Enable RLS
ALTER TABLE user_rubrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own rubrics
CREATE POLICY "Users can view their own rubrics"
  ON user_rubrics
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own rubrics
CREATE POLICY "Users can insert their own rubrics"
  ON user_rubrics
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own rubrics
CREATE POLICY "Users can update their own rubrics"
  ON user_rubrics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own rubrics
CREATE POLICY "Users can delete their own rubrics"
  ON user_rubrics
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_rubrics_updated_at
  BEFORE UPDATE ON user_rubrics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


