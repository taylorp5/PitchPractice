import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/runs/claim
 * Claim a run by setting its user_id to the authenticated user
 * - If run.user_id is null → set run.user_id = authed user id
 * - If run.user_id already equals authed user id → ok (idempotent)
 * - Otherwise → return 403 (do not reassign another user's run)
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json()
    const { runId } = body

    if (!runId || typeof runId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'runId is required' },
        { status: 400 }
      )
    }

    // Fetch the run to verify it exists
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

    // If run.user_id already equals authenticated user id → ok (idempotent)
    if (run.user_id === user.id) {
      return NextResponse.json({
        ok: true,
      })
    }

    // If run.user_id is not null and not equal to user id → return 403
    if (run.user_id !== null) {
      return NextResponse.json(
        { ok: false, error: 'Run is already attached to another account' },
        { status: 403 }
      )
    }

    // If run.user_id is null → set run.user_id = authed user id
    const { data: updatedRun, error: updateError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .update({ user_id: user.id })
      .eq('id', runId)
      .select('id, user_id')
      .single()

    if (updateError) {
      console.error('[Claim Run] Error updating run:', updateError)
      return NextResponse.json(
        { ok: false, error: 'Failed to claim run' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
    })
  } catch (error: any) {
    console.error('[Claim Run] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

