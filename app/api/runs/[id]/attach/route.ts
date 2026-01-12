import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * POST /api/runs/[id]/attach
 * Attach an anonymous run (user_id = null) to the authenticated user
 * Only attaches the most recent anonymous run if multiple exist
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const runId = params.id

    if (!runId) {
      return NextResponse.json(
        { ok: false, error: 'Run ID is required' },
        { status: 400 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch the run to verify it exists and is anonymous
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id, session_id, created_at')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { status: 404 }
      )
    }

    // If run already has a user_id, check if it's the same user
    if (run.user_id) {
      if (run.user_id === user.id) {
        // Already attached to this user
        return NextResponse.json({
          ok: true,
          message: 'Run already attached to your account',
          runId: run.id,
        })
      } else {
        // Attached to a different user - don't allow transfer
        return NextResponse.json(
          { ok: false, error: 'Run is already attached to another account' },
          { status: 403 }
        )
      }
    }

    // Find the most recent anonymous run for this session
    // This ensures we only attach the most recent run if multiple exist
    const { data: anonymousRuns, error: anonymousError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id, session_id, created_at')
      .eq('session_id', run.session_id)
      .is('user_id', null)
      .order('created_at', { ascending: false })
      .limit(1)

    if (anonymousError) {
      console.error('[Attach Run] Error fetching anonymous runs:', anonymousError)
      return NextResponse.json(
        { ok: false, error: 'Failed to fetch runs' },
        { status: 500 }
      )
    }

    // Only attach if this is the most recent anonymous run
    if (!anonymousRuns || anonymousRuns.length === 0 || anonymousRuns[0].id !== runId) {
      return NextResponse.json(
        { ok: false, error: 'Only the most recent anonymous run can be attached' },
        { status: 400 }
      )
    }

    // Attach the run to the user
    const { data: updatedRun, error: updateError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .update({ user_id: user.id })
      .eq('id', runId)
      .select('id, user_id')
      .single()

    if (updateError) {
      console.error('[Attach Run] Error updating run:', updateError)
      return NextResponse.json(
        { ok: false, error: 'Failed to attach run to account' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      message: 'Run attached to your account successfully',
      runId: updatedRun.id,
    })
  } catch (error: any) {
    console.error('[Attach Run] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}




