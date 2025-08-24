/**
 * Payment System Test Script
 * Tests Stripe Connect integration for Swedish businesses
 * 
 * Usage: node test-payment-system.js
 */

const axios = require('axios');

// Test configuration
const API_BASE_URL = 'http://localhost:3001';
const TEST_BUSINESS_ID = '12345678-1234-1234-1234-123456789012';

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testPaymentSystem() {
  log('🧪 Starting Payment System Test Suite', 'blue');
  log('======================================', 'blue');
  
  try {
    // Test 1: Health check
    log('\n📊 Test 1: API Health Check', 'cyan');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    if (healthResponse.status === 200) {
      log('✅ API is running', 'green');
    } else {
      throw new Error('API health check failed');
    }

    // Test 2: Check if payment routes are available
    log('\n💳 Test 2: Payment Routes Availability', 'cyan');
    
    try {
      // This should return a 400 (validation error) since we're not sending required data
      // But it confirms the route exists
      await axios.post(`${API_BASE_URL}/api/payments/connect/onboard`, {});
    } catch (error) {
      if (error.response && error.response.status === 400) {
        log('✅ Payment onboarding route is accessible', 'green');
      } else {
        throw error;
      }
    }

    // Test 3: Test Stripe Connect status check
    log('\n🔍 Test 3: Stripe Connect Status Check', 'cyan');
    
    try {
      // This should return a 404 since the business doesn't exist
      // But it confirms the route and basic validation work
      await axios.get(`${API_BASE_URL}/api/payments/connect/status/${TEST_BUSINESS_ID}`);
    } catch (error) {
      if (error.response && error.response.status === 404 && 
          error.response.data.error.code === 'BUSINESS_NOT_FOUND') {
        log('✅ Connect status route working (business validation OK)', 'green');
      } else {
        throw error;
      }
    }

    // Test 4: Test payout endpoint structure
    log('\n💰 Test 4: Payout Endpoint Validation', 'cyan');
    
    try {
      await axios.post(`${API_BASE_URL}/api/payments/payout`, {
        // Missing required fields - should return validation error
      });
    } catch (error) {
      if (error.response && error.response.status === 400 &&
          error.response.data.error.code === 'VALIDATION_ERROR') {
        log('✅ Payout endpoint validation working', 'green');
      } else {
        throw error;
      }
    }

    // Test 5: Check webhook endpoint
    log('\n🪝 Test 5: Webhook Endpoint', 'cyan');
    
    try {
      await axios.post(`${API_BASE_URL}/api/payments/webhooks/stripe`, {});
    } catch (error) {
      if (error.response && error.response.status === 400 &&
          error.response.data.error.code === 'MISSING_SIGNATURE') {
        log('✅ Webhook endpoint accessible (signature validation working)', 'green');
      } else {
        throw error;
      }
    }

    log('\n🎉 All Payment System Tests Passed!', 'green');
    log('=====================================', 'green');
    
    // Display next steps
    log('\n📋 Next Steps:', 'blue');
    log('1. Install Stripe CLI: run scripts/setup-stripe-test.sh', 'yellow');
    log('2. Configure environment variables with Stripe test keys', 'yellow');
    log('3. Start webhook forwarding: stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe', 'yellow');
    log('4. Test business onboarding with real Stripe test data', 'yellow');
    
    log('\n🔧 Test Swedish Business Data:', 'blue');
    log('Business Name: Test Café Aurora', 'cyan');
    log('Email: test@cafeaurora.se', 'cyan');
    log('Org Number: 556123-4567', 'cyan');
    log('Address: Drottninggatan 123, Stockholm, 11151, SE', 'cyan');

  } catch (error) {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    if (error.response) {
      log(`HTTP Status: ${error.response.status}`, 'red');
      log(`Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
    }
    process.exit(1);
  }
}

// Test data generators for Swedish businesses
function generateTestSwedishBusiness() {
  return {
    businessId: '12345678-1234-1234-1234-123456789012',
    orgNumber: '556123-4567',
    businessName: 'Test Café Aurora',
    email: 'test@cafeaurora.se',
    phone: '+46701234567',
    address: {
      line1: 'Drottninggatan 123',
      city: 'Stockholm',
      postal_code: '11151',
      country: 'SE'
    },
    representative: {
      first_name: 'Erik',
      last_name: 'Andersson',
      email: 'erik@cafeaurora.se',
      phone: '+46701234567',
      dob: {
        day: 15,
        month: 6,
        year: 1980
      }
    }
  };
}

function generateTestPayout() {
  return {
    sessionId: 'test-session-123',
    customerId: 'test-customer-456',
    amount: 1500, // 15 SEK in öre
    businessId: TEST_BUSINESS_ID,
    metadata: {
      qualityScore: 85,
      rewardTier: 'very_good'
    }
  };
}

// Manual test helpers
function displayManualTestInstructions() {
  log('\n🧪 Manual Test Instructions:', 'blue');
  log('=============================', 'blue');
  
  log('\n1. Start the API server:', 'cyan');
  log('   npm run dev:api', 'yellow');
  
  log('\n2. Test business onboarding:', 'cyan');
  log(`   curl -X POST ${API_BASE_URL}/api/payments/connect/onboard \\`, 'yellow');
  log('     -H "Content-Type: application/json" \\', 'yellow');
  log(`     -d '${JSON.stringify({
    businessId: TEST_BUSINESS_ID,
    refreshUrl: 'http://localhost:3000/onboarding/refresh',
    returnUrl: 'http://localhost:3000/onboarding/return'
  }, null, 2)}'`, 'yellow');
  
  log('\n3. Check account status:', 'cyan');
  log(`   curl ${API_BASE_URL}/api/payments/connect/status/${TEST_BUSINESS_ID}`, 'yellow');
  
  log('\n4. Test payout (after setting up business):', 'cyan');
  log(`   curl -X POST ${API_BASE_URL}/api/payments/payout \\`, 'yellow');
  log('     -H "Content-Type: application/json" \\', 'yellow');
  log(`     -d '${JSON.stringify(generateTestPayout(), null, 2)}'`, 'yellow');
}

// Run tests
if (require.main === module) {
  testPaymentSystem().then(() => {
    displayManualTestInstructions();
  });
}

module.exports = {
  testPaymentSystem,
  generateTestSwedishBusiness,
  generateTestPayout
};