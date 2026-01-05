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
  duration_ms: number | null
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
  const [isGettingFeedback, setIsGettingFeedback] = useState(false) // UI shows "Get feedback" / "Generating feedback..."
  const [recordingStartedAt, setRecordingStartedAt] = useState<number | null>(null)
  const [pausedTotalMs, setPausedTotalMs] = useState(0)
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null)
  const [durationMs, setDurationMs] = useState<number | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [rubrics, setRubrics] = useState<any[]>([])
  const [selectedRubricId, setSelectedRubricId] = useState<string>('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [currentTrackInfo, setCurrentTrackInfo] = useState<any>(null)
  const [chunkInfo, setChunkInfo] = useState<{ count: number; sizes: number[]; totalSize: number } | null>(null)
  const [isTestingMic, setIsTestingMic] = useState(false)
  const [isSilent, setIsSilent] = useState(false)
  const [hasMicPermission, setHasMicPermission] = useState(false)
  const [lastError, setLastError] = useState<any>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const chunkSizesRef = useRef<number[]>([])
  const silenceStartRef = useRef<number | null>(null)
  const testAudioRef = useRef<HTMLAudioElement | null>(null)

  // Fetch rubrics and enumerate audio devices on mount
  useEffect(() => {
    // Reset any stale state on mount
    setRun(null)
    setIsTranscribing(false)
    setIsGettingFeedback(false)
    setError(null)

    fetch('/api/rubrics')
      .then(res => res.json())
      .then(data => {
        setRubrics(data)
        if (data.length > 0) {
          setSelectedRubricId(data[0].id)
        }
      })
      .catch(err => console.error('Failed to fetch rubrics:', err))

    // Load saved device ID
    const savedDeviceId = localStorage.getItem('pitchpractice_selected_device_id')
    if (savedDeviceId) {
      setSelectedDeviceId(savedDeviceId)
    }

    // Enumerate audio devices
    enumerateAudioDevices()
  }, [])

  // Enumerate audio input devices
  const enumerateAudioDevices = async () => {
    try {
      // Request permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setHasMicPermission(true)
      stream.getTracks().forEach(track => track.stop()) // Stop immediately, just checking permission
      
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
      
      if (DEBUG) {
        console.log('[Try] Audio devices:', audioInputs.map(d => ({ id: d.deviceId, label: d.label })))
      }
    } catch (err) {
      console.error('[Try] Failed to enumerate devices:', err)
      setHasMicPermission(false)
    }
  }

  // Setup mic level meter (from working /app implementation)
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
        
        // Check for silence
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
        
        // Store raw RMS for debugging
        ;(window as any).__micRawRMS = rms
        
        // Update at ~30fps
        animationFrameRef.current = requestAnimationFrame(measureLevel)
      }
      
      measureLevel()
    } catch (err) {
      console.error('[Try] Failed to setup mic level meter:', err)
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

  // Test microphone (from working /app implementation)
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
      setHasMicPermission(true)
      
      // Log stream details
      const tracks = stream.getAudioTracks()
      const trackInfo = tracks.map(track => ({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
      }))
      setCurrentTrackInfo(trackInfo[0] || null)
      
      if (DEBUG) {
        console.log('[Try] Mic test stream tracks:', trackInfo)
      }
      
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
      console.error('[Try] Error testing microphone:', err)
      setError('Failed to access microphone. Check permissions.')
      setIsTestingMic(false)
      setHasMicPermission(false)
    }
  }

  // Format time as MM:SS or SS (if < 60 seconds)
  const formatTime = (seconds: number) => {
    if (seconds < 60) {
      return `0:${Math.floor(seconds).toString().padStart(2, '0')}`
    }
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Calculate WPM from transcript and duration
  const calculateWPM = (transcript: string | null, durationSeconds: number | null): number | null => {
    if (!transcript || !durationSeconds || durationSeconds < 3) {
      return null // Too short to estimate
    }
    const words = transcript.trim().split(/\s+/).filter(w => w.length > 0).length
    const wpm = Math.round(words / (durationSeconds / 60))
    return wpm
  }

  // Get WPM interpretation
  const getWPMInterpretation = (wpm: number | null): string => {
    if (wpm === null) return 'Too short to estimate'
    if (wpm < 110) return 'Slow/clear'
    if (wpm <= 160) return 'Normal'
    if (wpm <= 190) return 'Fast'
    return 'Very fast'
  }

  // Start recording (using working /app implementation)
  const startRecording = async () => {
    if (isSilent) {
      setError('No microphone input detected. Check permissions or select another input device.')
      return
    }

    try {
      if (DEBUG) {
        console.log('[Try] Starting recording...', { selectedDeviceId })
      }

      // Stop test mic if active
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

      // Request stream with selected device
      const constraints: MediaStreamConstraints = selectedDeviceId
        ? { audio: { deviceId: { exact: selectedDeviceId } } }
        : { audio: true }
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      setHasMicPermission(true)
      
      // Log stream details for debugging
      const tracks = stream.getAudioTracks()
      const trackInfo = tracks.map(track => ({
        label: track.label,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
        settings: track.getSettings(),
      }))
      setCurrentTrackInfo(trackInfo[0] || null)
      
      if (DEBUG) {
        console.log('[Try] Recording stream tracks:', trackInfo)
      }
      
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

      if (DEBUG) {
        console.log('[Try] Using mimeType:', mimeType)
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      chunkSizesRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
          chunkSizesRef.current.push(event.data.size)
          if (DEBUG) {
            console.log('[Try] Chunk received:', {
              size: event.data.size,
              type: event.data.type,
              totalChunks: audioChunksRef.current.length,
            })
          }
        }
      }

      mediaRecorder.onstop = async () => {
        stopMicLevelMeter()
        
        // Calculate accurate duration_ms
        const stopTime = Date.now()
        let finalPausedTotal = pausedTotalMs
        if (pauseStartTime) {
          // If still paused, add the current pause duration
          finalPausedTotal += stopTime - pauseStartTime
        }
        const calculatedDurationMs = recordingStartedAt 
          ? stopTime - recordingStartedAt - finalPausedTotal
          : null
        
        if (DEBUG) {
          console.log('[Try] Recording stopped - duration calculation:', {
            recordingStartedAt,
            stopTime,
            pausedTotalMs: finalPausedTotal,
            calculatedDurationMs,
            calculatedDurationSeconds: calculatedDurationMs ? (calculatedDurationMs / 1000).toFixed(2) : null,
          })
        }
        
        // Store duration_ms in state immediately
        if (calculatedDurationMs !== null && calculatedDurationMs > 0) {
          setDurationMs(calculatedDurationMs)
        }
        
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        const actualMimeType = mediaRecorder.mimeType || mimeType
        
        if (DEBUG) {
          console.log('[Try] Recording stopped:', {
            totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            chunkSizes: chunkSizesRef.current,
            mimeType: actualMimeType,
            durationMs: calculatedDurationMs,
          })
        }

        setChunkInfo({
          count: audioChunksRef.current.length,
          sizes: chunkSizesRef.current,
          totalSize,
        })
        
        // Validate recording is not empty (client-side check)
        if (totalSize < 5 * 1024) { // Less than 5KB
          setError('Recording was empty—check mic permissions.')
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          return
        }
        
        // Create blob with the actual mimeType used
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: actualMimeType
        })
        
        // Store mimeType and duration_ms for upload
        ;(audioBlob as any).__mimeType = actualMimeType
        if (calculatedDurationMs !== null) {
          ;(audioBlob as any).__durationMs = calculatedDurationMs
        }
        
        // Upload audio
        await uploadAudio(audioBlob, 'recording.webm')
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

      mediaRecorder.start()
      setIsRecording(true)
      setIsPaused(false)
      setIsSilent(false)
      silenceStartRef.current = null
      setRecordingTime(0)
      
      // Track recording start time for accurate duration calculation
      const startTime = Date.now()
      setRecordingStartedAt(startTime)
      setPausedTotalMs(0)
      setPauseStartTime(null)

      // Start timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } catch (err) {
      console.error('[Try] Error starting recording:', err)
      setError('Failed to start recording. Please check microphone permissions.')
      stopMicLevelMeter()
    }
  }

  // Pause recording
  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording && !isPaused) {
      mediaRecorderRef.current.pause()
      setIsPaused(true)
      setPauseStartTime(Date.now())
    }
  }

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused && pauseStartTime) {
      mediaRecorderRef.current.resume()
      const pauseDuration = Date.now() - pauseStartTime
      setPausedTotalMs(prev => prev + pauseDuration)
      setPauseStartTime(null)
      setIsPaused(false)
    }
  }

  // Stop recording (from working /app implementation)
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // If paused, add current pause duration before stopping
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
      // Note: Don't stop stream here - let onstop callback handle it after duration calculation
    }
  }

  // Get duration from audio file using HTMLAudioElement
  const getAudioDuration = (file: File): Promise<number | null> => {
    return new Promise((resolve) => {
      const audio = document.createElement('audio')
      const url = URL.createObjectURL(file)
      audio.src = url
      
      audio.addEventListener('loadedmetadata', () => {
        const duration = audio.duration
        URL.revokeObjectURL(url)
        if (isFinite(duration) && duration > 0) {
          resolve(Math.round(duration * 1000)) // Return in milliseconds
        } else {
          resolve(null)
        }
      })
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url)
        resolve(null)
      })
      
      // Timeout after 5 seconds
      setTimeout(() => {
        URL.revokeObjectURL(url)
        resolve(null)
      }, 5000)
    })
  }

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    // Try to get duration from file metadata
    const fileDurationMs = await getAudioDuration(file)
    if (fileDurationMs !== null && fileDurationMs > 0) {
      setDurationMs(fileDurationMs)
      if (DEBUG) {
        console.log('[Try] File duration from metadata:', {
          fileName: file.name,
          durationMs: fileDurationMs,
          durationSeconds: (fileDurationMs / 1000).toFixed(2),
        })
      }
    } else {
      if (DEBUG) {
        console.warn('[Try] Could not get duration from file metadata:', file.name)
      }
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
        setError('Please wait for rubrics to load')
        setIsUploading(false)
        return
      }

      // Get duration_ms from blob if available (from recording)
      const blobDurationMs = (audioBlob as any).__durationMs || null
      const uploadDurationMs = blobDurationMs || durationMs || null
      const durationSeconds = uploadDurationMs ? uploadDurationMs / 1000 : null

      if (DEBUG) {
        console.log('[Try] Uploading audio:', {
          fileName,
          size: audioBlob.size,
          type: audioBlob.type,
          durationMs: uploadDurationMs,
          durationSeconds,
          fromBlob: !!blobDurationMs,
          fromState: !!durationMs,
        })
      }

      const formData = new FormData()
      formData.append('audio', audioBlob, fileName)
      formData.append('session_id', sessionId)
      formData.append('rubric_id', selectedRubricId)
      if (selectedPrompt) {
        formData.append('title', PROMPTS.find(p => p.id === selectedPrompt)?.title || '')
      }
      if (uploadDurationMs !== null && uploadDurationMs > 0) {
        formData.append('duration_ms', uploadDurationMs.toString())
      }

      const response = await fetch('/api/runs/create', {
        method: 'POST',
        body: formData,
      })

      // Capture full response for error handling
      const responseText = await response.text()
      let data: any = null
      let errorData: any = null
      
      try {
        data = JSON.parse(responseText)
      } catch (e) {
        // Response might not be JSON
        if (DEBUG) {
          console.warn('[Try] Could not parse response as JSON:', responseText.substring(0, 200))
        }
      }

      if (!response.ok) {
        errorData = data
        const errorMessage = errorData?.error || 'Upload failed'
        const errorDetails = errorData?.details ? ` Details: ${errorData.details}` : ''
        const errorFix = errorData?.fix ? ` Fix: ${errorData.fix}` : ''
        const fullError = {
          status: response.status,
          statusText: response.statusText,
          error: errorData?.error || 'Unknown error',
          details: errorData?.details || null,
          fix: errorData?.fix || null,
          code: errorData?.code || null,
          fullResponse: errorData,
          responseText: responseText.substring(0, 1000),
        }
        
        setLastError(fullError)
        
        if (DEBUG) {
          console.error('[Try] Create run failed:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            responseText: responseText.substring(0, 500),
          })
        }
        
        throw new Error(`${errorMessage}${errorDetails}${errorFix}`)
      }

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
        console.error('[Try] Upload failed:', {
          error: err,
          message: err.message,
          lastError,
        })
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
      
      // Auto-start feedback generation if transcript exists
      if (data.transcript && data.transcript.length > 0) {
        setIsTranscribing(false)
        setIsGettingFeedback(true) // UI will show "Generating feedback..."
        await getFeedback(runId)
      } else {
        setIsTranscribing(false)
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
      if (DEBUG) {
        console.log('[Try] Starting feedback generation:', { runId, rubricId: selectedRubricId })
      }

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
        
        if (DEBUG) {
          console.error('[Try] Feedback generation failed:', {
            status: response.status,
            statusText: response.statusText,
            errorData,
            runId,
          })
        }
        
        // Show detailed error message
        const errorMsg = errorData.error || errorData.message || 'Feedback generation failed'
        const details = errorData.details ? ` Details: ${errorData.details}` : ''
        const fieldsChecked = errorData.fieldsChecked ? ` Fields checked: ${errorData.fieldsChecked.join(', ')}` : ''
        throw new Error(`${errorMsg}${details}${fieldsChecked}`)
      }

      if (DEBUG) {
        console.log('[Try] Feedback generation complete:', { runId })
      }

      await fetchRun(runId)
      setIsGettingFeedback(false)
    } catch (err: any) {
      setError(err.message || 'Feedback generation failed')
      setIsGettingFeedback(false)
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

  // Poll for run updates during transcription/feedback generation
  useEffect(() => {
    if (!run?.id || (!isTranscribing && !isGettingFeedback)) return

    const runId = run.id // Capture run.id to avoid stale closure
    const interval = setInterval(() => {
      if (runId) {
        fetchRun(runId)
      }
    }, 2000)

    return () => clearInterval(interval)
  }, [run?.id, isTranscribing, isGettingFeedback])

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
    setIsGettingFeedback(false)
    setError(null)
    setMicLevel(0)
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
                    {/* Device selection */}
                    {audioDevices.length > 1 && (
                      <div className="text-sm">
                        <label className="block text-[#9AA4B2] mb-1">Mic input</label>
                        <select
                          value={selectedDeviceId}
                          onChange={(e) => {
                            setSelectedDeviceId(e.target.value)
                            localStorage.setItem('pitchpractice_selected_device_id', e.target.value)
                          }}
                          className="w-full px-3 py-2 bg-[#0B0F14] border border-[#22283A] rounded-lg text-[#E6E8EB] text-sm"
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

                    {/* Test Mic Button */}
                    {!hasMicPermission && !isRecording && !run && (
                      <div className="text-center p-4 bg-[#0B0F14] border border-[#22283A] rounded-lg">
                        <p className="text-sm text-[#9AA4B2] mb-3">Enable microphone to see input level</p>
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

                    {/* Mic Level Meter - visible when testing or recording */}
                    {(isRecording || isTestingMic) && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-4 bg-[#0B0F14] rounded-full overflow-hidden">
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

                    {!isRecording && !run && (
                      <div className="space-y-3">
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={startRecording}
                          className="w-full"
                          disabled={!selectedPrompt || isSilent}
                        >
                          <Mic className="mr-2 h-5 w-5" />
                          Start recording
                        </Button>
                        {!isTestingMic && hasMicPermission && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={testMicrophone}
                            className="w-full"
                          >
                            🎤 Test Mic
                          </Button>
                        )}
                      </div>
                    )}

                    {isRecording && (
                      <div className="space-y-4">
                        {/* Timer */}
                        <div className="text-center">
                          <div className="text-3xl font-bold text-[#E6E8EB] mb-2">
                            {formatTime(recordingTime)}
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

                    {isGettingFeedback && (
                      <div className="text-center py-4">
                        <LoadingSpinner size="md" text="Generating feedback..." />
                      </div>
                    )}

                    {/* Get feedback button (shown when transcript exists but no feedback yet) */}
                    {run && run.transcript && !run.analysis_json && !isTranscribing && !isGettingFeedback && (
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
                        Get feedback
                      </Button>
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
                {run.transcript && (
                  <Card className="p-4 bg-[#121826] border-[#22283A]">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">Duration</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {(() => {
                            // Use duration_ms as source of truth, fallback to audio_seconds, then state
                            const durationSec = run.duration_ms 
                              ? run.duration_ms / 1000 
                              : (run.audio_seconds || (durationMs ? durationMs / 1000 : null))
                            return durationSec ? formatTime(durationSec) : '—'
                          })()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">Words</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {run.word_count || (run.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : null) || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#6B7280] mb-1">WPM</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {(() => {
                            // Use duration_ms as source of truth for WPM calculation
                            const durationSec = run.duration_ms 
                              ? run.duration_ms / 1000 
                              : (run.audio_seconds || (durationMs ? durationMs / 1000 : null))
                            const wpm = run.words_per_minute || calculateWPM(run.transcript, durationSec)
                            return wpm !== null ? wpm : '—'
                          })()}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      // Use duration_ms as source of truth for WPM interpretation
                      const durationSec = run.duration_ms 
                        ? run.duration_ms / 1000 
                        : (run.audio_seconds || (durationMs ? durationMs / 1000 : null))
                      const wpm = run.words_per_minute || calculateWPM(run.transcript, durationSec)
                      return wpm !== null ? (
                        <p className="text-xs text-[#9AA4B2] text-center mt-3">
                          {getWPMInterpretation(wpm)}
                        </p>
                      ) : null
                    })()}
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

                {/* Feedback Summary */}
                {run.analysis_json && (
                  <Card className="p-6 bg-[#121826] border-[#22283A]">
                    <h3 className="text-lg font-bold text-[#E6E8EB] mb-4">Feedback Summary</h3>
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>Active Run ID:</div>
                    <div className="font-mono">{run?.id || 'none'}</div>
                    <div>DB Status:</div>
                    <div>{run?.status || 'none'}</div>
                    <div>UI Status:</div>
                    <div>{isRecording ? 'recording' : isUploading ? 'uploading' : isTranscribing ? 'transcribing' : isGettingFeedback ? 'getting feedback' : run ? 'ready' : 'idle'}</div>
                    <div>Is Recording:</div>
                    <div>{isRecording ? 'yes' : 'no'}</div>
                    <div>Is Uploading:</div>
                    <div>{isUploading ? 'yes' : 'no'}</div>
                    <div>Is Transcribing:</div>
                    <div>{isTranscribing ? 'yes' : 'no'}</div>
                    <div>Is Getting Feedback:</div>
                    <div>{isGettingFeedback ? 'yes' : 'no'}</div>
                    <div>Duration (ms):</div>
                    <div>{durationMs !== null ? durationMs : (run && run.duration_ms !== null) ? run.duration_ms : '—'}</div>
                    <div>Duration (DB):</div>
                    <div>{(run && run.duration_ms !== null) ? `${run.duration_ms}ms (${(run.duration_ms / 1000).toFixed(2)}s)` : '—'}</div>
                    <div>Words (computed):</div>
                    <div>{run?.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : '—'}</div>
                    <div>WPM (computed):</div>
                    <div>{(() => {
                      const durationSec = run?.duration_ms ? run.duration_ms / 1000 : (run?.audio_seconds || null)
                      const wpm = calculateWPM(run?.transcript || null, durationSec)
                      return wpm !== null ? `${wpm} (${getWPMInterpretation(wpm)})` : '—'
                    })()}</div>
                    <div>Feedback Status:</div>
                    <div>{run?.analysis_json ? 'ready' : isGettingFeedback ? 'generating' : run?.transcript ? 'pending' : 'none'}</div>
                    <div>Transcription Start:</div>
                    <div>{isTranscribing ? 'in progress' : run?.transcript ? 'completed' : 'not started'}</div>
                    <div>Transcription End:</div>
                    <div>{run?.transcript ? 'completed' : 'not completed'}</div>
                    <div>Has Stream:</div>
                    <div>{streamRef.current ? 'yes' : 'no'}</div>
                    <div>Meter Visible:</div>
                    <div>{(isRecording || isTestingMic) ? 'yes' : 'no'}</div>
                    <div>Has Mic Permission:</div>
                    <div>{hasMicPermission ? 'yes' : 'no'}</div>
                    <div>Selected Rubric:</div>
                    <div>{selectedRubricId || 'none'}</div>
                  </div>
                  {lastError && (
                    <div className="mt-2 pt-2 border-t border-[#22283A]">
                      <div className="font-semibold text-[#E6E8EB] mb-1">Last Error:</div>
                      <div className="text-xs space-y-1">
                        <div>Status: {lastError.status} {lastError.statusText}</div>
                        <div>Error: {lastError.error}</div>
                        {lastError.details && <div>Details: {lastError.details}</div>}
                        {lastError.fix && <div>Fix: {lastError.fix}</div>}
                        {lastError.code && <div>Code: {lastError.code}</div>}
                      </div>
                      <pre className="mt-2 p-2 bg-[#0B0F14] rounded text-xs overflow-auto max-h-40 font-mono text-[#E6E8EB]">
                        {JSON.stringify(lastError.fullResponse || lastError, null, 2)}
                      </pre>
                    </div>
                  )}
                  {currentTrackInfo && (
                    <div className="mt-2 pt-2 border-t border-[#22283A]">
                      <div className="font-semibold text-[#E6E8EB] mb-1">Current Track:</div>
                      <div>Label: {currentTrackInfo.label || 'unknown'}</div>
                      <div>ReadyState: {currentTrackInfo.readyState}</div>
                      <div>Enabled: {currentTrackInfo.enabled ? 'yes' : 'no'}</div>
                      <div>Device ID: {currentTrackInfo.settings?.deviceId?.substring(0, 20) || 'none'}</div>
                    </div>
                  )}
                  {chunkInfo && (
                    <div className="mt-2 pt-2 border-t border-[#22283A]">
                      <div className="font-semibold text-[#E6E8EB] mb-1">Last Recording:</div>
                      <div>Chunks: {chunkInfo.count}</div>
                      <div>Total Size: {(chunkInfo.totalSize / 1024).toFixed(2)} KB</div>
                      <div>Chunk Sizes: {chunkInfo.sizes.map(s => `${(s / 1024).toFixed(1)}KB`).join(', ')}</div>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-[#22283A]">
                    <div className="font-semibold text-[#E6E8EB] mb-1">Available Devices:</div>
                    {audioDevices.map((device, idx) => (
                      <div key={device.deviceId} className="text-xs">
                        {idx + 1}. {device.label || device.deviceId.substring(0, 20)}
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      try {
                        setLastError(null)
                        const sessionId = getSessionId()
                        const formData = new FormData()
                        // Create a dummy audio blob for testing (8KB minimum)
                        const dummyData = new Uint8Array(8 * 1024).fill(0)
                        const dummyBlob = new Blob([dummyData], { type: 'audio/webm' })
                        formData.append('audio', dummyBlob, 'test.webm')
                        formData.append('session_id', sessionId)
                        if (selectedRubricId) {
                          formData.append('rubric_id', selectedRubricId)
                        }
                        formData.append('title', 'Test Run')
                        formData.append('duration_ms', '6000') // 6 seconds

                        const response = await fetch('/api/runs/create', {
                          method: 'POST',
                          body: formData,
                        })

                        // Capture full response
                        let responseText = ''
                        let data: any = null
                        
                        try {
                          responseText = await response.text()
                          if (responseText) {
                            data = JSON.parse(responseText)
                          }
                        } catch (e) {
                          console.warn('[Try] Could not parse response as JSON:', responseText)
                        }

                        if (!response.ok) {
                          const fullError = {
                            status: response.status,
                            statusText: response.statusText,
                            error: data?.error || 'Unknown error',
                            details: data?.details || null,
                            fix: data?.fix || null,
                            code: data?.code || null,
                            fullResponse: data,
                            responseText,
                          }
                          setLastError(fullError)
                          console.error('[Try] Test run creation failed:', fullError)
                          alert(`Test failed: ${data?.error || 'Unknown error'}\n\nSee debug panel for full error details.`)
                        } else {
                          console.log('[Try] Test run creation response:', data)
                          alert(`Test succeeded!\n\nRun ID: ${data.runId || data.run?.id}\nStatus: ${data.run?.status}\n\nSee console for full response.`)
                          if (data.runId) {
                            setRun({ ...data.run, audio_url: null })
                          }
                        }
                      } catch (err: any) {
                        const fullError = {
                          error: err.message || 'Unknown error',
                          details: err.stack || null,
                          fullResponse: err,
                        }
                        setLastError(fullError)
                        console.error('[Try] Test run creation failed:', err)
                        alert(`Error: ${err.message}\n\nSee debug panel for full error details.`)
                      }
                    }}
                    className="mt-2"
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

