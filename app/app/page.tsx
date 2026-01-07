'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSessionId } from '@/lib/session'
import { getUserPlan, type UserPlan } from '@/lib/plan'
import { canViewPremiumInsights } from '@/lib/entitlements'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

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
    responseText: responseText.substring(0, 500), // Limit to first 500 chars
    error,
  })
}

interface Rubric {
  id: string
  name: string
  description: string | null
  criteria: any
  target_duration_seconds: number | null
  max_duration_seconds: number | null
}

interface RecentRun {
  id: string
  title: string | null
  created_at: string
  status: string
  audio_seconds: number | null
  duration_ms: number | null
  word_count: number | null
  rubric_id: string | null
  rubrics: {
    name: string
  } | null
}

export default function HomePage() {
  const router = useRouter()
  const [userPlan, setUserPlan] = useState<UserPlan>('free')
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [selectedRubric, setSelectedRubric] = useState<string>('')
  const [title, setTitle] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentRuns, setRecentRuns] = useState<RecentRun[]>([])
  const [isLoadingRuns, setIsLoadingRuns] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [micLevel, setMicLevel] = useState<number>(0)
  const [isSilent, setIsSilent] = useState(false)
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const silenceStartRef = useRef<number | null>(null)
  const testAudioRef = useRef<HTMLAudioElement | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Get user plan
    getUserPlan().then(plan => {
      setUserPlan(plan)
      
      // Fetch recent runs for Starter+ users
      if (plan !== 'free') {
        fetchRecentRuns()
      }
    })

    // Fetch rubrics
    const url = '/api/rubrics'
    fetch(url)
      .then(async res => {
        if (!res.ok) {
          await logFetchError(url, res)
        }
        return res.json()
      })
      .then(data => {
        // Filter rubrics based on user plan
        // Starter users only see prompt-based rubrics (from rubrics table, not user_rubrics)
        // Coach and Day Pass see all rubrics
        let filteredRubrics = data
        if (userPlan === 'starter') {
          // For Starter, only show default/prompt-based rubrics
          // These are rubrics from the 'rubrics' table (not user_rubrics)
          // In practice, this means rubrics that don't have a user_id
          // Since the API returns all rubrics, we'll filter client-side
          // For now, assume all rubrics from /api/rubrics are prompt-based
          filteredRubrics = data
        }
        setRubrics(filteredRubrics)
        // Don't auto-select a rubric - user must choose in Step 1
        // This ensures Step 2 is disabled until Step 1 is complete
      })
      .catch(err => {
        console.error('[Fetch Error] Failed to fetch rubrics:', {
          url,
          error: err,
        })
        setError('Failed to load rubrics')
      })

    // Load saved device ID
    const savedDeviceId = localStorage.getItem('pitchpractice_selected_device_id')
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId)
    }

    // Enumerate audio devices
    enumerateAudioDevices()

    // Cleanup timer on unmount
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [userPlan])

  const fetchRecentRuns = async () => {
    setIsLoadingRuns(true)
    try {
      const response = await fetch('/api/runs', {
        cache: 'no-store',
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          // Not authenticated, that's fine
          setRecentRuns([])
          return
        }
        throw new Error('Failed to fetch runs')
      }
      
      const data = await response.json()
      setRecentRuns(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Failed to fetch recent runs:', err)
      setRecentRuns([])
    } finally {
      setIsLoadingRuns(false)
    }
  }

  const formatTime = (seconds: number | null): string => {
    if (!seconds) return '—'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'analyzed':
        return 'text-[#22C55E]'
      case 'transcribed':
        return 'text-[#F59E0B]'
      case 'uploaded':
        return 'text-[#6B7280]'
      case 'error':
        return 'text-[#EF4444]'
      default:
        return 'text-[#6B7280]'
    }
  }

  const handleRunClick = (runId: string) => {
    if (!runId || runId === 'undefined') {
      setError('Invalid run ID')
      return
    }
    router.push(`/runs/${runId}`)
  }

  const enumerateAudioDevices = async () => {
    try {
      // Request permission first
      await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      setAudioDevices(audioInputs)
      
      // If we have a saved device ID, verify it still exists
      const savedDeviceId = localStorage.getItem('pitchpractice_selected_device_id')
      if (savedDeviceId && audioInputs.some(d => d.deviceId === savedDeviceId)) {
        setSelectedDeviceId(savedDeviceId)
      } else if (audioInputs.length > 0) {
        // Use first available device
        setSelectedDeviceId(audioInputs[0].deviceId)
        localStorage.setItem('pitchpractice_selected_device_id', audioInputs[0].deviceId)
      }
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
    }
  }

  const setupMicLevelMeter = async (stream: MediaStream) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Resume audio context on user gesture (required for some browsers)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      
      const analyser = audioContext.createAnalyser()
      const source = audioContext.createMediaStreamSource(stream)
      
      // Configure analyser for better accuracy
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.2
      source.connect(analyser)
      
      audioContextRef.current = audioContext
      analyserRef.current = analyser
      
      // Use Float32Array for time-domain data
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Float32Array(bufferLength)
      
      const measureLevel = () => {
        if (!analyserRef.current) return
        
        // Get float time-domain data
        analyserRef.current.getFloatTimeDomainData(dataArray)
        
        // Calculate RMS (Root Mean Square) from float samples
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const sample = dataArray[i]
          sum += sample * sample
        }
        const rms = Math.sqrt(sum / dataArray.length)
        
        // Normalize RMS to 0..1 UI value with curve
        const normalizedLevel = Math.min(1, rms * 12)
        
        setMicLevel(normalizedLevel)
        
        // Store raw RMS for debugging
        ;(window as any).__micRawRMS = rms
        
        // Update at ~30fps (requestAnimationFrame runs at ~60fps, so we can throttle if needed)
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

  const testMicrophone = async () => {
    if (isTestingMic) {
      // Stop testing
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
      
      // Log stream details
      const tracks = stream.getAudioTracks()
      console.log('[Mic Test] Stream tracks:', tracks.map(track => ({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
      })))
      
      // Setup live monitoring
      if (testAudioRef.current) {
        testAudioRef.current.srcObject = stream
      } else {
        const audio = document.createElement('audio')
        audio.srcObject = stream
        audio.autoplay = true
        audio.controls = false
        testAudioRef.current = audio
      }
      
      // Setup mic level meter (await to ensure audioContext is resumed)
      await setupMicLevelMeter(stream)
    } catch (err) {
      console.error('Error testing microphone:', err)
      setError('Failed to access microphone. Check permissions.')
      setIsTestingMic(false)
    }
  }

  const startRecording = async () => {
    if (isSilent) {
      setError('No microphone input detected. Check permissions or select another input device.')
      return
    }

    try {
      // Request stream with selected device
      const constraints: MediaStreamConstraints = selectedDeviceId
        ? { audio: { deviceId: { exact: selectedDeviceId } } }
        : { audio: true }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      // Log stream details for debugging
      const tracks = stream.getAudioTracks()
      const trackInfo = tracks.map(track => ({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
      }))
      console.log('[Recording] Stream tracks:', trackInfo)
      
      // Store track info for debug display
      ;(window as any).__currentTrackInfo = trackInfo
      
      // Setup mic level meter (await to ensure audioContext is resumed)
      await setupMicLevelMeter(stream)
      
      // Determine best supported mimeType
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = 'audio/webm'
      }
      
      console.log('[Recording] Using mimeType:', mimeType)
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      
      let chunkSizes: number[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          chunkSizes.push(event.data.size)
          console.log('[Recording] Chunk received:', {
            size: event.data.size,
            type: event.data.type,
            totalChunks: audioChunksRef.current.length,
          })
        }
      }

      mediaRecorder.onstop = () => {
        stopMicLevelMeter()
        
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        const actualMimeType = mediaRecorder.mimeType || mimeType
        
        console.log('[Recording] Stopped:', {
          totalSize,
          totalSizeKB: (totalSize / 1024).toFixed(2),
          chunkSizes,
          mimeType: actualMimeType,
          blobType: actualMimeType,
        })
        
        // Validate recording is not empty (client-side check)
        if (totalSize < 5 * 1024) { // Less than 5KB
          setError('Recording was empty—check mic permissions.')
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          return
        }
        
        // Note: Not blocking recording based on meter for now - just making it accurate
        
        // Create blob with the actual mimeType used
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: actualMimeType
        })
        
        // Store mimeType for upload
        ;(audioBlob as any).__mimeType = actualMimeType
        
        handleSubmit(audioBlob)
        stream.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }

      // Check for silence after 1.5 seconds
      setTimeout(() => {
        if (isSilent && isRecording) {
          setError('No microphone input detected. Check permissions or select another input device.')
          stopRecording()
        }
      }, 1500)

      // Start recording timer
      const startTime = Date.now()
      setRecordingStartedAt(startTime)
      setRecordingTime(0)
      
      // Get plan-based recording limit
      const getMaxRecordingSeconds = (): number => {
        if (canViewPremiumInsights(userPlan)) return 90 * 60 // 90:00 (Coach and Day Pass)
        if (userPlan === 'starter') return 30 * 60 // 30:00
        return 2 * 60 // 2:00 for free
      }
      const MAX_RECORDING_SECONDS = getMaxRecordingSeconds()
      
      // Start timer interval
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at plan limit
          if (newTime >= MAX_RECORDING_SECONDS) {
            stopRecording()
            return MAX_RECORDING_SECONDS
          }
          return newTime
        })
      }, 1000)

      // Use timeslice (3000ms) for stable long recordings
      const timesliceMs = 3000
      mediaRecorder.start(timesliceMs)
      setIsRecording(true)
      setIsSilent(false)
      silenceStartRef.current = null
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Failed to start recording. Please check microphone permissions.')
      stopMicLevelMeter()
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      stopMicLevelMeter()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
        streamRef.current = null
      }
      // Clear timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
        timerIntervalRef.current = null
      }
      setRecordingTime(0)
      setRecordingStartedAt(null)
    }
  }
  
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    localStorage.setItem('pitchpractice_selected_device_id', deviceId)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      handleSubmit(file)
    }
  }

  const handleSubmit = async (audioFile: File | Blob) => {
    if (!selectedRubric) {
      setError('Please select a rubric')
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      // Check file size before upload (Vercel limit is 4.5MB)
      const MAX_UPLOAD_SIZE = 4.5 * 1024 * 1024 // 4.5MB in bytes
      const fileSizeMB = audioFile.size / (1024 * 1024)
      
      if (audioFile.size > MAX_UPLOAD_SIZE) {
        setError(`File too large (${fileSizeMB.toFixed(2)} MB). Maximum upload size is 4.5 MB. Please record a shorter clip or compress the audio.`)
        setIsUploading(false)
        return
      }

      const sessionId = getSessionId()
      const formData = new FormData()
      
      // Convert Blob to File if needed - ensure correct extension based on mimeType
      let file: File
      if (audioFile instanceof File) {
        file = audioFile
      } else {
        // Determine extension from mimeType
        const mimeType = (audioFile as any).__mimeType || audioFile.type || 'audio/webm'
        let extension = 'webm'
        if (mimeType.includes('webm')) {
          extension = 'webm'
        } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
          extension = 'mp3'
        } else if (mimeType.includes('wav')) {
          extension = 'wav'
        } else if (mimeType.includes('ogg')) {
          extension = 'ogg'
        }
        
        file = new File([audioFile], `recording.${extension}`, { 
          type: mimeType
        })
      }
      
      formData.append('audio', file)
      formData.append('rubric_id', selectedRubric)
      formData.append('session_id', sessionId)
      if (title.trim()) {
        formData.append('title', title.trim())
      }

      const url = '/api/runs/create'
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      })

      // Log error if non-2xx
      if (!response.ok) {
        await logFetchError(url, response)
      }

      // Capture full response for error handling
      const responseText = await response.text()
      let data: any = null
      
      try {
        data = JSON.parse(responseText)
        
        // Handle 413 Payload Too Large error specifically
        if (response.status === 413 || data?.code === 'PAYLOAD_TOO_LARGE') {
          setError(`File too large (${fileSizeMB.toFixed(2)} MB). Maximum upload size is 4.5 MB. Please record a shorter clip or compress the audio.`)
          setIsUploading(false)
          return
        }
      } catch (e) {
        // Response might not be JSON
        console.warn('[Dashboard] Could not parse response as JSON:', responseText.substring(0, 200))
      }

      if (!response.ok) {
        const errorData = data || {}
        // Create a detailed error message with fix suggestion
        let errorMessage = errorData.error || 'Failed to create run'
        if (errorData.details) {
          errorMessage += `: ${errorData.details}`
        }
        if (errorData.fix) {
          errorMessage += `\n\n💡 Fix: ${errorData.fix}`
        }
        throw new Error(errorMessage)
      }

      // Handle different response formats (matching Try Free page)
      let runId: string | null = null

      if (data.ok === false) {
        throw new Error(data.error || 'Run creation failed')
      }

      if (data.runId) {
        runId = data.runId
      } else if (data.run?.id) {
        runId = data.run.id
      } else if (data.id) {
        // Fallback for old format
        runId = data.id
      } else {
        throw new Error(`Run creation failed: no run ID returned. Response: ${JSON.stringify(data)}`)
      }

      // Guard: NEVER navigate if runId is falsy
      if (!runId) {
        throw new Error(`Run creation failed: invalid response format. Response: ${JSON.stringify(data)}`)
      }

      // Only navigate if we have a valid runId
      router.push(`/runs/${runId}`)
    } catch (err) {
      console.error('[Fetch Error] Error submitting:', {
        url: '/api/runs/create',
        error: err,
      })
      setError(err instanceof Error ? err.message : 'Failed to submit pitch')
      setIsUploading(false)
    }
  }

  // Get plan display name
  let planDisplayName = 'Free';
  if (userPlan === 'starter') {
    planDisplayName = 'Starter';
  } else if (userPlan === 'coach') {
    planDisplayName = 'Coach';
  } else if (userPlan === 'daypass') {
    planDisplayName = 'Day Pass';
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] to-[#0F172A] py-12 px-4">
      <div className="max-w-[1100px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#E6E8EB] mb-2">
            Practice Your Pitch
          </h1>
          <p className="text-base text-[#9AA4B2] max-w-2xl mx-auto">
            Record or upload your pitch to get AI-powered feedback
          </p>
        </div>

        {error && (
          <Card className="mb-8 border-[#EF444430] bg-[#EF444420]">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-[#EF4444]" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[#EF4444] mb-1">Error</h3>
                <div className="text-sm text-[#E6E8EB] whitespace-pre-line">{error}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Optional Title Input and Plan Badge */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex-1">
            <label htmlFor="title" className="block text-sm font-medium text-[#9AA4B2] mb-2">
              Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Pitch Practice"
              className="w-full px-4 py-2 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 transition-colors bg-[rgba(255,255,255,0.03)] text-[#E6E8EB] placeholder:text-[#6B7280]"
              disabled={isUploading || isRecording}
            />
          </div>
          <div className="pt-7">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/20">
              {planDisplayName}
            </span>
          </div>
        </div>

        {/* 3-Step UI */}
        <div className="space-y-6">
          {/* Step 1: Choose Evaluation Criteria */}
          <Card>
            <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 1</span>
                </div>
                <h2 className="text-xl font-bold text-[#E6E8EB]">Choose Evaluation Criteria</h2>
                <p className="text-sm text-[#9AA4B2] mt-0.5">Select evaluation criteria (required)</p>
              </div>
            </div>
            <div>
              <select
                id="rubric"
                value={selectedRubric}
                onChange={(e) => setSelectedRubric(e.target.value)}
                className="w-full px-4 py-3 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 transition-colors bg-[rgba(255,255,255,0.03)] text-[#E6E8EB]"
                disabled={isUploading || isRecording || rubrics.length === 0}
              >
                {rubrics.length === 0 ? (
                  <option value="" className="bg-[#121826]">Loading rubrics...</option>
                ) : (
                  <>
                    <option value="" className="bg-[#121826]">Select a rubric...</option>
                    {rubrics.map((rubric) => (
                      <option key={rubric.id} value={rubric.id} className="bg-[#121826]">
                        {rubric.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {selectedRubric && rubrics.find(r => r.id === selectedRubric) && (
                <p className="mt-3 text-sm text-[#9AA4B2]">
                  {rubrics.find(r => r.id === selectedRubric)?.description}
                </p>
              )}
              {!selectedRubric && rubrics.length > 0 && (
                <p className="mt-2 text-xs text-[#9AA4B2] italic">
                  ⚠️ You must select a rubric before recording
                </p>
              )}
            </div>
          </Card>

          {/* Step 2: Record */}
          <Card>
            <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 2</span>
                </div>
                <h2 className="text-xl font-bold text-[#E6E8EB]">Record</h2>
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
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    disabled={isRecording || isUploading}
                    className="w-full px-3 py-2 text-sm border border-[rgba(255,255,255,0.08)] rounded-lg bg-[rgba(255,255,255,0.03)] text-[#E6E8EB] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 transition-colors"
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
              <Button
                onClick={testMicrophone}
                disabled={isRecording || isUploading}
                variant={isTestingMic ? 'danger' : 'secondary'}
                className="w-full"
              >
                {isTestingMic ? '⏹ Stop Test' : '🎤 Test Mic'}
              </Button>

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
                  
                  {/* Debug Info */}
                  <div className="text-xs text-[#6B7280] space-y-0.5">
                    {selectedDeviceId && audioDevices.find(d => d.deviceId === selectedDeviceId) && (
                      <div>Device: {audioDevices.find(d => d.deviceId === selectedDeviceId)?.label || 'Unknown'}</div>
                    )}
                    {(window as any).__currentTrackInfo && (window as any).__currentTrackInfo[0] && (
                      <>
                        <div>
                          Enabled: {(window as any).__currentTrackInfo[0].enabled ? '✓' : '✗'} | 
                          Muted: {(window as any).__currentTrackInfo[0].muted ? '✓' : '✗'} | 
                          State: {(window as any).__currentTrackInfo[0].readyState}
                        </div>
                      </>
                    )}
                    {(window as any).__micRawRMS !== undefined && (
                      <div>Raw RMS: {(window as any).__micRawRMS.toFixed(4)}</div>
                    )}
                  </div>
                  
                  {isSilent && (
                    <p className="text-xs text-[#EF4444] font-medium">
                      ⚠️ No microphone input detected
                    </p>
                  )}
                </div>
              )}

              {/* Troubleshooting Text */}
              <div className="pt-2 border-t border-[rgba(255,255,255,0.08)]">
                <p className="text-xs text-[#6B7280] leading-relaxed">
                  💡 <span className="font-medium text-[#9AA4B2]">Troubleshooting:</span> If the test fails, try restarting the page, reconnecting your Bluetooth device, and make sure Bluetooth is turned off on other nearby devices.
                </p>
              </div>

              {/* Recording Timer Display */}
              {isRecording && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 bg-[#151A23] rounded-lg border border-[#22283A]">
                    <span className="text-sm font-medium text-[#E6E8EB]">Recording</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono text-[#F59E0B]">
                        {formatTime(recordingTime)} / {(() => {
                          if (canViewPremiumInsights(userPlan)) return '90:00'
                          if (userPlan === 'starter') return '30:00'
                          return '2:00'
                        })()}
                      </span>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-[#9AA4B2]">
                      {canViewPremiumInsights(userPlan)
                        ? 'Up to 90 minutes per recording'
                        : userPlan === 'starter'
                        ? 'Up to 30 minutes per recording'
                        : 'Up to 2 minutes per recording'}
                    </p>
                  </div>
                </div>
              )}

              {/* Record/Upload Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isUploading || !selectedRubric || isSilent || (userPlan === 'starter' && recordingTime >= 30 * 60)}
                  variant={isRecording ? 'danger' : 'primary'}
                  className="flex-1"
                  title={!selectedRubric ? 'Please select a rubric in Step 1 first' : undefined}
                >
                  {isRecording ? '⏹ Stop Recording' : '🎤 Record'}
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isRecording || !selectedRubric}
                  variant="secondary"
                  className="flex-1"
                  title={!selectedRubric ? 'Please select a rubric in Step 1 first' : undefined}
                >
                  📁 Upload
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading || isRecording}
              />
              <p className="text-xs text-[#6B7280] italic">
                💡 Pro tip: Speak clearly and aim for 2–6 minutes for best results.
                {userPlan === 'starter' && (
                  <>
                    <span className="block mt-1">📏 Starter plan: up to 30 minutes per recording</span>
                    {recentRuns.length > 0 && (
                      <span className="block mt-1">Includes history (saved runs)</span>
                    )}
                  </>
                )}
              </p>
            </div>
          </Card>

          {/* Rubric Builder - Only for Coach + Day Pass */}
          {canViewPremiumInsights(userPlan) && (
            <Card>
              <div className="mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
                <h2 className="text-xl font-bold text-[#E6E8EB] mb-2">Your Evaluation Rubric</h2>
                <p className="text-sm text-[#9AA4B2]">
                  Tell us what you're pitching and who it's for. We'll tailor feedback to your goal.
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Pitch Context Input */}
                <div className="space-y-4">
                  <div>
                    <label htmlFor="pitch-context" className="block text-sm font-medium text-[#9AA4B2] mb-2">
                      Describe your pitch context
                    </label>
                    <textarea
                      id="pitch-context"
                      rows={8}
                      placeholder="• Audience: Investors, students, customers&#10;• Goal: Secure funding, explain concept, close sale&#10;• Time limit: 3-5 minutes&#10;• Tone: Formal, persuasive, academic"
                      className="w-full px-4 py-3 border border-[rgba(255,255,255,0.08)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30 transition-colors bg-[rgba(255,255,255,0.03)] text-[#E6E8EB] placeholder:text-[#6B7280] resize-none font-mono text-sm leading-relaxed"
                      disabled={isUploading || isRecording}
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="primary"
                      className="flex-1"
                      disabled={isUploading || isRecording}
                    >
                      Generate rubric
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={isUploading || isRecording}
                    >
                      Edit rubric
                    </Button>
                  </div>
                </div>

                {/* Right: Rubric Preview */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#9AA4B2] mb-3 uppercase tracking-wide">Generated Rubric Preview</h3>
                    <div className="p-4 bg-[#151A23] rounded-lg border border-[#22283A] space-y-3">
                      {/* Placeholder Criteria */}
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3 p-3 bg-[#121826] rounded border border-[#22283A]">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#E6E8EB] mb-1">Clarity & Structure</p>
                            <p className="text-xs text-[#9AA4B2]">How well the pitch is organized and easy to follow</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                            <span className="text-xs text-[#9AA4B2] ml-1">High</span>
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-3 p-3 bg-[#121826] rounded border border-[#22283A]">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#E6E8EB] mb-1">Persuasiveness</p>
                            <p className="text-xs text-[#9AA4B2]">Ability to convince and engage the audience</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                            <div className="w-2 h-2 rounded-full bg-[#6B7280]"></div>
                            <span className="text-xs text-[#9AA4B2] ml-1">Medium</span>
                          </div>
                        </div>
                        <div className="flex items-start justify-between gap-3 p-3 bg-[#121826] rounded border border-[#22283A]">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-[#E6E8EB] mb-1">Time Management</p>
                            <p className="text-xs text-[#9AA4B2]">Adherence to time limits and pacing</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-[#F59E0B]"></div>
                            <div className="w-2 h-2 rounded-full bg-[#6B7280]"></div>
                            <div className="w-2 h-2 rounded-full bg-[#6B7280]"></div>
                            <span className="text-xs text-[#9AA4B2] ml-1">Low</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-[#6B7280] italic pt-2 border-t border-[#22283A]">
                        Preview will update when you generate a rubric
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Locked State for Starter Users */}
          {userPlan === 'starter' && (
            <Card className="bg-[#22283A] border-[#22283A] opacity-75">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#151A23] mb-4">
                  <svg className="w-6 h-6 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-[#9AA4B2] mb-2">Custom rubrics are available on Coach</h3>
                <p className="text-sm text-[#6B7280] mb-4">
                  Upgrade to unlock the rubric builder and create custom evaluation criteria.
                </p>
                <Button variant="primary" size="sm" asChild>
                  <Link href="/upgrade?plan=coach">Upgrade to Coach</Link>
                </Button>
              </div>
            </Card>
          )}

          {/* Custom Rubric Section - Only for Coach + Day Pass */}
          {canViewPremiumInsights(userPlan) && (
            <Card>
              <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
                <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Custom Rubric</span>
                  </div>
                  <h2 className="text-xl font-bold text-[#E6E8EB]">Create Custom Rubric</h2>
                  <p className="text-sm text-[#9AA4B2] mt-0.5">Build your own evaluation criteria</p>
                </div>
              </div>
              <div>
                <Link href="/app/rubrics/new">
                  <Button variant="secondary" className="w-full">
                    Create Custom Rubric
                  </Button>
                </Link>
                <p className="mt-3 text-sm text-[#9AA4B2]">
                  Design a rubric tailored to your specific pitch type and goals.
                </p>
              </div>
            </Card>
          )}

          {/* Edit Rubric Before Recording - Only for Coach + Day Pass */}
          {canViewPremiumInsights(userPlan) && selectedRubric && (
            <Card>
              <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
                <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-[#E6E8EB]">Edit Rubric Before Recording</h2>
                  <p className="text-sm text-[#9AA4B2] mt-0.5">Customize your evaluation criteria</p>
                </div>
              </div>
              <div>
                <Link href={`/app/rubrics/${selectedRubric}`}>
                  <Button variant="secondary" className="w-full">
                    Edit Selected Rubric
                  </Button>
                </Link>
                <p className="mt-3 text-sm text-[#9AA4B2]">
                  Adjust criteria, weights, and targets before you record.
                </p>
              </div>
            </Card>
          )}

          {/* Upsell Card for Starter Users */}
          {userPlan === 'starter' && (
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
          )}

          {/* Step 3: Feedback */}
          <Card>
            <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 3</span>
                </div>
                <h2 className="text-xl font-bold text-[#E6E8EB]">Feedback</h2>
                <p className="text-sm text-[#9AA4B2] mt-0.5">Transcript + AI-powered feedback</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-[#9AA4B2]">
                Your pitch will be automatically transcribed and analyzed. You'll get detailed feedback on your delivery, structure, and pacing. Results will appear on the feedback page after recording.
              </p>
            </div>
          </Card>

          {isUploading && (
            <Card className="text-center">
              <LoadingSpinner size="lg" text="Uploading and processing..." />
            </Card>
          )}
          </div>

          {/* Recent Runs Sidebar - Only for Starter+ */}
          {userPlan !== 'free' && (
            <div className="lg:col-span-1">
              <Card>
                <div className="mb-4 pb-4 border-b border-[rgba(255,255,255,0.08)]">
                  <h2 className="text-lg font-bold text-[#E6E8EB]">Recent Runs</h2>
                  <p className="text-xs text-[#9AA4B2] mt-1">Your saved pitch practices</p>
                </div>
                
                {isLoadingRuns ? (
                  <div className="py-8 text-center">
                    <LoadingSpinner size="sm" text="Loading..." />
                  </div>
                ) : recentRuns.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[#9AA4B2]">No runs yet</p>
                    <p className="text-xs text-[#6B7280] mt-1">Record or upload a pitch to get started</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[600px] overflow-y-auto">
                    {recentRuns.map((run) => {
                      const duration = run.duration_ms 
                        ? run.duration_ms / 1000 
                        : run.audio_seconds
                      return (
                        <button
                          key={run.id}
                          onClick={() => handleRunClick(run.id)}
                          className="w-full text-left p-3 rounded-lg border border-[rgba(255,255,255,0.08)] hover:border-[#F59E0B]/30 hover:bg-[rgba(245,158,11,0.05)] transition-colors group"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h3 className="text-sm font-medium text-[#E6E8EB] group-hover:text-[#F59E0B] transition-colors truncate flex-1">
                              {run.title || 'Untitled Pitch'}
                            </h3>
                            <span className={`text-xs font-medium ${getStatusColor(run.status)} flex-shrink-0`}>
                              {run.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-[#9AA4B2]">
                            <span>{formatDate(run.created_at)}</span>
                            {duration && (
                              <>
                                <span>•</span>
                                <span>{formatTime(duration)}</span>
                              </>
                            )}
                            {run.word_count && (
                              <>
                                <span>•</span>
                                <span>{run.word_count} words</span>
                              </>
                            )}
                          </div>
                          {run.rubrics && (
                            <div className="mt-1 text-xs text-[#6B7280] truncate">
                              {run.rubrics.name}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

