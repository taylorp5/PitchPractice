import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

// Simple in-memory rate limiting
// In production, consider using Redis or a database for distributed rate limiting
interface RateLimitEntry {
  count: number
  resetAt: number
}

const rateLimitMap = new Map<string, RateLimitEntry>()
const RATE_LIMIT_WINDOW_MS = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 1

function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (for proxies/load balancers)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || request.ip || 'unknown'
  
  // Also try to get user ID if authenticated for better rate limiting
  // For now, we'll use IP only and check user ID separately
  return ip
}

function checkRateLimit(identifier: string): { allowed: boolean; resetAt?: number } {
  const now = Date.now()
  const entry = rateLimitMap.get(identifier)

  if (!entry) {
    // First request - allow it
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true }
  }

  // Check if window has expired
  if (now >= entry.resetAt) {
    // Reset window
    rateLimitMap.set(identifier, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })
    return { allowed: true }
  }

  // Check if limit exceeded
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, resetAt: entry.resetAt }
  }

  // Increment count
  entry.count++
  return { allowed: true }
}

// Cleanup old entries on each request (serverless-friendly)
function cleanupOldEntries() {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now >= entry.resetAt) {
      rateLimitMap.delete(key)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Cleanup old rate limit entries
    cleanupOldEntries()
    
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(clientId)
    
    if (!rateLimit.allowed) {
      const waitSeconds = rateLimit.resetAt 
        ? Math.ceil((rateLimit.resetAt - Date.now()) / 1000)
        : 60
      return NextResponse.json(
        { 
          ok: false, 
          error: `Rate limit exceeded. Please wait ${waitSeconds} second${waitSeconds !== 1 ? 's' : ''} before submitting another request.` 
        },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { name, email, topic, message, source } = body

    // Validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { ok: false, error: 'Valid email is required' },
        { status: 400 }
      )
    }

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'Topic is required' },
        { status: 400 }
      )
    }

    const validTopics = ['bug', 'billing', 'account', 'feedback', 'other']
    if (!validTopics.includes(topic)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid topic selected' },
        { status: 400 }
      )
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    // Get user if authenticated (optional)
    let userId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
      }
    } catch (err) {
      // User not authenticated, continue without userId
    }

    // Log request (without sensitive data)
    // Only log metadata, not full message content
    console.log('[Support Request]', {
      userId: userId || 'anonymous',
      emailDomain: email.split('@')[1], // Only log domain, not full email
      topic,
      messageLength: message.length,
      source: source || 'direct',
      timestamp: new Date().toISOString(),
    })

    // TODO: Store in database or send email
    // Option 1: Store in database
    // const supabase = await createClient()
    // await supabase.from('support_requests').insert({
    //   user_id: userId,
    //   name: name || null,
    //   email,
    //   topic,
    //   message,
    //   source: source || 'direct',
    //   created_at: new Date().toISOString(),
    // })
    //
    // Option 2: Send email to support@pitchpractice.com
    // await sendEmail({
    //   to: 'support@pitchpractice.com',
    //   subject: `Support Request: ${topic}`,
    //   body: `From: ${name || 'Anonymous'} (${email})\nTopic: ${topic}\nSource: ${source || 'direct'}\n\n${message}`,
    // })

    return NextResponse.json({ 
      ok: true
    })
  } catch (error: any) {
    console.error('[Support Request] Unexpected error:', {
      error: error.message,
      errorType: error.constructor.name,
      // Do not log full error details that might contain sensitive data
    })
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

