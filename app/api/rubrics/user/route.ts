import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

// GET - List user's rubrics
export async function GET() {
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

    const { data: rubrics, error } = await supabase
      .from('user_rubrics')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch rubrics' },
        { status: 500 }
      )
    }

    return NextResponse.json(rubrics || [])
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new rubric
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

    const body = await request.json()
    const { title, description, target_duration_seconds, criteria } = body

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(criteria) || criteria.length < 3) {
      return NextResponse.json(
        { error: 'At least 3 criteria are required' },
        { status: 400 }
      )
    }

    // Validate criteria structure
    for (const criterion of criteria) {
      if (!criterion.key || !criterion.label) {
        return NextResponse.json(
          { error: 'Each criterion must have a key and label' },
          { status: 400 }
        )
      }
    }

    const { data: rubric, error } = await supabase
      .from('user_rubrics')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        target_duration_seconds: target_duration_seconds || null,
        criteria: criteria,
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create rubric' },
        { status: 500 }
      )
    }

    return NextResponse.json(rubric, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

