'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Plus, GripVertical, Trash2, X } from 'lucide-react'

interface Criterion {
  key: string
  label: string
  description?: string
  weight?: number
  min_score?: number
  max_score?: number
  what_good_looks_like?: string
}

interface RubricFormProps {
  initialData?: {
    title: string
    description: string | null
    target_duration_seconds: number | null
    criteria: Criterion[]
  }
  onSubmit: (data: {
    title: string
    description: string | null
    target_duration_seconds: number | null
    criteria: Criterion[]
  }) => void
  isSaving: boolean
}

export default function RubricForm({ initialData, onSubmit, isSaving }: RubricFormProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [targetDuration, setTargetDuration] = useState(initialData?.target_duration_seconds?.toString() || '')
  const [criteria, setCriteria] = useState<Criterion[]>(
    initialData?.criteria || [
      { key: `criterion-${Date.now()}-1`, label: '', min_score: 1, max_score: 10 },
      { key: `criterion-${Date.now()}-2`, label: '', min_score: 1, max_score: 10 },
      { key: `criterion-${Date.now()}-3`, label: '', min_score: 1, max_score: 10 },
    ]
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

  const addCriterion = () => {
    const newKey = `criterion-${Date.now()}`
    setCriteria([
      ...criteria,
      { key: newKey, label: '', min_score: 1, max_score: 10 },
    ])
  }

  const removeCriterion = (index: number) => {
    if (criteria.length <= 3) {
      alert('At least 3 criteria are required')
      return
    }
    setCriteria(criteria.filter((_, i) => i !== index))
  }

  const updateCriterion = (index: number, field: keyof Criterion, value: any) => {
    const updated = [...criteria]
    updated[index] = { ...updated[index], [field]: value }
    setCriteria(updated)
  }

  const moveCriterion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === criteria.length - 1)
    ) {
      return
    }

    const updated = [...criteria]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    ;[updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]]
    setCriteria(updated)
  }

  const validate = () => {
    const newErrors: Record<string, string> = {}

    if (!title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (criteria.length < 3) {
      newErrors.criteria = 'At least 3 criteria are required'
    }

    criteria.forEach((criterion, index) => {
      if (!criterion.label.trim()) {
        newErrors[`criterion-${index}-label`] = 'Label is required'
      }
      if (!criterion.key) {
        newErrors[`criterion-${index}-key`] = 'Key is required'
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      return
    }

    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      target_duration_seconds: targetDuration ? parseInt(targetDuration) : null,
      criteria: criteria.map(c => ({
        key: c.key,
        label: c.label.trim(),
        description: c.description?.trim() || undefined,
        weight: c.weight || undefined,
        min_score: c.min_score || 1,
        max_score: c.max_score || 10,
        what_good_looks_like: c.what_good_looks_like?.trim() || undefined,
      })),
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Info */}
      <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
        <h2 className="text-lg font-semibold text-[#111827] mb-4">Basic Information</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-[#111827] mb-1">
              Title <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent ${
                errors.title ? 'border-[#DC2626]' : 'border-[rgba(17,24,39,0.10)]'
              }`}
              placeholder="e.g., Sales Pitch Rubric"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-[#DC2626]">{errors.title}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-[#111827] mb-1">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
              placeholder="Optional description of this rubric"
            />
          </div>

          <div>
            <label htmlFor="targetDuration" className="block text-sm font-medium text-[#111827] mb-1">
              Target Duration (seconds)
            </label>
            <input
              id="targetDuration"
              type="number"
              value={targetDuration}
              onChange={(e) => setTargetDuration(e.target.value)}
              min="1"
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
              placeholder="e.g., 180 (3 minutes)"
            />
          </div>
        </div>
      </Card>

      {/* Criteria */}
      <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#111827]">
            Criteria <span className="text-[#DC2626]">*</span>
          </h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addCriterion}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Criterion
          </Button>
        </div>

        {errors.criteria && (
          <p className="mb-4 text-sm text-[#DC2626]">{errors.criteria}</p>
        )}

        <div className="space-y-4">
          {criteria.map((criterion, index) => (
            <div
              key={criterion.key}
              className="p-4 border border-[rgba(17,24,39,0.10)] rounded-lg bg-[#F3F4F6]"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="flex flex-col gap-1 pt-2">
                  <button
                    type="button"
                    onClick={() => moveCriterion(index, 'up')}
                    disabled={index === 0}
                    className="text-[#6B7280] hover:text-[#111827] disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <GripVertical className="h-4 w-4 rotate-90" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCriterion(index, 'down')}
                    disabled={index === criteria.length - 1}
                    className="text-[#6B7280] hover:text-[#111827] disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <GripVertical className="h-4 w-4 -rotate-90" />
                  </button>
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#111827] mb-1">
                      Label <span className="text-[#DC2626]">*</span>
                    </label>
                    <input
                      type="text"
                      value={criterion.label}
                      onChange={(e) => updateCriterion(index, 'label', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent ${
                        errors[`criterion-${index}-label`] ? 'border-[#DC2626]' : 'border-[rgba(17,24,39,0.10)]'
                      }`}
                      placeholder="e.g., Clarity of Message"
                    />
                    {errors[`criterion-${index}-label`] && (
                      <p className="mt-1 text-xs text-[#DC2626]">
                        {errors[`criterion-${index}-label`]}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#111827] mb-1">
                      Description
                    </label>
                    <textarea
                      value={criterion.description || ''}
                      onChange={(e) => updateCriterion(index, 'description', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                      placeholder="What to evaluate for this criterion"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#111827] mb-1">
                        Min Score
                      </label>
                      <input
                        type="number"
                        value={criterion.min_score || 1}
                        onChange={(e) => updateCriterion(index, 'min_score', parseInt(e.target.value))}
                        min="1"
                        max="10"
                        className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#111827] mb-1">
                        Max Score
                      </label>
                      <input
                        type="number"
                        value={criterion.max_score || 10}
                        onChange={(e) => updateCriterion(index, 'max_score', parseInt(e.target.value))}
                        min="1"
                        max="10"
                        className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#111827] mb-1">
                      What Good Looks Like
                    </label>
                    <textarea
                      value={criterion.what_good_looks_like || ''}
                      onChange={(e) => updateCriterion(index, 'what_good_looks_like', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                      placeholder="Describe what excellent performance looks like"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeCriterion(index)}
                  className="p-1.5 text-[#6B7280] hover:text-[#DC2626] hover:bg-[#FEE2E2] rounded transition-colors mt-2"
                  aria-label="Remove criterion"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-end gap-4">
        <Button
          type="button"
          variant="secondary"
          onClick={() => window.history.back()}
          disabled={isSaving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={isSaving}
          isLoading={isSaving}
        >
          {initialData ? 'Save Changes' : 'Create Rubric'}
        </Button>
      </div>
    </form>
  )
}

