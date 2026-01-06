import { createClient } from '@/lib/supabase/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export type UserPlan = 'free' | 'starter' | 'coach' | 'daypass'

/**
 * Get the user's plan from the database (server-side only).
 * This is the source of truth for plan attribution at analysis time.
 * 
 * Checks the user_entitlements table for active entitlements.
 * Returns the highest plan (coach > starter > daypass > free).
 * 
 * @param sessionId - Optional session_id for non-authenticated users
 * @returns The user's current plan
 */
export async function getUserPlanFromDB(sessionId?: string | null): Promise<UserPlan> {
  try {
    // Get user if authenticated
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
      }
    } catch (err) {
      // Not authenticated - that's fine, will check session_id
    }

    const supabaseAdmin = getSupabaseAdmin()
    const now = new Date().toISOString()

    // Query entitlements - check both user_id and session_id
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
      return 'free'
    }

    const { data: entitlements, error } = await query

    if (error) {
      console.error('[Plan Server] Database error:', error)
      return 'free'
    }

    if (!entitlements || entitlements.length === 0) {
      return 'free'
    }

    // Determine highest plan (coach > starter > daypass)
    const plans = entitlements.map(e => e.plan)
    
    if (plans.includes('coach')) {
      return 'coach'
    }
    if (plans.includes('starter')) {
      return 'starter'
    }
    if (plans.includes('daypass')) {
      return 'daypass'
    }

    return 'free'
  } catch (error: any) {
    console.error('[Plan Server] Error:', error)
    return 'free'
  }
}

