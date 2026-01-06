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
import { Check, ArrowLeft, RefreshCw, ChevronDown, ChevronUp, FileText, Download } from 'lucide-react'
import { getUserPlan } from '@/lib/plan'

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
  status: string
  error_message: string | null
  audio_url: string | null
  word_count: number | null
  words_per_minute: number | null
  rubric_snapshot_json: any | null
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
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioError, setAudioError] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const [lastTranscribeResponse, setLastTranscribeResponse] = useState<any>(null)
  const [lastTranscript, setLastTranscript] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [selectedSentenceIdx, setSelectedSentenceIdx] = useState<number | null>(null)
  const [highlightedFeedbackIdx, setHighlightedFeedbackIdx] = useState<number | null>(null)
  const [showNoFeedbackMessage, setShowNoFeedbackMessage] = useState<number | null>(null)
  
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
      const normalizedTranscript = responseData.transcript ?? responseData.run?.transcript ?? normalizedRun?.transcript ?? null
      
      // Merge analysis into run if it's at top level
      const runData: Run | null = normalizedRun ? {
        ...normalizedRun,
        analysis_json: normalizedAnalysis ?? normalizedRun.analysis_json ?? null,
        transcript: normalizedTranscript ?? normalizedRun.transcript ?? null,
      } : null

      if (!runData) {
        throw new Error('No run data in response')
      }

      // Get current run from ref to avoid stale closure
      const currentRun = runRef.current

      // Debug logging (dev-only)
      if (process.env.NODE_ENV === 'development') {
        const hasTranscript = !!(runData.transcript && runData.transcript.trim().length > 0)
        const hasAnalysis = !!runData.analysis_json
        console.log('[RunPage] Fetch result:', {
          timestamp: fetchTimestamp,
          status: runData.status,
          statusPriority: getStatusPriority(runData.status),
          hasTranscript,
          hasAnalysis,
          isPolling,
          currentRunStatus: currentRun?.status,
          currentRunPriority: getStatusPriority(currentRun?.status),
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
      // Stop polling when status is "analyzed" OR when we have both transcript and analysis
      const hasCompleteData = runData.status === 'analyzed' || (hasNewTranscript && hasNewAnalysis)
      const shouldContinuePolling = 
        (runData.status === 'uploaded' || 
         runData.status === 'transcribing' || 
         runData.status === 'transcribed') &&
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

  useEffect(() => {
    // Get user plan on mount
    getUserPlan().then(plan => {
      // Normalize daypass to day_pass for compatibility
      setUserPlan(plan === 'daypass' ? 'day_pass' : plan)
    })
    fetchRun(false)
  }, [routeRunId])

  // Polling: poll every 1500ms while status is in ["uploaded","transcribing","transcribed"]
  useEffect(() => {
    if (!run) return

    const status = run.status
    const shouldPoll = status === 'uploaded' || status === 'transcribing' || status === 'transcribed'
    
    // Stop polling when status is "analyzed" OR when transcript && (analysis_json || analysis) exist
    const hasCompleteData = run.status === 'analyzed' || 
      (run.transcript && run.transcript.trim().length > 0 && 
       (run.analysis_json || false))

    if (!shouldPoll || hasCompleteData) {
      return
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
  }, [run?.status, run?.transcript, run?.analysis_json, routeRunId, fetchRun])

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
    setError(null)
    setLastAction(null)

    const url = `/api/runs/${routeRunId}/analyze`
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
      
      if (normalizedRun) {
        const runData: Run = {
          ...normalizedRun,
          analysis_json: normalizedAnalysis ?? normalizedRun.analysis_json ?? null,
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
            {run.transcript && !run.analysis_json && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
              >
                <Card>
                  <div className="p-12 text-center">
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
                  <SectionHeader title="Line-by-Line Feedback" />
                  <div className="space-y-4">
                    {run.analysis_json.line_by_line.map((item: any, idx: number) => {
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
                      
                      return (
                        <motion.div
                          key={idx}
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
                          <p className="text-sm text-[#E5E7EB] mb-1">
                            <strong>Comment:</strong> {item.comment}
                          </p>
                          {item.action && (
                            <p className="text-sm text-[#E5E7EB]">
                              <strong>Action:</strong> {item.action}
                            </p>
                          )}
                          {/* Rewrite Suggestions - Only for Coach + Day Pass */}
                          {item.rewrite && (
                            <div className="mt-3 p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg">
                              <p className="text-xs font-semibold text-[#F59E0B] mb-1">Suggested Rewrite:</p>
                              <p className="text-sm text-[#E5E7EB] italic">{item.rewrite}</p>
                            </div>
                          )}
                        </motion.div>
                      )
                    })}
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
            {/* Status Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Card>
                <div className="space-y-2">
                  <Button
                    onClick={handleTranscribe}
                    variant="primary"
                    size="sm"
                    className="w-full"
                    disabled={isTranscribing}
                    isLoading={isTranscribing}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Re-transcribe (overwrite)
                  </Button>
                  <Link href="/app" className="block">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to /app
                    </Button>
                  </Link>
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
                    disabled={!run.transcript}
                    title={!run.transcript ? 'Transcript not ready' : ''}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download transcript (.txt)
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      if (!run.analysis_json) return
                      exportSummaryPDF(run)
                    }}
                    disabled={!run.analysis_json}
                    title={!run.analysis_json ? 'Summary not ready' : ''}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Export summary (.pdf)
                  </Button>
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
