'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { CheckCircle2, Clock, Scissors, Mic, Upload, Play, Pause, Square } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const DEBUG = true

// Helper function to log fetch errors
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
  status: string
  transcript: string | null
  analysis_json: any
  audio_url: string | null
  audio_seconds: number | null
  word_count: number | null
  words_per_minute: number | null
}

const PROMPTS = [
  {
    id: 'elevator',
    title: 'Elevator pitch',
    duration: '45–60s',
    cues: [
      'What are you working on?',
      'Who is it for?',
      'Why does it matter?',
    ],
  },
  {
    id: 'class',
    title: 'Class presentation intro',
    duration: '60–90s',
    cues: [
      'Hook your audience',
      'State your main point',
      'Preview what\'s coming',
    ],
  },
  {
    id: 'sales',
    title: 'Sales/Client pitch opener',
    duration: '45–75s',
    cues: [
      'Identify the problem',
      'Present your solution',
      'Show the value',
    ],
  },
]

export default function TryPage() {
  const router = useRouter()
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [rubrics, setRubrics] = useState<any[]>([])
  const [selectedRubricId, setSelectedRubricId] = useState<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch rubrics on mount
  useEffect(() => {
    fetch('/api/rubrics')
      .then(res => res.json())
      .then(data => {
        setRubrics(data)
        if (data.length > 0) {
          setSelectedRubricId(data[0].id)
        }
      })
      .catch(err => console.error('Failed to fetch rubrics:', err))
  }, [])

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Start recording
  const startRecording = async () => {
    try {
      if (DEBUG) {
        console.log('[Try] Starting recording...')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio analysis for mic level
      const audioContext = new AudioContext()
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)
      analyser.fftSize = 256
      audioContextRef.current = audioContext
      analyserRef.current = analyser

      // Monitor mic level (works independently of run state)
      const updateMicLevel = () => {
        if (!analyserRef.current) return
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setMicLevel(average / 255)
        animationFrameRef.current = requestAnimationFrame(updateMicLevel)
      }
      updateMicLevel()

      // Set up MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)

      if (DEBUG) {
        console.log('[Try] Recording started')
      }

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err: any) {
      setError('Failed to start recording. Please check microphone permissions.')
      console.error('[Try] Recording error:', err)
    }
  }

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused) {
      mediaRecorderRef.current.resume()
      setIsPaused(false)
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    }
  }

  // Stop recording and upload
  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return

    mediaRecorderRef.current.stop()
    setIsRecording(false)
    setIsPaused(false)

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
    }

    if (audioContextRef.current) {
      audioContextRef.current.close()
    }

    mediaRecorderRef.current.onstop = async () => {
      if (DEBUG) {
        console.log('[Try] Recording stopped, preparing upload...', {
          chunks: audioChunksRef.current.length,
          totalSize: audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0),
        })
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
      await uploadAudio(audioBlob, 'recording.webm')
    }
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    await uploadAudio(file, file.name)
  }

  // Upload audio and create run
  const uploadAudio = async (audioBlob: Blob, fileName: string) => {
    setIsUploading(true)
    setError(null)

    try {
      const sessionId = getSessionId()
      if (!selectedRubricId) {
        setError('Please wait for rubrics to load')
        setIsUploading(false)
        return
      }

      if (DEBUG) {
        console.log('[Try] Uploading audio:', {
          fileName,
          size: audioBlob.size,
          type: audioBlob.type,
        })
      }

      const formData = new FormData()
      formData.append('audio', audioBlob, fileName)
      formData.append('session_id', sessionId)
      formData.append('rubric_id', selectedRubricId)
      if (selectedPrompt) {
        formData.append('title', PROMPTS.find(p => p.id === selectedPrompt)?.title || '')
      }

      const response = await fetch('/api/runs/create', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const data = await response.json()

      if (DEBUG) {
        console.log('[Try] Create run response:', data)
      }

      // Handle different response formats
      let runId: string | null = null
      let runData: any = null

      if (data.ok === false) {
        throw new Error(data.error || 'Run creation failed')
      }

      if (data.runId) {
        runId = data.runId
        runData = data.run || { id: data.runId }
      } else if (data.run?.id) {
        runId = data.run.id
        runData = data.run
      } else if (data.id) {
        // Fallback for old format
        runId = data.id
        runData = { id: data.id }
      } else {
        throw new Error(`Run creation failed: no run ID returned. Response: ${JSON.stringify(data)}`)
      }

      if (!runId) {
        throw new Error(`Run creation failed: invalid response format. Response: ${JSON.stringify(data)}`)
      }

      if (DEBUG) {
        console.log('[Try] Run created:', { 
          runId, 
          status: runData.status,
          audioPath: runData.audio_path,
        })
      }

      setRun({ ...runData, audio_url: null })
      setIsUploading(false)
      
      // Auto-start transcription
      setIsTranscribing(true)
      await transcribeRun(runId)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload audio'
      setError(errorMessage)
      setIsUploading(false)
      setIsTranscribing(false)
      
      if (DEBUG) {
        console.error('[Try] Upload failed:', err)
      }
    }
  }

  // Transcribe run
  const transcribeRun = async (runId: string) => {
    if (!runId) {
      setError('Cannot transcribe: no run ID')
      setIsTranscribing(false)
      return
    }

    try {
      if (DEBUG) {
        console.log('[Try] Starting transcription:', { runId })
      }

      const response = await fetch(`/api/runs/${runId}/transcribe`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Transcription failed')
      }

      const data = await response.json()
      
      if (DEBUG) {
        console.log('[Try] Transcription complete:', { 
          runId, 
          transcriptLen: data.transcript?.length || 0 
        })
      }
      
      // Fetch updated run data
      await fetchRun(runId)
      
      // Auto-start analysis if transcript exists
      if (data.transcript && data.transcript.length > 0) {
        setIsTranscribing(false)
        setIsAnalyzing(true)
        await analyzeRun(runId)
      } else {
        setIsTranscribing(false)
      }
    } catch (err: any) {
      setError(err.message || 'Transcription failed')
      setIsTranscribing(false)
    }
  }

  // Analyze run
  const analyzeRun = async (runId: string) => {
    if (!runId) {
      setError('Cannot analyze: no run ID')
      setIsAnalyzing(false)
      return
    }

    try {
      if (DEBUG) {
        console.log('[Try] Starting analysis:', { runId })
      }

      const response = await fetch(`/api/runs/${runId}/analyze`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Analysis failed')
      }

      if (DEBUG) {
        console.log('[Try] Analysis complete:', { runId })
      }

      await fetchRun(runId)
      setIsAnalyzing(false)
    } catch (err: any) {
      setError(err.message || 'Analysis failed')
      setIsAnalyzing(false)
    }
  }

  // Fetch run data
  const fetchRun = async (runId: string) => {
    if (!runId) {
      if (DEBUG) {
        console.warn('[Try] fetchRun called without runId')
      }
      return
    }

    try {
      const response = await fetch(`/api/runs/${runId}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch run')
      }

      const data = await response.json()
      if (data.ok && data.run) {
        setRun(data.run)
        setAudioUrl(data.run.audio_url)
      }
    } catch (err: any) {
      console.error('[Try] Failed to fetch run:', err)
      setError('Failed to load run data. Please try again.')
    }
  }

  // Poll for run updates during transcription/analysis
  useEffect(() => {
    if (!run?.id || (!isTranscribing && !isAnalyzing)) return

    const runId = run.id // Capture run.id to avoid stale closure
    const interval = setInterval(() => {
      if (runId) {
        fetchRun(runId)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [run?.id, isTranscribing, isAnalyzing])

  // Handle drag and drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('audio/')) {
      handleFileUpload(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  // Reset for new take
  const handleNewTake = () => {
    setRun(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setIsRecording(false)
    setIsPaused(false)
    setIsUploading(false)
    setIsTranscribing(false)
    setIsAnalyzing(false)
    setError(null)
    setMicLevel(0)
    audioChunksRef.current = []
  }

  // Play/pause audio
  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  // Parse transcript for highlights (if analysis exists)
  const getTranscriptHighlights = (): Array<{ quote: string; type: 'strength' | 'improve' | 'cut' }> => {
    if (!run?.analysis_json?.line_by_line) return []
    return run.analysis_json.line_by_line.map((item: any) => ({
      quote: item.quote,
      type: item.type === 'praise' ? 'strength' : item.type === 'issue' ? 'improve' : 'cut',
    }))
  }

  const highlights = getTranscriptHighlights()

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      {/* Header with Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0B0F14]/80 backdrop-blur-md border-b border-[#22283A] shadow-lg shadow-black/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <a href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center shadow-md shadow-[#F59E0B]/30 group-hover:shadow-lg group-hover:shadow-[#F59E0B]/40 transition-shadow">
                <span className="text-[#0B0F14] font-bold text-lg">P</span>
              </div>
              <div>
                <div className="font-bold text-[#E6E8EB] text-lg">PitchPractice</div>
                <div className="text-xs text-[#6B7280] -mt-0.5">Practice your pitch. Get precise feedback.</div>
              </div>
            </a>

            <div className="hidden md:flex items-center gap-6">
              <a 
                href="/upgrade" 
                className="text-sm font-medium text-[#9AA4B2] hover:text-[#E6E8EB] transition-colors"
              >
                Upgrade
              </a>
              <Button variant="ghost" size="sm" href="/app" asChild>
                Sign in
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* LEFT COLUMN */}
          <div className="space-y-8">
            {/* Section 1: Pick a prompt */}
            <div>
              <h2 className="text-2xl font-bold text-[#E6E8EB] mb-4">Pick a prompt</h2>
              <div className="space-y-3">
                {PROMPTS.map((prompt) => (
                  <div
                    key={prompt.id}
                    onClick={() => setSelectedPrompt(prompt.id)}
                    className="cursor-pointer"
                  >
                    <Card
                      className={`p-4 transition-all ${
                        selectedPrompt === prompt.id
                          ? 'bg-[#151C2C] border-[#F59E0B]'
                          : 'bg-[#121826] border-[#22283A] hover:border-[#6B7280]'
                      }`}
                    >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-semibold text-[#E6E8EB] mb-1">{prompt.title}</h3>
                        <p className="text-xs text-[#6B7280] mb-3">{prompt.duration}</p>
                        <div className="space-y-1">
                          {prompt.cues.map((cue, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm text-[#9AA4B2]">
                              <span className="mt-1">•</span>
                              <span>{cue}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {selectedPrompt === prompt.id && (
                        <CheckCircle2 className="h-5 w-5 text-[#F59E0B] flex-shrink-0" />
                      )}
                    </div>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            {/* Section 2: Record or Upload */}
            <div>
              <h2 className="text-2xl font-bold text-[#E6E8EB] mb-4">Record or upload</h2>
              
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setActiveTab('record')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'record'
                      ? 'bg-[#F59E0B] text-[#0B0F14]'
                      : 'bg-[#121826] text-[#9AA4B2] hover:text-[#E6E8EB]'
                  }`}
                >
                  Record
                </button>
                <button
                  onClick={() => setActiveTab('upload')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'upload'
                      ? 'bg-[#F59E0B] text-[#0B0F14]'
                      : 'bg-[#121826] text-[#9AA4B2] hover:text-[#E6E8EB]'
                  }`}
                >
                  Upload
                </button>
              </div>

              <Card className="p-6 bg-[#121826] border-[#22283A]">
                {activeTab === 'record' ? (
                  <div className="space-y-4">
                    {!isRecording && !run && (
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={startRecording}
                        className="w-full"
                        disabled={!selectedPrompt}
                      >
                        <Mic className="mr-2 h-5 w-5" />
                        Start recording
                      </Button>
                    )}

                    {isRecording && (
                      <div className="space-y-4">
                        {/* Timer and mic level */}
                        <div className="text-center">
                          <div className="text-3xl font-bold text-[#E6E8EB] mb-2">
                            {formatTime(recordingTime)}
                          </div>
                          <div className="w-full h-2 bg-[#0B0F14] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#F59E0B] transition-all duration-100"
                              style={{ width: `${micLevel * 100}%` }}
                            />
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="flex gap-2">
                          {!isPaused ? (
                            <Button
                              variant="secondary"
                              onClick={pauseRecording}
                              className="flex-1"
                            >
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              onClick={resumeRecording}
                              className="flex-1"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Resume
                            </Button>
                          )}
                          <Button
                            variant="primary"
                            onClick={stopRecording}
                            className="flex-1"
                          >
                            <Square className="mr-2 h-4 w-4" />
                            Stop
                          </Button>
                        </div>
                      </div>
                    )}

                    {run && audioUrl && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <audio
                            ref={audioRef}
                            src={audioUrl}
                            onEnded={() => setIsPlaying(false)}
                            className="hidden"
                          />
                          <Button
                            variant="secondary"
                            onClick={togglePlayback}
                            className="flex-1"
                          >
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
                      </div>
                    )}

                    {isTranscribing && (
                      <div className="text-center py-4">
                        <LoadingSpinner size="md" text="Transcribing..." />
                      </div>
                    )}

                    {isAnalyzing && (
                      <div className="text-center py-4">
                        <LoadingSpinner size="md" text="Analyzing..." />
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    className="border-2 border-dashed border-[#22283A] rounded-lg p-8 text-center hover:border-[#6B7280] transition-colors"
                  >
                    <Upload className="h-12 w-12 text-[#6B7280] mx-auto mb-4" />
                    <p className="text-[#E6E8EB] mb-2">Drag and drop an audio file</p>
                    <p className="text-sm text-[#9AA4B2] mb-4">or</p>
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
                    <p className="text-xs text-[#6B7280] mt-4">
                      Supports: WebM, MP3, WAV, M4A
                    </p>
                  </div>
                )}

                {isUploading && (
                  <div className="text-center py-4">
                    <LoadingSpinner size="md" text="Uploading..." />
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
                    <p className="text-sm text-[#EF4444] mb-3">{error}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setError(null)
                        handleNewTake()
                      }}
                    >
                      Try again
                    </Button>
                  </div>
                )}

                <p className="text-xs text-[#6B7280] text-center mt-4">
                  Free practice run · No signup required
                </p>
              </Card>
            </div>
          </div>

          {/* RIGHT COLUMN - Results */}
          <div className="space-y-6">
            {!run ? (
              <Card className="p-12 bg-[#121826] border-[#22283A] text-center">
                <p className="text-[#9AA4B2]">Your transcript and feedback will appear here.</p>
              </Card>
            ) : (
              <>
                {/* Metrics */}
                {run.word_count && (
                  <Card className="p-4 bg-[#121826] border-[#22283A]">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">Duration</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {run.audio_seconds ? formatTime(run.audio_seconds) : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">Words</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">{run.word_count}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">WPM</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {run.words_per_minute || '—'}
                        </p>
                      </div>
                    </div>
                    {run.words_per_minute && (
                      <p className="text-xs text-[#9AA4B2] text-center mt-3">
                        {run.words_per_minute < 150
                          ? 'Good pacing for clarity'
                          : run.words_per_minute < 180
                          ? 'Slightly fast, consider slowing down'
                          : 'Too fast, slow down for better comprehension'}
                      </p>
                    )}
                  </Card>
                )}

                {/* Transcript */}
                {run.transcript && (
                  <Card className="p-6 bg-[#121826] border-[#22283A]">
                    <h3 className="text-lg font-bold text-[#E6E8EB] mb-4">Transcript</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {run.transcript.split(/\n+/).filter(l => l.trim()).map((line, idx) => {
                        const highlight = highlights.find((h: { quote: string; type: string }) => {
                          const quoteLower = h.quote.toLowerCase().trim()
                          const lineLower = line.toLowerCase().trim()
                          return lineLower.includes(quoteLower) || quoteLower.includes(lineLower)
                        })
                        const highlightClasses = {
                          strength: 'bg-[#22C55E]/20 border-[#22C55E]/30 text-[#22C55E]',
                          improve: 'bg-[#F97316]/20 border-[#F97316]/30 text-[#F97316]',
                          cut: 'bg-[#EF4444]/20 border-[#EF4444]/30 text-[#EF4444]',
                        }
                        const highlightIcons = {
                          strength: CheckCircle2,
                          improve: Clock,
                          cut: Scissors,
                        }
                        const highlightLabels = {
                          strength: 'Strength',
                          improve: 'Improve',
                          cut: 'Cut',
                        }
                        const Icon = highlight ? highlightIcons[highlight.type as keyof typeof highlightIcons] : null

                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border ${
                              highlight
                                ? highlightClasses[highlight.type as keyof typeof highlightClasses]
                                : 'bg-[#0B0F14] border-[#22283A] text-[#E6E8EB]'
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <span className="flex-1 text-sm">{line}</span>
                              {highlight && Icon && (
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  <Icon className="h-3 w-3" />
                                  <span className="text-xs font-medium">
                                    {highlightLabels[highlight.type as keyof typeof highlightLabels]}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Card>
                )}

                {/* Analysis Summary */}
                {run.analysis_json && (
                  <Card className="p-6 bg-[#121826] border-[#22283A]">
                    <h3 className="text-lg font-bold text-[#E6E8EB] mb-4">Analysis Summary</h3>
                    <div className="space-y-4">
                      {run.analysis_json.summary?.top_strengths && run.analysis_json.summary.top_strengths.length > 0 && (
                        <div className="p-4 rounded-lg border bg-[#0B0F14] border-[#22C55E]/30">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
                            <h4 className="text-sm font-semibold text-[#22C55E] uppercase tracking-wide">
                              What's working
                            </h4>
                          </div>
                          <ul className="space-y-1">
                            {run.analysis_json.summary.top_strengths.map((strength: string, idx: number) => (
                              <li key={idx} className="text-sm text-[#E6E8EB]">• {strength}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {run.analysis_json.summary?.top_improvements && run.analysis_json.summary.top_improvements.length > 0 && (
                        <div className="p-4 rounded-lg border bg-[#0B0F14] border-[#F97316]/30">
                          <div className="flex items-center gap-2 mb-2">
                            <Clock className="h-4 w-4 text-[#F97316]" />
                            <h4 className="text-sm font-semibold text-[#F97316] uppercase tracking-wide">
                              What to improve
                            </h4>
                          </div>
                          <ul className="space-y-1">
                            {run.analysis_json.summary.top_improvements.map((improvement: string, idx: number) => (
                              <li key={idx} className="text-sm text-[#E6E8EB]">• {improvement}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* New take button */}
                <Button
                  variant="ghost"
                  onClick={handleNewTake}
                  className="w-full"
                >
                  Try again
                </Button>
              </>
            )}

            {/* Debug panel (temporary) */}
            {DEBUG && (
              <Card className="p-4 bg-[#0B0F14] border-[#22283A] mt-6">
                <h4 className="text-sm font-bold text-[#E6E8EB] mb-2">Debug Panel</h4>
                <div className="space-y-2 text-xs text-[#9AA4B2]">
                  <div>Run ID: {run?.id || 'none'}</div>
                  <div>Status: {run?.status || 'none'}</div>
                  <div>Is Recording: {isRecording ? 'yes' : 'no'}</div>
                  <div>Is Uploading: {isUploading ? 'yes' : 'no'}</div>
                  <div>Is Transcribing: {isTranscribing ? 'yes' : 'no'}</div>
                  <div>Is Analyzing: {isAnalyzing ? 'yes' : 'no'}</div>
                  <div>Selected Rubric: {selectedRubricId || 'none'}</div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      try {
                        const sessionId = getSessionId()
                        const formData = new FormData()
                        // Create a dummy audio blob for testing
                        const dummyBlob = new Blob(['test'], { type: 'audio/webm' })
                        formData.append('audio', dummyBlob, 'test.webm')
                        formData.append('session_id', sessionId)
                        formData.append('rubric_id', selectedRubricId || '')
                        formData.append('title', 'Test Run')

                        const response = await fetch('/api/runs/create', {
                          method: 'POST',
                          body: formData,
                        })

                        const data = await response.json()
                        console.log('[Try] Test run creation response:', data)
                        alert(`Response: ${JSON.stringify(data, null, 2)}`)
                      } catch (err: any) {
                        console.error('[Try] Test run creation failed:', err)
                        alert(`Error: ${err.message}`)
                      }
                    }}
                    className="mt-2"
                    disabled={!selectedRubricId}
                  >
                    Test run creation
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

