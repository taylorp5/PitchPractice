'use client'

import { UserPlan } from './plan'

/**
 * Entitlement flags interface for future extensibility
 */
export interface EntitlementFlags {
  coach?: boolean
  daypass_active?: boolean
  daypass_expired?: boolean
}

/**
 * Check if the current user has Coach access.
 * 
 * This is the single source of truth for Coach access gating.
 * Uses the CURRENT authenticated user's plan/entitlements, not historical data.
 * 
 * Coach access includes:
 * - Full rubric editing capabilities
 * - Progress over time tracking
 * - All premium insights
 * - Advanced exports
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if user has Coach access, false otherwise
 */
export function hasCoachAccess(
  userPlan: string | null,
  entitlementFlags?: EntitlementFlags
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

/**
 * Check if the current user has an active Day Pass.
 * 
 * Day Pass is active if:
 * - Current plan is 'daypass' (API already filters expired ones)
 * 
 * Note: If userPlan is not 'daypass', the daypass is either expired or never existed.
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if user has an active Day Pass, false otherwise
 */
export function hasDayPassAccess(
  userPlan: string | null,
  entitlementFlags?: EntitlementFlags
): boolean {
  // Guard: null or undefined plan means no access
  if (!userPlan) {
    return false
  }

  // Check if plan is 'daypass' (API already filters expired entitlements)
  if (userPlan === 'daypass') {
    return true
  }

  // Check entitlement flags if provided (for future extensibility)
  if (entitlementFlags?.daypass_active === true) {
    return true
  }

  return false
}

/**
 * Check if the user's Day Pass has expired.
 * 
 * This is derived from the fact that if userPlan is not 'daypass',
 * but the user previously had a daypass, it's expired.
 * 
 * Note: This is a best-effort check. If userPlan is not 'daypass',
 * we assume it's expired (or never existed).
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if Day Pass is expired, false if active or never existed
 */
export function isDayPassExpired(
  userPlan: string | null,
  entitlementFlags?: EntitlementFlags
): boolean {
  // If entitlement flags explicitly say expired, return true
  if (entitlementFlags?.daypass_expired === true) {
    return true
  }

  // If userPlan is 'daypass', it's not expired (API filters expired ones)
  if (userPlan === 'daypass') {
    return false
  }

  // Otherwise, we can't definitively say it's expired (might never have existed)
  // But for UI purposes, if we're checking this, it's likely expired
  return false
}

/**
 * Check if the user can edit rubrics.
 * 
 * Only Coach plan users can edit rubrics.
 * Day Pass users can view rubrics but cannot edit them.
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if user can edit rubrics, false otherwise
 */
export function canEditRubrics(
  userPlan: string | null,
  entitlementFlags?: EntitlementFlags
): boolean {
  // Only Coach can edit rubrics
  return hasCoachAccess(userPlan, entitlementFlags)
}

/**
 * Check if the user can view premium insights.
 * 
 * Premium insights include:
 * - Filler word counts
 * - Pacing segments
 * - Structure missing sections
 * - Coaching plan drills
 * 
 * Available to:
 * - Coach plan users
 * - Active Day Pass users
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if user can view premium insights, false otherwise
 */
export function canViewPremiumInsights(
  userPlan: string | null,
  entitlementFlags?: EntitlementFlags
): boolean {
  // Coach and active Day Pass can view premium insights
  return hasCoachAccess(userPlan, entitlementFlags) || hasDayPassAccess(userPlan, entitlementFlags)
}

/**
 * Check if the user can view the progress over time panel.
 * 
 * This feature allows comparing multiple attempts over time.
 * 
 * Only Coach plan users can view progress over time.
 * Day Pass users cannot access this feature.
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if user can view progress panel, false otherwise
 */
export function canViewProgressPanel(
  userPlan: string | null,
  entitlementFlags?: EntitlementFlags
): boolean {
  // Only Coach can view progress over time
  return hasCoachAccess(userPlan, entitlementFlags)
}

/**
 * Check if the user can regenerate premium insights.
 * 
 * After a Day Pass expires, users can still view previously generated insights
 * but cannot regenerate them.
 * 
 * Available to:
 * - Coach plan users (always)
 * - Active Day Pass users (only during active period)
 * 
 * @param userPlan - The current user's plan (from getUserPlan())
 * @param entitlementFlags - Optional entitlement flags (for future use)
 * @returns true if user can regenerate premium insights, false otherwise
 */
export function canRegeneratePremiumInsights(
  userPlan: string | null,
  entitlementFlags?: EntitlementFlags
): boolean {
  // Coach can always regenerate, Day Pass can only during active period
  return hasCoachAccess(userPlan, entitlementFlags) || hasDayPassAccess(userPlan, entitlementFlags)
}

