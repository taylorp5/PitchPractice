-- Migration: Create run_chunks table for Coach-only transcript checkpoints
-- This table stores chunk audio + transcript for iterative transcription during recording

-- Create run_chunks table
CREATE TABLE IF NOT EXISTS run_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES pitch_runs(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  start_ms integer NOT NULL,
  end_ms integer NOT NULL,
  audio_path text NOT NULL,
  transcript text,
  status text NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'transcribing', 'transcribed', 'error')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Add uniqueness constraint: one chunk per run per index
CREATE UNIQUE INDEX IF NOT EXISTS idx_run_chunks_run_id_chunk_index ON run_chunks(run_id, chunk_index);

-- Create index on run_id for faster queries
CREATE INDEX IF NOT EXISTS idx_run_chunks_run_id ON run_chunks(run_id);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_run_chunks_status ON run_chunks(status);

-- Enable RLS
ALTER TABLE run_chunks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can select their own chunks (via run ownership)
CREATE POLICY "Users can view their own run chunks"
  ON run_chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM pitch_runs
      WHERE pitch_runs.id = run_chunks.run_id
      AND pitch_runs.user_id = auth.uid()
    )
  );

-- Policy: Users can insert chunks for their own runs
CREATE POLICY "Users can insert chunks for their own runs"
  ON run_chunks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pitch_runs
      WHERE pitch_runs.id = run_chunks.run_id
      AND pitch_runs.user_id = auth.uid()
    )
  );

-- Policy: Users can update chunks for their own runs
CREATE POLICY "Users can update chunks for their own runs"
  ON run_chunks
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM pitch_runs
      WHERE pitch_runs.id = run_chunks.run_id
      AND pitch_runs.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pitch_runs
      WHERE pitch_runs.id = run_chunks.run_id
      AND pitch_runs.user_id = auth.uid()
    )
  );

-- Policy: Users can delete chunks for their own runs
CREATE POLICY "Users can delete chunks for their own runs"
  ON run_chunks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM pitch_runs
      WHERE pitch_runs.id = run_chunks.run_id
      AND pitch_runs.user_id = auth.uid()
    )
  );

