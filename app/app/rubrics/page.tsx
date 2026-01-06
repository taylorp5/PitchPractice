'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Plus, Edit, Trash2, Clock, Info } from 'lucide-react'
import { getUserPlan, type UserPlan } from '@/lib/plan'

interface Criterion {
  key: string
  label: string
  description?: string
  weight?: number
  min_score?: number
  max_score?: number
  what_good_looks_like?: string
}

interface Rubric {
  id: string
  title: string
  description: string | null
  target_duration_seconds: number | null
  criteria: Criterion[]
  created_at: string
  updated_at: string
}

export default function RubricsPage() {
  const router = useRouter()
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<UserPlan>('free')

  useEffect(() => {
    fetchRubrics()
    getUserPlan().then(plan => setUserPlan(plan))
  }, [])

  const fetchRubrics = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/rubrics/user')
      
      if (!response.ok) {
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

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this rubric?')) {
      return
    }

    try {
      setDeletingId(id)
      const response = await fetch(`/api/rubrics/user/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete rubric')
      }

      setRubrics(rubrics.filter(r => r.id !== id))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete rubric')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] p-8">
        <div className="max-w-7xl mx-auto">
          <LoadingSpinner size="lg" text="Loading rubrics..." />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#111827] mb-2">My Rubrics</h1>
            <p className="text-[#6B7280]">Create and manage custom evaluation rubrics</p>
          </div>
          {userPlan === 'free' ? (
            <div className="relative">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {}}
                disabled={true}
                className="opacity-50 cursor-not-allowed"
                title="Custom rubrics require Starter plan or higher"
              >
                <Plus className="mr-2 h-5 w-5" />
                New Rubric
              </Button>
              <div className="absolute -bottom-8 right-0 bg-[#111827] text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 hover:opacity-100 pointer-events-none transition-opacity z-10">
                Custom rubrics require Starter plan or higher
              </div>
            </div>
          ) : (
            <Button
              variant="primary"
              size="lg"
              onClick={() => router.push('/app/rubrics/new')}
            >
              <Plus className="mr-2 h-5 w-5" />
              New Rubric
            </Button>
          )}
        </div>

        {error && (
          <Card className="p-4 mb-6 bg-[#FEE2E2] border-[#FCA5A5]">
            <p className="text-sm text-[#DC2626]">{error}</p>
          </Card>
        )}

        {/* Rubrics Grid */}
        {rubrics.length === 0 ? (
          <Card className="p-12 bg-white border-[rgba(17,24,39,0.10)] shadow-sm text-center">
            {userPlan === 'free' ? (
              <>
                <p className="text-[#6B7280] mb-4">Free plan users can only use default rubrics.</p>
                <Card className="p-4 mb-4 bg-[#FEF3C7] border-[#FCD34D] inline-block">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-[#D97706] flex-shrink-0 mt-0.5" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-[#92400E] mb-1">Upgrade to Create Custom Rubrics</p>
                      <p className="text-xs text-[#92400E]">
                        Starter plan: Upload or paste rubrics<br />
                        Coach plan: Full AI rubric creation and editing
                      </p>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <>
                <p className="text-[#6B7280] mb-4">You haven't created any rubrics yet.</p>
                <Button
                  variant="primary"
                  onClick={() => router.push('/app/rubrics/new')}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Rubric
                </Button>
              </>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rubrics.map((rubric) => (
              <Card
                key={rubric.id}
                className="p-6 bg-white border-[rgba(17,24,39,0.10)] shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-semibold text-[#111827] flex-1">
                    {rubric.title}
                  </h3>
                  <div className="flex gap-2 ml-2">
                    <button
                      onClick={() => router.push(`/app/rubrics/${rubric.id}`)}
                      className="p-1.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded transition-colors"
                      aria-label="Edit rubric"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rubric.id)}
                      disabled={deletingId === rubric.id}
                      className="p-1.5 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors disabled:opacity-50"
                      aria-label="Delete rubric"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {rubric.description && (
                  <p className="text-sm text-[#6B7280] mb-3 line-clamp-2">
                    {rubric.description}
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-[#6B7280] mb-4">
                  {rubric.target_duration_seconds && (
                    <div className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{formatDuration(rubric.target_duration_seconds)}</span>
                    </div>
                  )}
                  <span>{rubric.criteria.length} criteria</span>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(`/app/rubrics/${rubric.id}`)}
                  className="w-full"
                >
                  View Details
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


