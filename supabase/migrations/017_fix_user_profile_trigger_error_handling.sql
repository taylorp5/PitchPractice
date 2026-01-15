-- Fix sync_user_profile_email function to handle errors gracefully
-- This prevents trigger failures from blocking user signups
-- If the profile creation fails, we log the error but don't prevent user creation

CREATE OR REPLACE FUNCTION sync_user_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if email is not null (should always be true for new signups)
  IF NEW.email IS NULL THEN
    RAISE WARNING 'Cannot sync user profile: email is null for user %', NEW.id;
    RETURN NEW;
  END IF;

  -- Insert or update user profile when auth user is created/updated
  -- Wrap in exception handling to prevent trigger failures from blocking signups
  BEGIN
    INSERT INTO user_profiles (user_id, email, updated_at)
    VALUES (NEW.id, NEW.email, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      email = NEW.email,
      updated_at = now();
  EXCEPTION
    WHEN undefined_table THEN
      -- Table doesn't exist - migration not run yet
      RAISE WARNING 'user_profiles table does not exist. Please run migration 015_create_user_profiles.sql';
      RETURN NEW;
    WHEN insufficient_privilege THEN
      -- Permission issue
      RAISE WARNING 'Insufficient privileges to insert into user_profiles for user %', NEW.id;
      RETURN NEW;
    WHEN OTHERS THEN
      -- Log the error but don't fail the transaction
      -- This allows users to be created even if profile creation fails
      RAISE WARNING 'Failed to sync user profile for user %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
      -- Return NEW to allow the auth.users insert/update to succeed
      RETURN NEW;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
