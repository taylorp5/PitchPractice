'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Plus, Trash2, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react'
import RubricCopilot from './RubricCopilot'
import SavedRubricsList from './SavedRubricsList'

export interface CustomRubricCriterion {
  id: string
  name: string
  description: string
  scoringGuide: string
}

export interface CustomRubric {
  title: string
  context: string
  criteria: CustomRubricCriterion[]
  guidingQuestions: string[]
}

interface CustomRubricBuilderProps {
  initialData?: CustomRubric | null
  onSave: (rubric: CustomRubric, rubricId?: string) => void
  onUse: (rubric: CustomRubric, rubricId?: string) => void
  disabled?: boolean
}

const DEFAULT_CRITERIA: CustomRubricCriterion[] = [
  { id: '1', name: 'Hook', description: 'How engaging and attention-grabbing is the opening?', scoringGuide: '0-10: Opening should capture attention immediately' },
  { id: '2', name: 'Problem', description: 'Is the problem clearly identified and compelling?', scoringGuide: '0-10: Problem should be specific and relatable' },
  { id: '3', name: 'Solution', description: 'Is the solution clearly presented and viable?', scoringGuide: '0-10: Solution should address the problem directly' },
  { id: '4', name: 'Proof', description: 'Is there evidence or validation for the solution?', scoringGuide: '0-10: Proof should be credible and relevant' },
  { id: '5', name: 'Clarity', description: 'Is the message clear and easy to understand?', scoringGuide: '0-10: Message should be concise and jargon-free' },
  { id: '6', name: 'Structure', description: 'Is the pitch well-organized and logical?', scoringGuide: '0-10: Structure should flow naturally' },
  { id: '7', name: 'Delivery', description: 'How confident and engaging is the delivery?', scoringGuide: '0-10: Delivery should be confident and natural' },
  { id: '8', name: 'CTA', description: 'Is there a clear and compelling call to action?', scoringGuide: '0-10: CTA should be specific and actionable' },
]

export default function CustomRubricBuilder({ initialData, onSave, onUse, disabled }: CustomRubricBuilderProps) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [context, setContext] = useState(initialData?.context || '')
  const [criteria, setCriteria] = useState<CustomRubricCriterion[]>(
    initialData?.criteria && initialData.criteria.length > 0
      ? initialData.criteria
      : DEFAULT_CRITERIA
  )
  const [guidingQuestions, setGuidingQuestions] = useState<string[]>(
    initialData?.guidingQuestions || []
  )
  const [showCopilot, setShowCopilot] = useState(true)

  // Load from localStorage on mount if no initialData
  useEffect(() => {
    if (!initialData) {
      const saved = localStorage.getItem('pp_custom_rubric_draft_v1')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          if (parsed.title) setTitle(parsed.title)
          if (parsed.context) setContext(parsed.context)
          if (parsed.criteria && parsed.criteria.length > 0) setCriteria(parsed.criteria)
          if (parsed.guidingQuestions) setGuidingQuestions(parsed.guidingQuestions)
        } catch (e) {
          console.error('Failed to load saved draft:', e)
        }
      }
    }
  }, [initialData])

  // Auto-save to localStorage
  useEffect(() => {
    if (title || context || criteria.length > 0 || guidingQuestions.length > 0) {
      const draft: CustomRubric = {
        title,
        context,
        criteria,
        guidingQuestions,
      }
      localStorage.setItem('pp_custom_rubric_draft_v1', JSON.stringify(draft))
    }
  }, [title, context, criteria, guidingQuestions])

  const addCriterion = () => {
    const newId = `criterion-${Date.now()}`
    setCriteria([
      ...criteria,
      {
        id: newId,
        name: '',
        description: '',
        scoringGuide: '0-10: Scoring guide',
      },
    ])
  }

  const removeCriterion = (id: string) => {
    if (criteria.length <= 3) {
      alert('At least 3 criteria are required')
      return
    }
    setCriteria(criteria.filter(c => c.id !== id))
  }

  const updateCriterion = (id: string, field: keyof CustomRubricCriterion, value: string) => {
    setCriteria(
      criteria.map(c =>
        c.id === id ? { ...c, [field]: value } : c
      )
    )
  }

  const addGuidingQuestion = () => {
    setGuidingQuestions([...guidingQuestions, ''])
  }

  const removeGuidingQuestion = (index: number) => {
    setGuidingQuestions(guidingQuestions.filter((_, i) => i !== index))
  }

  const updateGuidingQuestion = (index: number, value: string) => {
    const updated = [...guidingQuestions]
    updated[index] = value
    setGuidingQuestions(updated)
  }

  const isValid = title.trim().length > 0 && criteria.length >= 3 &&
    criteria.every(c => c.name.trim().length > 0)

  const saveRubricToDB = async (rubric: CustomRubric): Promise<string | null> => {
    try {
      // Convert CustomRubric to the format expected by the API
      const rubricJson = {
        criteria: rubric.criteria.map(c => ({
          id: c.id,
          name: c.name,
          description: c.description,
          scoringGuide: c.scoringGuide,
        })),
        guiding_questions: rubric.guidingQuestions,
        context_summary: rubric.context,
        scoring_scale: { min: 0, max: 10 },
      }

      const response = await fetch('/api/rubrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: rubric.title,
          description: rubric.context || null,
          rubric_json: rubricJson,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save rubric')
      }

      const data = await response.json()
      if (data.ok && data.rubric && data.rubric.id) {
        return data.rubric.id
      }
      return null
    } catch (error) {
      console.error('Failed to save rubric to database:', error)
      return null
    }
  }

  const handleSave = async () => {
    if (!isValid) return
    const rubric: CustomRubric = {
      title: title.trim(),
      context: context.trim(),
      criteria: criteria.filter(c => c.name.trim().length > 0),
      guidingQuestions: guidingQuestions.filter(q => q.trim().length > 0),
    }
    
    // Save to database and get rubric_id
    const rubricId = await saveRubricToDB(rubric)
    onSave(rubric, rubricId || undefined)
  }

  const handleUse = async () => {
    if (!isValid) return
    const rubric: CustomRubric = {
      title: title.trim(),
      context: context.trim(),
      criteria: criteria.filter(c => c.name.trim().length > 0),
      guidingQuestions: guidingQuestions.filter(q => q.trim().length > 0),
    }
    
    // Save to database and get rubric_id
    const rubricId = await saveRubricToDB(rubric)
    
    // Save as last used
    localStorage.setItem('pp_last_used_custom_rubric', JSON.stringify(rubric))
    onUse(rubric, rubricId || undefined)
  }

  const handleCopilotApply = (rubric: CustomRubric) => {
    setTitle(rubric.title)
    setContext(rubric.context)
    setCriteria(rubric.criteria)
    setGuidingQuestions(rubric.guidingQuestions)
  }

  const currentRubric: CustomRubric = {
    title,
    context,
    criteria,
    guidingQuestions,
  }

  const handleSavedRubricSelect = async (rubric: CustomRubric) => {
    setTitle(rubric.title)
    setContext(rubric.context)
    setCriteria(rubric.criteria)
    setGuidingQuestions(rubric.guidingQuestions)
    // Auto-save the selected rubric to database
    const rubricId = await saveRubricToDB(rubric)
    onSave(rubric, rubricId || undefined)
  }

  return (
    <div className="space-y-4">
      {/* Saved Rubrics List */}
      <div className="p-4 bg-[#F9FAFB] border border-[rgba(17,24,39,0.10)] rounded-lg">
        <SavedRubricsList
          onSelect={handleSavedRubricSelect}
          currentRubric={currentRubric}
          disabled={disabled}
        />
      </div>

      {/* Builder and Copilot */}
      <div className="flex gap-4" style={{ minHeight: '600px', maxHeight: '800px' }}>
        {/* Left: Rubric Builder */}
        <div className={`flex-1 overflow-y-auto pr-4 ${showCopilot ? '' : 'w-full'}`}>
          <div className="space-y-6 pb-4">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-[#111827] mb-2">
          Rubric name <span className="text-[#EF4444]">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Investor pitch – seed round"
          className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
          disabled={disabled}
        />
      </div>

      {/* Context */}
      <div>
        <label className="block text-sm font-medium text-[#111827] mb-2">
          What are you pitching? <span className="text-[#6B7280] font-normal">(optional)</span>
        </label>
        <p className="text-xs text-[#6B7280] mb-2">
          Who is the audience? Any constraints?
        </p>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="E.g., A SaaS product for small businesses, a startup idea to investors..."
          rows={3}
          className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent resize-none"
          disabled={disabled}
        />
      </div>

      {/* Criteria */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-[#111827]">
            Criteria <span className="text-[#EF4444]">*</span>
            <span className="text-xs text-[#6B7280] font-normal ml-2">
              (At least 3 required, scored 0-10)
            </span>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={addCriterion}
            disabled={disabled}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {criteria.map((criterion, index) => (
            <div
              key={criterion.id}
              className="p-4 border border-[rgba(17,24,39,0.10)] rounded-lg bg-[#F9FAFB]"
            >
              <div className="flex items-start gap-2 mb-3">
                <div className="flex-shrink-0 pt-2">
                  <GripVertical className="h-4 w-4 text-[#6B7280]" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-[#111827] mb-1">
                      Criterion name <span className="text-[#EF4444]">*</span>
                    </label>
                    <input
                      type="text"
                      value={criterion.name}
                      onChange={(e) => updateCriterion(criterion.id, 'name', e.target.value)}
                      placeholder="e.g., Hook, Problem, Solution..."
                      className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111827] mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={criterion.description}
                      onChange={(e) => updateCriterion(criterion.id, 'description', e.target.value)}
                      placeholder="What should be evaluated?"
                      className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#111827] mb-1">
                      Scoring guide (0-10)
                    </label>
                    <input
                      type="text"
                      value={criterion.scoringGuide}
                      onChange={(e) => updateCriterion(criterion.id, 'scoringGuide', e.target.value)}
                      placeholder="e.g., 0-10: Opening should capture attention immediately"
                      className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                      disabled={disabled}
                    />
                  </div>
                </div>
                <div className="flex-shrink-0 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCriterion(criterion.id)}
                    disabled={disabled || criteria.length <= 3}
                    className="text-[#EF4444] hover:text-[#DC2626]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {criteria.length < 3 && (
          <p className="text-xs text-[#EF4444] mt-2">
            ⚠️ At least 3 criteria are required
          </p>
        )}
      </div>

      {/* Guiding Questions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-[#111827]">
            Guiding questions <span className="text-xs text-[#6B7280] font-normal">(optional)</span>
          </label>
          <Button
            variant="secondary"
            size="sm"
            onClick={addGuidingQuestion}
            disabled={disabled}
            className="text-xs"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        <p className="text-xs text-[#6B7280] mb-3">
          These questions will be shown to the user before recording
        </p>
        <div className="space-y-2">
          {guidingQuestions.map((question, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => updateGuidingQuestion(index, e.target.value)}
                placeholder="e.g., What problem are you solving?"
                className="flex-1 px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
                disabled={disabled}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeGuidingQuestion(index)}
                disabled={disabled}
                className="text-[#EF4444] hover:text-[#DC2626]"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {guidingQuestions.length === 0 && (
            <p className="text-xs text-[#6B7280] italic">
              No guiding questions yet. Add questions to help users prepare.
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-[rgba(17,24,39,0.10)]">
        <Button
          variant="secondary"
          onClick={handleSave}
          disabled={!isValid || disabled}
          className="flex-1"
        >
          Save Draft
        </Button>
        <Button
          variant="primary"
          onClick={handleUse}
          disabled={!isValid || disabled}
          className="flex-1"
        >
          Use This Rubric
        </Button>
      </div>
      {!isValid && (
        <p className="text-xs text-[#EF4444]">
          ⚠️ Please provide a rubric name and at least 3 criteria with names
        </p>
      )}
        </div>
      </div>

      {/* Right: Rubric Copilot */}
      {showCopilot && (
        <div className="w-96 flex-shrink-0 flex flex-col border border-[rgba(17,24,39,0.10)] rounded-lg overflow-hidden bg-white" style={{ height: '600px' }}>
          <RubricCopilot
            currentRubric={currentRubric}
            onApply={handleCopilotApply}
            disabled={disabled}
          />
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={() => setShowCopilot(!showCopilot)}
        className="flex-shrink-0 w-6 h-12 self-center border border-[rgba(17,24,39,0.10)] rounded-md bg-white hover:bg-[#F9FAFB] flex items-center justify-center transition-colors"
        disabled={disabled}
        aria-label={showCopilot ? 'Hide copilot' : 'Show copilot'}
      >
        {showCopilot ? (
          <ChevronRight className="h-4 w-4 text-[#6B7280]" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-[#6B7280]" />
        )}
      </button>
      </div>
    </div>
  )
}

