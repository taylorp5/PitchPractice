'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Trash2, Loader2, AlertCircle } from 'lucide-react'
import { CustomRubric } from './CustomRubricBuilder'

interface SavedRubric {
  id: string
  title: string
  description: string | null
  criteria: any[] // Legacy field, use rubric_json.criteria instead
  guiding_questions: string[] | null // Legacy field, use rubric_json.guiding_questions instead
  context_summary: string | null // Legacy field, use rubric_json.context_summary instead
  rubric_json?: any // New unified format
  created_at: string
  updated_at: string
}

interface SavedRubricsListProps {
  onSelect: (rubric: CustomRubric) => void
  currentRubric: CustomRubric | null
  disabled?: boolean
}

// Convert saved rubric (DB format) to CustomRubric format
function convertToCustomRubric(saved: SavedRubric): CustomRubric {
  // Use rubric_json if available (new format), otherwise fall back to criteria field
  let criteriaData: any[] = []
  let guidingQuestions: string[] = []
  let contextSummary: string | null = null

  if (saved.rubric_json && typeof saved.rubric_json === 'object') {
    // New format: use rubric_json
    criteriaData = saved.rubric_json.criteria || []
    guidingQuestions = saved.rubric_json.guiding_questions || []
    contextSummary = saved.rubric_json.context_summary || null
  } else {
    // Fallback to old format
    criteriaData = saved.criteria || []
    guidingQuestions = saved.guiding_questions || []
    contextSummary = saved.context_summary || null
  }

  // Convert criteria from DB format to CustomRubric format
  const criteria = criteriaData.map((c, idx) => {
    // Support both old format (key/label) and new format (id/name/description/scoringGuide)
    if (c.id && c.name) {
      // New format
      return {
        id: c.id,
        name: c.name,
        description: c.description || '',
        scoringGuide: c.scoringGuide || c.scoring_guide || '0-10: Scoring guide',
      }
    } else {
      // Old format - convert
      return {
        id: c.key || `criterion-${Date.now()}-${idx}`,
        name: c.label || '',
        description: c.description || '',
        scoringGuide: '0-10: Scoring guide',
      }
    }
  })

  return {
    title: saved.title,
    context: contextSummary || '',
    criteria,
    guidingQuestions,
  }
}

export default function SavedRubricsList({ onSelect, currentRubric, disabled }: SavedRubricsListProps) {
  const [savedRubrics, setSavedRubrics] = useState<SavedRubric[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Load saved rubrics
  useEffect(() => {
    loadSavedRubrics()
  }, [])

  const loadSavedRubrics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/rubrics?scope=mine')
      if (!response.ok) {
        throw new Error('Failed to load saved rubrics')
      }
      const data = await response.json()
      setSavedRubrics(data || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load saved rubrics')
    } finally {
      setIsLoading(false)
    }
  }

  // Convert CustomRubric to DB format (new unified API format)
  const convertToDbFormat = (rubric: CustomRubric) => {
    const rubricJson = {
      criteria: rubric.criteria.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        scoringGuide: c.scoringGuide,
      })),
      guiding_questions: rubric.guidingQuestions,
      context_summary: rubric.context || null,
      scoring_scale: { min: 0, max: 10 },
    }

    return {
      title: rubric.title,
      description: rubric.context || null,
      rubric_json: rubricJson,
    }
  }

  const handleSave = async () => {
    if (!currentRubric || !currentRubric.title.trim() || currentRubric.criteria.length < 3) {
      alert('Please provide a rubric name and at least 3 criteria before saving.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const dbFormat = convertToDbFormat(currentRubric)
      const response = await fetch('/api/rubrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dbFormat),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save rubric')
      }

      await loadSavedRubrics()
      alert('Rubric saved successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to save rubric')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedId) {
      alert('Please select a rubric to update.')
      return
    }

    if (!currentRubric || !currentRubric.title.trim() || currentRubric.criteria.length < 3) {
      alert('Please provide a rubric name and at least 3 criteria before updating.')
      return
    }

    setIsUpdating(true)
    setError(null)

    try {
      const dbFormat = convertToDbFormat(currentRubric)
      const response = await fetch(`/api/rubrics/${selectedId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dbFormat),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update rubric')
      }

      await loadSavedRubrics()
      alert('Rubric updated successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to update rubric')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = async (id: string) => {
    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/rubrics/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete rubric')
      }

      await loadSavedRubrics()
      if (selectedId === id) {
        setSelectedId(null)
      }
      setShowDeleteConfirm(null)
    } catch (err: any) {
      setError(err.message || 'Failed to delete rubric')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSelect = (rubric: SavedRubric) => {
    setSelectedId(rubric.id)
    const customRubric = convertToCustomRubric(rubric)
    onSelect(customRubric)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#111827]">Saved Rubrics</h3>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || disabled || !currentRubric}
            className="text-xs"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              'Save new'
            )}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleUpdate}
            disabled={isUpdating || disabled || !selectedId || !currentRubric}
            className="text-xs"
          >
            {isUpdating ? (
              <>
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Updating...
              </>
            ) : (
              'Update'
            )}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-2 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[#DC2626]" />
          <p className="text-xs text-[#DC2626]">{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-[#6B7280] mx-auto" />
        </div>
      ) : savedRubrics.length === 0 ? (
        <p className="text-xs text-[#6B7280] text-center py-4">
          No saved rubrics yet. Create one and click "Save new" to get started.
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {savedRubrics.map((rubric) => (
            <div
              key={rubric.id}
              className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedId === rubric.id
                  ? 'border-[#F59E0B] bg-[#FEF3C7]'
                  : 'border-[rgba(17,24,39,0.10)] bg-white hover:bg-[#F9FAFB]'
              }`}
              onClick={() => handleSelect(rubric)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-medium text-[#111827] truncate">
                    {rubric.title}
                  </h4>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {rubric.criteria?.length || 0} criteria
                    {rubric.guiding_questions && rubric.guiding_questions.length > 0 && (
                      <> • {rubric.guiding_questions.length} questions</>
                    )}
                  </p>
                  <p className="text-xs text-[#6B7280] mt-1">
                    {new Date(rubric.updated_at || rubric.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowDeleteConfirm(rubric.id)
                  }}
                  disabled={disabled || isDeleting}
                  className="flex-shrink-0 p-1 text-[#EF4444] hover:text-[#DC2626] disabled:opacity-50"
                  aria-label="Delete rubric"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-[#111827] mb-2">Delete Rubric?</h3>
            <p className="text-sm text-[#6B7280] mb-4">
              Are you sure you want to delete this rubric? This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDelete(showDeleteConfirm)}
                disabled={isDeleting}
                className="bg-[#EF4444] hover:bg-[#DC2626]"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

