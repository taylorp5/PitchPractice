# Admin Email Access Setup Guide

## Overview

This guide explains how to enable admin access to user emails for entitlement management in Supabase, without querying `auth.users` directly from client code.

## Current Schema Analysis

### Existing Tables
- ✅ **`user_entitlements`** - Stores Stripe purchase entitlements
  - `user_id` (uuid, FK to auth.users)
  - `session_id` (text, for anonymous users)
  - `plan` (starter/coach/daypass)
  - `stripe_checkout_session_id`, `stripe_customer_id`
  - RLS enabled: Users can only see their own entitlements

- ✅ **`pitch_runs`** - Stores pitch recordings
  - `user_id` (uuid, FK to auth.users)
  - `session_id` (text)

- ✅ **`user_rubrics`** - User-created rubrics
  - `user_id` (uuid, FK to auth.users)
  - RLS enabled

- ✅ **`rubrics`** - Unified rubrics table
  - `user_id` (uuid, FK to auth.users, nullable for public rubrics)
  - RLS enabled

### Key Findings
1. ❌ **No profiles table exists** - emails are only in `auth.users`
2. ✅ **RLS is enabled** on all user-related tables
3. ✅ **Service role key** (`getSupabaseAdmin()`) bypasses RLS for admin operations
4. ✅ **No breaking changes needed** - existing entitlements logic remains unchanged

## Solution: Minimal `user_profiles` Table

### Why This Approach?

1. **Separation of Concerns**: Keeps email data separate from entitlements, following single responsibility principle
2. **Automatic Sync**: Trigger automatically syncs emails from `auth.users` when users sign up
3. **RLS Protection**: Normal users can only see their own email, admins can see all via service role
4. **No Breaking Changes**: Doesn't modify existing `user_entitlements` table or logic
5. **Future-Proof**: Can be extended with additional profile fields if needed

### How It Avoids Querying auth.users

- **Client-side**: Never queries `auth.users` directly
- **Server-side**: Uses `user_profiles` table which is queryable via service role
- **Admin queries**: Join `user_profiles` with `user_entitlements` using service role key
- **RLS**: Ensures normal users can't see other users' emails

## Migration Steps

### Step 1: Run Migration 015 (Required)

**File**: `supabase/migrations/015_create_user_profiles.sql`

**What it does**:
- Creates `user_profiles` table with `user_id` and `email`
- Sets up RLS policies (users see only their own)
- Creates trigger to auto-sync emails from `auth.users`
- Creates indexes for performance

**How to run**:
```bash
# Via Supabase CLI (recommended)
supabase migration up

# OR manually in Supabase SQL Editor
# Copy contents of 015_create_user_profiles.sql and run in SQL Editor
```

**Status**: ✅ Safe to deploy via migrations

### Step 2: Backfill Existing Users (Required)

**File**: `supabase/migrations/016_backfill_user_profiles.sql`

**What it does**:
- Populates `user_profiles` for all existing users from `auth.users`
- Safe to run multiple times (uses `ON CONFLICT DO NOTHING`)

**How to run**:
```bash
# Via Supabase CLI
supabase migration up

# OR manually in Supabase SQL Editor (recommended for first run)
# Copy contents of 016_backfill_user_profiles.sql and run in SQL Editor
# This ensures all existing users have profiles
```

**Status**: ✅ Safe to deploy via migrations (but manual run recommended first time)

### Step 3: Verify Setup (Optional but Recommended)

Run these queries in Supabase SQL Editor to verify:

```sql
-- Check if all users have profiles
SELECT 
  COUNT(DISTINCT au.id) as total_users,
  COUNT(DISTINCT up.user_id) as users_with_profiles,
  COUNT(DISTINCT au.id) - COUNT(DISTINCT up.user_id) as missing_profiles
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.user_id;

-- Check trigger is working (create a test user and verify profile is created)
-- Or check recent profiles
SELECT * FROM user_profiles ORDER BY created_at DESC LIMIT 10;
```

## Admin Query Examples

See `ADMIN_EMAIL_QUERY_EXAMPLES.sql` for complete examples.

**Important**: These queries must be run server-side using `getSupabaseAdmin()` which uses the service role key. Never expose these queries to the client.

### Example: Get Entitlements with Emails

```typescript
// Server-side only (e.g., in app/api/admin/entitlements/route.ts)
import { getSupabaseAdmin } from '@/lib/supabase/server'

const supabaseAdmin = getSupabaseAdmin()
const { data, error } = await supabaseAdmin
  .from('user_entitlements')
  .select(`
    *,
    user_profiles!inner(email)
  `)
  .order('created_at', { ascending: false })
```

## RLS Policies Summary

### `user_profiles` Table

1. **Users can view their own profile**
   - Policy: `"Users can view their own profile"`
   - Condition: `auth.uid() = user_id`
   - Allows: Users to see only their own email

2. **Users can update their own profile**
   - Policy: `"Users can update their own profile"`
   - Condition: `auth.uid() = user_id`
   - Allows: Users to update their own email (if needed)

3. **Service role bypasses RLS**
   - Uses `getSupabaseAdmin()` with service role key
   - Can view/update all profiles
   - Server-side only

## Security Considerations

✅ **Emails are protected by RLS** - normal users cannot see other users' emails
✅ **Service role is server-side only** - never exposed to client
✅ **No client-side auth.users queries** - all email access goes through `user_profiles`
✅ **Automatic sync** - trigger ensures data consistency
✅ **Cascade delete** - profiles are deleted when users are deleted

## Testing Checklist

- [ ] Migration 015 runs successfully
- [ ] Migration 016 backfills existing users
- [ ] New user signup creates profile automatically (test with new account)
- [ ] RLS prevents users from seeing other users' emails
- [ ] Service role can query all profiles (test server-side)
- [ ] Admin queries return emails with entitlements
- [ ] Existing Stripe webhooks continue working
- [ ] Existing entitlement logic unchanged

## Rollback Plan

If issues occur, you can rollback:

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS sync_user_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Remove functions
DROP FUNCTION IF EXISTS sync_user_profile_email();
DROP FUNCTION IF EXISTS update_user_profiles_updated_at();

-- Remove table (cascade will clean up)
DROP TABLE IF EXISTS user_profiles CASCADE;
```

**Note**: This will not affect `user_entitlements` or any other tables.

## Next Steps

1. ✅ Run migration 015
2. ✅ Run backfill migration 016
3. ✅ Verify setup with test queries
4. ✅ Update admin dashboard code to use `user_profiles` instead of `auth.users`
5. ✅ Test admin queries server-side

## Support

If you encounter issues:
1. Check Supabase logs for trigger errors
2. Verify RLS policies are active
3. Ensure service role key is set correctly
4. Check that migrations ran successfully


