'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { colors } from '@/lib/theme'
import { createClient } from '@/lib/supabase/client-auth'

interface Rubric {
  id: string
  title: string
  description: string | null
  source: 'ai' | 'uploaded' | 'pasted' | 'manual' | null
  last_used_at: string | null
  created_at: string
  criteria: any[]
}

export default function RubricsPage() {
  const router = useRouter()
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingRubricId, setDeletingRubricId] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsAuthenticated(!!session)
      
      if (!session) {
        router.push('/signin?redirect=/rubrics')
        return
      }

      fetchRubrics()
    }

    checkAuth()
  }, [router])

  const fetchRubrics = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/rubrics/user?with_last_used=true')
      
      if (!response.ok) {
        if (response.status === 401) {
          router.push('/signin?redirect=/rubrics')
          return
        }
        throw new Error('Failed to fetch rubrics')
      }

      const data = await response.json()
      setRubrics(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rubrics')
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return 'Never'
    
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

  const getSourceLabel = (source: string | null): string => {
    switch (source) {
      case 'ai':
        return 'AI'
      case 'uploaded':
        return 'Uploaded'
      case 'pasted':
        return 'Pasted'
      case 'manual':
        return 'Manual'
      default:
        return 'Manual'
    }
  }

  const getSourceColor = (source: string | null): string => {
    switch (source) {
      case 'ai':
        return colors.accent.primary
      case 'uploaded':
        return colors.text.secondary
      case 'pasted':
        return colors.text.secondary
      case 'manual':
        return colors.text.secondary
      default:
        return colors.text.secondary
    }
  }

  const handleDelete = async (rubricId: string, e: React.MouseEvent) => {
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
      setRubrics(rubrics.filter(rubric => rubric.id !== rubricId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rubric')
    } finally {
      setDeletingRubricId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: colors.background.primary }}>
        <LoadingSpinner size="lg" text="Loading rubrics..." />
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
              Rubrics
            </h1>
            <p className="text-sm" style={{ color: colors.text.secondary }}>
              Create and manage custom evaluation rubrics
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push('/app/practice')}
            >
              Paste or upload rubric
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => router.push('/app/rubrics/new?mode=ai')}
            >
              Create new rubric (AI)
            </Button>
          </div>
        </div>

        {error && (
          <div 
            className="p-4 mb-6 rounded-xl border"
            style={{ backgroundColor: colors.error.light, borderColor: colors.error.border }}
          >
            <p className="text-sm" style={{ color: colors.error.primary }}>{error}</p>
          </div>
        )}

        {/* Rubrics List */}
        {rubrics.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-sm mb-6" style={{ color: colors.text.secondary }}>
              You haven't created any rubrics yet.
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="secondary"
                size="md"
                onClick={() => router.push('/app/practice')}
              >
                Paste or upload rubric
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={() => router.push('/app/rubrics/new?mode=ai')}
              >
                Create new rubric (AI)
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rubrics.map((rubric) => (
              <div
                key={rubric.id}
                className="group relative"
              >
                <div
                  className="cursor-pointer"
                  onClick={() => router.push(`/app/rubrics/${rubric.id}`)}
                >
                  <Card className="hover:border-[#334155] transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold flex-1" style={{ color: colors.text.primary }}>
                      {rubric.title}
                    </h3>
                  </div>

                  {rubric.description && (
                    <p className="text-sm mb-4 line-clamp-2" style={{ color: colors.text.secondary }}>
                      {rubric.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between text-xs mb-4" style={{ color: colors.text.secondary }}>
                    <div className="flex items-center gap-2">
                      <span
                        className="px-2 py-1 rounded"
                        style={{
                          backgroundColor: `${getSourceColor(rubric.source)}20`,
                          color: getSourceColor(rubric.source),
                        }}
                      >
                        {getSourceLabel(rubric.source)}
                      </span>
                      <span>•</span>
                      <span>{rubric.criteria?.length || 0} criteria</span>
                    </div>
                  </div>

                  <div className="text-xs pt-3 border-t" style={{ borderColor: colors.border.primary, color: colors.text.secondary }}>
                    Last used: {formatDate(rubric.last_used_at)}
                  </div>
                  </Card>
                </div>
                <button
                  onClick={(e) => handleDelete(rubric.id, e)}
                  disabled={deletingRubricId === rubric.id}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 rounded hover:bg-[#1E293B] transition-opacity z-10"
                  style={{ color: colors.text.secondary }}
                  aria-label="Delete rubric"
                >
                  {deletingRubricId === rubric.id ? (
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-current border-t-transparent"></div>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

