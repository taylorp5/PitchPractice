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
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{ 
        backgroundColor: `${colors.background.primary}F5`, // ~96% opacity
        borderColor: `${colors.border.primary}40`, // Faint border
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
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
              style={{
                backgroundColor: colors.accent.primary,
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
          <div className="flex items-center gap-6 md:gap-8">
            <Link 
              href="/upgrade" 
              className="text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] rounded-md px-3 py-2 focus:ring-[#F59E0B]/50"
              style={{ 
                color: colors.text.secondary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.text.primary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.text.secondary}
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
              className="border border-[#1E293B] hover:border-[#334155] hover:bg-[#0F172A]/50 transition-all"
            >
              {isSignedIn ? "Dashboard" : "Sign in"}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
