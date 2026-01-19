'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
import { createClient } from '@/lib/supabase/client-auth'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { CheckCircle2, Clock, Scissors, Mic, Upload, Play, Pause, Square, ChevronDown, ChevronUp, AlertCircle, X, Download } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const DEBUG = true

// Try Free page: only show preview results, not deep analysis
const SHOW_DEEP_ANALYSIS_ON_TRY = false

// Free plan limits
const FREE_MAX_SECONDS = 120 // 2 minutes
const FREE_WARNING_SECONDS = 105 // 1:45 - show warning

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
  const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set())
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
  // Store last audio blob for retry
  const lastAudioBlobRef = useRef<{ blob: Blob; fileName: string } | null>(null)
  const [lastError, setLastError] = useState<any>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [lastFeedbackResponse, setLastFeedbackResponse] = useState<any>(null)
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const shouldDiscardRecordingRef = useRef<boolean>(false)
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

    // Listen for device changes
    const handleDeviceChange = () => {
      enumerateAudioDevices()
    }
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [])

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
      
      // Request stream with selected device, with fallback
      let stream: MediaStream | null = null
      
      if (selectedDeviceId) {
        try {
          // Try with exact device first
          const constraints: MediaStreamConstraints = { audio: { deviceId: { exact: selectedDeviceId } } }
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          if (DEBUG) {
            console.log('[Try] Test mic: Successfully opened stream with exact device:', selectedDeviceId)
          }
        } catch (exactError: any) {
          if (DEBUG) {
            console.warn('[Try] Test mic: Failed to open stream with exact device, trying preferred:', exactError)
          }
          // Fallback: try with preferred (non-exact) device
          try {
            const constraints: MediaStreamConstraints = { audio: { deviceId: selectedDeviceId } }
            stream = await navigator.mediaDevices.getUserMedia(constraints)
            if (DEBUG) {
              console.log('[Try] Test mic: Successfully opened stream with preferred device:', selectedDeviceId)
            }
          } catch (preferredError: any) {
            if (DEBUG) {
              console.warn('[Try] Test mic: Failed to open stream with preferred device, trying default:', preferredError)
            }
            // Final fallback: use default device
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            // Update selected device to first available if we have devices
            if (audioDevices.length > 0) {
              const newDeviceId = audioDevices[0].deviceId
              setSelectedDeviceId(newDeviceId)
              localStorage.setItem('pitchpractice_selected_device_id', newDeviceId)
            }
            if (DEBUG) {
              console.log('[Try] Test mic: Successfully opened stream with default device')
            }
          }
        }
      } else {
        // No device selected, use default
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      }
      
      if (!stream) {
        throw new Error('Failed to get media stream')
      }
      
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
    } catch (err: any) {
      console.error('[Try] Error testing microphone:', err)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to access microphone. '
      if (err.name === 'NotReadableError' || err.name === 'NotAllowedError') {
        errorMessage += 'The microphone may be in use by another application or permission was denied. '
        errorMessage += 'Please close other applications using the microphone and try again.'
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.'
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'The selected microphone is not available. Please select a different microphone.'
        // Re-enumerate devices to get updated list
        enumerateAudioDevices()
      } else {
        errorMessage += 'Check permissions and try again.'
      }
      
      setError(errorMessage)
      setIsTestingMic(false)
      setHasMicPermission(false)
      
      // If we have devices but the selected one failed, try to select a different one
      if (audioDevices.length > 0 && selectedDeviceId) {
        const currentIndex = audioDevices.findIndex(d => d.deviceId === selectedDeviceId)
        if (currentIndex >= 0 && currentIndex < audioDevices.length - 1) {
          // Try next device
          const nextDeviceId = audioDevices[currentIndex + 1].deviceId
          setSelectedDeviceId(nextDeviceId)
          localStorage.setItem('pitchpractice_selected_device_id', nextDeviceId)
        } else if (audioDevices.length > 0) {
          // Try first device
          const firstDeviceId = audioDevices[0].deviceId
          setSelectedDeviceId(firstDeviceId)
          localStorage.setItem('pitchpractice_selected_device_id', firstDeviceId)
        }
      }
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

  // Calculate ETA for feedback generation based on audio duration
  const calculateFeedbackETA = (durationSeconds: number | null): string => {
    if (!durationSeconds || durationSeconds <= 0) {
      return '~10–20s'
    }
    
    // Base time: 10 seconds for processing
    // Additional time: ~0.5 seconds per second of audio (scales with length)
    const baseSeconds = 10
    const perSecondSeconds = 0.5
    const estimatedSeconds = Math.ceil(baseSeconds + (durationSeconds * perSecondSeconds))
    
    // Cap at reasonable maximum (2 minutes)
    const maxSeconds = 120
    const finalSeconds = Math.min(estimatedSeconds, maxSeconds)
    
    if (finalSeconds < 30) {
      return `~${finalSeconds}s`
    } else if (finalSeconds < 60) {
      return `~${finalSeconds}s`
    } else {
      const mins = Math.floor(finalSeconds / 60)
      const secs = finalSeconds % 60
      if (secs === 0) {
        return `~${mins}min`
      } else {
        return `~${mins}:${secs.toString().padStart(2, '0')}`
      }
    }
  }

  // Download transcript as .txt file
  const downloadTranscript = () => {
    if (!run?.transcript) return

    const selectedPromptData = PROMPTS.find(p => p.id === selectedPrompt)
    const promptTitle = selectedPromptData?.title || 'Practice run'
    const rubricName = rubrics.find(r => r.id === selectedRubricId)?.name || 'General Pitch'
    
    const durationSec = durationMs 
      ? durationMs / 1000 
      : (run.duration_ms 
        ? run.duration_ms / 1000 
        : (run.audio_seconds || null))
    const durationStr = durationSec ? formatTime(durationSec) : '—'
    
    const wordCount = run.word_count || (run.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : null) || '—'
    
    const durationMsForWPM = durationMs 
      || (run.duration_ms !== null ? run.duration_ms : null)
      || (run.audio_seconds ? Math.round(run.audio_seconds * 1000) : null)
    const wpm = calculateWPM(run.transcript, durationMsForWPM)
    const wpmStr = wpm !== null ? wpm.toString() : '—'

    const title = selectedPromptData?.title || 'Practice run'
    
    const content = `${title}
${'='.repeat(title.length)}

Rubric: ${rubricName}
Duration: ${durationStr}
Word Count: ${wordCount}
Words Per Minute: ${wpmStr}

${'='.repeat(50)}

TRANSCRIPT

${run.transcript}
`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/\s+/g, '_')}_transcript.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Download feedback as .txt file
  const downloadFeedback = () => {
    const feedbackData = feedback || run?.analysis_json
    if (!feedbackData || !run?.transcript) return

    const selectedPromptData = PROMPTS.find(p => p.id === selectedPrompt)
    const promptTitle = selectedPromptData?.title || 'Practice run'
    const rubricName = rubrics.find(r => r.id === selectedRubricId)?.name || 'General Pitch'
    
    const durationSec = durationMs 
      ? durationMs / 1000 
      : (run.duration_ms 
        ? run.duration_ms / 1000 
        : (run.audio_seconds || null))
    const durationStr = durationSec ? formatTime(durationSec) : '—'
    
    const wordCount = run.word_count || (run.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : null) || '—'
    
    const durationMsForWPM = durationMs 
      || (run.duration_ms !== null ? run.duration_ms : null)
      || (run.audio_seconds ? Math.round(run.audio_seconds * 1000) : null)
    const wpm = calculateWPM(run.transcript, durationMsForWPM)
    const wpmStr = wpm !== null ? wpm.toString() : '—'

    let content = `${promptTitle} - Feedback Report
${'='.repeat(50)}

Rubric: ${rubricName}
Duration: ${durationStr}
Word Count: ${wordCount}
Words Per Minute: ${wpmStr}

${'='.repeat(50)}

FEEDBACK SUMMARY

`

    // What's Working
    if (feedbackData.summary?.top_strengths && feedbackData.summary.top_strengths.length > 0) {
      content += `What's Working:\n`
      feedbackData.summary.top_strengths.forEach((strength: string) => {
        content += `  • ${strength.replace(/^["']|["']$/g, '').trim()}\n`
      })
      content += `\n`
    }

    // What to Improve
    if (feedbackData.summary?.top_improvements && feedbackData.summary.top_improvements.length > 0) {
      content += `What to Improve:\n`
      feedbackData.summary.top_improvements.forEach((improvement: string) => {
        content += `  • ${improvement.replace(/^["']|["']$/g, '').trim()}\n`
      })
      content += `\n`
    }

    // Suggested Focus
    if (feedbackData.summary?.focus_areas && feedbackData.summary.focus_areas.length > 0) {
      content += `Suggested Focus:\n`
      feedbackData.summary.focus_areas.forEach((focus: string) => {
        content += `  • ${focus.replace(/^["']|["']$/g, '').trim()}\n`
      })
      content += `\n`
    }

    // Rubric Breakdown
    if (feedbackData.rubric_scores && feedbackData.rubric_scores.length > 0) {
      content += `${'='.repeat(50)}\n\nRUBRIC BREAKDOWN\n\n`
      feedbackData.rubric_scores.forEach((score: any, idx: number) => {
        const criterionLabel = score.criterion_label || score.criterion || `Question ${idx + 1}`
        const scoreValue = score.score || 0
        content += `${criterionLabel}: ${scoreValue}/10\n`
        if (score.notes) {
          content += `  ${score.notes}\n`
        }
        if (score.evidence_quotes && score.evidence_quotes.length > 0) {
          content += `  Evidence:\n`
          score.evidence_quotes.forEach((quote: string) => {
            content += `    "${quote}"\n`
          })
        } else if (score.evidence) {
          content += `  Evidence: ${score.evidence}\n`
        }
        content += `\n`
      })
    }

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${promptTitle.replace(/\s+/g, '_')}_feedback.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Download analysis JSON
  const downloadAnalysisJSON = () => {
    const feedbackData = feedback || run?.analysis_json
    if (!feedbackData) return

    const selectedPromptData = PROMPTS.find(p => p.id === selectedPrompt)
    const promptTitle = selectedPromptData?.title || 'Practice run'
    
    const content = JSON.stringify(feedbackData, null, 2)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${promptTitle.replace(/\s+/g, '_')}_analysis.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
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

  // Map line_by_line to sentences for feedback
  const createSentenceFeedbackMap = (transcript: string, lineByLine: any[]): Map<number, any> => {
    const sentences = splitIntoSentences(transcript)
    const feedbackMap = new Map<number, any>()
    
    sentences.forEach((sentence, idx) => {
      const sentenceLower = sentence.toLowerCase().trim()
      let bestMatch: any = null
      let bestScore = 0
      
      // First: exact substring match (line_by_line.quote is contained in sentence OR sentence contained in quote)
      lineByLine.forEach(item => {
        const quote = (item.quote || '').toLowerCase().trim()
        if (quote && (sentenceLower.includes(quote) || quote.includes(sentenceLower))) {
          const score = Math.min(sentenceLower.length, quote.length) / Math.max(sentenceLower.length, quote.length)
          if (score > bestScore) {
            bestScore = score
            bestMatch = item
          }
        }
      })
      
      // Fallback: simple similarity (3+ word overlap)
      if (!bestMatch) {
        const sentenceWords = sentenceLower.split(/\s+/).filter((w: string) => w.length > 2)
        lineByLine.forEach(item => {
          const quote = (item.quote || '').toLowerCase().trim()
          const quoteWords = quote.split(/\s+/).filter((w: string) => w.length > 2)
          const overlap = sentenceWords.filter((w: string) => quoteWords.includes(w))
          if (overlap.length >= 3) {
            const score = overlap.length / Math.max(sentenceWords.length, quoteWords.length)
            if (score > bestScore) {
              bestScore = score
              bestMatch = item
            }
          }
        })
      }
      
      if (bestMatch) {
        feedbackMap.set(idx, {
          type: bestMatch.type || 'suggestion',
          comment: bestMatch.comment || '',
          action: bestMatch.action || '',
          priority: bestMatch.priority || 'medium',
          quote: bestMatch.quote || '',
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

      // Request stream with selected device, with fallback
      let stream: MediaStream | null = null
      let usedDeviceId: string | null = null
      
      if (selectedDeviceId) {
        try {
          // Try with exact device first
          const constraints: MediaStreamConstraints = { audio: { deviceId: { exact: selectedDeviceId } } }
          stream = await navigator.mediaDevices.getUserMedia(constraints)
          usedDeviceId = selectedDeviceId
          if (DEBUG) {
            console.log('[Try] Successfully opened stream with exact device:', selectedDeviceId)
          }
        } catch (exactError: any) {
          if (DEBUG) {
            console.warn('[Try] Failed to open stream with exact device, trying preferred:', exactError)
          }
          // Fallback: try with preferred (non-exact) device
          try {
            const constraints: MediaStreamConstraints = { audio: { deviceId: selectedDeviceId } }
            stream = await navigator.mediaDevices.getUserMedia(constraints)
            usedDeviceId = selectedDeviceId
            if (DEBUG) {
              console.log('[Try] Successfully opened stream with preferred device:', selectedDeviceId)
            }
          } catch (preferredError: any) {
            if (DEBUG) {
              console.warn('[Try] Failed to open stream with preferred device, trying default:', preferredError)
            }
            // Final fallback: use default device
            stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            usedDeviceId = null
            // Update selected device to first available if we have devices
            if (audioDevices.length > 0) {
              const newDeviceId = audioDevices[0].deviceId
              setSelectedDeviceId(newDeviceId)
              localStorage.setItem('pitchpractice_selected_device_id', newDeviceId)
            }
            if (DEBUG) {
              console.log('[Try] Successfully opened stream with default device')
            }
          }
        }
      } else {
        // No device selected, use default
        stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        usedDeviceId = null
      }
      
      if (!stream) {
        throw new Error('Failed to get media stream')
      }
      
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
        
        // Check if recording should be discarded (re-record was pressed)
        if (shouldDiscardRecordingRef.current) {
          // Clean up and return without uploading
          stream.getTracks().forEach(track => track.stop())
          streamRef.current = null
          shouldDiscardRecordingRef.current = false
          return
        }
        
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

      // Use timeslice (3000ms) for stable long recordings
      const timesliceMs = 3000
      mediaRecorder.start(timesliceMs)
      setIsRecording(true)
      setIsPaused(false)
      setIsSilent(false)
      silenceStartRef.current = null
      setRecordingTime(0)
      shouldDiscardRecordingRef.current = false
      
      // Track recording start time for accurate duration calculation
      const startTime = Date.now()
      setRecordingStartedAt(startTime)
      setPausedTotalMs(0)
      setPauseStartTime(null)

      // Start timer with Free plan limit enforcement
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at 2:00 for Free plan
          if (newTime >= FREE_MAX_SECONDS) {
            stopRecording()
            return FREE_MAX_SECONDS
          }
          return newTime
        })
      }, 1000)
    } catch (err: any) {
      console.error('[Try] Error starting recording:', err)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to start recording. '
      if (err.name === 'NotReadableError' || err.name === 'NotAllowedError') {
        errorMessage += 'The microphone may be in use by another application or permission was denied. '
        errorMessage += 'Please close other applications using the microphone and try again.'
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone and try again.'
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'The selected microphone is not available. Please select a different microphone.'
        // Re-enumerate devices to get updated list
        enumerateAudioDevices()
      } else {
        errorMessage += 'Please check microphone permissions and try again.'
      }
      
      setError(errorMessage)
      stopMicLevelMeter()
      
      // If we have devices but the selected one failed, try to select a different one
      if (audioDevices.length > 0 && selectedDeviceId) {
        const currentIndex = audioDevices.findIndex(d => d.deviceId === selectedDeviceId)
        if (currentIndex >= 0 && currentIndex < audioDevices.length - 1) {
          // Try next device
          const nextDeviceId = audioDevices[currentIndex + 1].deviceId
          setSelectedDeviceId(nextDeviceId)
          localStorage.setItem('pitchpractice_selected_device_id', nextDeviceId)
        } else if (audioDevices.length > 0) {
          // Try first device
          const firstDeviceId = audioDevices[0].deviceId
          setSelectedDeviceId(firstDeviceId)
          localStorage.setItem('pitchpractice_selected_device_id', firstDeviceId)
        }
      }
    }
  }

  // Pause recording
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

  // Resume recording
  const resumeRecording = () => {
    if (mediaRecorderRef.current && isPaused && pauseStartTime) {
      // Prevent resuming if already at Free plan limit
      if (recordingTime >= FREE_MAX_SECONDS) {
        stopRecording()
        return
      }
      mediaRecorderRef.current.resume()
      const pauseDuration = Date.now() - pauseStartTime
      setPausedTotalMs(prev => prev + pauseDuration)
      setPauseStartTime(null)
      setIsPaused(false)
      // Resume the timer
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at 2:00 for Free plan
          if (newTime >= FREE_MAX_SECONDS) {
            stopRecording()
            return FREE_MAX_SECONDS
          }
          return newTime
        })
      }, 1000)
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

  // Upload audio using direct-to-storage (no Vercel body size limits)
  const uploadAudio = async (audioBlob: Blob, fileName: string) => {
    setIsUploading(true)
    setError(null)
    
    // Store blob for retry
    lastAudioBlobRef.current = { blob: audioBlob, fileName }

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

      if (DEBUG) {
        console.log('[Try] Starting upload flow:', {
          fileName,
          size: audioBlob.size,
          sizeMB: (audioBlob.size / (1024 * 1024)).toFixed(2),
          type: audioBlob.type,
          durationMs: uploadDurationMs,
        })
      }

      // Step 1: Create run record (metadata only)
      const createResponse = await fetch('/api/runs/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          session_id: sessionId,
          rubric_id: selectedRubricId,
          title: selectedPrompt ? PROMPTS.find(p => p.id === selectedPrompt)?.title || null : null,
          duration_ms: uploadDurationMs,
        }),
      })

      if (!createResponse.ok) {
        const errorData = await createResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to create run record')
      }

      const createData = await createResponse.json()
      if (!createData.ok || !createData.run?.id) {
        throw new Error('Run creation failed: invalid response')
      }

      const runId = createData.run.id
      if (DEBUG) {
        console.log('[Try] Run created:', { runId })
      }

      // Step 2: Get signed upload path
      const signResponse = await fetch('/api/uploads/sign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId,
          mimeType: audioBlob.type || 'audio/webm',
        }),
      })

      if (!signResponse.ok) {
        const errorData = await signResponse.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get upload path')
      }

      const signData = await signResponse.json()
      if (!signData.ok || !signData.storagePath) {
        throw new Error('Failed to get upload path: invalid response')
      }

      const { storagePath, bucketName } = signData
      if (DEBUG) {
        console.log('[Try] Got upload path:', { storagePath, bucketName })
      }

      // Step 3: Upload directly to Supabase Storage
      const supabase = createClient()
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(storagePath, audioBlob, {
          contentType: audioBlob.type || 'audio/webm',
          upsert: false,
        })

      if (uploadError) {
        console.error('[Try] Storage upload failed:', uploadError)
        throw new Error(`Upload failed: ${uploadError.message}`)
      }

      if (DEBUG) {
        console.log('[Try] Storage upload successful:', uploadData)
      }

      // Step 4: Notify upload completion
      const completeResponse = await fetch('/api/uploads/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runId,
          storagePath,
        }),
      })

      if (!completeResponse.ok) {
        const errorData = await completeResponse.json().catch(() => ({}))
        console.warn('[Try] Upload complete notification failed:', errorData)
        // Don't throw - upload succeeded, just notification failed
      }

      const completeData = await completeResponse.json().catch(() => ({ ok: true }))
      const updatedRun = completeData.run || createData.run

      if (DEBUG) {
        console.log('[Try] Upload complete:', { 
          runId, 
          status: updatedRun.status,
          audioPath: updatedRun.audio_path,
        })
      }

      // Ensure duration_ms is set in run data if we have it
      if (uploadDurationMs !== null && uploadDurationMs > 0) {
        updatedRun.duration_ms = uploadDurationMs
      }
      
      setRun({ ...updatedRun, audio_url: null })
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
      
      // Normalize analysis shape: resp.analysis ?? resp.run?.analysis_json ?? null
      const normalizedAnalysis = responseData?.analysis ?? responseData?.run?.analysis_json ?? null
      
      // Store feedback immediately from response
      if (normalizedAnalysis) {
        setFeedback(normalizedAnalysis)
        if (DEBUG) {
          console.log('[Try] Feedback stored from normalized analysis:', {
            runId,
            hasSummary: !!normalizedAnalysis.summary,
            hasRubricScores: !!normalizedAnalysis.rubric_scores,
            hasLineByLine: !!normalizedAnalysis.line_by_line,
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
    // Guard: Never fetch if runId is falsy or the string "undefined"
    if (!runId || runId === 'undefined') {
      if (DEBUG) {
        console.warn('[Try] fetchRun called without runId or with "undefined"')
      }
      return
    }
    if (!isAuthenticated) {
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
        
        // Normalize analysis shape: resp.analysis ?? resp.run?.analysis_json ?? null
        const normalizedAnalysis = data.analysis ?? data.run?.analysis_json ?? null
        if (normalizedAnalysis) {
          setFeedback(normalizedAnalysis)
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
    
    // Clear audio chunks
    audioChunksRef.current = []
    
    // Clear local UI state
    setRun(null)
    setFeedback(null)
    setAudioUrl(null)
    setRecordingTime(0)
    setDurationMs(null)
    setPausedTotalMs(0)
    setPauseStartTime(null)
    
    // Reset recording flags
    setIsRecording(false)
    setIsPaused(false)
    setIsUploading(false)
    setIsTranscribing(false)
    setIsGettingFeedback(false)
    setError(null)
    setMicLevel(0)
    
    // Stop mic level meter
    stopMicLevelMeter()
    
    // Clear timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
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
  const getTranscriptHighlights = () => {
    const feedbackData = feedback || run?.analysis_json
    if (!feedbackData?.line_by_line) return []
    return feedbackData.line_by_line.map((item: any) => ({
      quote: item.quote,
      type: item.type === 'praise' ? 'strength' : item.type === 'issue' ? 'improve' : 'cut',
    }))
  }

  const highlights = getTranscriptHighlights()

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-[#0B0F14] to-[#0F172A]"
    >
      {/* Main Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Prompt Selection - Horizontal Row */}
        <div className="mb-6">
          <h2 className="text-base font-semibold text-[#E6E8EB] mb-3">What are you practicing today?</h2>
          <div className="flex flex-wrap gap-2.5">
            {PROMPTS.map((prompt) => (
              <button
                key={prompt.id}
                onClick={() => setSelectedPrompt(prompt.id)}
                className={`px-4 py-2.5 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                  selectedPrompt === prompt.id
                    ? 'bg-[#F59E0B] text-[#0B0F14] shadow-md shadow-[#F59E0B]/30 hover:bg-[#D97706]'
                    : 'bg-[rgba(255,255,255,0.03)] text-[#9AA4B2] hover:text-[#E6E8EB] border border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.12)]'
                }`}
              >
                <span>{prompt.title}</span>
                <span className="text-xs opacity-75">({prompt.duration})</span>
                {prompt.id === 'elevator' && (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-[#F59E0B]/30 text-[#F59E0B]">
                    Recommended
                  </span>
                )}
                {selectedPrompt === prompt.id && (
                  <CheckCircle2 className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
          
          {/* Evaluation Explanation - Shown when prompt is selected */}
          {selectedPrompt && (() => {
            const selectedPromptData = PROMPTS.find(p => p.id === selectedPrompt)
            return selectedPromptData ? (
              <div className="mt-4 space-y-4">
                {/* Guiding Questions */}
                <div className="p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl">
                  <p className="text-xs text-[#9AA4B2] mb-3 font-medium uppercase tracking-wide">Guiding questions</p>
                  <ul className="space-y-2">
                    {selectedPromptData.cues.map((cue, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                        <span className="text-[#F59E0B] mt-0.5">•</span>
                        <span>{cue}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Evaluation Criteria */}
                <div className="p-4 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-xl">
                  <p className="text-xs text-[#9AA4B2] mb-3 font-medium uppercase tracking-wide">You'll be evaluated on</p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                      <CheckCircle2 className="h-4 w-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                      <span>Answering the prompt questions</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                      <CheckCircle2 className="h-4 w-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                      <span>Clarity</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                      <CheckCircle2 className="h-4 w-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                      <span>Structure</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                      <CheckCircle2 className="h-4 w-4 text-[#22C55E] flex-shrink-0 mt-0.5" />
                      <span>Pacing (basic)</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : null
          })()}
        </div>

        {/* Two-Column Layout: Controls (left) | Transcript/Feedback (right) */}
        <div className="grid lg:grid-cols-[320px_1fr] gap-6 lg:gap-8">
          {/* LEFT COLUMN: Recording Controls (Narrow) */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="text-center mb-3">
                <p className="text-xs text-[#9AA4B2] mb-3">
                  ⏱ Free trial: up to 2 minutes per recording
                </p>
                <p className="text-xs text-[#6B7280] mb-3">
                  No signup required (optional)
                </p>
              </div>

              <div className="space-y-4">
                    {/* Device selection - always show if devices are available */}
                    {audioDevices.length > 0 && (
                      <div className="text-sm">
                        <label className="block text-[#9AA4B2] mb-1 text-xs">Microphone</label>
                        <select
                          value={selectedDeviceId}
                          onChange={(e) => {
                            setSelectedDeviceId(e.target.value)
                            localStorage.setItem('pitchpractice_selected_device_id', e.target.value)
                          }}
                          className="w-full px-3 py-2 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-lg text-[#E6E8EB] text-sm focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/50 focus:border-[#F59E0B]/30"
                          disabled={isRecording || isTestingMic}
                          style={{ colorScheme: 'dark' }}
                        >
                          {audioDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId} className="bg-[#151A23] text-[#E6E8EB]">
                              {device.label || `Device ${device.deviceId.substring(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Test Mic Button */}
                    {!hasMicPermission && !isRecording && !run && (
                      <div className="text-center p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-lg">
                        <p className="text-xs text-[#9AA4B2] mb-2">Enable microphone to see input level</p>
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

                    {/* Troubleshooting Text */}
                    <div className="pt-2 border-t border-[rgba(255,255,255,0.08)]">
                      <p className="text-xs text-[#6B7280] leading-relaxed">
                        💡 <span className="font-medium text-[#9AA4B2]">Troubleshooting:</span> If the test fails, try restarting the page, reconnecting your Bluetooth device, and make sure Bluetooth is turned off on other nearby devices.
                      </p>
                    </div>

                    {!isRecording && !run && (
                      <div className="space-y-3">
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={startRecording}
                          className="w-full shadow-lg shadow-[#F59E0B]/20"
                          disabled={!selectedPrompt || isSilent || recordingTime >= FREE_MAX_SECONDS}
                          title={recordingTime >= FREE_MAX_SECONDS ? 'Free trial limit reached (2:00)' : undefined}
                        >
                          <Mic className="mr-2 h-5 w-5" />
                          Start recording
                        </Button>
                        {!isTestingMic && hasMicPermission && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={testMicrophone}
                            className="w-full text-[#9AA4B2] hover:text-[#E6E8EB]"
                          >
                            🎤 Test microphone
                          </Button>
                        )}
                        {isTestingMic && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={testMicrophone}
                            className="w-full text-[#9AA4B2] hover:text-[#E6E8EB] border border-[#22283A]"
                          >
                            ⏹ End test
                          </Button>
                        )}
                      </div>
                    )}

                    {isRecording && (
                      <div className="space-y-3">
                        {/* Timer */}
                        <div className="text-center">
                          <div className="text-2xl font-bold text-[#E6E8EB] mb-2">
                            {formatTime(recordingTime)} / {formatTime(FREE_MAX_SECONDS)}
                          </div>
                          {recordingTime >= FREE_WARNING_SECONDS && recordingTime < FREE_MAX_SECONDS && (
                            <p className="text-xs text-[#F59E0B] font-medium">
                              Free trial ends at 2:00
                            </p>
                          )}
                          {recordingTime >= FREE_MAX_SECONDS && (
                            <p className="text-xs text-[#EF4444] font-medium">
                              Recording stopped at 2:00 limit
                            </p>
                          )}
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
                            Stop Recording
                          </Button>
                        </div>
                        {isPaused && (
                          <div className="space-y-2">
                            <Button
                              variant="secondary"
                              onClick={handleRerecord}
                              className="w-full border border-[#EF4444]/30 text-[#EF4444] hover:bg-[#EF4444]/10 hover:border-[#EF4444]/50"
                            >
                              <Scissors className="mr-2 h-4 w-4" />
                              Re-record (Start over)
                            </Button>
                            <p className="text-xs text-[#9AA4B2] text-center">
                              Recording is paused. Click above to start over.
                            </p>
                          </div>
                        )}
                        {!isPaused && (
                          <Button
                            variant="ghost"
                            onClick={() => {
                              stopRecording()
                              handleNewTake()
                            }}
                            className="w-full text-[#9AA4B2] hover:text-[#E6E8EB]"
                          >
                            Discard & Re-record
                          </Button>
                        )}
                      </div>
                    )}

                    {run && !isRecording && (
                      <div className="space-y-3">
                        {audioUrl && (
                          <div>
                            <audio
                              ref={audioRef}
                              src={audioUrl}
                              onEnded={() => setIsPlaying(false)}
                              controls
                              className="w-full"
                            />
                          </div>
                        )}
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={async () => {
                            handleNewTake()
                            // Small delay to ensure state is reset before starting
                            await new Promise(resolve => setTimeout(resolve, 100))
                            if (selectedPrompt && !isSilent) {
                              await startRecording()
                            }
                          }}
                          className="w-full"
                          disabled={!selectedPrompt || isSilent || isUploading || isTranscribing || isGettingFeedback}
                        >
                          <Mic className="mr-2 h-5 w-5" />
                          Record Again
                        </Button>
                      </div>
                    )}

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
                                <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
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
                                <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
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
                                <CheckCircle2 className="h-4 w-4 text-[#22C55E]" />
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

                {error && (
                  <div className="p-3 bg-[#EF444420] border border-[#EF444430] rounded-lg">
                    <p className="text-xs text-[#EF4444] mb-2">{error}</p>
                  </div>
                )}
            </Card>
          </div>

          {/* RIGHT COLUMN: Transcript & Feedback (Wide) */}
          <div className="space-y-8">
            {!run ? (
              <Card className="p-12 text-center">
                <h3 className="text-lg font-semibold text-[#E6E8EB] mb-2">Your transcript will appear here</h3>
                <p className="text-sm text-[#9AA4B2]">Record or upload a short clip to get feedback.</p>
              </Card>
            ) : (
              <>
                {/* Transcript Block */}
                {run.transcript && run.transcript.trim().length > 0 && (
                  <Card className="p-6">
                    <h3 className="text-lg font-semibold text-[#E6E8EB] mb-4">Transcript</h3>
                    {(audioUrl || run.audio_url) && (
                      <div className="mb-4">
                        <audio
                          ref={audioRef}
                          src={audioUrl || run.audio_url || ''}
                          onEnded={() => setIsPlaying(false)}
                          controls
                          className="w-full"
                        />
                      </div>
                    )}
                    <div className="prose prose-invert max-w-none">
                      <p className="text-sm text-[#E6E8EB] whitespace-pre-wrap leading-relaxed">
                        {run.transcript}
                      </p>
                    </div>
                  </Card>
                )}

                {/* Metrics */}
                {run.transcript && run.transcript.trim().length > 0 && (
                  <Card className="p-6">
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xs text-[#9AA4B2] mb-1">Duration</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {(() => {
                            // Use duration_ms as source of truth: local state > DB > audio_seconds
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
                        <p className="text-xs text-[#9AA4B2] mb-1">Words</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {run.word_count || (run.transcript ? run.transcript.trim().split(/\s+/).filter(w => w.length > 0).length : null) || '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9AA4B2] mb-1">WPM</p>
                        <p className="text-lg font-bold text-[#E6E8EB]">
                          {(() => {
                            // Use duration_ms as source of truth for WPM calculation
                            const durationMsForWPM = durationMs 
                              || (run.duration_ms !== null ? run.duration_ms : null)
                              || (run.audio_seconds ? Math.round(run.audio_seconds * 1000) : null)
                            const wpm = calculateWPM(run.transcript, durationMsForWPM)
                            return wpm !== null ? wpm : '—'
                          })()}
                        </p>
                      </div>
                    </div>
                    {(() => {
                      // Use duration_ms as source of truth for WPM interpretation
                      const durationMsForWPM = durationMs 
                        || (run.duration_ms !== null ? run.duration_ms : null)
                        || (run.audio_seconds ? Math.round(run.audio_seconds * 1000) : null)
                      const wpm = calculateWPM(run.transcript, durationMsForWPM)
                      if (wpm !== null) {
                        return (
                          <p className="text-xs text-[#9AA4B2] text-center mt-3">
                            {getWPMInterpretation(wpm)}
                          </p>
                        )
                      } else if (durationMsForWPM && durationMsForWPM < 5000) {
                        return (
                          <p className="text-xs text-[#9AA4B2] text-center mt-3">
                            Record 20–60s for accurate pacing.
                          </p>
                        )
                      }
                      return null
                    })()}
                    {selectedPrompt && (() => {
                      const promptData = PROMPTS.find(p => p.id === selectedPrompt)
                      return promptData?.duration ? (
                        <p className="text-xs text-[#9AA4B2] text-center mt-3">
                          Target: {promptData.duration}
                        </p>
                      ) : null
                    })()}
                  </Card>
                )}

                {/* Preview Feedback (HIGH-LEVEL ONLY) */}
                {(() => {
                  const currentRun = run ?? null
                  if (!currentRun) return null
                  
                  const transcript = currentRun.transcript?.trim() ?? ""
                  const feedbackData = feedback ?? currentRun.analysis_json ?? null
                  
                  if (!feedbackData && transcript.length > 0) {
                    return (
                      <Card className="p-6">
                        <h3 className="text-lg font-semibold text-[#E6E8EB] mb-4">Preview Feedback</h3>
                        <div className="text-center py-6">
                          <p className="text-sm text-[#9AA4B2]">Generating feedback…</p>
                        </div>
                      </Card>
                    )
                  }
                  
                  if (!feedbackData) return null
                  
                  return (
                    <Card className="p-6">
                      <h3 className="text-lg font-semibold text-[#E6E8EB] mb-4">Preview Feedback</h3>
                      
                      {/* Overall Score */}
                      {feedbackData.summary?.overall_score !== undefined && (
                        <div className="mb-6 text-center">
                          <p className="text-xs text-[#9AA4B2] mb-2">Overall Score</p>
                          <div className="text-4xl font-bold text-[#F59E0B]">
                            {Math.round(feedbackData.summary.overall_score)}/10
                          </div>
                        </div>
                      )}
                      
                      {/* Rubric Score Cards */}
                      {feedbackData.rubric_scores && feedbackData.rubric_scores.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs text-[#9AA4B2] mb-3 font-medium uppercase tracking-wide">Criterion Scores</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {feedbackData.rubric_scores.map((score: any, idx: number) => {
                              const criterionLabel = score.criterion_label || score.criterion || `Criterion ${idx + 1}`
                              const scoreValue = score.score || 0
                              return (
                                <div
                                  key={idx}
                                  className="p-3 bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)] rounded-lg"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-[#E6E8EB]">{criterionLabel}</span>
                                    <span className="text-lg font-bold text-[#F59E0B]">{Math.round(scoreValue)}/10</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      
                      {/* Strengths (max 2) */}
                      {feedbackData.summary?.top_strengths && feedbackData.summary.top_strengths.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs text-[#9AA4B2] mb-3 font-medium uppercase tracking-wide">Strengths</p>
                          <ul className="space-y-2">
                            {feedbackData.summary.top_strengths.slice(0, 2).map((strength: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                                <span className="text-[#22C55E] mt-0.5">•</span>
                                <span>{strength.replace(/^["']|["']$/g, '').trim()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      
                      {/* Improvements (max 2) */}
                      {feedbackData.summary?.top_improvements && feedbackData.summary.top_improvements.length > 0 && (
                        <div className="mb-6">
                          <p className="text-xs text-[#9AA4B2] mb-3 font-medium uppercase tracking-wide">Improvements</p>
                          <ul className="space-y-2">
                            {feedbackData.summary.top_improvements.slice(0, 2).map((improvement: string, idx: number) => (
                              <li key={idx} className="flex items-start gap-2 text-sm text-[#E6E8EB]">
                                <span className="text-[#F59E0B] mt-0.5">•</span>
                                <span>{improvement.replace(/^["']|["']$/g, '').trim()}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  )
                })()}

                {/* Deep analysis intentionally hidden on Try Free page. */}


                {/* CTA Button */}
                {(() => {
                  const currentRun = run
                  if (!currentRun || (!feedback && !currentRun.analysis_json)) return null
                  
                  const runId = currentRun.id
                  const hasRun = !!runId
                  
                  return (
                    <Card className="p-6">
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full"
                        disabled={!hasRun}
                        onClick={() => {
                          if (!hasRun) return
                          
                          const runIdToUse = runId
                          if (isAuthenticated) {
                            router.push(`/runs/${runIdToUse}`)
                          } else {
                            router.push(`/signin?redirect=/runs/${runIdToUse}`)
                          }
                        }}
                      >
                        Analyze your results
                      </Button>
                      {!hasRun ? (
                        <p className="text-xs text-[#9AA4B2] text-center mt-3">
                          Record a pitch first.
                        </p>
                      ) : (
                        <p className="text-xs text-[#9AA4B2] text-center mt-3">
                          Sign in to unlock line-by-line coaching, filler words & pause insights, examples, and transcript download.
                        </p>
                      )}
                    </Card>
                  )
                })()}
              </>
            )}

            {/* Debug panel (collapsible) */}
            {DEBUG && (
              <Card className="p-3 bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] mt-6">
                <button
                  onClick={() => setIsDebugExpanded(!isDebugExpanded)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <h4 className="text-xs font-medium text-[#9AA4B2]">Advanced / Debug</h4>
                  {isDebugExpanded ? (
                    <ChevronUp className="h-4 w-4 text-[#9AA4B2]" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-[#9AA4B2]" />
                  )}
                </button>
                {isDebugExpanded && (
                  <div className="space-y-2 text-xs text-[#9AA4B2] mt-4">
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
                    <div className="mt-2 pt-2 border-t border-[rgba(255,255,255,0.08)]">
                      <div className="font-semibold text-[#E6E8EB] mb-1">Last Error:</div>
                      <div className="text-xs space-y-1">
                        <div>Status: {lastError.status} {lastError.statusText}</div>
                        <div>Error: {lastError.error}</div>
                        {lastError.details && <div>Details: {lastError.details}</div>}
                        {lastError.fix && <div>Fix: {lastError.fix}</div>}
                        {lastError.code && <div>Code: {lastError.code}</div>}
                      </div>
                      <pre className="mt-2 p-2 bg-[rgba(255,255,255,0.03)] rounded text-xs overflow-auto max-h-40 font-mono text-[#E6E8EB] border border-[rgba(255,255,255,0.08)]">
                        {JSON.stringify(lastError.fullResponse || lastError, null, 2)}
                      </pre>
                    </div>
                  )}
                  {lastFeedbackResponse && (
                    <div className="mt-2 pt-2 border-t border-[rgba(17,24,39,0.10)]">
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
                      <pre className="mt-2 p-2 bg-[rgba(255,255,255,0.03)] rounded text-xs overflow-auto max-h-40 font-mono text-[#E6E8EB] border border-[rgba(255,255,255,0.08)]">
                        {JSON.stringify(lastFeedbackResponse.data || lastFeedbackResponse, null, 2)}
                      </pre>
                    </div>
                  )}
                  {currentTrackInfo && (
                    <div className="mt-2 pt-2 border-t border-[rgba(17,24,39,0.10)]">
                      <div className="font-semibold text-[#E6E8EB] mb-1">Current Track:</div>
                      <div>Label: {currentTrackInfo.label || 'unknown'}</div>
                      <div>ReadyState: {currentTrackInfo.readyState}</div>
                      <div>Enabled: {currentTrackInfo.enabled ? 'yes' : 'no'}</div>
                      <div>Device ID: {currentTrackInfo.settings?.deviceId?.substring(0, 20) || 'none'}</div>
                    </div>
                  )}
                  {chunkInfo && (
                    <div className="mt-2 pt-2 border-t border-[rgba(17,24,39,0.10)]">
                      <div className="font-semibold text-[#111827] mb-1">Last Recording:</div>
                      <div>Chunks: {chunkInfo.count}</div>
                      <div>Total Size: {(chunkInfo.totalSize / 1024).toFixed(2)} KB</div>
                      <div>Chunk Sizes: {chunkInfo.sizes.map(s => `${(s / 1024).toFixed(1)}KB`).join(', ')}</div>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-[rgba(17,24,39,0.10)]">
                    <div className="font-semibold text-[#111827] mb-1">Available Devices:</div>
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

