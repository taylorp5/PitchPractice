-- Create rubrics table first (referenced by pitch_runs)
CREATE TABLE IF NOT EXISTS rubrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  criteria jsonb NOT NULL,
  target_duration_seconds integer,
  max_duration_seconds integer,
  created_at timestamptz DEFAULT now()
);

-- Create pitch_runs table
CREATE TABLE IF NOT EXISTS pitch_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  title text,
  audio_path text NOT NULL,
  audio_seconds numeric,
  transcript text,
  analysis_json jsonb,
  status text NOT NULL DEFAULT 'uploaded',
  error_message text,
  rubric_id uuid REFERENCES rubrics(id)
);

-- Insert default rubric
INSERT INTO rubrics (name, description, criteria, target_duration_seconds, max_duration_seconds)
VALUES (
  'General Pitch (3–5 min)',
  'A general-purpose rubric for evaluating pitch presentations',
  '[
    {"name": "Hook/Opening", "description": "How engaging and attention-grabbing is the opening?"},
    {"name": "Clarity", "description": "Is the message clear and easy to understand?"},
    {"name": "Structure", "description": "Is the pitch well-organized and logical?"},
    {"name": "Conciseness", "description": "Does the pitch convey the message efficiently?"},
    {"name": "Confidence/Delivery", "description": "How confident and engaging is the delivery?"},
    {"name": "Call to Action", "description": "Is there a clear and compelling call to action?"}
  ]'::jsonb,
  240,
  360
);

-- Create index on session_id for faster queries
CREATE INDEX IF NOT EXISTS idx_pitch_runs_session_id ON pitch_runs(session_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_pitch_runs_status ON pitch_runs(status);

