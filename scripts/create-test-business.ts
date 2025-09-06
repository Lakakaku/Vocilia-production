#!/usr/bin/env ts-node

/**
 * Create Test Business Account
 * 
 * Simple script to create a fake Swedish business account for testing
 * the AI Feedback Platform without any real business commitments.
 */

import { createSupabaseServiceClient } from '../packages/database/src/index.js';
import { randomUUID } from 'crypto';

// Your Test Business Configuration
const TEST_BUSINESS = {
  id: randomUUID(),
  name: 'Test Café Stockholm', // Change this to whatever you want
  org_number: '559999-0001', // Fake Swedish org number
  email: 'test@testcafe.se',
  phone: '+46701234567',
  address: {
    street: 'Testgatan 123',
    city: 'Stockholm',
    postalCode: '11151', 
    country: 'SE'
  },
  status: 'active',
  tier: 1, // Small business tier (20% commission)
  context: {
    type: 'cafe',
    specialties: ['test coffee', 'demo pastries', 'fake sandwiches'],
    atmosphere: 'testing environment café',
    knownIssues: ['this is a demo'],
    strengths: ['great for testing', 'fake but realistic data']
  }
};

const TEST_LOCATION = {
  id: randomUUID(),
  business_id: TEST_BUSINESS.id,
  name: 'Test Café Main Location',
  address: 'Testgatan 123, Stockholm',
  qr_code_url: `https://demo.ai-feedback-platform.se/scan/${randomUUID()}`
};

async function createTestBusiness() {
  try {
    console.log('🚀 Creating test business account...');
    
    // Create Supabase client
    const supabase = createSupabaseServiceClient();
    
    // 1. Create the business
    console.log('📝 Creating business:', TEST_BUSINESS.name);
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .upsert({
        id: TEST_BUSINESS.id,
        name: TEST_BUSINESS.name,
        org_number: TEST_BUSINESS.org_number,
        email: TEST_BUSINESS.email,
        phone: TEST_BUSINESS.phone,
        address: TEST_BUSINESS.address,
        status: TEST_BUSINESS.status,
        tier: TEST_BUSINESS.tier,
        context_data: TEST_BUSINESS.context,
        trial_feedbacks_remaining: 30, // 30 free trial feedbacks
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (businessError) {
      console.error('❌ Error creating business:', businessError);
      return;
    }
    
    // 2. Create a location for the business
    console.log('📍 Creating business location...');
    const { data: location, error: locationError } = await supabase
      .from('business_locations')
      .upsert({
        id: TEST_LOCATION.id,
        business_id: TEST_LOCATION.business_id,
        name: TEST_LOCATION.name,
        address: TEST_LOCATION.address,
        qr_code_url: TEST_LOCATION.qr_code_url,
        is_active: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (locationError) {
      console.error('❌ Error creating location:', locationError);
      return;
    }
    
    // 3. Create some sample QR codes
    console.log('🏷️ Creating QR codes...');
    const qrCodes = [];
    for (let i = 0; i < 5; i++) {
      const qrCode = {
        id: randomUUID(),
        business_id: TEST_BUSINESS.id,
        location_id: TEST_LOCATION.id,
        qr_token: `test-qr-${i + 1}-${Date.now()}`,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        is_active: true,
        created_at: new Date().toISOString()
      };
      qrCodes.push(qrCode);
    }
    
    const { error: qrError } = await supabase
      .from('qr_codes')
      .insert(qrCodes);
    
    if (qrError) {
      console.error('❌ Error creating QR codes:', qrError);
      return;
    }
    
    // 4. Create some fake feedback sessions for demo purposes
    console.log('💬 Creating sample feedback sessions...');
    const sessions = [];
    const feedbackExamples = [
      { score: 85, transcript: 'Excellent coffee and friendly staff. Love the atmosphere!', categories: ['service', 'product', 'atmosphere'] },
      { score: 92, transcript: 'Amazing latte art and the pastries are fresh. Anna was very helpful.', categories: ['service', 'product'] },
      { score: 78, transcript: 'Good coffee but seating is limited during lunch hours.', categories: ['product', 'atmosphere'] },
      { score: 88, transcript: 'Great place for meetings. WiFi is fast and coffee is consistently good.', categories: ['atmosphere', 'product'] },
      { score: 95, transcript: 'Best oat milk cappuccino in Stockholm! Clean and modern interior.', categories: ['product', 'atmosphere'] }
    ];
    
    for (let i = 0; i < feedbackExamples.length; i++) {
      const example = feedbackExamples[i];
      const rewardAmount = Math.round((250 * (example.score / 100 * 0.12)) * 100) / 100; // 12% max reward on 250 SEK purchase
      
      sessions.push({
        id: randomUUID(),
        business_id: TEST_BUSINESS.id,
        location_id: TEST_LOCATION.id,
        qr_code_id: qrCodes[0].id,
        customer_hash: `test-customer-${i + 1}`,
        session_token: randomUUID(),
        transaction_id: `test-tx-${Date.now()}-${i}`,
        purchase_amount: 250,
        purchase_time: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed',
        quality_score: example.score,
        reward_amount: rewardAmount,
        feedback_categories: example.categories,
        transcript: example.transcript,
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        completed_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000 + 180000).toISOString() // 3 minutes later
      });
    }
    
    const { error: sessionsError } = await supabase
      .from('feedback_sessions')
      .insert(sessions);
    
    if (sessionsError) {
      console.error('❌ Error creating feedback sessions:', sessionsError);
      return;
    }
    
    console.log('\n✅ SUCCESS! Test business account created:');
    console.log('━'.repeat(50));
    console.log('🏪 Business Name:', TEST_BUSINESS.name);
    console.log('📧 Email:', TEST_BUSINESS.email);
    console.log('📱 Phone:', TEST_BUSINESS.phone);
    console.log('🆔 Business ID:', TEST_BUSINESS.id);
    console.log('📍 Location ID:', TEST_LOCATION.id);
    console.log('🏷️ QR Codes Created:', qrCodes.length);
    console.log('💬 Sample Feedback Sessions:', sessions.length);
    console.log('━'.repeat(50));
    
    console.log('\n🎯 HOW TO ACCESS YOUR TEST BUSINESS:');
    console.log('1. Business Dashboard: http://localhost:3001');
    console.log('2. Login with business ID:', TEST_BUSINESS.id);
    console.log('3. Or use email:', TEST_BUSINESS.email);
    
    console.log('\n🧪 FOR TESTING CUSTOMER FEEDBACK:');
    console.log('1. Go to: http://localhost:3010');
    console.log('2. Use QR token:', qrCodes[0].qr_token);
    console.log('3. Test transaction ID:', sessions[0].transaction_id);
    
    console.log('\n🔄 TO CREATE ANOTHER TEST BUSINESS:');
    console.log('Run: npm run create-test-business');
    
  } catch (error) {
    console.error('❌ Error creating test business:', error);
    process.exit(1);
  }
}

// Run the script
createTestBusiness()
  .then(() => {
    console.log('\n🎉 Test business creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to create test business:', error);
    process.exit(1);
  });