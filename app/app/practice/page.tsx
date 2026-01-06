'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Badge } from '@/components/ui/Badge'
import { Mic, Upload, Play, Pause, Square, AlertCircle, X, CheckCircle2, Edit2, ExternalLink, Check } from 'lucide-react'
import Link from 'next/link'
import { getUserPlan, UserPlan } from '@/lib/plan'
import { canEditRubrics, canViewPremiumInsights } from '@/lib/entitlements'
import CustomRubricBuilder, { CustomRubric } from '@/components/CustomRubricBuilder'
import { SignInModal } from '@/components/SignInModal'
import { createClient } from '@/lib/supabase/client-auth'

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
  title?: string
  name?: string
  description: string | null
  target_duration_seconds: number | null
  criteria: Array<{
    key: string
    label: string
    description?: string
  }>
  isUserRubric?: boolean
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
  // New rubric mode: 'default' | 'upload' | 'paste' (for Starter+)
  // Keep 'custom' mode for Coach/daypass custom rubric builder
  const [rubricMode, setRubricMode] = useState<'default' | 'upload' | 'paste' | 'custom'>('default')
  const [customRubric, setCustomRubric] = useState<CustomRubric | null>(null)
  const [selectedRubricSource, setSelectedRubricSource] = useState<'template' | 'custom'>('template')
  const [customRubricId, setCustomRubricId] = useState<string | null>(null)
  
  // New state for upload/paste rubric parsing
  const [uploadedRubricFile, setUploadedRubricFile] = useState<File | null>(null)
  const [pastedRubricText, setPastedRubricText] = useState<string>('')
  const [parsedCustomRubric, setParsedCustomRubric] = useState<any | null>(null)
  const [parsingRubric, setParsingRubric] = useState(false)
  const [rubricParseError, setRubricParseError] = useState<string | null>(null)
  
  const rubricFileInputRef = useRef<HTMLInputElement>(null)

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
  const shouldDiscardRecordingRef = useRef<boolean>(false)
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [feedbackTimer, setFeedbackTimer] = useState(0)

  const [isLoadingPlan, setIsLoadingPlan] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [showSignInModal, setShowSignInModal] = useState(false)

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        setIsAuthenticated(!!session)
      } catch (err) {
        console.error('Failed to check auth:', err)
        setIsAuthenticated(false)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    checkAuth()

    // Listen for auth state changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Fetch user plan on mount and when page becomes visible (for refresh after purchase)
  useEffect(() => {
    const fetchPlan = () => {
      getUserPlan().then(plan => {
        console.log('[Practice Page] User plan:', plan)
        setUserPlan(plan)
        setIsLoadingPlan(false)
      }).catch(err => {
        console.error('Failed to fetch user plan:', err)
        setUserPlan('free')
        setIsLoadingPlan(false)
      })
    }

    fetchPlan()

    // Refresh plan when page becomes visible (e.g., after returning from checkout)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPlan()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Fetch rubrics on mount (independent of plan)
  useEffect(() => {
    // Fetch both default and user rubrics
    Promise.all([
      fetch('/api/rubrics?scope=templates').then(res => res.json()),
      fetch('/api/rubrics/user').then(res => res.ok ? res.json() : []).catch(() => [])
    ])
      .then(([defaultRubrics, userRubrics]) => {
        // Combine rubrics: default first, then user rubrics
        // Mark user rubrics with a flag for grouping
        const allRubrics = [
          ...(Array.isArray(defaultRubrics) ? defaultRubrics : []),
          ...(Array.isArray(userRubrics) ? userRubrics.map((r: any) => ({ ...r, isUserRubric: true })) : [])
        ]
        setRubrics(allRubrics)
        if (allRubrics.length > 0) {
          setSelectedRubricId(allRubrics[0].id)
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

      // TODO: Hook function for chunked upload (future implementation)
      // This will be called each time a chunk becomes available during recording
      // For now, this is a no-op but provides the scaffolding for chunked uploads
      const onChunkAvailable = (blob: Blob) => {
        // TODO: Implement chunked upload logic here
        // This will allow progressive upload of chunks during long Coach recordings
        // to avoid memory issues and enable resumable uploads
      }

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          // Call the chunk hook for future chunked upload implementation
          // For now, chunks are still collected and uploaded as a single blob at the end
          onChunkAvailable(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        stopMicLevelMeter()
        
        // Check if recording should be discarded
        if (shouldDiscardRecordingRef.current) {
          shouldDiscardRecordingRef.current = false
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          setIsRecording(false)
          setIsPaused(false)
          setRecordingTime(0)
          setPausedTotalMs(0)
          setPauseStartTime(null)
          audioChunksRef.current = []
          return
        }
        
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

      // Use timeslice (3000ms) for all plans to ensure stable long recordings
      // This causes MediaRecorder to fire ondataavailable every 3 seconds
      // This enables progressive chunk collection and prevents memory issues for long recordings
      const timesliceMs = 3000 // 3 second chunks for all plans
      mediaRecorder.start(timesliceMs)
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
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at plan limit (calculate dynamically to use current plan)
          const maxSeconds = getMaxRecordingSeconds()
          if (newTime >= maxSeconds) {
            stopRecording()
            return maxSeconds
          }
          return newTime
        })
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
      // Pause the timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
    }
  }

  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused && pauseStartTime) {
      mediaRecorderRef.current.resume()
      const pauseDuration = Date.now() - pauseStartTime
      setPausedTotalMs(prev => prev + pauseDuration)
      setPauseStartTime(null)
      setIsPaused(false)
      // Resume the timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at plan limit (calculate dynamically to use current plan)
          const maxSeconds = getMaxRecordingSeconds()
          if (newTime >= maxSeconds) {
            stopRecording()
            return maxSeconds
          }
          return newTime
        })
      }, 1000)
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

  // Re-record handler: stops recorder safely and resets local state
  const handleRerecord = () => {
    // Set flag to prevent onstop callback from uploading
    shouldDiscardRecordingRef.current = true
    
    // Stop recorder safely if active (paused or recording)
    try {
      if (mediaRecorderRef.current && (isPaused || isRecording)) {
        mediaRecorderRef.current.stop()
      }
    } catch (e) {
      // Ignore errors if recorder already stopped
    }
    
    // Stop and clear stream tracks immediately
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Reset all recording state
    setIsRecording(false)
    setIsPaused(false)
    setRecordingTime(0)
    setPausedTotalMs(0)
    setPauseStartTime(null)
    setRecordingStartedAt(null)
    audioChunksRef.current = []
    stopMicLevelMeter()
    
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
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
      
      // Handle rubric selection: parsed rubric (upload/paste), custom rubric (builder), or default
      if ((rubricMode === 'upload' || rubricMode === 'paste') && parsedCustomRubric) {
        // For parsed rubrics, send rubric_json instead of rubric_id
        // Convert parsed rubric to the format expected by the API
        const rubricJson = {
          name: parsedCustomRubric.title || 'Custom Rubric',
          description: parsedCustomRubric.description || parsedCustomRubric.context_summary || null,
          criteria: parsedCustomRubric.criteria.map((c: any) => ({
            name: c.name,
            description: c.description || null,
            weight: c.weight || null,
          })),
          target_duration_seconds: parsedCustomRubric.target_duration_seconds || null,
          max_duration_seconds: parsedCustomRubric.max_duration_seconds || null,
          guiding_questions: parsedCustomRubric.guiding_questions || [],
        }
        formData.append('rubric_json', JSON.stringify(rubricJson))
        
        // Use parsed rubric context if available, otherwise use pitchContext
        const contextToUse = parsedCustomRubric.context_summary || pitchContext
        if (contextToUse && contextToUse.trim()) {
          formData.append('pitch_context', contextToUse.trim())
        }
      } else if (selectedRubricSource === 'custom' && customRubric) {
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
      } else if (rubricMode === 'default') {
        // Default mode: send rubric_id
        formData.append('rubric_id', selectedRubricId)
        if (pitchContext.trim()) {
          formData.append('pitch_context', pitchContext.trim())
        }
      } else {
        // Fallback: should not happen, but send rubric_id if available
        if (selectedRubricId) {
          formData.append('rubric_id', selectedRubricId)
        }
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

      // Handle rubric for analysis: parsed rubric, custom rubric, or default
      if ((rubricMode === 'upload' || rubricMode === 'paste') && parsedCustomRubric) {
        // Convert parsed rubric to prompt_rubric format
        requestBody.prompt_rubric = parsedCustomRubric.criteria
          .filter((c: any) => c.name && c.name.trim().length > 0)
          .map((c: any, idx: number) => ({
            id: c.id || `criterion_${idx}`,
            label: c.name,
            weight: c.weight || 1.0,
            optional: false,
          }))
        requestBody.pitch_context = (parsedCustomRubric.context_summary || pitchContext).trim() || null
      } else if (selectedRubricSource === 'custom' && customRubric) {
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
      setFeedbackTimer(0)
      if (feedbackTimerRef.current) {
        clearInterval(feedbackTimerRef.current)
        feedbackTimerRef.current = null
      }
    } catch (err: any) {
      setError(err.message || 'Feedback generation failed')
      setIsGettingFeedback(false)
      setFeedbackTimer(0)
      if (feedbackTimerRef.current) {
        clearInterval(feedbackTimerRef.current)
        feedbackTimerRef.current = null
      }
    }
  }

  // Timer helper for feedback generation
  useEffect(() => {
    if (isGettingFeedback) {
      setFeedbackTimer(0)
      feedbackTimerRef.current = setInterval(() => {
        setFeedbackTimer(prev => prev + 1)
      }, 1000)
    } else {
      if (feedbackTimerRef.current) {
        clearInterval(feedbackTimerRef.current)
        feedbackTimerRef.current = null
      }
    }
    
    return () => {
      if (feedbackTimerRef.current) {
        clearInterval(feedbackTimerRef.current)
        feedbackTimerRef.current = null
      }
    }
  }, [isGettingFeedback])

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

  const selectedRubric = rubrics.find(r => r.id === selectedRubricId) as any;
  const canEdit = canEditRubrics(userPlan);
  const canViewPremium = canViewPremiumInsights(userPlan);
  const isStarterOrAbove = userPlan !== 'free';
  
  // Plan-based recording duration limits (in seconds)
  const getMaxRecordingSeconds = (): number => {
    if (canViewPremium) return 5400 // 90:00 (Coach and Day Pass)
    if (userPlan === 'starter') return 1800 // 30:00
    return 120 // 2:00 for free
  }
  
  const MAX_RECORDING_SECONDS = getMaxRecordingSeconds()
  const WARNING_SECONDS = MAX_RECORDING_SECONDS - 60 // 1 minute before limit
  
  // Updated validation: Step 2 enabled if default rubric selected OR parsed rubric exists
  const hasValidRubric = rubricMode === 'default'
    ? (selectedRubricId && selectedRubric !== undefined)
    : rubricMode === 'custom'
    ? (customRubric !== null && customRubric.title.trim().length > 0 && customRubric.criteria.length >= 3)
    : (parsedCustomRubric !== null && parsedCustomRubric.criteria && parsedCustomRubric.criteria.length >= 3);
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

  // Parse rubric from upload or paste
  const parseRubric = async () => {
    setParsingRubric(true)
    setRubricParseError(null)

    try {
      let response: Response

      if (rubricMode === 'upload' && uploadedRubricFile) {
        // Upload mode: send file as multipart/form-data
        const formData = new FormData()
        formData.append('rubric_file', uploadedRubricFile)
        
        response = await fetch('/api/rubrics/parse', {
          method: 'POST',
          body: formData,
        })
      } else if (rubricMode === 'paste' && pastedRubricText.trim()) {
        // Paste mode: send text as JSON
        response = await fetch('/api/rubrics/parse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: pastedRubricText }),
        })
      } else {
        setRubricParseError('Please select a file or paste rubric text')
        setParsingRubric(false)
        return
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to parse rubric')
      }

      if (data.ok && data.rubric) {
        setParsedCustomRubric(data.rubric)
        setRubricParseError(null)
      } else {
        throw new Error('Invalid response from parse endpoint')
      }
    } catch (err: any) {
      console.error('Parse rubric error:', err)
      setRubricParseError(err.message || 'Failed to parse rubric')
      setParsedCustomRubric(null)
    } finally {
      setParsingRubric(false)
    }
  }

  // Handle rubric file selection
  const handleRubricFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedRubricFile(file)
      setRubricParseError(null)
      setParsedCustomRubric(null)
    }
  }

  // Reset parsed rubric when mode changes
  useEffect(() => {
    if (rubricMode === 'default') {
      setParsedCustomRubric(null)
      setUploadedRubricFile(null)
      setPastedRubricText('')
      setRubricParseError(null)
    }
  }, [rubricMode])

  // Force default mode for free plan
  useEffect(() => {
    if (userPlan === 'free' && rubricMode !== 'default') {
      setRubricMode('default')
    }
  }, [userPlan, rubricMode])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] to-[#0F172A] py-12 px-4">
      <div className="max-w-[1100px] mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-[#E6E8EB]">
              Practice Your Pitch
            </h1>
            {!isLoadingPlan && userPlan !== 'free' && (
              <Badge 
                variant={canViewPremium ? 'primary' : 'info'}
                size="sm"
              >
                {userPlan === 'daypass' ? 'Day Pass' : userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
              </Badge>
            )}
          </div>
          <p className="text-base text-[#9AA4B2] max-w-2xl mx-auto">
            Record or upload your pitch to get AI-powered feedback
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-[#EF444430] bg-[#EF444420]">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#EF4444] mb-1">Error</h3>
                <div className="text-sm text-[#E6E8EB] whitespace-pre-line">{error}</div>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-[#9AA4B2] hover:text-[#E6E8EB]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Card>
        )}

        {/* Step 1: Choose Evaluation Criteria */}
        <Card>
          <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 1</span>
              </div>
              <h2 className="text-xl font-bold text-[#E6E8EB]">Choose Evaluation Criteria</h2>
              <p className="text-sm text-[#9AA4B2] mt-0.5">Select or provide a rubric (required)</p>
            </div>
          </div>

          {isLoadingPlan ? (
            <div className="py-8 text-center">
              <LoadingSpinner className="h-6 w-6 mx-auto mb-2" />
              <p className="text-sm text-[#9AA4B2]">Loading plan...</p>
            </div>
          ) : (
            <div className="space-y-4">
            {/* Mode Toggle - Only for Starter+ */}
            {isStarterOrAbove && (
              <div>
                <label className="block text-sm font-medium text-[#9AA4B2] mb-2">
                  Rubric Source
                </label>
                <div className="flex gap-2">
                  <Button
                    variant={rubricMode === 'default' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setRubricMode('default')}
                    className="flex-1"
                  >
                    Default
                  </Button>
                  <Button
                    variant={rubricMode === 'upload' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setRubricMode('upload')}
                    className="flex-1"
                  >
                    Upload
                  </Button>
                  <Button
                    variant={rubricMode === 'paste' ? 'primary' : 'secondary'}
                    size="sm"
                    onClick={() => setRubricMode('paste')}
                    className="flex-1"
                  >
                    Paste
                  </Button>
                </div>
              </div>
            )}

            {/* Default Rubric Dropdown - Always visible, disabled when not in default mode */}
            <div>
              <label htmlFor="rubric-select" className="block text-sm font-medium text-[#9AA4B2] mb-2">
                Select Rubric {rubricMode !== 'default' && '(disabled)'}
              </label>
              <div className="flex gap-2">
                <select
                  id="rubric-select"
                  value={selectedRubricId}
                  onChange={(e) => setSelectedRubricId(e.target.value)}
                  disabled={rubricMode !== 'default' || isUploading || isRecording || rubrics.length === 0}
                  className="flex-1 px-4 py-3 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 transition-colors bg-[rgba(255,255,255,0.03)] text-[#E6E8EB] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {rubrics.length === 0 ? (
                    <option value="" className="bg-[#121826]">Loading rubrics...</option>
                  ) : (
                    <>
                      <option value="" className="bg-[#121826]">Select a rubric...</option>
                      {(() => {
                        const defaultRubrics = rubrics.filter((r: any) => !r.isUserRubric)
                        const userRubrics = rubrics.filter((r: any) => r.isUserRubric)
                        
                        return (
                          <>
                            {defaultRubrics.map((rubric: any) => (
                              <option key={rubric.id} value={rubric.id} className="bg-[#121826]">
                                {rubric.title || rubric.name || rubric.id}
                              </option>
                            ))}
                            {userRubrics.length > 0 && (
                              <optgroup label="My rubrics" className="bg-[#121826]">
                                {userRubrics.map((rubric) => (
                                  <option key={rubric.id} value={rubric.id} className="bg-[#121826]">
                                    {rubric.title || rubric.id}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </>
                        )
                      })()}
                    </>
                  )}
                </select>
                {/* View Rubric Button */}
                <div className="relative group">
                  <Button
                    onClick={() => {
                      if (selectedRubricId) {
                        window.open(`/app/rubrics/${selectedRubricId}`, '_blank')
                      }
                    }}
                    disabled={!selectedRubricId || rubricMode !== 'default'}
                    variant="secondary"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    View rubric
                  </Button>
                </div>
                {/* Edit Rubric Button */}
                <div className="relative group">
                  <Button
                    onClick={() => {
                      if (selectedRubricId && canEdit) {
                        router.push(`/app/rubrics/${selectedRubricId}`)
                      }
                    }}
                    disabled={!selectedRubricId || !canEdit || rubricMode !== 'default'}
                    variant="secondary"
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    Edit rubric
                  </Button>
                  {(!canEdit && selectedRubricId) && (
                    <span className="absolute z-50 mt-2 left-1/2 -translate-x-1/2 top-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none px-2 py-1 bg-[#151A23] border border-[#22283A] rounded-lg shadow-lg text-xs text-[#9CA3AF] whitespace-nowrap">
                      {userPlan === 'daypass' ? 'Editing available on Coach plan' : 'Upgrade to edit rubrics.'}
                    </span>
                  )}
                </div>
              </div>
              {rubricMode === 'default' && selectedRubric && (
                <p className="mt-2 text-sm text-[#9AA4B2]">
                  {selectedRubric.description}
                </p>
              )}
              
              {/* Rubric Cheat Sheet */}
              {rubricMode === 'default' && selectedRubric && (
                <div className="mt-4 p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                  <h4 className="text-sm font-semibold text-[#E6E8EB] mb-3">Quick rubric review</h4>
                  <ul className="space-y-2">
                    {(() => {
                      const criteria = selectedRubric.criteria || []
                      const guidingQuestions = selectedRubric.guiding_questions || []
                      const allItems: Array<{ label: string; description?: string }> = []
                      
                      // Add criteria
                      criteria.forEach((criterion: any) => {
                        allItems.push({
                          label: criterion.label || criterion.name || 'Untitled criterion',
                          description: criterion.description
                        })
                      })
                      
                      // Add guiding questions
                      if (Array.isArray(guidingQuestions)) {
                        guidingQuestions.forEach((question: string) => {
                          if (question && typeof question === 'string') {
                            allItems.push({
                              label: question,
                              description: undefined
                            })
                          }
                        })
                      }
                      
                      // Determine how many to show based on plan
                      const itemsToShow = canViewPremium ? allItems : allItems.slice(0, 4)
                      const hasMore = !canViewPremium && allItems.length > 4
                      
                      return (
                        <>
                          {itemsToShow.map((item, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                              <span className="text-[#F59E0B] mt-0.5 flex-shrink-0">•</span>
                              <div>
                                <span className="font-medium">{item.label}</span>
                                {item.description && (
                                  <span className="text-[#9AA4B2] ml-2">— {item.description}</span>
                                )}
                              </div>
                            </li>
                          ))}
                          {hasMore && (
                            <li className="text-xs text-[#9AA4B2] italic mt-2 pt-2 border-t border-[#22283A]">
                              Upgrade to Coach to see full rubric notes.
                            </li>
                          )}
                        </>
                      )
                    })()}
                  </ul>
                </div>
              )}
            </div>

            {/* Upload UI */}
            {rubricMode === 'upload' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="rubric-file" className="block text-sm font-medium text-[#9AA4B2] mb-2">
                    Upload Rubric File
                  </label>
                  <input
                    id="rubric-file"
                    ref={rubricFileInputRef}
                    type="file"
                    accept=".json,.png,.jpg,.jpeg,.pdf"
                    onChange={handleRubricFileChange}
                    className="hidden"
                  />
                  <div className="flex items-center gap-3">
                    <Button
                      variant="secondary"
                      onClick={() => rubricFileInputRef.current?.click()}
                      className="flex-1"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                    {uploadedRubricFile && (
                      <span className="text-sm text-[#E6E8EB] flex-1">
                        {uploadedRubricFile.name}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-[#9AA4B2]">
                    Upload a class rubric image/PDF or a rubric JSON file.
                  </p>
                </div>
                {uploadedRubricFile && (
                  <Button
                    variant="primary"
                    onClick={parseRubric}
                    disabled={parsingRubric}
                    className="w-full"
                  >
                    {parsingRubric ? (
                      <>
                        <LoadingSpinner className="h-4 w-4 mr-2" />
                        Parsing...
                      </>
                    ) : (
                      'Parse Rubric'
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Paste UI */}
            {rubricMode === 'paste' && (
              <div className="space-y-3">
                <div>
                  <label htmlFor="rubric-text" className="block text-sm font-medium text-[#9AA4B2] mb-2">
                    Paste Rubric Text
                  </label>
                  <textarea
                    id="rubric-text"
                    value={pastedRubricText}
                    onChange={(e) => setPastedRubricText(e.target.value)}
                    placeholder="Paste your rubric text here...&#10;&#10;Example:&#10;Title: Investor Pitch Rubric&#10;Criteria:&#10;1. Hook - How engaging is the opening?&#10;2. Problem - Is the problem clearly identified?&#10;3. Solution - Is the solution clearly presented?"
                    rows={8}
                    className="w-full px-4 py-3 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 transition-colors bg-[rgba(255,255,255,0.03)] text-[#E6E8EB] placeholder:text-[#6B7280] resize-none"
                  />
                </div>
                <Button
                  variant="primary"
                  onClick={parseRubric}
                  disabled={parsingRubric || !pastedRubricText.trim()}
                  className="w-full"
                >
                  {parsingRubric ? (
                    <>
                      <LoadingSpinner className="h-4 w-4 mr-2" />
                      Parsing...
                    </>
                  ) : (
                    'Parse Rubric'
                  )}
                </Button>
              </div>
            )}

            {/* Parse Error */}
            {rubricParseError && (
              <div className="p-3 bg-[#EF444420] border border-[#EF444430] rounded-lg">
                <p className="text-sm text-[#EF4444]">{rubricParseError}</p>
              </div>
            )}

            {/* Parsed Rubric Preview */}
            {parsedCustomRubric && (
              <div className="p-4 bg-[#22C55E20] border border-[#22C55E30] rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#22C55E] flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-[#22C55E] mb-1">
                      Rubric Parsed Successfully
                    </h3>
                    <p className="text-xs text-[#9AA4B2] mb-3">
                      This rubric will be used for this recording.
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-[#E6E8EB] mb-1">
                          {parsedCustomRubric.title}
                        </p>
                        {parsedCustomRubric.description && (
                          <p className="text-xs text-[#9AA4B2]">
                            {parsedCustomRubric.description}
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[#9AA4B2] mb-1">Criteria ({parsedCustomRubric.criteria?.length || 0}):</p>
                        <ul className="space-y-1">
                          {parsedCustomRubric.criteria?.slice(0, 5).map((criterion: any, idx: number) => (
                            <li key={idx} className="text-xs text-[#E6E8EB]">
                              • {criterion.name}
                              {criterion.description && (
                                <span className="text-[#9AA4B2] ml-2">- {criterion.description}</span>
                              )}
                            </li>
                          ))}
                          {parsedCustomRubric.criteria?.length > 5 && (
                            <li className="text-xs text-[#9AA4B2]">
                              ... and {parsedCustomRubric.criteria.length - 5} more
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Custom Rubric Builder for Coach/Daypass */}
            {canViewPremium && (
              <div className="mt-6 pt-6 border-t border-[rgba(255,255,255,0.08)]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-[#E6E8EB] mb-1">Custom Rubric Builder</h3>
                    <p className="text-xs text-[#9AA4B2]">Build your own rubric from scratch</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push('/app/rubrics/new')}
                  >
                    Open Builder
                  </Button>
                </div>
              </div>
            )}

            {/* Validation Message */}
            {!hasValidRubric && (
              <div className="p-3 bg-[#F59E0B20] border border-[#F59E0B30] rounded-lg">
                <p className="text-sm text-[#F59E0B]">
                  {userPlan === 'free' 
                    ? '⚠️ Select a rubric from the dropdown.'
                    : '⚠️ Select a rubric OR upload/paste one and parse it.'}
                </p>
              </div>
            )}
            </div>
          )}
        </Card>

        {/* Step 2: Record/Upload Audio */}
        <Card>
          <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 2</span>
              </div>
              <h2 className="text-xl font-bold text-[#E6E8EB]">Record/Upload Audio</h2>
              <p className="text-sm text-[#9AA4B2] mt-0.5">Record or upload your pitch</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Microphone Selector */}
            {audioDevices.length > 0 && (
              <div>
                <label htmlFor="mic-select" className="block text-sm font-medium text-[#9AA4B2] mb-2">
                  Microphone
                </label>
                <select
                  id="mic-select"
                  value={selectedDeviceId}
                  onChange={(e) => {
                    setSelectedDeviceId(e.target.value)
                    localStorage.setItem('pitchpractice_selected_device_id', e.target.value)
                  }}
                  disabled={isRecording || isUploading}
                  className="w-full px-3 py-2 text-sm border border-[rgba(255,255,255,0.08)] rounded-lg bg-[rgba(255,255,255,0.03)] text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 transition-colors disabled:opacity-50"
                >
                  {audioDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId} className="bg-[#121826]">
                      {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Test Mic Button */}
            {!isRecording && !run && (
              <>
                {!isTestingMic && (
                  <Button
                    onClick={testMicrophone}
                    disabled={isUploading}
                    variant="ghost"
                    size="sm"
                    className="w-full text-[#9AA4B2] hover:text-[#E6E8EB]"
                  >
                    🎤 Test microphone
                  </Button>
                )}
                {isTestingMic && (
                  <Button
                    onClick={testMicrophone}
                    variant="ghost"
                    size="sm"
                    className="w-full text-[#9AA4B2] hover:text-[#E6E8EB] border border-[#22283A]"
                  >
                    ⏹ End test
                  </Button>
                )}
              </>
            )}

            {/* Mic Level Meter */}
            {(isRecording || isTestingMic) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-4 bg-[rgba(255,255,255,0.08)] rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-100 ${
                        micLevel > 0.01 ? 'bg-[#22C55E]' : 'bg-[#EF4444]'
                      }`}
                      style={{ width: `${Math.min(micLevel * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-[#9AA4B2] w-16 text-right">
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

            {/* Recording Timer */}
            {isRecording && (
              <div className="p-3 bg-[#151A23] rounded-lg border border-[#22283A]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#E6E8EB]">Recording</span>
                  <span className="text-sm font-mono text-[#F59E0B]">
                    {formatTime(recordingTime)} / {formatTime(MAX_RECORDING_SECONDS)}
                  </span>
                </div>
                {recordingTime >= WARNING_SECONDS && recordingTime < MAX_RECORDING_SECONDS && (
                  <p className="text-xs text-[#F59E0B] font-medium mt-2">
                    ⚠️ Less than 1 minute remaining
                  </p>
                )}
              </div>
            )}

            {/* Record/Upload Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={!hasValidRubric || isUploading || isSilent}
                variant={isRecording ? 'danger' : 'primary'}
                className="flex-1"
                title={!hasValidRubric ? 'Please complete Step 1 first' : undefined}
              >
                {isRecording ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Record
                  </>
                )}
              </Button>
              <div className="flex-1 relative group">
                <Button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                  }}
                  disabled={true}
                  variant="secondary"
                  className="w-full cursor-not-allowed opacity-60"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Button>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-1.5 bg-[#1F2937] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 border border-[#374151] shadow-lg">
                  Coming soon
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-[#1F2937] border-r border-b border-[#374151] transform rotate-45"></div>
                  </div>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleFileUpload(file)
                }
              }}
              className="hidden"
            />

            {/* Pause/Resume for Recording */}
            {isRecording && (
              <div className="flex gap-3">
                {isPaused ? (
                  <>
                    <Button
                      onClick={resumeRecording}
                      variant="secondary"
                      className="flex-1"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume
                    </Button>
                    <Button
                      onClick={() => {
                        handleRerecord()
                      }}
                      variant="ghost"
                      className="flex-1 text-[#EF4444] hover:text-[#EF4444] hover:bg-[#EF4444]/10 border border-[#EF4444]/30"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Re-record
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={pauseRecording}
                    variant="secondary"
                    className="flex-1"
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}
              </div>
            )}

            {/* Status Messages */}
            {/* Step-based Progress UI */}
            {(isUploading || isTranscribing || isGettingFeedback) && (
              <div className="p-4 bg-[#151A23] rounded-lg border border-[#22283A]">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {isUploading ? (
                      <>
                        <LoadingSpinner className="h-4 w-4 text-[#F59E0B]" />
                        <span className="text-sm font-medium text-[#E6E8EB]">Uploading audio…</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-[#22C55E]" />
                        <span className="text-sm text-[#9AA4B2]">Uploading audio…</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isTranscribing ? (
                      <>
                        <LoadingSpinner className="h-4 w-4 text-[#F59E0B]" />
                        <span className="text-sm font-medium text-[#E6E8EB]">Transcribing…</span>
                      </>
                    ) : isUploading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-[#9AA4B2]" />
                        <span className="text-sm text-[#9AA4B2]">Transcribing…</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-[#22C55E]" />
                        <span className="text-sm text-[#9AA4B2]">Transcribing…</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isGettingFeedback ? (
                      <>
                        <LoadingSpinner className="h-4 w-4 text-[#F59E0B]" />
                        <span className="text-sm font-medium text-[#E6E8EB]">Analyzing…</span>
                      </>
                    ) : (isUploading || isTranscribing) ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-[#9AA4B2]" />
                        <span className="text-sm text-[#9AA4B2]">Analyzing…</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-[#22C55E]" />
                        <span className="text-sm text-[#9AA4B2]">Analyzing…</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#9AA4B2] mt-3 italic">
                  Long recordings can take several minutes.
                </p>
              </div>
            )}
          </div>
        </Card>


        {/* Results Section - Simplified Summary */}
        {run && feedback && (
          <Card>
            <div className="space-y-6">
              {/* Overall Score */}
              {feedback.summary?.overall_score !== undefined && (
                <div className="text-center">
                  <h3 className="text-sm font-semibold text-[#9AA4B2] mb-2">Overall Score</h3>
                  <p className="text-4xl font-bold text-[#E6E8EB]">
                    {feedback.summary.overall_score.toFixed(1)}/10
                  </p>
                </div>
              )}

              {/* Strengths - Show 1-2 */}
              {feedback.summary?.top_strengths && feedback.summary.top_strengths.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#22C55E] mb-3 uppercase tracking-wide">Strengths</h3>
                  <ul className="space-y-2">
                    {feedback.summary.top_strengths.slice(0, 2).map((strength: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                        <CheckCircle2 className="h-4 w-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                        <span>{strength.replace(/^["']|["']$/g, '').trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Improvement Areas - Show 1-2 */}
              {feedback.summary?.top_improvements && feedback.summary.top_improvements.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#F97316] mb-3 uppercase tracking-wide">Improvement Areas</h3>
                  <ul className="space-y-2">
                    {feedback.summary.top_improvements.slice(0, 2).map((improvement: string, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                        <span className="text-[#F97316] mt-0.5">•</span>
                        <span>{improvement.replace(/^["']|["']$/g, '').trim()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Duration vs Target */}
              {(() => {
                const durationSeconds = run.duration_ms ? run.duration_ms / 1000 : run.audio_seconds
                const targetSeconds = selectedRubric?.target_duration_seconds || parsedCustomRubric?.target_duration_seconds || null
                
                if (durationSeconds && targetSeconds) {
                  const durationFormatted = formatTime(durationSeconds)
                  const targetFormatted = formatTime(targetSeconds)
                  const diff = durationSeconds - targetSeconds
                  const diffFormatted = diff >= 0 ? `+${formatTime(Math.abs(diff))}` : `-${formatTime(Math.abs(diff))}`
                  
                  return (
                    <div className="pt-4 border-t border-[rgba(255,255,255,0.08)]">
                      <h3 className="text-sm font-semibold text-[#9AA4B2] mb-2">Duration</h3>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-lg font-semibold text-[#E6E8EB]">{durationFormatted}</p>
                          <p className="text-xs text-[#9AA4B2]">Actual</p>
                        </div>
                        <div className="text-[#9AA4B2]">vs</div>
                        <div>
                          <p className="text-lg font-semibold text-[#E6E8EB]">{targetFormatted}</p>
                          <p className="text-xs text-[#9AA4B2]">Target</p>
                        </div>
                        <div className="ml-auto">
                          <p className={`text-lg font-semibold ${diff >= 0 ? 'text-[#F97316]' : 'text-[#22C55E]'}`}>
                            {diffFormatted}
                          </p>
                          <p className="text-xs text-[#9AA4B2]">Difference</p>
                        </div>
                      </div>
                    </div>
                  )
                } else if (durationSeconds) {
                  return (
                    <div className="pt-4 border-t border-[rgba(255,255,255,0.08)]">
                      <h3 className="text-sm font-semibold text-[#9AA4B2] mb-2">Duration</h3>
                      <p className="text-lg font-semibold text-[#E6E8EB]">{formatTime(durationSeconds)}</p>
                    </div>
                  )
                }
                return null
              })()}

              {/* Primary CTA Button */}
              <div className="pt-4 space-y-2">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => {
                    if (isAuthenticated) {
                      router.push(`/runs/${run.id}`)
                    } else {
                      setShowSignInModal(true)
                    }
                  }}
                >
                  Review full feedback →
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-[#9AA4B2] hover:text-[#E6E8EB]"
                  onClick={() => {
                    setRun(null)
                    setFeedback(null)
                    setError(null)
                    setIsTranscribing(false)
                    setIsGettingFeedback(false)
                    setAudioUrl(null)
                    handleRerecord()
                  }}
                >
                  Re-record
                </Button>
              </div>

              {/* Hidden audio for playback if needed */}
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
              )}
            </div>
          </Card>
        )}

        {/* Sign-in Modal */}
        <SignInModal
          isOpen={showSignInModal}
          onClose={() => setShowSignInModal(false)}
          runId={run?.id || null}
        />
      </div>
    </div>
  )
}
