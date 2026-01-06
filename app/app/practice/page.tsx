'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Mic, Upload, Play, Pause, Square, AlertCircle, X, CheckCircle2, Edit2, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { getUserPlan, UserPlan } from '@/lib/plan'
import CustomRubricBuilder, { CustomRubric } from '@/components/CustomRubricBuilder'

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
  const [userPlan, setUserPlan] = useState<UserPlan>('free')
  const [rubricMode, setRubricMode] = useState<'template' | 'custom'>('template')
  const [customRubric, setCustomRubric] = useState<CustomRubric | null>(null)
  const [selectedRubricSource, setSelectedRubricSource] = useState<'template' | 'custom'>('template')
  const [customRubricId, setCustomRubricId] = useState<string | null>(null)

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

  // Fetch user plan and rubrics on mount
  useEffect(() => {
    // Get user plan
    getUserPlan().then(plan => {
      setUserPlan(plan)
    })

    // Fetch template rubrics
    fetch('/api/rubrics?scope=templates')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRubrics(data)
          if (data.length > 0) {
            setSelectedRubricId(data[0].id)
          }
        }
      })
      .catch(err => console.error('Failed to fetch template rubrics:', err))

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

    // Load last used custom rubric if available
    const lastUsed = localStorage.getItem('pp_last_used_custom_rubric')
    if (lastUsed) {
      try {
        const parsed = JSON.parse(lastUsed)
        setCustomRubric(parsed)
      } catch (e) {
        console.error('Failed to load last used custom rubric:', e)
      }
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

    if (!hasValidRubric) {
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
      if (!hasValidRubric) {
        setError('Please select a rubric')
        setIsUploading(false)
        return
      }

      const blobDurationMs = (audioBlob as any).__durationMs || null
      const uploadDurationMs = blobDurationMs || durationMs || null

      const formData = new FormData()
      formData.append('audio', audioBlob, fileName)
      formData.append('session_id', sessionId)
      
      // Handle custom rubric vs template rubric
      if (selectedRubricSource === 'custom' && customRubric) {
        // Use the saved rubric_id if available, otherwise fall back to first available
        if (customRubricId) {
          formData.append('rubric_id', customRubricId)
        } else if (rubrics.length > 0) {
          formData.append('rubric_id', rubrics[0].id)
        } else {
          // If no rubrics exist, API will use default
          formData.append('rubric_id', '')
        }
        // Use custom rubric context if available
        const contextToUse = customRubric.context || pitchContext
        if (contextToUse.trim()) {
          formData.append('pitch_context', contextToUse.trim())
        }
      } else {
        formData.append('rubric_id', selectedRubricId)
        if (pitchContext.trim()) {
          formData.append('pitch_context', pitchContext.trim())
        }
      }
      
      if (uploadDurationMs !== null && uploadDurationMs > 0) {
        formData.append('duration_ms', uploadDurationMs.toString())
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

    if (!hasValidRubric) {
      setError('Cannot get feedback: no rubric selected')
      setIsGettingFeedback(false)
      return
    }

    try {
      const requestBody: any = {
        pitch_context: null,
      }

      if (selectedRubricSource === 'custom' && customRubric) {
        // Use the saved rubric_id if available, otherwise fall back to prompt_rubric
        if (customRubricId) {
          requestBody.rubric_id = customRubricId
        } else {
          // Fallback: Convert custom rubric to prompt_rubric format
          // The analyze API accepts prompt_rubric which overrides the database rubric
          requestBody.prompt_rubric = customRubric.criteria
            .filter(c => c.name.trim().length > 0)
            .map((c, idx) => ({
              id: c.id || `criterion_${idx}`,
              label: c.name,
              weight: 1.0,
              optional: false,
            }))
        }
        requestBody.pitch_context = (customRubric.context || pitchContext).trim() || null
      } else {
        requestBody.rubric_id = selectedRubricId
        requestBody.pitch_context = pitchContext.trim() || null
      }

      const response = await fetch(`/api/runs/${runId}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

  const selectedRubric = rubrics.find(r => r.id === selectedRubricId);
  const isCoachOrDaypass = userPlan === 'coach' || userPlan === 'daypass';
  const hasValidRubric = rubricMode === 'template' 
    ? (selectedRubricId && selectedRubric !== undefined)
    : (customRubric !== null && customRubric.title.trim().length > 0 && customRubric.criteria.length >= 3);
  const handleCustomRubricSave = (rubric: CustomRubric, rubricId?: string) => {
    setCustomRubric(rubric)
    if (rubricId) {
      setCustomRubricId(rubricId)
    }
    localStorage.setItem('pp_custom_rubric_draft_v1', JSON.stringify(rubric))
  }

  const handleCustomRubricUse = (rubric: CustomRubric, rubricId?: string) => {
    setCustomRubric(rubric)
    setSelectedRubricSource('custom')
    if (rubricId) {
      setCustomRubricId(rubricId)
    }
    localStorage.setItem('pp_last_used_custom_rubric', JSON.stringify(rubric))
  }

  return <div>ok</div>
}
