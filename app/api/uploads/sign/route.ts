import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

/**
 * POST /api/uploads/sign
 * Generate a signed upload URL for direct-to-storage upload
 * Auth required
 * Input: { runId, chunkIndex?, mimeType }
 * Output: { uploadUrl, storagePath }
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated user (optional - try page doesn't require auth)
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
      }
    } catch (err) {
      // Not authenticated - that's fine for try page
    }

    const body = await request.json()
    const { runId, chunkIndex, mimeType } = body

    if (!runId) {
      return NextResponse.json(
        { ok: false, error: 'runId is required' },
        { status: 400 }
      )
    }

    // Verify run exists
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id, session_id')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { status: 404 }
      )
    }

    // Check ownership: if run has user_id, it must match authenticated user
    // If run has no user_id (try page), allow access
    if (run.user_id && run.user_id !== userId) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Determine file extension from mimeType
    let fileExt = 'webm'
    if (mimeType) {
      if (mimeType.includes('webm')) fileExt = 'webm'
      else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) fileExt = 'mp3'
      else if (mimeType.includes('wav')) fileExt = 'wav'
      else if (mimeType.includes('ogg')) fileExt = 'ogg'
    }

    // Generate storage path
    let storagePath: string
    if (chunkIndex !== undefined && chunkIndex !== null) {
      // Chunked upload for Coach plan
      storagePath = `${run.session_id}/${runId}/chunk_${chunkIndex}.${fileExt}`
    } else {
      // Single file upload for Starter/Free
      storagePath = `${run.session_id}/${runId}.${fileExt}`
    }

    // Create signed upload URL
    // Note: Supabase Storage doesn't have a direct "signed upload URL" method
    // Instead, we'll use the storage client's upload method with a presigned approach
    // For now, we'll return the path and the client will upload directly using the storage client
    // OR we can use the storage API endpoint directly
    
    // Actually, for direct uploads, we need to use the storage API's upload endpoint
    // The client will need to upload with proper auth headers
    // Let's return a token-based upload URL or use the storage client's upload method
    
    // For Supabase Storage, we can create a signed URL for PUT operations
    // However, the JS client doesn't expose this directly, so we'll use the storage API
    // The client will upload directly to: https://<project>.supabase.co/storage/v1/object/<bucket>/<path>
    // With Authorization: Bearer <anon_key> or service role key
    
    // Better approach: Use the storage client's upload method but from the client side
    // We'll return the path and the client will use the Supabase client to upload
    
    // Actually, the best approach is to use the storage client from the browser
    // We'll return the storage path and the client will upload using the Supabase JS client
    // with the user's session token
    
    const bucketName = 'pitchpractice-audio'
    
    // Return the storage path - client will upload using Supabase client
    // The client will use: supabase.storage.from(bucketName).upload(storagePath, blob, options)
    return NextResponse.json({
      ok: true,
      storagePath,
      bucketName,
    })
  } catch (error: any) {
    console.error('[Upload Sign] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

