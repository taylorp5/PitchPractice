'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { CheckCircle2, Clock, Scissors, Mic, Upload, Play, Pause, Square, ChevronDown, ChevronUp, AlertCircle, X } from 'lucide-react'
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

interface Feedback {
  summary?: {
    overall_score?: number
    overall_notes?: string
    top_strengths?: string[]
    top_improvements?: string[]
  }
  [key: string]: any
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
    rubric: [
      { id: 'what', label: 'What are you working on?', weight: 1.0 },
      { id: 'who', label: 'Who is it for?', weight: 1.0 },
      { id: 'why', label: 'Why does it matter?', weight: 1.5 },
      { id: 'cta', label: 'Call to action', weight: 0.5, optional: true },
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
    rubric: [
      { id: 'hook', label: 'Hook your audience', weight: 1.5 },
      { id: 'main_point', label: 'State your main point', weight: 1.5 },
      { id: 'preview', label: 'Preview what\'s coming', weight: 1.0 },
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
    rubric: [
      { id: 'problem', label: 'Identify the problem', weight: 1.5 },
      { id: 'solution', label: 'Present your solution', weight: 1.5 },
      { id: 'value', label: 'Show the value', weight: 1.0 },
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
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set())
  const [pinnedSentenceIdx, setPinnedSentenceIdx] = useState<number | null>(null)
  const [highlightedCriterion, setHighlightedCriterion] = useState<string | null>(null)
  const [expandedRewrites, setExpandedRewrites] = useState<Set<number>>(new Set())
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
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lastFeedbackResponse, setLastFeedbackResponse] = useState<any>(null)
  const [debugPanelOpen, setDebugPanelOpen] = useState(false)

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

  // Calculate WPM from transcript and duration_ms
  const calculateWPM = (transcript: string | null, durationMs: number | null): number | null => {
    if (!transcript || !durationMs || durationMs < 5000) {
      return null // Too short to estimate (minimum 5 seconds = 5000ms)
    }
    const words = transcript.trim().split(/\s+/).filter(w => w.length > 0).length
    // WPM = word_count / (duration_ms / 60000)
    const wpm = Math.round(words / (durationMs / 60000))
    return wpm
  }

  // Split transcript into sentences
  const splitIntoSentences = (text: string): string[] => {
    if (!text) return []
    // Split by sentence endings, but preserve the punctuation
    const sentences = text
      .split(/([.!?]+[\s\n]+)/)
      .filter(s => s.trim().length > 0)
      .map(s => s.trim())
    
    // Merge punctuation back with previous sentence
    const merged: string[] = []
    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].match(/^[.!?]+$/)) {
        // This is just punctuation, merge with previous
        if (merged.length > 0) {
          merged[merged.length - 1] += sentences[i]
        }
      } else {
        merged.push(sentences[i])
      }
    }
    
    return merged.filter(s => s.length > 0)
  }

  // Map chunks to sentences for feedback
  const createSentenceFeedbackMap = (transcript: string, chunks: any[]): Map<number, any> => {
    const sentences = splitIntoSentences(transcript)
    const feedbackMap = new Map<number, any>()
    
    sentences.forEach((sentence, idx) => {
      // Find best matching chunk
      let bestMatch: any = null
      let bestScore = 0
      
      chunks.forEach(chunk => {
        const chunkText = chunk.text || ''
        const sentenceLower = sentence.toLowerCase().trim()
        const chunkLower = chunkText.toLowerCase().trim()
        
        // Exact substring match
        if (chunkLower.includes(sentenceLower) || sentenceLower.includes(chunkLower)) {
          const score = Math.min(sentenceLower.length, chunkLower.length) / Math.max(sentenceLower.length, chunkLower.length)
          if (score > bestScore) {
            bestScore = score
            bestMatch = chunk
          }
        }
      })
      
      if (bestMatch) {
        feedbackMap.set(idx, {
          purpose_label: bestMatch.purpose_label || bestMatch.purpose || 'General',
          score: bestMatch.score,
          status: bestMatch.status || (bestMatch.score !== null && bestMatch.score >= 7 ? 'strong' : bestMatch.score !== null && bestMatch.score >= 4 ? 'needs_work' : 'unscored'),
          why: bestMatch.feedback || '',
          suggestion: bestMatch.rewrite_suggestion ? `Try: ${bestMatch.rewrite_suggestion}` : '',
          rewrite: bestMatch.rewrite_suggestion || null,
        })
      } else {
        // No match - default to unscored
        feedbackMap.set(idx, {
          purpose_label: 'General',
          score: null,
          status: 'unscored',
          why: 'No specific coaching for this line yet.',
          suggestion: '',
          rewrite: null,
        })
      }
    })
    
    return feedbackMap
  }

  // Group sentences into paragraphs
  const groupSentencesIntoParagraphs = (sentences: string[], feedbackMap: Map<number, any>): string[][] => {
    const paragraphs: string[][] = []
    let currentParagraph: string[] = []
    let lastPurpose: string | null = null
    
    sentences.forEach((sentence, idx) => {
      const feedback = feedbackMap.get(idx)
      const currentPurpose = feedback?.purpose_label || 'General'
      
      // Start new paragraph if:
      // 1. Purpose changed
      // 2. Current paragraph has 2-3 sentences
      if (
        (lastPurpose && lastPurpose !== currentPurpose) ||
        (currentParagraph.length >= 3)
      ) {
        if (currentParagraph.length > 0) {
          paragraphs.push(currentParagraph)
          currentParagraph = []
        }
      }
      
      currentParagraph.push(sentence)
      lastPurpose = currentPurpose
    })
    
    if (currentParagraph.length > 0) {
      paragraphs.push(currentParagraph)
    }
    
    return paragraphs
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
        
        const totalSize = audioChunksRef.current.reduce((sum, chunk) => sum + chunk.size, 0)
        const actualMimeType = mediaRecorder.mimeType || mimeType
        
        if (DEBUG) {
          console.log('[Try] Recording stopped:', {
            totalSize,
            totalSizeKB: (totalSize / 1024).toFixed(2),
            chunkSizes: chunkSizesRef.current,
            mimeType: actualMimeType,
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
        
        // Compute exact duration from audio blob using Web Audio API
        let calculatedDurationMs: number | null = null
        let isEstimated = false
        
        try {
          const arrayBuffer = await audioBlob.arrayBuffer()
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
          calculatedDurationMs = Math.round(audioBuffer.duration * 1000)
          
          if (DEBUG) {
            console.log('[Try] Duration computed from audio blob:', {
              durationSeconds: audioBuffer.duration,
              durationMs: calculatedDurationMs,
              sampleRate: audioBuffer.sampleRate,
              numberOfChannels: audioBuffer.numberOfChannels,
              length: audioBuffer.length,
            })
          }
          
          audioContext.close()
        } catch (decodeError) {
          // Fallback to timer-based calculation if decode fails
          console.warn('[Try] Failed to decode audio for duration, using timer fallback:', decodeError)
          isEstimated = true
          
          const stopTime = Date.now()
          let finalPausedTotal = pausedTotalMs
          if (pauseStartTime) {
            // If still paused, add the current pause duration
            finalPausedTotal += stopTime - pauseStartTime
          }
          calculatedDurationMs = recordingStartedAt 
            ? stopTime - recordingStartedAt - finalPausedTotal
            : null
          
          if (DEBUG) {
            console.log('[Try] Using timer-based duration (estimated):', {
              recordingStartedAt,
              stopTime,
              pausedTotalMs: finalPausedTotal,
              calculatedDurationMs,
              isEstimated: true,
            })
          }
        }
        
        // Store duration_ms in state immediately
        if (calculatedDurationMs !== null && calculatedDurationMs > 0) {
          setDurationMs(calculatedDurationMs)
        }
        
        // Store mimeType and duration_ms for upload
        ;(audioBlob as any).__mimeType = actualMimeType
        if (calculatedDurationMs !== null) {
          ;(audioBlob as any).__durationMs = calculatedDurationMs
          ;(audioBlob as any).__isEstimated = isEstimated
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

      // Ensure duration_ms is set in run data if we have it
      if (uploadDurationMs !== null && uploadDurationMs > 0) {
        runData.duration_ms = uploadDurationMs
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
          transcriptLen: data.transcript?.length || 0,
          hasRun: !!data.run,
          runStatus: data.run?.status,
        })
      }
      
      // Update run state immediately from response
      if (data.ok && data.run) {
        setRun({ ...data.run, audio_url: run?.audio_url || null })
        if (DEBUG) {
          console.log('[Try] Run state updated from transcribe response:', {
            runId: data.run.id,
            status: data.run.status,
            hasTranscript: !!data.run.transcript,
            transcriptLen: data.run.transcript?.length || 0,
          })
        }
      } else {
        // Fallback: fetch if response doesn't include run
        await fetchRun(runId)
      }
      
      setIsTranscribing(false)
      
      // Auto-start feedback generation if transcript exists
      if (data.run?.transcript && data.run.transcript.length > 0) {
        setIsGettingFeedback(true) // UI will show "Evaluating..."
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

    // Get prompt rubric if a prompt is selected
    const promptRubric = selectedPrompt 
      ? PROMPTS.find(p => p.id === selectedPrompt)?.rubric || null
      : null

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
          prompt_rubric: promptRubric,
        }),
      })

      // Capture full response
      const responseText = await response.text()
      let responseData: any = null
      
      try {
        responseData = JSON.parse(responseText)
      } catch (e) {
        if (DEBUG) {
          console.warn('[Try] Could not parse feedback response as JSON:', responseText.substring(0, 200))
        }
      }

      setLastFeedbackResponse({
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        data: responseData,
        responseText: responseText.substring(0, 1000),
      })

      if (!response.ok) {
        const errorData = responseData || {}
        
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

      // Update run state immediately from response
      if (responseData?.ok && responseData?.run) {
        setRun({ ...responseData.run, audio_url: run?.audio_url || null })
        if (DEBUG) {
          console.log('[Try] Run state updated from feedback response:', {
            runId: responseData.run.id,
            status: responseData.run.status,
            hasAnalysisJson: !!responseData.run.analysis_json,
          })
        }
      }
      
      // Store feedback immediately from response
      if (responseData?.ok && responseData?.analysis) {
        setFeedback(responseData.analysis)
        if (DEBUG) {
          console.log('[Try] Feedback stored from response.analysis:', {
            runId,
            hasSummary: !!responseData.analysis.summary,
            hasRubricScores: !!responseData.analysis.rubric_scores,
          })
        }
      } else if (responseData?.ok && responseData?.run?.analysis_json) {
        setFeedback(responseData.run.analysis_json)
        if (DEBUG) {
          console.log('[Try] Feedback stored from run.analysis_json:', {
            runId,
            hasSummary: !!responseData.run.analysis_json.summary,
          })
        }
      } else if (responseData?.ok && responseData?.run) {
        // Run was updated but no analysis in response - it should be in run.analysis_json
        // This shouldn't happen, but if it does, the run state was already updated above
        if (DEBUG) {
          console.warn('[Try] Feedback response missing analysis data but run was updated:', {
            runId,
            responseData,
            hasAnalysis: !!responseData?.analysis,
            hasRunAnalysisJson: !!responseData?.run?.analysis_json,
          })
        }
      } else {
        if (DEBUG) {
          console.warn('[Try] Feedback response missing analysis data:', {
            runId,
            responseData,
            hasAnalysis: !!responseData?.analysis,
            hasRunAnalysisJson: !!responseData?.run?.analysis_json,
          })
        }
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
        
        // Update feedback from DB if present
        if (data.run.analysis_json) {
          setFeedback(data.run.analysis_json)
        } else {
          // Clear feedback if run doesn't have it
          setFeedback(null)
        }
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!run ? (
          /* BEFORE RECORDING - Minimal UI */
          <div className="space-y-8">
            {/* Prompt Selector */}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {PROMPTS.map((prompt) => (
                  <div
                    key={prompt.id}
                    onClick={() => setSelectedPrompt(prompt.id)}
                    className="cursor-pointer"
                  >
                    <Card
                      className={`p-4 transition-all h-full ${
                        selectedPrompt === prompt.id
                          ? 'bg-[#151C2C] border-[#F59E0B] ring-2 ring-[#F59E0B]/20'
                          : 'bg-[#121826] border-[#22283A] hover:border-[#6B7280]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-[#E6E8EB] text-sm">{prompt.title}</h3>
                        {selectedPrompt === prompt.id && (
                          <CheckCircle2 className="h-4 w-4 text-[#F59E0B] flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280]">{prompt.duration}</p>
                    </Card>
                  </div>
                ))}
              </div>
            </div>

            {/* Recording Section */}
            <div className="text-center">

              <Card 
                className="p-8 bg-[#121826] border-[#22283A]"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {!isRecording && !run ? (
                  /* IDLE STATE - Before recording */
                  <div className="space-y-6">
                    {/* Large Mic Button */}
                    <div className="flex justify-center">
                      <button
                        onClick={startRecording}
                        disabled={!selectedPrompt}
                        className={`
                          w-32 h-32 rounded-full flex items-center justify-center
                          transition-all duration-200
                          disabled:opacity-50 disabled:cursor-not-allowed
                          ${selectedPrompt 
                            ? 'bg-[#F59E0B] hover:bg-[#D97706] text-[#0B0F14] shadow-lg shadow-[#F59E0B]/30 hover:shadow-xl hover:shadow-[#F59E0B]/40 hover:scale-105' 
                            : 'bg-[#22283A] text-[#6B7280] cursor-not-allowed'
                          }
                        `}
                      >
                        <Mic className="h-12 w-12" />
                      </button>
                    </div>

                    {/* Microcopy */}
                    <div className="text-center space-y-2">
                      <p className="text-sm text-[#E6E8EB] font-medium">Start recording</p>
                      <p className="text-xs text-[#9AA4B2]">Aim for 30–60 seconds. No signup required.</p>
                    </div>

                    {/* Upload option - hidden behind secondary button */}
                    <div className="flex justify-center">
                      <button
                        onClick={() => {
                          setActiveTab('upload')
                          fileInputRef.current?.click()
                        }}
                        className="text-xs text-[#6B7280] hover:text-[#9AA4B2] transition-colors underline"
                      >
                        Or upload audio file
                      </button>
                    </div>

                    {/* Mic permission prompt */}
                    {!hasMicPermission && !isTestingMic && (
                      <div className="text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={testMicrophone}
                          disabled={isTestingMic}
                        >
                          Enable microphone
                        </Button>
                      </div>
                    )}

                    {/* Device selection - only show if multiple devices */}
                    {audioDevices.length > 1 && hasMicPermission && (
                      <div className="text-sm">
                        <label className="block text-[#9AA4B2] mb-2 text-center text-xs">Microphone</label>
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
                  </div>
                ) : isRecording ? (
                  /* RECORDING STATE */
                  <div className="space-y-6">
                    {/* Timer */}
                    <div className="text-center">
                      <div className="text-5xl font-bold text-[#E6E8EB] mb-4">
                        {formatTime(recordingTime)}
                      </div>
                    </div>

                    {/* Enhanced Meter */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-3 bg-[#0B0F14] rounded-full overflow-hidden border border-[#22283A]">
                          <div
                            className={`h-full transition-all duration-75 rounded-full ${
                              micLevel > 0.01 
                                ? 'bg-gradient-to-r from-[#22C55E] via-[#22C55E] to-[#F59E0B]' 
                                : 'bg-[#6B7280]'
                            }`}
                            style={{ 
                              width: `${Math.min(micLevel * 100, 100)}%`,
                              boxShadow: micLevel > 0.1 ? `0 0 8px ${micLevel > 0.5 ? '#22C55E' : '#F59E0B'}40` : 'none'
                            }}
                          />
                        </div>
                      </div>
                      {isSilent && (
                        <p className="text-xs text-[#EF4444] text-center font-medium">
                          No microphone input detected
                        </p>
                      )}
                    </div>

                    {/* Controls */}
                    <div className="flex gap-3 justify-center">
                      {!isPaused ? (
                        <Button
                          variant="secondary"
                          onClick={pauseRecording}
                          size="lg"
                        >
                          <Pause className="mr-2 h-5 w-5" />
                          Pause
                        </Button>
                      ) : (
                        <Button
                          variant="secondary"
                          onClick={resumeRecording}
                          size="lg"
                        >
                          <Play className="mr-2 h-5 w-5" />
                          Resume
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        onClick={stopRecording}
                        size="lg"
                      >
                        <Square className="mr-2 h-5 w-5" />
                        Stop
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* UPLOADING/TRANScribing STATE */
                  <div className="space-y-4">
                    {isUploading && (
                      <div className="text-center py-8">
                        <LoadingSpinner size="lg" text="Uploading..." />
                      </div>
                    )}
                    {isTranscribing && (
                      <div className="text-center py-8">
                        <LoadingSpinner size="lg" text="Transcribing..." />
                      </div>
                    )}
                    {isGettingFeedback && (
                      <div className="text-center py-8">
                        <LoadingSpinner size="lg" text="Generating feedback..." />
                      </div>
                    )}
                  </div>
                )}

                {/* Hidden file input for upload */}
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

                {error && (
                  <div className="p-4 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg text-center">
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
              </Card>
            </div>
          ) : (
            /* AFTER RECORDING - Transcript and Feedback */
            <div className="space-y-6">
              {/* Metrics */}
              {run.transcript && run.transcript.trim().length > 0 && (
                <Card className="p-6 bg-[#121826] border-[#22283A]">
                  <div className="grid grid-cols-3 gap-6 text-center">
                    <div>
                      <p className="text-xs text-[#6B7280] mb-2 uppercase tracking-wide">Duration</p>
                      <p className="text-2xl font-bold text-[#E6E8EB]">
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
                      <p className="text-xs text-[#6B7280] mb-2 uppercase tracking-wide">Words</p>
                      <p className="text-2xl font-bold text-[#E6E8EB]">
                        {run.word_count || (run.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : null) || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#6B7280] mb-2 uppercase tracking-wide">WPM</p>
                      <p className="text-2xl font-bold text-[#E6E8EB]">
                        {(() => {
                          const durationMsForWPM = durationMs 
                            || (run.duration_ms !== null ? run.duration_ms : null)
                            || (run.audio_seconds ? Math.round(run.audio_seconds * 1000) : null)
                          const wpm = calculateWPM(run.transcript, durationMsForWPM)
                          return wpm !== null ? wpm : '—'
                        })()}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              {/* Transcript Panel - Show simple version if no feedback, interactive if feedback exists */}
              {run.transcript && run.transcript.trim().length > 0 && (() => {
                const feedbackData = feedback || run.analysis_json
                
                // Simple transcript if no feedback yet
                if (!feedbackData) {
                  return (
                    <Card className="p-6 bg-[#121826] border-[#22283A]">
                      <h3 className="text-lg font-bold text-[#E6E8EB] mb-4">Transcript</h3>
                      <div className="max-h-[400px] overflow-y-auto">
                        <div className="prose prose-invert max-w-none" style={{ lineHeight: '1.7', color: colors.text.primary }}>
                          <p className="text-[#E6E8EB] whitespace-pre-wrap">{run.transcript}</p>
                        </div>
                      </div>
                    </Card>
                  )
                }

                // Interactive transcript with feedback
                const serverChunks = feedbackData?.chunks || []
                const sentences = splitIntoSentences(run.transcript)
                const sentenceFeedbackMap = createSentenceFeedbackMap(run.transcript, serverChunks)
                const paragraphs = groupSentencesIntoParagraphs(sentences, sentenceFeedbackMap)
                
                // Sentence span component - use CSS hover instead of hooks
                const SentenceSpan = ({ sentence, idx }: { sentence: string; idx: number }) => {
                  const feedback = sentenceFeedbackMap.get(idx)
                  const isPinned = pinnedSentenceIdx === idx
                  const isHighlighted = highlightedCriterion && feedback?.purpose_label === highlightedCriterion
                  
                  const getStatusColor = (status: string) => {
                    if (status === 'strong') return 'hover:border-[#22C55E]/50 hover:bg-[#22C55E]/5'
                    if (status === 'needs_work') return 'hover:border-[#F59E0B]/50 hover:bg-[#F59E0B]/5'
                    return 'hover:border-[#6B7280]/50 hover:bg-[#6B7280]/5'
                  }
                  
                  return (
                    <span
                      id={`sentence-${idx}`}
                      className={`group relative inline cursor-pointer transition-all rounded px-1 py-0.5 border border-transparent ${
                        isHighlighted ? 'bg-[#F59E0B]/20 border-[#F59E0B]/50 animate-pulse' : getStatusColor(feedback?.status || 'unscored')
                      }`}
                      onClick={() => {
                        setPinnedSentenceIdx(isPinned ? null : idx)
                      }}
                    >
                      {sentence}
                      {feedback && (
                        <div className={`absolute z-50 mt-2 p-3 bg-[#0B0F14] border border-[#22283A] rounded-lg shadow-xl min-w-[280px] max-w-[400px] ${
                          isPinned ? 'block' : 'hidden group-hover:block'
                        }`}
                        style={{ left: '50%', transform: 'translateX(-50%)', top: '100%' }}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium px-2 py-1 rounded border bg-[#121826] text-[#9AA4B2]">
                                {feedback.purpose_label}
                              </span>
                              {feedback.score !== null && (
                                <span className="text-xs text-[#E6E8EB]">
                                  {feedback.score}/10
                                </span>
                              )}
                            </div>
                            {feedback.why && (
                              <p className="text-sm text-[#E6E8EB]">{feedback.why}</p>
                            )}
                            {feedback.suggestion && (
                              <p className="text-sm text-[#9AA4B2]">{feedback.suggestion}</p>
                            )}
                            {feedback.rewrite && (
                              <div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedRewrites(prev => {
                                      const next = new Set(prev)
                                      if (next.has(idx)) {
                                        next.delete(idx)
                                      } else {
                                        next.add(idx)
                                      }
                                      return next
                                    })
                                  }}
                                  className="text-xs text-[#F59E0B] hover:text-[#D97706]"
                                >
                                  {expandedRewrites.has(idx) ? 'Hide rewrite' : 'Show rewrite'}
                                </button>
                                {expandedRewrites.has(idx) && (
                                  <p className="text-sm text-[#E6E8EB] italic mt-1">{feedback.rewrite}</p>
                                )}
                              </div>
                            )}
                            {isPinned && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPinnedSentenceIdx(null)
                                }}
                                className="text-xs text-[#6B7280] hover:text-[#9AA4B2]"
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </span>
                  )
                }
                
                return (
                  <Card className="p-6 bg-[#121826] border-[#22283A]">
                    <h3 className="text-lg font-bold text-[#E6E8EB] mb-4">Transcript</h3>
                    <div className="max-h-[600px] overflow-y-auto">
                      <div className="max-w-[72ch] mx-auto" style={{ lineHeight: '1.7' }}>
                        {paragraphs.map((paragraph, pIdx) => {
                          let globalSentenceIdx = paragraphs.slice(0, pIdx).reduce((sum, p) => sum + p.length, 0)
                          return (
                            <p key={pIdx} className="mb-4 text-[#E6E8EB] text-base">
                              {paragraph.map((sentence, sIdx) => {
                                const globalIdx = globalSentenceIdx++
                                return (
                                  <React.Fragment key={globalIdx}>
                                    <SentenceSpan sentence={sentence} idx={globalIdx} />
                                    {sIdx < paragraph.length - 1 && ' '}
                                  </React.Fragment>
                                )
                              })}
                            </p>
                          )
                        })}
                      </div>
                    </div>
                  </Card>
                )
              })()}

              {/* Generate Feedback Button */}
              {run && run.transcript && !feedback && !run.analysis_json && !isTranscribing && !isGettingFeedback && (
                <div className="text-center">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      if (run.id) {
                        setIsGettingFeedback(true)
                        getFeedback(run.id)
                      }
                    }}
                    disabled={!selectedRubricId}
                  >
                    Generate feedback
                  </Button>
                </div>
              )}

              {/* Feedback Section - Rubric Breakdown */}
                {(() => {
                  // Use feedback state if available, otherwise fall back to run.analysis_json
                  const feedbackData = feedback || run.analysis_json
                  
                  if (!feedbackData) {
                    // Show empty state if transcript exists but no feedback
                    if (run.transcript) {
                      return (
                        <Card className="p-6 bg-[#121826] border-[#22283A]">
                          <h3 className="text-lg font-bold text-[#E6E8EB] mb-4">Your Evaluation</h3>
                          <div className="text-center py-8">
                            <p className="text-sm text-[#9AA4B2] mb-4">Evaluation isn't generated yet.</p>
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
                  
                  // Check if transcript is too short
                  const durationSec = durationMs ? durationMs / 1000 : (run.duration_ms ? run.duration_ms / 1000 : (run.audio_seconds || null))
                  const selectedPromptData = PROMPTS.find(p => p.id === selectedPrompt)
                  const isTooShort = durationSec && selectedPromptData && durationSec < 20
                  
                  return (
                    <>
                      {/* Warning for short recordings */}
                      {isTooShort && (
                        <Card className="p-4 bg-[#F97316]/10 border-[#F97316]/30">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="h-4 w-4 text-[#F97316] flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-[#F97316]">
                              This recording is too short to fully evaluate this prompt. Record at least 20 seconds for accurate feedback.
                            </p>
                          </div>
                        </Card>
                      )}
                      
                      {/* Rubric Breakdown */}
                      <Card className="p-6 bg-[#121826] border-[#22283A]">
                        <h3 className="text-lg font-bold text-[#E6E8EB] mb-4">Rubric Breakdown</h3>
                        <div className="space-y-3">
                          {feedbackData.rubric_scores && feedbackData.rubric_scores.length > 0 ? (
                            feedbackData.rubric_scores.map((rubricScore: any, idx: number) => {
                              const score = rubricScore.score || 0
                              const maxScore = 10
                              const scorePercent = (score / maxScore) * 100
                              const criterionLabel = rubricScore.criterion_label || rubricScore.criterion || `Criterion ${idx + 1}`
                              
                              // Determine status
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
                                  className="p-4 rounded-lg border bg-[#0B0F14] border-[#22283A]"
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3 flex-1">
                                      <StatusIcon className={`h-5 w-5 ${statusColor} flex-shrink-0`} />
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between mb-1">
                                          <span className="text-sm font-medium text-[#E6E8EB]">
                                            {criterionLabel}
                                          </span>
                                          <span className="text-sm font-bold text-[#E6E8EB]">
                                            {score} / {maxScore}
                                          </span>
                                        </div>
                                        {/* Progress bar */}
                                        <div className="w-full h-2 bg-[#0B0F14] rounded-full overflow-hidden">
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
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        // Find first sentence with this purpose
                                        if (!run.transcript) return
                                        const sentences = splitIntoSentences(run.transcript)
                                        const sentenceFeedbackMap = createSentenceFeedbackMap(run.transcript, (feedbackData?.chunks || []))
                                        let targetIdx = -1
                                        for (let i = 0; i < sentences.length; i++) {
                                          const feedback = sentenceFeedbackMap.get(i)
                                          if (feedback?.purpose_label === criterionLabel) {
                                            targetIdx = i
                                            break
                                          }
                                        }
                                        
                                        if (targetIdx >= 0) {
                                          // Scroll to sentence
                                          const element = document.getElementById(`sentence-${targetIdx}`)
                                          if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                                            setHighlightedCriterion(criterionLabel)
                                            setTimeout(() => setHighlightedCriterion(null), 2000)
                                          }
                                        }
                                      }}
                                      className="ml-3 text-xs"
                                    >
                                      Show evidence
                                    </Button>
                                  </div>
                                  {rubricScore.notes && (
                                    <div className="mt-2 pt-2 border-t border-[#22283A]">
                                      <p className="text-sm text-[#E6E8EB]">{rubricScore.notes}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })
                          ) : (
                            <p className="text-sm text-[#9AA4B2] text-center py-4">
                              No rubric scores available
                            </p>
                          )}
                        </div>
                      </Card>
                      
                      {/* Next Attempt Focus */}
                      {(() => {
                        // Find the lowest scoring criterion or a key improvement
                        const rubricScores = feedbackData.rubric_scores || []
                        const lowestScore = rubricScores.length > 0 
                          ? rubricScores.reduce((lowest: any, current: any) => 
                              (current.score < lowest.score) ? current : lowest
                            )
                          : null
                        
                        const lowestCriterionLabel = lowestScore 
                          ? (lowestScore.criterion_label || lowestScore.criterion || 'this area')
                          : null
                        
                        const focusMessage = lowestScore 
                          ? `Focus on ${lowestCriterionLabel ? lowestCriterionLabel.toLowerCase() : 'this area'}. ${lowestScore.notes || 'This area needs the most improvement.'}`
                          : feedbackData.summary?.top_improvements?.[0] 
                            ? feedbackData.summary.top_improvements[0]
                            : feedbackData.summary?.overall_notes || 'Review your pitch and try again.'
                        
                        return (
                          <Card className="p-6 bg-gradient-to-br from-[#F59E0B]/20 to-[#F97316]/20 border-[#F59E0B]/50">
                            <h4 className="text-sm font-semibold text-[#F59E0B] uppercase tracking-wide mb-2">
                              Next attempt, focus on this
                            </h4>
                            <p className="text-sm text-[#E6E8EB]">{focusMessage}</p>
                          </Card>
                        )
                      })()}
                    </>
                  )
                })()}

                {/* New take button */}
                <Button
                  variant="ghost"
                  onClick={handleNewTake}
                  className="w-full"
                >
                  Re-record to Improve Score
                </Button>
              </>
            )}

            {/* Debug panel (collapsible, dev only) */}
            {DEBUG && (
              <Card className="p-4 bg-[#0B0F14] border-[#22283A] mt-6">
                <button
                  onClick={() => setDebugPanelOpen(!debugPanelOpen)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <h4 className="text-sm font-bold text-[#E6E8EB]">Debug Panel</h4>
                  {debugPanelOpen ? (
                    <ChevronUp className="h-4 w-4 text-[#9AA4B2]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#9AA4B2]" />
                  )}
                </button>
                {debugPanelOpen && (
                <div className="space-y-2 text-xs text-[#9AA4B2]">
                  <div className="grid grid-cols-2 gap-2">
                    <div>Active Run ID:</div>
                    <div className="font-mono">{run?.id || 'none'}</div>
                    <div>Run Status:</div>
                    <div>{run?.status || 'none'}</div>
                    <div>Run ID:</div>
                    <div className="font-mono">{run?.id || 'none'}</div>
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
                    <div>Duration (ms) Local:</div>
                    <div>{durationMs !== null ? `${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)` : '—'}</div>
                    <div>Duration (ms) DB:</div>
                    <div>{(run && run.duration_ms !== null) ? `${run.duration_ms}ms (${(run.duration_ms / 1000).toFixed(2)}s)` : '—'}</div>
                    <div>Words (computed):</div>
                    <div>{run?.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : '—'}</div>
                    <div>WPM (computed):</div>
                    <div>{(() => {
                      if (!run) return '—'
                      const durationMsForWPM = run.duration_ms !== null ? run.duration_ms : (run.audio_seconds ? Math.round(run.audio_seconds * 1000) : null)
                      const wpm = calculateWPM(run.transcript || null, durationMsForWPM)
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
                  {lastFeedbackResponse && (
                    <div className="mt-2 pt-2 border-t border-[#22283A]">
                      <div className="font-semibold text-[#E6E8EB] mb-1">Last Feedback Response:</div>
                      <div className="text-xs space-y-1">
                        <div>Status: {lastFeedbackResponse.status} {lastFeedbackResponse.statusText}</div>
                        <div>OK: {lastFeedbackResponse.ok ? 'yes' : 'no'}</div>
                        {lastFeedbackResponse.data && (
                          <>
                            <div>Has analysis: {lastFeedbackResponse.data.analysis ? 'yes' : 'no'}</div>
                            <div>Has run.analysis_json: {lastFeedbackResponse.data.run?.analysis_json ? 'yes' : 'no'}</div>
                            <div>Response keys: {Object.keys(lastFeedbackResponse.data || {}).join(', ')}</div>
                          </>
                        )}
                      </div>
                      <pre className="mt-2 p-2 bg-[#0B0F14] rounded text-xs overflow-auto max-h-40 font-mono text-[#E6E8EB]">
                        {JSON.stringify(lastFeedbackResponse.data || lastFeedbackResponse, null, 2)}
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
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

