import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/uploads/complete
 * Notify that an upload has completed
 * Auth required
 * Input: { runId, storagePath, chunkIndex?, start_ms, end_ms }
 * Updates pitch_runs.audio_path or creates run_chunks record
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
    const { runId, storagePath, chunkIndex, start_ms, end_ms } = body

    if (!runId || !storagePath) {
      return NextResponse.json(
        { ok: false, error: 'runId and storagePath are required' },
        { status: 400 }
      )
    }

    // Verify run exists
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id, session_id, audio_path')
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

    if (chunkIndex !== undefined && chunkIndex !== null) {
      // Chunked upload - create or update run_chunks record
      if (start_ms === undefined || end_ms === undefined) {
        return NextResponse.json(
          { ok: false, error: 'start_ms and end_ms are required for chunked uploads' },
          { status: 400 }
        )
      }

      const { data: chunk, error: chunkError } = await getSupabaseAdmin()
        .from('run_chunks')
        .upsert({
          run_id: runId,
          chunk_index: chunkIndex,
          start_ms: parseInt(start_ms, 10),
          end_ms: parseInt(end_ms, 10),
          audio_path: storagePath,
          status: 'uploaded',
        }, {
          onConflict: 'run_id,chunk_index',
        })
        .select('*')
        .single()

      if (chunkError) {
        console.error('[Upload Complete] Failed to create chunk record:', chunkError)
        return NextResponse.json(
          { ok: false, error: 'Failed to create chunk record', details: chunkError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        chunk,
      })
    } else {
      // Single file upload - update pitch_runs.audio_path
      const { data: updatedRun, error: updateError } = await getSupabaseAdmin()
        .from('pitch_runs')
        .update({
          audio_path: storagePath,
          status: 'uploaded',
        })
        .eq('id', runId)
        .select('*')
        .single()

      if (updateError) {
        console.error('[Upload Complete] Failed to update run:', updateError)
        return NextResponse.json(
          { ok: false, error: 'Failed to update run', details: updateError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        ok: true,
        run: updatedRun,
      })
    }
  } catch (error: any) {
    console.error('[Upload Complete] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

