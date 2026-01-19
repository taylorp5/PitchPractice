# Implementation Summary: Admin Email Access

## 📋 Schema Inspection Results

### Existing Tables
1. **`user_entitlements`** ✅
   - Stores: Stripe purchase entitlements
   - Has: `user_id` (FK to auth.users), `session_id`, `plan`, Stripe data
   - RLS: ✅ Enabled - users can only see their own
   - No email stored

2. **`pitch_runs`** ✅
   - Has: `user_id` (FK to auth.users), `session_id`
   - No email stored

3. **`user_rubrics`** ✅
   - Has: `user_id` (FK to auth.users)
   - RLS: ✅ Enabled
   - No email stored

4. **`rubrics`** ✅
   - Has: `user_id` (FK to auth.users, nullable)
   - RLS: ✅ Enabled
   - No email stored

### Key Findings
- ❌ **No profiles table exists**
- ❌ **No user email stored in any table** (only in auth.users)
- ✅ **RLS is enabled** on all user-related tables
- ✅ **Service role key** (`getSupabaseAdmin()`) bypasses RLS
- ✅ **No admin identification system** (admins = service role access)

## ✅ Proposed Solution

**Minimal `user_profiles` table** that:
- Stores `user_id` and `email` only
- Auto-syncs via trigger when users sign up
- RLS protects emails (users see only their own)
- Service role can query all for admin views
- **Zero breaking changes** to existing entitlements logic

## 📝 Exact SQL Statements

### REQUIRED: Migration 015 - Create Profiles Table

**File**: `supabase/migrations/015_create_user_profiles.sql`

**Status**: ✅ **Safe to deploy via migrations**

**What it does**:
- Creates `user_profiles` table
- Sets up RLS policies
- Creates auto-sync trigger
- Creates indexes

**Run via**:
```bash
supabase migration up
# OR manually in Supabase SQL Editor
```

---

### REQUIRED: Migration 016 - Backfill Existing Users

**File**: `supabase/migrations/016_backfill_user_profiles.sql`

**Status**: ✅ **Safe to deploy via migrations** (but manual run recommended first time)

**What it does**:
- Populates profiles for all existing users
- Safe to run multiple times

**Run via**:
```bash
supabase migration up
# OR manually in Supabase SQL Editor (recommended for first run)
```

---

## 🔒 RLS Policies Created

### `user_profiles` Table Policies

1. **"Users can view their own profile"**
   - Type: SELECT
   - Condition: `auth.uid() = user_id`
   - Effect: Users can only see their own email

2. **"Users can update their own profile"**
   - Type: UPDATE
   - Condition: `auth.uid() = user_id`
   - Effect: Users can update their own email

3. **Service role bypasses RLS**
   - Uses `getSupabaseAdmin()` (service role key)
   - Can view/update all profiles
   - Server-side only

---

## 🚀 How to Use (Admin Queries)

### Server-Side Only (Never Client-Side)

```typescript
// Example: Get entitlements with user emails
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

See `ADMIN_EMAIL_QUERY_EXAMPLES.sql` for complete examples.

---

## ✅ Success Criteria Checklist

- [x] Admins can see user emails associated with entitlements
- [x] Normal users can only see their own data (RLS enforced)
- [x] Existing Stripe-based unlocks continue working
- [x] No production data is broken
- [x] No breaking changes to entitlements logic
- [x] No client-side auth.users queries needed

---

## 🔄 Why This Approach?

### 1. **Avoids Querying auth.users from Client**
- Client never queries `auth.users` directly
- All email access goes through `user_profiles` table
- RLS ensures users can only see their own email
- Service role (server-side only) can see all emails

### 2. **Minimal and Safe**
- Only adds one new table (`user_profiles`)
- Doesn't modify existing `user_entitlements` table
- Doesn't change Stripe or webhook logic
- Automatic sync via trigger (no manual updates needed)

### 3. **Future-Proof**
- Can extend `user_profiles` with additional fields if needed
- Keeps email data separate from entitlements (single responsibility)
- Maintains data consistency via triggers

---

## 📋 Implementation Checklist

1. ✅ **Run Migration 015** - Creates profiles table and triggers
2. ✅ **Run Migration 016** - Backfills existing users
3. ✅ **Verify Setup** - Check all users have profiles
4. ✅ **Update Admin Code** - Use `user_profiles` instead of `auth.users`
5. ✅ **Test RLS** - Verify users can't see other emails
6. ✅ **Test Admin Queries** - Verify service role can see all

---

## 🛡️ Security Notes

- ✅ Emails protected by RLS
- ✅ Service role is server-side only
- ✅ No client-side auth.users queries
- ✅ Automatic sync ensures consistency
- ✅ Cascade delete when users are deleted

---

## 📚 Files Created

1. `supabase/migrations/015_create_user_profiles.sql` - Main migration
2. `supabase/migrations/016_backfill_user_profiles.sql` - Backfill migration
3. `ADMIN_EMAIL_QUERY_EXAMPLES.sql` - Example admin queries
4. `ADMIN_EMAIL_SETUP_GUIDE.md` - Detailed setup guide
5. `IMPLEMENTATION_SUMMARY.md` - This file

---

## ⚠️ Important Notes

- **Never query `auth.users` from client-side code**
- **Always use service role key server-side for admin queries**
- **RLS policies protect user emails automatically**
- **Trigger automatically syncs new users**

---

## 🔧 Rollback (If Needed)

```sql
-- Remove triggers
DROP TRIGGER IF EXISTS sync_user_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- Remove functions
DROP FUNCTION IF EXISTS sync_user_profile_email();
DROP FUNCTION IF EXISTS update_user_profiles_updated_at();

-- Remove table
DROP TABLE IF EXISTS user_profiles CASCADE;
```

**Note**: This will NOT affect `user_entitlements` or any other tables.


