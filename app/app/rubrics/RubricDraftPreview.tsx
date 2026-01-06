'use client'

import { Card } from '@/components/ui/Card'

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
}

export default function RubricDraftPreview({ draft }: RubricDraftPreviewProps) {
  if (!draft) {
    return (
      <Card className="h-full bg-white border-[rgba(17,24,39,0.10)]">
        <div className="flex items-center justify-center h-full text-[#6B7280]">
          <div className="text-center">
            <p className="text-sm">No draft yet</p>
            <p className="text-xs mt-2">Start chatting to generate a rubric draft</p>
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
    <Card className="h-full bg-white border-[rgba(17,24,39,0.10)] overflow-y-auto">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[#111827] mb-2">Rubric Draft</h2>
          <div className="h-1 w-12 bg-[#F59E0B] rounded"></div>
        </div>

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

