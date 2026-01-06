'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Send, Sparkles, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react'
import { canEditRubrics } from '@/lib/entitlements'

interface Message {
  role: 'user' | 'assistant'
  content: string
  suggestion?: string // For assistant messages that contain suggestions
}

interface RubricDraft {
  title: string
  description: string | null
  target_duration_seconds: number | null
  criteria: Array<{
    name: string
    description: string
  }>
}

interface AIBuilderChatProps {
  onDraftUpdate: (draft: RubricDraft | null) => void
  onAcceptDraft: (draft: RubricDraft) => void
  onParseError?: (error: string | null) => void
  userPlan?: 'free' | 'starter' | 'coach' | 'daypass'
}

const QUICK_PROMPTS = [
  "I'm pitching a SaaS product to investors",
  "Create a rubric for a 2-minute elevator pitch",
  "I need to evaluate presentation skills",
  "Make it stricter with more detailed criteria",
]

export default function AIBuilderChat({ onDraftUpdate, onAcceptDraft, onParseError, userPlan = 'free' }: AIBuilderChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<RubricDraft | null>(null)
  const [lastGoodDraft, setLastGoodDraft] = useState<RubricDraft | null>(null) // Keep last valid draft
  const [error, setError] = useState<string | null>(null)
  const [parseError, setParseError] = useState<string | null>(null) // Track parsing errors separately
  const [rateLimitError, setRateLimitError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastRequestTimeRef = useRef<number>(0)
  const requestCountRef = useRef<number>(0)
  const requestWindowStartRef = useRef<number>(Date.now())

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Rate limiting: max 10 requests per minute
  const checkRateLimit = (): boolean => {
    const now = Date.now()
    const windowMs = 60 * 1000 // 1 minute window
    const maxRequests = 10

    // Reset window if it's been more than 1 minute
    if (now - requestWindowStartRef.current > windowMs) {
      requestCountRef.current = 0
      requestWindowStartRef.current = now
    }

    // Check if we've exceeded the limit
    if (requestCountRef.current >= maxRequests) {
      const timeUntilReset = Math.ceil((windowMs - (now - requestWindowStartRef.current)) / 1000)
      setRateLimitError(`Rate limit exceeded. Please wait ${timeUntilReset} seconds before sending another message.`)
      return false
    }

    // Enforce minimum 2 seconds between requests
    const timeSinceLastRequest = now - lastRequestTimeRef.current
    if (timeSinceLastRequest < 2000) {
      const waitTime = Math.ceil((2000 - timeSinceLastRequest) / 1000)
      setRateLimitError(`Please wait ${waitTime} second${waitTime > 1 ? 's' : ''} before sending another message.`)
      return false
    }

    setRateLimitError(null)
    return true
  }

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return

    // Check rate limit
    if (!checkRateLimit()) {
      return
    }

    const userMessage: Message = { role: 'user', content: content.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setError(null)
    setParseError(null)
    setIsLoading(true)

    // Update rate limiting counters
    lastRequestTimeRef.current = Date.now()
    requestCountRef.current += 1

    try {
      const response = await fetch('/api/rubrics/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          currentDraft: currentDraft || lastGoodDraft, // Use last good draft if current is null
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || 'Failed to generate rubric'
        const errorDetails = errorData.details ? `: ${errorData.details}` : ''
        
        // If parsing failed, keep last good draft
        if (errorData.details?.includes('parse') || errorData.details?.includes('JSON') || errorData.parseError) {
          const parseErrMsg = `Couldn't parse rubric draft${errorDetails}. Keeping last valid draft.`
          setParseError(parseErrMsg)
          onParseError?.(parseErrMsg)
          // Don't clear current draft if we have a last good one
          if (lastGoodDraft) {
            setCurrentDraft(lastGoodDraft)
            onDraftUpdate(lastGoodDraft)
          }
        } else {
          setError(errorMessage + errorDetails)
          onParseError?.(null)
        }
        
        const errorResponse: Message = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorMessage}${errorDetails}. Please try again or rephrase your request.`,
        }
        setMessages([...newMessages, errorResponse])
        return
      }

      const data = await response.json()
      const draft = data.draftRubric as RubricDraft

      // Validate draft has required fields
      if (!draft || !draft.title || !Array.isArray(draft.criteria) || draft.criteria.length < 3) {
        throw new Error('Invalid rubric draft structure returned')
      }

      // Update drafts - this is a good draft
      setCurrentDraft(draft)
      setLastGoodDraft(draft) // Save as last good draft
      onDraftUpdate(draft)
      setParseError(null) // Clear any previous parse errors
      onParseError?.(null) // Clear parse error in parent

      const assistantMessage: Message = {
        role: 'assistant',
        content: `I've generated a rubric draft with ${draft.criteria.length} criteria. You can ask me to modify it or accept it to save.`,
      }

      setMessages([...newMessages, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate rubric'
      
      // If parsing failed, keep last good draft
      if (errorMessage.includes('parse') || errorMessage.includes('JSON') || errorMessage.includes('Invalid')) {
        const parseErrMsg = `Couldn't parse rubric draft. Keeping last valid draft.`
        setParseError(parseErrMsg)
        onParseError?.(parseErrMsg)
        if (lastGoodDraft) {
          setCurrentDraft(lastGoodDraft)
          onDraftUpdate(lastGoodDraft)
        }
      } else {
        setError(errorMessage)
        onParseError?.(null)
      }
      
      const errorResponse: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your request.`,
      }
      setMessages([...newMessages, errorResponse])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSend(input)
  }

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const handleReset = () => {
    setMessages([])
    setCurrentDraft(null)
    setLastGoodDraft(null)
    onDraftUpdate(null)
    setError(null)
    setParseError(null)
    onParseError?.(null)
  }

  const handleApplySuggestion = (suggestion: string) => {
    if (suggestion.trim()) {
      handleSend(suggestion)
    }
  }

  const handleAccept = () => {
    if (currentDraft) {
      onAcceptDraft(currentDraft)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-1 flex flex-col bg-white border-[rgba(17,24,39,0.10)] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-[rgba(17,24,39,0.10)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#F59E0B]" />
              <h2 className="text-lg font-semibold text-[#111827]">AI Rubric Builder</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              disabled={isLoading}
              className="text-[#6B7280] hover:text-[#111827]"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-[#F59E0B] mx-auto mb-4 opacity-50" />
              <p className="text-sm text-[#6B7280] mb-2">
                Tell me about your pitch and I'll create a rubric for you
              </p>
              <p className="text-xs text-[#9CA3AF]">
                Try a quick prompt below or describe what you're pitching
              </p>
            </div>
          )}

          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#F59E0B] text-[#0B0F14]'
                    : 'bg-[#F3F4F6] text-[#111827]'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              {/* Apply suggestion button for assistant messages with actionable content */}
              {msg.role === 'assistant' && msg.content.includes('suggestion') && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleApplySuggestion(msg.content)}
                  className="mt-2 text-xs"
                  disabled={isLoading}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Apply suggestion
                </Button>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-[#F3F4F6] rounded-lg px-4 py-2">
                <LoadingSpinner size="sm" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-4 py-2 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#DC2626] flex-1">{error}</p>
            </div>
          )}

          {parseError && (
            <div className="bg-[#FEF3C7] border border-[#FCD34D] rounded-lg px-4 py-2 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[#D97706] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-[#92400E] font-medium mb-1">Parsing Error</p>
                <p className="text-xs text-[#92400E]">{parseError}</p>
                {lastGoodDraft && (
                  <p className="text-xs text-[#92400E] mt-1">Last valid draft is still shown in the preview.</p>
                )}
              </div>
            </div>
          )}

          {rateLimitError && (
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-4 py-2 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[#DC2626] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#DC2626] flex-1">{rateLimitError}</p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        {messages.length === 0 && (
          <div className="px-4 pb-2">
            <p className="text-xs text-[#6B7280] mb-2">Quick prompts:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((prompt, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickPrompt(prompt)}
                  className="text-xs px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#111827] rounded-lg transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-[rgba(17,24,39,0.10)]">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(input)
                }
              }}
              placeholder="Describe your pitch or ask for changes..."
              rows={2}
              className="flex-1 px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent resize-none"
              disabled={isLoading}
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!input.trim() || isLoading || !!rateLimitError}
              isLoading={isLoading}
              title={rateLimitError || undefined}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Accept Button */}
        {currentDraft && (
          <div className="px-4 pb-4 border-t border-[rgba(17,24,39,0.10)] pt-4">
            {!canEditRubrics(userPlan) ? (
              <div className="relative">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleAccept}
                  disabled={true}
                  className="w-full opacity-50 cursor-not-allowed"
                  title="Editing available on Coach"
                >
                  Accept & Save Rubric
                </Button>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs text-[#6B7280] bg-white px-2 py-1 rounded border border-[rgba(17,24,39,0.10)]">
                    Editing available on Coach
                  </span>
                </div>
              </div>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={handleAccept}
                disabled={isLoading}
                className="w-full"
              >
                Accept & Save Rubric
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

