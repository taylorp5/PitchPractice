-- Backfill existing user profiles from auth.users
-- This migration should be run manually in Supabase SQL Editor after 015_create_user_profiles.sql
-- It populates user_profiles for all existing users

-- Insert profiles for all existing auth users
INSERT INTO user_profiles (user_id, email, created_at, updated_at)
SELECT 
  id,
  email,
  created_at,
  updated_at
FROM auth.users
WHERE email IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Note: This backfill is safe to run multiple times due to ON CONFLICT DO NOTHING
-- The trigger will handle new users going forward


