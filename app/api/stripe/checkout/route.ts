import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
})

// Plan to price ID mapping
const PLAN_TO_PRICE_ID: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER!,
  coach: process.env.STRIPE_PRICE_COACH!,
  daypass: process.env.STRIPE_PRICE_DAYPASS!,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { plan } = body

    // Validate plan
    if (!plan || !['starter', 'coach', 'daypass'].includes(plan)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid plan. Must be starter, coach, or daypass' },
        { status: 400 }
      )
    }

    // Get price ID from env
    const priceId = PLAN_TO_PRICE_ID[plan]
    if (!priceId) {
      console.error(`[Stripe Checkout] Missing price ID for plan: ${plan}`)
      return NextResponse.json(
        { ok: false, error: 'Price configuration missing for this plan' },
        { status: 500 }
      )
    }

    // Get origin from request headers
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000'
    const baseUrl = origin

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', // All plans are one-time payments for now
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/upgrade?canceled=1`,
      allow_promotion_codes: true,
      metadata: {
        plan,
      },
    })

    console.log(`[Stripe Checkout] Created session for plan: ${plan}, session_id: ${session.id}`)

    return NextResponse.json({
      ok: true,
      url: session.url,
    })
  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error)
    return NextResponse.json(
      { ok: false, error: 'Failed to create checkout session', details: error.message },
      { status: 500 }
    )
  }
}

