'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from './ui/Button'
import { useState, useEffect } from 'react'
import { colors } from '@/lib/theme'

export function Navbar() {
  const pathname = usePathname()
  const [isSignedIn, setIsSignedIn] = useState(false)

  // TODO: Replace with actual auth check when auth is implemented
  // For now, always show "Sign in" since there's no real auth system yet
  // When Supabase auth is implemented, check: const { data: { session } } = await supabase.auth.getSession()
  useEffect(() => {
    // Placeholder: When auth is implemented, check Supabase session
    setIsSignedIn(false)
  }, [])

  return (
    <nav 
      className="sticky top-0 z-50 backdrop-blur-md border-b shadow-lg shadow-black/20"
      style={{ 
        backgroundColor: `${colors.background.primary}CC`, // 80% opacity
        borderColor: colors.border.primary,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-2 group"
            aria-label="PitchPractice Home"
          >
            <div 
              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow"
              style={{
                backgroundColor: colors.accent.primary,
                boxShadow: `${colors.accent.primary}30`,
              }}
            >
              <span 
                className="font-bold text-lg"
                style={{ color: colors.background.primary }}
              >
                P
              </span>
            </div>
            <span 
              className="font-bold text-lg"
              style={{ color: colors.text.primary }}
            >
              PitchPractice
            </span>
          </Link>

          {/* Right side: Upgrade + Sign in */}
          <div className="flex items-center gap-4 md:gap-6">
            <Link 
              href="/upgrade" 
              className="text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 rounded px-2 py-1"
              style={{ 
                color: colors.text.secondary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.text.primary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.text.secondary}
              onFocus={(e) => {
                e.currentTarget.style.color = colors.text.primary
                e.currentTarget.style.outline = `2px solid ${colors.accent.primary}`
                e.currentTarget.style.outlineOffset = '2px'
                e.currentTarget.style.borderRadius = '4px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.color = colors.text.secondary
                e.currentTarget.style.outline = 'none'
              }}
              aria-label="Upgrade to premium"
            >
              Upgrade
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              href={isSignedIn ? "/app" : "/app"}
              asChild
              aria-label={isSignedIn ? "Go to dashboard" : "Sign in"}
            >
              {isSignedIn ? "Dashboard" : "Sign in"}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
