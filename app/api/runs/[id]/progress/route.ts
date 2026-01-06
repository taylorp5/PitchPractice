import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/runs/[id]/progress
 * Fetch last 3 runs for comparison (excluding current run)
 * Returns comparison data: WPM, filler words, missing sections, overall score
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch current run to get rubric_id and session_id
    const { data: currentRun, error: currentRunError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, rubric_id, session_id, user_id')
      .eq('id', id)
      .single()

    if (currentRunError || !currentRun) {
      return NextResponse.json(
        { error: 'Run not found' },
        { status: 404 }
      )
    }

    // Build query for previous runs
    // Priority: same rubric_id if available, else last 3 overall
    // Exclude current run
    let query = getSupabaseAdmin()
      .from('pitch_runs')
      .select('id, words_per_minute, analysis_json, created_at')
      .neq('id', id)
      .order('created_at', { ascending: false })
      .limit(3)

    // Filter by user_id if authenticated, otherwise by session_id
    if (currentRun.user_id) {
      query = query.eq('user_id', currentRun.user_id)
    } else if (currentRun.session_id) {
      query = query.eq('session_id', currentRun.session_id)
    } else {
      // No way to identify user - return empty
      return NextResponse.json({
        previous_runs: [],
        comparisons: null,
      })
    }

    // If rubric_id exists, prioritize runs with same rubric_id
    if (currentRun.rubric_id) {
      // First try to get runs with same rubric_id
      const { data: sameRubricRuns } = await query
        .eq('rubric_id', currentRun.rubric_id)
        .limit(3)

      if (sameRubricRuns && sameRubricRuns.length > 0) {
        // Use same rubric runs
        const comparisons = computeComparisons(sameRubricRuns)
        return NextResponse.json({
          previous_runs: sameRubricRuns,
          comparisons,
        })
      }
    }

    // Fallback: get last 3 runs regardless of rubric
    const { data: allRuns, error } = await query

    if (error) {
      console.error('[Progress] Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch previous runs' },
        { status: 500 }
      )
    }

    const comparisons = computeComparisons(allRuns || [])

    return NextResponse.json({
      previous_runs: allRuns || [],
      comparisons,
    })
  } catch (error: any) {
    console.error('[Progress] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Compute comparison metrics from previous runs
 */
function computeComparisons(previousRuns: Array<{
  words_per_minute: number | null
  analysis_json: any
}>): {
  avg_wpm: number | null
  avg_filler_words: number | null
  avg_missing_sections: number | null
  avg_overall_score: number | null
} {
  if (!previousRuns || previousRuns.length === 0) {
    return {
      avg_wpm: null,
      avg_filler_words: null,
      avg_missing_sections: null,
      avg_overall_score: null,
    }
  }

  let totalWpm = 0
  let wpmCount = 0
  let totalFillerWords = 0
  let fillerCount = 0
  let totalMissingSections = 0
  let missingCount = 0
  let totalOverallScore = 0
  let scoreCount = 0

  previousRuns.forEach(run => {
    // WPM
    if (run.words_per_minute !== null && run.words_per_minute !== undefined) {
      totalWpm += run.words_per_minute
      wpmCount++
    }

    // Filler words (from premium.filler.total or premium_insights.filler_words.total_count)
    const fillerTotal = run.analysis_json?.premium?.filler?.total ?? 
                       run.analysis_json?.premium_insights?.filler_words?.total_count
    if (fillerTotal !== null && fillerTotal !== undefined) {
      totalFillerWords += fillerTotal
      fillerCount++
    }

    // Missing sections (count from rubric_scores where missing=true)
    if (run.analysis_json?.rubric_scores && Array.isArray(run.analysis_json.rubric_scores)) {
      const runMissingCount = run.analysis_json.rubric_scores.filter(
        (score: any) => score.missing === true
      ).length
      totalMissingSections += runMissingCount
      missingCount++
    }

    // Overall score
    if (run.analysis_json?.summary?.overall_score !== null && 
        run.analysis_json?.summary?.overall_score !== undefined) {
      totalOverallScore += run.analysis_json.summary.overall_score
      scoreCount++
    }
  })

  return {
    avg_wpm: wpmCount > 0 ? totalWpm / wpmCount : null,
    avg_filler_words: fillerCount > 0 ? totalFillerWords / fillerCount : null,
    avg_missing_sections: missingCount > 0 ? totalMissingSections / missingCount : null,
    avg_overall_score: scoreCount > 0 ? totalOverallScore / scoreCount : null,
  }
}

