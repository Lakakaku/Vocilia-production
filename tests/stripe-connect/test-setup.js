/**
 * Stripe Connect Test Setup
 * Configures test environment for Swedish market payment testing
 */

const Stripe = require('stripe');

// Test environment configuration - ONLY USE TEST KEYS
const TEST_CONFIG = {
  stripe: {
    publishableKey: process.env.STRIPE_TEST_PUBLISHABLE_KEY || 'pk_test_51234567890abcdef', // Fake test key
    secretKey: process.env.STRIPE_TEST_SECRET_KEY || 'sk_test_51234567890abcdef', // Fake test key
    webhookSecret: process.env.STRIPE_TEST_WEBHOOK_SECRET || 'whsec_test_1234567890abcdef',
    country: 'SE', // Sweden
    currency: 'sek'
  },
  api: {
    baseUrl: process.env.API_GATEWAY_URL || 'http://localhost:3001',
    timeout: 30000
  },
  webhook: {
    url: process.env.WEBHOOK_URL || 'https://test-webhook.example.com/stripe/webhooks',
    port: 3333
  }
};

// Swedish test business data
const SWEDISH_TEST_BUSINESSES = {
  cafe: {
    type: 'individual',
    country: 'SE',
    business_type: 'individual',
    individual: {
      first_name: 'Anna',
      last_name: 'Andersson',
      email: 'anna.andersson+test@example.com',
      phone: '+46701234567',
      dob: {
        day: 15,
        month: 6,
        year: 1985
      },
      address: {
        line1: 'Testgatan 123',
        city: 'Stockholm',
        postal_code: '11122',
        country: 'SE'
      }
    },
    business_profile: {
      mcc: '5812', // Eating and Drinking Places
      name: 'Café Aurora Stockholm',
      product_description: 'Specialty coffee and pastries in central Stockholm',
      support_email: 'support+test@cafe-aurora.se',
      support_phone: '+46812345678',
      support_url: 'https://cafe-aurora-test.se/support',
      url: 'https://cafe-aurora-test.se'
    }
  },
  restaurant: {
    type: 'company',
    country: 'SE',
    business_type: 'company',
    company: {
      name: 'NordMat AB',
      registration_number: '556987654321', // Swedish org number format
      phone: '+46812345679',
      address: {
        line1: 'Kungsgatan 45',
        city: 'Göteborg',
        postal_code: '41119',
        country: 'SE'
      }
    },
    business_profile: {
      mcc: '5814', // Fast Food Restaurants  
      name: 'NordMat Restaurang',
      product_description: 'Modern Nordic cuisine restaurant in Gothenburg',
      support_email: 'support+test@nordmat.se',
      support_phone: '+46312345678',
      support_url: 'https://nordmat-test.se/support',
      url: 'https://nordmat-test.se'
    }
  },
  retail: {
    type: 'company', 
    country: 'SE',
    business_type: 'company',
    company: {
      name: 'Malmö Handel HB',
      registration_number: '969876543210', // Swedish partnership format
      phone: '+46401234567',
      address: {
        line1: 'Västra Hamngatan 12',
        city: 'Malmö',
        postal_code: '21118',
        country: 'SE'
      }
    },
    business_profile: {
      mcc: '5411', // Grocery Stores and Supermarkets
      name: 'Malmö Handel',
      product_description: 'Local grocery store serving Malmö community',
      support_email: 'support+test@malmohandel.se',
      support_phone: '+46401234568',
      support_url: 'https://malmohandel-test.se/support',
      url: 'https://malmohandel-test.se'
    }
  }
};

// Stripe test card numbers for Swedish market testing
const STRIPE_TEST_CARDS = {
  success: {
    // Visa - Success scenarios
    visa_success: '4000000000000002',
    visa_3ds: '4000000000003220', // Requires 3DS authentication
    
    // Mastercard - Success scenarios  
    mastercard_success: '5555555555554444',
    mastercard_3ds: '5200000000000080', // Requires 3DS
    
    // Swedish specific cards
    sweden_visa: '4000007520000007', // Sweden-issued Visa
    sweden_mastercard: '5200007520000007' // Sweden-issued Mastercard
  },
  declined: {
    // Generic declines
    generic_decline: '4000000000000002',
    insufficient_funds: '4000000000009995',
    stolen_card: '4000000000009987',
    expired_card: '4000000000000069',
    incorrect_cvc: '4000000000000127',
    processing_error: '4000000000000119',
    
    // Swedish specific declines
    sweden_decline: '4000007520000015'
  },
  errors: {
    // Special error scenarios
    charge_exceeds_limit: '4000000000000044',
    expire_soon: '4000000000000010',
    always_authenticate: '4000002760003184'
  }
};

// Swedish market specific constraints
const SWEDISH_MARKET_CONFIG = {
  currency: 'SEK',
  minAmount: 100, // 1 SEK minimum (Stripe uses smallest currency unit)
  maxAmount: 5000000, // 50,000 SEK maximum per transfer
  commissionRate: 0.20, // 20% platform commission
  rewardTiers: {
    exceptional: { minScore: 90, maxScore: 100, rewardPercentage: [0.08, 0.12] },
    veryGood: { minScore: 75, maxScore: 89, rewardPercentage: [0.04, 0.07] },
    acceptable: { minScore: 60, maxScore: 74, rewardPercentage: [0.01, 0.03] },
    insufficient: { minScore: 0, maxScore: 59, rewardPercentage: [0, 0] }
  },
  fraudProtection: {
    maxDailyRewards: 50000, // 500 SEK per customer per day
    maxMonthlyRewards: 1000000, // 10,000 SEK per customer per month
    velocityLimits: {
      maxTransfersPerHour: 10,
      maxTransfersPerDay: 50
    }
  }
};

// Global test setup
beforeAll(() => {
  // Validate test environment
  if (!TEST_CONFIG.stripe.secretKey.startsWith('sk_test_')) {
    throw new Error('CRITICAL: Must use Stripe TEST keys only! Found: ' + TEST_CONFIG.stripe.secretKey.substring(0, 10));
  }
  
  console.log('🧪 Stripe Connect Test Environment Initialized');
  console.log(`🇸🇪 Testing Swedish market (${TEST_CONFIG.stripe.currency.toUpperCase()})`);
  console.log(`🔑 Using Stripe test keys: ${TEST_CONFIG.stripe.secretKey.substring(0, 10)}...`);
});

// Global test utilities
global.StripeTestUtils = {
  stripe: new Stripe(TEST_CONFIG.stripe.secretKey, {
    apiVersion: '2023-10-16'
  }),
  
  config: TEST_CONFIG,
  swedishBusinesses: SWEDISH_TEST_BUSINESSES,
  testCards: STRIPE_TEST_CARDS,
  marketConfig: SWEDISH_MARKET_CONFIG,
  
  // Utility functions
  generateSwedishOrgNumber() {
    // Generate fake Swedish organization number for testing
    const base = Math.floor(Math.random() * 900000000 + 100000000);
    return `556${base}`.substring(0, 10);
  },
  
  generateTestEmail(prefix = 'test') {
    return `${prefix}+${Date.now()}@feedback-platform-test.se`;
  },
  
  convertSEKToOre(sek) {
    // Convert SEK to öre (smallest unit) for Stripe
    return Math.round(sek * 100);
  },
  
  convertOreToSEK(ore) {
    // Convert öre to SEK for display
    return Math.round(ore) / 100;
  },
  
  formatSEK(amount) {
    return `${this.convertOreToSEK(amount).toFixed(2)} kr`;
  },
  
  async createTestAccount(businessType = 'cafe') {
    const businessData = SWEDISH_TEST_BUSINESSES[businessType];
    if (!businessData) {
      throw new Error(`Unknown business type: ${businessType}`);
    }
    
    // Add unique identifiers to avoid conflicts
    const uniqueSuffix = Date.now();
    if (businessData.individual) {
      businessData.individual.email = `test+${uniqueSuffix}@example.com`;
    }
    if (businessData.company) {
      businessData.company.registration_number = this.generateSwedishOrgNumber();
    }
    
    return await this.stripe.accounts.create(businessData);
  },
  
  async createTestCharge(amount, source, destination) {
    return await this.stripe.charges.create({
      amount: this.convertSEKToOre(amount),
      currency: 'sek',
      source: source,
      destination: {
        account: destination
      }
    });
  },
  
  async createTestTransfer(amount, destination, description = 'Test feedback reward') {
    return await this.stripe.transfers.create({
      amount: this.convertSEKToOre(amount),
      currency: 'sek',
      destination: destination,
      description: description
    });
  },
  
  calculateReward(qualityScore, purchaseAmount) {
    // Calculate reward based on quality score and tiers
    const { rewardTiers } = SWEDISH_MARKET_CONFIG;
    
    let tier;
    if (qualityScore >= 90) tier = rewardTiers.exceptional;
    else if (qualityScore >= 75) tier = rewardTiers.veryGood;
    else if (qualityScore >= 60) tier = rewardTiers.acceptable;
    else tier = rewardTiers.insufficient;
    
    if (tier.rewardPercentage[0] === 0) return 0;
    
    // Use middle of reward range for testing
    const rewardPercentage = (tier.rewardPercentage[0] + tier.rewardPercentage[1]) / 2;
    const rewardAmount = purchaseAmount * rewardPercentage;
    
    return Math.round(rewardAmount * 100) / 100; // Round to 2 decimal places
  },
  
  calculateCommission(rewardAmount) {
    return Math.round(rewardAmount * SWEDISH_MARKET_CONFIG.commissionRate * 100) / 100;
  }
};

// Mock webhook server for testing
global.createMockWebhookServer = () => {
  const express = require('express');
  const app = express();
  
  app.use(express.raw({ type: 'application/json' }));
  
  const webhookEvents = [];
  
  app.post('/stripe/webhooks', (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    
    try {
      event = global.StripeTestUtils.stripe.webhooks.constructEvent(
        req.body,
        sig,
        TEST_CONFIG.stripe.webhookSecret
      );
      
      webhookEvents.push(event);
      console.log(`📨 Webhook received: ${event.type}`);
      
      res.status(200).send('Webhook handled');
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });
  
  app.get('/webhooks/events', (req, res) => {
    res.json(webhookEvents);
  });
  
  return { app, events: webhookEvents };
};

// Error matchers
expect.extend({
  toBeValidStripeError(received) {
    const pass = received && 
                 received.type && 
                 received.code && 
                 typeof received.message === 'string';
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid Stripe error`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid Stripe error with type, code, and message`,
        pass: false,
      };
    }
  },
  
  toBeValidSEKAmount(received) {
    const pass = typeof received === 'number' && 
                 received >= 0 && 
                 Number.isFinite(received) &&
                 (received * 100) % 1 === 0; // Check it's in valid öre
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid SEK amount`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid SEK amount (number with max 2 decimal places)`,
        pass: false,
      };
    }
  }
});

console.log('✅ Stripe Connect test environment ready');
console.log(`🔒 Security check: Using test keys - ${TEST_CONFIG.stripe.secretKey.includes('test') ? 'PASS' : 'FAIL'}`);

module.exports = {
  TEST_CONFIG,
  SWEDISH_TEST_BUSINESSES,
  STRIPE_TEST_CARDS,
  SWEDISH_MARKET_CONFIG
};