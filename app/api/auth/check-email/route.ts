import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let normalizedEmail = ''
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { exists: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Normalize email (lowercase, trim)
    normalizedEmail = email.toLowerCase().trim()

    // Check if email exists in auth.users via user_profiles table
    // Using service role to bypass RLS
    const supabaseAdmin = getSupabaseAdmin()
    
    // First try to check user_profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('user_id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    // If profile exists, email is already registered
    if (profile) {
      return NextResponse.json({
        exists: true,
        email: normalizedEmail,
      })
    }

    // If table doesn't exist or query failed, fall back to checking auth.users directly
    // This is a fallback for cases where user_profiles migration hasn't been run
    if (profileError) {
      console.warn('[Check Email] user_profiles query failed, falling back to auth.users:', profileError.message)
      
      // Fallback: Check auth.users directly (requires service role)
      // Note: This is less efficient but works if user_profiles doesn't exist
      const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (authError) {
        console.error('[Check Email] Auth check failed:', authError)
        // If we can't check, return false to allow signup attempt
        // Supabase will still prevent duplicates if email confirmation is disabled
        return NextResponse.json({
          exists: false,
          email: normalizedEmail,
        })
      }

      // Check if email exists in auth users
      const emailExists = authUsers?.users?.some(
        (user) => user.email?.toLowerCase().trim() === normalizedEmail
      )

      return NextResponse.json({
        exists: !!emailExists,
        email: normalizedEmail,
      })
    }

    // No profile found, email is available
    return NextResponse.json({
      exists: false,
      email: normalizedEmail,
    })
  } catch (error: any) {
    console.error('[Check Email] Unexpected error:', error)
    // On error, return false to allow signup attempt
    // Supabase will still prevent duplicates if email confirmation is disabled
    return NextResponse.json({
      exists: false,
      email: normalizedEmail,
    })
  }
}
