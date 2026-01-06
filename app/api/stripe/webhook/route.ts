import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
})

// Price ID to plan mapping
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
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[Stripe Webhook] Signature verification failed:', err.message)
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${err.message}` },
      { status: 400 }
    )
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`)

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      console.log(`[Stripe Webhook] Processing checkout.session.completed for session: ${session.id}`)

      // Determine plan from price ID or metadata
      let plan: string | null = session.metadata?.plan || null

      if (!plan && session.line_items) {
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id)
        if (lineItems.data.length > 0) {
          const priceId = lineItems.data[0].price?.id
          if (priceId) {
            plan = PRICE_ID_TO_PLAN[priceId] || null
          }
        }
      }

      if (!plan || !['starter', 'coach', 'daypass'].includes(plan)) {
        console.error(`[Stripe Webhook] Could not determine plan from session ${session.id}`)
        return NextResponse.json({ received: true, warning: 'Could not determine plan' })
      }

      // Get customer ID if available (for linking to user later)
      const customerId = session.customer as string | null

      // Calculate expiration for daypass
      let expiresAt: Date | null = null
      if (plan === 'daypass') {
        expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 24)
      }

      // Store entitlement
      // Note: We may not have user_id at webhook time if user wasn't authenticated
      // The sync endpoint will handle linking to user_id when called from success page
      const supabaseAdmin = getSupabaseAdmin()
      const { error: insertError } = await supabaseAdmin
        .from('user_entitlements')
        .insert({
          user_id: null, // Will be linked via sync endpoint if user authenticates
          session_id: null, // Will be set via sync endpoint
          plan,
          stripe_checkout_session_id: session.id,
          stripe_price_id: session.line_items?.data?.[0]?.price?.id || null,
          stripe_customer_id: customerId,
          expires_at: expiresAt?.toISOString() || null,
        })

      if (insertError) {
        // Check if it's a duplicate (already synced)
        if (insertError.code === '23505') {
          console.log(`[Stripe Webhook] Entitlement already exists for session: ${session.id}`)
        } else {
          console.error('[Stripe Webhook] Database error:', insertError)
          throw insertError
        }
      } else {
        console.log(`[Stripe Webhook] Successfully created entitlement for plan: ${plan}, session: ${session.id}`)
      }
    }

    // Handle other event types if needed (e.g., invoice.paid for subscriptions)
    // if (event.type === 'invoice.paid') {
    //   // Handle subscription renewal
    // }

    return NextResponse.json({ received: true })
  } catch (error: any) {
    console.error('[Stripe Webhook] Error processing event:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    )
  }
}

