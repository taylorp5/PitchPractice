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

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface RubricDraft {
  title: string
  description: string | null
  target_duration_seconds: number | null
  criteria: Array<{
    name: string
    description: string
  }>
}

// Extract JSON from text that might contain markdown code blocks or extra text
function extractJSON(text: string): any {
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text must be a non-empty string')
  }

  // Try direct JSON parse first (most common case with json_object response_format)
  try {
    const parsed = JSON.parse(text.trim())
    return parsed
  } catch (e) {
    // Continue to extraction methods
  }

  // Try to extract JSON from markdown code blocks (```json ... ```)
  const jsonBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
  if (jsonBlockMatch) {
    try {
      return JSON.parse(jsonBlockMatch[1])
    } catch (e) {
      // Continue to next method
    }
  }

  // Try to find the first complete JSON object in the text
  // This handles cases where there's text before/after the JSON
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
      // Continue to regex fallback
    }
  }

  // Fallback: try regex to find any JSON-like object
  const jsonObjectMatch = text.match(/\{[\s\S]*\}/)
  if (jsonObjectMatch) {
    try {
      return JSON.parse(jsonObjectMatch[0])
    } catch (e) {
      // Last attempt failed
    }
  }

  throw new Error('Could not extract valid JSON from response. The AI may have returned non-JSON content.')
}

// Validate rubric draft structure
function validateRubricDraft(draft: any): draft is RubricDraft {
  if (!draft || typeof draft !== 'object') return false
  if (!draft.title || typeof draft.title !== 'string') return false
  if (draft.description !== null && typeof draft.description !== 'string') return false
  if (draft.target_duration_seconds !== null && typeof draft.target_duration_seconds !== 'number') return false
  if (!Array.isArray(draft.criteria)) return false
  if (draft.criteria.length < 3) return false
  
  for (const criterion of draft.criteria) {
    if (!criterion.name || typeof criterion.name !== 'string') return false
    if (!criterion.description || typeof criterion.description !== 'string') return false
  }
  
  return true
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { messages, currentDraft } = body as { 
      messages: Message[]
      currentDraft?: RubricDraft
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Messages array is required' },
        { status: 400 }
      )
    }

    // Build system prompt
    const systemPrompt = `You are an expert pitch coach helping users create evaluation rubrics for their pitches.

Your task is to generate a structured rubric based on the user's conversation. The rubric should help evaluate pitch presentations.

CRITICAL: You MUST respond with ONLY a valid JSON object. No additional text, explanations, or markdown formatting. Just the raw JSON object matching this exact schema:

{
  "title": "string (required, concise rubric name)",
  "description": "string or null (optional description of the rubric)",
  "target_duration_seconds": "number or null (target pitch duration in seconds)",
  "criteria": [
    {
      "name": "string (required, criterion name like 'Clarity of Message')",
      "description": "string (required, detailed description of what to evaluate)"
    }
  ]
}

Requirements:
- At least 3 criteria are required
- Criteria should be specific and actionable
- Descriptions should be clear and evaluable
- If the user mentions a time duration, convert it to seconds (e.g., "2 minutes" = 120, "1.5 minutes" = 90)
- If the user asks for edits, incorporate them into the existing draft while preserving valid structure
- Make criteria relevant to the pitch context the user describes
- Return ONLY valid JSON, no markdown code blocks, no explanations`

    // Build conversation context
    const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ]

    // Add current draft context if provided
    if (currentDraft) {
      conversationMessages.push({
        role: 'system',
        content: `Current draft rubric:\n${JSON.stringify(currentDraft, null, 2)}\n\nUser may ask to modify this draft. Incorporate their changes while preserving the structure.`,
      })
    }

    // Add user messages
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        conversationMessages.push({
          role: msg.role,
          content: msg.content,
        })
      }
    }

    // Call OpenAI
    let draftRubric: RubricDraft
    try {
      const openai = getOpenAIClient()
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: conversationMessages,
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
            error: 'Failed to parse rubric draft',
            details: parseError.message || 'Could not extract valid JSON from AI response',
            parseError: true
          },
          { status: 500 }
        )
      }
      
      // Validate structure
      if (!validateRubricDraft(parsed)) {
        console.error('Invalid rubric draft structure:', {
          parsed,
          hasTitle: !!parsed?.title,
          hasCriteria: !!parsed?.criteria,
          criteriaLength: parsed?.criteria?.length,
        })
        return NextResponse.json(
          { 
            error: 'Invalid rubric draft structure',
            details: 'The AI returned a rubric draft that does not match the required format. Missing required fields or invalid structure.',
            parseError: false
          },
          { status: 500 }
        )
      }

      draftRubric = parsed
    } catch (error: any) {
      console.error('OpenAI generation error:', error)
      return NextResponse.json(
        { 
          error: 'Failed to generate rubric draft',
          details: error.message || 'Unknown error',
          parseError: false
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ draftRubric })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

