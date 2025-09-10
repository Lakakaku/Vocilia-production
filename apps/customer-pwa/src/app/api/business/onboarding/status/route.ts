import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business information
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select(`
        id,
        name,
        business_type,
        store_count,
        geographic_coverage,
        avg_transaction_value_range,
        daily_customer_volume,
        pos_system,
        tech_comfort_level,
        verification_method_preference,
        primary_goals,
        improvement_areas,
        expected_feedback_volume,
        staff_training_required,
        onboarding_completed,
        onboarding_completed_at,
        context_data
      `)
      .eq('email', session.user.email)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get onboarding progress
    const { data: progress, error: progressError } = await supabase
      .from('business_onboarding_progress')
      .select('*')
      .eq('business_id', business.id)
      .single();

    if (progressError && progressError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error fetching onboarding progress:', progressError);
      return NextResponse.json({ error: 'Error fetching progress' }, { status: 500 });
    }

    // If no progress record exists, create one
    if (!progress) {
      const { data: newProgress, error: createError } = await supabase
        .from('business_onboarding_progress')
        .insert({
          business_id: business.id,
          current_step: 1,
          started_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating onboarding progress:', createError);
        return NextResponse.json({ error: 'Error creating progress' }, { status: 500 });
      }

      return NextResponse.json({
        business,
        progress: newProgress,
        isComplete: false,
        currentStep: 1
      });
    }

    return NextResponse.json({
      business,
      progress,
      isComplete: business.onboarding_completed || false,
      currentStep: progress.current_step || 1
    });

  } catch (error) {
    console.error('Error in onboarding status API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}