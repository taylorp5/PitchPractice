'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Mic, Upload, Play, Pause, Square, AlertCircle, X, CheckCircle2, Edit2, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface Run {
  id: string
  status: string
  transcript: string | null
  analysis_json: any
  audio_url: string | null
  audio_seconds: number | null
  duration_ms: number | null
  word_count: number | null
  words_per_minute: number | null
}

interface UserRubric {
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

export default function PracticePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'record' | 'upload'>('record')
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [micLevel, setMicLevel] = useState(0)
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
  const [rubrics, setRubrics] = useState<UserRubric[]>([])
  const [selectedRubricId, setSelectedRubricId] = useState<string>('')
  const [pitchContext, setPitchContext] = useState<string>('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [isSilent, setIsSilent] = useState(false)
  const [hasMicPermission, setHasMicPermission] = useState(false)
  const [feedback, setFeedback] = useState<any>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const silenceStartRef = useRef<number | null>(null)
  const testAudioRef = useRef<HTMLAudioElement | null>(null)

  // Fetch user rubrics on mount
  useEffect(() => {
    fetch('/api/rubrics/user')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRubrics(data)
          if (data.length > 0) {
            setSelectedRubricId(data[0].id)
          }
        }
      })
      .catch(err => console.error('Failed to fetch rubrics:', err))

    // Load saved device ID
    const savedDeviceId = localStorage.getItem('pitchpractice_selected_device_id')
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId)
    }

    // Load saved pitch context
    const savedContext = localStorage.getItem('pitchpractice_pitch_context')
    if (savedContext) {
      setPitchContext(savedContext)
    }

    enumerateAudioDevices()
  }, [])

  // Save pitch context to localStorage
  useEffect(() => {
    if (pitchContext) {
      localStorage.setItem('pitchpractice_pitch_context', pitchContext)
    }
  }, [pitchContext])

  // Enumerate audio input devices
  const enumerateAudioDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setHasMicPermission(true)
      stream.getTracks().forEach(track => track.stop())
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      setAudioDevices(audioInputs)
      
      const savedDeviceId = localStorage.getItem('pitchpractice_selected_device_id')
      if (savedDeviceId && audioInputs.some(d => d.deviceId === savedDeviceId)) {
        setSelectedDeviceId(savedDeviceId)
      } else if (audioInputs.length > 0) {
        setSelectedDeviceId(audioInputs[0].deviceId)
        localStorage.setItem('pitchpractice_selected_device_id', audioInputs[0].deviceId)
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
      setHasMicPermission(false)
    }
  }

  // Setup mic level meter
  const setupMicLevelMeter = async (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.2
      source.connect(analyser)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Float32Array(bufferLength)
      
      const measureLevel = () => {
        if (!analyserRef.current) return
        analyserRef.current.getFloatTimeDomainData(dataArray)
        
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i]
        }
        const rms = Math.sqrt(sum / dataArray.length)
        const normalizedLevel = Math.min(1, rms * 12)
        
        setMicLevel(normalizedLevel)
        
        if (normalizedLevel < 0.01) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now()
          } else if (Date.now() - silenceStartRef.current > 2000) {
            setIsSilent(true)
          }
        } else {
          silenceStartRef.current = null
          setIsSilent(false)
        }
        
        animationFrameRef.current = requestAnimationFrame(measureLevel)
      }
      
      measureLevel()
    } catch (err) {
      console.error('Failed to setup mic level meter:', err)
    }
  }

  const stopMicLevelMeter = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error)
      audioContextRef.current = null
    }
    analyserRef.current = null
    silenceStartRef.current = null
    setIsSilent(false)
    setMicLevel(0)
  }

  // Test microphone
  const testMicrophone = async () => {
    if (isTestingMic) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      if (testAudioRef.current) {
        testAudioRef.current.srcObject = null
        testAudioRef.current = null
      }
      stopMicLevelMeter()
      setIsTestingMic(false)
      return
    }

    try {
      setIsTestingMic(true)
      setError(null)
      
      const constraints: MediaStreamConstraints = selectedDeviceId
        ? { audio: { deviceId: { exact: selectedDeviceId } } }
        : { audio: true }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setHasMicPermission(true)
      
      if (testAudioRef.current) {
        testAudioRef.current.srcObject = stream
      } else {
        const audio = document.createElement('audio')
        audio.srcObject = stream
        audio.autoplay = true
        audio.controls = false
        testAudioRef.current = audio
      }
      
      await setupMicLevelMeter(stream)
    } catch (err) {
      console.error('Error testing microphone:', err)
      setError('Failed to access microphone. Check permissions.')
      setIsTestingMic(false)
      setHasMicPermission(false)
    }
  }

  // Format time
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `0:${Math.floor(seconds).toString().padStart(2, '0')}`
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Start recording
  const startRecording = async () => {
    if (isSilent) {
      setError('No microphone input detected. Check permissions or select another input device.')
      return
    }

    if (!selectedRubricId) {
      setError('Please select a rubric first')
      return
    }

    try {
      if (isTestingMic) {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop())
        }
        if (testAudioRef.current) {
          testAudioRef.current.srcObject = null
        }
        stopMicLevelMeter()
        setIsTestingMic(false)
      }

      const constraints: MediaStreamConstraints = selectedDeviceId
        ? { audio: { deviceId: { exact: selectedDeviceId } } }
        : { audio: true }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setHasMicPermission(true)
      
      await setupMicLevelMeter(stream)
      
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stopMicLevelMeter()
        
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        const actualMimeType = mediaRecorder.mimeType || mimeType
        
        if (totalSize < 5 * 1024) {
          setError('Recording was empty—check mic permissions.')
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          return
        }
        
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType })
        
        let calculatedDurationMs: number | null = null
        try {
          const arrayBuffer = await audioBlob.arrayBuffer()
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
          calculatedDurationMs = Math.round(audioBuffer.duration * 1000)
          audioContext.close()
        } catch (decodeError) {
          const stopTime = Date.now()
          let finalPausedTotal = pausedTotalMs
          if (pauseStartTime) {
            finalPausedTotal += stopTime - pauseStartTime
          }
          calculatedDurationMs = recordingStartedAt 
            ? stopTime - recordingStartedAt - finalPausedTotal
            : null
        }
        
        if (calculatedDurationMs !== null && calculatedDurationMs > 0) {
          setDurationMs(calculatedDurationMs)
        }
        
        ;(audioBlob as any).__mimeType = actualMimeType
        if (calculatedDurationMs !== null) {
          ;(audioBlob as any).__durationMs = calculatedDurationMs
        }
        
        await uploadAudio(audioBlob, 'recording.webm')
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      setTimeout(() => {
        if (isSilent && isRecording) {
          setError('No microphone input detected. Check permissions or select another input device.')
          stopRecording()
        }
      }, 1500)

      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
      setIsSilent(false)
      silenceStartRef.current = null
      setRecordingTime(0)
      
      const startTime = Date.now()
      setRecordingStartedAt(startTime)
      setPausedTotalMs(0)
      setPauseStartTime(null)

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Failed to start recording. Please check microphone permissions.')
      stopMicLevelMeter()
    }
  }

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      setPauseStartTime(Date.now())
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused && pauseStartTime) {
      mediaRecorderRef.current.resume()
      const pauseDuration = Date.now() - pauseStartTime
      setPausedTotalMs(prev => prev + pauseDuration)
      setPauseStartTime(null)
      setIsPaused(false)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused && pauseStartTime) {
        const pauseDuration = Date.now() - pauseStartTime
        setPausedTotalMs(prev => prev + pauseDuration)
        setPauseStartTime(null)
      }
      
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsPaused(false)
      stopMicLevelMeter()
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }

  const getAudioDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio')
      const url = URL.createObjectURL(file)
      audio.src = url
      
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration
        URL.revokeObjectURL(url)
        if (isFinite(duration) && duration > 0) {
          resolve(Math.round(duration * 1000))
        } else {
          resolve(null)
        }
      })
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url)
        resolve(null)
      })
      
      setTimeout(() => {
        URL.revokeObjectURL(url)
        resolve(null)
      }, 5000)
    })
  }

  const handleFileUpload = async (file: File) => {
    const fileDurationMs = await getAudioDuration(file)
    if (fileDurationMs !== null && fileDurationMs > 0) {
      setDurationMs(fileDurationMs)
    }
    await uploadAudio(file, file.name)
  }

  // Upload audio and create run
  const uploadAudio = async (audioBlob: Blob, fileName: string) => {
    setIsUploading(true)
    setError(null)

    try {
      const sessionId = getSessionId()
      if (!selectedRubricId) {
        setError('Please select a rubric')
        setIsUploading(false)
        return
      }

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
        // Response might not be JSON
      }

      if (!response.ok) {
        const errorData = data || {}
        throw new Error(errorData.error || 'Upload failed')
      }

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
        runId = data.id
        runData = { id: data.id }
      } else {
        throw new Error(`Run creation failed: no run ID returned`)
      }

      if (!runId) {
        throw new Error(`Run creation failed: invalid response format`)
      }

      if (uploadDurationMs !== null && uploadDurationMs > 0) {
        runData.duration_ms = uploadDurationMs
      }
      
      setRun({ ...runData, audio_url: null })
      setIsUploading(false)
      
      setIsTranscribing(true)
      await transcribeRun(runId)
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to upload audio'
      setError(errorMessage)
      setIsUploading(false)
      setIsTranscribing(false)
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

  // Get feedback (analysis)
  const getFeedback = async (runId: string) => {
    if (!runId) {
      setError('Cannot get feedback: no run ID')
      setIsGettingFeedback(false)
      return
    }

    if (!selectedRubricId) {
      setError('Cannot get feedback: no rubric selected')
      setIsGettingFeedback(false)
      return
    }

    try {
      const response = await fetch(`/api/runs/${runId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rubric_id: selectedRubricId,
          pitch_context: pitchContext.trim() || null,
        }),
      })

      const responseText = await response.text()
      let responseData: any = null
      
      try {
        responseData = JSON.parse(responseText)
      } catch (e) {
        // Could not parse
      }

      if (!response.ok) {
        const errorData = responseData || {}
        throw new Error(errorData.error || errorData.message || 'Feedback generation failed')
      }

      if (responseData?.ok && responseData?.run) {
        setRun({ ...responseData.run, audio_url: run?.audio_url || null })
      }
      
      if (responseData?.ok && responseData?.analysis) {
        setFeedback(responseData.analysis)
      } else if (responseData?.ok && responseData?.run?.analysis_json) {
        setFeedback(responseData.run.analysis_json)
      } else {
        throw new Error('Feedback generation succeeded but no feedback data in response')
      }

      setIsGettingFeedback(false)
    } catch (err: any) {
      setError(err.message || 'Feedback generation failed')
      setIsGettingFeedback(false)
    }
  }

  // Fetch run data
  const fetchRun = async (runId: string) => {
    // Guard: Never fetch if runId is falsy or the string "undefined"
    if (!runId || runId === 'undefined') {
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
        
        if (data.run.analysis_json) {
          setFeedback(data.run.analysis_json)
        } else {
          setFeedback(null)
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch run:', err)
      setError('Failed to load run data. Please try again.')
    }
  }

  // Poll for run updates
  useEffect(() => {
    if (!run?.id || (!isTranscribing && !isGettingFeedback)) return

    const runId = run.id
    const interval = setInterval(() => {
      if (runId) {
        fetchRun(runId)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [run?.id, isTranscribing, isGettingFeedback])

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

  const handleNewTake = () => {
    setRun(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setIsRecording(false)
    setIsPaused(false)
    setIsUploading(false)
    setIsTranscribing(false)
    setIsGettingFeedback(false)
    setError(null)
    setMicLevel(0)
    setFeedback(null)
    audioChunksRef.current = []
    stopMicLevelMeter()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (isTestingMic) {
      setIsTestingMic(false)
    }
  }

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const selectedRubric = rubrics.find(r => r.id === selectedRubricId)

  return (
    <div className="min-h-screen bg-[#F7F7F8] p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-[#111827] mb-8">Practice Your Pitch</h1>

        {/* Rubric Selector */}
        <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)] shadow-sm mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-[#111827]">Select Rubric</h2>
            <Link
              href="/app/rubrics"
              className="text-sm text-[#F59E0B] hover:text-[#D97706] flex items-center gap-1"
            >
              <Edit2 className="h-4 w-4" />
              Edit rubrics
            </Link>
          </div>
          {rubrics.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-[#6B7280] mb-3">No rubrics yet. Create one to get started.</p>
              <Button variant="primary" size="sm" href="/app/rubrics/new" asChild>
                Create Rubric
              </Button>
            </div>
          ) : (
            <select
              value={selectedRubricId}
              onChange={(e) => setSelectedRubricId(e.target.value)}
              className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent"
              disabled={isRecording || isUploading || isTranscribing || isGettingFeedback}
            >
              {rubrics.map((rubric) => (
                <option key={rubric.id} value={rubric.id}>
                  {rubric.title}
                </option>
              ))}
            </select>
          )}
          {selectedRubric && (
            <div className="mt-4 p-3 bg-[#F3F4F6] rounded-lg">
              <p className="text-xs text-[#6B7280] mb-1">Selected rubric:</p>
              <p className="text-sm font-medium text-[#111827]">{selectedRubric.title}</p>
              {selectedRubric.description && (
                <p className="text-xs text-[#6B7280] mt-1">{selectedRubric.description}</p>
              )}
              {selectedRubric.target_duration_seconds && (
                <p className="text-xs text-[#6B7280] mt-1">
                  Target: {Math.floor(selectedRubric.target_duration_seconds / 60)}m {selectedRubric.target_duration_seconds % 60}s
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Pitch Context */}
        <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)] shadow-sm mb-6">
          <h2 className="text-lg font-semibold text-[#111827] mb-3">What are you pitching?</h2>
          <textarea
            value={pitchContext}
            onChange={(e) => setPitchContext(e.target.value)}
            placeholder="E.g., A SaaS product for small businesses, a startup idea to investors, a presentation for my team..."
            rows={3}
            className="w-full px-3 py-2 border border-[rgba(17,24,39,0.10)] rounded-lg text-sm text-[#111827] bg-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B] focus:border-transparent resize-none"
            disabled={isRecording || isUploading || isTranscribing || isGettingFeedback}
          />
          <p className="text-xs text-[#6B7280] mt-2">
            This context helps provide more relevant feedback tailored to your specific pitch.
          </p>
        </Card>

        {/* Two-Column Layout */}
        <div className="grid lg:grid-cols-[320px_1fr] gap-6">
          {/* LEFT: Recording Controls */}
          <div className="space-y-4">
            <Card className="p-5 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
              <div className="text-center mb-3">
                <p className="text-xs text-[#6B7280] mb-3">Record or upload your pitch</p>
                
                <div className="flex gap-2 justify-center mb-3">
                  <button
                    onClick={() => setActiveTab('record')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'record'
                        ? 'bg-[#F59E0B] text-white shadow-sm'
                        : 'bg-white text-[#6B7280] hover:text-[#111827] border border-[rgba(17,24,39,0.10)] hover:border-[rgba(17,24,39,0.20)]'
                    }`}
                  >
                    Record
                  </button>
                  <button
                    onClick={() => setActiveTab('upload')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeTab === 'upload'
                        ? 'bg-[#F59E0B] text-white shadow-sm'
                        : 'bg-white text-[#6B7280] hover:text-[#111827] border border-[rgba(17,24,39,0.10)] hover:border-[rgba(17,24,39,0.20)]'
                    }`}
                  >
                    Upload
                  </button>
                </div>
              </div>

              {activeTab === 'record' ? (
                <div className="space-y-4">
                  {audioDevices.length > 1 && (
                    <div className="text-sm">
                      <label className="block text-[#6B7280] mb-1 text-xs">Microphone</label>
                      <select
                        value={selectedDeviceId}
                        onChange={(e) => {
                          setSelectedDeviceId(e.target.value)
                          localStorage.setItem('pitchpractice_selected_device_id', e.target.value)
                        }}
                        className="w-full px-3 py-2 bg-white border border-[rgba(17,24,39,0.10)] rounded-lg text-[#111827] text-sm"
                        disabled={isRecording || isTestingMic}
                      >
                        {audioDevices.map((device) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label || `Device ${device.deviceId.substring(0, 8)}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {!hasMicPermission && !isRecording && !run && (
                    <div className="text-center p-3 bg-[#F3F4F6] border border-[rgba(17,24,39,0.10)] rounded-lg">
                      <p className="text-xs text-[#6B7280] mb-2">Enable microphone to see input level</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={testMicrophone}
                        disabled={isTestingMic}
                      >
                        {isTestingMic ? '⏹ Stop Test' : '🎤 Enable mic'}
                      </Button>
                    </div>
                  )}

                  {(isRecording || isTestingMic) && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-4 bg-[#F3F4F6] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-100 ${
                              micLevel > 0.01 ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                            }`}
                            style={{ width: `${Math.min(micLevel * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#6B7280] w-16 text-right">
                          {(micLevel * 100).toFixed(1)}%
                        </span>
                      </div>
                      {isSilent && (
                        <p className="text-xs text-[#EF4444] font-medium">
                          ⚠️ No microphone input detected
                        </p>
                      )}
                    </div>
                  )}

                  {!isRecording && !run && (
                    <div className="space-y-3">
                      <Button
                        variant="primary"
                        size="lg"
                        onClick={startRecording}
                        className="w-full shadow-lg shadow-[#F59E0B]/20"
                        disabled={!selectedRubricId || isSilent}
                      >
                        <Mic className="mr-2 h-5 w-5" />
                        Start recording
                      </Button>
                      {!isTestingMic && hasMicPermission && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={testMicrophone}
                          className="w-full text-[#6B7280] hover:text-[#111827]"
                        >
                          🎤 Test microphone
                        </Button>
                      )}
                    </div>
                  )}

                  {isRecording && (
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-[#111827] mb-2">
                          {formatTime(recordingTime)}
                        </div>
                      </div>

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
                    <div className="space-y-3">
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
                    <div className="text-center py-3">
                      <LoadingSpinner size="md" text="Transcribing..." />
                    </div>
                  )}

                  {isGettingFeedback && (
                    <div className="text-center py-3">
                      <LoadingSpinner size="md" text="Evaluating..." />
                    </div>
                  )}

                  {run && run.transcript && !feedback && !run.analysis_json && !isTranscribing && !isGettingFeedback && (
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
                      disabled={!selectedRubricId}
                    >
                      Get My Evaluation
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="border-2 border-dashed border-[rgba(17,24,39,0.15)] rounded-lg p-6 text-center hover:border-[rgba(17,24,39,0.25)] transition-colors bg-[#F3F4F6]"
                >
                  <Upload className="h-10 w-10 text-[#6B7280] mx-auto mb-3" />
                  <p className="text-sm text-[#111827] mb-2">Drag and drop an audio file</p>
                  <p className="text-xs text-[#6B7280] mb-3">or</p>
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
                <div className="text-center py-3">
                  <LoadingSpinner size="md" text="Uploading..." />
                </div>
              )}

              {error && (
                <div className="p-3 bg-[#FEE2E2] border border-[#FCA5A5] rounded-lg">
                  <p className="text-xs text-[#DC2626] mb-2">{error}</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setError(null)
                      handleNewTake()
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT: Results */}
          <div className="space-y-6">
            {!run ? (
              <Card className="p-12 bg-white border-[rgba(17,24,39,0.10)] shadow-sm text-center">
                <h3 className="text-lg font-semibold text-[#111827] mb-2">Your transcript will appear here</h3>
                <p className="text-sm text-[#6B7280]">Record or upload a pitch to get feedback.</p>
              </Card>
            ) : (
              <>
                {/* Metrics */}
                {run.transcript && run.transcript.trim().length > 0 && (
                  <Card className="p-6 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">Duration</p>
                        <p className="text-lg font-bold text-[#111827]">
                          {(() => {
                            const durationSec = durationMs 
                              ? durationMs / 1000 
                              : (run.duration_ms 
                                ? run.duration_ms / 1000 
                                : (run.audio_seconds || null))
                            return durationSec ? formatTime(durationSec) : '—'
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">Words</p>
                        <p className="text-lg font-bold text-[#111827]">
                          {run.word_count || (run.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : null) || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">WPM</p>
                        <p className="text-lg font-bold text-[#111827]">
                          {(() => {
                            const durationMsForWPM = durationMs 
                              || (run.duration_ms !== null ? run.duration_ms : null)
                              || (run.audio_seconds ? Math.round(run.audio_seconds * 1000) : null)
                            if (!run.transcript || !durationMsForWPM || durationMsForWPM < 5000) return '—'
                            const words = run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length
                            const wpm = Math.round(words / (durationMsForWPM / 60000))
                            return wpm
                          })()}
                        </p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Transcript */}
                {run.transcript && run.transcript.trim().length > 0 && (
                  <Card className="p-10 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
                    <h3 className="text-xl font-bold text-[#111827] mb-8">Transcript</h3>
                    <div className="max-h-[700px] overflow-y-auto">
                      <div className="max-w-[80ch] mx-auto" style={{ lineHeight: '1.9' }}>
                        <p className="text-base text-[#111827] whitespace-pre-wrap">{run.transcript}</p>
                      </div>
                    </div>
                  </Card>
                )}

                {/* Feedback */}
                {(() => {
                  const feedbackData = feedback || run.analysis_json
                  
                  if (!feedbackData) {
                    if (run.transcript) {
                      return (
                        <Card className="p-10 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
                          <h3 className="text-xl font-bold text-[#111827] mb-8">Your Evaluation</h3>
                          <div className="text-center py-8">
                            <p className="text-sm text-[#6B7280] mb-4">Evaluation isn't generated yet.</p>
                            <Button
                              variant="primary"
                              size="lg"
                              onClick={() => {
                                if (run.id) {
                                  setIsGettingFeedback(true)
                                  getFeedback(run.id)
                                }
                              }}
                              disabled={!selectedRubricId || isGettingFeedback}
                            >
                              {isGettingFeedback ? 'Evaluating...' : 'Get My Evaluation'}
                            </Button>
                          </div>
                        </Card>
                      )
                    }
                    return null
                  }
                  
                  return (
                    <>
                      {/* Rubric Breakdown */}
                      <Card className="p-10 bg-white border-[rgba(17,24,39,0.10)] shadow-sm">
                        <h3 className="text-xl font-bold text-[#111827] mb-8">Rubric Breakdown</h3>
                        <div className="space-y-3">
                          {feedbackData.rubric_scores && feedbackData.rubric_scores.length > 0 ? (
                            feedbackData.rubric_scores.map((rubricScore: any, idx: number) => {
                              const score = rubricScore.score || 0
                              const maxScore = 10
                              const scorePercent = (score / maxScore) * 100
                              const criterionLabel = rubricScore.criterion_label || rubricScore.criterion || `Criterion ${idx + 1}`
                              
                              let statusIcon: any = null
                              let statusColor = ''
                              if (score >= 7) {
                                statusIcon = CheckCircle2
                                statusColor = 'text-[#22C55E]'
                              } else if (score >= 4) {
                                statusIcon = AlertCircle
                                statusColor = 'text-[#F97316]'
                              } else {
                                statusIcon = X
                                statusColor = 'text-[#EF4444]'
                              }
                              
                              const StatusIcon = statusIcon
                              
                              return (
                                <div
                                  key={idx}
                                  className="p-5 rounded-lg border bg-[#F3F4F6] border-[rgba(17,24,39,0.10)]"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 flex-1">
                                      <StatusIcon className={`h-5 w-5 ${statusColor} flex-shrink-0`} />
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-sm font-medium text-[#111827]">
                                            {criterionLabel}
                                          </span>
                                          <span className="text-sm font-bold text-[#111827]">
                                            {score} / {maxScore}
                                          </span>
                                        </div>
                                        <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                                          <div
                                            className={`h-full transition-all ${
                                              scorePercent >= 70 ? 'bg-[#22C55E]' :
                                              scorePercent >= 40 ? 'bg-[#F97316]' :
                                              'bg-[#EF4444]'
                                            }`}
                                            style={{ width: `${scorePercent}%` }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {rubricScore.notes && (
                                    <div className="mt-2 pt-2 border-t border-[rgba(17,24,39,0.10)]">
                                      <p className="text-sm text-[#111827]">{rubricScore.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          ) : (
                            <p className="text-sm text-[#6B7280] text-center py-4">
                              No rubric scores available
                            </p>
                          )}
                        </div>
                      </Card>

                      {/* Summary */}
                      {feedbackData.summary && (
                        <Card className="p-6 bg-[#FEF3C7] border-[#F59E0B]/40">
                          <h4 className="text-sm font-semibold text-[#92400E] uppercase tracking-wide mb-2">
                            Summary
                          </h4>
                          {feedbackData.summary.overall_score !== undefined && (
                            <p className="text-lg font-bold text-[#111827] mb-2">
                              Overall Score: {feedbackData.summary.overall_score}/10
                            </p>
                          )}
                          {feedbackData.summary.overall_notes && (
                            <p className="text-sm text-[#111827] mb-3">{feedbackData.summary.overall_notes}</p>
                          )}
                          {feedbackData.summary.top_strengths && feedbackData.summary.top_strengths.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-[#92400E] mb-1">Strengths:</p>
                              <ul className="list-disc list-inside text-sm text-[#111827] space-y-1">
                                {feedbackData.summary.top_strengths.map((strength: string, idx: number) => (
                                  <li key={idx}>{strength}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {feedbackData.summary.top_improvements && feedbackData.summary.top_improvements.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs font-semibold text-[#92400E] mb-1">Improvements:</p>
                              <ul className="list-disc list-inside text-sm text-[#111827] space-y-1">
                                {feedbackData.summary.top_improvements.map((improvement: string, idx: number) => (
                                  <li key={idx}>{improvement}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </Card>
                      )}
                    </>
                  )
                })()}

                {/* New take button */}
                <Button
                  variant="ghost"
                  onClick={handleNewTake}
                  className="w-full"
                >
                  Record New Take
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

