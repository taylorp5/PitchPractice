'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client-auth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function SignInPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      // Verify env vars are available (client-side check)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error(
          'Supabase configuration is missing. Please restart your dev server after setting up .env.local'
        )
      }

      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        setIsLoading(false)
        return
      }

      // Wait for session to be established and cookies to be set
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Verify session is established
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session not established. Please try again.')
        setIsLoading(false)
        return
      }

      // Check for redirect parameter, otherwise go to dashboard
      const urlParams = new URLSearchParams(window.location.search)
      let redirect = urlParams.get('redirect') || '/dashboard'
      
      // Extract runId from redirect URL if present (e.g., /runs/[id])
      const runIdMatch = redirect.match(/\/runs\/([^\/]+)/)
      const runId = runIdMatch ? runIdMatch[1] : null
      
      // Claim run if redirect matches /runs/<runId>
      if (runId) {
        try {
          const claimResponse = await fetch('/api/runs/claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ runId }),
          })

          if (!claimResponse.ok) {
            console.error('Failed to claim run')
            // Don't block the flow if claim fails
          }
        } catch (err) {
          console.error('Error claiming run:', err)
          // Don't block the flow if claim fails
        }
      }
      
      // Use window.location for a full page reload to ensure middleware sees the session
      window.location.href = redirect
    } catch (err) {
      console.error('Sign in error:', err)
      let errorMessage = 'An unexpected error occurred'
      
      if (err instanceof Error) {
        errorMessage = err.message
        // Check if it's an environment variable error
        if (err.message.includes('Missing Supabase environment variables') || 
            err.message.includes('Supabase configuration is missing')) {
          errorMessage = 'Configuration error: Supabase credentials not loaded. Please restart your dev server (stop with Ctrl+C, then run: npm run dev)'
        } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = 'Unable to connect to Supabase. Please check: 1) Your internet connection, 2) Supabase URL in .env.local is correct, 3) Dev server was restarted after updating .env.local'
        }
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8] px-4">
      <Card className="w-full max-w-md p-8 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#111827] mb-2">Sign In</h1>
          <p className="text-sm text-[#6B7280]">Sign in to access your dashboard</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
            <p className="text-sm text-[#DC2626]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#111827] mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 placeholder:text-[#6B7280]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#111827] mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 placeholder:text-[#6B7280]"
              placeholder="••••••••"
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isLoading}
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[#6B7280]">
            Don't have an account?{' '}
            <Link href="/signup" className="text-[#F59E0B] hover:text-[#D97706] font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}

