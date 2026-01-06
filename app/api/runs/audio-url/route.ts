import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/runs/audio-url?runId=<id>
 * Generate a signed URL for audio playback
 * - Auth required
 * - Validates run exists
 * - Validates run.user_id === authenticated user id (or admin)
 * - Returns { url: string }
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get runId from query params
    const { searchParams } = new URL(request.url)
    const runId = searchParams.get('runId')

    if (!runId) {
      return NextResponse.json(
        { ok: false, error: 'runId is required' },
        { status: 400 }
      )
    }

    // Fetch the run to verify it exists and check ownership
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id, audio_path')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { status: 404 }
      )
    }

    // Validate ownership: run.user_id === authenticated user id
    // Note: Admin role check can be added here if needed
    if (run.user_id !== null && run.user_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    if (!run.audio_path) {
      return NextResponse.json(
        { ok: false, error: 'No audio path found for this run' },
        { status: 404 }
      )
    }

    // Generate signed URL (10-60 minutes expiry, using 30 minutes)
    const { data: signedUrlData, error: urlError } = await getSupabaseAdmin().storage
      .from('pitchpractice-audio')
      .createSignedUrl(run.audio_path, 1800) // 30 minutes

    if (urlError || !signedUrlData?.signedUrl) {
      console.error('[Audio URL] Failed to generate signed URL:', {
        runId,
        path: run.audio_path,
        error: urlError,
        message: urlError?.message,
      })
      return NextResponse.json(
        { ok: false, error: 'Failed to generate audio URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
    })
  } catch (error: any) {
    console.error('[Audio URL] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

