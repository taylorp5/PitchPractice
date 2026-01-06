'use client'

import { useState, useRef, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Send, Sparkles, RotateCcw } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
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
}

const QUICK_PROMPTS = [
  "I'm pitching a SaaS product to investors",
  "Create a rubric for a 2-minute elevator pitch",
  "I need to evaluate presentation skills",
  "Make it stricter with more detailed criteria",
]

export default function AIBuilderChat({ onDraftUpdate, onAcceptDraft }: AIBuilderChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentDraft, setCurrentDraft] = useState<RubricDraft | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content: content.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setError(null)
    setIsLoading(true)

    try {
      const response = await fetch('/api/rubrics/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
          currentDraft: currentDraft,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate rubric')
      }

      const data = await response.json()
      const draft = data.draftRubric as RubricDraft

      setCurrentDraft(draft)
      onDraftUpdate(draft)

      const assistantMessage: Message = {
        role: 'assistant',
        content: `I've generated a rubric draft with ${draft.criteria.length} criteria. You can ask me to modify it or accept it to save.`,
      }

      setMessages([...newMessages, assistantMessage])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate rubric'
      setError(errorMessage)
      
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
    onDraftUpdate(null)
    setError(null)
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
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
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
            <div className="bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg px-4 py-2">
              <p className="text-xs text-[#DC2626]">{error}</p>
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
              disabled={!input.trim() || isLoading}
              isLoading={isLoading}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {/* Accept Button */}
        {currentDraft && (
          <div className="px-4 pb-4 border-t border-[rgba(17,24,39,0.10)] pt-4">
            <Button
              variant="primary"
              size="md"
              onClick={handleAccept}
              disabled={isLoading}
              className="w-full"
            >
              Accept & Save Rubric
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}

