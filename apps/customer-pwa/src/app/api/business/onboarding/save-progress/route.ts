import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';

// Validation schema for onboarding progress data
const SaveProgressSchema = z.object({
  step: z.number().min(1).max(4),
  stepData: z.record(z.any()).optional(),
  completed: z.boolean().optional(),
  currentStep: z.number().min(1).max(4).optional()
});

const Step2Schema = z.object({
  business_type: z.string().optional(),
  store_count: z.number().min(1).optional(),
  geographic_coverage: z.enum(['single_city', 'region', 'national']).optional(),
  avg_transaction_value_range: z.enum(['50-100', '100-500', '500+']).optional(),
  daily_customer_volume: z.number().min(1).optional()
});

const Step3Schema = z.object({
  pos_system: z.enum(['square', 'shopify', 'zettle', 'other', 'none']).optional(),
  tech_comfort_level: z.enum(['basic', 'intermediate', 'advanced']).optional(),
  verification_method_preference: z.enum(['automatic', 'simple']).optional()
});

const Step4Schema = z.object({
  primary_goals: z.array(z.string()).optional(),
  improvement_areas: z.array(z.string()).optional(),
  expected_feedback_volume: z.number().min(1).optional(),
  staff_training_required: z.boolean().optional()
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get authenticated user
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { step, stepData, completed, currentStep } = SaveProgressSchema.parse(body);

    // Get business
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id')
      .eq('email', session.user.email)
      .single();

    if (businessError) {
      console.error('Error fetching business:', businessError);
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get or create progress record
    let { data: progress, error: progressError } = await supabase
      .from('business_onboarding_progress')
      .select('*')
      .eq('business_id', business.id)
      .single();

    if (progressError && progressError.code === 'PGRST116') {
      // Create new progress record
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
        console.error('Error creating progress:', createError);
        return NextResponse.json({ error: 'Error creating progress' }, { status: 500 });
      }
      
      progress = newProgress;
    } else if (progressError) {
      console.error('Error fetching progress:', progressError);
      return NextResponse.json({ error: 'Error fetching progress' }, { status: 500 });
    }

    // Prepare update data
    const updateData: any = {
      last_activity_at: new Date().toISOString()
    };

    // Update current step if provided
    if (currentStep !== undefined) {
      updateData.current_step = currentStep;
    }

    // Handle step-specific data and completion
    if (step === 1) {
      if (completed) {
        updateData.step_1_welcome_completed = true;
        updateData.step_1_completed_at = new Date().toISOString();
      }
    } else if (step === 2) {
      if (stepData) {
        const validatedData = Step2Schema.parse(stepData);
        updateData.step_2_draft_data = validatedData;
        
        // Save to businesses table as well
        if (completed) {
          await supabase
            .from('businesses')
            .update({
              business_type: validatedData.business_type,
              store_count: validatedData.store_count,
              geographic_coverage: validatedData.geographic_coverage,
              avg_transaction_value_range: validatedData.avg_transaction_value_range,
              daily_customer_volume: validatedData.daily_customer_volume
            })
            .eq('id', business.id);
        }
      }
      
      if (completed) {
        updateData.step_2_profile_completed = true;
        updateData.step_2_completed_at = new Date().toISOString();
      }
    } else if (step === 3) {
      if (stepData) {
        const validatedData = Step3Schema.parse(stepData);
        updateData.step_3_draft_data = validatedData;
        
        // Save to businesses table as well
        if (completed) {
          await supabase
            .from('businesses')
            .update({
              pos_system: validatedData.pos_system,
              tech_comfort_level: validatedData.tech_comfort_level,
              verification_method_preference: validatedData.verification_method_preference
            })
            .eq('id', business.id);
        }
      }
      
      if (completed) {
        updateData.step_3_integration_completed = true;
        updateData.step_3_completed_at = new Date().toISOString();
      }
    } else if (step === 4) {
      if (stepData) {
        const validatedData = Step4Schema.parse(stepData);
        updateData.step_4_draft_data = validatedData;
        
        // Save to businesses table as well
        if (completed) {
          await supabase
            .from('businesses')
            .update({
              primary_goals: validatedData.primary_goals || [],
              improvement_areas: validatedData.improvement_areas || [],
              expected_feedback_volume: validatedData.expected_feedback_volume,
              staff_training_required: validatedData.staff_training_required || false
            })
            .eq('id', business.id);
        }
      }
      
      if (completed) {
        updateData.step_4_goals_completed = true;
        updateData.step_4_completed_at = new Date().toISOString();
      }
    }

    // Update progress record
    const { data: updatedProgress, error: updateError } = await supabase
      .from('business_onboarding_progress')
      .update(updateData)
      .eq('business_id', business.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating progress:', updateError);
      return NextResponse.json({ error: 'Error saving progress' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      progress: updatedProgress,
      currentStep: updatedProgress.current_step
    });

  } catch (error) {
    console.error('Error in save progress API:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data format', details: error.errors }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}