import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import OpenAI from 'openai'

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is not set')
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

async function getAudioDuration(audioBuffer: Buffer, mimeType: string): Promise<number | null> {
  // In serverless environments, we can't easily extract audio duration
  // We'll try to estimate from file size or leave it null
  // Duration will be calculated from transcript timing if available
  // For now, return null and let OpenAI transcription provide timing info
  try {
    // Try to create an AudioContext to get duration (browser API, won't work in Node)
    // For serverless, we'll estimate or leave null
    // The duration can be updated later from the audio element on the client side
    return null
  } catch (error) {
    console.warn('Could not extract audio duration:', error)
    return null
  }
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length
}

function calculateWPM(wordCount: number, durationSeconds: number | null): number | null {
  if (!durationSeconds || durationSeconds === 0) {
    return null
  }
  return Math.round((wordCount / durationSeconds) * 60)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Fetch the run to get audio_path
    const { data: run, error: fetchError } = await supabaseAdmin
      .from('pitch_runs')
      .select('audio_path, status')
      .eq('id', id)
      .single()

    if (fetchError || !run) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    // Allow transcription if status is 'uploaded' OR if status is 'transcribed' but transcript is missing (retry case)
    if (run.status !== 'uploaded' && run.status !== 'transcribed') {
      return NextResponse.json(
        { error: `Cannot transcribe run with status '${run.status}'. Only runs with status 'uploaded' or 'transcribed' (for retry) can be transcribed.` },
        { status: 400 }
      )
    }

    // If already transcribed, check if we have a transcript
    if (run.status === 'transcribed') {
      const { data: existingRun } = await supabaseAdmin
        .from('pitch_runs')
        .select('transcript')
        .eq('id', id)
        .single()
      
      if (existingRun?.transcript) {
        return NextResponse.json(
          { error: 'Run is already transcribed. Delete and recreate if you want to re-transcribe.' },
          { status: 400 }
        )
      }
      // If no transcript exists, allow retry by resetting status
      await supabaseAdmin
        .from('pitch_runs')
        .update({ status: 'uploaded' })
        .eq('id', id)
    }

    // Download audio from Supabase Storage
    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('pitchpractice-audio')
      .download(run.audio_path)

    if (downloadError || !audioData) {
      await supabaseAdmin
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: 'Failed to download audio file',
        })
        .eq('id', id)

      return NextResponse.json(
        { error: 'Failed to download audio file' },
        { status: 500 }
      )
    }

    // Convert Blob to Buffer
    const arrayBuffer = await audioData.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    // Determine MIME type from file extension
    const fileExt = run.audio_path.split('.').pop()?.toLowerCase() || 'webm'
    const mimeTypeMap: Record<string, string> = {
      webm: 'audio/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
    }
    const mimeType = mimeTypeMap[fileExt] || 'audio/webm'

    // Get audio duration - in serverless, we can't easily extract this
    // Duration will be null initially and can be updated from client-side audio element
    // or we can estimate from file size (rough approximation)
    let audioSeconds: number | null = null
    
    // Rough estimation: webm files are typically ~1KB per second for speech
    // This is very approximate and should be replaced with client-side measurement
    try {
      const fileSizeKB = audioBuffer.length / 1024
      // Very rough estimate: ~1KB per second for compressed speech audio
      // This is just a fallback - actual duration should come from client
      audioSeconds = Math.round(fileSizeKB / 1.0) // Will be updated by client
    } catch (error) {
      console.warn('Could not estimate audio duration:', error)
    }

    // Transcribe with OpenAI Whisper
    let transcript: string
    try {
      // Create a File-like object for OpenAI
      const audioFile = new File([audioBuffer], `audio.${fileExt}`, { type: mimeType })

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en', // Optional: specify language
      })

      transcript = transcription.text
    } catch (error: any) {
      console.error('OpenAI transcription error:', error)
      
      await supabaseAdmin
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: error.message || 'Transcription failed',
        })
        .eq('id', id)

      return NextResponse.json(
        { error: 'Transcription failed', details: error.message },
        { status: 500 }
      )
    }

    // Calculate word count and WPM
    const wordCount = countWords(transcript)
    const wpm = calculateWPM(wordCount, audioSeconds)

    // Update the run with transcript and timing data
    const { error: updateError } = await supabaseAdmin
      .from('pitch_runs')
      .update({
        transcript,
        audio_seconds: audioSeconds,
        word_count: wordCount,
        words_per_minute: wpm,
        status: 'transcribed',
        error_message: null,
      })
      .eq('id', id)

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update run with transcript' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      transcript,
      audio_seconds: audioSeconds,
      word_count: wordCount,
      wpm,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)

    // Try to update status to error
    try {
      await supabaseAdmin
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: error.message || 'Unexpected error during transcription',
        })
        .eq('id', params.id)
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr)
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

