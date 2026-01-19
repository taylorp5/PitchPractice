import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

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

function calculateWPM(wordCount: number, durationMs: number | null): number | null {
  if (!durationMs || durationMs === 0) {
    return null
  }
  // WPM = word_count / (duration_ms / 60000)
  return Math.round(wordCount / (durationMs / 60000))
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const startTime = Date.now()
  const { id } = params
  const timing = {
    downloadMs: 0,
    openAiMs: 0,
    dbWriteMs: 0,
    totalMs: 0,
  }

  try {
    // Fetch the run to get current status, transcript length, and duration_ms BEFORE doing any work
    const { data: run, error: fetchError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, audio_path, status, transcript, duration_ms, audio_seconds')
      .eq('id', id)
      .single()

    if (fetchError || !run) {
      console.error('[Transcribe] Run not found:', {
        runId: id,
        error: fetchError,
      })
      return NextResponse.json(
        { 
          ok: false,
          transcriptLen: 0,
          bytesDownloaded: 0,
          mime: null,
          message: 'Run not found'
        },
        { status: 404 }
      )
    }

    // Log and return current state BEFORE doing any work
    const transcriptLenBefore = run.transcript?.length || 0
    const statusBefore = run.status
    
    console.log('[Transcribe] Starting transcription - current state:', {
      runId: id,
      statusBefore,
      transcriptLenBefore,
      willOverwrite: transcriptLenBefore > 0,
    })

    // Set status to 'transcribing' immediately
    await getSupabaseAdmin()
      .from('pitch_runs')
      .update({ status: 'transcribing' })
      .eq('id', id)

    // Always proceed - no blocking behavior
    // We will overwrite transcript, status, and clear error_message on success

    // Download audio from Supabase Storage using service role key
    console.log('[Transcribe] Downloading audio from storage:', {
      runId: id,
      audioPath: run.audio_path,
      bucket: 'pitchpractice-audio',
    })

    const downloadStart = Date.now()
    const { data: audioData, error: downloadError } = await getSupabaseAdmin().storage
      .from('pitchpractice-audio')
      .download(run.audio_path)
    timing.downloadMs = Date.now() - downloadStart

    if (downloadError || !audioData) {
      console.error('[Transcribe] Storage download failed:', {
        runId: id,
        audioPath: run.audio_path,
        error: downloadError,
        errorMessage: downloadError?.message,
        errorStatus: (downloadError as any)?.statusCode,
      })
      
      await getSupabaseAdmin()
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: `Failed to download audio file: ${downloadError?.message || 'Unknown error'}`,
        })
        .eq('id', id)

      return NextResponse.json(
        { 
          ok: false,
          transcriptLen: 0,
          bytesDownloaded: 0,
          mime: null,
          message: `Failed to download audio file: ${downloadError?.message || 'Unknown storage error'}`,
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

    // Use duration_ms from database as source of truth, fallback to audio_seconds, then estimate
    let audioSeconds: number | null = null
    if (run.duration_ms !== null && run.duration_ms > 0) {
      // Use duration_ms as source of truth
      audioSeconds = run.duration_ms / 1000
      console.log('[Transcribe] Using duration_ms from database:', {
        runId: id,
        durationMs: run.duration_ms,
        audioSeconds,
      })
    } else if (run.audio_seconds !== null && run.audio_seconds > 0) {
      // Fallback to audio_seconds if duration_ms not available
      audioSeconds = run.audio_seconds
      console.log('[Transcribe] Using audio_seconds from database:', {
        runId: id,
        audioSeconds,
      })
    } else {
      // Last resort: estimate from file size (not reliable)
      try {
        const fileSizeKB = bytes / 1024
        // Rough estimate: ~1KB per second for compressed speech audio
        audioSeconds = Math.round(fileSizeKB / 1.0)
        console.warn('[Transcribe] Estimating duration from file size (unreliable):', {
          runId: id,
          fileSizeKB,
          estimatedSeconds: audioSeconds,
        })
      } catch (error) {
        console.warn('[Transcribe] Could not estimate audio duration:', error)
      }
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

      const openai = getOpenAIClient()
      const openAiStart = Date.now()
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
      })
      timing.openAiMs = Date.now() - openAiStart

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
        
        await getSupabaseAdmin()
          .from('pitch_runs')
          .update({
            status: 'error',
            error_message: 'Empty transcript returned from OpenAI',
          })
          .eq('id', id)

        return NextResponse.json(
          { 
            ok: false,
            transcriptLen: 0,
            bytesDownloaded: bytes,
            mime: mimeType,
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
      
      await getSupabaseAdmin()
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: `OpenAI transcription failed: ${errorMessage} (status: ${statusCode})`,
        })
        .eq('id', id)

      return NextResponse.json(
        { 
          ok: false,
          transcriptLen: 0,
          bytesDownloaded: bytes,
          mime: mimeType,
          message: `OpenAI transcription failed: ${errorMessage}`,
        },
        { status: statusCode >= 400 && statusCode < 600 ? statusCode : 500 }
      )
    }

    // Calculate word count and WPM
    // Use duration_ms as source of truth if available, otherwise fallback to audioSeconds
    const durationMsForWPM = run.duration_ms || (audioSeconds ? Math.round(audioSeconds * 1000) : null)
    const wordCount = countWords(transcript)
    const wpm = calculateWPM(wordCount, durationMsForWPM)

    console.log('[Transcribe] Calculated metrics:', {
      runId: id,
      wordCount,
      wpm,
      audioSeconds,
      transcriptLength: transcript.length,
    })

    // Update the run with transcript and timing data
    // IMPORTANT: Only update status to 'transcribed' AFTER successful transcription is saved
    // Use service role client (getSupabaseAdmin()) which bypasses RLS
    const dbWriteStart = Date.now()
    const { data: updatedRun, error: updateError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .update({
        transcript,
        audio_seconds: audioSeconds, // Keep for backward compatibility
        // Preserve duration_ms if it exists (don't overwrite with calculated value)
        word_count: wordCount,
        words_per_minute: wpm,
        status: 'transcribed', // Status changes ONLY after successful save
        error_message: null,
      })
      .eq('id', id)
      .select('*')
      .single()
    timing.dbWriteMs = Date.now() - dbWriteStart

    if (updateError) {
      const errorMessage = (updateError as any)?.message || 'Unknown database error'
      const errorCode = (updateError as any)?.code || 'UNKNOWN'
      
      console.error('[Transcribe] Database update error:', {
        runId: id,
        error: updateError,
        message: errorMessage,
        code: errorCode,
      })
      
      return NextResponse.json(
        { 
          ok: false,
          transcriptLen: transcript.length,
          bytesDownloaded: bytes,
          mime: mimeType,
          message: `Failed to save transcript: ${errorMessage}`,
          error: 'Database update failed',
          details: errorMessage,
        },
        { status: 500 }
      )
    }

    // Verify the update succeeded
    if (!updatedRun || !updatedRun.transcript) {
      console.error('[Transcribe] Update succeeded but transcript missing in response:', {
        runId: id,
        hasUpdatedRun: !!updatedRun,
        hasTranscript: !!updatedRun?.transcript,
      })
      
      return NextResponse.json(
        { 
          ok: false,
          transcriptLen: transcript.length,
          bytesDownloaded: bytes,
          mime: mimeType,
          message: 'Transcript saved but verification failed',
          error: 'Update verification failed',
          details: 'The transcript was saved but could not be verified in the response',
        },
        { status: 500 }
      )
    }

    console.log('[Transcribe] Transcript saved successfully:', {
      runId: id,
      status: updatedRun.status,
      transcriptLength: updatedRun.transcript.length,
      wordCount: updatedRun.word_count,
      wpm: updatedRun.words_per_minute,
    })

    // Log update result for debugging
    console.log('TRANSCRIBE UPDATE RESULT', {
      id,
      error: updateError,
      saved: !!updatedRun,
      status: updatedRun?.status,
      transcriptLen: updatedRun?.transcript?.length,
    })

    if (updateError) {
      const errorMessage = (updateError as any)?.message || 'Unknown database error'
      const errorCode = (updateError as any)?.code || 'UNKNOWN'
      
      console.error('[Transcribe] Database update error:', {
        runId: id,
        error: updateError,
        message: errorMessage,
        code: errorCode,
      })
      
      return NextResponse.json(
        { 
          ok: false,
          transcriptLen: transcript.length,
          bytesDownloaded: bytes,
          mime: mimeType,
          message: `Failed to save transcript: ${errorMessage}`,
          error: 'Database update failed',
          details: errorMessage,
        },
        { status: 500 }
      )
    }

    if (!updatedRun) {
      console.error('[Transcribe] Run not found after update:', {
        runId: id,
      })
      return NextResponse.json(
        { 
          ok: false,
          transcriptLen: transcript.length,
          bytesDownloaded: bytes,
          mime: mimeType,
          message: 'Run not found for update',
          id,
        },
        { status: 404 }
      )
    }

    const statusAfter = 'transcribed'
    const duration = Date.now() - startTime
    timing.totalMs = duration
    
    console.log("UPDATED ROW TRANSCRIPT PREVIEW", updatedRun.transcript?.slice(0, 80))
    
    console.log('[Transcribe] Success:', {
      runId: id,
      transcriptLength: transcript.length,
      wordCount,
      wpm,
      durationMs: duration,
      statusBefore,
      statusAfter,
      savedStatus: updatedRun.status,
      savedTranscriptLen: updatedRun.transcript?.length,
    })
    console.log('[Transcribe] Timing breakdown ms:', {
      runId: id,
      download_ms: timing.downloadMs,
      transcription_ms: timing.openAiMs,
      db_write_ms: timing.dbWriteMs,
      total_ms: timing.totalMs,
    })

    return NextResponse.json({
      ok: true,
      run: updatedRun,
      transcript: updatedRun.transcript,
      transcriptLen: updatedRun.transcript?.length || 0,
      bytesDownloaded: bytes,
      mime: mimeType,
      message: 'Transcription completed successfully',
      savedStatus: updatedRun.status,
      savedTranscriptLen: updatedRun.transcript?.length,
      runId: updatedRun.id,
    })
  } catch (error: any) {
    const duration = Date.now() - startTime
    timing.totalMs = duration
    console.error('[Transcribe] Unexpected error:', {
      runId: id,
      error,
      message: error?.message,
      stack: error?.stack,
      durationMs: duration,
    })
    console.log('[Transcribe] Timing breakdown ms (error):', {
      runId: id,
      download_ms: timing.downloadMs,
      transcription_ms: timing.openAiMs,
      db_write_ms: timing.dbWriteMs,
      total_ms: timing.totalMs,
    })

    // Try to update status to error
    try {
      await getSupabaseAdmin()
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
        transcriptLen: 0,
        bytesDownloaded: 0,
        mime: null,
        message: error?.message || 'An unexpected error occurred during transcription',
      },
      { status: 500 }
    )
  }
}

