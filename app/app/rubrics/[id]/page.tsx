'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ArrowLeft, Edit, Trash2, Clock } from 'lucide-react'
import RubricForm from '../RubricForm'

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

export default function RubricDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [rubric, setRubric] = useState<Rubric | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRubric()
  }, [id])

  const fetchRubric = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/rubrics/user/${id}`)

      if (!response.ok) {
        throw new Error('Failed to fetch rubric')
      }

      const data = await response.json()
      setRubric(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rubric')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdate = async (formData: any) => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/rubrics/user/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update rubric')
      }

      const updated = await response.json()
      setRubric(updated)
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rubric')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this rubric? This action cannot be undone.')) {
      return
    }

    try {
      setIsDeleting(true)
      const response = await fetch(`/api/rubrics/user/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete rubric')
      }

      router.push('/app/rubrics')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete rubric')
      setIsDeleting(false)
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
        <div className="max-w-4xl mx-auto">
          <LoadingSpinner size="lg" text="Loading rubric..." />
        </div>
      </div>
    )
  }

  if (error && !rubric) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="p-6 bg-[#FEE2E2] border-[#FCA5A5]">
            <p className="text-sm text-[#DC2626]">{error}</p>
            <Button
              variant="secondary"
              onClick={() => router.push('/app/rubrics')}
              className="mt-4"
            >
              Back to Rubrics
            </Button>
          </Card>
        </div>
      </div>
    )
  }

  if (!rubric) {
    return null
  }

  if (isEditing) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] p-8">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setIsEditing(false)}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to View
          </button>

          <h1 className="text-3xl font-bold text-[#111827] mb-8">Edit Rubric</h1>

          {error && (
            <Card className="p-4 mb-6 bg-[#FEE2E2] border-[#FCA5A5]">
              <p className="text-sm text-[#DC2626]">{error}</p>
            </Card>
          )}

          <RubricForm
            initialData={rubric}
            onSubmit={handleUpdate}
            isSaving={isSaving}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.push('/app/rubrics')}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Rubrics
        </button>

        <div className="flex items-start justify-between mb-8">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-[#111827] mb-2">{rubric.title}</h1>
            {rubric.description && (
              <p className="text-[#6B7280] mb-4">{rubric.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-[#6B7280]">
              {rubric.target_duration_seconds && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span>Target: {formatDuration(rubric.target_duration_seconds)}</span>
                </div>
              )}
              <span>{rubric.criteria.length} criteria</span>
            </div>
          </div>
          <div className="flex gap-2 ml-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              isLoading={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Criteria List */}
        <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
          <h2 className="text-lg font-semibold text-[#111827] mb-4">Criteria</h2>
          <div className="space-y-4">
            {rubric.criteria.map((criterion, index) => (
              <div
                key={criterion.key}
                className="p-4 border border-[rgba(17,24,39,0.10)] rounded-lg bg-[#F3F4F6]"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[#111827] mb-1">
                      {index + 1}. {criterion.label}
                    </h3>
                    {criterion.description && (
                      <p className="text-sm text-[#6B7280] mb-2">{criterion.description}</p>
                    )}
                  </div>
                  <div className="text-sm text-[#6B7280] ml-4">
                    Score: {criterion.min_score || 1}–{criterion.max_score || 10}
                  </div>
                </div>
                {criterion.what_good_looks_like && (
                  <div className="mt-3 pt-3 border-t border-[rgba(17,24,39,0.10)]">
                    <p className="text-xs font-medium text-[#6B7280] mb-1">What Good Looks Like:</p>
                    <p className="text-sm text-[#111827]">{criterion.what_good_looks_like}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

