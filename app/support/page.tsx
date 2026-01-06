'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client-auth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { colors } from '@/lib/theme'

function SupportPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userName, setUserName] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const source = searchParams.get('source') || ''
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    topic: '',
    message: '',
  })

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      
      if (session?.user) {
        const email = session.user.email || null
        const name = session.user.user_metadata?.full_name || 
                     session.user.user_metadata?.name || 
                     null
        setUserEmail(email)
        setUserName(name)
        setFormData(prev => ({
          ...prev,
          email: email || '',
          name: name || '',
        }))
      }
      
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    if (!formData.email || !formData.message || !formData.topic) {
      setError('Please fill in all required fields')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          source: source || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to send message')
      }

      if (data.ok !== true) {
        throw new Error('Unexpected response format')
      }

      setSuccess(true)
      setFormData({
        name: '',
        email: '',
        topic: '',
        message: '',
      })
    } catch (err: any) {
      setError(err.message || 'Failed to send message. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }))
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background.primary }}>
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-current border-t-transparent" style={{ color: colors.accent.primary }}></div>
          <p className="mt-4 text-sm" style={{ color: colors.text.secondary }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: colors.background.primary }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text.primary }}>
            Contact Support
          </h1>
          <p className="text-sm" style={{ color: colors.text.secondary }}>
            We're here to help. Send us a message and we'll get back to you as soon as possible.
          </p>
        </div>

        {success ? (
          <Card>
            <div className="text-center py-8">
              <div className="mb-4">
                <svg className="w-16 h-16 mx-auto" style={{ color: colors.success.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: colors.text.primary }}>
                Message Sent Successfully
              </h2>
              <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
                We've received your message and will get back to you soon.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => router.push('/dashboard')}
              >
                Back to Dashboard
              </Button>
            </div>
          </Card>
        ) : (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Name Field */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Name <span className="text-xs" style={{ color: colors.text.tertiary }}>(optional)</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50"
                  style={{
                    backgroundColor: colors.background.secondary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary,
                  }}
                  placeholder="Your name"
                />
              </div>

              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Email <span className="text-xs" style={{ color: colors.error.primary }}>*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50"
                  style={{
                    backgroundColor: colors.background.secondary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary,
                  }}
                  placeholder="your.email@example.com"
                />
              </div>

              {/* Topic Field */}
              <div>
                <label htmlFor="topic" className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Topic <span className="text-xs" style={{ color: colors.error.primary }}>*</span>
                </label>
                <select
                  id="topic"
                  name="topic"
                  value={formData.topic}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50"
                  style={{
                    backgroundColor: colors.background.secondary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary,
                  }}
                >
                  <option value="">Select a topic</option>
                  <option value="bug">Bug / Something isn't working</option>
                  <option value="billing">Billing / Subscription</option>
                  <option value="account">Account / Access</option>
                  <option value="feedback">Feedback / Feature request</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Message Field */}
              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Message <span className="text-xs" style={{ color: colors.error.primary }}>*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50 resize-none"
                  style={{
                    backgroundColor: colors.background.secondary,
                    borderColor: colors.border.primary,
                    color: colors.text.primary,
                  }}
                  placeholder="Please describe your issue or question..."
                />
              </div>

              {/* Hidden source field */}
              {source && (
                <input type="hidden" name="source" value={source} />
              )}

              {/* Error Message */}
              {error && (
                <div className="p-4 rounded-lg border" style={{ 
                  backgroundColor: colors.error.light,
                  borderColor: colors.error.border,
                }}>
                  <p className="text-sm" style={{ color: colors.error.primary }}>
                    {error}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting || success}
                  isLoading={isSubmitting}
                  className="flex-1"
                >
                  Send Message
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => router.push('/dashboard')}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}
      </div>
    </div>
  )
}

export default function SupportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background.primary }}>
        <LoadingSpinner />
      </div>
    }>
      <SupportPageContent />
    </Suspense>
  )
}

