'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

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
  const runId = params.id as string
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [transcribeDebug, setTranscribeDebug] = useState<string>('')

  const fetchRun = async () => {
    if (!runId) return

    try {
      const res = await fetch(`/api/runs/${runId}`)
      if (!res.ok) {
        throw new Error('Failed to fetch run')
      }
      const data = await res.json()
      setRun(data)
      
      // Fetch fresh audio URL
      if (data.audio_path) {
        try {
          const audioRes = await fetch(`/api/runs/${runId}/audio-url`)
          if (audioRes.ok) {
            const audioData = await audioRes.json()
            setAudioUrl(audioData.audio_url)
          }
        } catch (err) {
          console.error('Failed to fetch audio URL:', err)
        }
      }
      
      setLoading(false)
    } catch (err) {
      console.error('Error fetching run:', err)
      setError('Failed to load run details')
      setLoading(false)
    }
  }
  
  const handleResetTranscription = async () => {
    if (!runId || isTranscribing) return

    setIsTranscribing(true)
    setError(null)

    try {
      // Reset transcription
      const resetRes = await fetch(`/api/runs/${runId}/reset-transcription`, {
        method: 'POST',
      })

      if (!resetRes.ok) {
        const errorData = await resetRes.json()
        throw new Error(errorData.error || 'Failed to reset transcription')
      }

      // Refresh run data
      await fetchRun()
      
      // Auto-start transcription
      await handleTranscribe()
    } catch (err) {
      console.error('Reset transcription error:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset transcription')
      await fetchRun()
    } finally {
      setIsTranscribing(false)
    }
  }

  useEffect(() => {
    fetchRun()
  }, [runId])

  // Auto-start transcription if status is 'uploaded' and no transcript exists
  useEffect(() => {
    if (run && run.status === 'uploaded' && !run.transcript && !isTranscribing) {
      // Use force=1 for auto-transcribe to bypass any guards
      handleTranscribe(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status, run?.transcript, runId])

  // Auto-start analysis if status is 'transcribed'
  useEffect(() => {
    if (run && run.status === 'transcribed' && !isAnalyzing && !run.analysis_json) {
      handleAnalyze()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status, runId])

  const handleTranscribe = async (force: boolean = false) => {
    if (!runId || isTranscribing) return

    setIsTranscribing(true)
    setError(null)
    setTranscribeDebug('')

    try {
      // Build exact URL - ensure force parameter is included
      const url = force 
        ? `/api/runs/${runId}/transcribe?force=1`
        : `/api/runs/${runId}/transcribe`
      
      // Log and display the exact URL
      const debugMsg = `Calling: ${url}`
      console.log('[Client] Transcribe request:', debugMsg)
      setTranscribeDebug(debugMsg)

      const response = await fetch(url, {
        method: 'POST',
      })

      const responseData = await response.json()
      
      // Always display response JSON in debug area
      const responseDebug = `Response: ${JSON.stringify(responseData, null, 2)}`
      console.log('[Client] Transcribe response:', responseData)
      setTranscribeDebug(prev => prev + '\n\n' + responseDebug)

      if (!response.ok) {
        // Show exact error message from API
        const errorMsg = responseData.error || responseData.message || 'Transcription failed'
        const details = responseData.details ? `: ${responseData.details}` : ''
        const statusCode = responseData.statusCode ? ` (Status: ${responseData.statusCode})` : ''
        
        // If error is about already transcribed and we didn't use force, suggest force option
        if (errorMsg.includes('already transcribed') && !force) {
          throw new Error(`${errorMsg}${details}${statusCode}\n\n💡 Tip: Use "Force Transcribe" button to re-transcribe.`)
        }
        
        throw new Error(`${errorMsg}${details}${statusCode}`)
      }

      // Check response format
      if (!responseData.ok) {
        throw new Error(responseData.error || responseData.message || 'Transcription failed')
      }

      // Refresh run data to get updated transcript and timing
      await fetchRun()
    } catch (err) {
      console.error('Transcription error:', err)
      // Show exact error message from API response
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio')
      // Refresh to get updated error status
      await fetchRun()
    } finally {
      setIsTranscribing(false)
    }
  }
  
  const handleResetAndTranscribe = async () => {
    if (!runId || isTranscribing) return

    setIsTranscribing(true)
    setError(null)
    setTranscribeDebug('')

    try {
      // First reset
      setTranscribeDebug('Calling: POST /api/runs/' + runId + '/reset-transcription')
      const resetRes = await fetch(`/api/runs/${runId}/reset-transcription`, {
        method: 'POST',
      })

      if (!resetRes.ok) {
        const errorData = await resetRes.json()
        throw new Error(errorData.error || 'Failed to reset transcription')
      }

      // Then transcribe with force
      await handleTranscribe(true)
    } catch (err) {
      console.error('Reset & Transcribe error:', err)
      setError(err instanceof Error ? err.message : 'Failed to reset and transcribe')
      await fetchRun()
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleAnalyze = async () => {
    if (!runId || isAnalyzing) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await fetch(`/api/runs/${runId}/analyze`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Analysis failed')
      }

      // Refresh run data to get updated analysis
      await fetchRun()
    } catch (err) {
      console.error('Analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze pitch')
      // Refresh to get updated error status
      await fetchRun()
    } finally {
      setIsAnalyzing(false)
    }
  }

  const copyShareSummary = () => {
    if (!run || !run.analysis_json) return

    const analysis = run.analysis_json
    const duration = run.audio_seconds
      ? `${Math.floor(run.audio_seconds / 60)}:${String(Math.floor(run.audio_seconds % 60)).padStart(2, '0')}`
      : 'N/A'
    const wpm = run.words_per_minute ? `${run.words_per_minute} WPM` : 'N/A'
    const score = analysis.summary?.overall_score || 'N/A'
    const improvements = analysis.summary?.top_improvements?.slice(0, 3) || []
    const strengths = analysis.summary?.top_strengths?.slice(0, 2) || []

    // LinkedIn-friendly format (short and clean)
    let summary = `🎯 Pitch Practice Results\n\n`
    summary += `Duration: ${duration} | Pace: ${wpm}\n`
    summary += `Overall Score: ${score}/10\n\n`
    
    if (strengths.length > 0) {
      summary += `✅ Top Strengths:\n`
      strengths.forEach((s: string) => {
        // Clean up the strength text (remove quotes if present, keep concise)
        const cleanStrength = s.replace(/^["']|["']$/g, '').trim()
        summary += `• ${cleanStrength}\n`
      })
      summary += `\n`
    }
    
    if (improvements.length > 0) {
      summary += `📈 Top Improvements:\n`
      improvements.forEach((i: string) => {
        // Clean up the improvement text (remove quotes if present, keep concise)
        const cleanImprovement = i.replace(/^["']|["']$/g, '').trim()
        summary += `• ${cleanImprovement}\n`
      })
    }

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(err => {
      console.error('Failed to copy:', err)
    })
  }

  const downloadJSON = () => {
    if (!run || !run.analysis_json) return

    const dataStr = JSON.stringify(run.analysis_json, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pitch-analysis-${run.id}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Run not found'}</p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  const statusColors: Record<string, string> = {
    uploaded: 'bg-yellow-100 text-yellow-800',
    transcribed: 'bg-blue-100 text-blue-800',
    analyzed: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Home
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {run.title || 'Untitled Pitch'}
              </h1>
              <p className="text-sm text-gray-500">
                Created {new Date(run.created_at).toLocaleString()}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                statusColors[run.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {run.status}
            </span>
          </div>

          {run.error_message && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <strong>Error:</strong> {run.error_message}
            </div>
          )}

          {run.rubrics && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                Rubric: {run.rubrics.name}
              </h3>
              {run.rubrics.description && (
                <p className="text-sm text-blue-700 mb-2">{run.rubrics.description}</p>
              )}
              {run.rubrics.target_duration_seconds && (
                <p className="text-sm text-blue-700">
                  Target Duration: {Math.floor(run.rubrics.target_duration_seconds / 60)} min
                  {run.rubrics.max_duration_seconds && (
                    <span> (Max: {Math.floor(run.rubrics.max_duration_seconds / 60)} min)</span>
                  )}
                </p>
              )}
            </div>
          )}

          {run.audio_path && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Audio</h2>
              {audioUrl ? (
                <div>
                  <audio 
                    controls 
                    className="w-full"
                    preload="metadata"
                    onError={(e) => {
                      console.error('Audio playback error:', e)
                      setError('Failed to load audio. The file may be corrupted or the URL expired.')
                    }}
                    onLoadedMetadata={(e) => {
                      console.log('Audio loaded:', {
                        duration: (e.target as HTMLAudioElement).duration,
                        readyState: (e.target as HTMLAudioElement).readyState,
                      })
                    }}
                  >
                    <source src={audioUrl} type="audio/webm" />
                    <source src={audioUrl} type="audio/webm;codecs=opus" />
                    <source src={audioUrl} type="audio/mpeg" />
                    <source src={audioUrl} type="audio/wav" />
                    <source src={audioUrl} type="audio/ogg" />
                    Your browser does not support the audio element.
                  </audio>
                  <p className="mt-2 text-xs text-gray-500">
                    If audio doesn't play, try refreshing the page to get a new signed URL.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ Audio URL could not be generated. This may be a temporary issue. Please refresh the page.
                  </p>
                </div>
              )}
              
              {/* Debug Panel (dev-only) */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 p-3 bg-gray-100 rounded text-xs">
                  <summary className="cursor-pointer font-semibold text-gray-700">Debug Info</summary>
                  <div className="mt-2 space-y-1 text-gray-600">
                    <div><strong>audio_path:</strong> {run.audio_path}</div>
                    <div><strong>signed_audio_url:</strong> {audioUrl ? '✓ Generated' : '✗ Failed'}</div>
                    {audioUrl && <div className="break-all"><strong>URL:</strong> {audioUrl.substring(0, 100)}...</div>}
                    <div><strong>status:</strong> {run.status}</div>
                    <div><strong>has_transcript:</strong> {run.transcript ? `Yes (${run.transcript.length} chars)` : 'No'}</div>
                  </div>
                </details>
              )}
            </div>
          )}

          {/* Timing Metrics */}
          {(run.audio_seconds || run.word_count || run.words_per_minute) && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Timing Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {run.audio_seconds !== null && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Duration</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {Math.floor(run.audio_seconds / 60)}:
                      {String(Math.floor(run.audio_seconds % 60)).padStart(2, '0')}
                    </p>
                  </div>
                )}
                {run.word_count !== null && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Word Count</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {run.word_count.toLocaleString()}
                    </p>
                  </div>
                )}
                {run.words_per_minute !== null && (
                  <div>
                    <p className="text-sm text-gray-600 mb-1">Words Per Minute</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {run.words_per_minute} WPM
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {run.transcript && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Transcript</h2>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap">{run.transcript}</p>
              </div>
            </div>
          )}

          {/* Analysis Section */}
          {run.analysis_json && (
            <div className="mb-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900">Feedback & Analysis</h2>
                <div className="flex gap-2">
                  <button
                    onClick={copyShareSummary}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {copied ? '✓ Copied!' : '📋 Copy Share Summary'}
                  </button>
                  <button
                    onClick={downloadJSON}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    💾 Download JSON
                  </button>
                </div>
              </div>

              {/* Scorecard */}
              {run.analysis_json.summary && (
                <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">Overall Score</h3>
                    <div className="text-4xl font-bold text-blue-600">
                      {run.analysis_json.summary.overall_score}/10
                    </div>
                  </div>
                  {run.analysis_json.summary.overall_notes && (
                    <p className="text-gray-700 mb-4">{run.analysis_json.summary.overall_notes}</p>
                  )}

                  {/* Rubric Scores */}
                  {run.analysis_json.rubric_scores && run.analysis_json.rubric_scores.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="font-semibold text-gray-900">Rubric Scores</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {run.analysis_json.rubric_scores.map((item: any, idx: number) => (
                          <div key={idx} className="p-3 bg-white rounded border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-gray-900">{item.criterion}</span>
                              <span className="text-lg font-semibold text-blue-600">
                                {item.score}/10
                              </span>
                            </div>
                            {item.notes && (
                              <p className="text-sm text-gray-600">{item.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Top Strengths & Improvements */}
              {(run.analysis_json.summary?.top_strengths?.length > 0 || 
                run.analysis_json.summary?.top_improvements?.length > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {run.analysis_json.summary.top_strengths?.length > 0 && (
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="font-semibold text-green-900 mb-3">Top Strengths</h3>
                      <ul className="space-y-2">
                        {run.analysis_json.summary.top_strengths.map((strength: string, idx: number) => (
                          <li key={idx} className="text-sm text-green-800 flex items-start">
                            <span className="mr-2">✓</span>
                            <span>{strength}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {run.analysis_json.summary.top_improvements?.length > 0 && (
                    <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                      <h3 className="font-semibold text-amber-900 mb-3">Top Improvements</h3>
                      <ul className="space-y-2">
                        {run.analysis_json.summary.top_improvements.map((improvement: string, idx: number) => (
                          <li key={idx} className="text-sm text-amber-800 flex items-start">
                            <span className="mr-2">→</span>
                            <span>{improvement}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Line-by-Line Feedback */}
              {run.analysis_json.line_by_line && run.analysis_json.line_by_line.length > 0 && (
                <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Line-by-Line Feedback</h3>
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
                        <div
                          key={idx}
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
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Suggested Pauses */}
              {run.analysis_json.pause_suggestions && run.analysis_json.pause_suggestions.length > 0 && (
                <div className="p-6 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Suggested Pauses</h3>
                  <div className="space-y-3">
                    {run.analysis_json.pause_suggestions.map((pause: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white rounded border border-purple-200">
                        <p className="text-sm font-medium text-gray-800 mb-1">
                          After: <span className="italic">"{pause.after_quote}"</span>
                        </p>
                        <p className="text-sm text-gray-600 mb-1">{pause.why}</p>
                        <p className="text-xs text-gray-500">
                          Suggested duration: {pause.duration_ms}ms
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cut Suggestions */}
              {run.analysis_json.cut_suggestions && run.analysis_json.cut_suggestions.length > 0 && (
                <div className="p-6 bg-orange-50 rounded-lg border border-orange-200">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Suggested Cuts</h3>
                  <div className="space-y-3">
                    {run.analysis_json.cut_suggestions.map((cut: any, idx: number) => (
                      <div key={idx} className="p-3 bg-white rounded border border-orange-200">
                        <p className="text-sm font-medium text-gray-800 mb-1">
                          Remove: <span className="italic line-through">"{cut.quote}"</span>
                        </p>
                        <p className="text-sm text-gray-600 mb-1">{cut.why}</p>
                        {cut.replacement && (
                          <p className="text-sm text-green-700 mt-2">
                            <strong>Replace with:</strong> "{cut.replacement}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Timing Analysis */}
              {run.analysis_json.timing && (
                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Timing Analysis</h3>
                  {run.analysis_json.timing.notes && (
                    <p className="text-sm text-gray-700">{run.analysis_json.timing.notes}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Transcription Action */}
          {run.status === 'uploaded' && (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-800 font-medium mb-1">
                    Ready for Transcription
                  </p>
                  <p className="text-sm text-yellow-700">
                    Click "Transcribe" to transcribe your audio and get timing metrics.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTranscribe(false)}
                    disabled={isTranscribing}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Transcribing...
                      </>
                    ) : (
                      '🎤 Transcribe'
                    )}
                  </button>
                  <button
                    onClick={() => handleTranscribe(true)}
                    disabled={isTranscribing}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Transcribing...
                      </>
                    ) : (
                      '⚡ Force'
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Transcription Action - if status is transcribed but no transcript, or if error */}
          {(run.status === 'transcribed' && !run.transcript) || run.status === 'error' ? (
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-800 font-medium mb-1">
                    {run.status === 'error' ? 'Transcription Failed' : 'Transcription Missing'}
                  </p>
                  <p className="text-sm text-yellow-700">
                    {run.status === 'error' 
                      ? run.error_message || 'Transcription encountered an error.'
                      : 'The run is marked as transcribed but no transcript was found.'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTranscribe(true)}
                    disabled={isTranscribing}
                    className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Transcribing...
                      </>
                    ) : (
                      '⚡ Force Transcribe'
                    )}
                  </button>
                  <button
                    onClick={handleResetAndTranscribe}
                    disabled={isTranscribing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Resetting...
                      </>
                    ) : (
                      '🔄 Reset & Transcribe'
                    )}
                  </button>
                </div>
              </div>
              
              {/* Debug output */}
              {transcribeDebug && (
                <details className="mt-3 p-2 bg-gray-100 rounded text-xs">
                  <summary className="cursor-pointer font-semibold text-gray-700">Debug Info</summary>
                  <pre className="mt-2 text-gray-600 whitespace-pre-wrap break-all">{transcribeDebug}</pre>
                </details>
              )}
            </div>
          ) : null}

          {/* Reset & Re-transcribe button - if already transcribed */}
          {run.transcript && run.transcript.trim().length > 0 && (run.status === 'transcribed' || run.status === 'analyzed') && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-amber-800 font-medium mb-1">
                    Already Transcribed
                  </p>
                  <p className="text-sm text-amber-700">
                    This run has been transcribed. Click to reset and re-transcribe.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTranscribe(true)}
                    disabled={isTranscribing}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Transcribing...
                      </>
                    ) : (
                      '⚡ Force Transcribe'
                    )}
                  </button>
                  <button
                    onClick={handleResetAndTranscribe}
                    disabled={isTranscribing}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Resetting...
                      </>
                    ) : (
                      '🔄 Reset & Transcribe'
                    )}
                  </button>
                  <button
                    onClick={handleResetTranscription}
                    disabled={isTranscribing}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isTranscribing ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Resetting...
                      </>
                    ) : (
                      '🔄 Reset Only'
                    )}
                  </button>
                </div>
                
                {/* Debug output */}
                {transcribeDebug && (
                  <details className="mt-3 p-2 bg-gray-100 rounded text-xs">
                    <summary className="cursor-pointer font-semibold text-gray-700">Debug Info</summary>
                    <pre className="mt-2 text-gray-600 whitespace-pre-wrap break-all">{transcribeDebug}</pre>
                  </details>
                )}
              </div>
            </div>
          )}

          {/* Analysis Action */}
          {run.status === 'transcribed' && run.transcript && !run.analysis_json && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-800 font-medium mb-1">
                    Ready for Analysis
                  </p>
                  <p className="text-sm text-blue-700">
                    Get detailed rubric-based feedback on your pitch.
                  </p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Analyzing...
                    </>
                  ) : (
                    '✨ Analyze'
                  )}
                </button>
              </div>
            </div>
          )}

          {isTranscribing && run.status !== 'uploaded' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <p className="text-blue-800">Transcribing audio...</p>
              </div>
            </div>
          )}

          {isAnalyzing && run.status === 'transcribed' && (
            <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
                <p className="text-indigo-800">Analyzing pitch and generating feedback...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

