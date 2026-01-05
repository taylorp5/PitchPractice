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
      console.error('[Database] Failed to create run record:', {
        error: dbError,
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
        runId,
        sessionId,
        rubricId,
      })
      return NextResponse.json(
        { 
          error: 'Failed to create run record',
          details: dbError.message,
          fix: 'Check database connection and ensure tables exist. Run migrations if needed.',
        },
        { status: 500 }
      )
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileSizeKB = buffer.length / 1024
    const fileSizeMB = fileSizeKB / 1024

    // Determine content type - ensure .webm recordings get correct type
    let contentType = audioFile.type
    if (!contentType || contentType === 'application/octet-stream') {
      if (fileExt === 'webm') {
        contentType = 'audio/webm'
      } else if (fileExt === 'mp3') {
        contentType = 'audio/mpeg'
      } else if (fileExt === 'wav') {
        contentType = 'audio/wav'
      } else {
        contentType = 'audio/webm' // Default fallback
      }
    }

    // Check if bucket exists, create if missing
    const bucketName = 'pitchpractice-audio'
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    
    if (listError) {
      console.error('[Storage] Error listing buckets:', {
        error: listError,
        message: listError.message,
        code: (listError as any).statusCode,
      })
    }

    const bucketExists = buckets?.some(b => b.name === bucketName)
    
    if (!bucketExists) {
      console.error('[Storage] Bucket not found:', {
        bucketName,
        availableBuckets: buckets?.map(b => b.name) || [],
      })
      
      // Try to create the bucket
      const { data: newBucket, error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: ['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg'],
      })

      if (createError) {
        console.error('[Storage] Failed to create bucket:', {
          bucketName,
          error: createError,
          message: createError.message,
          code: (createError as any).statusCode,
        })
        
        // Clean up database record
        await supabaseAdmin
          .from('pitch_runs')
          .delete()
          .eq('id', runId)

        return NextResponse.json(
          { 
            error: 'Storage bucket not found',
            details: `Bucket '${bucketName}' does not exist and could not be created. Please create it manually in Supabase Storage.`,
            fix: 'Go to Supabase Dashboard → Storage → Create bucket named "pitchpractice-audio" (private)',
          },
          { status: 500 }
        )
      }
      
      console.log('[Storage] Created bucket:', bucketName)
    }

    // Upload to Supabase Storage with detailed logging
    console.log('[Storage] Uploading file:', {
      bucketName,
      path: audioPath,
      fileSize: `${fileSizeMB.toFixed(2)} MB (${fileSizeKB.toFixed(2)} KB)`,
      contentType,
      fileExt,
      runId,
    })

    const { data: uploadData, error: storageError } = await supabaseAdmin.storage
      .from(bucketName)
      .upload(audioPath, buffer, {
        contentType,
        upsert: false,
        cacheControl: '3600',
      })

    if (storageError) {
      const errorCode = (storageError as any).statusCode || (storageError as any).error
      const errorMessage = storageError.message || 'Unknown storage error'
      
      console.error('[Storage] Upload failed:', {
        bucketName,
        path: audioPath,
        fileSize: `${fileSizeMB.toFixed(2)} MB`,
        contentType,
        error: storageError,
        errorCode,
        errorMessage,
        fullError: JSON.stringify(storageError, null, 2),
      })
      
      // Clean up database record on storage failure
      await supabaseAdmin
        .from('pitch_runs')
        .delete()
        .eq('id', runId)

      // Parse error and return helpful message
      let userMessage = 'Failed to upload audio file'
      let fixSuggestion = 'Please try again or contact support'

      if (errorMessage.includes('Bucket not found') || errorCode === 404) {
        userMessage = 'Storage bucket not found'
        fixSuggestion = 'Bucket "pitchpractice-audio" does not exist. Create it in Supabase Dashboard → Storage'
      } else if (errorMessage.includes('permission') || errorMessage.includes('policy') || errorCode === 403) {
        userMessage = 'Permission denied (policy/RLS)'
        fixSuggestion = 'Check Supabase Storage policies. Service role key should bypass RLS, but bucket policies may be blocking uploads.'
      } else if (errorMessage.includes('too large') || errorMessage.includes('size') || fileSizeMB > 50) {
        userMessage = 'File too large'
        fixSuggestion = `File size (${fileSizeMB.toFixed(2)} MB) exceeds limit. Maximum size is 50 MB.`
      } else if (errorMessage.includes('duplicate') || errorCode === 409) {
        userMessage = 'File already exists'
        fixSuggestion = 'A file with this path already exists. This should not happen - please try again.'
      }

      return NextResponse.json(
        { 
          error: userMessage,
          details: errorMessage,
          fix: fixSuggestion,
          code: errorCode,
        },
        { status: 500 }
      )
    }

    console.log('[Storage] Upload successful:', {
      bucketName,
      path: audioPath,
      fileSize: `${fileSizeMB.toFixed(2)} MB`,
      contentType,
    })

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
  } catch (error: any) {
    console.error('[Unexpected Error] Upload failed:', {
      error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error?.message || 'An unexpected error occurred',
        fix: 'Please try again. If the problem persists, check server logs.',
      },
      { status: 500 }
    )
  }
}

