import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Reset transcription data
    const { data: updatedRun, error: updateError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .update({
        transcript: null,
        analysis_json: null,
        status: 'uploaded',
        error_message: null,
        word_count: null,
        words_per_minute: null,
        audio_seconds: null,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('[Reset] Failed:', {
        runId: id,
        error: updateError,
        message: updateError.message,
      })
      return NextResponse.json(
        { error: 'Failed to reset transcription', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Transcription reset successfully',
      run: updatedRun,
    })
  } catch (error: any) {
    console.error('[Reset] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    )
  }
}

