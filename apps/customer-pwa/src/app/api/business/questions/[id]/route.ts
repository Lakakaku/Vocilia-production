import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const UpdateQuestionSchema = z.object({
  questionText: z.string().min(1).max(500).optional(),
  questionType: z.enum(['open_ended', 'rating', 'yes_no']).optional(),
  frequencySetting: z.number().min(1).max(100).optional(),
  priorityLevel: z.enum(['high', 'medium', 'low']).optional(),
  activeMonths: z.array(z.number().min(1).max(12)).optional(),
  activeStartDate: z.string().optional().nullable(),
  activeEndDate: z.string().optional().nullable(),
  targetAllStores: z.boolean().optional(),
  targetStoreIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business ID from user
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', session.user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get specific question
    const { data: question, error: questionError } = await supabase
      .from('business_custom_questions')
      .select('*')
      .eq('id', params.id)
      .eq('business_id', business.id)
      .single();

    if (questionError) {
      if (questionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }
      console.error('Error fetching question:', questionError);
      return NextResponse.json({ error: 'Failed to fetch question' }, { status: 500 });
    }

    // Transform data
    const formattedQuestion = {
      id: question.id,
      businessId: question.business_id,
      locationId: question.location_id,
      questionText: question.question_text,
      questionType: question.question_type,
      frequencySetting: question.frequency_setting,
      priorityLevel: question.priority_level,
      activeMonths: question.active_months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      activeStartDate: question.active_start_date,
      activeEndDate: question.active_end_date,
      targetAllStores: question.target_all_stores,
      targetStoreIds: question.target_store_ids || [],
      isActive: question.is_active,
      timesAsked: question.times_asked,
      timesAnswered: question.times_answered,
      responseRate: question.response_rate,
      createdAt: question.created_at,
      updatedAt: question.updated_at
    };

    return NextResponse.json({ question: formattedQuestion });

  } catch (error) {
    console.error('Error in GET /api/business/questions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business ID from user
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', session.user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = UpdateQuestionSchema.parse(body);

    // Build update object
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (validatedData.questionText !== undefined) updateData.question_text = validatedData.questionText;
    if (validatedData.questionType !== undefined) updateData.question_type = validatedData.questionType;
    if (validatedData.frequencySetting !== undefined) updateData.frequency_setting = validatedData.frequencySetting;
    if (validatedData.priorityLevel !== undefined) updateData.priority_level = validatedData.priorityLevel;
    if (validatedData.activeMonths !== undefined) updateData.active_months = validatedData.activeMonths;
    if (validatedData.activeStartDate !== undefined) updateData.active_start_date = validatedData.activeStartDate;
    if (validatedData.activeEndDate !== undefined) updateData.active_end_date = validatedData.activeEndDate;
    if (validatedData.targetAllStores !== undefined) updateData.target_all_stores = validatedData.targetAllStores;
    if (validatedData.targetStoreIds !== undefined) updateData.target_store_ids = validatedData.targetStoreIds;
    if (validatedData.isActive !== undefined) updateData.is_active = validatedData.isActive;

    // Update question in database
    const { data: question, error: questionError } = await supabase
      .from('business_custom_questions')
      .update(updateData)
      .eq('id', params.id)
      .eq('business_id', business.id)
      .select()
      .single();

    if (questionError) {
      if (questionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }
      console.error('Error updating question:', questionError);
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
    }

    // Transform response
    const formattedQuestion = {
      id: question.id,
      businessId: question.business_id,
      locationId: question.location_id,
      questionText: question.question_text,
      questionType: question.question_type,
      frequencySetting: question.frequency_setting,
      priorityLevel: question.priority_level,
      activeMonths: question.active_months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      activeStartDate: question.active_start_date,
      activeEndDate: question.active_end_date,
      targetAllStores: question.target_all_stores,
      targetStoreIds: question.target_store_ids || [],
      isActive: question.is_active,
      timesAsked: question.times_asked,
      timesAnswered: question.times_answered,
      responseRate: question.response_rate,
      createdAt: question.created_at,
      updatedAt: question.updated_at
    };

    return NextResponse.json({ question: formattedQuestion });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    
    console.error('Error in PUT /api/business/questions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business ID from user
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', session.user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get query parameter to determine hard delete vs soft delete
    const { searchParams } = new URL(request.url);
    const hardDelete = searchParams.get('hard') === 'true';

    if (hardDelete) {
      // Permanently delete the question
      const { error: deleteError } = await supabase
        .from('business_custom_questions')
        .delete()
        .eq('id', params.id)
        .eq('business_id', business.id);

      if (deleteError) {
        console.error('Error deleting question:', deleteError);
        return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
      }
    } else {
      // Soft delete by setting is_active to false
      const { error: updateError } = await supabase
        .from('business_custom_questions')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)
        .eq('business_id', business.id);

      if (updateError) {
        console.error('Error soft deleting question:', updateError);
        return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
      }
    }

    return NextResponse.json({ message: 'Question deleted successfully' });

  } catch (error) {
    console.error('Error in DELETE /api/business/questions/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}