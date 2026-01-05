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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  }, [])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        // Ensure we create a proper WebM file with correct MIME type
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm;codecs=opus' 
        })
        handleSubmit(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (err) {
      console.error('Error starting recording:', err)
      setError('Failed to start recording. Please check microphone permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
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
      
      // Convert Blob to File if needed - ensure .webm extension and correct type
      const file = audioFile instanceof File 
        ? audioFile 
        : new File([audioFile], 'recording.webm', { 
            type: audioFile.type || 'audio/webm;codecs=opus' 
          })
      
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
              <div className="flex gap-3">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isUploading || !selectedRubric}
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

