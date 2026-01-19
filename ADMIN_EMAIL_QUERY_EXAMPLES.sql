-- ============================================================================
-- ADMIN QUERIES: View User Emails with Entitlements
-- ============================================================================
-- These queries use the service role key (getSupabaseAdmin()) which bypasses RLS
-- Run these server-side only, never expose to client
-- ============================================================================

-- Example 1: Get all users with their emails and active entitlements
SELECT 
  up.user_id,
  up.email,
  up.created_at as profile_created_at,
  ue.plan,
  ue.stripe_checkout_session_id,
  ue.stripe_customer_id,
  ue.expires_at,
  ue.created_at as entitlement_created_at,
  CASE 
    WHEN ue.expires_at IS NULL THEN 'active'
    WHEN ue.expires_at > now() THEN 'active'
    ELSE 'expired'
  END as entitlement_status
FROM user_profiles up
LEFT JOIN user_entitlements ue ON up.user_id = ue.user_id
WHERE ue.expires_at IS NULL OR ue.expires_at > now()
ORDER BY up.email, ue.created_at DESC;

-- Example 2: Get users by plan type with emails
SELECT 
  up.email,
  ue.plan,
  COUNT(*) OVER (PARTITION BY ue.plan) as total_users_with_plan,
  ue.created_at as purchased_at,
  ue.expires_at
FROM user_profiles up
INNER JOIN user_entitlements ue ON up.user_id = ue.user_id
WHERE (ue.expires_at IS NULL OR ue.expires_at > now())
ORDER BY ue.plan, up.email;

-- Example 3: Get all entitlements with user emails (for admin dashboard)
SELECT 
  ue.id as entitlement_id,
  up.email,
  ue.plan,
  ue.stripe_checkout_session_id,
  ue.stripe_customer_id,
  ue.expires_at,
  ue.created_at,
  ue.updated_at
FROM user_entitlements ue
LEFT JOIN user_profiles up ON ue.user_id = up.user_id
WHERE ue.user_id IS NOT NULL  -- Only show authenticated user entitlements
ORDER BY ue.created_at DESC;

-- Example 4: Find users without any entitlements (free tier)
SELECT 
  up.user_id,
  up.email,
  up.created_at as signed_up_at
FROM user_profiles up
LEFT JOIN user_entitlements ue ON up.user_id = ue.user_id 
  AND (ue.expires_at IS NULL OR ue.expires_at > now())
WHERE ue.id IS NULL
ORDER BY up.created_at DESC;

-- Example 5: Get user email by entitlement ID (for support/admin lookup)
SELECT 
  ue.id as entitlement_id,
  up.email,
  ue.plan,
  ue.stripe_checkout_session_id,
  ue.stripe_customer_id
FROM user_entitlements ue
INNER JOIN user_profiles up ON ue.user_id = up.user_id
WHERE ue.id = 'ENTITLEMENT_UUID_HERE';

-- ============================================================================
-- NOTES:
-- ============================================================================
-- 1. These queries require service role key (server-side only)
-- 2. Normal users cannot see other users' emails due to RLS
-- 3. Users can only see their own profile via RLS policy
-- 4. The trigger automatically syncs emails from auth.users to user_profiles
-- 5. Backfill migration (016) populates existing users
-- ============================================================================


