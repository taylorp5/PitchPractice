'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { StatPill } from '@/components/ui/StatPill'
import { Copy, Check, ArrowLeft, RefreshCw, RotateCcw, ChevronDown, ChevronUp, Mic, FileText } from 'lucide-react'
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
  rubrics: {
    id: string
    name: string
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
  const [copied, setCopied] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [lastTranscribeResponse, setLastTranscribeResponse] = useState<any>(null)
  const [lastTranscript, setLastTranscript] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const fetchRun = async () => {
    // Guard: Never fetch if runId is falsy or the string "undefined"
    if (!routeRunId || routeRunId === 'undefined') {
      setError('Invalid run ID')
      setLoading(false)
      return
    }

    const url = `/api/runs/${routeRunId}`
    try {
      const res = await fetch(url, {
        cache: 'no-store',
      })
      if (!res.ok) {
        await logFetchError(url, res)
        throw new Error('Failed to fetch run')
      }
      const responseData = await res.json()
      
      let runData: Run | null = null
      if (responseData.ok && responseData.run) {
        runData = responseData.run
        setRun(runData)
        
        // Use plan from analysis metadata if available, otherwise keep current plan
        if (runData.analysis_json?.meta?.plan_at_time) {
          const planAtTime = runData.analysis_json.meta.plan_at_time
          setUserPlan(planAtTime === 'daypass' ? 'day_pass' : planAtTime)
        }
      } else if (!responseData.ok) {
        throw new Error(responseData.error || 'Failed to fetch run')
      } else {
        runData = responseData
        setRun(runData)
        
        // Use plan from analysis metadata if available
        if (runData.analysis_json?.meta?.plan_at_time) {
          const planAtTime = runData.analysis_json.meta.plan_at_time
          setUserPlan(planAtTime === 'daypass' ? 'day_pass' : planAtTime)
        }
      }

      setError(null)
    } catch (err: any) {
      console.error('Error fetching run:', err)
      setError(err.message || 'Failed to load pitch run')
    } finally {
      setLoading(false)
    }
  }

  const fetchAudioUrl = async () => {
    if (!routeRunId || !run?.audio_path) return

    try {
      const res = await fetch(`/api/runs/${routeRunId}/audio-url`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        await logFetchError(`/api/runs/${routeRunId}/audio-url`, res)
        return
      }
      const data = await res.json()
      if (data.url) {
        setAudioUrl(data.url)
      }
    } catch (err) {
      console.error('Error fetching audio URL:', err)
    }
  }

  useEffect(() => {
    // Get user plan on mount
    getUserPlan().then(plan => {
      // Normalize daypass to day_pass for compatibility
      setUserPlan(plan === 'daypass' ? 'day_pass' : plan)
    })
    fetchRun()
  }, [routeRunId])

  useEffect(() => {
    if (run?.audio_path) {
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

      if (responseData.ok && responseData.run) {
        setRun(responseData.run)
        if (responseData.transcript) {
          setLastTranscript(responseData.transcript)
        }
        setLastAction('Transcription completed successfully')
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

  const handleReset = async () => {
    if (!routeRunId) return

    setError(null)
    setLastAction(null)

    const url = `/api/runs/${routeRunId}/reset`
    try {
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
      })

      if (!res.ok) {
        await logFetchError(url, res)
        const errorData = await res.json()
        setError(errorData.message || errorData.error || 'Reset failed')
        setLastAction(`Reset failed: ${errorData.message || 'Unknown error'}`)
        return
      }

      const responseData = await res.json()
      if (responseData.ok && responseData.run) {
        setRun(responseData.run)
        setLastTranscript(null)
        setLastAction('Run reset successfully')
      }
    } catch (err: any) {
      console.error('Reset error:', err)
      setError(err.message || 'Failed to reset run')
      setLastAction(`Reset failed: ${err.message || 'Unknown error'}`)
    } finally {
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
      if (responseData.ok && responseData.run) {
        setRun(responseData.run)
        setLastAction('Feedback generated successfully')
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

  const copyShareSummary = () => {
    if (!run) return

    const durationSeconds = run.duration_ms ? run.duration_ms / 1000 : run.audio_seconds
    const duration = durationSeconds
      ? `${Math.floor(durationSeconds / 60)}:${String(Math.floor(durationSeconds % 60)).padStart(2, '0')}`
      : 'N/A'
    const wpm = run.words_per_minute ? `${run.words_per_minute} WPM` : 'N/A'

    let summary = `🎯 Pitch Practice Results\n\n`
    summary += `Duration: ${duration} | Pace: ${wpm}\n`

    if (run.analysis_json) {
      const analysis = run.analysis_json
      const score = analysis.summary?.overall_score || 'N/A'
      summary += `Overall Score: ${score}/10\n\n`
      
      const strengths = analysis.summary?.top_strengths?.slice(0, 2) || []
      const improvements = analysis.summary?.top_improvements?.slice(0, 2) || []

      if (strengths.length > 0) {
        summary += `✅ Top Strengths:\n`
        strengths.forEach((s: string) => {
          const cleanStrength = s.replace(/^["']|["']$/g, '').trim()
          summary += `• ${cleanStrength}\n`
        })
        summary += `\n`
      }
      
      if (improvements.length > 0) {
        summary += `📈 Top Improvements:\n`
        improvements.forEach((i: string) => {
          const cleanImprovement = i.replace(/^["']|["']$/g, '').trim()
          summary += `• ${cleanImprovement}\n`
        })
      }
    } else if (run.transcript) {
      summary += `\nTranscript available. Analysis pending.`
    }

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(err => {
      console.error('Failed to copy:', err)
    })
  }

  const formatDuration = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return '—'
    if (seconds < 60) {
      return `0:${Math.floor(seconds).toString().padStart(2, '0')}`
    }
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
  }

  const formatLastUpdated = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours} hr ago`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
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
            {run.rubrics ? (
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
                        {run.rubrics.name}
                      </h3>
                      {run.rubrics.description && (
                        <p className="text-sm text-[#9CA3AF]">
                          {run.rubrics.description}
                        </p>
                      )}
                    </div>
                    {run.rubrics.criteria && Array.isArray(run.rubrics.criteria) && run.rubrics.criteria.length > 0 && (
                      <div className="pt-3 border-t border-[#22283A]">
                        <p className="text-xs font-semibold text-[#9CA3AF] mb-2 uppercase tracking-wide">Guiding Questions:</p>
                        <ul className="space-y-2">
                          {run.rubrics.criteria.map((criterion: any, idx: number) => (
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
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <Card className="bg-yellow-500/10 border-yellow-500/30">
                  <SectionHeader title="Evaluation Prompt" />
                  <div className="p-4">
                    <p className="text-sm text-[#F59E0B]">
                      ⚠️ This run was created without a prompt selection.
                    </p>
                  </div>
                </Card>
              </motion.div>
            )}

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
                    {audioUrl ? (
                      <audio 
                        controls 
                        className="w-full"
                        preload="metadata"
                        onError={(e) => {
                          console.error('Audio playback error:', e)
                          setError('Failed to load audio. The file may be corrupted or the URL expired.')
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
                    <motion.div
                      key="transcript"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-6 bg-[#151A23] rounded-lg border border-[#22283A]"
                    >
                      <pre className="text-[#E5E7EB] whitespace-pre-wrap font-sans text-sm leading-relaxed font-normal">
                        {transcript}
                      </pre>
                    </motion.div>
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
                      disabled={isGettingFeedback || !run.rubrics}
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

            {/* Line-by-Line Feedback - Only for Coach + Day Pass */}
            {(userPlan === 'coach' || userPlan === 'day_pass') && run.analysis_json?.line_by_line && run.analysis_json.line_by_line.length > 0 && (
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
                        praise: 'bg-green-500/20 border-green-500/50',
                        issue: 'bg-red-500/20 border-red-500/50',
                        suggestion: 'bg-[#F97316]/20 border-[#F97316]/50',
                      }
                      const priorityColors = {
                        high: 'text-red-400',
                        medium: 'text-[#F97316]',
                        low: 'text-[#9CA3AF]',
                      }
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className={`p-4 rounded-lg border ${typeColors[item.type as keyof typeof typeColors] || 'bg-[#151A23] border-[#22283A]'}`}
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
                    <Link href="/upgrade">
                      <Button variant="primary" className="w-full">
                        Upgrade to Coach
                      </Button>
                    </Link>
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
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-[#E5E7EB] mb-3">Status</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="text-xs text-[#9CA3AF]">
                    Updated {formatLastUpdated(run.created_at)}
                  </p>
                </div>
                <div className="space-y-2 pt-4 border-t border-[#22283A]">
                  {run.transcript && !run.analysis_json && (
                    <Button
                      onClick={handleGetFeedback}
                      variant="primary"
                      size="sm"
                      className="w-full"
                      disabled={isGettingFeedback || !run.rubrics}
                      isLoading={isGettingFeedback}
                    >
                      {isGettingFeedback ? (
                        <>
                          <LoadingSpinner size="sm" />
                          Generating feedback...
                        </>
                      ) : (
                        <>
                          Get feedback
                        </>
                      )}
                    </Button>
                  )}
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
                  <Button
                    onClick={handleReset}
                    variant="secondary"
                    size="sm"
                    className="w-full"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset
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
                  {run.rubrics?.target_duration_seconds && (
                    <StatPill label="Target" value={formatDuration(run.rubrics.target_duration_seconds)} className="border-[#F97316]/50" />
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Share Card - Visible to All Users */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            >
              <Card>
                <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Share</h3>
                <Button
                  onClick={copyShareSummary}
                  variant="primary"
                  size="sm"
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Share Summary
                    </>
                  )}
                </Button>
                <p className="text-xs text-[#9CA3AF] mt-3">
                  Copies a LinkedIn-friendly summary with metrics and key feedback.
                </p>
              </Card>
            </motion.div>

            {/* Export Card - Only for Coach + Day Pass */}
            {(userPlan === 'coach' || userPlan === 'day_pass') && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
              >
                <Card>
                  <h3 className="text-sm font-semibold text-[#E5E7EB] mb-4">Export</h3>
                  <div className="space-y-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // Placeholder - export script
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export Script
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // Placeholder - export summary
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export Summary
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        // Placeholder - export PDF
                      }}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Export PDF
                    </Button>
                  </div>
                </Card>
              </motion.div>
            )}

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
                    onClick={() => {
                      // Placeholder - compare attempts
                    }}
                  >
                    View Comparison
                  </Button>
                  <p className="text-xs text-[#9CA3AF] mt-3">
                    Compare this attempt with your previous recordings.
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
