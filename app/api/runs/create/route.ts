import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'
import { v4 as uuidv4 } from 'uuid'

export const dynamic = 'force-dynamic'

/**
 * POST /api/runs/create
 * Create a pitch run record (metadata only, no audio upload)
 * Audio upload is handled separately via direct-to-storage upload
 * Input: { session_id, rubric_id?, rubric_json?, title?, duration_ms?, pitch_context? }
 * Output: { ok: true, run: {...}, runId: string }
 */
export async function POST(request: NextRequest) {
  const DEBUG = true
  
  if (DEBUG) {
    console.log('[Create Run] Request received (metadata only)')
  }

  try {
    // Accept both formData and JSON for flexibility
    let rubricId: string | null = null
    let rubricJsonStr: string | null = null
    let sessionId: string | null = null
    let title: string | null = null
    let durationMsStr: string | null = null
    let pitchContext: string | null = null

    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('application/json')) {
      // JSON body
      const body = await request.json()
      rubricId = body.rubric_id || null
      rubricJsonStr = body.rubric_json || null
      sessionId = body.session_id || null
      title = body.title || null
      durationMsStr = body.duration_ms?.toString() || null
      pitchContext = body.pitch_context || null
    } else {
      // FormData (for backwards compatibility)
      const formData = await request.formData()
      rubricId = formData.get('rubric_id') as string | null
      rubricJsonStr = formData.get('rubric_json') as string | null
      sessionId = formData.get('session_id') as string | null
      title = formData.get('title') as string | null
      durationMsStr = formData.get('duration_ms') as string | null
      pitchContext = formData.get('pitch_context') as string | null
    }

    const durationMs = durationMsStr ? parseInt(durationMsStr, 10) : null
    const audioSeconds = durationMs ? durationMs / 1000 : null

    // Check if user is authenticated (optional - for practice page)
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        if (DEBUG) {
          console.log('[Create Run] Authenticated user:', userId)
        }
      }
    } catch (err) {
      // Not authenticated - that's fine for /try page
      if (DEBUG) {
        console.log('[Create Run] No authenticated user (trial run)')
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        { ok: false, error: 'Session ID is required', details: 'session_id is missing from request' },
        { status: 400 }
      )
    }

    // Handle rubric: either rubric_id OR rubric_json
    let finalRubricId: string | null = rubricId || null
    let rubricName: string | null = null
    let rubricSnapshotJson: any = null
    
    // Validate and parse rubric_json if provided
    if (rubricJsonStr) {
      try {
        const parsedRubric = JSON.parse(rubricJsonStr)
        
        // Validate minimal schema: criteria is non-empty array and each criterion has a name
        if (!parsedRubric.criteria || !Array.isArray(parsedRubric.criteria) || parsedRubric.criteria.length === 0) {
          return NextResponse.json(
            { 
              ok: false, 
              error: 'Invalid rubric_json: criteria must be a non-empty array',
              details: 'The rubric_json must contain a criteria array with at least one criterion'
            },
            { status: 400 }
          )
        }
        
        // Validate each criterion has a name
        for (let i = 0; i < parsedRubric.criteria.length; i++) {
          const criterion = parsedRubric.criteria[i]
          if (!criterion.name || typeof criterion.name !== 'string' || criterion.name.trim().length === 0) {
            return NextResponse.json(
              { 
                ok: false, 
                error: `Invalid rubric_json: criterion at index ${i} must have a name`,
                details: 'Each criterion in the criteria array must have a non-empty name field'
              },
              { status: 400 }
            )
          }
        }
        
        // Store the validated rubric snapshot
        rubricSnapshotJson = parsedRubric
        rubricName = parsedRubric.name || parsedRubric.title || 'Custom Rubric'
        
        if (DEBUG) {
          console.log('[Create Run] Using rubric_json snapshot:', {
            name: rubricName,
            criteriaCount: parsedRubric.criteria.length,
          })
        }
      } catch (parseError: any) {
        return NextResponse.json(
          { 
            ok: false, 
            error: 'Invalid rubric_json: not valid JSON',
            details: parseError.message || 'Failed to parse rubric_json as JSON'
          },
          { status: 400 }
        )
      }
    }
    // Handle rubric_id (existing behavior)
    else if (finalRubricId) {
      // Fetch rubric name for storing in title if needed
      const { data: rubricData } = await getSupabaseAdmin()
        .from('rubrics')
        .select('name, title')
        .eq('id', finalRubricId)
        .single()
      
      if (rubricData) {
        rubricName = rubricData.name || rubricData.title || null
      }
    }
    // Handle missing rubric_id by getting the first available rubric
    else {
      if (DEBUG) {
        console.log('[Create Run] No rubric_id or rubric_json provided, fetching first available rubric')
      }
      const { data: rubrics, error: rubricError } = await getSupabaseAdmin()
        .from('rubrics')
        .select('id, name, title')
        .order('created_at', { ascending: false })
        .limit(1)
      
      if (rubricError || !rubrics || rubrics.length === 0) {
        console.error('[Create Run] Failed to get default rubric:', rubricError)
        return NextResponse.json(
          { 
            ok: false, 
            error: 'No rubric available',
            details: rubricError?.message || 'No rubrics found in database',
            fix: 'Please ensure at least one rubric exists in the database or provide rubric_json'
          },
          { status: 400 }
        )
      }
      
      finalRubricId = rubrics[0].id
      rubricName = rubrics[0].name || rubrics[0].title || null
      if (DEBUG) {
        console.log('[Create Run] Using default rubric:', finalRubricId, 'name:', rubricName)
      }
    }
    
    // If title is empty and we have a rubric name, use rubric name as title
    const finalTitle = title?.trim() || rubricName || null

    if (DEBUG) {
      console.log('[Create Run] Request data:', {
        rubricId: finalRubricId,
        sessionId,
        title,
        durationMs,
        note: 'Audio upload happens separately via direct-to-storage',
      })
    }

    // Generate run ID
    const runId = uuidv4()
    
    // Note: audio_path will be set later when upload completes via /api/uploads/complete
    // For now, set a placeholder or null
    const audioPath = null

    if (DEBUG) {
      console.log('[Create Run] Creating database record:', {
        runId,
        sessionId,
        rubricId: finalRubricId,
        title,
        durationMs,
      })
    }

    // Create pitch run record - use .select('*') to get all fields back
    // Note: audio_path is a placeholder initially, will be updated when upload completes
    // Use placeholder to satisfy NOT NULL constraint (migration 013 allows NULL but may not be applied)
    const placeholderPath = `${sessionId}/${runId}.webm`
    
    const insertData: any = {
      id: runId,
      session_id: sessionId,
      title: finalTitle,
      audio_path: placeholderPath, // Placeholder - will be updated when upload completes via /api/uploads/complete
      status: 'uploading', // Initial status - will be 'uploaded' when audio upload completes
      audio_seconds: audioSeconds, // Set from duration_ms if provided
      duration_ms: durationMs, // Store duration_ms as source of truth
      user_id: userId, // Store user_id if authenticated
      pitch_context: pitchContext || null, // Store pitch context if provided
    }
    
    // Set rubric_id only if provided (not when using rubric_json)
    if (finalRubricId) {
      insertData.rubric_id = finalRubricId
    }
    
    // Store rubric snapshot if provided
    if (rubricSnapshotJson) {
      insertData.rubric_snapshot_json = rubricSnapshotJson
    }
    
    const { data: run, error: dbError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .insert(insertData)
      .select('id, session_id, created_at, title, audio_path, audio_seconds, duration_ms, transcript, analysis_json, status, error_message, rubric_id, rubric_snapshot_json, word_count, words_per_minute, user_id, pitch_context')
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
        note: 'Audio upload will happen separately via direct-to-storage',
      })
    }

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
        rubric_snapshot_json: run.rubric_snapshot_json || null,
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

