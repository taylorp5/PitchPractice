import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'
import { getSupabaseAdmin } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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

    const userId = user.id
    const supabaseAdmin = getSupabaseAdmin()

    // Delete user data from all tables (cascade should handle most, but we'll be explicit)
    // Note: Supabase auth.users deletion will cascade to related tables via foreign keys
    
    // Delete user's pitch runs
    await supabaseAdmin
      .from('pitch_runs')
      .delete()
      .eq('user_id', userId)

    // Delete user's rubrics
    await supabaseAdmin
      .from('user_rubrics')
      .delete()
      .eq('user_id', userId)

    // Delete user's entitlements
    await supabaseAdmin
      .from('user_entitlements')
      .delete()
      .eq('user_id', userId)

    // Delete custom rubrics from unified rubrics table
    await supabaseAdmin
      .from('rubrics')
      .delete()
      .eq('user_id', userId)

    // Finally, delete the auth user (this will cascade to other tables with ON DELETE CASCADE)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Failed to delete user:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

