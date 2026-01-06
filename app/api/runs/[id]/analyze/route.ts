import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'
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
  meta?: {
    plan_at_time?: 'free' | 'starter' | 'coach' | 'daypass'
    generated_at?: string
  }
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
    criterion_id: string
    criterion_label: string
    score: number
    notes: string
    evidence_quotes: string[]
    missing: boolean
  }>
  question_grading?: Array<{
    question: string
    answered: boolean
    evidence_quotes: string[]
    improvement: string | null
  }>
  chunks: Array<{
    text: string
    purpose: string
    purpose_label: string
    score: number | null
    status: 'strong' | 'needs_work' | 'missing'
    feedback: string
    rewrite_suggestion: string | null
  }>
  line_by_line: Array<{
    quote: string
    type: 'strength' | 'issue'
    comment: string
    action: string
    priority: 'high' | 'medium' | 'low'
    category?: string
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

interface PromptRubricItem {
  id: string
  label: string
  weight: number
  optional?: boolean
}

// Detect filler words and hesitation patterns in transcript
function detectFillerWordsAndHesitation(
  transcript: string,
  existingQuotes: Set<string>
): Array<{
  quote: string
  type: 'issue'
  comment: string
  action: string
  priority: 'high' | 'medium' | 'low'
  category: 'delivery'
}> {
  const issues: Array<{
    quote: string
    type: 'issue'
    comment: string
    action: string
    priority: 'high' | 'medium' | 'low'
    category: 'delivery'
  }> = []

  if (!transcript || transcript.trim().length === 0) {
    return issues
  }

  // Normalize transcript for matching (preserve original for quotes)
  const transcriptLower = transcript.toLowerCase()
  
  // Filler words to detect (case-insensitive)
  const fillerWords = [
    /\bum\b/gi,
    /\buh\b/gi,
    /\blike\b/gi,
    /\byeah\b/gi,
    /\bkind of\b/gi,
    /\bsort of\b/gi,
  ]

  // Hesitant phrase patterns at sentence start
  const hesitantStartPatterns = [
    /^so\s*,\s*um\s*[,.]/i,
    /^so\s*,\s*uh\s*[,.]/i,
    /^i\s+guess\s*[,.]/i,
    /^kind\s+of\s*[,.]/i,
    /^sort\s+of\s*[,.]/i,
    /^well\s*,\s*um\s*[,.]/i,
    /^well\s*,\s*uh\s*[,.]/i,
  ]

  // Softening phrases
  const softeningPhrases = [
    /\bkind of\b/gi,
    /\bsort of\b/gi,
    /\bi guess\b/gi,
    /\bi think\b/gi, // Only when used as hesitation, not as opinion
    /\bmaybe\b/gi,
    /\bprobably\b/gi,
  ]

  // Split transcript into sentences for better context
  // Split on sentence endings, but preserve punctuation with the sentence
  const sentenceParts = transcript.split(/([.!?]+\s+)/)
  const sentences: string[] = []
  for (let i = 0; i < sentenceParts.length; i += 2) {
    const sentence = (sentenceParts[i] || '').trim()
    const punctuation = (sentenceParts[i + 1] || '').trim()
    if (sentence.length > 0) {
      sentences.push(sentence + punctuation)
    }
  }
  
  // Track found quotes to avoid duplicates
  const foundQuotes = new Set<string>()

  // Check each sentence for issues
  sentences.forEach((sentence, idx) => {
    const sentenceTrimmed = sentence.trim()
    if (sentenceTrimmed.length === 0) return

    const sentenceLower = sentenceTrimmed.toLowerCase()
    
    // Check for hesitant starts
    for (const pattern of hesitantStartPatterns) {
      const match = sentenceTrimmed.match(pattern)
      if (match) {
        // Extract quote (max 120 chars, prefer sentence start)
        let quote = sentenceTrimmed.substring(0, Math.min(120, sentenceTrimmed.length))
        // Try to end at a natural break
        const lastSpace = quote.lastIndexOf(' ')
        if (lastSpace > 80) {
          quote = quote.substring(0, lastSpace) + '...'
        }
        
        // Skip if already in existing quotes or found quotes
        const quoteKey = quote.toLowerCase().trim()
        if (existingQuotes.has(quoteKey) || foundQuotes.has(quoteKey)) continue
        foundQuotes.add(quoteKey)

        // Determine priority based on pattern
        let priority: 'high' | 'medium' | 'low' = 'medium'
        if (match[0].toLowerCase().includes('um') || match[0].toLowerCase().includes('uh')) {
          priority = 'high'
        }

        issues.push({
          quote: quote.trim(),
          type: 'issue',
          comment: 'Filler words at the start reduce clarity and confidence.',
          action: 'Remove fillers and start with a direct statement of what you are building.',
          priority,
          category: 'delivery',
        })
        break // Only flag once per sentence
      }
    }

    // Check for filler words (not at sentence start, or if we didn't catch it above)
    let fillerCount = 0
    const fillerMatches: Array<{ word: string; index: number }> = []

    fillerWords.forEach((pattern, patternIdx) => {
      const matches = [...sentenceTrimmed.matchAll(pattern)]
      matches.forEach(match => {
        if (match.index !== undefined) {
          fillerMatches.push({ word: match[0], index: match.index })
          fillerCount++
        }
      })
    })

    // Only flag if there are multiple fillers or one at a critical position
    if (fillerCount >= 2 || (fillerCount === 1 && fillerMatches[0].index < 50)) {
      // Extract quote around the filler(s)
      const firstFillerIndex = Math.min(...fillerMatches.map(m => m.index))
      const lastFillerIndex = Math.max(...fillerMatches.map(m => m.index + m.word.length))
      
      // Get context around fillers (max 120 chars)
      const start = Math.max(0, firstFillerIndex - 20)
      const end = Math.min(sentenceTrimmed.length, lastFillerIndex + 40)
      let quote = sentenceTrimmed.substring(start, end).trim()
      
      // Ensure quote is not too long
      if (quote.length > 120) {
        quote = quote.substring(0, 117) + '...'
      }

      const quoteKey = quote.toLowerCase().trim()
      if (existingQuotes.has(quoteKey) || foundQuotes.has(quoteKey)) return
      foundQuotes.add(quoteKey)

      const priority: 'high' | 'medium' | 'low' = fillerCount >= 3 ? 'high' : 'medium'

      issues.push({
        quote: quote.trim(),
        type: 'issue',
        comment: fillerCount >= 3 
          ? 'Multiple filler words reduce clarity and confidence.'
          : 'Filler words reduce clarity and confidence.',
        action: 'Remove fillers and speak more directly.',
        priority,
        category: 'delivery',
      })
    }

    // Check for excessive softening phrases (only if not already flagged)
    if (fillerCount === 0) {
      let softeningCount = 0
      softeningPhrases.forEach(pattern => {
        const matches = sentenceTrimmed.match(pattern)
        if (matches) {
          softeningCount += matches.length
        }
      })

      // Flag if 2+ softening phrases in one sentence
      if (softeningCount >= 2) {
        let quote = sentenceTrimmed.substring(0, Math.min(120, sentenceTrimmed.length))
        const lastSpace = quote.lastIndexOf(' ')
        if (lastSpace > 80) {
          quote = quote.substring(0, lastSpace) + '...'
        }

        const quoteKey = quote.toLowerCase().trim()
        if (existingQuotes.has(quoteKey) || foundQuotes.has(quoteKey)) return
        foundQuotes.add(quoteKey)

        issues.push({
          quote: quote.trim(),
          type: 'issue',
          comment: 'Softening phrases reduce clarity and confidence.',
          action: 'Remove softening phrases and state your points more directly.',
          priority: 'low',
          category: 'delivery',
        })
      }
    }
  })

  // Limit to top 3-5 most important issues to avoid overwhelming
  return issues
    .sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 }
      return priorityOrder[b.priority] - priorityOrder[a.priority]
    })
    .slice(0, 5)
}

function buildAnalysisPrompt(
  transcript: string,
  criteria: RubricCriterion[],
  promptRubric: PromptRubricItem[] | null,
  targetDurationSeconds: number | null,
  maxDurationSeconds: number | null,
  audioSeconds: number | null,
  wpm: number | null,
  pitchContext: string | null = null,
  guidingQuestions: string[] = [],
  userPlan: 'free' | 'starter' | 'coach' | 'daypass' = 'free',
  rubricName: string | null = null
): string {
  // Use prompt-specific rubric if provided, otherwise use generic criteria
  const rubricItems: PromptRubricItem[] = promptRubric || criteria.map((c, i) => ({
    id: `criterion_${i}`,
    label: c.name,
    weight: 1.0,
    optional: false,
  }))
  
  const criteriaList = rubricItems
    .map((item, i) => {
      const weightNote = item.weight !== 1.0 ? ` (weight: ${item.weight})` : ''
      const optionalNote = item.optional ? ' (optional)' : ''
      return `${i + 1}. ${item.label}${weightNote}${optionalNote}`
    })
    .join('\n')

  const rubricWeights = rubricItems.map(item => ({
    id: item.id,
    label: item.label,
    weight: item.weight,
  }))

  // Check if this is Free plan + Elevator Pitch rubric with "Call to action" criterion
  const isFreeElevatorPitch = userPlan === 'free' && (
    rubricName?.toLowerCase().includes('elevator') ||
    rubricItems.some(item => 
      item.label?.toLowerCase().includes('call to action') || 
      item.label?.toLowerCase().includes('cta') ||
      item.id === 'cta'
    )
  )

  const pitchContextSection = pitchContext 
    ? `\nPITCH CONTEXT (Additional information about what the user is pitching):
${pitchContext}

Use this context to better understand the pitch goals and provide more relevant feedback.`
    : ''

  const guidingQuestionsSection = guidingQuestions.length > 0
    ? `\nGUIDING QUESTIONS (Evaluate whether the pitch addresses these questions):
${guidingQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

For each question, determine:
- Was it answered? (answered: true/false)
- What evidence supports your answer? (evidence_quotes: array of verbatim quotes from transcript, ≤120 characters each)
- If not answered or partially answered, what improvement is needed? (improvement: specific suggestion with quote citation)`
    : ''

  const callToActionSpecialInstructions = isFreeElevatorPitch
    ? `\n\nSPECIAL INSTRUCTIONS FOR "CALL TO ACTION" CRITERION (Free Elevator Pitch Only):
This criterion should be evaluated as "Close or Next Step" (not just explicit ask).

Scoring Guidelines (Free Plan Only):
- 8-10: Explicit next step or ask (e.g., "I'm looking for...", "The next step is...")
- 5-7: Clear implied next step or strong takeaway (e.g., "This gives people a repeatable way to improve how they communicate.")
- 4: Soft close with purpose/value (e.g., "do better when it matters", summary of value)
- 0-3: Abrupt stop or trailing off with no conclusion

IMPORTANT RULES (Free Plan Only):
- MINIMUM SCORE = 4 if the pitch ends with:
  * a summary of value OR
  * an implied outcome (e.g., "do better when it matters")
- If the pitch ends with a clear summary or value statement, do NOT score below 4.
- Only score below 4 (0-3) if the ending is abrupt or trails off with no conclusion.
- When giving partial credit (5-7), include the closing sentence as an evidence quote.
- When giving minimum score (4), include the closing sentence as an evidence quote.
- Feedback text: 
  * If score is 4: "The pitch ends with a purpose, but could be stronger with a clear next step."
  * If there's a summary but no explicit ask (score 5-7): "The pitch ends with a summary, but could be strengthened by adding a clear next step or ask."
  * Only say "lacks a call to action" when there is no close at all (score 0-3).

Example evidence quote for score 4: "do better when it matters"
Example evidence quote for score 5-7: "PitchPractice gives people a repeatable way to improve how they communicate."`
    : ''

  return `You are an expert pitch coach providing detailed, actionable feedback on a pitch presentation.
${callToActionSpecialInstructions}

CRITICAL RULES (STRICTLY ENFORCED):
1. ALL feedback MUST cite specific quotes from the transcript. If you cannot cite a quote, do not make the claim.
2. Quotes must be verbatim excerpts (≤120 characters) from the transcript - copy them exactly as they appear.
3. Be specific and actionable. Avoid generic advice like "be more engaging" - instead say "When you said '[quote]', try [specific action]."
4. Reference exact transcript segments for every point. No exceptions.
5. If you cannot find a specific quote to support a point, omit that point entirely rather than making a generic claim.
6. EVIDENCE QUOTES ARE MANDATORY: For every criterion in rubric_scores, always include evidence_quotes array.
   - If score >= 1: Include 1-2 verbatim quotes from transcript (≤120 characters each)
   - If score = 0: Include empty array [] and explain what was missing in notes
7. LINE-BY-LINE COACHING: Provide 3-8 items (fewer for shorter pitches). Each quote must be a verbatim substring from transcript (≤120 characters).
8. TRANSCRIPT SENTENCE ALIGNMENT: Prefer quotes that align to single sentences or short phrases for UI hover matching. Avoid combining multiple sentences.

TRANSCRIPT:
${transcript}${pitchContextSection}${guidingQuestionsSection}

RUBRIC CRITERIA (Evaluate how well the pitch addresses each):
${criteriaList}

RUBRIC WEIGHTS (for overall score calculation):
${JSON.stringify(rubricWeights, null, 2)}

TIMING INFO:
${targetDurationSeconds ? `Target duration: ${targetDurationSeconds}s (${Math.floor(targetDurationSeconds / 60)} min)` : 'No target duration specified'}
${maxDurationSeconds ? `Max duration: ${maxDurationSeconds}s (${Math.floor(maxDurationSeconds / 60)} min)` : ''}
${audioSeconds ? `Actual duration: ${audioSeconds.toFixed(1)}s` : 'Duration unknown'}
${wpm ? `Speaking pace: ${wpm} WPM` : ''}

OUTPUT REQUIREMENTS:
Return a JSON object with this exact structure:

{
  "summary": {
    "overall_score": <0-10 integer, calculated from weighted rubric scores>,
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
      "criterion_id": "<criterion id from rubric>",
      "criterion_label": "<criterion label>",
      "score": <0-10 integer>,
      "notes": "<specific feedback with quote citation. If score=0, explain what was missing>",
      "evidence_quotes": <MANDATORY: If score >= 1, include 1-2 verbatim quotes (≤120 chars each) from transcript. If score = 0, use empty array []>,
      "missing": <boolean, true if this criterion is not addressed at all>
    },
    ... (one for each criterion in rubric)
  ],${guidingQuestions.length > 0 ? `
  "question_grading": [
    {
      "question": "<guiding question text>",
      "answered": <boolean, true if the question is addressed in the pitch>,
      "evidence_quotes": ["<verbatim quote 1 (≤120 chars)>", "<verbatim quote 2 (≤120 chars)>"],
      "improvement": "<specific suggestion if not answered, or null if fully answered>"
    },
    ... (one for each guiding question)
  ],` : ''}
  "chunks": [
    {
      "text": "<verbatim excerpt from transcript, 1-3 sentences forming one idea unit>",
      "purpose": "<criterion_id this chunk addresses>",
      "purpose_label": "<human-readable label like 'Hook', 'What', 'Who', 'Why'>",
      "score": <0-10 integer or null if not applicable>,
      "status": "<strong|needs_work|missing>",
      "feedback": "<why this needs work / what's good about it>",
      "rewrite_suggestion": "<improved version of this chunk or null>"
    },
    ... (break transcript into 3-8 idea units/chunks)
  ],
  "line_by_line": [
    {
      "quote": "<verbatim excerpt ≤120 characters, must be exact substring from transcript>",
      "type": "<strength|issue>",
      "comment": "<what's good/bad about this>",
      "action": "<what to change/keep>",
      "priority": "<high|medium|low>"
    },
    ... (3-8 items covering key moments, fewer for shorter pitches)
  ],
  "pause_suggestions": [
    {
      "after_quote": "<verbatim excerpt ≤120 characters where pause should occur>",
      "why": "<reason for pause>",
      "duration_ms": <300-900>
    },
    ... (2-5 suggestions)
  ],
  "cut_suggestions": [
    {
      "quote": "<verbatim excerpt ≤120 characters to remove>",
      "why": "<reason to cut>",
      "replacement": "<optional rewrite or null>"
    },
    ... (0-5 suggestions)
  ]
}

CHUNKING INSTRUCTIONS:
- Break the transcript into 3-8 idea units (chunks)
- Each chunk should be 1-3 sentences that form one coherent idea
- Map each chunk to a rubric criterion (purpose field)
- If a chunk doesn't clearly map to any criterion, use purpose "other" or "transition"
- Chunks should cover the entire transcript with minimal overlap

EVIDENCE + LINE-BY-LINE REQUIREMENTS (MANDATORY):
You must produce outputs that are directly grounded in the transcript.

Evidence quotes:
- For EVERY criterion in rubric_scores, always include evidence_quotes array.
- If score >= 1: Include 1-2 verbatim quotes from transcript (≤120 characters each, exact substrings)
- If score = 0: Use empty array [] and explain what was missing in notes
- Each quote must be verbatim and appear in the transcript exactly
- If criterion is missing/not addressed (missing=true or score=0), set evidence_quotes: [] and explain in notes

Line-by-line coaching:
- Provide 3-8 items (fewer for shorter pitches)
- Every line_by_line[i].quote MUST be a verbatim substring from the transcript (≤120 characters)
- Prefer quotes that align to single sentences or short phrases for UI hover matching
- Each item must include: type ("strength" or "issue"), quote (exact transcript substring), comment, action, priority
- If you cannot find a good quote, DO NOT invent one; omit the item

REMEMBER (STRICT ENFORCEMENT):
- Every claim must have a quote. No exceptions. If you cannot cite a quote, do not include that feedback.
- Quotes must be exact verbatim excerpts from the transcript (≤120 characters).
- Be specific and actionable. Generic advice will be rejected.
- Focus on the most impactful feedback first.
- For chunks: Break transcript naturally by idea, not just by sentence count.
- For rubric_scores: Calculate overall_score as weighted average: sum(score * weight) / sum(weight) for non-optional items. ALWAYS include evidence_quotes for every criterion.
- For line_by_line: Each item MUST have a quote that appears exactly in the transcript. Provide 3-8 items.
- For pause_suggestions: The "after_quote" must be an exact excerpt from the transcript (≤120 characters).
- For cut_suggestions: The "quote" must be an exact excerpt from the transcript (≤120 characters).
- NO HALLUCINATIONS: Do not invent evidence. If a criterion is not supported by transcript content, set score low and evidence_quotes empty.

VALIDATION: Before including any feedback item, verify that the quote appears verbatim in the transcript.`
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    // Parse request body for rubric_id (if provided)
    // Note: We'll use the run's rubric_id from the database, but this allows
    // the client to specify a different rubric_id if needed
    let requestRubricId: string | null = null
    let promptRubric: PromptRubricItem[] | null = null
    let pitchContext: string | null = null
    try {
      const body = await request.json().catch(() => ({}))
      requestRubricId = body.rubric_id || null
      promptRubric = body.prompt_rubric || null
      pitchContext = body.pitch_context || null
      if (requestRubricId) {
        console.log('[Analyze] Request specified rubric_id:', requestRubricId)
      }
      if (promptRubric) {
        console.log('[Analyze] Using prompt-specific rubric:', promptRubric)
      }
      if (pitchContext) {
        console.log('[Analyze] Pitch context provided:', pitchContext.substring(0, 100))
      }
    } catch (e) {
      // Request body is optional, continue with run's rubric_id
    }

    // Set status to 'analyzing' immediately
    await getSupabaseAdmin()
      .from('pitch_runs')
      .update({ status: 'analyzing' })
      .eq('id', id)

    // Fetch the run (include duration_ms and pitch_context)
    const { data: run, error: fetchError } = await getSupabaseAdmin()
      .from('pitch_runs')
      .select('*')
      .eq('id', id)
      .single()
    
    // Use pitch_context from request body if provided, otherwise from run
    const finalPitchContext = pitchContext || run?.pitch_context || null

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

    // Fetch rubric: check rubric_snapshot_json first, then rubric_id
    let rubric: any = null
    let criteria: RubricCriterion[] = []
    let guidingQuestions: string[] = []
    let rubricJson: any = null
    
    // Priority 1: Use rubric_snapshot_json if present (from rubric_json upload)
    if (run.rubric_snapshot_json) {
      rubricJson = run.rubric_snapshot_json
      
      // Extract criteria from snapshot
      if (rubricJson.criteria && Array.isArray(rubricJson.criteria)) {
        criteria = rubricJson.criteria.map((c: any) => ({
          name: c.name || c.label || 'Unknown',
          description: c.description || c.desc || '',
        }))
      }
      
      // Extract guiding_questions from snapshot
      if (rubricJson.guiding_questions && Array.isArray(rubricJson.guiding_questions)) {
        guidingQuestions = rubricJson.guiding_questions.filter((q: any) => 
          typeof q === 'string' && q.trim().length > 0
        )
      }
      
      // Create a virtual rubric object for compatibility
      rubric = {
        name: rubricJson.name || rubricJson.title || 'Custom Rubric',
        title: rubricJson.title || rubricJson.name || 'Custom Rubric',
        description: rubricJson.description || null,
        target_duration_seconds: rubricJson.target_duration_seconds || null,
        max_duration_seconds: rubricJson.max_duration_seconds || null,
      }
      
      console.log('[Analyze] Using rubric_snapshot_json:', {
        runId: id,
        name: rubric.name,
        criteriaCount: criteria.length,
      })
    }
    // Priority 2: Use rubric_id from database (existing behavior)
    else {
      // Use requestRubricId if provided, otherwise use run.rubric_id
      const rubricIdToUse = requestRubricId || run.rubric_id

      if (rubricIdToUse) {
        // Fetch from unified rubrics table
        const { data: fetchedRubric } = await getSupabaseAdmin()
          .from('rubrics')
          .select('*')
          .eq('id', rubricIdToUse)
          .single()
        
        if (fetchedRubric) {
          rubric = fetchedRubric
          rubricJson = rubric.rubric_json || null

          // Extract criteria from rubric_json if available, otherwise fall back to criteria field
          if (rubricJson && rubricJson.criteria && Array.isArray(rubricJson.criteria)) {
            criteria = rubricJson.criteria.map((c: any) => ({
              name: c.name || c.label || 'Unknown',
              description: c.description || '',
            }))
          } else if (rubric.criteria && Array.isArray(rubric.criteria)) {
            // Fallback to legacy criteria field
            criteria = rubric.criteria.map((c: any) => ({
              name: c.name || c.label || 'Unknown',
              description: c.description || '',
            }))
          }

          // Extract guiding_questions from rubric_json
          if (rubricJson && rubricJson.guiding_questions && Array.isArray(rubricJson.guiding_questions)) {
            guidingQuestions = rubricJson.guiding_questions.filter((q: any) => 
              typeof q === 'string' && q.trim().length > 0
            )
          }
        }
      }
    }

    // Fallback to default template rubric if not found
    if (!rubric) {
      const rubricIdToUse = requestRubricId || run.rubric_id
      console.warn('[Analyze] Rubric not found, using default template:', { 
        runId: id, 
        rubricId: rubricIdToUse 
      })
      
      // Fetch first template rubric as fallback
      const { data: defaultRubrics } = await getSupabaseAdmin()
        .from('rubrics')
        .select('*')
        .eq('is_template', true)
        .order('created_at', { ascending: true })
        .limit(1)
      
      if (defaultRubrics && defaultRubrics.length > 0) {
        rubric = defaultRubrics[0]
        rubricJson = rubric.rubric_json || null

        // Extract criteria from rubric_json if available
        if (rubricJson && rubricJson.criteria && Array.isArray(rubricJson.criteria)) {
          criteria = rubricJson.criteria.map((c: any) => ({
            name: c.name || c.label || 'Unknown',
            description: c.description || '',
          }))
        } else if (rubric.criteria && Array.isArray(rubric.criteria)) {
          criteria = rubric.criteria.map((c: any) => ({
            name: c.name || c.label || 'Unknown',
            description: c.description || '',
          }))
        }

        // Extract guiding_questions
        if (rubricJson && rubricJson.guiding_questions && Array.isArray(rubricJson.guiding_questions)) {
          guidingQuestions = rubricJson.guiding_questions.filter((q: any) => 
            typeof q === 'string' && q.trim().length > 0
          )
        }
      }
    }

    if (!rubric || criteria.length === 0) {
      const rubricIdToUse = requestRubricId || run.rubric_id
      console.error('[Analyze] No valid rubric found (including fallback):', { 
        runId: id, 
        rubricId: rubricIdToUse,
        hasRubric: !!rubric,
        criteriaCount: criteria.length,
        hasSnapshot: !!run.rubric_snapshot_json,
      })
      return NextResponse.json(
        { 
          ok: false,
          error: 'Rubric not found',
          details: `No valid rubric found. Rubric ID: ${rubricIdToUse || 'null'}`,
          runId: id,
          rubricId: rubricIdToUse,
          runStatus: run.status,
          transcriptLength,
        },
        { status: 400 }
      )
    }


    // Use duration_ms as source of truth, fallback to audio_seconds
    const audioSeconds = run.duration_ms ? run.duration_ms / 1000 : run.audio_seconds

    // Get user plan before building prompt
    let userPlan: 'free' | 'starter' | 'coach' | 'daypass' = 'free'
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Check user metadata for plan
        const plan = user.user_metadata?.plan || user.user_metadata?.entitlement
        if (plan === 'starter' || plan === 'coach' || plan === 'daypass') {
          userPlan = plan
        } else {
          // Default authenticated users to 'starter'
          userPlan = 'starter'
        }
      }
    } catch (err) {
      // If we can't determine plan, default to 'free'
      console.warn('[Analyze] Could not determine user plan, defaulting to free:', err)
    }

    // Build the analysis prompt
    // Use prompt-specific rubric if provided, otherwise use generic criteria
    // Handle both rubrics table (has 'name' field) and unified table (has 'title' field)
    const rubricName = rubric.name || rubric.title || 'Unknown Rubric'
    
    // Extract target_duration_seconds from rubric_json if available
    const targetDurationSeconds = rubricJson?.target_duration_seconds ?? rubric.target_duration_seconds ?? null
    const maxDurationSeconds = rubricJson?.max_duration_seconds ?? rubric.max_duration_seconds ?? null
    
    const prompt = buildAnalysisPrompt(
      run.transcript,
      criteria,
      promptRubric,
      targetDurationSeconds,
      maxDurationSeconds,
      audioSeconds,
      run.words_per_minute,
      finalPitchContext,
      guidingQuestions,
      userPlan,
      rubricName
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
            content: 'You are an expert pitch coach. You provide detailed, actionable feedback that ALWAYS cites specific verbatim quotes from the transcript. You NEVER make generic claims without evidence. If you cannot cite an exact quote (≤120 characters) from the transcript, you must omit that feedback point entirely. Every piece of feedback must be anchored to a specific transcript excerpt. For rubric_scores, ALWAYS include evidence_quotes: if score >= 1, provide 1-2 quotes; if score = 0, use empty array [] and explain in notes. For line_by_line, provide 3-8 items with exact transcript substrings (≤120 characters each).',
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

      // Validate question_grading if guiding questions were provided
      if (guidingQuestions.length > 0 && !analysisJson.question_grading) {
        console.warn('[Analyze] Guiding questions provided but question_grading missing from response')
        // Don't fail - make it optional
      }

      // Add metadata to analysis_json
      analysisJson.meta = {
        plan_at_time: userPlan,
        generated_at: new Date().toISOString(),
      }

      // Add filler word and hesitation detection for Free and Starter plans
      if (userPlan === 'free' || userPlan === 'starter') {
        // Collect existing quotes to avoid duplicates
        const existingQuotes = new Set<string>()
        analysisJson.line_by_line.forEach(item => {
          existingQuotes.add(item.quote.toLowerCase().trim())
        })

        // Detect filler words and hesitation
        const deliveryIssues = detectFillerWordsAndHesitation(
          run.transcript,
          existingQuotes
        )

        // Add delivery issues to line_by_line (limit to avoid overwhelming)
        if (deliveryIssues.length > 0) {
          // Insert delivery issues at the beginning or mix them in
          // Limit total line_by_line items to reasonable number (max 10-12)
          const maxItems = 12
          const currentCount = analysisJson.line_by_line.length
          const availableSlots = Math.max(0, maxItems - currentCount)
          
          if (availableSlots > 0) {
            // Add top delivery issues
            const issuesToAdd = deliveryIssues.slice(0, Math.min(availableSlots, 3))
            analysisJson.line_by_line = [
              ...issuesToAdd,
              ...analysisJson.line_by_line,
            ]
          } else {
            // Replace lowest priority items if we're at max
            const sortedByPriority = [...analysisJson.line_by_line].sort((a, b) => {
              const priorityOrder = { high: 3, medium: 2, low: 1 }
              return priorityOrder[a.priority] - priorityOrder[b.priority]
            })
            
            // Replace up to 2 lowest priority items with top delivery issues
            const topDeliveryIssues = deliveryIssues.slice(0, 2)
            if (topDeliveryIssues.length > 0) {
              const lowestPriorityItems = sortedByPriority.slice(-2)
              const lowestPriorityQuotes = new Set(
                lowestPriorityItems.map(item => item.quote.toLowerCase().trim())
              )
              
              analysisJson.line_by_line = analysisJson.line_by_line
                .filter(item => !lowestPriorityQuotes.has(item.quote.toLowerCase().trim()))
                .concat(topDeliveryIssues)
            }
          }
        }
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

