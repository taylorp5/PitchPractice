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
  status: 'uploaded' | 'transcribed' | 'analyzed' | 'error'
  error_message: string | null
  rubric_id: string
  rubrics?: Rubric | null
  audio_url?: string | null
}





