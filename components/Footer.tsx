'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { colors } from '@/lib/theme'

export function Footer() {
  const pathname = usePathname()
  
  // Don't show footer on landing page (it has its own footer)
  if (pathname === '/') {
    return null
  }

  return (
    <footer 
      className="border-t mt-auto py-8 px-4"
      style={{
        backgroundColor: colors.background.primary,
        borderColor: `${colors.border.primary}30`,
      }}
    >
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div style={{ color: colors.text.tertiary }}>
            © {new Date().getFullYear()} PitchPractice. All rights reserved.
          </div>
          <div className="flex flex-wrap gap-6 justify-center">
            <Link 
              href="/support"
              className="transition-all font-medium"
              style={{ 
                color: colors.text.tertiary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.text.secondary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.text.tertiary}
            >
              Support
            </Link>
            <Link 
              href="/privacy"
              className="transition-all font-medium"
              style={{ 
                color: colors.text.tertiary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.text.secondary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.text.tertiary}
            >
              Privacy
            </Link>
            <Link 
              href="/terms"
              className="transition-all font-medium"
              style={{ 
                color: colors.text.tertiary,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = colors.text.secondary}
              onMouseLeave={(e) => e.currentTarget.style.color = colors.text.tertiary}
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

