import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: run, error } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, status, audio_path, transcript, analysis_json, error_message, created_at, session_id, title, audio_seconds, duration_ms, word_count, words_per_minute, rubric_id, rubrics(*)')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { ok: false, error: 'Run not found' },
        { 
          status: 404,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    // Generate signed URL for audio
    if (run.audio_path) {
      const { data: signedUrlData, error: urlError } = await getSupabaseAdmin().storage
        .from('pitchpractice-audio')
        .createSignedUrl(run.audio_path, 3600) // 1 hour expiry

      if (urlError) {
        console.error('[Audio URL] Failed to generate signed URL:', {
          path: run.audio_path,
          error: urlError,
          message: urlError.message,
        })
      }

      if (!signedUrlData?.signedUrl) {
        console.error('[Audio URL] No signed URL returned:', {
          path: run.audio_path,
          signedUrlData,
        })
      }

      return NextResponse.json(
        {
          ok: true,
          run: {
            ...run,
            audio_url: signedUrlData?.signedUrl || null,
          },
        },
        {
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        run,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  }
}

