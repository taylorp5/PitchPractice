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
import { Copy, Check, ArrowLeft, RefreshCw, RotateCcw, ChevronDown, ChevronUp, Mic, FileText } from 'lucide-react'

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
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [lastTranscribeResponse, setLastTranscribeResponse] = useState<any>(null)
  const [lastTranscript, setLastTranscript] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)

  const fetchRun = async () => {
    if (!routeRunId) return

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
      } else if (!responseData.ok) {
        throw new Error(responseData.error || 'Failed to fetch run')
      } else {
        runData = responseData
        setRun(runData)
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

  const handleAnalyze = async () => {
    if (!routeRunId) return

    setIsAnalyzing(true)
    setError(null)
    setLastAction(null)

    const url = `/api/runs/${routeRunId}/analyze`
    try {
      const res = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
      })

      if (!res.ok) {
        await logFetchError(url, res)
        const errorData = await res.json()
        const errorMsg = errorData.message || errorData.error || 'Analysis failed'
        setError(errorMsg)
        setLastAction(`Analysis failed: ${errorMsg}`)
        return
      }

      const responseData = await res.json()
      if (responseData.ok && responseData.run) {
        setRun(responseData.run)
        setLastAction('Analysis completed successfully')
      } else {
        setError(responseData.message || 'Analysis failed')
        setLastAction(`Analysis failed: ${responseData.message || 'Unknown error'}`)
      }
    } catch (err: any) {
      console.error('Analysis error:', err)
      const errorMsg = err.message || 'Failed to analyze pitch'
      setError(errorMsg)
      setLastAction(`Analysis failed: ${errorMsg}`)
    } finally {
      setIsAnalyzing(false)
      await fetchRun()
    }
  }

  const copyShareSummary = () => {
    if (!run) return

    const duration = run.audio_seconds
      ? `${Math.floor(run.audio_seconds / 60)}:${String(Math.floor(run.audio_seconds % 60)).padStart(2, '0')}`
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
      <div className="min-h-screen flex items-center justify-center py-20 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        <LoadingSpinner size="lg" text="Loading pitch run..." />
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
        <Card className="max-w-2xl w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Run not found'}</p>
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Error Messages */}
        <AnimatePresence>
          {run.error_message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mb-6 p-4 bg-red-50 border-2 border-red-400 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <span className="text-red-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <strong className="text-red-800 text-lg block mb-1">Error</strong>
                  <p className="text-red-700">{run.error_message}</p>
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
              className="mb-6 p-4 bg-red-50 border-2 border-red-400 rounded-lg"
            >
              <div className="flex items-start gap-2">
                <span className="text-red-600 text-xl">⚠️</span>
                <div className="flex-1">
                  <strong className="text-red-800 text-lg block mb-1">Transcription Failed</strong>
                  <p className="text-red-700">{lastTranscribeResponse.message}</p>
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
              className="mb-6 p-3 bg-green-50 border border-green-200 rounded-lg"
            >
              <p className="text-green-800 text-sm font-medium">{lastAction}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column - Transcript + Feedback */}
          <div className="lg:col-span-2 space-y-6">
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
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-yellow-800 text-sm">
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
                      className="p-6 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <pre className="text-gray-700 whitespace-pre-wrap font-sans text-sm leading-relaxed font-normal">
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
                      className="p-12 bg-gray-50 rounded-lg border border-gray-200 text-center"
                    >
                      <div className="max-w-md mx-auto">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                          <FileText className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium mb-2">No transcript yet</p>
                        <p className="text-sm text-gray-500 mb-6">
                          Click "Re-transcribe" in the sidebar to generate a transcript from your audio.
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

            {/* Line-by-Line Feedback (placeholder for later) */}
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
                        praise: 'bg-green-50 border-green-200',
                        issue: 'bg-red-50 border-red-200',
                        suggestion: 'bg-blue-50 border-blue-200',
                      }
                      const priorityColors = {
                        high: 'text-red-600',
                        medium: 'text-amber-600',
                        low: 'text-gray-600',
                      }
                      return (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: idx * 0.05 }}
                          className={`p-4 rounded-lg border ${typeColors[item.type as keyof typeof typeColors] || 'bg-gray-50 border-gray-200'}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <blockquote className="text-sm font-medium text-gray-800 italic flex-1">
                              "{item.quote}"
                            </blockquote>
                            <span className={`text-xs font-semibold ml-2 ${priorityColors[item.priority as keyof typeof priorityColors] || 'text-gray-600'}`}>
                              {item.priority?.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-1">
                            <strong>Comment:</strong> {item.comment}
                          </p>
                          {item.action && (
                            <p className="text-sm text-gray-700">
                              <strong>Action:</strong> {item.action}
                            </p>
                          )}
                        </motion.div>
                      )
                    })}
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
                  className="flex items-center justify-between w-full text-left hover:bg-gray-50 -m-2 p-2 rounded transition-colors"
                >
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Debug</h3>
                  {showDebug ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
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
                        <p className="text-xs font-semibold text-gray-600 mb-2">Raw Run JSON:</p>
                        <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-60 font-mono">
                          {JSON.stringify(run, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-600 mb-2">Audio Path:</p>
                        <p className="text-xs text-gray-700 font-mono break-all">{run.audio_path || 'N/A'}</p>
                      </div>
                      {lastTranscribeResponse && (
                        <div>
                          <p className="text-xs font-semibold text-gray-600 mb-2">Last Transcribe Response:</p>
                          <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-60 font-mono">
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
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Status</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="text-xs text-gray-500">
                    Updated {formatLastUpdated(run.created_at)}
                  </p>
                </div>
                <div className="space-y-2 pt-4 border-t border-gray-200">
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
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Metrics</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Duration</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatDuration(run.audio_seconds)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">Word Count</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {run.word_count !== null && run.word_count !== undefined
                        ? run.word_count.toLocaleString()
                        : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-200">
                    <span className="text-sm text-gray-600">WPM</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {run.words_per_minute !== null && run.words_per_minute !== undefined
                        ? `${run.words_per_minute}`
                        : '—'}
                    </span>
                  </div>
                  {run.rubrics?.target_duration_seconds && (
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-gray-600">Target</span>
                      <span className="text-sm font-semibold text-blue-600">
                        {formatDuration(run.rubrics.target_duration_seconds)}
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </motion.div>

            {/* Share Card */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
            >
              <Card>
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Share</h3>
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
                <p className="text-xs text-gray-500 mt-3">
                  Copies a LinkedIn-friendly summary with metrics and key feedback.
                </p>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
