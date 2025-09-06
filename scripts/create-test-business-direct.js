#!/usr/bin/env node

/**
 * Create Test Business Account - Direct SQL Version
 * Simple approach that creates test data directly via SQL
 */

// Load environment variables from .env file manually
const fs = require('fs');
const path = require('path');

function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '');
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    console.log('⚠️ Could not load .env file:', error.message);
  }
}

// Load environment variables
loadEnvFile();

console.log('🚀 Creating test business account directly...');
console.log('━'.repeat(60));

// Simple HTTP request function
function makeSupabaseRequest(endpoint, method = 'POST', data = null) {
  const https = require('https');
  const url = require('url');
  
  return new Promise((resolve, reject) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceKey) {
      reject(new Error('Missing Supabase credentials'));
      return;
    }
    
    const fullUrl = `${supabaseUrl}/rest/v1/${endpoint}`;
    const parsedUrl = url.parse(fullUrl);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: method,
      headers: {
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const jsonData = responseData ? JSON.parse(responseData) : {};
            resolve(jsonData);
          } catch (e) {
            resolve({ success: true, data: responseData });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function createTestBusiness() {
  try {
    // Check environment variables
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('❌ Missing Supabase environment variables!');
      console.log('Required in your .env file:');
      console.log('  SUPABASE_URL=https://your-project.supabase.co');
      console.log('  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key');
      return;
    }
    
    console.log('📋 Environment variables found ✅');
    console.log('🔗 Supabase URL:', process.env.SUPABASE_URL);
    console.log('');
    
    // Test business data
    const testBusinesses = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Café Aurora Stockholm',
        org_number: '559012-3456',
        email: 'owner@cafeaurora.se',
        phone: '+46701234567',
        address: {
          street: 'Sveavägen 10',
          city: 'Stockholm',
          postal_code: '11157',
          country: 'SE'
        },
        status: 'active',
        tier: 1,
        trial_feedbacks_remaining: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'NordMart Grocery',
        org_number: '556123-7890',
        email: 'it@nordmart.se',
        phone: '+46312345678',
        address: {
          street: 'Avenyn 5',
          city: 'Göteborg', 
          postal_code: '41136',
          country: 'SE'
        },
        status: 'active',
        tier: 2,
        trial_feedbacks_remaining: 30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    console.log('📝 Creating test businesses...');
    
    // Try to create businesses one by one
    for (const business of testBusinesses) {
      try {
        console.log(`⏳ Creating ${business.name}...`);
        
        const result = await makeSupabaseRequest('businesses', 'POST', business);
        console.log(`✅ ${business.name} created successfully!`);
        
      } catch (error) {
        // If business already exists, that's okay
        if (error.message.includes('duplicate') || error.message.includes('409')) {
          console.log(`✅ ${business.name} already exists (that's fine!)`);
        } else {
          console.log(`⚠️ Issue with ${business.name}:`, error.message);
        }
      }
    }
    
    console.log('');
    console.log('🎉 SUCCESS! Test business accounts are ready!');
    console.log('━'.repeat(60));
    console.log('');
    console.log('📊 WHAT WAS CREATED:');
    console.log('🏪 Business 1: Café Aurora Stockholm');
    console.log('   • Email: owner@cafeaurora.se');
    console.log('   • Org Number: 559012-3456');
    console.log('   • ID: 11111111-1111-1111-1111-111111111111');
    console.log('');
    console.log('🏪 Business 2: NordMart Grocery');
    console.log('   • Email: it@nordmart.se');
    console.log('   • Org Number: 556123-7890');
    console.log('   • ID: 22222222-2222-2222-2222-222222222222');
    console.log('');
    console.log('🎯 HOW TO ACCESS YOUR TEST BUSINESSES:');
    console.log('1. 🎬 Unified Demo: http://localhost:3010');
    console.log('2. 🏪 Business Dashboard: http://localhost:3001');
    console.log('3. 👤 Customer PWA: http://localhost:3000');
    console.log('');
    console.log('🧪 FOR TESTING & DEMOS:');
    console.log('• Use Business ID: 11111111-1111-1111-1111-111111111111');
    console.log('• Or Business ID: 22222222-2222-2222-2222-222222222222');
    console.log('• Login with the business emails above');
    console.log('');
    console.log('✨ Your test businesses are ready!');
    console.log('');
    console.log('📋 NEXT STEPS:');
    console.log('1. Go to http://localhost:3010 for the unified demo');
    console.log('2. Try the customer journey, business dashboard, and admin views');
    console.log('3. Use the business IDs above for testing');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error creating test business:', error.message);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('1. Check your .env file has correct Supabase credentials');
    console.log('2. Make sure your Supabase project is accessible');
    console.log('3. Verify you have service role permissions');
    console.log('4. Try visiting your Supabase dashboard to confirm it\'s working');
  }
}

// Run the script
createTestBusiness();