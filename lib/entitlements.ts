'use client'

import { UserPlan } from './plan'

/**
 * Check if the current user has Coach access.
 * 
 * This is the single source of truth for Coach access gating.
 * Uses the CURRENT authenticated user's plan/entitlements, not historical data.
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if user has Coach access, false otherwise
 */
export function hasCoachAccess(
  userPlan: string | null,
  entitlementFlags?: Record<string, boolean>
): boolean {
  // Guard: null or undefined plan means no access
  if (!userPlan) {
    return false
  }

  // Check if plan is 'coach'
  if (userPlan === 'coach') {
    return true
  }

  // Check entitlement flags if provided (for future extensibility)
  if (entitlementFlags?.coach === true) {
    return true
  }

  // All other plans (free, starter, daypass) do not have Coach access
  return false
}

