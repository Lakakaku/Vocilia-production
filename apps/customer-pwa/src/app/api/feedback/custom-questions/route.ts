import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GetCustomQuestionsSchema = z.object({
  businessId: z.string().uuid(),
  storeCode: z.string().optional(),
  locationId: z.string().uuid().optional(),
  customerCount: z.number().min(1).optional(),
  purchaseAmount: z.number().optional()
});

interface QuestionCandidate {
  id: string;
  questionText: string;
  questionType: 'open_ended' | 'rating' | 'yes_no';
  frequencySetting: number;
  priorityLevel: 'high' | 'medium' | 'low';
  timesAsked: number;
  shouldAsk: boolean;
  reason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Parse request body
    const body = await request.json();
    const validatedData = GetCustomQuestionsSchema.parse(body);
    
    const { businessId, storeCode, locationId, customerCount, purchaseAmount } = validatedData;
    const currentMonth = new Date().getMonth() + 1; // JavaScript months are 0-based

    // Get all active questions for this business
    let query = supabase
      .from('business_custom_questions')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true);

    // Filter by location if specified
    if (locationId) {
      query = query.or(`location_id.eq.${locationId},location_id.is.null`);
    }

    const { data: questions, error: questionsError } = await query;

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    // Process questions and determine which ones to ask
    const processedQuestions: QuestionCandidate[] = [];
    
    for (const question of questions) {
      let shouldAsk = false;
      let reason = '';

      // Check seasonal activation
      const activeMonths = question.active_months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      if (!activeMonths.includes(currentMonth)) {
        reason = 'Not active in current month';
      }
      // Check date range if specified
      else if (question.active_start_date && new Date() < new Date(question.active_start_date)) {
        reason = 'Not yet active';
      }
      else if (question.active_end_date && new Date() > new Date(question.active_end_date)) {
        reason = 'No longer active';
      }
      // Check frequency setting
      else if (customerCount && question.frequency_setting > 1) {
        const shouldAskByFrequency = (customerCount % question.frequency_setting) === 0;
        if (!shouldAskByFrequency) {
          reason = `Frequency rule: ask every ${question.frequency_setting} customers`;
        } else {
          shouldAsk = true;
          reason = `Frequency rule: customer ${customerCount} matches frequency ${question.frequency_setting}`;
        }
      }
      // If no customer count provided, allow high priority questions
      else if (!customerCount && question.priority_level === 'high') {
        shouldAsk = true;
        reason = 'High priority question';
      }
      // Default case when frequency is 1 or other conditions are met
      else if (!customerCount || question.frequency_setting === 1) {
        shouldAsk = true;
        reason = 'Always ask (frequency = 1) or no customer count provided';
      }

      processedQuestions.push({
        id: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        frequencySetting: question.frequency_setting,
        priorityLevel: question.priority_level,
        timesAsked: question.times_asked || 0,
        shouldAsk,
        reason
      });
    }

    // Sort by priority and select questions to ask
    const questionsToAsk = processedQuestions
      .filter(q => q.shouldAsk)
      .sort((a, b) => {
        // Sort by priority: high > medium > low
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priorityLevel];
        const bPriority = priorityOrder[b.priorityLevel];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority; // Higher priority first
        }
        
        // If same priority, sort by frequency (less frequently asked questions first)
        const aFreqRatio = a.timesAsked / Math.max(a.frequencySetting, 1);
        const bFreqRatio = b.timesAsked / Math.max(b.frequencySetting, 1);
        return aFreqRatio - bFreqRatio;
      });

    // Limit to maximum 3 questions per session to avoid overwhelming customers
    const selectedQuestions = questionsToAsk.slice(0, 3);

    // If we selected any questions, update their times_asked counter
    if (selectedQuestions.length > 0) {
      const updatePromises = selectedQuestions.map(question =>
        supabase
          .from('business_custom_questions')
          .update({ 
            times_asked: question.timesAsked + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', question.id)
      );
      
      await Promise.all(updatePromises);
    }

    return NextResponse.json({
      questions: selectedQuestions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        priorityLevel: q.priorityLevel
      })),
      metadata: {
        totalAvailable: processedQuestions.length,
        totalEligible: questionsToAsk.length,
        totalSelected: selectedQuestions.length,
        currentMonth,
        customerCount,
        debug: process.env.NODE_ENV === 'development' ? {
          allQuestions: processedQuestions.map(q => ({
            id: q.id,
            questionText: q.questionText.substring(0, 50) + '...',
            shouldAsk: q.shouldAsk,
            reason: q.reason,
            priority: q.priorityLevel,
            frequency: q.frequencySetting,
            timesAsked: q.timesAsked
          }))
        } : undefined
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: 'Validation failed', 
        details: error.errors 
      }, { status: 400 });
    }
    
    console.error('Error in POST /api/feedback/custom-questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for testing/debugging - can be used to preview questions without incrementing counters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const storeCode = searchParams.get('store_code');
    const locationId = searchParams.get('location_id');
    const customerCount = searchParams.get('customer_count');

    if (!businessId) {
      return NextResponse.json({ error: 'business_id is required' }, { status: 400 });
    }

    // Validate business_id format
    if (!businessId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
      return NextResponse.json({ error: 'Invalid business_id format' }, { status: 400 });
    }

    const mockBody = {
      businessId,
      storeCode: storeCode || undefined,
      locationId: locationId || undefined,
      customerCount: customerCount ? parseInt(customerCount) : undefined
    };

    // Use the POST logic but don't increment counters
    const supabase = createRouteHandlerClient({ cookies });
    const currentMonth = new Date().getMonth() + 1;

    let query = supabase
      .from('business_custom_questions')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true);

    if (mockBody.locationId) {
      query = query.or(`location_id.eq.${mockBody.locationId},location_id.is.null`);
    }

    const { data: questions, error: questionsError } = await query;

    if (questionsError) {
      console.error('Error fetching questions:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    if (!questions || questions.length === 0) {
      return NextResponse.json({ 
        questions: [],
        message: 'No active custom questions found for this business'
      });
    }

    // Process questions (same logic as POST but without updating counters)
    const processedQuestions: QuestionCandidate[] = [];
    
    for (const question of questions) {
      let shouldAsk = false;
      let reason = '';

      const activeMonths = question.active_months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      if (!activeMonths.includes(currentMonth)) {
        reason = 'Not active in current month';
      } else if (question.active_start_date && new Date() < new Date(question.active_start_date)) {
        reason = 'Not yet active';
      } else if (question.active_end_date && new Date() > new Date(question.active_end_date)) {
        reason = 'No longer active';
      } else if (mockBody.customerCount && question.frequency_setting > 1) {
        const shouldAskByFrequency = (mockBody.customerCount % question.frequency_setting) === 0;
        if (!shouldAskByFrequency) {
          reason = `Frequency rule: ask every ${question.frequency_setting} customers (current: ${mockBody.customerCount})`;
        } else {
          shouldAsk = true;
          reason = `Frequency match: customer ${mockBody.customerCount} matches frequency ${question.frequency_setting}`;
        }
      } else if (!mockBody.customerCount && question.priority_level === 'high') {
        shouldAsk = true;
        reason = 'High priority question';
      } else if (!mockBody.customerCount || question.frequency_setting === 1) {
        shouldAsk = true;
        reason = 'Always ask (frequency = 1) or no customer count provided';
      }

      processedQuestions.push({
        id: question.id,
        questionText: question.question_text,
        questionType: question.question_type,
        frequencySetting: question.frequency_setting,
        priorityLevel: question.priority_level,
        timesAsked: question.times_asked || 0,
        shouldAsk,
        reason
      });
    }

    const questionsToAsk = processedQuestions
      .filter(q => q.shouldAsk)
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priorityLevel];
        const bPriority = priorityOrder[b.priorityLevel];
        
        if (aPriority !== bPriority) {
          return bPriority - aPriority;
        }
        
        const aFreqRatio = a.timesAsked / Math.max(a.frequencySetting, 1);
        const bFreqRatio = b.timesAsked / Math.max(b.frequencySetting, 1);
        return aFreqRatio - bFreqRatio;
      });

    const selectedQuestions = questionsToAsk.slice(0, 3);

    return NextResponse.json({
      questions: selectedQuestions.map(q => ({
        id: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        priorityLevel: q.priorityLevel
      })),
      preview: true,
      metadata: {
        totalAvailable: processedQuestions.length,
        totalEligible: questionsToAsk.length,
        totalSelected: selectedQuestions.length,
        currentMonth,
        customerCount: mockBody.customerCount,
        allQuestions: processedQuestions.map(q => ({
          id: q.id,
          questionText: q.questionText,
          shouldAsk: q.shouldAsk,
          reason: q.reason,
          priority: q.priorityLevel,
          frequency: q.frequencySetting,
          timesAsked: q.timesAsked
        }))
      }
    });

  } catch (error) {
    console.error('Error in GET /api/feedback/custom-questions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}