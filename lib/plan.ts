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
    
    // If not authenticated, return "free"
    if (!session || !session.user) {
      return 'free'
    }
    
    // TODO: Check user's entitlement/plan from database
    // For now, if authenticated, default to "starter" as per existing code
    // This can be extended later to check actual plan/entitlement field
    
    // Check if user has a plan/entitlement in user metadata or a separate table
    // For now, we'll default authenticated users to "starter"
    // In the future, this should check:
    // - user.user_metadata.plan
    // - or a separate user_plans/entitlements table
    
    const plan = session.user.user_metadata?.plan || session.user.user_metadata?.entitlement
    
    if (plan === 'starter' || plan === 'coach' || plan === 'daypass') {
      return plan as UserPlan
    }
    
    // Default authenticated users to "starter" for now
    // This matches the existing hardcoded behavior in app/app/page.tsx
    return 'starter'
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

