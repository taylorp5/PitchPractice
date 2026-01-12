# Database Migration Instructions

## Quick Fix: Add duration_ms Column

If you're seeing the error:
```
Could not find the 'duration_ms' column of 'pitch_runs' in the schema cache
```

You need to run the migration to add the `duration_ms` column.

## Steps

1. **Open Supabase Dashboard**
   - Go to [supabase.com](https://supabase.com)
   - Select your project
   - Navigate to **SQL Editor** (left sidebar)

2. **Run the Migration**
   - Click **"New query"** or open a new SQL editor tab
   - Copy and paste the contents of `supabase/migrations/002_add_duration_ms.sql`:
   
   ```sql
   -- Add duration_ms column to pitch_runs table
   ALTER TABLE pitch_runs 
   ADD COLUMN IF NOT EXISTS duration_ms integer;
   
   -- Add index for faster queries on duration_ms
   CREATE INDEX IF NOT EXISTS idx_pitch_runs_duration_ms ON pitch_runs(duration_ms);
   ```

3. **Execute**
   - Click **"Run"** or press `Ctrl+Enter` (Windows) / `Cmd+Enter` (Mac)
   - You should see "Success. No rows returned"

4. **Verify**
   - The migration uses `IF NOT EXISTS`, so it's safe to run multiple times
   - The column should now exist in your `pitch_runs` table

## Complete Migration Order

If setting up from scratch, run migrations in this order:

1. `001_initial_schema.sql` - Creates tables and default rubric
2. `002_add_timing_fields.sql` - Adds word_count and words_per_minute
3. `002_add_duration_ms.sql` - Adds duration_ms (source of truth for duration)

## Troubleshooting

- **"relation pitch_runs does not exist"**: Run `001_initial_schema.sql` first
- **"column already exists"**: The migration uses `IF NOT EXISTS`, so this shouldn't happen, but it's safe to ignore
- **Still seeing errors**: Clear your browser cache and restart your Next.js dev server





