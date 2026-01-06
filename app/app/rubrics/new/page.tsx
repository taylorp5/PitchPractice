'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ArrowLeft, Sparkles, FileText, Info } from 'lucide-react'
import RubricForm from '../RubricForm'
import AIBuilderChat from '../AIBuilderChat'
import RubricDraftPreview from '../RubricDraftPreview'
import { getUserPlan, type UserPlan } from '@/lib/plan'

type Mode = 'manual' | 'ai'

interface RubricDraft {
  title: string
  description: string | null
  target_duration_seconds: number | null
  criteria: Array<{
    name: string
    description: string
  }>
}

export default function NewRubricPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('manual')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiDraft, setAiDraft] = useState<RubricDraft | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [userPlan, setUserPlan] = useState<UserPlan>('free')
  const [isLoadingPlan, setIsLoadingPlan] = useState(true)

  useEffect(() => {
    getUserPlan().then(plan => {
      setUserPlan(plan)
      setIsLoadingPlan(false)
      // Free users can only use manual mode
      if (plan === 'free' && mode === 'ai') {
        setMode('manual')
      }
    })
  }, [])

  const handleSubmit = async (formData: any) => {
    setIsSaving(true)
    setError(null)

    try {
      // Set source based on mode if not already set
      if (!formData.source) {
        formData.source = mode === 'ai' ? 'ai' : 'manual'
      }

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

  const handleAcceptAIDraft = async (draft: RubricDraft) => {
    setIsSaving(true)
    setError(null)

    try {
      // Convert AI draft format to form format
      const formData = {
        title: draft.title,
        description: draft.description,
        target_duration_seconds: draft.target_duration_seconds,
        criteria: draft.criteria.map((c, index) => ({
          key: `criterion-${Date.now()}-${index}`,
          label: c.name,
          description: c.description,
          min_score: 1,
          max_score: 10,
        })),
        source: 'ai',
      }

      await handleSubmit(formData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rubric')
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-8">
      <div className={`mx-auto ${mode === 'ai' ? 'max-w-7xl' : 'max-w-4xl'}`}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] mb-6 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Rubrics
        </button>

        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-[#111827]">Create New Rubric</h1>
          
          {/* Mode Toggle */}
          <div className="flex items-center gap-2 bg-white border border-[rgba(17,24,39,0.10)] rounded-lg p-1">
            <button
              onClick={() => setMode('manual')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-[#F59E0B] text-[#0B0F14]'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <FileText className="h-4 w-4" />
              Manual
            </button>
            <button
              onClick={() => setMode('ai')}
              disabled={userPlan === 'free'}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors relative ${
                mode === 'ai'
                  ? 'bg-[#F59E0B] text-[#0B0F14]'
                  : userPlan === 'free'
                  ? 'text-[#9CA3AF] cursor-not-allowed opacity-50'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
              title={userPlan === 'free' ? 'AI rubric generation requires Coach or Day Pass plan' : undefined}
            >
              <Sparkles className="h-4 w-4" />
              Build with AI
            </button>
          </div>
        </div>

        {error && (
          <Card className="p-4 mb-6 bg-[#FEE2E2] border-[#FCA5A5]">
            <p className="text-sm text-[#DC2626]">{error}</p>
          </Card>
        )}

        {mode === 'manual' ? (
          <RubricForm onSubmit={handleSubmit} isSaving={isSaving} />
        ) : (
          <>
            {userPlan === 'daypass' && (
              <Card className="p-4 mb-6 bg-[#FEF3C7] border-[#FCD34D]">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-[#D97706] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#92400E] mb-1">Read-only Mode</p>
                    <p className="text-xs text-[#92400E]">
                      Day Pass users can generate AI rubrics, but they cannot be saved or edited. Editing is available on Coach plan.
                    </p>
                  </div>
                </div>
              </Card>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 16rem)' }}>
              <div className="flex flex-col min-h-0">
                <AIBuilderChat
                  onDraftUpdate={setAiDraft}
                  onAcceptDraft={handleAcceptAIDraft}
                  onParseError={setParseError}
                  userPlan={userPlan}
                />
              </div>
              <div className="flex flex-col min-h-0">
                <RubricDraftPreview draft={aiDraft} parseError={parseError} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

