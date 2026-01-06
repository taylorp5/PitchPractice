'use client'

// This is a large file that reuses recording logic from /try
// For now, we'll create a simplified version and can expand later
// The key differences:
// 1. Requires auth (handled by middleware)
// 2. Selects rubric from user_rubrics
// 3. Has pitch context input
// 4. Saves with user_id

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Mic, Upload, Play, Pause, Square, Edit, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'

const DEBUG = true

interface Rubric {
  id: string
  title: string
  description: string | null
  target_duration_seconds: number | null
  criteria: Array<{
    key: string
    label: string
    description?: string
  }>
}

interface Run {
  id: string
  status: string
  transcript: string | null
  analysis_json: any
  audio_url: string | null
  duration_ms: number | null
}

export default function PracticePage() {
  const router = useRouter()
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [selectedRubricId, setSelectedRubricId] = useState<string>('')
  const [pitchContext, setPitchContext] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isGettingFeedback, setIsGettingFeedback] = useState(false)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [pausedTotalMs, setPausedTotalMs] = useState(0)
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load pitch context from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pitchpractice_pitch_context')
    if (saved) {
      setPitchContext(saved)
    }
  }, [])

  // Save pitch context to localStorage
  useEffect(() => {
    if (pitchContext) {
      localStorage.setItem('pitchpractice_pitch_context', pitchContext)
    }
  }, [pitchContext])

  // Fetch user rubrics
  useEffect(() => {
    fetch('/api/rubrics/user')
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to fetch rubrics')
        }
        return res.json()
      })
      .then(data => {
        setRubrics(data)
        if (data.length > 0) {
          setSelectedRubricId(data[0].id)
        } else {
          setError('No rubrics found. Please create a rubric first.')
        }
      })
      .catch(err => {
        console.error('Failed to fetch rubrics:', err)
        setError('Failed to load rubrics. Please try again.')
      })
  }, [])

  // Timer for recording
  useEffect(() => {
    if (isRecording && !isPaused && recordingStartedAt) {
      timerIntervalRef.current = setInterval(() => {
        const now = Date.now()
        const elapsed = now - recordingStartedAt - pausedTotalMs
        if (pauseStartTime) {
          const currentPause = now - pauseStartTime
          setRecordingTime((elapsed - currentPause) / 1000)
        } else {
          setRecordingTime(elapsed / 1000)
        }
      }, 100)
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [isRecording, isPaused, recordingStartedAt, pausedTotalMs, pauseStartTime])

  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `0:${Math.floor(seconds).toString().padStart(2, '0')}`
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        if (totalSize < 5 * 1024) {
          setError('Recording was empty')
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          return
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
        
        // Calculate duration
        let calculatedDurationMs: number | null = null
        try {
          const arrayBuffer = await audioBlob.arrayBuffer()
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
          calculatedDurationMs = Math.round(audioBuffer.duration * 1000)
          audioContext.close()
        } catch {
          const stopTime = Date.now()
          let finalPausedTotal = pausedTotalMs
          if (pauseStartTime) {
            finalPausedTotal += stopTime - pauseStartTime
          }
          calculatedDurationMs = stopTime - (recordingStartedAt || stopTime) - finalPausedTotal
        }

        ;(audioBlob as any).__durationMs = calculatedDurationMs
        setDurationMs(calculatedDurationMs)
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
        await uploadAudio(audioBlob, `recording-${Date.now()}.webm`)
      }

      const startTime = Date.now()
      setRecordingStartedAt(startTime)
      setIsRecording(true)
      setIsPaused(false)
      setPausedTotalMs(0)
      setPauseStartTime(null)
      mediaRecorder.start()
    } catch (err) {
      setError('Failed to start recording. Check microphone permissions.')
      console.error('Recording error:', err)
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      setPauseStartTime(Date.now())
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      if (pauseStartTime) {
        const pauseDuration = Date.now() - pauseStartTime
        setPausedTotalMs(prev => prev + pauseDuration)
        setPauseStartTime(null)
      }
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
    }
  }

  const handleFileUpload = async (file: File) => {
    await uploadAudio(file, file.name)
  }

  const uploadAudio = async (audioBlob: Blob, fileName: string) => {
    if (!selectedRubricId) {
      setError('Please select a rubric')
      setIsUploading(false)
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const sessionId = getSessionId()
      const blobDurationMs = (audioBlob as any).__durationMs || null
      const uploadDurationMs = blobDurationMs || durationMs || null

      const formData = new FormData()
      formData.append('audio', audioBlob, fileName)
      formData.append('session_id', sessionId)
      formData.append('rubric_id', selectedRubricId)
      if (uploadDurationMs !== null && uploadDurationMs > 0) {
        formData.append('duration_ms', uploadDurationMs.toString())
      }
      if (pitchContext.trim()) {
        formData.append('pitch_context', pitchContext.trim())
      }

      const response = await fetch('/api/runs/create', {
        method: 'POST',
        body: formData,
      })

      const responseText = await response.text()
      let data: any = null
      
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        throw new Error('Invalid response from server')
      }

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      const runId = data.runId || data.run?.id || data.id
      if (!runId) {
        throw new Error('No run ID returned')
      }

      setRun({ ...data.run, audio_url: null })
      setIsUploading(false)
      
      setIsTranscribing(true)
      await transcribeRun(runId)
    } catch (err: any) {
      setError(err.message || 'Failed to upload audio')
      setIsUploading(false)
      setIsTranscribing(false)
    }
  }

  const transcribeRun = async (runId: string) => {
    try {
      const response = await fetch(`/api/runs/${runId}/transcribe`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Transcription failed')
      }

      const data = await response.json()
      
      if (data.ok && data.run) {
        setRun({ ...data.run, audio_url: run?.audio_url || null })
      } else {
        await fetchRun(runId)
      }
      
      setIsTranscribing(false)
      
      if (data.run?.transcript && data.run.transcript.length > 0) {
        setIsGettingFeedback(true)
        await getFeedback(runId)
      }
    } catch (err: any) {
      setError(err.message || 'Transcription failed')
      setIsTranscribing(false)
    }
  }

  const fetchRun = async (runId: string) => {
    try {
      const res = await fetch(`/api/runs/${runId}`)
      if (!res.ok) throw new Error('Failed to fetch run')
      const data = await res.json()
      const runData = data.ok && data.run ? data.run : data
      setRun({ ...runData, audio_url: run?.audio_url || null })
      
      if (runData.audio_path) {
        const audioRes = await fetch(`/api/runs/${runId}/audio-url`)
        if (audioRes.ok) {
          const audioData = await audioRes.json()
          if (audioData.url) {
            setAudioUrl(audioData.url)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching run:', err)
    }
  }

  const getFeedback = async (runId: string) => {
    try {
      const response = await fetch(`/api/runs/${runId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rubric_id: selectedRubricId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Feedback generation failed')
      }

      const data = await response.json()
      if (data.ok && data.run) {
        setRun({ ...data.run, audio_url: run?.audio_url || null })
      } else {
        await fetchRun(runId)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate feedback')
    } finally {
      setIsGettingFeedback(false)
    }
  }

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const selectedRubric = rubrics.find(r => r.id === selectedRubricId)

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[#111827] mb-2">Practice Pitch</h1>
          <p className="text-[#6B7280]">Record or upload your pitch to get detailed feedback</p>
        </div>

        {/* Rubric Selector */}
        <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)]">
          <div className="flex items-center justify-between mb-4">
            <label className="block text-sm font-medium text-[#111827]">
              Select Rubric
            </label>
            {selectedRubricId && (
              <Link
                href={`/app/rubrics/${selectedRubricId}`}
                className="text-sm text-[#F59E0B] hover:text-[#D97706] flex items-center gap-1"
              >
                <Edit className="h-4 w-4" />
                Edit rubric
              </Link>
            )}
          </div>
          {rubrics.length > 0 ? (
            <select
              value={selectedRubricId}
              onChange={(e) => setSelectedRubricId(e.target.value)}
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
            >
              {rubrics.map(rubric => (
                <option key={rubric.id} value={rubric.id}>
                  {rubric.title}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-3 bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-lg">
              <p className="text-sm text-[#92400E]">
                No rubrics found. <Link href="/app/rubrics/new" className="underline">Create one</Link> to get started.
              </p>
            </div>
          )}
          {selectedRubric && selectedRubric.description && (
            <p className="mt-2 text-sm text-[#6B7280]">{selectedRubric.description}</p>
          )}
        </Card>

        {/* Pitch Context */}
        <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)]">
          <label className="block text-sm font-medium text-[#111827] mb-2">
            What are you pitching?
          </label>
          <textarea
            value={pitchContext}
            onChange={(e) => setPitchContext(e.target.value)}
            placeholder="E.g., A SaaS product for small businesses, a startup idea to investors, a presentation to my team..."
            rows={3}
            className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] resize-none"
          />
          <p className="mt-2 text-xs text-[#6B7280]">
            This context helps provide more relevant feedback
          </p>
        </Card>

        {/* Record/Upload Panel */}
        <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)]">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('record')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'record'
                  ? 'bg-[#F59E0B] text-[#0B0F14]'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Mic className="h-4 w-4 inline mr-2" />
              Record
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'upload'
                  ? 'bg-[#F59E0B] text-[#0B0F14]'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Upload className="h-4 w-4 inline mr-2" />
              Upload
            </button>
          </div>

          {activeTab === 'record' ? (
            <div className="space-y-4">
              {!isRecording && !run && (
                <Button
                  variant="primary"
                  size="lg"
                  onClick={startRecording}
                  className="w-full"
                  disabled={!selectedRubricId || rubrics.length === 0}
                >
                  <Mic className="mr-2 h-5 w-5" />
                  Start Recording
                </Button>
              )}

              {isRecording && (
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-[#111827] mb-2">
                      {formatTime(recordingTime)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isPaused ? (
                      <Button variant="secondary" onClick={pauseRecording} className="flex-1">
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={resumeRecording} className="flex-1">
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </Button>
                    )}
                    <Button variant="primary" onClick={stopRecording} className="flex-1">
                      <Square className="mr-2 h-4 w-4" />
                      Stop
                    </Button>
                  </div>
                </div>
              )}

              {run && audioUrl && (
                <div className="flex items-center gap-2">
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                  <Button variant="secondary" onClick={togglePlayback} className="flex-1">
                    {isPlaying ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Play
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file) handleFileUpload(file)
              }}
              onDragOver={(e) => e.preventDefault()}
              className="border-2 border-dashed border-[rgba(17,24,39,0.15)] rounded-lg p-6 text-center"
            >
              <Upload className="h-10 w-10 text-[#6B7280] mx-auto mb-3" />
              <p className="text-sm text-[#111827] mb-2">Drag and drop an audio file</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/webm,audio/mp3,audio/wav,audio/m4a"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
                className="hidden"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
          )}

          {(isUploading || isTranscribing || isGettingFeedback) && (
            <div className="mt-4 text-center">
              <LoadingSpinner
                size="md"
                text={
                  isUploading
                    ? 'Uploading...'
                    : isTranscribing
                    ? 'Transcribing...'
                    : 'Generating feedback...'
                }
              />
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
              <p className="text-sm text-[#DC2626]">{error}</p>
            </div>
          )}

          {run && run.transcript && !run.analysis_json && !isTranscribing && !isGettingFeedback && (
            <div className="mt-4">
              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  if (run.id) {
                    setIsGettingFeedback(true)
                    getFeedback(run.id)
                  }
                }}
                className="w-full"
              >
                Get Feedback
              </Button>
            </div>
          )}
        </Card>

        {/* Results */}
        {run && (
          <div className="space-y-6">
            {/* Transcript */}
            {run.transcript && (
              <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)]">
                <SectionHeader title="Transcript" />
                <p className="mt-4 text-sm text-[#111827] whitespace-pre-wrap">
                  {run.transcript}
                </p>
              </Card>
            )}

            {/* Feedback */}
            {run.analysis_json && (
              <div className="space-y-6">
                {/* Summary */}
                {run.analysis_json.summary && (
                  <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)]">
                    <SectionHeader title="Summary" />
                    <div className="mt-4 space-y-4">
                      {run.analysis_json.summary.overall_score !== undefined && (
                        <div>
                          <div className="text-4xl font-bold text-[#111827] mb-2">
                            {run.analysis_json.summary.overall_score}/10
                          </div>
                        </div>
                      )}
                      {run.analysis_json.summary.overall_notes && (
                        <p className="text-sm text-[#111827]">
                          {run.analysis_json.summary.overall_notes}
                        </p>
                      )}
                      {run.analysis_json.summary.top_strengths && run.analysis_json.summary.top_strengths.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-[#111827] mb-2">Top Strengths</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-[#111827]">
                            {run.analysis_json.summary.top_strengths.map((s: string, i: number) => (
                              <li key={i}>{s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {run.analysis_json.summary.top_improvements && run.analysis_json.summary.top_improvements.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-[#111827] mb-2">Top Improvements</h4>
                          <ul className="list-disc list-inside space-y-1 text-sm text-[#111827]">
                            {run.analysis_json.summary.top_improvements.map((i: string, idx: number) => (
                              <li key={idx}>{i}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Rubric Breakdown */}
                {run.analysis_json.rubric_scores && run.analysis_json.rubric_scores.length > 0 && (
                  <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)]">
                    <SectionHeader title="Rubric Breakdown" />
                    <div className="mt-4 space-y-4">
                      {run.analysis_json.rubric_scores.map((score: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-4 border border-[rgba(17,24,39,0.10)] rounded-lg bg-[#F9FAFB]"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-[#111827]">
                              {score.criterion_label || score.criterion || `Criterion ${idx + 1}`}
                            </h4>
                            <div className="text-lg font-bold text-[#111827]">
                              {score.score}/10
                            </div>
                          </div>
                          {score.notes && (
                            <p className="text-xs text-[#6B7280] mt-2">{score.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Line by Line */}
                {run.analysis_json.line_by_line && run.analysis_json.line_by_line.length > 0 && (
                  <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)]">
                    <SectionHeader title="Line-by-Line Feedback" />
                    <div className="mt-4 space-y-3">
                      {run.analysis_json.line_by_line.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 border border-[rgba(17,24,39,0.10)] rounded-lg bg-[#F9FAFB]"
                        >
                          <p className="text-xs font-medium text-[#111827] mb-1">
                            "{item.quote}"
                          </p>
                          <p className="text-xs text-[#6B7280]">{item.comment}</p>
                          {item.action && (
                            <p className="text-xs text-[#F59E0B] mt-1">{item.action}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* View Full Results */}
                <div className="text-center">
                  <Link href={`/app/runs/${run.id}`}>
                    <Button variant="secondary">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      View Full Results
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

