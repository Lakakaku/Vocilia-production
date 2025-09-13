const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = 'https://ybrbeejvjbccqmewczte.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmJlZWp2amJjY3FtZXdjenRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE4OTU2NiwiZXhwIjoyMDcyNzY1NTY2fQ.VRKosTVyyW0Bb_PfVT_yMpFExVm3lvZ5R-GRzpYe6mk';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: 'test@vocilia.com',
      password: 'Test123456!',
      email_confirm: true
    });
    
    if (authError) {
      console.error('Error creating auth user:', authError);
      return;
    }
    
    console.log('Auth user created:', authData.user.id);
    
    // Create business record
    const { data: businessData, error: businessError } = await supabase
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
      await supabase.auth.admin.deleteUser(authData.user.id);
      return;
    }
    
    console.log('Business created:', businessData);
    console.log('\n✅ Test user created successfully!');
    console.log('Email: test@vocilia.com');
    console.log('Password: Test123456!');
    console.log('Business ID:', businessData.id);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createTestUser();