'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'
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

export default function HomePage() {
  const router = useRouter()
  const [rubrics, setRubrics] = useState<Rubric[]>([])
  const [selectedRubric, setSelectedRubric] = useState<string>('')
  const [title, setTitle] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [micLevel, setMicLevel] = useState<number>(0)
  const [isSilent, setIsSilent] = useState(false)
  const [isTestingMic, setIsTestingMic] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const silenceStartRef = useRef<number | null>(null)
  const testAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
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
        setRubrics(data)
        if (data.length > 0) {
          // Default to "General Pitch (3–5 min)" if it exists, otherwise first rubric
          const generalPitch = data.find((r: Rubric) => r.name.includes('General Pitch'))
          setSelectedRubric(generalPitch?.id || data[0].id)
        }
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
  }, [])

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

      mediaRecorder.start()
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0F14] to-[#0F172A] py-12 px-4">
      <div className="max-w-[1100px] mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-12">
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

        {/* 3-Step UI */}
        <div className="space-y-6">
          {/* Step 1: Record/Upload */}
          <Card>
            <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 1</span>
                </div>
                <h2 className="text-xl font-bold text-[#E6E8EB]">Record or Upload Your Pitch</h2>
                <p className="text-sm text-[#9AA4B2] mt-0.5">Choose your preferred method</p>
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

              {/* Record/Upload Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isUploading || !selectedRubric || isSilent}
                  variant={isRecording ? 'danger' : 'primary'}
                  className="flex-1"
                >
                  {isRecording ? '⏹ Stop Recording' : '🎤 Record'}
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isRecording || !selectedRubric}
                  variant="secondary"
                  className="flex-1"
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
              </p>
            </div>
          </Card>

          {/* Step 2: Pick Rubric */}
          <Card>
            <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 2</span>
                </div>
                <h2 className="text-xl font-bold text-[#E6E8EB]">Pick Rubric</h2>
                <p className="text-sm text-[#9AA4B2] mt-0.5">Select evaluation criteria</p>
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
                  rubrics.map((rubric) => (
                    <option key={rubric.id} value={rubric.id} className="bg-[#121826]">
                      {rubric.name}
                    </option>
                  ))
                )}
              </select>
              {selectedRubric && rubrics.find(r => r.id === selectedRubric) && (
                <p className="mt-3 text-sm text-[#9AA4B2]">
                  {rubrics.find(r => r.id === selectedRubric)?.description}
                </p>
              )}
            </div>
          </Card>

          {/* Step 3: Get Feedback (auto) */}
          <Card>
            <div className="flex items-center mb-6 pb-4 border-b border-[rgba(255,255,255,0.08)]">
              <div className="flex-shrink-0 w-px h-8 bg-gradient-to-b from-[#F59E0B] to-[#D97706] mr-4"></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-[#9AA4B2] uppercase tracking-wider">Step 3</span>
                </div>
                <h2 className="text-xl font-bold text-[#E6E8EB]">Get Feedback</h2>
                <p className="text-sm text-[#9AA4B2] mt-0.5">AI-powered feedback</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-[#9AA4B2]">
                Your pitch will be automatically transcribed and analyzed. You'll get detailed feedback on your delivery, structure, and pacing.
              </p>
            </div>
          </Card>

          {/* Optional Title */}
          <Card>
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
          </Card>

          {isUploading && (
            <Card className="text-center">
              <LoadingSpinner size="lg" text="Uploading and processing..." />
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

