'use client'

import { Card } from '@/components/ui/Card'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface RubricDraft {
  title: string
  description: string | null
  target_duration_seconds: number | null
  criteria: Array<{
    name: string
    description: string
  }>
}

interface RubricDraftPreviewProps {
  draft: RubricDraft | null
  parseError?: string | null
}

export default function RubricDraftPreview({ draft, parseError }: RubricDraftPreviewProps) {
  if (!draft) {
    return (
      <Card className="h-full bg-white border-[rgba(17,24,39,0.10)] flex flex-col">
        <div className="p-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-2">Rubric Draft</h2>
          <div className="h-1 w-12 bg-[#F59E0B] rounded mb-6"></div>
        </div>
        <div className="flex-1 flex items-center justify-center text-[#6B7280]">
          <div className="text-center px-6">
            <p className="text-sm font-medium mb-2">No draft yet</p>
            <p className="text-xs">Start chatting with the AI to generate a rubric draft</p>
            <p className="text-xs mt-2 text-[#9CA3AF]">
              The draft will appear here as you chat
            </p>
          </div>
        </div>
      </Card>
    )
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins > 0) {
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
    }
    return `${secs}s`
  }

  return (
    <Card className="h-full bg-white border-[rgba(17,24,39,0.10)] overflow-y-auto flex flex-col">
      <div className="p-6 space-y-6 flex-1">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-lg font-semibold text-[#111827]">Rubric Draft</h2>
            {!parseError && (
              <div title="Valid draft">
                <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
              </div>
            )}
          </div>
          <div className="h-1 w-12 bg-[#F59E0B] rounded"></div>
        </div>

        {parseError && (
          <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-[#D97706] flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-medium text-[#92400E] mb-1">Parsing Warning</p>
              <p className="text-xs text-[#92400E]">{parseError}</p>
              <p className="text-xs text-[#92400E] mt-1">Showing last valid draft below.</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-1">
              Title
            </label>
            <p className="text-base font-medium text-[#111827]">{draft.title}</p>
          </div>

          {draft.description && (
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">
                Description
              </label>
              <p className="text-sm text-[#111827] whitespace-pre-wrap">{draft.description}</p>
            </div>
          )}

          {draft.target_duration_seconds && (
            <div>
              <label className="block text-xs font-medium text-[#6B7280] mb-1">
                Target Duration
              </label>
              <p className="text-sm text-[#111827]">
                {formatDuration(draft.target_duration_seconds)}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-2">
              Criteria ({draft.criteria.length})
            </label>
            <div className="space-y-3">
              {draft.criteria.map((criterion, index) => (
                <div
                  key={index}
                  className="p-3 border border-[rgba(17,24,39,0.10)] rounded-lg bg-[#F9FAFB]"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-xs font-medium text-[#6B7280] bg-white px-2 py-0.5 rounded">
                      {index + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-[#111827] flex-1">
                      {criterion.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[#6B7280] ml-7 mt-1">
                    {criterion.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

