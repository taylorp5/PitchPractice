'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from './ui/Button'
import { useState, useEffect } from 'react'
import { colors } from '@/lib/theme'
import { createClient } from '@/lib/supabase/client-auth'

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isSignedIn, setIsSignedIn] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsSignedIn(!!session)
      setIsLoading(false)
    }

    checkAuth()

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(!!session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

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

          {/* Right side: Upgrade + Sign in/Sign out */}
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
            {!isLoading && (
              isSignedIn ? (
                <>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    href="/app"
                    asChild
                    aria-label="Go to dashboard"
                    className="border border-[#1E293B] hover:border-[#334155] hover:bg-[#0F172A]/50 transition-all"
                  >
                    Dashboard
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleSignOut}
                    aria-label="Sign out"
                    className="border border-[#1E293B] hover:border-[#334155] hover:bg-[#0F172A]/50 transition-all"
                  >
                    Sign out
                  </Button>
                </>
              ) : (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  href="/signin"
                  asChild
                  aria-label="Sign in"
                  className="border border-[#1E293B] hover:border-[#334155] hover:bg-[#0F172A]/50 transition-all"
                >
                  Sign in
                </Button>
              )
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
