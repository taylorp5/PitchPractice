-- Enable RLS on pitch_runs and add claim RPC + user_profiles sync

-- 1) Pitch runs RLS + policies
ALTER TABLE public.pitch_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pitch runs insert for anon and auth" ON public.pitch_runs;
DROP POLICY IF EXISTS "Pitch runs select for owner" ON public.pitch_runs;
DROP POLICY IF EXISTS "Pitch runs update for owner" ON public.pitch_runs;

CREATE POLICY "Pitch runs insert for anon and auth"
  ON public.pitch_runs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Pitch runs select for owner"
  ON public.pitch_runs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Pitch runs update for owner"
  ON public.pitch_runs
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2) Claim runs RPC (authenticated only)
CREATE OR REPLACE FUNCTION public.claim_pitch_runs(p_session_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_updated integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.pitch_runs
  SET user_id = v_user_id
  WHERE user_id IS NULL
    AND session_id = p_session_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pitch_runs(text) TO authenticated;

-- 3) User profiles email sync (ensure search_path set)
CREATE OR REPLACE FUNCTION public.sync_user_profile_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, created_at, updated_at)
  VALUES (NEW.id, NEW.email, now(), now())
  ON CONFLICT (user_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_profile_on_signup ON auth.users;
CREATE TRIGGER sync_user_profile_on_signup
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_profile_email();
