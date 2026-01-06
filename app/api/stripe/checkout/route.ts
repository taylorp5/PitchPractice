import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

// Initialize Stripe client with validation
function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  })
}

// Plan to price ID mapping
function getPriceId(plan: string): string {
  const priceId = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`]
  if (!priceId) {
    throw new Error(`STRIPE_PRICE_${plan.toUpperCase()} environment variable is not set`)
  }
  return priceId
}

export async function POST(request: NextRequest) {
  try {
    // Validate Stripe configuration
    let stripe: Stripe
    try {
      stripe = getStripeClient()
    } catch (error: any) {
      console.error('[Stripe Checkout] Configuration error:', error.message)
      return NextResponse.json(
        { ok: false, error: 'Stripe is not properly configured', details: error.message },
        { status: 500 }
      )
    }

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
    let priceId: string
    try {
      priceId = getPriceId(plan)
    } catch (error: any) {
      console.error(`[Stripe Checkout] Missing price ID for plan: ${plan}`, error.message)
      return NextResponse.json(
        { ok: false, error: 'Price configuration missing for this plan', details: error.message },
        { status: 500 }
      )
    }

    // Validate price ID format
    if (!priceId.startsWith('price_')) {
      console.error(`[Stripe Checkout] Invalid price ID format for plan: ${plan}`, priceId)
      return NextResponse.json(
        { ok: false, error: 'Invalid price ID format', details: 'Price ID must start with "price_"' },
        { status: 500 }
      )
    }

    // Get origin from request headers
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000'
    const baseUrl = origin

    console.log(`[Stripe Checkout] Creating session for plan: ${plan}, priceId: ${priceId}, baseUrl: ${baseUrl}`)

    // Create checkout session
    let session
    try {
      session = await stripe.checkout.sessions.create({
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
    } catch (stripeError: any) {
      console.error('[Stripe Checkout] Stripe API error:', {
        type: stripeError.type,
        code: stripeError.code,
        message: stripeError.message,
        param: stripeError.param,
        priceId,
        plan,
      })
      throw stripeError
    }

    console.log(`[Stripe Checkout] Created session for plan: ${plan}, session_id: ${session.id}`)

    return NextResponse.json({
      ok: true,
      url: session.url,
    })
  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', {
      message: error.message,
      type: error.type,
      code: error.code,
      statusCode: error.statusCode,
      param: error.param,
      raw: error.raw,
    })
    
    // Provide more specific error messages
    let errorMessage = 'Failed to create checkout session'
    let errorDetails = error.message || 'Unknown error'

    // Check for Stripe error types
    if (error.type) {
      if (error.type === 'StripeInvalidRequestError') {
        errorMessage = 'Invalid Stripe request'
        // Provide more helpful details based on the error code
        if (error.code === 'resource_missing') {
          errorDetails = `The price ID "${error.param}" does not exist in Stripe. Please check your STRIPE_PRICE_${plan.toUpperCase()} environment variable.`
        } else if (error.param) {
          errorDetails = `${error.message} (Parameter: ${error.param})`
        } else {
          errorDetails = error.message || 'Please check your Stripe configuration and price IDs'
        }
      } else if (error.type === 'StripeAuthenticationError') {
        errorMessage = 'Stripe authentication failed'
        errorDetails = 'Invalid Stripe API key. Please check your STRIPE_SECRET_KEY.'
      } else if (error.type === 'StripeAPIError') {
        errorMessage = 'Stripe API error'
        errorDetails = error.message || 'Stripe service error'
      } else if (error.type === 'StripeConnectionError') {
        errorMessage = 'Stripe connection error'
        errorDetails = 'Unable to connect to Stripe. Please try again.'
      }
    }

    return NextResponse.json(
      { ok: false, error: errorMessage, details: errorDetails },
      { status: 500 }
    )
  }
}

