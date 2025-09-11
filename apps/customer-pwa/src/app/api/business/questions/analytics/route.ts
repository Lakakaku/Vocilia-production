import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

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
      .select('id, name')
      .eq('owner_id', session.user.id)
      .single();

    if (businessError || !business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get URL parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('time_range') || '30d'; // 7d, 30d, 90d, 1y
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    // Build query
    let query = supabase
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
        active_months,
        created_at,
        updated_at
      `)
      .eq('business_id', business.id);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    // Only include questions updated within the time range
    query = query.gte('updated_at', startDate.toISOString());

    const { data: questions, error: questionsError } = await query
      .order('times_asked', { ascending: false });

    if (questionsError) {
      console.error('Error fetching questions for analytics:', questionsError);
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }

    // Process analytics data
    const totalQuestions = questions.length;
    const activeQuestions = questions.filter(q => q.is_active).length;
    const inactiveQuestions = totalQuestions - activeQuestions;

    // Calculate totals
    const totalTimesAsked = questions.reduce((sum, q) => sum + (q.times_asked || 0), 0);
    const totalTimesAnswered = questions.reduce((sum, q) => sum + (q.times_answered || 0), 0);
    const totalSkipped = totalTimesAsked - totalTimesAnswered;

    // Calculate overall response rate
    const overallResponseRate = totalTimesAsked > 0 ? (totalTimesAnswered / totalTimesAsked) * 100 : 0;

    // Group by priority
    const priorityBreakdown = {
      high: questions.filter(q => q.priority_level === 'high').length,
      medium: questions.filter(q => q.priority_level === 'medium').length,
      low: questions.filter(q => q.priority_level === 'low').length
    };

    // Group by question type
    const typeBreakdown = {
      open_ended: questions.filter(q => q.question_type === 'open_ended').length,
      rating: questions.filter(q => q.question_type === 'rating').length,
      yes_no: questions.filter(q => q.question_type === 'yes_no').length
    };

    // Find best and worst performing questions
    const questionsWithResponseRate = questions
      .filter(q => (q.times_asked || 0) > 0)
      .map(q => ({
        id: q.id,
        questionText: q.question_text,
        questionType: q.question_type,
        priorityLevel: q.priority_level,
        timesAsked: q.times_asked || 0,
        timesAnswered: q.times_answered || 0,
        responseRate: q.response_rate || 0,
        isActive: q.is_active
      }));

    const bestPerforming = questionsWithResponseRate
      .sort((a, b) => b.responseRate - a.responseRate)
      .slice(0, 5);

    const worstPerforming = questionsWithResponseRate
      .filter(q => q.responseRate < 50) // Only show questions with less than 50% response rate
      .sort((a, b) => a.responseRate - b.responseRate)
      .slice(0, 5);

    // Most frequently asked questions
    const mostFrequent = questions
      .filter(q => (q.times_asked || 0) > 0)
      .sort((a, b) => (b.times_asked || 0) - (a.times_asked || 0))
      .slice(0, 5)
      .map(q => ({
        id: q.id,
        questionText: q.question_text,
        timesAsked: q.times_asked || 0,
        timesAnswered: q.times_answered || 0,
        responseRate: q.response_rate || 0
      }));

    // Seasonal analysis (current month vs all months)
    const currentMonth = now.getMonth() + 1;
    const seasonallyActiveQuestions = questions.filter(q => {
      const activeMonths = q.active_months || [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      return activeMonths.includes(currentMonth);
    }).length;

    // Frequency distribution
    const frequencyDistribution = questions.reduce((acc, q) => {
      const freq = q.frequency_setting || 1;
      const key = freq === 1 ? '1 (every customer)' : 
                  freq <= 5 ? '2-5 (frequent)' :
                  freq <= 15 ? '6-15 (regular)' :
                  freq <= 50 ? '16-50 (occasional)' : '50+ (rare)';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Insights and recommendations
    const insights = [];
    
    if (overallResponseRate < 30) {
      insights.push({
        type: 'warning',
        title: 'Low Response Rate',
        message: `Overall response rate is ${overallResponseRate.toFixed(1)}%. Consider reviewing question clarity and timing.`,
        action: 'Review question wording and frequency settings'
      });
    }
    
    if (priorityBreakdown.high > totalQuestions * 0.5) {
      insights.push({
        type: 'info',
        title: 'Too Many High Priority Questions',
        message: 'More than half of your questions are set to high priority, which may overwhelm customers.',
        action: 'Consider adjusting priority levels for better question rotation'
      });
    }
    
    if (activeQuestions === 0) {
      insights.push({
        type: 'error',
        title: 'No Active Questions',
        message: 'You have no active custom questions. Customers won\'t receive personalized questions.',
        action: 'Activate some questions or create new ones'
      });
    }
    
    if (seasonallyActiveQuestions < activeQuestions * 0.5) {
      insights.push({
        type: 'info',
        title: 'Limited Seasonal Relevance',
        message: `Only ${seasonallyActiveQuestions} of ${activeQuestions} active questions are configured for the current month.`,
        action: 'Review seasonal activation settings for better relevance'
      });
    }

    return NextResponse.json({
      businessId: business.id,
      businessName: business.name,
      timeRange,
      dateRange: {
        startDate: startDate.toISOString(),
        endDate: now.toISOString()
      },
      overview: {
        totalQuestions,
        activeQuestions,
        inactiveQuestions,
        seasonallyActiveQuestions,
        totalTimesAsked,
        totalTimesAnswered,
        totalSkipped,
        overallResponseRate: Math.round(overallResponseRate * 100) / 100
      },
      breakdowns: {
        priority: priorityBreakdown,
        questionType: typeBreakdown,
        frequency: frequencyDistribution
      },
      performance: {
        bestPerforming,
        worstPerforming,
        mostFrequent
      },
      insights,
      metadata: {
        generatedAt: now.toISOString(),
        questionsAnalyzed: totalQuestions,
        dataCompleteness: totalQuestions > 0 ? 'complete' : 'no_data'
      }
    });

  } catch (error) {
    console.error('Error in GET /api/business/questions/analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}