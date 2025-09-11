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

    // Get business onboarding status
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, onboarding_completed, onboarding_completed_at')
      .eq('email', session.user.email)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({
      businessId: business.id,
      businessName: business.name,
      onboardingCompleted: business.onboarding_completed || false,
      onboardingCompletedAt: business.onboarding_completed_at,
      needsOnboarding: !business.onboarding_completed
    });

  } catch (error) {
    console.error('Error in check onboarding API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}