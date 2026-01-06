'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client-auth'
import { Button } from './ui/Button'
import { X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface SignInModalProps {
  isOpen: boolean
  onClose: () => void
  runId: string | null
}

export function SignInModal({ isOpen, onClose, runId }: SignInModalProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [confirmPassword, setConfirmPassword] = useState('')

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setError(null)
      setIsSignUp(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        return
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        return
      }
    }

    setIsLoading(true)

    try {
      const supabase = createClient()
      
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          setError(signUpError.message)
          setIsLoading(false)
          return
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          setError(signInError.message)
          setIsLoading(false)
          return
        }
      }

      // Wait for session to be established
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Verify session is established
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Session not established. Please try again.')
        setIsLoading(false)
        return
      }

      // Attach anonymous run to user if runId exists
      if (runId) {
        try {
          const response = await fetch(`/api/runs/${runId}/attach`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            console.error('Failed to attach run to user')
            // Don't block the flow if attachment fails
          }
        } catch (err) {
          console.error('Error attaching run:', err)
          // Don't block the flow if attachment fails
        }
      }

      // Close modal and redirect to run detail page
      onClose()
      if (runId) {
        router.push(`/runs/${runId}`)
      } else {
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Auth error:', err)
      setError(err.message || 'An unexpected error occurred')
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-[#0E1117] border border-[#22283A] rounded-lg shadow-xl max-w-md w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#E5E7EB] mb-2">
            Save and review your feedback
          </h2>
          <p className="text-sm text-[#9CA3AF]">
            Your full line-by-line feedback is ready. Create a free account to save this run and review it anytime.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="modal-email" className="block text-sm font-medium text-[#E5E7EB] mb-2">
              Email
            </label>
            <input
              id="modal-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 border border-[#22283A] rounded-lg text-[#E5E7EB] bg-[#151A23] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 placeholder:text-[#6B7280]"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="modal-password" className="block text-sm font-medium text-[#E5E7EB] mb-2">
              Password
            </label>
            <input
              id="modal-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="w-full px-3 py-2 border border-[#22283A] rounded-lg text-[#E5E7EB] bg-[#151A23] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 placeholder:text-[#6B7280]"
              placeholder="••••••••"
            />
            {isSignUp && (
              <p className="mt-1 text-xs text-[#9CA3AF]">Must be at least 6 characters</p>
            )}
          </div>

          {isSignUp && (
            <div>
              <label htmlFor="modal-confirm-password" className="block text-sm font-medium text-[#E5E7EB] mb-2">
                Confirm Password
              </label>
              <input
                id="modal-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-[#22283A] rounded-lg text-[#E5E7EB] bg-[#151A23] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 placeholder:text-[#6B7280]"
                placeholder="••••••••"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              variant="primary"
              className="flex-1"
              disabled={isLoading}
              isLoading={isLoading}
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-sm text-[#9CA3AF] hover:text-[#E5E7EB] transition-colors"
          >
            {isSignUp ? (
              <>Already have an account? <span className="text-[#F59E0B] font-medium">Sign in</span></>
            ) : (
              <>Don't have an account? <span className="text-[#F59E0B] font-medium">Sign up</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

