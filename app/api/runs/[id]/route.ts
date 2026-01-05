import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const { data: run, error } = await supabaseAdmin
      .from('pitch_runs')
      .select('*, rubrics(*)')
      .eq('id', id)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    // Generate signed URL for audio
    if (run.audio_path) {
      const { data: signedUrlData, error: urlError } = await supabaseAdmin.storage
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

      return NextResponse.json({
        ...run,
        audio_url: signedUrlData?.signedUrl || null,
      })
    }

    return NextResponse.json(run)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

