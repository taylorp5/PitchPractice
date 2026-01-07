import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/runs/[id]/chunks
 * Create a run_chunk record
 * Body: { chunk_index, start_ms, end_ms, audio_path }
 * Creates run_chunks row with status='uploaded'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: runId } = params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify run exists and user owns it
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (run.user_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Parse JSON body
    const body = await request.json()
    const { chunk_index, start_ms, end_ms, audio_path } = body

    if (chunk_index === undefined || start_ms === undefined || end_ms === undefined || !audio_path) {
      return NextResponse.json(
        { ok: false, error: 'chunk_index, start_ms, end_ms, and audio_path are required' },
        { status: 400 }
      )
    }

    const chunkIndex = parseInt(chunk_index, 10)
    const startMs = parseInt(start_ms, 10)
    const endMs = parseInt(end_ms, 10)

    if (isNaN(chunkIndex) || isNaN(startMs) || isNaN(endMs)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid chunk_index, start_ms, or end_ms' },
        { status: 400 }
      )
    }

    if (typeof audio_path !== 'string' || audio_path.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'audio_path must be a non-empty string' },
        { status: 400 }
      )
    }

    // Create run_chunk record
    const { data: chunk, error: dbError } = await getSupabaseAdmin()
      .from('run_chunks')
      .insert({
        run_id: runId,
        chunk_index: chunkIndex,
        start_ms: startMs,
        end_ms: endMs,
        audio_path: audio_path.trim(),
        status: 'uploaded',
      })
      .select('*')
      .single()

    if (dbError) {
      console.error('[Chunk Create] Database error:', dbError)
      return NextResponse.json(
        { ok: false, error: 'Failed to create chunk record', details: dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      chunk,
    })
  } catch (error: any) {
    console.error('[Chunk Create] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/runs/[id]/chunks
 * Fetch all chunks for a run
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: runId } = params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify run exists and user owns it
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (run.user_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Fetch chunks
    const { data: chunks, error: chunksError } = await getSupabaseAdmin()
      .from('run_chunks')
      .select('*')
      .eq('run_id', runId)
      .order('chunk_index', { ascending: true })

    if (chunksError) {
      console.error('[Chunks Fetch] Database error:', chunksError)
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch chunks' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      chunks: chunks || [],
    })
  } catch (error) {
    console.error('[Chunks Fetch] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

