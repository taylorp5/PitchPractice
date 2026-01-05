'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from './ui/Button'

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 bg-[#0B0E14]/80 backdrop-blur-md border-b border-[#181F2F] shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center shadow-md shadow-[#F59E0B]/30 group-hover:shadow-lg group-hover:shadow-[#F59E0B]/40 transition-shadow">
              <span className="text-[#0B0E14] font-bold text-lg">P</span>
            </div>
            <div>
              <div className="font-bold text-[#E5E7EB] text-lg">PitchPractice</div>
              <div className="text-xs text-[#64748B] -mt-0.5">Practice your pitch. Get precise feedback.</div>
            </div>
          </Link>

          {/* Navigation Links - Hidden on mobile, shown on desktop */}
          <div className="hidden md:flex items-center gap-8">
            <Link 
              href="/app" 
              className="text-sm font-medium text-[#9CA3AF] hover:text-[#F59E0B] transition-colors"
            >
              Try Free
            </Link>
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="primary" size="sm" href="/app" asChild>
              Try Free
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button variant="ghost" size="sm">
              Menu
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
