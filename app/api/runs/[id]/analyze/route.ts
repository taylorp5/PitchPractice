import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

interface RubricCriterion {
  name: string
  description: string
}

interface AnalysisOutput {
  summary: {
    overall_score: number
    overall_notes: string
    top_strengths: string[]
    top_improvements: string[]
  }
  timing: {
    target_seconds: number | null
    max_seconds: number | null
    estimated_seconds: number | null
    pacing_wpm: number | null
    notes: string
  }
  rubric_scores: Array<{
    criterion: string
    score: number
    notes: string
  }>
  line_by_line: Array<{
    quote: string
    type: 'praise' | 'issue' | 'suggestion'
    comment: string
    action: string
    priority: 'high' | 'medium' | 'low'
  }>
  pause_suggestions: Array<{
    after_quote: string
    why: string
    duration_ms: number
  }>
  cut_suggestions: Array<{
    quote: string
    why: string
    replacement: string | null
  }>
}

function buildAnalysisPrompt(
  transcript: string,
  criteria: RubricCriterion[],
  targetDurationSeconds: number | null,
  maxDurationSeconds: number | null,
  audioSeconds: number | null,
  wpm: number | null
): string {
  const criteriaList = criteria
    .map((c, i) => `${i + 1}. ${c.name}: ${c.description}`)
    .join('\n')

  return `You are an expert pitch coach providing detailed, actionable feedback on a pitch presentation.

CRITICAL RULES (STRICTLY ENFORCED):
1. ALL feedback MUST cite specific quotes from the transcript. If you cannot cite a quote, do not make the claim.
2. Quotes must be verbatim excerpts (≤20 words) from the transcript - copy them exactly as they appear.
3. Be specific and actionable. Avoid generic advice like "be more engaging" - instead say "When you said '[quote]', try [specific action]."
4. Reference exact transcript segments for every point. No exceptions.
5. If you cannot find a specific quote to support a point, omit that point entirely rather than making a generic claim.

TRANSCRIPT:
${transcript}

RUBRIC CRITERIA:
${criteriaList}

TIMING INFO:
${targetDurationSeconds ? `Target duration: ${targetDurationSeconds}s (${Math.floor(targetDurationSeconds / 60)} min)` : 'No target duration specified'}
${maxDurationSeconds ? `Max duration: ${maxDurationSeconds}s (${Math.floor(maxDurationSeconds / 60)} min)` : ''}
${audioSeconds ? `Actual duration: ${audioSeconds.toFixed(1)}s` : 'Duration unknown'}
${wpm ? `Speaking pace: ${wpm} WPM` : ''}

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure:

{
  "summary": {
    "overall_score": <0-10 integer>,
    "overall_notes": "<2-3 sentences summarizing the pitch>",
    "top_strengths": ["<specific strength with quote>", ...],
    "top_improvements": ["<specific improvement with quote>", ...]
  },
  "timing": {
    "target_seconds": ${targetDurationSeconds || 'null'},
    "max_seconds": ${maxDurationSeconds || 'null'},
    "estimated_seconds": ${audioSeconds ? audioSeconds.toFixed(1) : 'null'},
    "pacing_wpm": ${wpm || 'null'},
    "notes": "<specific timing feedback with quotes if relevant>"
  },
  "rubric_scores": [
    {
      "criterion": "<criterion name>",
      "score": <0-10 integer>,
      "notes": "<specific feedback with quote citation>"
    },
    ... (one for each criterion)
  ],
  "line_by_line": [
    {
      "quote": "<verbatim excerpt ≤20 words>",
      "type": "<praise|issue|suggestion>",
      "comment": "<what's good/bad about this>",
      "action": "<what to change/keep>",
      "priority": "<high|medium|low>"
    },
    ... (5-15 items covering key moments)
  ],
  "pause_suggestions": [
    {
      "after_quote": "<verbatim excerpt ≤20 words where pause should occur>",
      "why": "<reason for pause>",
      "duration_ms": <300-900>
    },
    ... (2-5 suggestions)
  ],
  "cut_suggestions": [
    {
      "quote": "<verbatim excerpt ≤20 words to remove>",
      "why": "<reason to cut>",
      "replacement": "<optional rewrite or null>"
    },
    ... (0-5 suggestions)
  ]
}

REMEMBER (STRICT ENFORCEMENT):
- Every claim must have a quote. No exceptions. If you cannot cite a quote, do not include that feedback.
- Quotes must be exact verbatim excerpts from the transcript (≤20 words).
- Be specific and actionable. Generic advice will be rejected.
- Focus on the most impactful feedback first.
- For line_by_line: Each item MUST have a quote that appears exactly in the transcript.
- For pause_suggestions: The "after_quote" must be an exact excerpt from the transcript.
- For cut_suggestions: The "quote" must be an exact excerpt from the transcript.

VALIDATION: Before including any feedback item, verify that the quote appears verbatim in the transcript.`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Set status to 'analyzing' immediately
    await getSupabaseAdmin()
      .from('pitch_runs')
      .update({ status: 'analyzing' })
      .eq('id', id)

    // Fetch the run with rubric
    const { data: run, error: fetchError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('*, rubrics(*)')
      .eq('id', id)
      .single()

    if (fetchError || !run) {
      console.error('[Analyze] Run not found:', { id, error: fetchError })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Run not found',
          details: fetchError?.message || 'Run with this ID does not exist',
          runId: id,
        },
        { status: 404 }
      )
    }

    // Check transcript exists and has content (more robust than just checking status)
    const transcriptLength = run.transcript?.length || 0
    if (!run.transcript || transcriptLength === 0) {
      console.error('[Analyze] Missing or empty transcript:', {
        runId: id,
        status: run.status,
        hasTranscript: !!run.transcript,
        transcriptLength,
      })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Transcript is required for analysis',
          details: `Transcript is missing or empty. Status: ${run.status}, Transcript length: ${transcriptLength}`,
          runId: id,
          runStatus: run.status,
          transcriptLength,
          fieldsChecked: ['transcript', 'transcript.length'],
        },
        { status: 400 }
      )
    }

    // Warn if status is not 'transcribed' but allow analysis if transcript exists
    if (run.status !== 'transcribed') {
      console.warn('[Analyze] Run status is not "transcribed", but transcript exists:', {
        runId: id,
        status: run.status,
        transcriptLength,
      })
      // Don't block - transcript exists, so we can analyze
    }

    if (!run.rubric_id) {
      console.error('[Analyze] Missing rubric_id:', { runId: id, rubricId: run.rubric_id })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Rubric is required for analysis',
          details: `Run is missing rubric_id. Current rubric_id: ${run.rubric_id || 'null'}`,
          runId: id,
          runStatus: run.status,
          transcriptLength,
          fieldsChecked: ['rubric_id'],
        },
        { status: 400 }
      )
    }

    if (!run.rubrics) {
      console.error('[Analyze] Rubric not found:', { runId: id, rubricId: run.rubric_id })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Rubric not found',
          details: `Rubric with ID ${run.rubric_id} does not exist or could not be loaded`,
          runId: id,
          rubricId: run.rubric_id,
          runStatus: run.status,
          transcriptLength,
          fieldsChecked: ['rubrics'],
        },
        { status: 400 }
      )
    }

    const rubric = run.rubrics as any
    const criteria: RubricCriterion[] = rubric.criteria || []

    if (criteria.length === 0) {
      console.error('[Analyze] Rubric has no criteria:', { runId: id, rubricId: run.rubric_id })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Rubric has no criteria defined',
          details: `Rubric "${rubric.name || run.rubric_id}" has no criteria. Cannot perform analysis without criteria.`,
          runId: id,
          rubricId: run.rubric_id,
          runStatus: run.status,
          transcriptLength,
          fieldsChecked: ['rubrics.criteria', 'rubrics.criteria.length'],
        },
        { status: 400 }
      )
    }

    // Build the analysis prompt
    const prompt = buildAnalysisPrompt(
      run.transcript,
      criteria,
      rubric.target_duration_seconds,
      rubric.max_duration_seconds,
      run.audio_seconds,
      run.words_per_minute
    )

    // Call OpenAI for analysis
    let analysisJson: AnalysisOutput
    try {
      const openai = getOpenAIClient()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert pitch coach. You provide detailed, actionable feedback that ALWAYS cites specific verbatim quotes from the transcript. You NEVER make generic claims without evidence. If you cannot cite an exact quote (≤20 words) from the transcript, you must omit that feedback point entirely. Every piece of feedback must be anchored to a specific transcript excerpt.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      })

      const responseText = completion.choices[0]?.message?.content
      if (!responseText) {
        throw new Error('Empty response from OpenAI')
      }

      analysisJson = JSON.parse(responseText) as AnalysisOutput

      // Validate the structure
      if (!analysisJson.summary || !analysisJson.rubric_scores || !analysisJson.line_by_line) {
        throw new Error('Invalid analysis structure returned from OpenAI')
      }
    } catch (error: any) {
      console.error('OpenAI analysis error:', error)
      
      await getSupabaseAdmin()
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: error.message || 'Analysis failed',
        })
        .eq('id', id)

      return NextResponse.json(
        { error: 'Analysis failed', details: error.message },
        { status: 500 }
      )
    }

    // Update the run with analysis
    const { data: updatedRun, error: updateError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .update({
        analysis_json: analysisJson,
        status: 'analyzed',
        error_message: null,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) {
      console.error('Database update error:', updateError)
      return NextResponse.json(
        { error: 'Failed to save analysis', details: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      run: updatedRun,
      success: true,
      analysis: analysisJson,
    })
  } catch (error: any) {
    console.error('Unexpected error:', error)

    // Try to update status to error
    try {
      await getSupabaseAdmin()
        .from('pitch_runs')
        .update({
          status: 'error',
          error_message: error.message || 'Unexpected error during analysis',
        })
        .eq('id', params.id)
    } catch (updateErr) {
      console.error('Failed to update error status:', updateErr)
    }

    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

