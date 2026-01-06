import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type UserPlan = 'free' | 'starter' | 'coach' | 'daypass'

/**
 * Get user's plan from entitlements table
 * Checks both user_id (if authenticated) and session_id (if provided)
 */
export async function GET(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get('session_id')
    
    // Get user if authenticated
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
      }
    } catch (err) {
      // Not authenticated - that's fine
    }

    const supabaseAdmin = getSupabaseAdmin()
    const now = new Date().toISOString()

    // Query entitlements - check both user_id and session_id
    // If user is authenticated, prioritize user_id, but also check session_id as fallback
    let query = supabaseAdmin
      .from('user_entitlements')
      .select('plan, expires_at, user_id, session_id')
      .or(`expires_at.is.null,expires_at.gt.${now}`) // Only non-expired or non-expiring
      .order('created_at', { ascending: false })

    // Build query to check both user_id and session_id
    if (userId && sessionId) {
      // Check for entitlements linked to user OR session
      query = query.or(`user_id.eq.${userId},session_id.eq.${sessionId}`)
    } else if (userId) {
      query = query.eq('user_id', userId)
    } else if (sessionId) {
      query = query.eq('session_id', sessionId)
    } else {
      // No user and no session_id - return free
      return NextResponse.json({ plan: 'free' })
    }

    const { data: entitlements, error } = await query

    if (error) {
      console.error('[Plan API] Database error:', error)
      return NextResponse.json({ plan: 'free' })
    }

    console.log(`[Plan API] Found ${entitlements?.length || 0} entitlements for userId: ${userId}, sessionId: ${sessionId}`)

    if (error) {
      console.error('[Plan API] Database error:', error)
      return NextResponse.json({ plan: 'free' })
    }

    if (!entitlements || entitlements.length === 0) {
      return NextResponse.json({ plan: 'free' })
    }

    // Determine highest plan (coach > starter > daypass)
    // But daypass might be active and should be returned if it's the only one
    const plans = entitlements.map(e => e.plan)
    
    if (plans.includes('coach')) {
      return NextResponse.json({ plan: 'coach' })
    }
    if (plans.includes('starter')) {
      return NextResponse.json({ plan: 'starter' })
    }
    if (plans.includes('daypass')) {
      return NextResponse.json({ plan: 'daypass' })
    }

    return NextResponse.json({ plan: 'free' })
  } catch (error: any) {
    console.error('[Plan API] Error:', error)
    return NextResponse.json({ plan: 'free' })
  }
}

