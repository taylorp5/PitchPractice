'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client-auth'
import { getUserPlan, type UserPlan } from '@/lib/plan'
import { colors } from '@/lib/theme'

interface ProfileDropdownProps {
  userEmail: string | null
  userName: string | null
}

export function ProfileDropdown({ userEmail, userName }: ProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [userPlan, setUserPlan] = useState<UserPlan>('free')
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  // Get user plan
  useEffect(() => {
    getUserPlan().then(plan => {
      setUserPlan(plan)
    })
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleManageSubscription = async () => {
    setIsLoadingPortal(true)
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      const data = await response.json()

      if (!data.ok) {
        throw new Error(data.error || 'Failed to create portal session')
      }

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No portal URL returned')
      }
    } catch (error: any) {
      console.error('[Portal] Error:', error)
      alert(error.message || 'Failed to open billing portal. Please try again.')
      setIsLoadingPortal(false)
    }
  }

  // Get user initials
  const getInitials = () => {
    if (userName) {
      const parts = userName.trim().split(/\s+/)
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      }
      return parts[0][0]?.toUpperCase() || 'U'
    }
    if (userEmail) {
      return userEmail[0].toUpperCase()
    }
    return 'U'
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full border border-[#1E293B] hover:border-[#334155] hover:bg-[#0F172A]/50 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50"
        aria-label="User menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold"
          style={{
            backgroundColor: colors.accent.primary,
            color: colors.background.primary,
          }}
        >
          {getInitials()}
        </div>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown menu */}
          <div
            className="absolute right-0 mt-2 w-56 rounded-lg shadow-lg z-50 border"
            style={{
              backgroundColor: colors.background.secondary,
              borderColor: colors.border.primary,
            }}
            role="menu"
            aria-orientation="vertical"
          >
            <div className="py-1">
              {/* User info */}
              <div className="px-4 py-3 border-b" style={{ borderColor: colors.border.primary }}>
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: colors.text.primary }}
                >
                  {userName || 'User'}
                </p>
                <p
                  className="text-xs truncate mt-1"
                  style={{ color: colors.text.secondary }}
                >
                  {userEmail || ''}
                </p>
              </div>

              {/* Menu items */}
              <Link
                href="/dashboard"
                className="block px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-[#0F172A]/50"
                style={{ color: colors.text.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => setIsOpen(false)}
                role="menuitem"
              >
                Dashboard
              </Link>

              <Link
                href="/settings"
                className="block px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-[#0F172A]/50"
                style={{ color: colors.text.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                onClick={() => setIsOpen(false)}
                role="menuitem"
              >
                Settings
              </Link>

              <button
                type="button"
                onClick={handleManageSubscription}
                disabled={isLoadingPortal}
                className="w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-[#0F172A]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: colors.text.primary }}
                onMouseEnter={(e) => {
                  if (!isLoadingPortal) {
                    e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.5)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                role="menuitem"
              >
                {isLoadingPortal ? 'Loading...' : 'Manage subscription'}
              </button>

              {userPlan !== 'coach' && (
                <Link
                  href="/upgrade"
                  className="block px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-[#0F172A]/50"
                  style={{ color: colors.text.primary }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.5)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                  onClick={() => setIsOpen(false)}
                  role="menuitem"
                >
                  Upgrade plan
                </Link>
              )}

              <div className="border-t my-1" style={{ borderColor: colors.border.primary }} />

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-left px-4 py-2 text-sm transition-colors focus:outline-none focus:bg-[#0F172A]/50"
                style={{ color: colors.text.primary }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.5)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                }}
                role="menuitem"
              >
                Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

