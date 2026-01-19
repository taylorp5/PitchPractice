import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/runs/claim
 * Claim runs for the authenticated user and session_id
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
    const { session_id: sessionId } = body

    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'session_id is required' },
        { status: 400 }
      )
    }
    const { data: claimedCount, error: claimError } = await supabase.rpc('claim_pitch_runs', {
      p_session_id: sessionId,
    })

    if (claimError) {
      console.error('[Claim Run] RPC error:', claimError)
      return NextResponse.json(
        { ok: false, error: 'Failed to claim runs' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, claimed: claimedCount ?? 0 })
  } catch (error: any) {
    console.error('[Claim Run] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

