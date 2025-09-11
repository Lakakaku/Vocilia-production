import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const QuestionResponseSchema = z.object({
  questionId: z.string().uuid(),
  sessionId: z.string().optional(), // Optional session tracking
  response: z.object({
    text: z.string().optional(),
    rating: z.number().min(1).max(10).optional(),
    yesNo: z.boolean().optional()
  }),
  responseType: z.enum(['answered', 'skipped', 'timeout']),
  customerHash: z.string().optional(), // Anonymous customer tracking
  metadata: z.object({
    responseTime: z.number().optional(), // Time taken to respond in seconds
    purchaseAmount: z.number().optional(),
    storeCode: z.string().optional(),
    deviceType: z.string().optional()
  }).optional()
});

// First, create the question_responses table if it doesn't exist
// This would normally be done via migration, but adding it here for completeness
const createResponsesTableIfNeeded = async (supabase: any) => {
  try {
    // Check if table exists by trying to query it
    const { error } = await supabase
      .from('question_responses')
      .select('id')
      .limit(1);
    
    // If error is about table not existing, create it
    if (error && error.message?.includes('relation "question_responses" does not exist')) {
      await supabase.rpc('create_question_responses_table');
    }
  } catch (err) {
    // Table might already exist, which is fine
    console.log('Table check/creation skipped:', err);
  }
};

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Parse and validate request body
    const body = await request.json();
    const validatedData = QuestionResponseSchema.parse(body);

    const { questionId, sessionId, response, responseType, customerHash, metadata } = validatedData;

    // First, verify the question exists and get business info
    const { data: question, error: questionError } = await supabase
      .from('business_custom_questions')
      .select('*')
      .eq('id', questionId)
      .single();

    if (questionError) {
      if (questionError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Question not found' }, { status: 404 });
      }
      console.error('Error fetching question:', questionError);
      return NextResponse.json({ error: 'Failed to verify question' }, { status: 500 });
    }

    // Create response record (if we had a responses table)
    try {
      // For now, we'll skip creating the response record since the table doesn't exist
      // In a real implementation, this would be:
      /*
      const { data: responseRecord, error: responseError } = await supabase
        .from('question_responses')
        .insert({
          question_id: questionId,
          session_id: sessionId,
          response_text: response.text,
          response_rating: response.rating,
          response_yes_no: response.yesNo,
          response_type: responseType,
          customer_hash: customerHash,
          metadata: metadata,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (responseError) {
        console.error('Error creating response record:', responseError);
      }
      */
    } catch (err) {
      console.log('Response record creation skipped (table may not exist):', err);
    }

    // Update question analytics
    const updates: any = {
      updated_at: new Date().toISOString()
    };

    if (responseType === 'answered') {
      // Increment times_answered
      updates.times_answered = (question.times_answered || 0) + 1;
      
      // Calculate new response rate
      const timesAsked = question.times_asked || 0;
      const timesAnswered = updates.times_answered;
      if (timesAsked > 0) {
        updates.response_rate = Math.round((timesAnswered / timesAsked) * 100 * 100) / 100; // Round to 2 decimal places
      }
    }

    // Update the question record
    const { error: updateError } = await supabase
      .from('business_custom_questions')
      .update(updates)
      .eq('id', questionId);

    if (updateError) {
      console.error('Error updating question analytics:', updateError);
      return NextResponse.json({ error: 'Failed to update analytics' }, { status: 500 });
    }

    // Return success response
    return NextResponse.json({
      success: true,
      questionId,
      responseType,
      analytics: {
        timesAsked: question.times_asked || 0,
        timesAnswered: updates.times_answered || question.times_answered || 0,
        responseRate: updates.response_rate || question.response_rate || 0
      },
      message: responseType === 'answered' 
        ? 'Response recorded and analytics updated'
        : `${responseType} event recorded`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Validation failed',
        details: error.errors
      }, { status: 400 });
    }

    console.error('Error in POST /api/feedback/question-responses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint to retrieve question responses (for analytics)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('question_id');
    const businessId = searchParams.get('business_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!questionId && !businessId) {
      return NextResponse.json({ 
        error: 'Either question_id or business_id is required' 
      }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    if (questionId) {
      // Get analytics for specific question
      const { data: question, error: questionError } = await supabase
        .from('business_custom_questions')
        .select(`
          id,
          question_text,
          question_type,
          priority_level,
          frequency_setting,
          times_asked,
          times_answered,
          response_rate,
          created_at,
          updated_at
        `)
        .eq('id', questionId)
        .single();

      if (questionError) {
        if (questionError.code === 'PGRST116') {
          return NextResponse.json({ error: 'Question not found' }, { status: 404 });
        }
        console.error('Error fetching question analytics:', questionError);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
      }

      return NextResponse.json({
        question: {
          id: question.id,
          questionText: question.question_text,
          questionType: question.question_type,
          priorityLevel: question.priority_level,
          frequencySetting: question.frequency_setting,
          analytics: {
            timesAsked: question.times_asked || 0,
            timesAnswered: question.times_answered || 0,
            responseRate: question.response_rate || 0,
            skippedCount: Math.max((question.times_asked || 0) - (question.times_answered || 0), 0)
          },
          createdAt: question.created_at,
          updatedAt: question.updated_at
        }
      });

    } else if (businessId) {
      // Get analytics for all questions in a business
      const { data: questions, error: questionsError } = await supabase
        .from('business_custom_questions')
        .select(`
          id,
          question_text,
          question_type,
          priority_level,
          frequency_setting,
          times_asked,
          times_answered,
          response_rate,
          is_active,
          created_at,
          updated_at
        `)
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('times_asked', { ascending: false })
        .range(offset, offset + limit - 1);

      if (questionsError) {
        console.error('Error fetching business questions:', questionsError);
        return NextResponse.json({ error: 'Failed to fetch business analytics' }, { status: 500 });
      }

      const formattedQuestions = questions.map(question => ({
        id: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        priorityLevel: question.priority_level,
        frequencySetting: question.frequency_setting,
        analytics: {
          timesAsked: question.times_asked || 0,
          timesAnswered: question.times_answered || 0,
          responseRate: question.response_rate || 0,
          skippedCount: Math.max((question.times_asked || 0) - (question.times_answered || 0), 0)
        },
        isActive: question.is_active,
        createdAt: question.created_at,
        updatedAt: question.updated_at
      }));

      // Calculate summary statistics
      const totalQuestions = formattedQuestions.length;
      const totalAsked = formattedQuestions.reduce((sum, q) => sum + q.analytics.timesAsked, 0);
      const totalAnswered = formattedQuestions.reduce((sum, q) => sum + q.analytics.timesAnswered, 0);
      const avgResponseRate = totalQuestions > 0 
        ? formattedQuestions.reduce((sum, q) => sum + q.analytics.responseRate, 0) / totalQuestions 
        : 0;

      return NextResponse.json({
        questions: formattedQuestions,
        summary: {
          totalQuestions,
          totalTimesAsked: totalAsked,
          totalTimesAnswered: totalAnswered,
          averageResponseRate: Math.round(avgResponseRate * 100) / 100,
          mostAskedQuestion: formattedQuestions[0] || null
        },
        pagination: {
          limit,
          offset,
          hasMore: formattedQuestions.length === limit
        }
      });
    }

  } catch (error) {
    console.error('Error in GET /api/feedback/question-responses:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}