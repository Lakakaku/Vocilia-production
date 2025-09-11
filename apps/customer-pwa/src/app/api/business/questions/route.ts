import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateQuestionSchema = z.object({
  questionText: z.string().min(1).max(500),
  questionType: z.enum(['open_ended', 'rating', 'yes_no']),
  frequencySetting: z.number().min(1).max(100).default(15),
  priorityLevel: z.enum(['high', 'medium', 'low']).default('medium'),
  activeMonths: z.array(z.number().min(1).max(12)).default([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  activeStartDate: z.string().optional().nullable(),
  activeEndDate: z.string().optional().nullable(),
  targetAllStores: z.boolean().default(true),
  targetStoreIds: z.array(z.string().uuid()).default([]),
  locationId: z.string().uuid().optional().nullable()
});

export async function GET(request: NextRequest) {
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

    // Get URL parameters for filtering
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('active');
    const locationId = searchParams.get('location_id');

    // Build query
    let query = supabase
      .from('business_custom_questions')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (isActive !== null) {
      query = query.eq('is_active', isActive === 'true');
    }

    if (locationId) {
      query = query.or(`location_id.eq.${locationId},location_id.is.null`);
    }

    const { data: questions, error: questionsError } = await query;

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    // Transform data to match frontend expectations
    const formattedQuestions = questions.map(question => ({
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
    }));

    return NextResponse.json({ questions: formattedQuestions });

  } catch (error) {
    console.error('Error in GET /api/business/questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
    const validatedData = CreateQuestionSchema.parse(body);

    // Create question in database
    const { data: question, error: questionError } = await supabase
      .from('business_custom_questions')
      .insert({
        business_id: business.id,
        location_id: validatedData.locationId,
        question_text: validatedData.questionText,
        question_type: validatedData.questionType,
        frequency_setting: validatedData.frequencySetting,
        priority_level: validatedData.priorityLevel,
        active_months: validatedData.activeMonths,
        active_start_date: validatedData.activeStartDate,
        active_end_date: validatedData.activeEndDate,
        target_all_stores: validatedData.targetAllStores,
        target_store_ids: validatedData.targetStoreIds,
        is_active: true,
        times_asked: 0,
        times_answered: 0,
        response_rate: 0
      })
      .select()
      .single();

    if (questionError) {
      console.error('Error creating question:', questionError);
      return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
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

    return NextResponse.json({ question: formattedQuestion }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.errors }, { status: 400 });
    }
    
    console.error('Error in POST /api/business/questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}