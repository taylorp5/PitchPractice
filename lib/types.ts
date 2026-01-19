export interface Rubric {
  id: string
  name: string
  description: string | null
  criteria: Array<{
    name: string
    description: string
  }>
  target_duration_seconds: number | null
  max_duration_seconds: number | null
  created_at: string
}

export interface PitchRun {
  id: string
  session_id: string
  created_at: string
  title: string | null
  audio_path: string
  audio_seconds: number | null
  transcript: string | null
  analysis_json: any
  analysis_summary_json?: any
  full_feedback?: any
  initial_score?: number | null
  initial_summary?: string | null
  status: 'uploaded' | 'transcribed' | 'fast_analyzed' | 'analyzed' | 'error'
  error_message: string | null
  rubric_id: string
  rubrics?: Rubric | null
  audio_url?: string | null
}

export interface RunChunk {
  id: string
  run_id: string
  chunk_index: number
  start_ms: number
  end_ms: number
  audio_path: string
  transcript: string | null
  status: 'uploaded' | 'transcribing' | 'transcribed' | 'error'
  error_message: string | null
  created_at: string
}





