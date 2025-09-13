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

async function resetTestUserPassword() {
  try {
    console.log('Resetting password for test@vocilia.com...');
    
    // Update the user's password using admin API
    const { data, error } = await supabase.auth.admin.updateUserById(
      '005204c8-6e40-4479-8932-542375f0210d',
      { 
        password: 'Test123456!',
        email_confirm: true
      }
    );
    
    if (error) {
      console.error('Error updating password:', error);
      return;
    }
    
    console.log('✅ Password reset successfully!');
    console.log('Email: test@vocilia.com');
    console.log('Password: Test123456!');
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

resetTestUserPassword();