-- Storage policies for pitchpractice-audio bucket
-- Allows users to upload audio files to their session_id folder
-- Path format: {session_id}/{runId}.{ext} or {session_id}/{runId}/chunk_{index}.{ext}

-- Drop existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "Authenticated users can upload to their runs" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can upload to session folders" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read their own files" ON storage.objects;
DROP POLICY IF EXISTS "Anonymous users can read session files" ON storage.objects;

-- Policy: Allow authenticated users to upload files to runs they own
-- The path contains the run_id, which we validate belongs to the user
CREATE POLICY "Authenticated users can upload to their runs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pitchpractice-audio' AND
  -- Check if the path contains a run_id that belongs to the authenticated user
  -- Path format: {session_id}/{runId}.{ext} or {session_id}/{runId}/chunk_{index}.{ext}
  EXISTS (
    SELECT 1 FROM pitch_runs 
    WHERE user_id = auth.uid() 
    AND (
      -- Match run_id in path (before .ext or /chunk_)
      name LIKE '%/' || id::text || '.%'
      OR name LIKE '%/' || id::text || '/%'
    )
  )
);

-- Policy: Allow anonymous users to upload to their session_id folder (for try page)
-- We validate ownership via the run record in /api/uploads/sign before allowing upload
-- This policy allows the upload if the session_id exists in pitch_runs
CREATE POLICY "Anonymous users can upload to session folders"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'pitchpractice-audio' AND
  -- Path must start with a valid session_id that exists in pitch_runs
  -- The /api/uploads/sign endpoint validates run ownership before returning the path
  -- Extract first folder (session_id) from path
  (storage.foldername(name))[1] IN (
    SELECT DISTINCT session_id::text FROM pitch_runs WHERE session_id IS NOT NULL
  )
);

-- Policy: Allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read their own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'pitchpractice-audio' AND
  (
    -- Check if run_id in path belongs to user
    (storage.foldername(name))[2] IN (
      SELECT id::text FROM pitch_runs WHERE user_id = auth.uid()
    )
    OR
    -- Fallback: check session_id
    (storage.foldername(name))[1] IN (
      SELECT session_id::text FROM pitch_runs WHERE user_id = auth.uid()
    )
  )
);

-- Policy: Allow anonymous users to read files in their session (for try page)
CREATE POLICY "Anonymous users can read session files"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'pitchpractice-audio' AND
  (storage.foldername(name))[1] IN (
    SELECT DISTINCT session_id::text FROM pitch_runs WHERE session_id IS NOT NULL
  )
);

