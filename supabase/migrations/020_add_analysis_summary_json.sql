-- Add summary analysis column for fast score views
ALTER TABLE public.pitch_runs
ADD COLUMN IF NOT EXISTS analysis_summary_json jsonb;
