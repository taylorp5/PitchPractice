import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Price ID to plan mapping (reverse of checkout)
const PRICE_ID_TO_PLAN: Record<string, string> = {}
if (process.env.STRIPE_PRICE_STARTER) {
  PRICE_ID_TO_PLAN[process.env.STRIPE_PRICE_STARTER] = 'starter'
}
if (process.env.STRIPE_PRICE_COACH) {
  PRICE_ID_TO_PLAN[process.env.STRIPE_PRICE_COACH] = 'coach'
}
if (process.env.STRIPE_PRICE_DAYPASS) {
  PRICE_ID_TO_PLAN[process.env.STRIPE_PRICE_DAYPASS] = 'daypass'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json(
        { ok: false, error: 'session_id is required' },
        { status: 400 }
      )
    }

    console.log(`[Stripe Sync] Syncing session: ${session_id}`)

    // Retrieve checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['line_items'],
    })

    if (!session || session.payment_status !== 'paid') {
      return NextResponse.json(
        { ok: false, error: 'Session not found or not paid' },
        { status: 400 }
      )
    }

    // Determine plan from price ID
    let plan: string | null = null
    if (session.line_items && session.line_items.data.length > 0) {
      const priceId = session.line_items.data[0].price?.id
      if (priceId) {
        plan = PRICE_ID_TO_PLAN[priceId] || session.metadata?.plan || null
      }
    }

    // Fallback to metadata if price ID mapping fails
    if (!plan) {
      plan = session.metadata?.plan || null
    }

    if (!plan || !['starter', 'coach', 'daypass'].includes(plan)) {
      console.error(`[Stripe Sync] Could not determine plan from session ${session_id}`)
      return NextResponse.json(
        { ok: false, error: 'Could not determine plan from checkout session' },
        { status: 400 }
      )
    }

    // Get user ID if authenticated
    let userId: string | null = null
    let sessionId: string | null = null

    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        userId = user.id
        console.log(`[Stripe Sync] Authenticated user: ${userId}`)
      } else {
        // Fallback to session_id for non-authenticated users
        // Note: getSessionId is client-side only, so we'll need to pass it from client
        // For now, we'll store with user_id=null and session_id from metadata or request
        const clientSessionId = body.client_session_id // Pass from client
        if (clientSessionId) {
          sessionId = clientSessionId
          console.log(`[Stripe Sync] Using client session_id: ${sessionId}`)
        }
      }
    } catch (err) {
      console.warn('[Stripe Sync] Could not get user, will use session_id fallback:', err)
    }

    // Calculate expiration for daypass (24 hours from now)
    let expiresAt: Date | null = null
    if (plan === 'daypass') {
      expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 24)
    }

    // Store entitlement in database (upsert to handle webhook race condition)
    const supabaseAdmin = getSupabaseAdmin()
    
    // Check if entitlement already exists (from webhook)
    const { data: existing } = await supabaseAdmin
      .from('user_entitlements')
      .select('id, user_id, session_id')
      .eq('stripe_checkout_session_id', session_id)
      .maybeSingle()

    let entitlement
    let upsertError

    if (existing) {
      // Update existing entitlement (e.g., link to user_id if webhook created it without user)
      // Use userId if provided, otherwise preserve existing user_id
      const finalUserId = userId || existing.user_id
      const finalSessionId = sessionId || existing.session_id
      
      const { data, error } = await supabaseAdmin
        .from('user_entitlements')
        .update({
          user_id: finalUserId,
          session_id: finalSessionId,
          plan,
          stripe_price_id: session.line_items?.data[0]?.price?.id || null,
          stripe_customer_id: session.customer as string || null,
          expires_at: expiresAt?.toISOString() || null,
        })
        .eq('stripe_checkout_session_id', session_id)
        .select()
        .single()
      entitlement = data
      upsertError = error
    } else {
      // Insert new entitlement
      const { data, error } = await supabaseAdmin
        .from('user_entitlements')
        .insert({
          user_id: userId,
          session_id: sessionId,
          plan,
          stripe_checkout_session_id: session_id,
          stripe_price_id: session.line_items?.data[0]?.price?.id || null,
          stripe_customer_id: session.customer as string || null,
          expires_at: expiresAt?.toISOString() || null,
        })
        .select()
        .single()
      entitlement = data
      upsertError = error
    }

    if (upsertError) {
      console.error('[Stripe Sync] Database error:', upsertError)
      return NextResponse.json(
        { ok: false, error: 'Failed to store entitlement', details: upsertError.message },
        { status: 500 }
      )
    }

    console.log(`[Stripe Sync] Successfully synced plan: ${plan} for user: ${userId || sessionId}`)

    return NextResponse.json({
      ok: true,
      plan,
    })
  } catch (error: any) {
    console.error('[Stripe Sync] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to sync entitlement', details: error.message },
      { status: 500 }
    )
  }
}

