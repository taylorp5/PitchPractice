import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/runs/[id]/chunks/[chunkId]/transcript.txt
 * Download chunk transcript as text/plain
 * Auth required, verify ownership
 * Returns 404 if transcript not ready
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; chunkId: string } }
) {
  try {
    const { id: runId, chunkId } = params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    // Verify run exists and user owns it
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      return new NextResponse('Run not found', { status: 404 })
    }

    // Check ownership
    if (run.user_id !== user.id) {
      return new NextResponse('Unauthorized', { status: 403 })
    }

    // Fetch chunk
    const { data: chunk, error: chunkError } = await getSupabaseAdmin()
      .from('run_chunks')
      .select('id, transcript, status')
      .eq('id', chunkId)
      .eq('run_id', runId)
      .single()

    if (chunkError || !chunk) {
      return new NextResponse('Chunk not found', { status: 404 })
    }

    // Check if transcript is ready
    if (chunk.status !== 'transcribed' || !chunk.transcript) {
      return new NextResponse('Transcript not ready', { status: 404 })
    }

    // Return transcript as text/plain
    return new NextResponse(chunk.transcript, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="chunk_${chunkId}_transcript.txt"`,
      },
    })
  } catch (error) {
    console.error('[Chunk Transcript Download] Unexpected error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}

