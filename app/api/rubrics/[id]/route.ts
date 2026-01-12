import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server-auth'

export const dynamic = 'force-dynamic'

// GET - Get a single rubric by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient()

    // Get authenticated user (optional for templates)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: rubric, error } = await supabase
      .from('rubrics')
      .select('*')
      .eq('id', id)
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
        { error: 'Failed to fetch rubric' },
        { status: 500 }
      )
    }

    // Check access: templates are readable by everyone, custom rubrics only by owner
    if (!rubric.is_template) {
      if (!user || rubric.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 403 }
        )
      }
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

// PATCH - Update existing rubric
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
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

    // First, check if rubric exists and user owns it
    const { data: existingRubric, error: fetchError } = await supabase
      .from('rubrics')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingRubric) {
      return NextResponse.json(
        { error: 'Rubric not found' },
        { status: 404 }
      )
    }

    // Only allow updating custom rubrics (not templates)
    if (existingRubric.is_template) {
      return NextResponse.json(
        { error: 'Cannot update template rubrics' },
        { status: 403 }
      )
    }

    // Check ownership
    if (existingRubric.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { error: 'Title is required' },
          { status: 400 }
        )
      }
      updateData.title = title.trim()
    }
    if (description !== undefined) {
      updateData.description = description?.trim() || null
    }
    if (rubric_json !== undefined) {
      if (!rubric_json || typeof rubric_json !== 'object') {
        return NextResponse.json(
          { error: 'rubric_json must be an object' },
          { status: 400 }
        )
      }
      updateData.rubric_json = rubric_json
      
      // Update criteria for backward compatibility
      if (rubric_json.criteria && Array.isArray(rubric_json.criteria)) {
        updateData.criteria = rubric_json.criteria
        if (rubric_json.criteria.length < 3) {
          return NextResponse.json(
            { error: 'At least 3 criteria are required' },
            { status: 400 }
          )
        }
      }
    }

    // Extract duration fields if provided
    if (rubric_json?.target_duration_seconds !== undefined) {
      updateData.target_duration_seconds = rubric_json.target_duration_seconds
    }
    if (rubric_json?.max_duration_seconds !== undefined) {
      updateData.max_duration_seconds = rubric_json.max_duration_seconds
    }

    const { data: rubric, error } = await supabase
      .from('rubrics')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to update rubric', details: error.message },
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

// DELETE - Delete rubric
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const supabase = await createClient()
    
    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // First, check if rubric exists and user owns it
    const { data: existingRubric, error: fetchError } = await supabase
      .from('rubrics')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !existingRubric) {
      return NextResponse.json(
        { error: 'Rubric not found' },
        { status: 404 }
      )
    }

    // Only allow deleting custom rubrics (not templates)
    if (existingRubric.is_template) {
      return NextResponse.json(
        { error: 'Cannot delete template rubrics' },
        { status: 403 }
      )
    }

    // Check ownership
    if (existingRubric.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    const { error } = await supabase
      .from('rubrics')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

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





