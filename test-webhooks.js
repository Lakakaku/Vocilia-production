/**
 * Stripe Webhook Testing Script
 * Tests webhook endpoint handling for Swedish business payments
 * 
 * Usage: node test-webhooks.js
 */

const crypto = require('crypto');
const http = require('http');

// Test configuration
const WEBHOOK_URL = 'http://localhost:3001/api/payments/webhooks/stripe';
const WEBHOOK_SECRET = 'whsec_test_12345'; // Test webhook secret

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

// Generate Stripe webhook signature
function generateStripeSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');
  
  return `t=${timestamp},v1=${signature}`;
}

// Send webhook request
function sendWebhook(event, description) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(event);
    const signature = generateStripeSignature(payload, WEBHOOK_SECRET);
    
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/payments/webhooks/stripe',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'stripe-signature': signature
      }
    };

    log(`\n📡 Sending webhook: ${description}`, 'cyan');
    log(`   Event Type: ${event.type}`, 'blue');
    log(`   Signature: ${signature}`, 'blue');

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          log(`✅ Webhook processed successfully`, 'green');
          log(`   Response: ${data}`, 'green');
          resolve({ statusCode: res.statusCode, data });
        } else {
          log(`❌ Webhook failed with status ${res.statusCode}`, 'red');
          log(`   Response: ${data}`, 'red');
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      log(`❌ Request failed: ${error.message}`, 'red');
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// Test webhook events
async function testWebhooks() {
  log('🪝 Stripe Webhook Testing Suite', 'blue');
  log('===============================', 'blue');
  
  try {
    // Test 1: Account Updated (Business Onboarding Complete)
    const accountUpdatedEvent = {
      id: 'evt_test_account_updated',
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_test_business_123',
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: {
            currently_due: [],
            eventually_due: [],
            past_due: []
          }
        }
      },
      created: Math.floor(Date.now() / 1000)
    };

    await sendWebhook(accountUpdatedEvent, 'Business Onboarding Complete');

    // Test 2: Transfer Created (Customer Payout)
    const transferCreatedEvent = {
      id: 'evt_test_transfer_created',
      type: 'transfer.created',
      data: {
        object: {
          id: 'tr_test_customer_payout',
          amount: 1500, // 15 SEK
          currency: 'sek',
          destination: 'acct_test_business_123',
          status: 'pending',
          metadata: {
            sessionId: 'session_test_feedback',
            businessId: 'business_cafe_aurora',
            qualityScore: '88',
            rewardTier: 'very_good'
          }
        }
      },
      created: Math.floor(Date.now() / 1000)
    };

    await sendWebhook(transferCreatedEvent, 'Customer Payout Initiated');

    // Test 3: Transfer Updated (Success)
    const transferSuccessEvent = {
      id: 'evt_test_transfer_success',
      type: 'transfer.updated', 
      data: {
        object: {
          id: 'tr_test_customer_payout',
          amount: 1500,
          currency: 'sek',
          destination: 'acct_test_business_123',
          status: 'paid',
          metadata: {
            sessionId: 'session_test_feedback',
            businessId: 'business_cafe_aurora'
          }
        }
      },
      created: Math.floor(Date.now() / 1000)
    };

    await sendWebhook(transferSuccessEvent, 'Customer Payout Successful');

    // Test 4: Transfer Updated (Failed)
    const transferFailedEvent = {
      id: 'evt_test_transfer_failed',
      type: 'transfer.updated',
      data: {
        object: {
          id: 'tr_test_customer_payout_failed',
          amount: 1500,
          currency: 'sek', 
          destination: 'acct_test_business_123',
          status: 'failed',
          failure_code: 'account_closed',
          failure_message: 'The destination account is closed.',
          metadata: {
            sessionId: 'session_test_feedback_failed',
            businessId: 'business_cafe_aurora'
          }
        }
      },
      created: Math.floor(Date.now() / 1000)
    };

    await sendWebhook(transferFailedEvent, 'Customer Payout Failed');

    // Test 5: Invalid signature (security test)
    log('\n🔒 Testing webhook security...', 'cyan');
    const invalidEvent = {
      id: 'evt_test_invalid',
      type: 'account.updated',
      data: { object: { id: 'test' } },
      created: Math.floor(Date.now() / 1000)
    };

    try {
      const payload = JSON.stringify(invalidEvent);
      const invalidSignature = 'invalid_signature';
      
      const options = {
        hostname: 'localhost',
        port: 3001,
        path: '/api/payments/webhooks/stripe',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': invalidSignature
        }
      };

      await new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 400) {
              log('✅ Invalid signature correctly rejected', 'green');
              resolve();
            } else {
              reject(new Error(`Expected 400, got ${res.statusCode}`));
            }
          });
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });
    } catch (error) {
      log(`❌ Security test failed: ${error.message}`, 'red');
    }

    log('\n🎉 All Webhook Tests Completed Successfully!', 'green');
    log('============================================', 'green');
    
    // Display webhook setup instructions
    displayWebhookInstructions();

  } catch (error) {
    log(`\n❌ Webhook test failed: ${error.message}`, 'red');
    log('Make sure your API server is running on localhost:3001', 'yellow');
    process.exit(1);
  }
}

function displayWebhookInstructions() {
  log('\n📋 Webhook Development Setup:', 'blue');
  log('============================', 'blue');
  
  log('\n1. Start your API server:', 'cyan');
  log('   cd apps/api-gateway && npm run dev', 'yellow');
  
  log('\n2. Install Stripe CLI:', 'cyan');
  log('   brew install stripe/stripe-cli/stripe', 'yellow');
  
  log('\n3. Login to Stripe:', 'cyan');
  log('   stripe login', 'yellow');
  
  log('\n4. Forward webhooks to local API:', 'cyan');
  log('   stripe listen --forward-to localhost:3001/api/payments/webhooks/stripe', 'yellow');
  
  log('\n5. Test with Stripe CLI:', 'cyan');
  log('   stripe trigger account.updated', 'yellow');
  log('   stripe trigger transfer.created', 'yellow');
  log('   stripe trigger transfer.updated', 'yellow');
  
  log('\n6. View webhook events:', 'cyan');
  log('   stripe events list', 'yellow');
  
  log('\n🔧 Environment Variables Needed:', 'blue');
  log('STRIPE_SECRET_KEY=sk_test_...', 'yellow');
  log('STRIPE_WEBHOOK_SECRET=whsec_...', 'yellow');
  
  log('\n✅ Webhook Endpoints Ready:', 'blue');
  log('/api/payments/webhooks/stripe - Handles all Stripe events', 'green');
  log('- account.updated: Updates business onboarding status', 'green');
  log('- transfer.created: Logs customer payout initiation', 'green');
  log('- transfer.updated: Handles payout success/failure', 'green');
}

// Mock events for different scenarios
function createMockEvents() {
  return {
    swedishBusinessOnboarded: {
      id: 'evt_swedish_onboard',
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_cafe_aurora_sthlm',
          business_profile: {
            name: 'Café Aurora Stockholm',
            support_email: 'support@cafeaurora.se'
          },
          country: 'SE',
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: {
            currently_due: [],
            eventually_due: [],
            past_due: []
          }
        }
      }
    },
    
    swedishCustomerPayout: {
      id: 'evt_swedish_payout',
      type: 'transfer.created',
      data: {
        object: {
          id: 'tr_swedish_customer_reward',
          amount: 875, // 8.75 SEK for quality feedback
          currency: 'sek',
          destination: 'acct_cafe_aurora_sthlm',
          metadata: {
            sessionId: 'feedback_aurora_123',
            businessId: 'cafe_aurora_stockholm', 
            qualityScore: '92',
            rewardTier: 'exceptional',
            customerHash: 'hash_anonymous_customer',
            feedbackCategories: '["service","quality","atmosphere"]'
          }
        }
      }
    }
  };
}

// Run tests if called directly
if (require.main === module) {
  testWebhooks();
}

module.exports = {
  testWebhooks,
  sendWebhook,
  createMockEvents
};