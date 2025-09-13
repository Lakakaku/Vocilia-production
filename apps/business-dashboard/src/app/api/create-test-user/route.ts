import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ybrbeejvjbccqmewczte.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmJlZWp2amJjY3FtZXdjenRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE4OTU2NiwiZXhwIjoyMDcyNzY1NTY2fQ.VRKosTVyyW0Bb_PfVT_yMpFExVm3lvZ5R-GRzpYe6mk';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET() {
  try {
    console.log('Creating test user...');
    
    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById('test@vocilia.com').catch(() => ({ data: null }));
    
    if (existingUser) {
      return NextResponse.json({ 
        message: 'Test user already exists',
        email: 'test@vocilia.com'
      });
    }
    
    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'test@vocilia.com',
      password: 'Test123456!',
      email_confirm: true
    });
    
    if (authError) {
      console.error('Error creating auth user:', authError);
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    
    console.log('Auth user created:', authData.user.id);
    
    // Check if business already exists
    const { data: existingBusiness } = await supabaseAdmin
      .from('businesses')
      .select('*')
      .eq('email', 'test@vocilia.com')
      .single();
    
    if (existingBusiness) {
      // Update existing business with auth_user_id
      const { error: updateError } = await supabaseAdmin
        .from('businesses')
        .update({ auth_user_id: authData.user.id })
        .eq('id', existingBusiness.id);
      
      if (updateError) {
        console.error('Error updating business:', updateError);
      }
      
      return NextResponse.json({
        message: 'Test user created and linked to existing business',
        email: 'test@vocilia.com',
        password: 'Test123456!',
        businessId: existingBusiness.id
      });
    }
    
    // Create new business record
    const { data: businessData, error: businessError } = await supabaseAdmin
      .from('businesses')
      .insert({
        name: 'Test Business',
        email: 'test@vocilia.com',
        auth_user_id: authData.user.id,
        status: 'active',
        trial_feedbacks_remaining: 30,
        trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        context_data: {
          businessType: 'retail',
          description: 'Test business for development'
        }
      })
      .select()
      .single();
    
    if (businessError) {
      console.error('Error creating business:', businessError);
      // Clean up auth user if business creation fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: businessError.message }, { status: 400 });
    }
    
    return NextResponse.json({
      message: 'Test user created successfully!',
      email: 'test@vocilia.com',
      password: 'Test123456!',
      businessId: businessData.id
    });
    
  } catch (error: any) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}