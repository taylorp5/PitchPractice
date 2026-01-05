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
  const startTime = Date.now()
  const { id } = params
  
  // Check for force parameter - use request.nextUrl if available, otherwise construct URL
  let forceUsed = false
  try {
    if (request.nextUrl) {
      forceUsed = request.nextUrl.searchParams.get('force') === '1'
    } else {
      const url = new URL(request.url)
      forceUsed = url.searchParams.get('force') === '1'
    }
  } catch (err) {
    console.warn('[Transcribe] Could not parse force parameter:', err)
  }

  console.log('TRANSCRIBE', { 
    id, 
    forceUsed, 
    url: request.url,
    nextUrl: request.nextUrl?.toString(),
  })

  try {
    console.log('[Transcribe] Starting transcription:', {
      runId: id,
      forceUsed,
      timestamp: new Date().toISOString(),
    })

    // Fetch the run to get audio_path, status, and transcript
    const { data: run, error: fetchError } = await supabaseAdmin
      .from('pitch_runs')
      .select('audio_path, status, transcript')
      .eq('id', id)
      .single()

    if (fetchError || !run) {
      console.error('[Transcribe] Run not found:', {
        runId: id,
        error: fetchError,
      })
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { status: 404 }
      )
    }

    const transcriptLen = run.transcript?.length || 0
    const statusBefore = run.status
    
    console.log('TRANSCRIBE', { 
      id, 
      forceUsed, 
      transcriptLen, 
      status: statusBefore,
      hasTranscript: !!run.transcript,
      transcriptTrimmed: run.transcript?.trim().length || 0,
    })

    console.log('[Transcribe] Run details:', {
      runId: id,
      status: statusBefore,
      transcriptLength: transcriptLen,
      audioPath: run.audio_path,
    })

    // Guard logic: if (!forceUsed && transcript && transcript.trim().length > 0) => block
    // If forceUsed is true, NEVER block. Even if transcript exists.
    const hasValidTranscript = run.transcript && run.transcript.trim().length > 0
    const blocked = !forceUsed && hasValidTranscript
    
    if (blocked) {
      console.log('[Transcribe] Already transcribed, blocking:', {
        runId: id,
        transcriptLength: run.transcript.length,
        forceUsed,
      })
      return NextResponse.json(
        { 
          ok: false,
          forceUsed: false,
          blocked: true,
          transcriptLen,
          statusBefore,
          statusAfter: statusBefore,
          error: 'Run is already transcribed. Use ?force=1 to re-transcribe.',
        },
        { status: 400 }
      )
    }

    console.log('[Transcribe] Proceeding with transcription:', {
      runId: id,
      forceUsed,
      hasValidTranscript,
      willOverwrite: hasValidTranscript && forceUsed,
    })

    // If status is not 'uploaded', reset it (allows retry)
    if (run.status !== 'uploaded') {
      console.log('[Transcribe] Resetting status to uploaded:', {
        runId: id,
        oldStatus: run.status,
      })
      await supabaseAdmin
        .from('pitch_runs')
        .update({ status: 'uploaded' })
        .eq('id', id)
    }

    // Download audio from Supabase Storage using service role key
    console.log('[Transcribe] Downloading audio from storage:', {
      runId: id,
      audioPath: run.audio_path,
      bucket: 'pitchpractice-audio',
    })

    const { data: audioData, error: downloadError } = await supabaseAdmin.storage
      .from('pitchpractice-audio')
      .download(run.audio_path)

    if (downloadError || !audioData) {
      console.error('[Transcribe] Storage download failed:', {
        runId: id,
        audioPath: run.audio_path,
        error: downloadError,
        errorMessage: downloadError?.message,
        errorStatus: (downloadError as any)?.statusCode,
      })
      
      await supabaseAdmin
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: `Failed to download audio file: ${downloadError?.message || 'Unknown error'}`,
        })
        .eq('id', id)

      return NextResponse.json(
        { 
          ok: false,
          error: 'Failed to download audio file',
          details: downloadError?.message || 'Unknown storage error',
        },
        { status: 500 }
      )
    }

    // Convert Blob to Buffer
    const arrayBuffer = await audioData.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)
    const bytes = audioBuffer.length

    console.log('[Transcribe] Audio downloaded:', {
      runId: id,
      bytes,
      bytesKB: (bytes / 1024).toFixed(2),
      blobType: audioData.type,
      blobSize: audioData.size,
    })

    // Determine file extension and MIME type
    const fileExt = run.audio_path.split('.').pop()?.toLowerCase() || 'webm'
    const mimeTypeMap: Record<string, string> = {
      webm: 'audio/webm',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      m4a: 'audio/mp4',
      ogg: 'audio/ogg',
    }
    
    // Use blob.type if available, otherwise infer from extension
    const detectedMime = audioData.type || mimeTypeMap[fileExt] || 'audio/webm'
    const mimeType = detectedMime

    console.log('[Transcribe] Audio file details:', {
      runId: id,
      fileExt,
      detectedMime,
      mimeType,
      bytes,
    })

    // Get audio duration estimate
    let audioSeconds: number | null = null
    try {
      const fileSizeKB = bytes / 1024
      // Rough estimate: ~1KB per second for compressed speech audio
      audioSeconds = Math.round(fileSizeKB / 1.0)
    } catch (error) {
      console.warn('[Transcribe] Could not estimate audio duration:', error)
    }

    // Transcribe with OpenAI Whisper
    let transcript: string
    try {
      // Create File object with correct name and type
      const fileName = `${id}.${fileExt}`
      const audioFile = new File([audioBuffer], fileName, { 
        type: mimeType 
      })

      console.log('[Transcribe] Calling OpenAI Whisper:', {
        runId: id,
        fileName,
        fileSize: audioFile.size,
        fileType: audioFile.type,
        model: 'whisper-1',
      })

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
      })

      transcript = transcription.text

      console.log('[Transcribe] OpenAI response received:', {
        runId: id,
        transcriptLength: transcript.length,
        transcriptPreview: transcript.substring(0, 100),
      })

      // Validate transcript is not empty
      if (!transcript || transcript.trim().length === 0) {
        console.error('[Transcribe] Empty transcript returned:', {
          runId: id,
        })
        
        await supabaseAdmin
          .from('pitch_runs')
          .update({
            status: 'error',
            error_message: 'Empty transcript returned from OpenAI',
          })
          .eq('id', id)

        return NextResponse.json(
          { 
            ok: false,
            forceUsed,
            blocked: false,
            transcriptLen: 0,
            statusBefore: run.status,
            statusAfter: 'error',
            error: 'Empty transcript returned',
            message: 'OpenAI returned an empty transcript. The audio file may be corrupted or silent.',
          },
          { status: 500 }
        )
      }

    } catch (error: any) {
      const statusCode = error?.status || error?.response?.status || 500
      const errorMessage = error?.message || 'Unknown OpenAI error'
      const errorDetails = error?.error?.message || error?.response?.data || errorMessage

      console.error('[Transcribe] OpenAI transcription error:', {
        runId: id,
        statusCode,
        errorMessage,
        errorDetails,
        error: JSON.stringify(error, null, 2),
      })
      
      await supabaseAdmin
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: `OpenAI transcription failed: ${errorMessage} (status: ${statusCode})`,
        })
        .eq('id', id)

      return NextResponse.json(
        { 
          ok: false,
          forceUsed,
          blocked: false,
          transcriptLen: run.transcript?.length || 0,
          statusBefore: run.status,
          statusAfter: 'error',
          error: 'Transcription failed',
          message: errorMessage,
          statusCode,
          details: errorDetails,
        },
        { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
      )
    }

    // Calculate word count and WPM
    const wordCount = countWords(transcript)
    const wpm = calculateWPM(wordCount, audioSeconds)

    console.log('[Transcribe] Calculated metrics:', {
      runId: id,
      wordCount,
      wpm,
      audioSeconds,
      transcriptLength: transcript.length,
    })

    // Update the run with transcript and timing data
    // IMPORTANT: Only update status to 'transcribed' AFTER successful transcription is saved
    const { error: updateError } = await supabaseAdmin
      .from('pitch_runs')
      .update({
        transcript,
        audio_seconds: audioSeconds,
        word_count: wordCount,
        words_per_minute: wpm,
        status: 'transcribed', // Status changes ONLY after successful save
        error_message: null,
      })
      .eq('id', id)

    if (updateError) {
      console.error('[Transcribe] Database update error:', {
        runId: id,
        error: updateError,
        message: updateError.message,
      })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Failed to update run with transcript',
          details: updateError.message,
        },
        { status: 500 }
      )
    }

    const statusAfter = 'transcribed'
    const duration = Date.now() - startTime
    
    console.log('TRANSCRIBE', { 
      id, 
      forceUsed, 
      blocked: false,
      transcriptLen: transcript.length, 
      statusBefore,
      statusAfter,
    })
    
    console.log('[Transcribe] Success:', {
      runId: id,
      transcriptLength: transcript.length,
      wordCount,
      wpm,
      durationMs: duration,
      forceUsed,
    })

    return NextResponse.json({
      ok: true,
      forceUsed,
      blocked: false,
      transcriptLen: transcript.length,
      statusBefore,
      statusAfter,
      bytes,
      mime: mimeType,
      word_count: wordCount,
      wpm,
      audio_seconds: audioSeconds,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    console.error('[Transcribe] Unexpected error:', {
      runId: id,
      error,
      message: error?.message,
      stack: error?.stack,
      durationMs: duration,
    })

    // Try to update status to error
    try {
      await supabaseAdmin
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: error?.message || 'Unexpected error during transcription',
        })
        .eq('id', id)
    } catch (updateErr) {
      console.error('[Transcribe] Failed to update error status:', updateErr)
    }

    return NextResponse.json(
      { 
        ok: false,
        error: 'Internal server error',
        message: error?.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}

