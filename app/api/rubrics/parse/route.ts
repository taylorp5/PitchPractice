import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Constants
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
const ACCEPTED_PDF_TYPE = 'application/pdf'
const ACCEPTED_JSON_TYPE = 'application/json'

// Get OpenAI client
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set')
  }
  return new OpenAI({ apiKey })
}

// Output interface matching requirements
interface ParsedRubricOutput {
  name: string
  description: string | null
  criteria: Array<{
    name: string
    description: string | null
    weight: number | null
  }>
  target_duration_seconds: number | null
  max_duration_seconds: number | null
}

interface ParseResponse {
  ok: boolean
  rubric?: ParsedRubricOutput
  warnings?: string[]
  error?: string
}

/**
 * Helper function to parse rubric from text using deterministic parsing
 * Falls back to this if LLM is unavailable
 * 
 * Examples:
 * - "Criteria: Clarity - How clear is the message?; Structure - Is it well-organized?; Time - Is it within time limit?"
 * - "1. Clarity\n2. Structure\n3. Time"
 * - "• Clarity: How clear is the message?\n• Structure: Is it well-organized?"
 */
function parseRubricFromText(text: string): { rubric: ParsedRubricOutput; warnings: string[] } {
  const warnings: string[] = []
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  
  // Try to extract name/title
  let name = 'Parsed Rubric'
  const titleMatch = text.match(/(?:title|name|rubric)[\s:]+([^\n]+)/i)
  if (titleMatch) {
    name = titleMatch[1].trim()
  }
  
  // Try to extract description
  let description: string | null = null
  const descMatch = text.match(/(?:description|summary)[\s:]+([^\n]+)/i)
  if (descMatch) {
    description = descMatch[1].trim()
  }
  
  // Extract criteria
  const criteria: ParsedRubricOutput['criteria'] = []
  
  // Pattern 1: "Criteria: Name - Description; Name2 - Description2"
  const criteriaPattern1 = /criteria[\s:]+([^;]+(?:;[^;]+)*)/i
  const match1 = text.match(criteriaPattern1)
  if (match1) {
    const criteriaText = match1[1]
    const parts = criteriaText.split(';').map(p => p.trim())
    parts.forEach(part => {
      const dashMatch = part.match(/^([^-]+)-(.+)$/)
      if (dashMatch) {
        criteria.push({
          name: dashMatch[1].trim(),
          description: dashMatch[2].trim(),
          weight: null,
        })
      } else if (part.length > 0) {
        criteria.push({
          name: part,
          description: null,
          weight: null,
        })
      }
    })
  }
  
  // Pattern 2: Numbered or bulleted lists
  if (criteria.length === 0) {
    lines.forEach(line => {
      // Match numbered: "1. Name - Description" or "1) Name - Description"
      const numberedMatch = line.match(/^\d+[.)]\s*(.+)$/)
      // Match bulleted: "• Name - Description" or "- Name - Description" or "* Name - Description"
      const bulletMatch = line.match(/^[•\-\*]\s*(.+)$/)
      
      const content = numberedMatch?.[1] || bulletMatch?.[1]
      if (content) {
        const dashMatch = content.match(/^([^-]+)-(.+)$/)
        if (dashMatch) {
          criteria.push({
            name: dashMatch[1].trim(),
            description: dashMatch[2].trim(),
            weight: null,
          })
        } else {
          criteria.push({
            name: content.trim(),
            description: null,
            weight: null,
          })
        }
      }
    })
  }
  
  // Pattern 3: Table-like format (lines with | or tabs)
  if (criteria.length === 0) {
    lines.forEach(line => {
      const parts = line.split(/[|\t]/).map(p => p.trim()).filter(p => p.length > 0)
      if (parts.length >= 2) {
        criteria.push({
          name: parts[0],
          description: parts[1] || null,
          weight: parts[2] ? parseFloat(parts[2]) || null : null,
        })
      }
    })
  }
  
  // Extract duration if mentioned
  let targetDuration: number | null = null
  let maxDuration: number | null = null
  const durationMatch = text.match(/(?:target|duration|time)[\s:]+(\d+)\s*(?:seconds?|sec|s)/i)
  if (durationMatch) {
    targetDuration = parseInt(durationMatch[1], 10)
  }
  const maxMatch = text.match(/(?:max|maximum)[\s:]+(\d+)\s*(?:seconds?|sec|s)/i)
  if (maxMatch) {
    maxDuration = parseInt(maxMatch[1], 10)
  }
  
  if (criteria.length < 3) {
    warnings.push('Fewer than 3 criteria found. Please ensure your rubric has at least 3 evaluation criteria.')
  }
  
  return {
    rubric: {
      name,
      description,
      criteria: criteria.length > 0 ? criteria : [
        { name: 'Criterion 1', description: 'First evaluation criterion', weight: null },
        { name: 'Criterion 2', description: 'Second evaluation criterion', weight: null },
        { name: 'Criterion 3', description: 'Third evaluation criterion', weight: null },
      ],
      target_duration_seconds: targetDuration,
      max_duration_seconds: maxDuration,
    },
    warnings,
  }
}

/**
 * Validate and coerce JSON rubric into output format
 */
function validateAndCoerceJsonRubric(json: any): { rubric: ParsedRubricOutput; warnings: string[] } {
  const warnings: string[] = []
  
  // Extract name
  const name = json.name || json.title || json.rubric_name || 'Untitled Rubric'
  
  // Extract description
  const description = json.description || json.desc || null
  
  // Extract criteria
  let criteria: ParsedRubricOutput['criteria'] = []
  
  if (json.criteria && Array.isArray(json.criteria)) {
    criteria = json.criteria.map((c: any, idx: number) => {
      // Handle different possible formats
      const criterionName = c.name || c.label || c.title || c.key || `Criterion ${idx + 1}`
      const criterionDesc = c.description || c.desc || c.text || null
      const weight = typeof c.weight === 'number' ? c.weight : (c.importance ? parseFloat(c.importance) : null)
      
      return {
        name: String(criterionName),
        description: criterionDesc ? String(criterionDesc) : null,
        weight,
      }
    })
  } else if (json.items && Array.isArray(json.items)) {
    // Alternative format
    criteria = json.items.map((item: any, idx: number) => ({
      name: item.name || item.label || `Item ${idx + 1}`,
      description: item.description || null,
      weight: item.weight || null,
    }))
  }
  
  if (criteria.length < 3) {
    warnings.push('Rubric has fewer than 3 criteria. At least 3 are recommended.')
  }
  
  // Extract durations
  const targetDuration = json.target_duration_seconds || json.target_duration || json.duration || null
  const maxDuration = json.max_duration_seconds || json.max_duration || json.max_duration_seconds || null
  
  return {
    rubric: {
      name: String(name),
      description: description ? String(description) : null,
      criteria: criteria.length > 0 ? criteria : [
        { name: 'Criterion 1', description: 'First criterion', weight: null },
        { name: 'Criterion 2', description: 'Second criterion', weight: null },
        { name: 'Criterion 3', description: 'Third criterion', weight: null },
      ],
      target_duration_seconds: typeof targetDuration === 'number' ? targetDuration : null,
      max_duration_seconds: typeof maxDuration === 'number' ? maxDuration : null,
    },
    warnings,
  }
}

/**
 * Extract text from image using OpenAI Vision API
 */
async function extractTextFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
  const openai = getOpenAIClient()
  
  // Convert buffer to base64
  const base64Image = imageBuffer.toString('base64')
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text from this image. Preserve the structure, formatting, and any rubric criteria, descriptions, or evaluation details. Return the text exactly as it appears, including any headings, bullet points, or numbered lists.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 2000,
  })
  
  const extractedText = completion.choices[0]?.message?.content
  if (!extractedText) {
    throw new Error('Failed to extract text from image')
  }
  
  return extractedText
}

/**
 * Parse rubric using LLM
 */
async function parseRubricWithLLM(text: string): Promise<{ rubric: ParsedRubricOutput; warnings: string[] }> {
  const openai = getOpenAIClient()
  
  const systemPrompt = `You are a rubric parser. Extract structured rubric information from the provided text.

Extract and return a JSON object with this exact format:
{
  "name": "Rubric name",
  "description": "Optional description or null",
  "criteria": [
    {
      "name": "Criterion name",
      "description": "What this criterion evaluates or null",
      "weight": 1.0 or null
    }
  ],
  "target_duration_seconds": number or null,
  "max_duration_seconds": number or null
}

Requirements:
- At least 3 criteria are required
- Each criterion must have a name
- Description and weight are optional (can be null)
- Extract durations if mentioned (in seconds)
- Return ONLY valid JSON, no markdown formatting`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Parse this rubric:\n\n${text}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 2000,
  })
  
  const responseText = completion.choices[0]?.message?.content
  if (!responseText) {
    throw new Error('Empty response from OpenAI')
  }
  
  let parsed: any
  try {
    parsed = JSON.parse(responseText)
  } catch (parseError: any) {
    // Fallback to deterministic parser
    console.warn('LLM returned invalid JSON, falling back to deterministic parser')
    return parseRubricFromText(text)
  }
  
  // Validate and coerce the LLM response
  return validateAndCoerceJsonRubric(parsed)
}

// POST - Parse rubric from file upload or text paste
export async function POST(request: NextRequest): Promise<NextResponse<ParseResponse>> {
  try {
    const contentType = request.headers.get('content-type') || ''
    const warnings: string[] = []
    
    let inputText: string = ''
    let isFileUpload = false
    
    // Handle file upload (multipart/form-data)
    if (contentType.includes('multipart/form-data')) {
      isFileUpload = true
      const formData = await request.formData()
      const file = formData.get('rubric_file') as File | null
      
      if (!file) {
        return NextResponse.json(
          { ok: false, error: 'No file provided. Use field name "rubric_file".' },
          { status: 400 }
        )
      }
      
      // Security: Check file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { ok: false, error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB` },
          { status: 400 }
        )
      }
      
      // Security: Log only file metadata, not contents
      console.log('[Parse] File upload:', {
        name: file.name,
        size: file.size,
        type: file.type,
        // Never log full file contents
      })
      
      const fileType = file.type
      const fileName = file.name.toLowerCase()
      
      // Handle JSON files
      if (fileType === ACCEPTED_JSON_TYPE || fileName.endsWith('.json')) {
        try {
          const text = await file.text()
          const json = JSON.parse(text)
          const result = validateAndCoerceJsonRubric(json)
          return NextResponse.json({
            ok: true,
            rubric: result.rubric,
            warnings: [...warnings, ...result.warnings],
          })
        } catch (parseError: any) {
          // If JSON parse fails, treat as text
          inputText = await file.text()
          warnings.push('File was not valid JSON, attempting to parse as text')
        }
      }
      // Handle images using OCR
      else if (ACCEPTED_IMAGE_TYPES.includes(fileType) || 
               fileName.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
        try {
          const arrayBuffer = await file.arrayBuffer()
          const imageBuffer = Buffer.from(arrayBuffer)
          inputText = await extractTextFromImage(imageBuffer, fileType)
          warnings.push('Text extracted from image using OCR')
        } catch (ocrError: any) {
          console.error('[Parse] OCR error:', {
            error: ocrError.message,
            fileName: file.name,
            // Never log full file contents
          })
          return NextResponse.json(
            {
              ok: false,
              error: 'Failed to extract text from image. Please try pasting the text directly or use a JSON file.',
            },
            { status: 400 }
          )
        }
      }
      // Handle PDFs
      else if (fileType === ACCEPTED_PDF_TYPE || fileName.endsWith('.pdf')) {
        return NextResponse.json(
          {
            ok: false,
            error: 'PDF parsing is not yet supported. Please convert your PDF to an image, extract the text manually, or paste the rubric text directly.',
          },
          { status: 400 }
        )
      }
      // Try to read as text
      else {
        try {
          inputText = await file.text()
        } catch (textError: any) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Could not read file as text. Please use a JSON file, image, or paste text directly.',
            },
            { status: 400 }
          )
        }
      }
    }
    // Handle text paste (application/json)
    else {
      try {
        const body = await request.json()
        inputText = body.text || ''
        
        if (!inputText || typeof inputText !== 'string' || inputText.trim().length === 0) {
          return NextResponse.json(
            { ok: false, error: 'Text is required. Provide { text: "..." } in request body.' },
            { status: 400 }
          )
        }
      } catch (jsonError: any) {
        return NextResponse.json(
          { ok: false, error: 'Invalid JSON in request body. Expected { text: "..." }' },
          { status: 400 }
        )
      }
    }
    
    // Parse the text using LLM (with fallback to deterministic parser)
    let result: { rubric: ParsedRubricOutput; warnings: string[] }
    try {
      result = await parseRubricWithLLM(inputText)
    } catch (llmError: any) {
      console.error('[Parse] LLM error, using fallback:', {
        error: llmError.message,
        // Never log full text contents
        textLength: inputText.length,
      })
      // Fallback to deterministic parser
      result = parseRubricFromText(inputText)
      warnings.push('LLM parsing failed, used fallback parser')
    }
    
    // Merge warnings
    const allWarnings = [...warnings, ...result.warnings]
    
    return NextResponse.json({
      ok: true,
      rubric: result.rubric,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
    })
  } catch (error: any) {
    // Security: Never log full error details that might contain file contents
    console.error('[Parse] Unexpected error:', {
      error: error.message,
      errorType: error.constructor.name,
      // Never log full file contents or text
    })
    
    return NextResponse.json(
      {
        ok: false,
        error: 'Failed to parse rubric',
      },
      { status: 500 }
    )
  }
}
