import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

/**
 * POST /api/runs/[id]/chunks/[chunkId]/transcribe
 * Transcribe a specific chunk
 * Coach-only feature
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; chunkId: string } }
) {
  try {
    const { id: runId, chunkId } = params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify run exists and user owns it
    const { data: run, error: runError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id')
      .eq('id', runId)
      .single()

    if (runError || !run) {
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (run.user_id !== user.id) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Fetch chunk
    const { data: chunk, error: chunkError } = await getSupabaseAdmin()
      .from('run_chunks')
      .select('*')
      .eq('id', chunkId)
      .eq('run_id', runId)
      .single()

    if (chunkError || !chunk) {
      return NextResponse.json(
        { ok: false, error: 'Chunk not found' },
        { status: 404 }
      )
    }

    // Update status to transcribing
    await getSupabaseAdmin()
      .from('run_chunks')
      .update({ status: 'transcribing' })
      .eq('id', chunkId)

    // Download audio from storage
    const { data: audioData, error: downloadError } = await getSupabaseAdmin().storage
      .from('pitchpractice-audio')
      .download(chunk.audio_path)

    if (downloadError || !audioData) {
      console.error('[Chunk Transcribe] Download error:', downloadError)
      await getSupabaseAdmin()
        .from('run_chunks')
        .update({
          status: 'error',
          error_message: 'Failed to download chunk audio',
        })
        .eq('id', chunkId)

      return NextResponse.json(
        { ok: false, error: 'Failed to download chunk audio' },
        { status: 500 }
      )
    }

    // Convert to buffer
    const arrayBuffer = await audioData.arrayBuffer()
    const audioBuffer = Buffer.from(arrayBuffer)

    // Determine file extension and mime type
    const fileExt = chunk.audio_path.split('.').pop() || 'webm'
    let mimeType = 'audio/webm'
    if (fileExt === 'mp3' || fileExt === 'mpeg') {
      mimeType = 'audio/mpeg'
    } else if (fileExt === 'wav') {
      mimeType = 'audio/wav'
    } else if (fileExt === 'ogg') {
      mimeType = 'audio/ogg'
    }

    // Transcribe with OpenAI Whisper
    let transcript: string
    try {
      const fileName = `${chunkId}.${fileExt}`
      const audioFile = new File([audioBuffer], fileName, { 
        type: mimeType 
      })

      const openaiApiKey = process.env.OPENAI_API_KEY
      if (!openaiApiKey) {
        throw new Error('OPENAI_API_KEY is not configured')
      }
      const openai = new OpenAI({ apiKey: openaiApiKey })
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'en',
      })

      transcript = transcription.text

      if (!transcript || transcript.trim().length === 0) {
        await getSupabaseAdmin()
          .from('run_chunks')
          .update({
            status: 'error',
            error_message: 'Empty transcript returned from OpenAI',
          })
          .eq('id', chunkId)

        return NextResponse.json(
          { ok: false, error: 'Empty transcript returned' },
          { status: 500 }
        )
      }
    } catch (error: any) {
      console.error('[Chunk Transcribe] OpenAI error:', error)
      await getSupabaseAdmin()
        .from('run_chunks')
        .update({
          status: 'error',
          error_message: error?.message || 'Transcription failed',
        })
        .eq('id', chunkId)

      return NextResponse.json(
        { ok: false, error: error?.message || 'Transcription failed' },
        { status: 500 }
      )
    }

    // Update chunk with transcript
    const { data: updatedChunk, error: updateError } = await getSupabaseAdmin()
      .from('run_chunks')
      .update({
        transcript,
        status: 'transcribed',
        error_message: null,
      })
      .eq('id', chunkId)
      .select('*')
      .single()

    if (updateError) {
      console.error('[Chunk Transcribe] Update error:', updateError)
      return NextResponse.json(
        { ok: false, error: 'Failed to update chunk' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      chunk: updatedChunk,
      transcript,
    })
  } catch (error) {
    console.error('[Chunk Transcribe] Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

