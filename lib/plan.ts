'use client'

import { createClient } from '@/lib/supabase/client-auth'

export type UserPlan = 'free' | 'starter' | 'coach' | 'daypass'

/**
 * Get the user's plan based on authentication and entitlement.
 * 
 * Rules:
 * - Free: non-auth OR no entitlement (and /try page)
 * - Starter: signed-in user with entitlement = "starter" (or existing plan field)
 * - Coach: signed-in user with entitlement = "coach"
 * - Daypass: signed-in user with entitlement = "daypass"
 * 
 * Dev overrides (DEV ONLY, not in production):
 * 1. localStorage 'pp_dev_plan_override' (takes priority)
 * 2. NEXT_PUBLIC_PLAN_OVERRIDE env var
 * 
 * If plan detection is not implemented, defaults to "free" if unknown.
 */
export async function getUserPlan(): Promise<UserPlan> {
  // Dev-only plan override for testing (localStorage takes priority)
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    // Check localStorage first
    try {
      const localStorageOverride = localStorage.getItem('pp_dev_plan_override')
      if (localStorageOverride && ['free', 'starter', 'coach', 'daypass'].includes(localStorageOverride)) {
        console.log('[Plan Override] Using localStorage dev override:', localStorageOverride)
        return localStorageOverride as UserPlan
      }
    } catch (e) {
      // localStorage might not be available
    }
    
    // Fallback to env var
    const override = process.env.NEXT_PUBLIC_PLAN_OVERRIDE
    if (override && ['free', 'starter', 'coach', 'daypass'].includes(override)) {
      console.log('[Plan Override] Using env var dev override:', override)
      return override as UserPlan
    }
  }
  
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    // Get session_id for fallback (non-authenticated users)
    let sessionId: string | null = null
    try {
      const { getSessionId } = await import('@/lib/session')
      sessionId = getSessionId()
    } catch (e) {
      // getSessionId might fail in some contexts
    }

    // Call API to get plan from database
    const params = new URLSearchParams()
    if (sessionId) {
      params.set('session_id', sessionId)
    }

    const response = await fetch(`/api/plan?${params.toString()}`)
    const data = await response.json()

    if (data.plan && ['free', 'starter', 'coach', 'daypass'].includes(data.plan)) {
      return data.plan as UserPlan
    }

    // Fallback: check user metadata (legacy)
    if (session?.user) {
      const plan = session.user.user_metadata?.plan || session.user.user_metadata?.entitlement
      if (plan === 'starter' || plan === 'coach' || plan === 'daypass') {
        return plan as UserPlan
      }
    }

    // Default to free
    return 'free'
  } catch (error) {
    console.error('Error getting user plan:', error)
    // On error, default to "free" for safety
    return 'free'
  }
}

/**
 * Set dev plan override (DEV ONLY)
 * @param plan - Plan to override to, or null to clear override
 * @returns The plan that was set, or null if cleared
 */
export function setDevPlanOverride(plan: UserPlan | null): UserPlan | null {
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'production') {
    console.warn('[Plan Override] setDevPlanOverride only works in dev mode')
    return null
  }
  
  try {
    if (plan === null) {
      localStorage.removeItem('pp_dev_plan_override')
      console.log('[Plan Override] Cleared dev override')
      return null
    } else {
      localStorage.setItem('pp_dev_plan_override', plan)
      console.log('[Plan Override] Set dev override to:', plan)
      return plan
    }
  } catch (e) {
    console.error('[Plan Override] Failed to set dev override:', e)
    return null
  }
}

