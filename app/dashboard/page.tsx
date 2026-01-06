'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client-auth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { colors } from '@/lib/theme'
import { getUserPlan, UserPlan } from '@/lib/plan'
import { canViewPremiumInsights, canEditRubrics } from '@/lib/entitlements'

interface RecentRun {
  id: string
  title: string | null
  created_at: string
  status: string
  audio_seconds: number | null
  duration_ms: number | null
  word_count: number | null
  rubric_id: string | null
  rubrics: {
    name: string
  } | null
}

interface RecentRubric {
  id: string
  title: string
  description: string | null
  created_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([])
  const [recentRubrics, setRecentRubrics] = useState<RecentRubric[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(false)
  const [isLoadingRubrics, setIsLoadingRubrics] = useState(false)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)
  const [deletingRubricId, setDeletingRubricId] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<UserPlan>('free')

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      
      if (session?.user) {
        setUserName(session.user.user_metadata?.full_name || session.user.user_metadata?.name || null)
      }
      
      setIsLoading(false)
      
      if (!session) {
        router.push('/signin?redirect=/dashboard')
        return
      }

      // Get user plan
      getUserPlan().then(plan => {
        setUserPlan(plan)
      })

      // Fetch data if authenticated
      fetchRecentRuns()
      fetchRecentRubrics()
    }

    checkAuth()
  }, [router])

  const fetchRecentRuns = async () => {
    setIsLoadingRuns(true)
    try {
      const response = await fetch('/api/runs', {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          setRecentRuns([])
          return
        }
        throw new Error('Failed to fetch runs')
      }
      
      const data = await response.json()
      const runs = Array.isArray(data) ? data : []
      // Limit to last 3
      setRecentRuns(runs.slice(0, 3))
    } catch (err) {
      console.error('Failed to fetch recent runs:', err)
      setRecentRuns([])
    } finally {
      setIsLoadingRuns(false)
    }
  }

  const fetchRecentRubrics = async () => {
    setIsLoadingRubrics(true)
    try {
      const response = await fetch('/api/rubrics/user')
      
      if (!response.ok) {
        if (response.status === 401) {
          setRecentRubrics([])
          return
        }
        throw new Error('Failed to fetch rubrics')
      }
      
      const data = await response.json()
      const rubrics = Array.isArray(data) ? data : []
      // Limit to last 3
      setRecentRubrics(rubrics.slice(0, 3))
    } catch (err) {
      console.error('Failed to fetch recent rubrics:', err)
      setRecentRubrics([])
    } finally {
      setIsLoadingRubrics(false)
    }
  }

  const formatTime = (seconds: number | null): string => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this pitch run? This action cannot be undone.')) {
      return
    }

    setDeletingRunId(runId)
    try {
      const response = await fetch(`/api/runs/${runId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete run')
      }

      // Remove from UI immediately
      setRecentRuns(recentRuns.filter(run => run.id !== runId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete run')
    } finally {
      setDeletingRunId(null)
    }
  }

  const handleDeleteRubric = async (rubricId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Are you sure you want to delete this rubric? This action cannot be undone.')) {
      return
    }

    setDeletingRubricId(rubricId)
    try {
      const response = await fetch(`/api/rubrics/${rubricId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete rubric')
      }

      // Remove from UI immediately
      setRecentRubrics(recentRubrics.filter(rubric => rubric.id !== rubricId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rubric')
    } finally {
      setDeletingRubricId(null)
    }
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'analyzed':
        return 'text-[#22C55E]'
      case 'transcribed':
        return 'text-[#F59E0B]'
      case 'uploaded':
        return 'text-[#6B7280]'
      case 'error':
        return 'text-[#EF4444]'
      default:
        return 'text-[#6B7280]'
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
      <div className="max-w-7xl mx-auto">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text.primary }}>
            Welcome back{userName ? `, ${userName}` : ''}
          </h1>
          <p className="text-sm" style={{ color: colors.text.secondary }}>
            Continue practicing your pitch or manage your rubrics
          </p>
        </div>

        {/* Primary action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div 
            className="cursor-pointer"
            onClick={() => router.push('/app/practice')}
          >
            <Card className="hover:border-[#334155] transition-colors">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2" style={{ color: colors.text.primary }}>
                    Practice your pitch
                  </h2>
                  <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>
                    Record a new pitch and get AI-powered feedback
                  </p>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push('/app/practice')
                    }}
                  >
                    Start Practice
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <Card className="hover:border-[#334155] transition-colors">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-xl font-semibold mb-2" style={{ color: colors.text.primary }}>
                  Rubrics
                </h2>
                <p className="text-sm mb-4" style={{ color: colors.text.secondary }}>
                  Create and manage custom rubrics for your pitches
                </p>
                <div className="flex gap-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/app/rubrics')}
                  >
                    View Rubrics
                  </Button>
                  {canViewPremiumInsights(userPlan) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => router.push('/app/rubrics/new')}
                    >
                      Create new rubric (AI)
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Free-tier helper message for expired Day Pass users */}
        {!canViewPremiumInsights(userPlan) && (
          <Card className="mb-6 p-4 bg-[#1A1F2E] border border-[#F59E0B]/30">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-sm text-[#E5E7EB] mb-2">
                  Upgrade to Coach for Premium Insights, drills, and progress tracking.
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => router.push('/upgrade?plan=coach')}
                >
                  Upgrade to Coach
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Secondary section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent pitch runs */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                Recent pitch runs
              </h2>
              <Link
                href="/runs"
                className="text-sm hover:underline"
                style={{ color: colors.accent.primary }}
                onClick={(e) => e.stopPropagation()}
              >
                See all
              </Link>
            </div>
            {isLoadingRuns ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent" style={{ color: colors.accent.primary }}></div>
                <p className="mt-2 text-xs" style={{ color: colors.text.secondary }}>Loading...</p>
              </div>
            ) : recentRuns.length === 0 ? (
              <p className="text-sm py-4" style={{ color: colors.text.secondary }}>
                No pitch runs yet. Start practicing to see your runs here.
              </p>
            ) : (
              <div className="space-y-3">
                {recentRuns.map((run) => (
                  <div
                    key={run.id}
                    className="group relative p-3 rounded-lg border transition-colors hover:border-[#334155] hover:bg-[#0F172A]/30"
                    style={{ borderColor: colors.border.primary }}
                  >
                    <Link
                      href={`/runs/${run.id}`}
                      className="block"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-sm font-medium truncate flex-1" style={{ color: colors.text.primary }}>
                          {run.title || 'Untitled pitch'}
                        </h3>
                        <span className={`text-xs ml-2 ${getStatusColor(run.status)}`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs" style={{ color: colors.text.secondary }}>
                        {run.rubrics && (
                          <span>{run.rubrics.name}</span>
                        )}
                        {run.audio_seconds && (
                          <span>{formatTime(run.audio_seconds)}</span>
                        )}
                        <span>{formatDate(run.created_at)}</span>
                      </div>
                    </Link>
                    <button
                      onClick={(e) => handleDeleteRun(run.id, e)}
                      disabled={deletingRunId === run.id}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#1E293B] transition-opacity"
                      style={{ color: colors.text.secondary }}
                      aria-label="Delete run"
                    >
                      {deletingRunId === run.id ? (
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Recent rubrics */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                Recent rubrics
              </h2>
              <Link
                href="/rubrics"
                className="text-sm hover:underline"
                style={{ color: colors.accent.primary }}
                onClick={(e) => e.stopPropagation()}
              >
                See all
              </Link>
            </div>
            {isLoadingRubrics ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-current border-t-transparent" style={{ color: colors.accent.primary }}></div>
                <p className="mt-2 text-xs" style={{ color: colors.text.secondary }}>Loading...</p>
              </div>
            ) : recentRubrics.length === 0 ? (
              <p className="text-sm py-4" style={{ color: colors.text.secondary }}>
                No rubrics yet. Create your first rubric to get started.
              </p>
            ) : (
              <div className="space-y-3">
                {recentRubrics.map((rubric) => (
                  <div
                    key={rubric.id}
                    className="group relative p-3 rounded-lg border transition-colors hover:border-[#334155] hover:bg-[#0F172A]/30"
                    style={{ borderColor: colors.border.primary }}
                  >
                    <Link
                      href={`/app/rubrics/${rubric.id}`}
                      className="block"
                    >
                      <h3 className="text-sm font-medium mb-1" style={{ color: colors.text.primary }}>
                        {rubric.title}
                      </h3>
                      {rubric.description && (
                        <p className="text-xs mb-2 line-clamp-2" style={{ color: colors.text.secondary }}>
                          {rubric.description}
                        </p>
                      )}
                      <span className="text-xs" style={{ color: colors.text.secondary }}>
                        {formatDate(rubric.created_at)}
                      </span>
                    </Link>
                    <button
                      onClick={(e) => handleDeleteRubric(rubric.id, e)}
                      disabled={deletingRubricId === rubric.id}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[#1E293B] transition-opacity"
                      style={{ color: colors.text.secondary }}
                      aria-label="Delete rubric"
                    >
                      {deletingRubricId === rubric.id ? (
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

