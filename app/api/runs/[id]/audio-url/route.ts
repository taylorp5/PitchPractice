import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Fetch the run to get audio_path
    const { data: run, error: fetchError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('audio_path')
      .eq('id', id)
      .single()

    if (fetchError || !run || !run.audio_path) {
      return NextResponse.json(
        { error: 'Run not found or no audio path' },
        { status: 404 }
      )
    }

    // Generate fresh signed URL (60 minutes expiry)
    const { data: signedUrlData, error: urlError } = await getSupabaseAdmin().storage
      .from('pitchpractice-audio')
      .createSignedUrl(run.audio_path, 3600)

    if (urlError || !signedUrlData?.signedUrl) {
      console.error('[Audio URL] Failed to generate signed URL:', {
        path: run.audio_path,
        error: urlError,
        message: urlError?.message,
      })
      return NextResponse.json(
        { error: 'Failed to generate audio URL', details: urlError?.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
    })
  } catch (error: any) {
    console.error('[Audio URL] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

