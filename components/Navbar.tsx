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
      className="sticky top-0 z-50 backdrop-blur-xl border-b shadow-xl"
      style={{ 
        backgroundColor: `${colors.background.primary}E6`, // ~90% opacity
        borderColor: colors.border.primary,
        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.3)`,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center gap-3 group"
            aria-label="PitchPractice Home"
          >
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105"
              style={{
                backgroundColor: colors.accent.primary,
                boxShadow: `0 4px 12px ${colors.accent.primary}40`,
              }}
            >
              <span 
                className="font-bold text-xl"
                style={{ color: colors.background.primary }}
              >
                P
              </span>
            </div>
            <span 
              className="font-bold text-xl tracking-tight"
              style={{ color: colors.text.primary }}
            >
              PitchPractice
            </span>
          </Link>

          {/* Right side: Upgrade + Sign in */}
          <div className="flex items-center gap-5 md:gap-6">
            <Link 
              href="/upgrade" 
              className="text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg px-3 py-2 hover:bg-[#121826]"
              style={{ 
                color: colors.text.secondary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.accent.primary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.text.secondary}
              onFocus={(e) => {
                e.currentTarget.style.color = colors.accent.primary
                e.currentTarget.style.outline = `2px solid ${colors.accent.primary}`
                e.currentTarget.style.outlineOffset = '2px'
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
              className="border border-[#22283A] hover:border-[#F59E0B]/30"
            >
              {isSignedIn ? "Dashboard" : "Sign in"}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
