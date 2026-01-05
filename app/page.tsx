'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSessionId } from '@/lib/session'

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
    fetch('/api/rubrics')
      .then(res => res.json())
      .then(data => {
        setRubrics(data)
        if (data.length > 0) {
          // Default to "General Pitch (3–5 min)" if it exists, otherwise first rubric
          const generalPitch = data.find((r: Rubric) => r.name.includes('General Pitch'))
          setSelectedRubric(generalPitch?.id || data[0].id)
        }
      })
      .catch(err => {
        console.error('Failed to fetch rubrics:', err)
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

      const response = await fetch('/api/runs/create', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
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

      const { id } = await response.json()
      router.push(`/runs/${id}`)
    } catch (err) {
      console.error('Error submitting:', err)
      setError(err instanceof Error ? err.message : 'Failed to submit pitch')
      setIsUploading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">PitchPractice</h1>
          <p className="text-gray-600">Practice your pitch and get AI-powered feedback</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-red-800 mb-1">Upload Failed</h3>
                <div className="text-sm text-red-700 whitespace-pre-line">{error}</div>
              </div>
            </div>
          </div>
        )}

        {/* 3-Step UI */}
        <div className="space-y-8">
          {/* Step 1: Record/Upload */}
          <div>
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">
                1
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Record or Upload Your Pitch</h2>
            </div>
            <div className="ml-11 space-y-3">
              {/* Microphone Selector */}
              {audioDevices.length > 0 && (
                <div>
                  <label htmlFor="mic-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Microphone
                  </label>
                  <select
                    id="mic-select"
                    value={selectedDeviceId}
                    onChange={(e) => handleDeviceChange(e.target.value)}
                    disabled={isRecording || isUploading}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Test Mic Button */}
              <button
                onClick={testMicrophone}
                disabled={isRecording || isUploading}
                className={`w-full px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
                  isTestingMic
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-gray-500 hover:bg-gray-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed'
                }`}
              >
                {isTestingMic ? '⏹ Stop Test' : '🎤 Test Mic'}
              </button>

              {/* Mic Level Meter */}
              {(isRecording || isTestingMic) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-100 ${
                          micLevel > 0.01 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(micLevel * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-600 w-16 text-right">
                      {(micLevel * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  {/* Debug Info */}
                  <div className="text-xs text-gray-500 space-y-0.5">
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
                    <p className="text-xs text-red-600 font-medium">
                      ⚠️ No microphone input detected
                    </p>
                  )}
                </div>
              )}

              {/* Record/Upload Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isUploading || !selectedRubric || isSilent}
                  className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
                    isRecording
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
                      : 'bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-300 disabled:cursor-not-allowed shadow-md hover:shadow-lg'
                  }`}
                >
                  {isRecording ? '⏹ Stop Recording' : '🎤 Record'}
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isRecording || !selectedRubric}
                  className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-all shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  📁 Upload
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading || isRecording}
              />
              <p className="text-xs text-gray-500 italic">
                💡 Best results: speak clearly, 2–6 minutes.
              </p>
            </div>
          </div>

          {/* Step 2: Pick Rubric */}
          <div>
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">
                2
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Pick Rubric</h2>
            </div>
            <div className="ml-11">
              <select
                id="rubric"
                value={selectedRubric}
                onChange={(e) => setSelectedRubric(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
                disabled={isUploading || isRecording || rubrics.length === 0}
              >
                {rubrics.length === 0 ? (
                  <option value="">Loading rubrics...</option>
                ) : (
                  rubrics.map((rubric) => (
                    <option key={rubric.id} value={rubric.id}>
                      {rubric.name}
                    </option>
                  ))
                )}
              </select>
              {selectedRubric && rubrics.find(r => r.id === selectedRubric) && (
                <p className="mt-2 text-sm text-gray-600">
                  {rubrics.find(r => r.id === selectedRubric)?.description}
                </p>
              )}
            </div>
          </div>

          {/* Step 3: Analyze (auto) */}
          <div>
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-semibold mr-3">
                3
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Get Feedback</h2>
            </div>
            <div className="ml-11">
              <p className="text-sm text-gray-600">
                Your pitch will be automatically transcribed and analyzed. You'll get detailed feedback on your delivery, structure, and pacing.
              </p>
            </div>
          </div>

          {/* Optional Title */}
          <div className="pt-4 border-t border-gray-200">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title (optional)
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="My Pitch Practice"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isUploading || isRecording}
            />
          </div>

          {isUploading && (
            <div className="text-center py-6">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-sm text-gray-600">Uploading and processing...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

