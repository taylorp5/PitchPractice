'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ArrowLeft } from 'lucide-react'
import RubricForm from '../RubricForm'

export default function NewRubricPage() {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (formData: any) => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch('/api/rubrics/user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create rubric')
      }

      const rubric = await response.json()
      router.push(`/app/rubrics/${rubric.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rubric')
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-8">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Rubrics
        </button>

        <h1 className="text-3xl font-bold text-[#111827] mb-8">Create New Rubric</h1>

        {error && (
          <Card className="p-4 mb-6 bg-[#FEE2E2] border-[#FCA5A5]">
            <p className="text-sm text-[#DC2626]">{error}</p>
          </Card>
        )}

        <RubricForm onSubmit={handleSubmit} isSaving={isSaving} />
      </div>
    </div>
  )
}

