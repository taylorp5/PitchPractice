import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

// Initialize Stripe client
function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set')
  }
  return new Stripe(secretKey, {
    apiVersion: '2023-10-16',
  })
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized. Please sign in.' },
        { status: 401 }
      )
    }

    // Get Stripe customer ID from user_entitlements
    const supabaseAdmin = getSupabaseAdmin()
    const { data: entitlements, error: entitlementsError } = await supabaseAdmin
      .from('user_entitlements')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (entitlementsError || !entitlements?.stripe_customer_id) {
      return NextResponse.json(
        { ok: false, error: 'No billing account found. Please upgrade first.' },
        { status: 404 }
      )
    }

    const customerId = entitlements.stripe_customer_id

    // Get origin for return URL
    const origin = request.headers.get('origin') || request.headers.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:3000'
    const returnUrl = `${origin}/dashboard`

    // Create billing portal session
    const stripe = getStripeClient()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })

    return NextResponse.json({
      ok: true,
      url: portalSession.url,
    })
  } catch (error: any) {
    console.error('[Stripe Portal] Error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create portal session' },
      { status: 500 }
    )
  }
}

