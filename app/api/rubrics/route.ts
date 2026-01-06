import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

// GET - List rubrics (templates or user's custom rubrics)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get('scope') || 'templates' // 'templates' | 'mine'

    if (scope === 'templates') {
      // Get all template rubrics (readable by everyone)
      const { data: rubrics, error } = await getSupabaseAdmin()
        .from('rubrics')
        .select('*')
        .eq('is_template', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch template rubrics' },
          { status: 500 }
        )
      }

      return NextResponse.json(rubrics || [])
    } else if (scope === 'mine') {
      // Get authenticated user's custom rubrics
      const supabase = await createClient()
      const { data: { user }, error: userError } = await supabase.auth.getUser()

      if (userError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      const { data: rubrics, error } = await supabase
        .from('rubrics')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_template', false)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Database error:', error)
        return NextResponse.json(
          { error: 'Failed to fetch user rubrics' },
          { status: 500 }
        )
      }

      return NextResponse.json(rubrics || [])
    } else {
      return NextResponse.json(
        { error: 'Invalid scope. Use "templates" or "mine"' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create new custom rubric
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
    const { title, description, rubric_json } = body

    // Validation
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (!rubric_json || typeof rubric_json !== 'object') {
      return NextResponse.json(
        { error: 'rubric_json is required' },
        { status: 400 }
      )
    }

    // Extract criteria from rubric_json for backward compatibility
    const criteria = rubric_json.criteria || []
    if (!Array.isArray(criteria) || criteria.length < 3) {
      return NextResponse.json(
        { error: 'At least 3 criteria are required in rubric_json.criteria' },
        { status: 400 }
      )
    }

    // Build the rubric record
    const rubricData: any = {
      user_id: user.id,
      title: title.trim(),
      description: description?.trim() || null,
      is_template: false,
      rubric_json: rubric_json,
      criteria: criteria, // Keep for backward compatibility
    }

    // Extract target_duration_seconds and max_duration_seconds if provided
    if (rubric_json.target_duration_seconds !== undefined) {
      rubricData.target_duration_seconds = rubric_json.target_duration_seconds
    }
    if (rubric_json.max_duration_seconds !== undefined) {
      rubricData.max_duration_seconds = rubric_json.max_duration_seconds
    }

    const { data: rubric, error } = await supabase
      .from('rubrics')
      .insert(rubricData)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create rubric', details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, rubric })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
