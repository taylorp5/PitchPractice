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
 * Dev override: If NEXT_PUBLIC_PLAN_OVERRIDE is set and NODE_ENV !== 'production',
 * return that value (free | starter | coach | daypass).
 * 
 * If plan detection is not implemented, defaults to "free" if unknown.
 */
export async function getUserPlan(): Promise<UserPlan> {
  // Dev-only plan override for testing
  if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
    const override = process.env.NEXT_PUBLIC_PLAN_OVERRIDE
    if (override && ['free', 'starter', 'coach', 'daypass'].includes(override)) {
      console.log('[Plan Override] Using dev override:', override)
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

