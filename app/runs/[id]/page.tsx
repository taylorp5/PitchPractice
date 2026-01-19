'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StatPill } from '@/components/ui/StatPill'
import { Badge } from '@/components/ui/Badge'
import { Check, ArrowLeft, RefreshCw, ChevronDown, ChevronUp, FileText, Download, Copy, Sparkles } from 'lucide-react'
import { getUserPlan } from '@/lib/plan'
import { hasCoachAccess, hasDayPassAccess, canViewPremiumInsights, canViewProgressPanel, canEditRubrics } from '@/lib/entitlements'
import { RunChunk } from '@/lib/types'

// Helper function to log fetch errors with full details
async function logFetchError(url: string, response: Response, error?: any) {
  let responseText = ''
  try {
    responseText = await response.clone().text()
  } catch (e) {
    responseText = 'Could not read response text'
  }
  
  console.error('[Fetch Error]', {
    url,
    status: response.status,
    statusText: response.statusText,
    responseText: responseText.substring(0, 500),
    error,
  })
}

interface Run {
  id: string
  session_id: string
  created_at: string
  title: string | null
  audio_path: string
  audio_seconds: number | null
  duration_ms: number | null
  transcript: string | null
  analysis_json: any
  analysis_summary_json?: any
  status: string
  error_message: string | null
  audio_url: string | null
  word_count: number | null
  words_per_minute: number | null
  rubric_snapshot_json: any | null
  plan_at_time?: string | null
  rubrics: {
    id: string
    name: string
    title?: string
    description: string | null
    criteria: any
    target_duration_seconds: number | null
    max_duration_seconds: number | null
  } | null
}

// Drill Accordion Component for Premium Insights
function DrillAccordion({ title, steps }: { title: string; steps: string[] }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border border-[#1A1F2E] rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2 bg-[#0F1419] hover:bg-[#151A23] transition-colors flex items-center justify-between"
      >
        <span className="text-xs font-semibold text-[#E5E7EB]">{title}</span>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-[#9CA3AF]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
        )}
      </button>
      {isOpen && steps.length > 0 && (
        <div className="p-3 bg-[#0F1419] border-t border-[#1A1F2E]">
          <ol className="space-y-1.5 list-decimal list-inside">
            {steps.map((step: string, stepIdx: number) => (
              <li key={stepIdx} className="text-xs text-[#E5E7EB]">
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// Helper function to normalize text for matching (whitespace + lowercase)
function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

// Helper function to check if two texts match (fuzzy includes)
function textsMatch(text1: string, text2: string): boolean {
  const normalized1 = normalizeText(text1)
  const normalized2 = normalizeText(text2)
  return normalized1.includes(normalized2) || normalized2.includes(normalized1)
}

// Helper function to get filler words for a quote
function getFillerWordsForQuote(
  quote: string,
  fillerWordsData: any
): { word: string; count: number }[] | null {
  if (!fillerWordsData?.totals || !fillerWordsData?.top_sentences) {
    return null
  }

  const fillerWordPatterns: { [key: string]: RegExp } = {
    'um': /\bum\b/gi,
    'uh': /\buh\b/gi,
    'like': /\blike\b/gi,
    'you know': /\byou\s+know\b/gi,
    'so': /\bso\b/gi,
    'well': /\bwell\b/gi,
    'kind of': /\bkind\s+of\b/gi,
    'sort of': /\bsort\s+of\b/gi,
    'I mean': /\bi\s+mean\b/gi,
    'actually': /\bactually\b/gi,
    'basically': /\bbasically\b/gi,
  }

  const foundWords: { word: string; count: number }[] = []
  
  Object.entries(fillerWordPatterns).forEach(([word, pattern]) => {
    const matches = quote.match(pattern)
    if (matches && matches.length > 0) {
      foundWords.push({ word, count: matches.length })
    }
  })

  return foundWords.length > 0 ? foundWords : null
}

// Helper function to find matching rewrite from top_sentences
function findMatchingRewrite(
  quote: string,
  topSentences: any[]
): { sentence: string; rewrite: string } | null {
  if (!topSentences || topSentences.length === 0) {
    return null
  }

  for (const item of topSentences) {
    if (item.sentence && item.rewrite && textsMatch(quote, item.sentence)) {
      return {
        sentence: item.sentence,
        rewrite: item.rewrite,
      }
    }
  }

  return null
}

// Line-by-Line Item Component with Premium Insights enhancements
function LineByLineItem({
  idx,
  item,
  typeColors,
  priorityColors,
  isHighlighted,
  fillerWordsForQuote,
  matchingRewrite,
}: {
  idx: number
  item: any
  typeColors: { strength: string; issue: string }
  priorityColors: { high: string; medium: string; low: string }
  isHighlighted: boolean
  fillerWordsForQuote: { word: string; count: number }[] | null
  matchingRewrite: { sentence: string; rewrite: string } | null
}) {
  const [isRewriteExpanded, setIsRewriteExpanded] = useState(false)

  return (
    <motion.div
      id={`feedback-${idx}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: idx * 0.05 }}
      className={`p-4 rounded-lg border transition-all duration-200 ${
        isHighlighted 
          ? 'border-amber-500/60 bg-amber-500/15 shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
          : typeColors[item.type as keyof typeof typeColors] || 'bg-[#151A23] border-[#22283A]'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <blockquote className="text-sm font-medium text-[#E5E7EB] italic flex-1">
          "{item.quote}"
        </blockquote>
        <span className={`text-xs font-semibold ml-2 ${priorityColors[item.priority as keyof typeof priorityColors] || 'text-[#9CA3AF]'}`}>
          {item.priority?.toUpperCase()}
        </span>
      </div>
      
      {/* Filler Words Display (Coach only) */}
      {fillerWordsForQuote && fillerWordsForQuote.length > 0 && (
        <div className="mb-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
          <p className="text-xs font-semibold text-yellow-400 mb-1">Filler words:</p>
          <p className="text-xs text-[#E5E7EB]">
            {fillerWordsForQuote.map((fw, fwIdx) => (
              <span key={fwIdx}>
                {fw.word} ({fw.count}){fwIdx < fillerWordsForQuote.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
        </div>
      )}
      
      <p className="text-sm text-[#E5E7EB] mb-1">
        <strong>Comment:</strong> {item.comment}
      </p>
      {item.action && (
        <p className="text-sm text-[#E5E7EB]">
          <strong>Action:</strong> {item.action}
        </p>
      )}
      
      {/* Rewrite Suggestions - Original from line_by_line */}
      {item.rewrite && (
        <div className="mt-3 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
          <p className="text-xs font-semibold text-[#F59E0B] mb-1">Suggested Rewrite:</p>
          <p className="text-sm text-[#E5E7EB] italic">{item.rewrite}</p>
        </div>
      )}
      
      {/* Premium Insights Rewrite (Coach only) - Expandable */}
      {matchingRewrite && matchingRewrite.rewrite && (
        <div className="mt-3 border border-[#F59E0B]/30 rounded-lg overflow-hidden">
          <button
            onClick={() => setIsRewriteExpanded(!isRewriteExpanded)}
            className="w-full p-2 bg-[#F59E0B]/10 hover:bg-[#F59E0B]/15 transition-colors flex items-center justify-between"
          >
            <p className="text-xs font-semibold text-[#F59E0B]">Suggested rewrite</p>
            {isRewriteExpanded ? (
              <ChevronUp className="h-4 w-4 text-[#F59E0B]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[#F59E0B]" />
            )}
          </button>
          {isRewriteExpanded && (
            <div className="p-3 bg-[#0F1419] border-t border-[#F59E0B]/30">
              <p className="text-xs text-[#9CA3AF] mb-1">Original:</p>
              <p className="text-xs text-[#E5E7EB] italic mb-3">{matchingRewrite.sentence}</p>
              <p className="text-xs text-[#9CA3AF] mb-1">Rewrite:</p>
              <p className="text-sm text-[#E5E7EB] italic">{matchingRewrite.rewrite}</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  )
}

type AnalysisStage =
  | 'idle'
  | 'uploading'
  | 'transcribing'
  | 'analyzing'
  | 'finalizing'
  | 'complete'
  | 'error'

export default function RunPage() {
  const params = useParams()
  const router = useRouter()
  const routeRunId = params.id as string
  const [userPlan, setUserPlan] = useState<'free' | 'starter' | 'coach' | 'daypass' | 'day_pass'>('free')
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isGettingFeedback, setIsGettingFeedback] = useState(false)
  const [analysisStage, setAnalysisStage] = useState<AnalysisStage>('idle')
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null)
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [lastTranscribeResponse, setLastTranscribeResponse] = useState<any>(null)
  const [lastTranscript, setLastTranscript] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number | null>(null)
  const [highlightedFeedbackIdx, setHighlightedFeedbackIdx] = useState<number | null>(null)
  const [showNoFeedbackMessage, setShowNoFeedbackMessage] = useState<number | null>(null)
  const [progressData, setProgressData] = useState<{
    comparisons: {
      avg_wpm: number | null
      avg_filler_words: number | null
      avg_missing_sections: number | null
      avg_overall_score: number | null
    } | null
    loading: boolean
  }>({ comparisons: null, loading: false })
  const [chunks, setChunks] = useState<RunChunk[]>([])
  const [chunksLoading, setChunksLoading] = useState(false)
  const [retryingChunkId, setRetryingChunkId] = useState<string | null>(null)
  
  // Use ref to track current run for polling logic (avoids stale closures)
  const runRef = useRef<Run | null>(null)
  useEffect(() => {
    runRef.current = run
  }, [run])

  // Status priority map: higher number = more complete state
  const statusPriority: Record<string, number> = {
    uploaded: 1,
    transcribing: 2,
    transcribed: 3,
    analyzing: 3.5,
    analyzed: 4,
    error: 5,
  }

  const getStatusPriority = (status: string | null | undefined): number => {
    if (!status) return 0
    return statusPriority[status] || 0
  }

  // Determine analysis stage from run data
  const determineAnalysisStage = (runData: Run | null): AnalysisStage => {
    if (!runData) return 'idle'
    
    const status = runData.status
    
    // Error state
    if (status === 'error') return 'error'
    
    if (status === 'analyzed') return 'complete'
    
    // Analyzing state
    if (status === 'analyzing' || status === 'fast_analyzed') return 'analyzing'
    
    // Transcribing state
    if (status === 'transcribing' || status === 'transcribed') return 'transcribing'
    
    // Uploading state
    if (status === 'uploaded') return 'uploading'
    
    return 'idle'
  }

  const fetchRun = useCallback(async (isPolling: boolean = false): Promise<boolean> => {
    // Guard: Never fetch if runId is falsy or the string "undefined"
    if (!routeRunId || routeRunId === 'undefined') {
      setError('Invalid run ID')
      setLoading(false)
      return false
    }

    const url = `/api/runs/${routeRunId}`
    const fetchTimestamp = new Date().toISOString()
    
    try {
      const res = await fetch(url, {
        cache: 'no-store',
      })
      if (!res.ok) {
        await logFetchError(url, res)
        throw new Error('Failed to fetch run')
      }
      const responseData = await res.json()
      
      // Normalize response shape: handle both { run, analysis } and { run } formats
      const normalizedRun = responseData.ok && responseData.run ? responseData.run : responseData
      const normalizedAnalysis = responseData.analysis ?? responseData.run?.analysis_json ?? normalizedRun?.analysis_json ?? null
      const normalizedSummary = responseData.analysis_summary_json ?? responseData.run?.analysis_summary_json ?? normalizedRun?.analysis_summary_json ?? null
      const normalizedTranscript = responseData.transcript ?? responseData.run?.transcript ?? normalizedRun?.transcript ?? null
      const resolvedAnalysis = normalizedAnalysis ?? normalizedSummary ?? null
      
      // Merge analysis into run if it's at top level
      const runData: Run | null = normalizedRun ? {
        ...normalizedRun,
        analysis_json: resolvedAnalysis ?? normalizedRun.analysis_json ?? null,
        analysis_summary_json: normalizedSummary ?? normalizedRun.analysis_summary_json ?? null,
        transcript: normalizedTranscript ?? normalizedRun.transcript ?? null,
      } : null

      if (!runData) {
        throw new Error('No run data in response')
      }

      // Get current run from ref to avoid stale closure
      const currentRun = runRef.current

      // Determine and update analysis stage
      const newStage = determineAnalysisStage(runData)
      setAnalysisStage(newStage)
      
      // Track analysis start time
      if (newStage === 'analyzing' && analysisStage !== 'analyzing' && !analysisStartTime) {
        setAnalysisStartTime(Date.now())
      }
      
      // Reset timeout message if analysis completes
      if (newStage === 'complete') {
        setShowTimeoutMessage(false)
        setAnalysisStartTime(null)
      }

      // Debug logging (dev-only)
      if (process.env.NODE_ENV !== 'production') {
        const hasTranscript = !!(runData.transcript && runData.transcript.trim().length > 0)
        const hasSummary = !!(runData.analysis_json?.summary)
        const hasPremium = !!(runData.analysis_json?.premium_insights || runData.analysis_json?.premium)
        console.debug('[analysis]', {
          stage: newStage,
          runId: routeRunId,
          plan: userPlan,
          hasTranscript,
          hasSummary,
          hasPremium,
          status: runData.status,
          timestamp: fetchTimestamp,
        })
      }

      // Priority-based state update: only update if new data is more complete
      const currentPriority = getStatusPriority(currentRun?.status)
      const newPriority = getStatusPriority(runData.status)
      const hasNewTranscript = !!(runData.transcript && runData.transcript.trim().length > 0)
      const hasNewAnalysis = !!runData.analysis_json
      const currentHasTranscript = !!(currentRun?.transcript && currentRun.transcript.trim().length > 0)
      const currentHasAnalysis = !!currentRun?.analysis_json

      const shouldUpdate = 
        newPriority > currentPriority || // New status is more complete
        (newPriority === currentPriority && (
          (hasNewTranscript && !currentHasTranscript) || // New transcript available
          (hasNewAnalysis && !currentHasAnalysis) // New analysis available
        )) ||
        !currentRun // No current run data

      if (shouldUpdate) {
        setRun(runData)
        
        // Use plan from analysis metadata if available, otherwise keep current plan
        if (runData.analysis_json?.meta?.plan_at_time) {
          const planAtTime = runData.analysis_json.meta.plan_at_time
          setUserPlan(planAtTime === 'daypass' ? 'day_pass' : planAtTime)
        }

        setError(null)
      } else if (process.env.NODE_ENV === 'development') {
        console.log('[RunPage] Skipping stale update:', {
          currentPriority,
          newPriority,
          currentHasTranscript,
          hasNewTranscript,
          currentHasAnalysis,
          hasNewAnalysis,
        })
      }

      // Return true if we should continue polling
      // Stop polling when we have transcript + summary (don't wait for premium insights)
      const hasCompleteData = runData.status === 'analyzed'
      
      const shouldContinuePolling = 
        (runData.status === 'uploaded' || 
         runData.status === 'transcribing' || 
         runData.status === 'transcribed' ||
         runData.status === 'analyzing' ||
         runData.status === 'fast_analyzed') &&
        !hasCompleteData

      return shouldContinuePolling
    } catch (err: any) {
      console.error('Error fetching run:', err)
      setError(err.message || 'Failed to load pitch run')
      return false
    } finally {
      if (!isPolling) {
        setLoading(false)
      }
    }
  }, [routeRunId])

  const fetchAudioUrl = async () => {
    if (!routeRunId || !run?.audio_path) return

    try {
      setAudioError(false)
      const res = await fetch(`/api/runs/audio-url?runId=${routeRunId}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        await logFetchError(`/api/runs/audio-url?runId=${routeRunId}`, res)
        setAudioError(true)
        return
      }
      const data = await res.json()
      if (data.url) {
        setAudioUrl(data.url)
      } else {
        setAudioError(true)
      }
    } catch (err) {
      console.error('Error fetching audio URL:', err)
      setAudioError(true)
    }
  }

  // Fetch progress data for Coach users only
  const fetchProgress = useCallback(async () => {
    if (!routeRunId || !canViewProgressPanel(userPlan)) {
      return
    }

    setProgressData(prev => ({ ...prev, loading: true }))
    try {
      const res = await fetch(`/api/runs/${routeRunId}/progress`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        console.error('[Progress] Failed to fetch progress data')
        setProgressData({ comparisons: null, loading: false })
        return
      }
      const data = await res.json()
      setProgressData({ comparisons: data.comparisons, loading: false })
    } catch (err) {
      console.error('[Progress] Error fetching progress:', err)
      setProgressData({ comparisons: null, loading: false })
    }
  }, [routeRunId, userPlan])

  // Fetch chunks for Coach users only
  const fetchChunks = useCallback(async () => {
    if (!routeRunId || !hasCoachAccess(userPlan)) {
      return
    }

    setChunksLoading(true)
    try {
      const res = await fetch(`/api/runs/${routeRunId}/chunks`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        console.error('[Chunks] Failed to fetch chunks')
        setChunks([])
        setChunksLoading(false)
        return
      }
      const data = await res.json()
      if (data.ok && data.chunks) {
        setChunks(data.chunks)
      } else {
        setChunks([])
      }
    } catch (err) {
      console.error('[Chunks] Error fetching chunks:', err)
      setChunks([])
    } finally {
      setChunksLoading(false)
    }
  }, [routeRunId, userPlan])

  // Download chunk transcript
  const downloadChunkTranscript = async (chunkId: string) => {
    try {
      const res = await fetch(`/api/runs/${routeRunId}/chunks/${chunkId}/transcript.txt`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        if (res.status === 404) {
          setError('Transcript not ready yet')
        } else {
          setError('Failed to download transcript')
        }
        return
      }
      const text = await res.text()
      const blob = new Blob([text], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `chunk_${chunkId}_transcript.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[Chunks] Error downloading transcript:', err)
      setError('Failed to download transcript')
    }
  }

  // Retry chunk transcription
  const retryChunkTranscription = async (chunkId: string) => {
    setRetryingChunkId(chunkId)
    try {
      const res = await fetch(`/api/runs/${routeRunId}/chunks/${chunkId}/transcribe`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Transcription failed')
      }
      const data = await res.json()
      if (data.ok && data.chunk) {
        // Update chunk in state
        setChunks(prev => prev.map(chunk => 
          chunk.id === chunkId ? data.chunk : chunk
        ))
      }
      // Refetch chunks to get updated status
      await fetchChunks()
    } catch (err: any) {
      console.error('[Chunks] Error retrying transcription:', err)
      setError(err.message || 'Failed to retry transcription')
    } finally {
      setRetryingChunkId(null)
    }
  }

  useEffect(() => {
    // Get user plan on mount
    getUserPlan().then(plan => {
      // Normalize daypass to day_pass for compatibility
      setUserPlan(plan === 'daypass' ? 'day_pass' : plan)
    })
    fetchRun(false)
  }, [routeRunId])

  // Fetch progress when run is loaded and user can view progress (Coach only)
  useEffect(() => {
    if (run && canViewProgressPanel(userPlan) && run.analysis_json) {
      fetchProgress()
    }
  }, [run, userPlan, fetchProgress])

  // Fetch chunks when run is loaded and user is Coach
  useEffect(() => {
    if (run && hasCoachAccess(userPlan)) {
      fetchChunks()
    }
  }, [run, userPlan, fetchChunks])

  // Polling: poll every 1500ms while analysis is in progress
  // MAX_ANALYSIS_WAIT_MS: 60 seconds timeout
  const MAX_ANALYSIS_WAIT_MS = 60_000
  
  useEffect(() => {
    if (!run) return

    const status = run.status
    // Stop polling when fully analyzed
    const hasCompleteData = run.status === 'analyzed'
    
    // Determine if we should poll based on stage
    const shouldPoll = analysisStage !== 'idle' && 
                       analysisStage !== 'complete' && 
                       analysisStage !== 'error' &&
                       !hasCompleteData

    if (!shouldPoll) {
      return
    }

    // Check for timeout
    if (analysisStartTime && Date.now() - analysisStartTime > MAX_ANALYSIS_WAIT_MS) {
      setShowTimeoutMessage(true)
      // Don't stop polling, but show message
    }

    const intervalId = setInterval(async () => {
      const shouldContinue = await fetchRun(true)
      if (!shouldContinue) {
        clearInterval(intervalId)
      }
    }, 1500)

    return () => {
      clearInterval(intervalId)
    }
  }, [run?.status, run?.transcript, run?.analysis_json, analysisStage, analysisStartTime, routeRunId, fetchRun])

  useEffect(() => {
    if (run?.audio_path) {
      setAudioError(false)
      fetchAudioUrl()
    }
  }, [run?.audio_path, routeRunId])

  const handleTranscribe = async () => {
    if (!routeRunId) return

    setIsTranscribing(true)
    setError(null)
    setLastAction(null)

    const url = `/api/runs/${routeRunId}/transcribe`
    try {
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
      })

      if (!res.ok) {
        await logFetchError(url, res)
        const errorData = await res.json()
        const errorMsg = errorData.message || errorData.error || 'Transcription failed'
        setError(errorMsg)
        setLastAction(`Transcription failed: ${errorMsg}`)
        setIsTranscribing(false)
        return
      }

      const responseData = await res.json()
      console.log('[Transcribe Response]', JSON.stringify(responseData, null, 2))
      setLastTranscribeResponse(responseData)

      const responseRunId = responseData.runId
      console.log({ routeRunId, responseRunId: responseRunId })

      if (responseRunId && responseRunId !== routeRunId) {
        console.log(`[ID Mismatch] Redirecting from ${routeRunId} to ${responseRunId}`)
        router.replace(`/runs/${responseRunId}`)
        return
      }

      // Normalize response shape
      const normalizedRun = responseData.ok && responseData.run ? responseData.run : responseData
      const normalizedTranscript = responseData.transcript ?? responseData.run?.transcript ?? normalizedRun?.transcript ?? null
      
      if (normalizedRun) {
        const runData: Run = {
          ...normalizedRun,
          transcript: normalizedTranscript ?? normalizedRun.transcript ?? null,
        }
        
        // Use priority-based update
        const currentRun = runRef.current
        const currentPriority = getStatusPriority(currentRun?.status)
        const newPriority = getStatusPriority(runData.status)
        
        if (newPriority >= currentPriority) {
          setRun(runData)
          if (normalizedTranscript) {
            setLastTranscript(normalizedTranscript)
          }
          setLastAction('Transcription completed successfully')
        }
      } else {
        setError(responseData.message || 'Transcription failed')
        setLastAction(`Transcription failed: ${responseData.message || 'Unknown error'}`)
      }
    } catch (err: any) {
      console.error('Transcription error:', err)
      const errorMsg = err.message || 'Failed to transcribe audio'
      setError(errorMsg)
      setLastAction(`Transcription failed: ${errorMsg}`)
    } finally {
      setIsTranscribing(false)
      await fetchRun()
    }
  }

  const handleGetFeedback = async () => {
    if (!routeRunId) return

    setIsGettingFeedback(true)
    setAnalysisStage('analyzing')
    setAnalysisStartTime(Date.now())
    setShowTimeoutMessage(false)
    setError(null)
    setLastAction(null)

    const url = `/api/runs/${routeRunId}/analyze?mode=full`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rubric_id: run?.rubrics?.id || null,
        }),
        cache: 'no-store',
      })

      if (!res.ok) {
        await logFetchError(url, res)
        const errorData = await res.json()
        const errorMsg = errorData.message || errorData.error || 'Feedback generation failed'
        setError(errorMsg)
        setLastAction(`Feedback generation failed: ${errorMsg}`)
        return
      }

      const responseData = await res.json()
      
      // Normalize response shape: handle both { run, analysis } and { run } formats
      const normalizedRun = responseData.ok && responseData.run ? responseData.run : responseData
      const normalizedAnalysis = responseData.analysis ?? responseData.run?.analysis_json ?? normalizedRun?.analysis_json ?? null
      const normalizedSummary = responseData.analysis_summary_json ?? responseData.run?.analysis_summary_json ?? normalizedRun?.analysis_summary_json ?? null
      const resolvedAnalysis = normalizedAnalysis ?? normalizedSummary ?? null
      
      if (normalizedRun) {
        const runData: Run = {
          ...normalizedRun,
          analysis_json: resolvedAnalysis ?? normalizedRun.analysis_json ?? null,
          analysis_summary_json: normalizedSummary ?? normalizedRun.analysis_summary_json ?? null,
        }
        
        // Use priority-based update
        const currentRun = runRef.current
        const currentPriority = getStatusPriority(currentRun?.status)
        const newPriority = getStatusPriority(runData.status)
        
        if (newPriority >= currentPriority) {
          setRun(runData)
          setLastAction('Feedback generated successfully')
        }
      } else {
        setError(responseData.message || 'Feedback generation failed')
        setLastAction(`Feedback generation failed: ${responseData.message || 'Unknown error'}`)
      }
    } catch (err: any) {
      console.error('Feedback generation error:', err)
      const errorMsg = err.message || 'Failed to generate feedback'
      setError(errorMsg)
      setLastAction(`Feedback generation failed: ${errorMsg}`)
    } finally {
      setIsGettingFeedback(false)
      await fetchRun()
    }
  }


  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return '—'
    if (seconds < 60) {
      return `0:${Math.floor(seconds).toString().padStart(2, '0')}`
    }
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  }

  const exportSummaryPDF = (runData: Run) => {
    if (!runData.analysis_json) return

    // Create a hidden div with the summary content
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow pop-ups to export PDF')
      return
    }

    const durationSeconds = runData.duration_ms ? runData.duration_ms / 1000 : runData.audio_seconds
    const duration = durationSeconds ? formatDuration(durationSeconds) : 'N/A'
    const wpm = runData.words_per_minute ? `${runData.words_per_minute} WPM` : 'N/A'
    const wordCount = runData.word_count !== null && runData.word_count !== undefined ? runData.word_count.toLocaleString() : 'N/A'
    const title = runData.title || 'Untitled'
    const date = new Date(runData.created_at).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })

    const analysis = runData.analysis_json
    const overallScore = analysis.summary?.overall_score || 'N/A'
    const overallNotes = analysis.summary?.overall_notes || ''
    const topStrengths = analysis.summary?.top_strengths || []
    const topImprovements = analysis.summary?.top_improvements || []
    const rubricScores = analysis.rubric_scores || []

    let rubricScoresHTML = ''
    if (rubricScores.length > 0) {
      rubricScoresHTML = `
        <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
          <thead>
            <tr style="background-color: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 10px; text-align: left; font-weight: 600;">Criterion</th>
              <th style="padding: 10px; text-align: center; font-weight: 600;">Score</th>
            </tr>
          </thead>
          <tbody>
            ${rubricScores.map((score: any) => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 10px;">${score.criterion_label || score.criterion || 'N/A'}</td>
                <td style="padding: 10px; text-align: center; font-weight: 600;">${score.score || 0}/10</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - Pitch Practice Summary</title>
          <style>
            @media print {
              body { margin: 0; }
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              max-width: 800px;
              margin: 0 auto;
              padding: 40px 20px;
            }
            h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 10px;
              color: #111827;
            }
            .meta {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 30px;
            }
            .section {
              margin-top: 30px;
            }
            .section-title {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 15px;
              color: #111827;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 8px;
            }
            .score {
              font-size: 24px;
              font-weight: 700;
              color: #f59e0b;
              margin: 10px 0;
            }
            ul {
              margin: 10px 0;
              padding-left: 20px;
            }
            li {
              margin: 8px 0;
            }
            .strengths li {
              color: #059669;
            }
            .improvements li {
              color: #dc2626;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 10px;
              text-align: left;
              border-bottom: 1px solid #e5e7eb;
            }
            th {
              background-color: #f3f4f6;
              font-weight: 600;
            }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">
            <div>Date: ${date}</div>
            <div>Duration: ${duration} | WPM: ${wpm} | Word Count: ${wordCount}</div>
          </div>

          ${overallNotes ? `
            <div class="section">
              <div class="section-title">Overall Notes</div>
              <p>${overallNotes}</p>
            </div>
          ` : ''}

          ${topStrengths.length > 0 ? `
            <div class="section">
              <div class="section-title">Top Strengths</div>
              <ul class="strengths">
                ${topStrengths.map((s: string) => `<li>${s.replace(/^["']|["']$/g, '').trim()}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${topImprovements.length > 0 ? `
            <div class="section">
              <div class="section-title">Top Improvements</div>
              <ul class="improvements">
                ${topImprovements.map((i: string) => `<li>${i.replace(/^["']|["']$/g, '').trim()}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          ${rubricScoresHTML ? `
            <div class="section">
              <div class="section-title">Rubric Scores</div>
              ${rubricScoresHTML}
            </div>
          ` : ''}
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
    
    // Wait for content to load, then trigger print
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }


  // Split transcript into sentences with stable indices
  const splitIntoSentences = (text: string): string[] => {
    if (!text) return []
    // Split by sentence endings, but preserve the punctuation
    const sentences = text
      .split(/([.!?]+[\s\n]+)/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim())
    
    // Merge punctuation back with previous sentence
    const merged: string[] = []
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].match(/^[.!?]+$/)) {
        // This is just punctuation, merge with previous
        if (merged.length > 0) {
          merged[merged.length - 1] += sentences[i]
        }
      } else {
        merged.push(sentences[i])
      }
    }
    
    return merged.filter(s => s.length > 0)
  }

  // Map line_by_line feedback to sentence indices
  const createFeedbackToSentenceMap = (transcript: string, lineByLine: any[]): Map<number, number> => {
    const sentences = splitIntoSentences(transcript)
    const feedbackToSentenceMap = new Map<number, number>()
    
    lineByLine.forEach((item, feedbackIdx) => {
      const quote = (item.quote || '').toLowerCase().trim()
      if (!quote) return
      
      let bestMatchIdx = -1
      let bestScore = 0
      
      sentences.forEach((sentence, sentenceIdx) => {
        const sentenceLower = sentence.toLowerCase().trim()
        
        // Exact substring match
        if (sentenceLower.includes(quote) || quote.includes(sentenceLower)) {
          const score = Math.min(sentenceLower.length, quote.length) / Math.max(sentenceLower.length, quote.length)
          if (score > bestScore) {
            bestScore = score
            bestMatchIdx = sentenceIdx
          }
        }
      })
      
      // Fallback: word overlap
      if (bestMatchIdx === -1) {
        const quoteWords = quote.split(/\s+/).filter((w: string) => w.length > 2)
        sentences.forEach((sentence, sentenceIdx) => {
          const sentenceLower = sentence.toLowerCase().trim()
          const sentenceWords = sentenceLower.split(/\s+/).filter((w: string) => w.length > 2)
          const overlap = sentenceWords.filter((w: string) => quoteWords.includes(w))
          if (overlap.length >= 3) {
            const score = overlap.length / Math.max(sentenceWords.length, quoteWords.length)
            if (score > bestScore) {
              bestScore = score
              bestMatchIdx = sentenceIdx
            }
          }
        })
      }
      
      if (bestMatchIdx !== -1) {
        feedbackToSentenceMap.set(feedbackIdx, bestMatchIdx)
      }
    })
    
    return feedbackToSentenceMap
  }

  // Create reverse map: sentence index -> feedback index
  const createSentenceToFeedbackMap = (transcript: string, lineByLine: any[]): Map<number, number> => {
    const feedbackToSentenceMap = createFeedbackToSentenceMap(transcript, lineByLine)
    const sentenceToFeedbackMap = new Map<number, number>()
    
    feedbackToSentenceMap.forEach((sentenceIdx, feedbackIdx) => {
      sentenceToFeedbackMap.set(sentenceIdx, feedbackIdx)
    })
    
    return sentenceToFeedbackMap
  }

  // Scroll to feedback card and highlight it
  const scrollToFeedback = (feedbackIdx: number) => {
    const feedbackElement = document.getElementById(`feedback-${feedbackIdx}`)
    if (feedbackElement) {
      feedbackElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedFeedbackIdx(feedbackIdx)
      // Auto-clear highlight after 2 seconds
      setTimeout(() => {
        setHighlightedFeedbackIdx(null)
      }, 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center py-20 bg-[#0E1117]">
        <LoadingSpinner size="lg" text="Loading pitch run..." />
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[#0E1117]">
        <Card className="max-w-2xl w-full text-center">
          <h1 className="text-2xl font-bold text-[#E5E7EB] mb-4">Error</h1>
          <p className="text-[#9CA3AF] mb-6">{error || 'Run not found'}</p>
          <Link href="/app">
            <Button variant="primary">
              Back to Home
            </Button>
          </Link>
        </Card>
      </div>
    )
  }

  const transcript = run.transcript ?? lastTranscript ?? ""

  return (
    <div className="min-h-screen bg-[#0E1117] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Error Messages */}
        <AnimatePresence>
          {run.error_message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-6 p-4 bg-red-500/20 border-2 border-red-500/50 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-xl">⚠️</span>
                <div className="flex-1">
                  <strong className="text-red-400 text-lg block mb-1">Error</strong>
                  <p className="text-red-300">{run.error_message}</p>
                </div>
              </div>
            </motion.div>
          )}

          {lastTranscribeResponse && !lastTranscribeResponse.ok && lastTranscribeResponse.message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-6 p-4 bg-red-500/20 border-2 border-red-500/50 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-xl">⚠️</span>
                <div className="flex-1">
                  <strong className="text-red-400 text-lg block mb-1">Transcription Failed</strong>
                  <p className="text-red-300">{lastTranscribeResponse.message}</p>
                </div>
              </div>
            </motion.div>
          )}

          {lastAction && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-6 p-3 bg-green-500/20 border border-green-500/50 rounded-lg"
            >
              <p className="text-green-400 text-sm font-medium">{lastAction}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column - Transcript + Feedback */}
          <div className="lg:col-span-2 space-y-6">
            {/* Prompt/Rubric Card - Show which prompt was used */}
            {(run.rubrics || run.rubric_snapshot_json) ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Card>
                  <SectionHeader title="Evaluation Prompt" />
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[#E5E7EB] mb-2">
                        {run.rubric_snapshot_json?.name || run.rubric_snapshot_json?.title || run.rubrics?.name || run.rubrics?.title || 'Custom Rubric'}
                      </h3>
                      {(run.rubric_snapshot_json?.description || run.rubrics?.description) && (
                        <p className="text-sm text-[#9CA3AF]">
                          {run.rubric_snapshot_json?.description || run.rubrics?.description}
                        </p>
                      )}
                    </div>
                    {((run.rubric_snapshot_json?.criteria && Array.isArray(run.rubric_snapshot_json.criteria)) || 
                      (run.rubrics?.criteria && Array.isArray(run.rubrics.criteria))) && (
                      <div className="pt-3 border-t border-[#22283A]">
                        <p className="text-xs font-semibold text-[#9CA3AF] mb-2 uppercase tracking-wide">Criteria:</p>
                        <ul className="space-y-2">
                          {(run.rubric_snapshot_json?.criteria || run.rubrics?.criteria || []).map((criterion: any, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#E5E7EB]">
                              <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">•</span>
                              <div>
                                <span className="font-medium">{criterion.name || criterion.label || `Question ${idx + 1}`}</span>
                                {criterion.description && (
                                  <span className="text-[#9CA3AF] ml-2">— {criterion.description}</span>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            ) : null}

            {/* Banner for Coach users with non-coach-at-time runs */}
            {(() => {
              const isCurrentUserCoach = userPlan === 'coach'
              const runPlanAtTime = run.plan_at_time || run.analysis_json?.meta?.plan_at_time
              const isRunCoachAtTime = runPlanAtTime === 'coach'
              return isCurrentUserCoach && !isRunCoachAtTime && run.analysis_json
            })() && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              >
                <Card>
                  <div className="flex items-start gap-3 p-4 bg-[#1A1F2E] border border-[#F59E0B]/30 rounded-lg">
                    <div className="flex-1">
                      <p className="text-sm text-[#E5E7EB] mb-3">
                        This run was analyzed on Starter. Re-run analysis on Coach to unlock Premium Insights.
                      </p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          if (!routeRunId) return
                          setIsGettingFeedback(true)
                          setError(null)
                          const url = `/api/runs/${routeRunId}/analyze?mode=full`
                          try {
                            const res = await fetch(url, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify({
                                rubric_id: run?.rubrics?.id || null,
                              }),
                              cache: 'no-store',
                            })
                            if (!res.ok) {
                              await logFetchError(url, res)
                              const errorData = await res.json()
                              const errorMsg = errorData.message || errorData.error || 'Re-analysis failed'
                              setError(errorMsg)
                              return
                            }
                            const responseData = await res.json()
                            const normalizedRun = responseData.ok && responseData.run ? responseData.run : responseData
                            const normalizedAnalysis = responseData.analysis ?? responseData.run?.analysis_json ?? normalizedRun?.analysis_json ?? null
                            const normalizedSummary = responseData.analysis_summary_json ?? responseData.run?.analysis_summary_json ?? normalizedRun?.analysis_summary_json ?? null
                            const resolvedAnalysis = normalizedAnalysis ?? normalizedSummary ?? null
                            if (normalizedRun) {
                              const runData: Run = {
                                ...normalizedRun,
                                analysis_json: resolvedAnalysis ?? normalizedRun.analysis_json ?? null,
                                analysis_summary_json: normalizedSummary ?? normalizedRun.analysis_summary_json ?? null,
                              }
                              const currentRun = runRef.current
                              const currentPriority = getStatusPriority(currentRun?.status)
                              const newPriority = getStatusPriority(runData.status)
                              if (newPriority >= currentPriority) {
                                setRun(runData)
                              }
                            }
                            // Refresh the run data
                            await fetchRun(false)
                          } catch (err: any) {
                            console.error('Re-analysis error:', err)
                            setError(err.message || 'Re-analysis failed')
                          } finally {
                            setIsGettingFeedback(false)
                          }
                        }}
                        disabled={isGettingFeedback || !run.transcript}
                      >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isGettingFeedback ? 'animate-spin' : ''}`} />
                        {isGettingFeedback ? 'Re-analyzing...' : 'Re-analyze with Coach'}
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Premium Insights Card - For Coach and active Day Pass */}
            {(() => {
              // Guard: ensure run exists
              if (!run) return null
              
              const coachAccess = hasCoachAccess(userPlan)
              const dayPassActive = hasDayPassAccess(userPlan)
              const canViewPremium = canViewPremiumInsights(userPlan)
              const hasPremiumInsights = run.analysis_json?.premium_insights
              const hasPremiumContent = run.analysis_json?.premium
              
              // Check if Day Pass expired (run was analyzed on daypass but user no longer has active daypass)
              const runPlanAtTime = run.plan_at_time || run.analysis_json?.meta?.plan_at_time
              const wasDayPassAtTime = runPlanAtTime === 'daypass' || runPlanAtTime === 'day_pass'
              const isDayPassExpired = wasDayPassAtTime && !dayPassActive && !coachAccess
              
              // Show Premium Insights if:
              // 1. User can view premium (current plan is Coach or active Day Pass) OR
              // 2. Run was analyzed with Coach plan (plan_at_time === 'coach')
              // This ensures Coach users see their premium insights even if plan changes
              const wasCoachAtTime = runPlanAtTime === 'coach'
              // Show premium section if:
              // 1. User has access AND (has premium data OR analysis is complete and might still be generating premium)
              // 2. This allows progressive loading - show section even if premium is still processing
              const hasSummary = !!(run.analysis_json?.summary)
              const isAnalysisComplete = hasSummary && !!(run.transcript && run.transcript.trim().length > 0)
              const shouldShowPremium = (canViewPremium || wasCoachAtTime) && 
                                        !isDayPassExpired &&
                                        (hasPremiumInsights || hasPremiumContent || (isAnalysisComplete && (runPlanAtTime === 'coach' || userPlan === 'coach')))
              
              if (shouldShowPremium) {
                const isPremiumStillLoading = isAnalysisComplete && !hasPremiumInsights && !hasPremiumContent && (wasCoachAtTime || coachAccess)
                
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                  >
                    <Card>
                      <div className="flex items-center gap-2 mb-6">
                        <Sparkles className="h-5 w-5 text-[#F59E0B]" />
                        <SectionHeader title="Premium Insights" />
                      </div>
                      
                      {/* Premium insights still loading message */}
                      {isPremiumStillLoading && (
                        <div className="mb-6 p-4 bg-[#1A1F2E] border border-[#F59E0B]/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <LoadingSpinner size="sm" />
                            <div className="flex-1">
                              <p className="text-sm text-[#E5E7EB]">
                                Some advanced insights are still processing. They may appear shortly.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Signature Insight */}
                      {run.analysis_json.premium?.signature_insight && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-[#F59E0B]/10 to-[#F59E0B]/5 border border-[#F59E0B]/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-[#F59E0B] mb-2">Signature Insight</h3>
                              <p className="text-sm text-[#E5E7EB] leading-relaxed">
                                {run.analysis_json.premium.signature_insight}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Coach's Take */}
                      {run.analysis_json.premium?.coach_take && (
                        <div className="mb-6 p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                          <h3 className="text-sm font-semibold text-[#E5E7EB] mb-3">Coach's Take</h3>
                          <div className="space-y-3">
                            <p className="text-sm text-[#E5E7EB] leading-relaxed whitespace-pre-line">
                              {run.analysis_json.premium.coach_take}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Premium Filler Word Breakdown */}
                      {run.analysis_json.premium?.filler && (
                        <div className="mb-6 p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                          <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Filler Word Breakdown</h3>
                          
                          <div className="space-y-4">
                            {/* Total Count */}
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Total</p>
                              <p className="text-2xl font-bold text-[#F59E0B]">
                                {run.analysis_json.premium.filler.total}
                              </p>
                            </div>

                            {/* By Word Chips */}
                            {Object.keys(run.analysis_json.premium.filler.by_word).length > 0 && (
                              <div>
                                <p className="text-xs text-[#9CA3AF] mb-2">By Word</p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(run.analysis_json.premium.filler.by_word)
                                    .filter(([_, count]) => (count as number) > 0)
                                    .sort(([_, a], [__, b]) => (b as number) - (a as number))
                                    .map(([word, count]) => (
                                      <Badge key={word} variant="warning" size="sm">
                                        {word}: {count as number}
                                      </Badge>
                                    ))}
                                </div>
                              </div>
                            )}

                            {/* Where it happens (Intro / Middle / Close) */}
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Where it happens</p>
                              <div className="flex gap-4 text-sm">
                                <div className="flex-1 p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                  <p className="text-xs text-[#9CA3AF] mb-1">Intro</p>
                                  <p className="text-base font-semibold text-[#E5E7EB]">
                                    {run.analysis_json.premium.filler.sections.intro}
                                  </p>
                                </div>
                                <div className="flex-1 p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                  <p className="text-xs text-[#9CA3AF] mb-1">Middle</p>
                                  <p className="text-base font-semibold text-[#E5E7EB]">
                                    {run.analysis_json.premium.filler.sections.middle}
                                  </p>
                                </div>
                                <div className="flex-1 p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                  <p className="text-xs text-[#9CA3AF] mb-1">Close</p>
                                  <p className="text-base font-semibold text-[#E5E7EB]">
                                    {run.analysis_json.premium.filler.sections.close}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Insight */}
                            {run.analysis_json.premium.filler.insight && (
                              <div className="pt-2 border-t border-[#22283A]">
                                <p className="text-xs text-[#9CA3AF] mb-2">Pattern</p>
                                <p className="text-sm text-[#E5E7EB] leading-relaxed">
                                  {run.analysis_json.premium.filler.insight}
                                </p>
                              </div>
                            )}

                            {/* Drill */}
                            {run.analysis_json.premium.filler.drill && (
                              <div className="pt-2 border-t border-[#22283A]">
                                <p className="text-xs text-[#9CA3AF] mb-2">What to do</p>
                                <div className="p-3 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                  <h4 className="text-xs font-semibold text-[#F59E0B] mb-2">
                                    {run.analysis_json.premium.filler.drill.title}
                                  </h4>
                                  <ol className="space-y-1.5 list-decimal list-inside">
                                    {run.analysis_json.premium.filler.drill.steps.map((step: string, idx: number) => (
                                      <li key={idx} className="text-xs text-[#E5E7EB]">
                                        {step}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Filler Words Section - Coach only */}
                      {(runPlanAtTime === 'coach' || userPlan === 'coach') && run.analysis_json.premium_insights?.filler_words && (
                        <div className="mb-6">
                          <div className="p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                            <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Filler Words</h3>
                            
                            {/* Total Count */}
                            <div className="mb-4">
                              <p className="text-xs text-[#9CA3AF] mb-1">Total Filler Words Used</p>
                              <p className="text-2xl font-bold text-[#F59E0B]">
                                {run.analysis_json.premium_insights.filler_words.total_count}
                              </p>
                            </div>

                            {/* Table/List: Word | Count | Example | Suggested replacement */}
                            {run.analysis_json.premium_insights.filler_words.by_word && 
                             run.analysis_json.premium_insights.filler_words.by_word.length > 0 ? (
                              <div className="space-y-3 mb-4">
                                {run.analysis_json.premium_insights.filler_words.by_word.map((item: any, idx: number) => (
                                  <div key={idx} className="p-3 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-sm font-semibold text-[#E5E7EB]">{item.word}</span>
                                          <Badge variant="warning" size="sm">
                                            {item.count} {item.count === 1 ? 'time' : 'times'}
                                          </Badge>
                                        </div>
                                        
                                        {/* Examples */}
                                        {item.examples && item.examples.length > 0 && (
                                          <div className="mb-2">
                                            <p className="text-xs text-[#9CA3AF] mb-1">Examples:</p>
                                            <div className="space-y-1">
                                              {item.examples.map((example: string, exIdx: number) => (
                                                <p key={exIdx} className="text-xs text-[#E5E7EB] italic">
                                                  "{example}"
                                                </p>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Suggestions */}
                                        {item.suggestions && item.suggestions.length > 0 && (
                                          <div>
                                            <p className="text-xs text-[#9CA3AF] mb-1">Suggested approach:</p>
                                            <div className="flex flex-wrap gap-1">
                                              {item.suggestions.map((suggestion: string, sugIdx: number) => (
                                                <Badge key={sugIdx} variant="info" size="sm">
                                                  {suggestion}
                                                </Badge>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="mb-4 p-3 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                <p className="text-sm text-[#9CA3AF]">No filler words detected.</p>
                              </div>
                            )}

                            {/* Coaching Notes */}
                            {run.analysis_json.premium_insights.filler_words.coaching_notes && 
                             run.analysis_json.premium_insights.filler_words.coaching_notes.length > 0 && (
                              <div className="pt-3 border-t border-[#22283A]">
                                <p className="text-xs text-[#9CA3AF] mb-2">Coaching Notes</p>
                                <ul className="space-y-1.5 list-disc list-inside">
                                  {run.analysis_json.premium_insights.filler_words.coaching_notes.map((note: string, noteIdx: number) => (
                                    <li key={noteIdx} className="text-xs text-[#E5E7EB]">
                                      {note}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* 2. Pacing & Pauses */}
                    {run.analysis_json.premium_insights.pacing && (
                      <div className="p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                        <h3 className="text-sm font-semibold text-[#E5E7EB] mb-3">Pacing & Pauses</h3>
                        <div className="space-y-3">
                          {run.analysis_json.premium_insights.pacing.wpm_overall !== null && 
                           run.analysis_json.premium_insights.pacing.wpm_overall !== undefined && (
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-1">Overall WPM</p>
                              <p className="text-lg font-bold text-[#F59E0B]">
                                {Math.round(run.analysis_json.premium_insights.pacing.wpm_overall)}
                              </p>
                            </div>
                          )}
                          
                          {run.analysis_json.premium_insights.pacing.segments && 
                           run.analysis_json.premium_insights.pacing.segments.length > 0 && (
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Segments</p>
                              <div className="space-y-2">
                                {run.analysis_json.premium_insights.pacing.segments.map((segment: any, idx: number) => (
                                  <div key={idx} className="p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Badge 
                                        variant={
                                          segment.label === 'slow' ? 'info' :
                                          segment.label === 'fast' ? 'warning' : 'success'
                                        }
                                        size="sm"
                                      >
                                        {segment.label}
                                      </Badge>
                                      {segment.wpm !== null && segment.wpm !== undefined && (
                                        <span className="text-xs text-[#9CA3AF]">
                                          {Math.round(segment.wpm)} WPM
                                        </span>
                                      )}
                                    </div>
                                    {segment.start_sec !== null && segment.end_sec !== null && (
                                      <p className="text-xs text-[#9CA3AF] mb-1">
                                        {segment.start_sec.toFixed(1)}s - {segment.end_sec.toFixed(1)}s
                                      </p>
                                    )}
                                    {segment.note && (
                                      <p className="text-xs text-[#E5E7EB]">{segment.note}</p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {run.analysis_json.premium_insights.pacing.pauses && (
                            <div className="pt-2 border-t border-[#22283A]">
                              <p className="text-xs text-[#9CA3AF] mb-2">Pauses</p>
                              <div className="space-y-1">
                                {run.analysis_json.premium_insights.pacing.pauses.longest_pause_sec !== null && (
                                  <p className="text-xs text-[#E5E7EB]">
                                    Longest: {run.analysis_json.premium_insights.pacing.pauses.longest_pause_sec.toFixed(1)}s
                                  </p>
                                )}
                                <p className="text-xs text-[#E5E7EB]">
                                  Long pauses: {run.analysis_json.premium_insights.pacing.pauses.long_pause_count || 0}
                                </p>
                                {run.analysis_json.premium_insights.pacing.pauses.notes && (
                                  <p className="text-xs text-[#9CA3AF] mt-1">
                                    {run.analysis_json.premium_insights.pacing.pauses.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. Structure */}
                    {run.analysis_json.premium_insights.structure && (
                      <div className="p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                        <h3 className="text-sm font-semibold text-[#E5E7EB] mb-3">Structure</h3>
                        <div className="space-y-3">
                          {run.analysis_json.premium_insights.structure.detected_sections && 
                           run.analysis_json.premium_insights.structure.detected_sections.length > 0 && (
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Detected Sections</p>
                              <div className="flex flex-wrap gap-2">
                                {run.analysis_json.premium_insights.structure.detected_sections.map((section: string) => (
                                  <Badge key={section} variant="success" size="sm">
                                    {section}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {run.analysis_json.premium_insights.structure.missing_sections && 
                           run.analysis_json.premium_insights.structure.missing_sections.length > 0 && (
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Missing Sections</p>
                              <div className="flex flex-wrap gap-2">
                                {run.analysis_json.premium_insights.structure.missing_sections.map((section: string) => (
                                  <Badge key={section} variant="warning" size="sm">
                                    {section}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {run.analysis_json.premium_insights.structure.suggested_lines && 
                           Object.keys(run.analysis_json.premium_insights.structure.suggested_lines).length > 0 && (
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Suggested Lines</p>
                              <div className="space-y-2">
                                {Object.entries(run.analysis_json.premium_insights.structure.suggested_lines).map(([section, line]: [string, any]) => (
                                  <div key={section} className="p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="flex-1">
                                        <p className="text-xs font-semibold text-[#F59E0B] mb-1">{section}</p>
                                        <p className="text-xs text-[#E5E7EB]">{line}</p>
                                      </div>
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(line)
                                        }}
                                        className="p-1.5 hover:bg-[#22283A] rounded transition-colors"
                                        title="Copy to clipboard"
                                      >
                                        <Copy className="h-3.5 w-3.5 text-[#9CA3AF]" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {run.analysis_json.premium_insights.structure.one_sentence_pitch && (
                            <div className="pt-2 border-t border-[#22283A]">
                              <p className="text-xs text-[#9CA3AF] mb-2">One-Sentence Pitch</p>
                              <div className="p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs text-[#E5E7EB] flex-1">
                                    {run.analysis_json.premium_insights.structure.one_sentence_pitch}
                                  </p>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(run.analysis_json.premium_insights.structure.one_sentence_pitch)
                                    }}
                                    className="p-1.5 hover:bg-[#22283A] rounded transition-colors flex-shrink-0"
                                    title="Copy to clipboard"
                                  >
                                    <Copy className="h-3.5 w-3.5 text-[#9CA3AF]" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. Coaching Plan */}
                    {run.analysis_json.premium_insights.coaching_plan && (
                      <div className="p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                        <h3 className="text-sm font-semibold text-[#E5E7EB] mb-3">Coaching Plan</h3>
                        <div className="space-y-4">
                          {run.analysis_json.premium_insights.coaching_plan.next_attempt_focus && 
                           run.analysis_json.premium_insights.coaching_plan.next_attempt_focus.length > 0 && (
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Next Attempt Focus</p>
                              <ul className="space-y-1.5">
                                {run.analysis_json.premium_insights.coaching_plan.next_attempt_focus.map((focus: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 text-xs text-[#E5E7EB]">
                                    <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">•</span>
                                    <span>{focus}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {run.analysis_json.premium_insights.coaching_plan.drills && 
                           run.analysis_json.premium_insights.coaching_plan.drills.length > 0 && (
                            <div>
                              <p className="text-xs text-[#9CA3AF] mb-2">Practice Drills</p>
                              <div className="space-y-2">
                                {run.analysis_json.premium_insights.coaching_plan.drills.map((drill: any, idx: number) => (
                                  <DrillAccordion key={idx} title={drill.title} steps={drill.steps || []} />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                      
                      {/* Upsell banner for active Day Pass */}
                      {dayPassActive && !coachAccess && (
                        <div className="mt-6 p-4 bg-gradient-to-r from-[#F59E0B]/10 to-[#F59E0B]/5 border border-[#F59E0B]/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-[#F59E0B] mb-2">Want ongoing progress tracking + rubric editing?</h3>
                              <p className="text-xs text-[#E5E7EB] mb-3">
                                Upgrade to Coach to unlock progress over time comparisons and full rubric editing capabilities.
                              </p>
                              <Button
                                onClick={() => router.push('/upgrade?plan=coach')}
                                variant="primary"
                                size="sm"
                              >
                                Upgrade to Coach
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    </Card>
                  </motion.div>
                )
              }
              
              // Show expired Day Pass banner or upsell card
              if (!canViewPremium) {
                // Check if Day Pass expired
                const runPlanAtTime = run.plan_at_time || run.analysis_json?.meta?.plan_at_time
                const wasDayPassAtTime = runPlanAtTime === 'daypass' || runPlanAtTime === 'day_pass'
                const isDayPassExpired = wasDayPassAtTime && !dayPassActive && !coachAccess
                
                if (isDayPassExpired) {
                  // Show expired Day Pass banner
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                    >
                      <Card>
                        <div className="p-4 bg-[#1A1F2E] border border-[#F59E0B]/30 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Sparkles className="h-5 w-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h3 className="text-sm font-semibold text-[#F59E0B] mb-2">Your Day Pass has ended</h3>
                              <p className="text-sm text-[#E5E7EB] mb-4">
                                Upgrade to Coach to unlock Premium Insights again.
                              </p>
                              <div className="flex flex-col sm:flex-row gap-3">
                                <Button
                                  onClick={() => router.push('/upgrade?plan=coach')}
                                  variant="primary"
                                  size="sm"
                                  className="flex-1"
                                >
                                  Upgrade to Coach
                                </Button>
                                <Button
                                  onClick={() => router.push('/app/practice')}
                                  variant="secondary"
                                  size="sm"
                                  className="flex-1"
                                >
                                  Record again
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  )
                }
                
                // Show regular upsell card for non-Day Pass users
                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                  >
                    <Card>
                      <div className="flex items-center gap-2 mb-4">
                        <Sparkles className="h-5 w-5 text-[#F59E0B]" />
                        <SectionHeader title="Unlock Premium Insights" />
                      </div>
                      
                      <div className="space-y-4">
                        <ul className="space-y-2 text-sm text-[#E5E7EB]">
                          <li className="flex items-start gap-2">
                            <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">•</span>
                            <span>Filler word breakdown</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">•</span>
                            <span>Pacing & pause coaching</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">•</span>
                            <span>Structure drills</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">•</span>
                            <span>Progress over time</span>
                          </li>
                        </ul>
                        
                        <div className="flex flex-col sm:flex-row gap-3 pt-2">
                          <Button
                            onClick={() => router.push('/upgrade?plan=coach')}
                            variant="primary"
                            size="sm"
                            className="flex-1"
                          >
                            Upgrade to Coach
                          </Button>
                          <Button
                            onClick={() => router.push('/app/practice')}
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                          >
                            Back to practice
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                )
              }
              
              // No Premium Insights and user has coach access (insights not generated yet)
              return null
            })()}

            {/* Transcript Checkpoints - Coach only */}
            {(() => {
              // Guard: ensure run exists
              if (!run) return null
              
              const isCoach = hasCoachAccess(userPlan)
              
              // Show checkpoints section if user is Coach and chunks exist or are loading
              if (isCoach && (chunks.length > 0 || chunksLoading)) {
                // Format time helper for checkpoint ranges
                const formatCheckpointTime = (startMs: number, endMs: number) => {
                  const formatTime = (ms: number) => {
                    const totalSeconds = Math.floor(ms / 1000)
                    const minutes = Math.floor(totalSeconds / 60)
                    const seconds = totalSeconds % 60
                    return `${minutes}:${seconds.toString().padStart(2, '0')}`
                  }
                  return `${formatTime(startMs)}–${formatTime(endMs)}`
                }

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
                  >
                    <Card>
                      <div className="flex items-center gap-2 mb-4">
                        <SectionHeader title="Transcript Checkpoints" />
                      </div>
                      
                      {chunksLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <LoadingSpinner className="h-5 w-5 text-[#F59E0B]" />
                          <span className="ml-2 text-sm text-[#9CA3AF]">Loading checkpoints...</span>
                        </div>
                      ) : chunks.length === 0 ? (
                        <p className="text-xs text-[#9CA3AF]">No checkpoints available for this run.</p>
                      ) : (
                        <div className="space-y-2">
                          {chunks.map((chunk) => {
                            const rangeLabel = formatCheckpointTime(chunk.start_ms, chunk.end_ms)
                            const isTranscribed = chunk.status === 'transcribed'
                            const isTranscribing = chunk.status === 'transcribing'
                            const isError = chunk.status === 'error'
                            const isUploaded = chunk.status === 'uploaded'
                            const isRetrying = retryingChunkId === chunk.id

                            return (
                              <div
                                key={chunk.id}
                                className="flex items-center justify-between p-3 bg-[#0F1419] rounded border border-[#1A1F2E]"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <span className="text-sm font-medium text-[#E5E7EB] min-w-[100px]">
                                    {rangeLabel}
                                  </span>
                                  
                                  {/* Status Badge */}
                                  {isTranscribed && (
                                    <Badge variant="success" className="text-xs">
                                      Ready
                                    </Badge>
                                  )}
                                  {isTranscribing && (
                                    <div className="flex items-center gap-1">
                                      <LoadingSpinner className="h-3 w-3 text-[#F59E0B]" />
                                      <span className="text-xs text-[#F59E0B]">Transcribing</span>
                                    </div>
                                  )}
                                  {isUploaded && (
                                    <Badge variant="info" className="text-xs">
                                      Saved
                                    </Badge>
                                  )}
                                  {isError && (
                                    <Badge variant="danger" className="text-xs">
                                      Error
                                    </Badge>
                                  )}

                                  {/* Error Message */}
                                  {isError && chunk.error_message && (
                                    <span className="text-xs text-[#EF4444] ml-2">
                                      {chunk.error_message}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Download Button */}
                                  {isTranscribed && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="text-xs h-7 px-2"
                                      onClick={() => downloadChunkTranscript(chunk.id)}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      Download transcript (.txt)
                                    </Button>
                                  )}

                                  {/* Retry Button */}
                                  {isError && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      className="text-xs h-7 px-2"
                                      onClick={() => retryChunkTranscription(chunk.id)}
                                      disabled={isRetrying}
                                    >
                                      {isRetrying ? (
                                        <>
                                          <LoadingSpinner className="h-3 w-3 mr-1" />
                                          Retrying...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-3 w-3 mr-1" />
                                          Retry transcribe
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                )
              }
              
              return null
            })()}

            {/* Progress Card - Coach only */}
            {(() => {
              // Guard: ensure run exists
              if (!run) return null
              
              const canViewProgress = canViewProgressPanel(userPlan)
              const hasAnalysis = run.analysis_json
              
              // Show Progress card if user can view progress (Coach only) and analysis exists
              if (canViewProgress && hasAnalysis && progressData.comparisons) {
                const comparisons = progressData.comparisons
                
                // Get current run metrics
                const currentWpm = run.words_per_minute || null
                const currentFillerWords = run.analysis_json?.premium?.filler?.total ?? 
                                          run.analysis_json?.premium_insights?.filler_words?.total_count ?? null
                const currentMissingSections = run.analysis_json?.rubric_scores 
                  ? run.analysis_json.rubric_scores.filter((score: any) => score.missing === true).length
                  : null
                const currentOverallScore = run.analysis_json?.summary?.overall_score ?? null

                // Helper to get trend indicator
                const getTrendIndicator = (current: number | null, previous: number | null): string => {
                  if (current === null || previous === null) return '→'
                  if (current > previous) return '↑'
                  if (current < previous) return '↓'
                  return '→'
                }

                // Helper to format comparison
                const formatComparison = (current: number | null, previous: number | null, format: 'int' | 'float' = 'int'): string => {
                  if (current === null || previous === null) return 'N/A'
                  const diff = current - previous
                  const sign = diff >= 0 ? '+' : ''
                  const formattedDiff = format === 'float' ? diff.toFixed(1) : Math.round(diff).toString()
                  return `${previous.toFixed(format === 'float' ? 1 : 0)} → ${current.toFixed(format === 'float' ? 1 : 0)} (${sign}${formattedDiff})`
                }

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
                  >
                    <Card>
                      <div className="flex items-center gap-2 mb-4">
                        <SectionHeader title="Progress" />
                      </div>
                      
                      <p className="text-xs text-[#9CA3AF] mb-4">Compared to your last 3 attempts</p>
                      
                      <div className="space-y-3">
                        {/* Pacing (WPM) */}
                        {currentWpm !== null && comparisons.avg_wpm !== null && (
                          <div className="flex items-center justify-between p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#9CA3AF]">Pacing (WPM):</span>
                              <span className="text-xs text-[#E5E7EB]">
                                {formatComparison(currentWpm, comparisons.avg_wpm, 'int')}
                              </span>
                            </div>
                            <span className="text-sm text-[#9CA3AF]">
                              {getTrendIndicator(currentWpm, comparisons.avg_wpm)}
                            </span>
                          </div>
                        )}

                        {/* Filler Words */}
                        {currentFillerWords !== null && comparisons.avg_filler_words !== null && (
                          <div className="flex items-center justify-between p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#9CA3AF]">Filler words:</span>
                              <span className="text-xs text-[#E5E7EB]">
                                {formatComparison(currentFillerWords, comparisons.avg_filler_words, 'int')}
                              </span>
                            </div>
                            <span className="text-sm text-[#9CA3AF]">
                              {getTrendIndicator(currentFillerWords, comparisons.avg_filler_words)}
                            </span>
                          </div>
                        )}

                        {/* Missing Sections */}
                        {currentMissingSections !== null && comparisons.avg_missing_sections !== null && (
                          <div className="flex items-center justify-between p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#9CA3AF]">Missing sections:</span>
                              <span className="text-xs text-[#E5E7EB]">
                                {formatComparison(currentMissingSections, comparisons.avg_missing_sections, 'int')}
                              </span>
                            </div>
                            <span className="text-sm text-[#9CA3AF]">
                              {getTrendIndicator(currentMissingSections, comparisons.avg_missing_sections)}
                            </span>
                          </div>
                        )}

                        {/* Overall Score */}
                        {currentOverallScore !== null && comparisons.avg_overall_score !== null && (
                          <div className="flex items-center justify-between p-2 bg-[#0F1419] rounded border border-[#1A1F2E]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#9CA3AF]">Overall score:</span>
                              <span className="text-xs text-[#E5E7EB]">
                                {formatComparison(currentOverallScore, comparisons.avg_overall_score, 'float')}
                              </span>
                            </div>
                            <span className="text-sm text-[#9CA3AF]">
                              {getTrendIndicator(currentOverallScore, comparisons.avg_overall_score)}
                            </span>
                          </div>
                        )}

                        {/* No data message */}
                        {(!comparisons.avg_wpm && !comparisons.avg_filler_words && 
                          !comparisons.avg_missing_sections && !comparisons.avg_overall_score) && (
                          <p className="text-xs text-[#9CA3AF] text-center py-2">
                            No previous runs to compare. Keep practicing to see your progress!
                          </p>
                        )}
                      </div>
                    </Card>
                  </motion.div>
                )
              }
              
              return null
            })()}

            {/* Transcript Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Card>
                <SectionHeader title="Transcript" />
                
                {/* Audio Player */}
                {run.audio_path && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="mb-6"
                  >
                    {audioError || (run.audio_path && !audioUrl) ? (
                      <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          Audio unavailable for this run.
                        </p>
                      </div>
                    ) : audioUrl ? (
                      <audio 
                        controls 
                        className="w-full"
                        preload="metadata"
                        onError={(e) => {
                          console.error(`Audio playback error for runId: ${routeRunId}`)
                          setAudioError(true)
                        }}
                      >
                        <source src={audioUrl} type="audio/webm" />
                        <source src={audioUrl} type="audio/webm;codecs=opus" />
                        <source src={audioUrl} type="audio/mpeg" />
                        <source src={audioUrl} type="audio/wav" />
                        <source src={audioUrl} type="audio/ogg" />
                        Your browser does not support the audio element.
                      </audio>
                    ) : (
                      <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          ⚠️ Loading audio URL...
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Transcript Text */}
                <AnimatePresence mode="wait">
                  {transcript.trim().length > 0 ? (
                    (() => {
                      const sentences = splitIntoSentences(transcript)
                      const lineByLine = run.analysis_json?.line_by_line || []
                      const sentenceToFeedbackMap = createSentenceToFeedbackMap(transcript, lineByLine)
                      
                      return (
                        <motion.div
                          key="transcript"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="p-6 bg-[#151A23] rounded-lg border border-[#22283A]"
                        >
                          <div className="text-[#E5E7EB] whitespace-pre-wrap font-sans text-sm leading-relaxed font-normal">
                            {sentences.map((sentence, idx) => {
                              const feedbackIdx = sentenceToFeedbackMap.get(idx)
                              const hasFeedback = feedbackIdx !== undefined
                              const isSelected = selectedSentenceIdx === idx
                              const showNoFeedback = showNoFeedbackMessage === idx
                              
                              return (
                                <span key={idx} className="relative inline-block">
                                  <span
                                    id={`sentence-${idx}`}
                                    onClick={() => {
                                      if (hasFeedback && feedbackIdx !== undefined) {
                                        setSelectedSentenceIdx(isSelected ? null : idx)
                                        scrollToFeedback(feedbackIdx)
                                        setShowNoFeedbackMessage(null)
                                      } else {
                                        setSelectedSentenceIdx(isSelected ? null : idx)
                                        setShowNoFeedbackMessage(isSelected ? null : idx)
                                        // Auto-hide message after 3 seconds
                                        setTimeout(() => {
                                          setShowNoFeedbackMessage(null)
                                        }, 3000)
                                      }
                                    }}
                                    className={`
                                      inline cursor-pointer transition-all rounded px-1.5 py-0.5 mx-0.5 my-0.5
                                      ${isSelected 
                                        ? 'border-2 border-amber-500/60' 
                                        : hasFeedback
                                          ? 'hover:border-amber-500/30 border border-amber-500/20'
                                          : 'hover:border-gray-500/20 border border-transparent'
                                      }
                                    `}
                                    style={{ 
                                      textDecoration: 'none',
                                      color: 'inherit'
                                    }}
                                  >
                                    {sentence}
                                  </span>
                                  {showNoFeedback && (
                                    <motion.div
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -5 }}
                                      className="absolute z-50 mt-2 p-2 bg-[#151A23] border border-[#22283A] rounded-lg shadow-lg text-xs text-[#9CA3AF] whitespace-nowrap"
                                      style={{ left: '50%', transform: 'translateX(-50%)', top: '100%' }}
                                    >
                                      No feedback for this line
                                    </motion.div>
                                  )}
                                  {idx < sentences.length - 1 && ' '}
                                </span>
                              )
                            })}
                          </div>
                        </motion.div>
                      )
                    })()
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-12 bg-[#151A23] rounded-lg border border-[#22283A] text-center"
                    >
                      <div className="max-w-md mx-auto">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#22283A] mb-4">
                          <FileText className="h-8 w-8 text-[#9CA3AF]" />
                        </div>
                        <p className="text-[#E5E7EB] font-medium mb-2">Transcript pending</p>
                        <p className="text-sm text-[#9CA3AF] mb-6">
                          Click "Generate Transcript" below to generate a transcript from your audio.
                        </p>
                        <Button
                          onClick={handleTranscribe}
                          variant="primary"
                          disabled={isTranscribing}
                          isLoading={isTranscribing}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Generate Transcript
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>

            {/* Missing Analysis Placeholder */}
            {run.transcript && !run.analysis_json?.summary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              >
                <Card>
                  <div className="p-12 text-center">
                    {/* Analysis in progress */}
                    {(analysisStage === 'analyzing' || isGettingFeedback) && (
                      <div className="mb-6">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#22283A] mb-4">
                          <LoadingSpinner size="md" />
                        </div>
                        <p className="text-[#E5E7EB] font-medium mb-2">
                          {(() => {
                            // Show stage-specific messages for Coach plan
                            if (hasCoachAccess(userPlan) || hasDayPassAccess(userPlan)) {
                              if (analysisStage === 'transcribing') {
                                return 'Transcribing your recording...'
                              } else if (analysisStage === 'analyzing') {
                                return 'Analyzing clarity and structure...'
                              } else if (run.analysis_json?.summary && !run.analysis_json?.premium_insights) {
                                return 'Generating premium insights...'
                              }
                            }
                            return 'Generating feedback...'
                          })()}
                        </p>
                        {showTimeoutMessage && (
                          <div className="mt-4 p-3 bg-[#1A1F2E] border border-[#F59E0B]/30 rounded-lg">
                            <p className="text-sm text-[#E5E7EB]">
                              This analysis is taking longer than usual. You can safely refresh — your results will continue processing.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Not started yet */}
                    {analysisStage === 'idle' && (
                      <>
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#22283A] mb-4">
                          <FileText className="h-8 w-8 text-[#9CA3AF]" />
                        </div>
                        <p className="text-[#E5E7EB] font-medium mb-2">Feedback not generated yet</p>
                        <p className="text-sm text-[#9CA3AF] mb-6">
                          Your transcript is ready. Generate AI-powered feedback to see analysis of your pitch.
                        </p>
                        <Button
                          onClick={handleGetFeedback}
                          variant="primary"
                          disabled={isGettingFeedback || (!run.rubrics && !run.rubric_snapshot_json)}
                          isLoading={isGettingFeedback}
                        >
                          {isGettingFeedback ? (
                            <>
                              <LoadingSpinner size="sm" />
                              Generating feedback...
                            </>
                          ) : (
                            <>
                              Generate feedback
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Line-by-Line Feedback - Available for all plans */}
            {run.analysis_json?.line_by_line && run.analysis_json.line_by_line.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              >
                <Card>
                  <SectionHeader title="Line-by-Line Feedback">
                    {userPlan === 'free' && (
                      <Badge variant="default" size="sm">
                        Preview feedback
                      </Badge>
                    )}
                  </SectionHeader>
                  <div className="space-y-4">
                    {(() => {
                      const lineByLine = run.analysis_json.line_by_line
                      const isFree = userPlan === 'free'
                      const itemsToShow = isFree ? lineByLine.slice(0, 3) : lineByLine
                      const hiddenCount = isFree ? Math.max(lineByLine.length - 3, 0) : 0
                      const premiumInsights = run.analysis_json?.premium_insights
                      const fillerWordsData = premiumInsights?.filler_words
                      
                      return (
                        <>
                          {itemsToShow.map((item: any, idx: number) => {
                            const typeColors = {
                              strength: 'bg-green-500/20 border-green-500/50',
                              issue: 'bg-red-500/20 border-red-500/50',
                            }
                            const priorityColors = {
                              high: 'text-red-400',
                              medium: 'text-[#F97316]',
                              low: 'text-[#9CA3AF]',
                            }
                            const isHighlighted = highlightedFeedbackIdx === idx
                            
                            // Get filler words for this quote (Coach only)
                            const fillerWordsForQuote = fillerWordsData 
                              ? getFillerWordsForQuote(item.quote, fillerWordsData)
                              : null
                            
                            // Find matching rewrite from premium insights (Coach only)
                            const matchingRewrite = fillerWordsData?.top_sentences
                              ? findMatchingRewrite(item.quote, fillerWordsData.top_sentences)
                              : null
                            
                            return (
                              <LineByLineItem
                                key={idx}
                                idx={idx}
                                item={item}
                                typeColors={typeColors}
                                priorityColors={priorityColors}
                                isHighlighted={isHighlighted}
                                fillerWordsForQuote={fillerWordsForQuote}
                                matchingRewrite={matchingRewrite}
                              />
                            )
                          })}
                          
                          {/* Locked Teaser Card for Free Users */}
                          {isFree && hiddenCount > 0 && (
                            <>
                              <p className="text-sm text-[#9CA3AF] mb-3">
                                You're seeing a preview of your coaching.
                              </p>
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: 0.15 }}
                                className="p-6 bg-[#151A23] rounded-lg border border-[#22283A]"
                              >
                              <div className="flex items-start gap-3 mb-4">
                                <span className="text-2xl">🔒</span>
                                <div className="flex-1">
                                  <h3 className="text-lg font-bold text-[#E5E7EB] mb-2">Unlock full coaching</h3>
                                  <p className="text-sm text-[#9CA3AF] mb-3">
                                    Upgrade to see the rest of your line-by-line feedback, filler word detection, pause insights, and saved pitch history.
                                  </p>
                                  {hiddenCount > 0 && (
                                    <p className="text-xs text-[#6B7280] mb-4">
                                      Hidden: {hiddenCount} more insights
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-3">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  className="flex-1"
                                  asChild
                                >
                                  <Link href="/upgrade?plan=starter">Upgrade to Starter</Link>
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  className="flex-1"
                                  asChild
                                >
                                  <Link href="/upgrade?plan=coach">Upgrade to Coach</Link>
                                </Button>
                              </div>
                            </motion.div>
                            </>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Feedback Summary - Visible to All Users */}
            {run.analysis_json?.summary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15, ease: "easeOut" }}
              >
                <Card>
                  <SectionHeader title="Feedback Summary" />
                  <div className="space-y-6">
                    {/* What's Working */}
                    {run.analysis_json.summary.top_strengths && run.analysis_json.summary.top_strengths.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[#22C55E] mb-3 uppercase tracking-wide">What's Working</h4>
                        <ul className="space-y-2">
                          {run.analysis_json.summary.top_strengths.map((strength: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#E5E7EB]">
                              <Check className="h-4 w-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                              <span>{strength.replace(/^["']|["']$/g, '').trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Improve */}
                    {run.analysis_json.summary.top_improvements && run.analysis_json.summary.top_improvements.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[#F97316] mb-3 uppercase tracking-wide">Improve</h4>
                        <ul className="space-y-2">
                          {run.analysis_json.summary.top_improvements.map((improvement: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#E5E7EB]">
                              <span className="text-[#F97316] mt-0.5">•</span>
                              <span>{improvement.replace(/^["']|["']$/g, '').trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Focus */}
                    {run.analysis_json.summary.focus_areas && run.analysis_json.summary.focus_areas.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-[#F59E0B] mb-3 uppercase tracking-wide">Focus</h4>
                        <ul className="space-y-2">
                          {run.analysis_json.summary.focus_areas.map((focus: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#E5E7EB]">
                              <span className="text-[#F59E0B] mt-0.5">•</span>
                              <span>{focus.replace(/^["']|["']$/g, '').trim()}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Prompt Question Grading - Visible to All Users */}
            {run.analysis_json?.rubric_scores && run.analysis_json.rubric_scores.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
              >
                <Card>
                  <SectionHeader title="Prompt Question Grading" />
                  <div className="space-y-4">
                    {run.analysis_json.rubric_scores.map((score: any, idx: number) => (
                      <div key={idx} className="p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-sm font-semibold text-[#E5E7EB]">
                            {score.criterion_label || score.criterion || `Question ${idx + 1}`}
                          </h4>
                          <span className="text-sm font-bold text-[#F59E0B]">
                            {score.score || 0}/10
                          </span>
                        </div>
                        {score.evidence_quotes && score.evidence_quotes.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-[#9CA4B2] mb-1">Evidence:</p>
                            <div className="space-y-1">
                              {score.evidence_quotes.map((quote: string, qIdx: number) => (
                                <p key={qIdx} className="text-xs text-[#9CA3AF] italic pl-2 border-l-2 border-[#22283A]">
                                  "{quote}"
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {score.evidence && !score.evidence_quotes && (
                          <p className="text-xs text-[#9CA3AF] mt-2 italic">
                            Evidence: {score.evidence}
                          </p>
                        )}
                        {score.notes && (
                          <div className="mt-3 pt-3 border-t border-[#22283A]">
                            <p className="text-xs font-semibold text-[#F59E0B] mb-1">Recommendation:</p>
                            <p className="text-sm text-[#E5E7EB]">{score.notes}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Upsell Card for Starter Users - Replace advanced features */}
            {userPlan === 'starter' && run.analysis_json && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25, ease: "easeOut" }}
              >
                <Card className="bg-[#22283A] border-[#F59E0B]/20">
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-[#E6E8EB] mb-2">Unlock coaching-level feedback</h3>
                    <p className="text-sm text-[#9AA4B2] mb-4">
                      Want deeper feedback? Upgrade to Coach.
                    </p>
                    <ul className="text-left space-y-2 mb-6 text-sm text-[#9AA4B2]">
                      <li className="flex items-start gap-2">
                        <span className="text-[#F59E0B] mt-0.5">•</span>
                        <span>Custom rubrics</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#F59E0B] mt-0.5">•</span>
                        <span>Line-by-line suggestions</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#F59E0B] mt-0.5">•</span>
                        <span>Rewrite your pitch instantly</span>
                      </li>
                    </ul>
                    <Button 
                      variant="primary" 
                      className="w-full"
                      asChild
                    >
                      <Link href="/upgrade?plan=coach">Upgrade to Coach</Link>
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Debug Panel */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card>
                <button
                  onClick={() => setShowDebug(!showDebug)}
                  className="flex items-center justify-between w-full text-left hover:bg-[#151A23] -m-2 p-2 rounded transition-colors"
                >
                  <h3 className="text-xs font-semibold text-[#9CA3AF] uppercase tracking-wide">Debug</h3>
                  {showDebug ? (
                    <ChevronUp className="h-4 w-4 text-[#9CA3AF]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#9CA3AF]" />
                  )}
                </button>
                <AnimatePresence>
                  {showDebug && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4 space-y-4 overflow-hidden"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#9CA3AF] mb-2">Raw Run JSON:</p>
                        <pre className="p-3 bg-[#0E1117] rounded text-xs overflow-auto max-h-60 font-mono text-[#E5E7EB]">
                          {JSON.stringify(run, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[#9CA3AF] mb-2">Audio Path:</p>
                        <p className="text-xs text-[#E5E7EB] font-mono break-all">{run.audio_path || 'N/A'}</p>
                      </div>
                      {lastTranscribeResponse && (
                        <div>
                          <p className="text-xs font-semibold text-[#9CA3AF] mb-2">Last Transcribe Response:</p>
                          <pre className="p-3 bg-[#0E1117] rounded text-xs overflow-auto max-h-60 font-mono text-[#E5E7EB]">
                            {JSON.stringify(lastTranscribeResponse, null, 2)}
                          </pre>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Next Steps Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Card>
                <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Next steps</h3>
                {(userPlan === 'free' || userPlan === 'day_pass') && (
                  <p className="text-sm text-[#9CA3AF] mb-4">
                    Want a deeper breakdown? Upgrade to unlock full coaching, exports, saved history, and advanced pacing insights.
                  </p>
                )}
                {userPlan === 'starter' && (
                  <p className="text-sm text-[#9CA3AF] mb-4">
                    Want deeper feedback? Upgrade to Coach for custom rubrics, line-by-line suggestions, and rewrite capabilities.
                  </p>
                )}
                {userPlan === 'coach' && (
                  <p className="text-sm text-[#9CA3AF] mb-4">
                    Record another pitch to continue improving.
                  </p>
                )}
                <div className="space-y-2">
                  <Button
                    onClick={() => router.push('/app/practice')}
                    variant="primary"
                    size="sm"
                    className="w-full"
                  >
                    Re-record
                  </Button>
                  {(userPlan === 'free' || userPlan === 'day_pass') && (
                    <>
                      <Button
                        onClick={() => router.push('/upgrade?plan=starter')}
                        variant="secondary"
                        size="sm"
                        className="w-full"
                      >
                        Upgrade to Starter
                      </Button>
                      <Button
                        onClick={() => router.push('/upgrade?plan=coach')}
                        variant="secondary"
                        size="sm"
                        className="w-full"
                      >
                        Upgrade to Coach
                      </Button>
                    </>
                  )}
                  {userPlan === 'starter' && (
                    <Button
                      onClick={() => router.push('/upgrade?plan=coach')}
                      variant="secondary"
                      size="sm"
                      className="w-full"
                    >
                      Upgrade to Coach
                    </Button>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Metrics Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            >
              <Card>
                <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Metrics</h3>
                <div className="flex flex-wrap gap-3">
                  <StatPill label="Duration" value={formatDuration(run.duration_ms ? run.duration_ms / 1000 : run.audio_seconds)} />
                  <StatPill label="Word Count" value={run.word_count !== null && run.word_count !== undefined ? run.word_count.toLocaleString() : null} />
                  <StatPill label="WPM" value={run.words_per_minute !== null && run.words_per_minute !== undefined ? run.words_per_minute : null} />
                  {(run.rubric_snapshot_json?.target_duration_seconds || run.rubrics?.target_duration_seconds) && (
                    <StatPill 
                      label="Target" 
                      value={formatDuration(run.rubric_snapshot_json?.target_duration_seconds || run.rubrics?.target_duration_seconds || 0)} 
                      className="border-[#F97316]/50" 
                    />
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Export Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
            >
              <Card>
                <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Export</h3>
                <div className="space-y-2">
                  {/* Download transcript button */}
                  <div className="relative group">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (!run.transcript) return
                        const blob = new Blob([run.transcript], { type: 'text/plain' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `transcript-${run.id}.txt`
                        document.body.appendChild(a)
                        a.click()
                        document.body.removeChild(a)
                        URL.revokeObjectURL(url)
                      }}
                      disabled={!run.transcript || userPlan === 'free'}
                      title={!run.transcript ? 'Transcript not ready' : ''}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download transcript (.txt)
                    </Button>
                    {userPlan === 'free' && (
                      <span className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 top-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 bg-[#151A23] border border-[#22283A] rounded-lg shadow-lg text-xs text-[#9CA3AF] whitespace-nowrap">
                        Upgrade to export
                      </span>
                    )}
                  </div>
                  
                  {/* Export PDF button */}
                  <div className="relative group">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        if (!run.analysis_json) return
                        exportSummaryPDF(run)
                      }}
                      disabled={!run.analysis_json || userPlan === 'free' || userPlan === 'starter'}
                      title={!run.analysis_json ? 'Summary not ready' : ''}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export summary (.pdf)
                    </Button>
                    {(userPlan === 'free' || userPlan === 'starter') && (
                      <span className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 top-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 bg-[#151A23] border border-[#22283A] rounded-lg shadow-lg text-xs text-[#9CA3AF] whitespace-nowrap">
                        {userPlan === 'free' ? 'Upgrade to export' : 'Upgrade to Coach to export PDF'}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            </motion.div>

            {/* Compare Attempts - Only for Coach + Day Pass */}
            {(userPlan === 'coach' || userPlan === 'day_pass') && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.4, ease: "easeOut" }}
              >
                <Card>
                  <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Compare Attempts</h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    disabled={true}
                    onClick={() => {
                      // Placeholder - compare attempts
                    }}
                  >
                    View Comparison
                  </Button>
                  <p className="text-xs text-[#9CA3AF] mt-3">
                    Coming soon: Compare this attempt with your previous recordings.
                  </p>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
