# Create Storage Bucket

This migration creates the storage bucket for audio files.

## Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Storage**
3. Click **"New bucket"** or **"Create bucket"**
4. Configure:
   - **Name**: `pitchpractice-audio` (exact match, case-sensitive)
   - **Public**: `false` (Private)
   - **File size limit**: `52428800` (50 MB) - optional
   - **Allowed MIME types**: Leave empty or add `audio/*` - optional
5. Click **"Create bucket"**

## Option 2: Via SQL (if bucket creation API is available)

Some Supabase instances allow bucket creation via SQL. Check your Supabase version.

## Option 3: Via Script

Run the setup script (requires environment variables):

```bash
# Set environment variables
export NEXT_PUBLIC_SUPABASE_URL="your-url"
export SUPABASE_SERVICE_ROLE_KEY="your-key"

# Run script
npx tsx scripts/create-bucket.ts
```

## Verification

After creating the bucket, verify it exists:
- Go to Storage → You should see `pitchpractice-audio` in the list
- It should show as **Private**

## Troubleshooting

- **Bucket name must be exact**: `pitchpractice-audio` (lowercase, with hyphen)
- **Must be Private**: Public buckets have different access patterns
- **Service role key required**: The app uses service role key to bypass RLS





