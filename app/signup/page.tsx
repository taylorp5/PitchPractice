'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client-auth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

export default function SignUpPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      })

      if (signUpError) {
        setError(signUpError.message)
        setIsLoading(false)
        return
      }

      router.push('/app')
      router.refresh()
    } catch (err) {
      setError('An unexpected error occurred')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F7F8] px-4">
      <Card className="w-full max-w-md p-8 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#111827] mb-2">Sign Up</h1>
          <p className="text-sm text-[#6B7280]">Create an account to get started</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
            <p className="text-sm text-[#DC2626]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-[#111827] mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-[#111827] mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-[#6B7280]">Must be at least 6 characters</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#111827] mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
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
            Sign Up
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-[#6B7280]">
            Already have an account?{' '}
            <Link href="/signin" className="text-[#F59E0B] hover:text-[#D97706] font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </Card>
    </div>
  )
}

