'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from './ui/Button'
import { useState, useEffect } from 'react'

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
    <nav className="sticky top-0 z-50 bg-[#0B0F14]/80 backdrop-blur-md border-b border-[#22283A] shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center shadow-md shadow-[#F59E0B]/30 group-hover:shadow-lg group-hover:shadow-[#F59E0B]/40 transition-shadow">
              <span className="text-[#0B0F14] font-bold text-lg">P</span>
            </div>
            <div>
              <div className="font-bold text-[#E6E8EB] text-lg">PitchPractice</div>
              <div className="text-xs text-[#6B7280] -mt-0.5">Practice your pitch. Get precise feedback.</div>
            </div>
          </Link>

          {/* Right side: Upgrade + Auth grouped together */}
          <div className="hidden md:flex items-center gap-6">
            {/* Upgrade - subtle text link */}
            <Link 
              href="/upgrade" 
              className="text-sm font-medium text-[#9AA4B2] hover:text-[#E6E8EB] transition-colors"
            >
              Upgrade
            </Link>
            
            {/* Auth button - ghost/outline style, slightly more prominent */}
            <Button 
              variant="ghost" 
              size="sm" 
              href={isSignedIn ? "/app" : "/app"}
              asChild
            >
              {isSignedIn ? "Dashboard" : "Sign in"}
            </Button>
          </div>

          {/* Mobile: simple menu */}
          <div className="md:hidden flex items-center gap-4">
            <Link 
              href="/upgrade" 
              className="text-sm font-medium text-[#9AA4B2] hover:text-[#E6E8EB] transition-colors"
            >
              Upgrade
            </Link>
            <Button 
              variant="ghost" 
              size="sm" 
              href={isSignedIn ? "/app" : "/app"}
              asChild
            >
              {isSignedIn ? "Dashboard" : "Sign in"}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
