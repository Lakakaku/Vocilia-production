import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, onboarding_completed')
      .eq('email', session.user.email)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    if (business.onboarding_completed) {
      return NextResponse.json({ error: 'Onboarding already completed' }, { status: 400 });
    }

    // Get onboarding progress to validate completion
    const { data: progress, error: progressError } = await supabase
      .from('business_onboarding_progress')
      .select('*')
      .eq('business_id', business.id)
      .single();

    if (progressError) {
      console.error('Error fetching progress:', progressError);
      return NextResponse.json({ error: 'Progress not found' }, { status: 404 });
    }

    // Validate all steps are completed
    if (!progress.step_1_welcome_completed || 
        !progress.step_2_profile_completed || 
        !progress.step_3_integration_completed || 
        !progress.step_4_goals_completed) {
      return NextResponse.json({ 
        error: 'All onboarding steps must be completed first',
        missingSteps: {
          step1: !progress.step_1_welcome_completed,
          step2: !progress.step_2_profile_completed,
          step3: !progress.step_3_integration_completed,
          step4: !progress.step_4_goals_completed
        }
      }, { status: 400 });
    }

    // Mark onboarding as completed
    const { error: completionError } = await supabase
      .from('businesses')
      .update({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString()
      })
      .eq('id', business.id);

    if (completionError) {
      console.error('Error completing onboarding:', completionError);
      return NextResponse.json({ error: 'Error completing onboarding' }, { status: 500 });
    }

    // Generate initial store codes for the business
    try {
      await generateInitialStoreCodes(business.id, supabase);
    } catch (storeCodeError) {
      console.error('Error generating store codes:', storeCodeError);
      // Don't fail the onboarding for this - codes can be generated later
    }

    // Create initial context conversation if needed
    try {
      await initializeContextConversation(business.id, supabase);
    } catch (contextError) {
      console.error('Error initializing context conversation:', contextError);
      // Don't fail for this either
    }

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      redirectTo: '/dashboard'
    });

  } catch (error) {
    console.error('Error in complete onboarding API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function generateInitialStoreCodes(businessId: string, supabase: any) {
  // Check if business already has store codes
  const { data: existingCodes } = await supabase
    .from('store_codes')
    .select('id')
    .eq('business_id', businessId)
    .limit(1);

  if (existingCodes && existingCodes.length > 0) {
    return; // Already has codes
  }

  // Generate a single store code for the business
  const storeCode = generateStoreCode();
  
  const { error } = await supabase
    .from('store_codes')
    .insert({
      business_id: businessId,
      code: storeCode,
      name: 'Main Store',
      is_active: true,
      expires_at: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString() // 6 months
    });

  if (error) {
    console.error('Error creating store code:', error);
    throw error;
  }
}

async function initializeContextConversation(businessId: string, supabase: any) {
  // Create initial context conversation
  const { error } = await supabase
    .from('context_conversations')
    .insert({
      business_id: businessId,
      conversation_type: 'onboarding',
      status: 'active',
      messages: JSON.stringify([
        {
          role: 'ai',
          content: 'Welcome to AI Feedback! I\'m here to help optimize your business context for better feedback analysis. Let\'s start by discussing your store layout and customer interaction patterns.',
          timestamp: new Date().toISOString()
        }
      ]),
      context_gaps_identified: ['store_layout', 'staff_names', 'product_categories'],
      questions_asked: 0,
      completion_score: 10
    });

  if (error) {
    console.error('Error creating context conversation:', error);
    throw error;
  }
}

function generateStoreCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}