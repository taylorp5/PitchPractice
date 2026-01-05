import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const rubricId = formData.get('rubric_id') as string
    const sessionId = formData.get('session_id') as string
    const title = formData.get('title') as string | null

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file is required' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    if (!rubricId) {
      return NextResponse.json(
        { error: 'Rubric ID is required' },
        { status: 400 }
      )
    }

    // Generate run ID
    const runId = uuidv4()
    
    // Determine file extension
    const fileExt = audioFile.name.split('.').pop() || 'webm'
    const audioPath = `${sessionId}/${runId}.${fileExt}`

    // Create pitch run record
    const { data: run, error: dbError } = await supabaseAdmin
      .from('pitch_runs')
      .insert({
        id: runId,
        session_id: sessionId,
        title: title || null,
        audio_path: audioPath,
        status: 'uploaded',
        rubric_id: rubricId,
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database error:', dbError)
      return NextResponse.json(
        { error: 'Failed to create run record' },
        { status: 500 }
      )
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('pitchpractice-audio')
      .upload(audioPath, buffer, {
        contentType: audioFile.type,
        upsert: false,
      })

    if (storageError) {
      console.error('Storage error:', storageError)
      
      // Clean up database record on storage failure
      await supabaseAdmin
        .from('pitch_runs')
        .delete()
        .eq('id', runId)

      return NextResponse.json(
        { error: 'Failed to upload audio file' },
        { status: 500 }
      )
    }

    // Get audio duration if possible (basic estimation)
    // For now, we'll leave it null and can be updated later
    const audioSeconds = null

    // Update run with audio_seconds if we have it
    if (audioSeconds) {
      await supabaseAdmin
        .from('pitch_runs')
        .update({ audio_seconds: audioSeconds })
        .eq('id', runId)
    }

    return NextResponse.json({ id: runId })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

