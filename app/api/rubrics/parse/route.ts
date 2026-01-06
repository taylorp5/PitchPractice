import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Get OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey })
}

interface ParsedRubric {
  title: string
  description?: string
  criteria: Array<{
    id: string
    name: string
    description: string
    weight?: number
    scoringGuide?: string
  }>
  context_summary?: string
  guiding_questions?: string[]
  target_duration_seconds?: number
  max_duration_seconds?: number
}

// POST - Parse rubric from file upload or text paste
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    
    let inputText: string = ''
    let inputType: 'file' | 'text' = 'text'

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const file = formData.get('rubric_file') as File | null
      
      if (!file) {
        return NextResponse.json(
          { error: 'No file provided. Use field name "rubric_file".' },
          { status: 400 }
        )
      }

      const fileType = file.type
      const fileName = file.name.toLowerCase()
      
      // Check file type
      if (fileName.endsWith('.json')) {
        // Parse JSON file
        const text = await file.text()
        try {
          const json = JSON.parse(text)
          // If it's already a valid rubric JSON, return it
          if (json.criteria && Array.isArray(json.criteria)) {
            return NextResponse.json({
              ok: true,
              rubric: json,
            })
          }
          // Otherwise, treat as text to parse
          inputText = JSON.stringify(json, null, 2)
        } catch (e) {
          inputText = text
        }
      } else if (fileName.endsWith('.pdf') || fileName.endsWith('.png') || 
                 fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
        // For images/PDFs, we need to extract text using vision API
        // For now, return an error suggesting JSON or text
        return NextResponse.json(
          { 
            error: 'Image/PDF parsing not yet implemented. Please upload a JSON file or paste text.',
            suggestion: 'Convert your rubric image/PDF to text and paste it, or save it as a JSON file.'
          },
          { status: 400 }
        )
      } else {
        // Try to read as text
        inputText = await file.text()
      }
      
      inputType = 'file'
    } else {
      // Handle text paste
      const body = await request.json()
      inputText = body.text || ''
      
      if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
        return NextResponse.json(
          { error: 'Text is required. Provide { text: "..." } in request body.' },
          { status: 400 }
        )
      }
    }

    // Use OpenAI to parse the rubric text
    const openai = getOpenAIClient()
    
    const systemPrompt = `You are a rubric parser. Extract structured rubric information from the provided text.

The text may contain:
- A rubric title/name
- Evaluation criteria with names and descriptions
- Scoring information (weights, scales, etc.)
- Context or instructions
- Guiding questions

Extract and return a structured JSON object with this format:
{
  "title": "Rubric name",
  "description": "Optional description",
  "criteria": [
    {
      "id": "criterion_1",
      "name": "Criterion name",
      "description": "What this criterion evaluates",
      "weight": 1.0,
      "scoringGuide": "Optional scoring guide (e.g., 0-10: description)"
    }
  ],
  "context_summary": "Optional context about the rubric",
  "guiding_questions": ["Optional array of guiding questions"],
  "target_duration_seconds": null,
  "max_duration_seconds": null
}

Requirements:
- At least 3 criteria are required
- Each criterion must have a name and description
- Use clear, concise names for criteria
- If weights are mentioned, include them; otherwise use 1.0 for all
- If scoring scales are mentioned, include them in scoringGuide
- Extract any context or instructions into context_summary
- Extract any guiding questions into guiding_questions array

Return ONLY valid JSON, no markdown formatting.`

    const userPrompt = `Parse this rubric:\n\n${inputText}`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    })

    const responseText = completion.choices[0]?.message?.content
    if (!responseText) {
      throw new Error('Empty response from OpenAI')
    }

    // Parse the JSON response
    let parsed: any
    try {
      parsed = JSON.parse(responseText)
    } catch (parseError: any) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json(
        { 
          error: 'Failed to parse rubric',
          details: 'The AI returned invalid JSON. Please try reformatting your rubric text.'
        },
        { status: 500 }
      )
    }

    // Validate structure
    if (!parsed.title || typeof parsed.title !== 'string') {
      return NextResponse.json(
        { error: 'Invalid rubric: missing or invalid title' },
        { status: 400 }
      )
    }

    if (!parsed.criteria || !Array.isArray(parsed.criteria) || parsed.criteria.length < 3) {
      return NextResponse.json(
        { error: 'Invalid rubric: must have at least 3 criteria' },
        { status: 400 }
      )
    }

    // Ensure all criteria have required fields
    const validatedCriteria = parsed.criteria.map((c: any, idx: number) => ({
      id: c.id || `criterion_${idx + 1}`,
      name: c.name || `Criterion ${idx + 1}`,
      description: c.description || '',
      weight: typeof c.weight === 'number' ? c.weight : 1.0,
      scoringGuide: c.scoringGuide || c.scoring_guide || undefined,
    }))

    const rubric: ParsedRubric = {
      title: parsed.title.trim(),
      description: parsed.description?.trim() || undefined,
      criteria: validatedCriteria,
      context_summary: parsed.context_summary?.trim() || undefined,
      guiding_questions: Array.isArray(parsed.guiding_questions) 
        ? parsed.guiding_questions.filter((q: any) => q && typeof q === 'string')
        : undefined,
      target_duration_seconds: typeof parsed.target_duration_seconds === 'number' 
        ? parsed.target_duration_seconds 
        : undefined,
      max_duration_seconds: typeof parsed.max_duration_seconds === 'number'
        ? parsed.max_duration_seconds
        : undefined,
    }

    return NextResponse.json({
      ok: true,
      rubric,
    })
  } catch (error: any) {
    console.error('Rubric parse error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to parse rubric',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    )
  }
}

