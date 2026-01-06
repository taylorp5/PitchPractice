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
    const { title, description, target_duration_seconds, criteria, guiding_questions, context_summary } = body

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

    // Validate criteria structure - support both old format (key/label) and new format (id/name/description/scoringGuide)
    for (const criterion of criteria) {
      // Old format: key + label
      // New format: id + name + description + scoringGuide
      const hasOldFormat = criterion.key && criterion.label
      const hasNewFormat = criterion.id && criterion.name
      if (!hasOldFormat && !hasNewFormat) {
        return NextResponse.json(
          { error: 'Each criterion must have either (key and label) or (id and name)' },
          { status: 400 }
        )
      }
    }

    // Validate guiding_questions if provided
    if (guiding_questions !== undefined && !Array.isArray(guiding_questions)) {
      return NextResponse.json(
        { error: 'guiding_questions must be an array' },
        { status: 400 }
      )
    }

    const { data: rubric, error } = await supabase
      .from('user_rubrics')
      .insert({
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        target_duration_seconds: target_duration_seconds || null,
        criteria: criteria,
        guiding_questions: guiding_questions || [],
        context_summary: context_summary?.trim() || null,
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

// PUT - Update existing rubric
export async function PUT(request: NextRequest) {
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
    const { id, title, description, target_duration_seconds, criteria, guiding_questions, context_summary } = body

    if (!id) {
      return NextResponse.json(
        { error: 'Rubric ID is required' },
        { status: 400 }
      )
    }

    // Validation
    if (title !== undefined && (!title || typeof title !== 'string' || title.trim().length === 0)) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      )
    }

    if (criteria !== undefined) {
      if (!Array.isArray(criteria) || criteria.length < 3) {
        return NextResponse.json(
          { error: 'At least 3 criteria are required' },
          { status: 400 }
        )
      }

      // Validate criteria structure
      for (const criterion of criteria) {
        const hasOldFormat = criterion.key && criterion.label
        const hasNewFormat = criterion.id && criterion.name
        if (!hasOldFormat && !hasNewFormat) {
          return NextResponse.json(
            { error: 'Each criterion must have either (key and label) or (id and name)' },
            { status: 400 }
          )
        }
      }
    }

    if (guiding_questions !== undefined && !Array.isArray(guiding_questions)) {
      return NextResponse.json(
        { error: 'guiding_questions must be an array' },
        { status: 400 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (title !== undefined) updateData.title = title.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (target_duration_seconds !== undefined) updateData.target_duration_seconds = target_duration_seconds || null
    if (criteria !== undefined) updateData.criteria = criteria
    if (guiding_questions !== undefined) updateData.guiding_questions = guiding_questions
    if (context_summary !== undefined) updateData.context_summary = context_summary?.trim() || null

    const { data: rubric, error } = await supabase
      .from('user_rubrics')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this rubric
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Rubric not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { error: 'Failed to update rubric' },
        { status: 500 }
      )
    }

    if (!rubric) {
      return NextResponse.json(
        { error: 'Rubric not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(rubric)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Delete rubric
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Rubric ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('user_rubrics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id) // Ensure user owns this rubric

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to delete rubric' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

