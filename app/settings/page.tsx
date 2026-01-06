'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client-auth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getUserPlan, type UserPlan } from '@/lib/plan'
import { colors } from '@/lib/theme'

export default function SettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<UserPlan>('free')
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      
      if (session?.user) {
        setUserEmail(session.user.email || null)
      }
      
      // Get user plan
      const plan = await getUserPlan()
      setUserPlan(plan)
      
      setIsLoading(false)
      
      if (!session) {
        router.push('/signin?redirect=/settings')
      }
    }

    checkAuth()
  }, [router])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError('New passwords do not match')
      return
    }

    if (passwordForm.new.length < 6) {
      setPasswordError('Password must be at least 6 characters')
      return
    }

    setIsChangingPassword(true)

    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newPassword: passwordForm.new,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change password')
      }

      setPasswordSuccess(true)
      setPasswordForm({ current: '', new: '', confirm: '' })
      setTimeout(() => setPasswordSuccess(false), 3000)
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') {
      setDeleteError('Please type DELETE to confirm')
      return
    }

    setIsDeletingAccount(true)
    setDeleteError(null)

    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete account')
      }

      // Sign out and redirect
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account')
      setIsDeletingAccount(false)
    }
  }

  const getPlanLabel = (plan: UserPlan): string => {
    switch (plan) {
      case 'free':
        return 'Free'
      case 'starter':
        return 'Starter'
      case 'coach':
        return 'Coach'
      case 'daypass':
        return 'Day Pass'
      default:
        return 'Free'
    }
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

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: colors.background.primary }}>
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text.primary }}>
            Settings
          </h1>
          <p className="text-sm" style={{ color: colors.text.secondary }}>
            Manage your account settings and preferences
          </p>
        </div>

        <div className="space-y-6">
          {/* Account Section */}
          <Card>
            <h2 className="text-xl font-semibold mb-6" style={{ color: colors.text.primary }}>
              Account
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Email
                </label>
                <div className="px-4 py-2 rounded-lg border" style={{ 
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.primary,
                  color: colors.text.tertiary 
                }}>
                  {userEmail || 'Not available'}
                </div>
                <p className="mt-1 text-xs" style={{ color: colors.text.tertiary }}>
                  Email cannot be changed
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Change Password
                </label>
                <form onSubmit={handleChangePassword} className="space-y-3">
                  <input
                    type="password"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                    placeholder="New password"
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50"
                    style={{
                      backgroundColor: colors.background.secondary,
                      borderColor: colors.border.primary,
                      color: colors.text.primary,
                    }}
                    required
                    minLength={6}
                  />
                  <input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    placeholder="Confirm new password"
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50"
                    style={{
                      backgroundColor: colors.background.secondary,
                      borderColor: colors.border.primary,
                      color: colors.text.primary,
                    }}
                    required
                    minLength={6}
                  />
                  {passwordError && (
                    <p className="text-sm" style={{ color: colors.error.primary }}>
                      {passwordError}
                    </p>
                  )}
                  {passwordSuccess && (
                    <p className="text-sm" style={{ color: colors.success.primary }}>
                      Password changed successfully
                    </p>
                  )}
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isChangingPassword}
                    isLoading={isChangingPassword}
                  >
                    Change Password
                  </Button>
                </form>
              </div>

              <div className="pt-4 border-t" style={{ borderColor: colors.border.primary }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleSignOut}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </Card>

          {/* Billing Section */}
          <Card>
            <h2 className="text-xl font-semibold mb-6" style={{ color: colors.text.primary }}>
              Billing
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: colors.text.secondary }}>
                  Current Plan
                </label>
                <div className="px-4 py-2 rounded-lg border inline-block" style={{ 
                  backgroundColor: colors.background.secondary,
                  borderColor: colors.border.primary,
                  color: colors.text.primary 
                }}>
                  {getPlanLabel(userPlan)}
                </div>
              </div>
              <div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/stripe/portal', {
                        method: 'POST',
                      })
                      const data = await response.json()
                      if (data.ok && data.url) {
                        window.location.href = data.url
                      } else {
                        alert(data.error || 'Failed to open billing portal')
                      }
                    } catch (error: any) {
                      alert('Failed to open billing portal. Please try again.')
                    }
                  }}
                >
                  Manage subscription
                </Button>
              </div>
            </div>
          </Card>

          {/* Support Section */}
          <Card>
            <h2 className="text-xl font-semibold mb-6" style={{ color: colors.text.primary }}>
              Support
            </h2>
            <div>
              <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>
                Need help? Contact our support team.
              </p>
              <a
                href="mailto:support@pitchpractice.com"
                className="inline-block px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#F59E0B]/50"
                style={{
                  backgroundColor: colors.accent.primary,
                  color: colors.background.primary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.accent.hover
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.accent.primary
                }}
              >
                Contact Support
              </a>
            </div>
          </Card>

          {/* Danger Zone */}
          <Card style={{ borderColor: colors.error.border }}>
            <h2 className="text-xl font-semibold mb-6" style={{ color: colors.error.primary }}>
              Danger Zone
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>
                  Deleting your account will permanently remove all your data, including pitch runs, rubrics, and subscriptions. This action cannot be undone.
                </p>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => {
                      setDeleteConfirm(e.target.value)
                      setDeleteError(null)
                    }}
                    placeholder="Type DELETE to confirm"
                    className="w-full px-4 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B0F14] focus:ring-[#EF4444]/50"
                    style={{
                      backgroundColor: colors.background.secondary,
                      borderColor: colors.error.border,
                      color: colors.text.primary,
                    }}
                  />
                  {deleteError && (
                    <p className="text-sm" style={{ color: colors.error.primary }}>
                      {deleteError}
                    </p>
                  )}
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleDeleteAccount}
                    disabled={isDeletingAccount || deleteConfirm !== 'DELETE'}
                    isLoading={isDeletingAccount}
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

