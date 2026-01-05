import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const DEBUG = true
  
  if (DEBUG) {
    console.log('[Create Run] Request received')
  }

  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const rubricId = formData.get('rubric_id') as string
    const sessionId = formData.get('session_id') as string
    const title = formData.get('title') as string | null
    const durationMsStr = formData.get('duration_ms') as string | null
    const durationMs = durationMsStr ? parseInt(durationMsStr, 10) : null
    const audioSeconds = durationMs ? durationMs / 1000 : null

    if (!audioFile) {
      return NextResponse.json(
        { ok: false, error: 'Audio file is required' },
        { status: 400 }
      )
    }

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'Session ID is required', details: 'session_id is missing from request' },
        { status: 400 }
      )
    }

    // Handle missing rubric_id by getting the first available rubric
    let finalRubricId = rubricId
    if (!finalRubricId) {
      if (DEBUG) {
        console.log('[Create Run] No rubric_id provided, fetching first available rubric')
      }
      const { data: rubrics, error: rubricError } = await getSupabaseAdmin()
        .from('rubrics')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (rubricError || !rubrics || rubrics.length === 0) {
        console.error('[Create Run] Failed to get default rubric:', rubricError)
        return NextResponse.json(
          { 
            ok: false, 
            error: 'No rubric available',
            details: rubricError?.message || 'No rubrics found in database',
            fix: 'Please ensure at least one rubric exists in the database'
          },
          { status: 400 }
        )
      }
      
      finalRubricId = rubrics[0].id
      if (DEBUG) {
        console.log('[Create Run] Using default rubric:', finalRubricId)
      }
    }

    if (DEBUG) {
      console.log('[Create Run] Request data:', {
        hasAudioFile: !!audioFile,
        audioFileName: audioFile?.name,
        audioFileSize: audioFile?.size,
        rubricId: finalRubricId,
        sessionId,
        title,
      })
    }

    // Generate run ID
    const runId = uuidv4()
    
    // Determine file extension
    const fileExt = audioFile.name.split('.').pop() || 'webm'
    const audioPath = `${sessionId}/${runId}.${fileExt}`

    if (DEBUG) {
      console.log('[Create Run] Creating database record:', {
        runId,
        sessionId,
        rubricId: finalRubricId,
        audioPath,
        title,
      })
    }

    // Create pitch run record - use .select('*') to get all fields back
    const { data: run, error: dbError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .insert({
        id: runId,
        session_id: sessionId,
        title: title || null,
        audio_path: audioPath,
        status: 'uploaded',
        rubric_id: finalRubricId,
        audio_seconds: audioSeconds, // Set from duration_ms if provided
        duration_ms: durationMs, // Store duration_ms as source of truth
      })
      .select('id, session_id, created_at, title, audio_path, audio_seconds, duration_ms, transcript, analysis_json, status, error_message, rubric_id, word_count, words_per_minute')
      .single()

    if (dbError) {
      console.error('[Create Run] Database error:', {
        error: dbError,
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
        runId,
        sessionId,
        rubricId: finalRubricId,
      })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Failed to create run record',
          details: dbError.message,
          fix: 'Check database connection and ensure tables exist. Run migrations if needed.',
        },
        { status: 500 }
      )
    }

    // Validate that run was created with an id
    if (!run || !run.id) {
      console.error('[Create Run] Run created but missing id:', {
        run,
        runId,
        hasRun: !!run,
        hasId: !!run?.id,
      })
      return NextResponse.json(
        {
          ok: false,
          error: 'Run creation failed: database returned incomplete data',
          details: 'The run was created but the response did not include an id',
          fix: 'Check database connection and table schema.',
        },
        { status: 500 }
      )
    }

    if (DEBUG) {
      console.log('[Create Run] Run created successfully:', {
        runId: run.id,
        status: run.status,
        audioPath: run.audio_path,
      })
    }

    // Convert File to ArrayBuffer
    const arrayBuffer = await audioFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileSizeKB = buffer.length / 1024
    const fileSizeMB = fileSizeKB / 1024
    
    // Reject silent/empty recordings
    if (buffer.length < 8 * 1024) { // Less than 8KB
      // Clean up database record
      await getSupabaseAdmin()
        .from('pitch_runs')
        .delete()
        .eq('id', runId)
      
      return NextResponse.json(
        { 
          ok: false,
          error: 'Recording was empty or silent.',
          details: `File size (${fileSizeKB.toFixed(2)} KB) is too small. Minimum size is 8 KB.`,
          fix: 'Check microphone permissions and ensure you are speaking during recording.',
        },
        { status: 400 }
      )
    }

    // Determine content type - ensure .webm recordings get correct type
    let contentType = audioFile.type
    if (!contentType || contentType === 'application/octet-stream') {
      if (fileExt === 'webm') {
        // Prefer codecs=opus if it was recorded that way, otherwise use audio/webm
        contentType = 'audio/webm;codecs=opus'
      } else if (fileExt === 'mp3') {
        contentType = 'audio/mpeg'
      } else if (fileExt === 'wav') {
        contentType = 'audio/wav'
      } else if (fileExt === 'ogg') {
        contentType = 'audio/ogg'
      } else {
        contentType = 'audio/webm' // Default fallback
      }
    }
    
    // Log content type for debugging
    console.log('[Upload] Content type:', {
      original: audioFile.type,
      determined: contentType,
      fileExt,
      fileName: audioFile.name,
    })

    // Check if bucket exists, create if missing
    const bucketName = 'pitchpractice-audio'
    const { data: buckets, error: listError } = await getSupabaseAdmin().storage.listBuckets()
    
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
      const { data: newBucket, error: createError } = await getSupabaseAdmin().storage.createBucket(bucketName, {
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
        await getSupabaseAdmin()
          .from('pitch_runs')
          .delete()
          .eq('id', runId)

        return NextResponse.json(
          { 
            ok: false,
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

    const { data: uploadData, error: storageError } = await getSupabaseAdmin().storage
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
      await getSupabaseAdmin()
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
          ok: false,
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

    // Return the full run object with ok: true
    return NextResponse.json({
      ok: true,
      run: {
        id: run.id,
        session_id: run.session_id,
        created_at: run.created_at,
        title: run.title,
        audio_path: run.audio_path,
        audio_seconds: run.audio_seconds,
        duration_ms: run.duration_ms,
        transcript: run.transcript,
        analysis_json: run.analysis_json,
        status: run.status,
        error_message: run.error_message,
        rubric_id: run.rubric_id,
        word_count: run.word_count || null,
        words_per_minute: run.words_per_minute || null,
      },
      runId: run.id, // Also include runId for backwards compatibility
    })
  } catch (error: any) {
    console.error('[Create Run] Unexpected error:', {
      error,
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    })
    return NextResponse.json(
      { 
        ok: false,
        error: 'Internal server error',
        details: error?.message || 'An unexpected error occurred',
        fix: 'Please try again. If the problem persists, check server logs.',
      },
      { status: 500 }
    )
  }
}

