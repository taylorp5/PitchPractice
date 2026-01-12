/**
 * One-time setup script to create the Supabase storage bucket
 * Run with: npx tsx scripts/create-bucket.ts
 * 
 * Or use the Supabase Dashboard:
 * Storage → Create bucket → Name: "pitchpractice-audio" → Private
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables:')
  console.error('  NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('  SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createBucket() {
  const bucketName = 'pitchpractice-audio'

  console.log(`Creating bucket: ${bucketName}...`)

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets()
  
  if (listError) {
    console.error('Error listing buckets:', listError)
    process.exit(1)
  }

  const bucketExists = buckets?.some(b => b.name === bucketName)
  
  if (bucketExists) {
    console.log(`✓ Bucket "${bucketName}" already exists`)
    return
  }

  // Create the bucket
  const { data, error } = await supabase.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'audio/webm',
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/ogg',
      'audio/webm;codecs=opus',
    ],
  })

  if (error) {
    console.error('✗ Failed to create bucket:', error)
    console.error('\nManual setup:')
    console.error('1. Go to Supabase Dashboard → Storage')
    console.error(`2. Click "Create bucket"`)
    console.error(`3. Name: "${bucketName}"`)
    console.error('4. Set to Private (not public)')
    console.error('5. File size limit: 50 MB')
    process.exit(1)
  }

  console.log(`✓ Successfully created bucket "${bucketName}"`)
  console.log('  - Private: true')
  console.log('  - File size limit: 50 MB')
  console.log('  - Allowed MIME types: audio/*')
}

createBucket().catch(console.error)








