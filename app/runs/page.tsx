'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { colors } from '@/lib/theme'
import { createClient } from '@/lib/supabase/client-auth'

interface Run {
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

export default function RunsPage() {
  const router = useRouter()
  const [runs, setRuns] = useState<Run[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      
      if (!session) {
        router.push('/signin?redirect=/runs')
        return
      }

      fetchRuns()
    }

    checkAuth()
  }, [router])

  const fetchRuns = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/runs', {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/signin?redirect=/runs')
          return
        }
        throw new Error('Failed to fetch runs')
      }

      const data = await response.json()
      setRuns(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load runs')
    } finally {
      setIsLoading(false)
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
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
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

  const handleDelete = async (runId: string) => {
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
      setRuns(runs.filter(run => run.id !== runId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete run')
    } finally {
      setDeletingRunId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background.primary }}>
        <LoadingSpinner size="lg" text="Loading runs..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: colors.background.primary }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: colors.text.primary }}>
              Pitch Runs
            </h1>
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              View and manage all your pitch practice sessions
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => router.push('/app/practice')}
          >
            Start New Practice
          </Button>
        </div>

        {error && (
          <div 
            className="p-4 mb-6 rounded-xl border"
            style={{ backgroundColor: colors.error.light, borderColor: colors.error.border }}
          >
            <p className="text-sm" style={{ color: colors.error.primary }}>{error}</p>
          </div>
        )}

        {/* Runs List */}
        {runs.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
              You haven't recorded any pitch runs yet.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push('/app/practice')}
            >
              Start New Practice
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {runs.map((run) => (
              <Card key={run.id} className="p-4">
                <div className="flex items-start justify-between">
                  <Link
                    href={`/runs/${run.id}`}
                    className="flex-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-semibold" style={{ color: colors.text.primary }}>
                        {run.title || 'Untitled pitch'}
                      </h3>
                      <span className={`text-sm ml-4 ${getStatusColor(run.status)}`}>
                        {run.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm" style={{ color: colors.text.secondary }}>
                      {run.rubrics && (
                        <span>{run.rubrics.name}</span>
                      )}
                      {run.audio_seconds && (
                        <span>{formatTime(run.audio_seconds)}</span>
                      )}
                      {run.word_count && (
                        <span>{run.word_count} words</span>
                      )}
                      <span>{formatDate(run.created_at)}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => handleDelete(run.id)}
                    disabled={deletingRunId === run.id}
                    className="ml-4 p-2 rounded hover:bg-[#1E293B] transition-colors"
                    style={{ color: colors.text.secondary }}
                    aria-label="Delete run"
                  >
                    {deletingRunId === run.id ? (
                      <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"></div>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

