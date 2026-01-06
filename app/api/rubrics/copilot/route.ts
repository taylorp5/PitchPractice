import { NextRequest, NextResponse } from 'next/server'
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

interface CopilotRequest {
  contextText: string
  targetLengthSeconds?: number
  rubricType?: string
  userEdits?: string
  currentRubric?: string // JSON stringified current rubric for refinement
}

interface CopilotResponse {
  name: string
  context_summary: string
  guiding_questions: string[]
  criteria: Array<{
    name: string
    description: string
    scoring_guide: string
    weight?: number
  }>
}

// Validate the response structure
function validateCopilotResponse(data: any): data is CopilotResponse {
  if (!data || typeof data !== 'object') return false
  if (!data.name || typeof data.name !== 'string') return false
  if (!data.context_summary || typeof data.context_summary !== 'string') return false
  if (!Array.isArray(data.guiding_questions)) return false
  if (!Array.isArray(data.criteria)) return false
  if (data.criteria.length < 3) return false
  
  for (const criterion of data.criteria) {
    if (!criterion.name || typeof criterion.name !== 'string') return false
    if (!criterion.description || typeof criterion.description !== 'string') return false
    if (!criterion.scoring_guide || typeof criterion.scoring_guide !== 'string') return false
    if (criterion.weight !== undefined && typeof criterion.weight !== 'number') return false
  }
  
  return true
}

// Extract JSON from text that might contain markdown code blocks or extra text
function extractJSON(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string')
  }

  // Try direct JSON parse first
  try {
    const parsed = JSON.parse(text.trim())
    return parsed
  } catch (e) {
    // Continue to extraction methods
  }

  // Try to extract JSON from markdown code blocks
  const jsonBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1])
    } catch (e) {
      // Continue
    }
  }

  // Try to find the first complete JSON object
  let braceCount = 0
  let startIndex = -1
  let endIndex = -1

  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (startIndex === -1) startIndex = i
      braceCount++
    } else if (text[i] === '}') {
      braceCount--
      if (braceCount === 0 && startIndex !== -1) {
        endIndex = i
        break
      }
    }
  }

  if (startIndex !== -1 && endIndex !== -1) {
    try {
      const jsonCandidate = text.substring(startIndex, endIndex + 1)
      return JSON.parse(jsonCandidate)
    } catch (e) {
      // Continue
    }
  }

  throw new Error('Could not extract valid JSON from response')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json() as CopilotRequest
    const { contextText, targetLengthSeconds, rubricType, userEdits, currentRubric } = body

    if (!contextText || typeof contextText !== 'string' || contextText.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'contextText is required' },
        { status: 400 }
      )
    }

    // Build system prompt
    const isRefinement = !!userEdits && !!currentRubric
    let systemPrompt = `You are an expert pitch coach helping users create evaluation rubrics for their pitches.

Your task is to generate a structured rubric based on the user's context. The rubric should help evaluate pitch presentations.

CRITICAL: You MUST respond with ONLY a valid JSON object. No additional text, explanations, or markdown formatting. Just the raw JSON object matching this exact schema:

{
  "name": "string (required, concise rubric name like 'Investor pitch – seed round')",
  "context_summary": "string (required, brief summary of the pitch context and audience)",
  "guiding_questions": ["string", ...] (array of questions to help users prepare, 0-5 questions),
  "criteria": [
    {
      "name": "string (required, criterion name like 'Hook', 'Problem', 'Solution')",
      "description": "string (required, detailed description of what to evaluate)",
      "scoring_guide": "string (required, guide for scoring 0-10, e.g., '0-10: Opening should capture attention immediately')",
      "weight": number (optional, 0.5-2.0, default 1.0)
    }
  ]
}

Requirements:
- At least 3 criteria are required
- Criteria should be specific and actionable
- Scoring guides should clearly explain the 0-10 scale
- Guiding questions should help users prepare for their pitch
- Make criteria relevant to the pitch context described
- Return ONLY valid JSON, no markdown code blocks, no explanations`

    if (isRefinement) {
      systemPrompt += `\n\nYou are refining an existing rubric. The user has provided edits: "${userEdits}". Incorporate these changes while preserving the overall structure.`
    }

    // Build user message
    let userMessage = `Create a rubric for this pitch context:\n\n${contextText.trim()}`

    if (targetLengthSeconds) {
      userMessage += `\n\nTarget duration: ${targetLengthSeconds} seconds (${Math.floor(targetLengthSeconds / 60)} minutes)`
    }

    if (rubricType) {
      userMessage += `\n\nRubric type: ${rubricType}`
    }

    if (isRefinement) {
      try {
        const currentRubricObj = JSON.parse(currentRubric)
        userMessage += `\n\nCurrent rubric:\n${JSON.stringify(currentRubricObj, null, 2)}\n\nUser edits: ${userEdits}\n\nPlease refine the rubric based on these edits.`
      } catch (e) {
        return NextResponse.json(
          { ok: false, error: 'Invalid currentRubric JSON' },
          { status: 400 }
        )
      }
    }

    // Call OpenAI
    let response: CopilotResponse
    try {
      const openai = getOpenAIClient()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userMessage,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      })

      const responseText = completion.choices[0]?.message?.content
      if (!responseText) {
        throw new Error('Empty response from OpenAI')
      }

      // Extract and parse JSON
      let parsed: any
      try {
        parsed = extractJSON(responseText)
      } catch (parseError: any) {
        console.error('JSON extraction error:', {
          error: parseError,
          responsePreview: responseText.substring(0, 500),
        })
        return NextResponse.json(
          { 
            ok: false,
            error: 'Failed to parse rubric response',
            details: parseError.message || 'Could not extract valid JSON from AI response',
          },
          { status: 500 }
        )
      }
      
      // Validate structure
      if (!validateCopilotResponse(parsed)) {
        console.error('Invalid copilot response structure:', {
          parsed,
          hasName: !!parsed?.name,
          hasCriteria: !!parsed?.criteria,
          criteriaLength: parsed?.criteria?.length,
        })
        return NextResponse.json(
          { 
            ok: false,
            error: 'Invalid rubric structure',
            details: 'The AI returned a rubric that does not match the required format. Missing required fields or invalid structure.',
          },
          { status: 500 }
        )
      }

      response = parsed
    } catch (error: any) {
      console.error('OpenAI generation error:', error)
      return NextResponse.json(
        { 
          ok: false,
          error: 'Failed to generate rubric',
          details: error.message || 'Unknown error',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, ...response })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}


