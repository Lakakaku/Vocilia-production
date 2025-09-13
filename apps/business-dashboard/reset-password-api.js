// Reset password using Supabase Management API directly
async function resetPassword() {
  const supabaseUrl = 'https://ybrbeejvjbccqmewczte.supabase.co';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmJlZWp2amJjY3FtZXdjenRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE4OTU2NiwiZXhwIjoyMDcyNzY1NTY2fQ.VRKosTVyyW0Bb_PfVT_yMpFExVm3lvZ5R-GRzpYe6mk';
  
  const userId = '005204c8-6e40-4479-8932-542375f0210d';
  
  try {
    console.log('Resetting password for test@vocilia.com...');
    
    const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        password: 'Test123456!',
        email_confirm: true
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error:', data);
      return;
    }
    
    console.log('✅ Password reset successfully!');
    console.log('Email: test@vocilia.com');
    console.log('Password: Test123456!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

resetPassword();