// Create a fresh test user using Supabase Admin API
async function createFreshUser() {
  const supabaseUrl = 'https://ybrbeejvjbccqmewczte.supabase.co';
  const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlicmJlZWp2amJjY3FtZXdjenRlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NzE4OTU2NiwiZXhwIjoyMDcyNzY1NTY2fQ.VRKosTVyyW0Bb_PfVT_yMpFExVm3lvZ5R-GRzpYe6mk';
  
  try {
    console.log('Creating fresh test user...');
    
    // Step 1: Create auth user
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        email: 'demo@vocilia.com',
        password: 'Demo123456!',
        email_confirm: true,
        user_metadata: {
          name: 'Demo Business'
        }
      })
    });
    
    const authData = await authResponse.json();
    
    if (!authResponse.ok) {
      console.error('Error creating auth user:', authData);
      return;
    }
    
    console.log('✅ Auth user created:', authData.id);
    
    // Step 2: Create business record
    const businessResponse = await fetch(`${supabaseUrl}/rest/v1/businesses`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        name: 'Demo Business AB',
        email: 'demo@vocilia.com',
        auth_user_id: authData.id,
        status: 'active',
        trial_feedbacks_remaining: 30,
        trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        context_data: {
          businessType: 'retail',
          description: 'Demo business for testing'
        }
      })
    });
    
    const businessData = await businessResponse.json();
    
    if (!businessResponse.ok) {
      console.error('Error creating business:', businessData);
      // Clean up auth user
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${authData.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey': serviceRoleKey
        }
      });
      return;
    }
    
    console.log('✅ Business created:', businessData[0].id);
    console.log('\n🎉 Fresh test user created successfully!');
    console.log('📧 Email: demo@vocilia.com');
    console.log('🔑 Password: Demo123456!');
    console.log('🏢 Business ID:', businessData[0].id);
    console.log('\nYou can now login at https://vocilia.com/business/login');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

createFreshUser();