import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store',
          },
        }
      )
    }

    const { data: run, error } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, status, audio_path, transcript, analysis_json, full_feedback, initial_score, initial_summary, analysis_summary_json, error_message, created_at, session_id, title, audio_seconds, duration_ms, word_count, words_per_minute, rubric_id, rubric_snapshot_json, rubrics(*)')
      .eq('id', id)
      .eq('user_id', user.id)
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

// DELETE - Delete a run
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // First, check if run exists and user owns it
    const { data: existingRun, error: fetchError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, user_id, audio_path')
      .eq('id', id)
      .single()

    if (fetchError || !existingRun) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    // Check ownership
    if (existingRun.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Delete audio file from storage if it exists
    if (existingRun.audio_path) {
      const { error: storageError } = await getSupabaseAdmin().storage
        .from('pitchpractice-audio')
        .remove([existingRun.audio_path])
      
      if (storageError) {
        console.error('Failed to delete audio file:', storageError)
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete the run from database
    const { error } = await getSupabaseAdmin()
      .from('pitch_runs')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete run' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

