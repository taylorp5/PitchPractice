'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Send, Sparkles, RefreshCw, Check, X } from 'lucide-react'
import { CustomRubric, CustomRubricCriterion } from './CustomRubricBuilder'

interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface CopilotResponse {
  name: string
  context_summary: string
  guiding_questions: string[]
  criteria: Array<{
    name: string
    description: string
    scoring_guide: string
    weight?: number
  }>
}

interface RubricCopilotProps {
  currentRubric: CustomRubric
  onApply: (rubric: CustomRubric) => void
  disabled?: boolean
  userPlan?: 'free' | 'starter' | 'coach' | 'daypass'
}

export default function RubricCopilot({ currentRubric, onApply, disabled, userPlan = 'free' }: RubricCopilotProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [draftRubric, setDraftRubric] = useState<CopilotResponse | null>(null)
  const [showDiff, setShowDiff] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const convertCopilotToCustom = (copilot: CopilotResponse): CustomRubric => {
    return {
      title: copilot.name,
      context: copilot.context_summary,
      criteria: copilot.criteria.map((c, idx) => ({
        id: `criterion-${Date.now()}-${idx}`,
        name: c.name,
        description: c.description,
        scoringGuide: c.scoring_guide,
      })),
      guidingQuestions: copilot.guiding_questions || [],
    }
  }

  const handleGenerate = async () => {
    if (!currentRubric.context.trim() && !inputText.trim()) {
      setMessages([
        {
          role: 'assistant',
          content: 'Please provide some context about your pitch (what you\'re pitching, who the audience is, etc.) in the context field above, or type it in the input box.',
          timestamp: Date.now(),
        },
      ])
      return
    }

    const contextText = currentRubric.context.trim() || inputText.trim()
    if (!contextText) return

    setIsLoading(true)
    setInputText('')
    
    const userMessage: CopilotMessage = {
      role: 'user',
      content: `Generate a rubric for: ${contextText}`,
      timestamp: Date.now(),
    }
    setMessages([userMessage])

    try {
      const response = await fetch('/api/rubrics/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextText,
          targetLengthSeconds: null, // Could be extracted from rubric if needed
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.details || 'Failed to generate rubric')
      }

      const copilotResponse: CopilotResponse = {
        name: data.name,
        context_summary: data.context_summary,
        guiding_questions: data.guiding_questions || [],
        criteria: data.criteria || [],
      }

      setDraftRubric(copilotResponse)
      setShowDiff(true)

      const assistantMessage: CopilotMessage = {
        role: 'assistant',
        content: `I've generated a rubric with ${copilotResponse.criteria.length} criteria. Review it below and click "Apply to rubric" to use it.`,
        timestamp: Date.now(),
      }
      setMessages([userMessage, assistantMessage])
    } catch (error: any) {
      const errorMessage: CopilotMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefine = async () => {
    if (!inputText.trim()) {
      setMessages([
        {
          role: 'assistant',
          content: 'Please describe what you\'d like to change (e.g., "Make clarity more important", "Add a criterion for metrics").',
          timestamp: Date.now(),
        },
      ])
      return
    }

    const userEdits = inputText.trim()
    setIsLoading(true)
    setInputText('')

    const userMessage: CopilotMessage = {
      role: 'user',
      content: `Refine the rubric: ${userEdits}`,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMessage])

    try {
      // Convert current rubric to format expected by API
      const currentRubricJson = JSON.stringify({
        name: currentRubric.title,
        context_summary: currentRubric.context,
        guiding_questions: currentRubric.guidingQuestions,
        criteria: currentRubric.criteria.map(c => ({
          name: c.name,
          description: c.description,
          scoring_guide: c.scoringGuide,
        })),
      })

      const response = await fetch('/api/rubrics/copilot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextText: currentRubric.context || 'Pitch evaluation rubric',
          userEdits,
          currentRubric: currentRubricJson,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || data.details || 'Failed to refine rubric')
      }

      const copilotResponse: CopilotResponse = {
        name: data.name,
        context_summary: data.context_summary,
        guiding_questions: data.guiding_questions || [],
        criteria: data.criteria || [],
      }

      setDraftRubric(copilotResponse)
      setShowDiff(true)

      const assistantMessage: CopilotMessage = {
        role: 'assistant',
        content: `I've refined the rubric based on your edits. Review the changes below and click "Apply to rubric" to use it.`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error: any) {
      const errorMessage: CopilotMessage = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error.message}. Please try again.`,
        timestamp: Date.now(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleApply = () => {
    if (!draftRubric) return
    const customRubric = convertCopilotToCustom(draftRubric)
    onApply(customRubric)
    setDraftRubric(null)
    setShowDiff(false)
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: 'Rubric applied successfully! You can continue editing or use it for your pitch.',
        timestamp: Date.now(),
      },
    ])
  }

  const handleCancel = () => {
    setDraftRubric(null)
    setShowDiff(false)
  }

  return (
    <div className="flex flex-col h-full bg-[#F9FAFB]">
      <div className="p-4 border-b border-[rgba(17,24,39,0.10)] bg-white">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-5 w-5 text-[#F59E0B]" />
          <h3 className="text-lg font-semibold text-[#111827]">Rubric Copilot</h3>
        </div>
        <p className="text-xs text-[#6B7280]">
          AI-assisted rubric generation and refinement
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm text-[#6B7280]">
            <p className="mb-2">Use AI to generate or refine your rubric.</p>
            <p>Click "Generate rubric" to create one from your context, or "Refine rubric" to improve the current one.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[#F59E0B] text-white'
                  : 'bg-white border border-[rgba(17,24,39,0.10)] text-[#111827]'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-[rgba(17,24,39,0.10)] rounded-lg px-3 py-2 text-sm text-[#6B7280]">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Generating...
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Diff Preview */}
      {showDiff && draftRubric && (
        <div className="p-4 border-t border-[rgba(17,24,39,0.10)] bg-[#FEF3C7]">
          <div className="mb-3">
            <h4 className="text-sm font-semibold text-[#92400E] mb-2">Replace current rubric?</h4>
            <div className="text-xs text-[#111827] space-y-1 mb-3">
              <p><strong>Name:</strong> {draftRubric.name}</p>
              <p><strong>Criteria:</strong> {draftRubric.criteria.length}</p>
              <p><strong>Guiding questions:</strong> {draftRubric.guiding_questions.length}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={handleApply}
              disabled={disabled}
              className="flex-1"
            >
              <Check className="h-4 w-4 mr-1" />
              Apply to rubric
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCancel}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 border-t border-[rgba(17,24,39,0.10)] bg-white">
        <div className="flex gap-2 mb-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleGenerate}
            disabled={isLoading || disabled}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-1" />
            Generate rubric
          </Button>
          <div className="relative flex-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefine}
              disabled={isLoading || disabled || userPlan === 'daypass'}
              className={`w-full ${userPlan === 'daypass' ? 'opacity-50 cursor-not-allowed' : ''}`}
              title={userPlan === 'daypass' ? 'Editing available on Coach' : undefined}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refine rubric
            </Button>
            {userPlan === 'daypass' && (
              <div className="absolute -top-8 left-0 bg-[#111827] text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 hover:opacity-100 pointer-events-none transition-opacity z-10">
                Editing available on Coach
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (inputText.trim()) {
                  handleRefine()
                }
              }
            }}
            placeholder="Type your edits or additional context..."
            rows={2}
            className="flex-1 px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent resize-none"
            disabled={isLoading || disabled}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              if (inputText.trim()) {
                handleRefine()
              }
            }}
            disabled={isLoading || !inputText.trim() || disabled}
            className="px-3"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

