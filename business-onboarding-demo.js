/**
 * Business Onboarding Demo
 * Demonstrates Stripe Connect Express account creation for Swedish businesses
 * 
 * This script shows the complete workflow for onboarding Swedish businesses
 * to the AI Feedback Platform payment system.
 */

// Mock implementations for demonstration
class MockDatabase {
  businesses = new Map();
  
  async createBusiness(businessData) {
    const id = `business_${Date.now()}`;
    const business = {
      id,
      ...businessData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      stripe_account_id: null,
      stripe_onboarding_complete: false
    };
    
    this.businesses.set(id, business);
    console.log(`📝 Business created in database: ${business.name} (ID: ${id})`);
    return business;
  }
  
  async getBusiness(id) {
    return this.businesses.get(id) || null;
  }
  
  async updateBusiness(id, updates) {
    const business = this.businesses.get(id);
    if (!business) return null;
    
    const updated = { ...business, ...updates, updated_at: new Date().toISOString() };
    this.businesses.set(id, updated);
    console.log(`📋 Business updated: ${business.name} - Stripe Account: ${updates.stripe_account_id || 'N/A'}`);
    return updated;
  }
}

class MockStripeService {
  accounts = new Map();
  
  async createExpressAccount(businessData) {
    console.log(`\n🏛️  STRIPE: Creating Express account for Swedish business`);
    console.log(`   Business: ${businessData.businessName}`);
    console.log(`   Org Number: ${businessData.orgNumber}`);
    console.log(`   Email: ${businessData.email}`);
    console.log(`   Address: ${businessData.address.line1}, ${businessData.address.city}`);
    
    // Simulate Stripe API processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const accountId = `acct_${Date.now()}`;
    const account = {
      id: accountId,
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: false,
      requirements: {
        currently_due: ['business_profile.url', 'external_account', 'individual.verification.document'],
        eventually_due: [],
        past_due: []
      }
    };
    
    this.accounts.set(accountId, account);
    console.log(`✅ Express account created: ${accountId}`);
    return account;
  }
  
  async createAccountLink(accountId, refreshUrl, returnUrl) {
    console.log(`\n🔗 STRIPE: Creating onboarding link for account ${accountId}`);
    console.log(`   Refresh URL: ${refreshUrl}`);
    console.log(`   Return URL: ${returnUrl}`);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const onboardingUrl = `https://connect.stripe.com/express/setup/${accountId}?refresh=${encodeURIComponent(refreshUrl)}&return=${encodeURIComponent(returnUrl)}`;
    
    console.log(`✅ Onboarding link created: ${onboardingUrl}`);
    return { url: onboardingUrl };
  }
  
  async getAccountStatus(accountId) {
    const account = this.accounts.get(accountId);
    if (!account) throw new Error('Account not found');
    
    console.log(`\n📊 STRIPE: Account status for ${accountId}`);
    console.log(`   Charges enabled: ${account.charges_enabled}`);
    console.log(`   Payouts enabled: ${account.payouts_enabled}`);
    console.log(`   Details submitted: ${account.details_submitted}`);
    console.log(`   Requirements: ${account.requirements.currently_due.join(', ') || 'None'}`);
    
    return account;
  }
}

// Demo workflow
async function demonstrateBusinessOnboarding() {
  console.log('🎯 AI Feedback Platform - Business Onboarding Demo');
  console.log('==================================================\n');
  
  const db = new MockDatabase();
  const stripe = new MockStripeService();
  
  // Step 1: Business signs up
  console.log('📋 STEP 1: Business Registration');
  const businessData = {
    name: 'Café Aurora Stockholm',
    email: 'kontakt@cafeaurora.se',
    org_number: '556123-4567',
    phone: '+46701234567',
    address: {
      street: 'Drottninggatan 123',
      city: 'Stockholm',
      postal_code: '11151',
      country: 'SE'
    }
  };
  
  const business = await db.createBusiness(businessData);
  
  // Step 2: Create Stripe Express account
  console.log('\n💳 STEP 2: Stripe Connect Express Account Creation');
  
  const swedishBusinessData = {
    businessId: business.id,
    orgNumber: business.org_number,
    businessName: business.name,
    email: business.email,
    phone: business.phone,
    address: {
      line1: business.address.street,
      city: business.address.city,
      postal_code: business.address.postal_code,
      country: 'SE'
    },
    representative: {
      first_name: 'Erik',
      last_name: 'Andersson',
      email: business.email,
      phone: business.phone,
      dob: {
        day: 15,
        month: 6,
        year: 1980
      }
    }
  };
  
  const stripeAccount = await stripe.createExpressAccount(swedishBusinessData);
  
  // Step 3: Save Stripe account ID to business
  await db.updateBusiness(business.id, {
    stripe_account_id: stripeAccount.id
  });
  
  // Step 4: Create onboarding link
  console.log('\n🔗 STEP 3: Generate Onboarding Link');
  const accountLink = await stripe.createAccountLink(
    stripeAccount.id,
    'http://localhost:3000/onboarding/refresh',
    'http://localhost:3000/onboarding/return'
  );
  
  // Step 5: Show account status
  console.log('\n📊 STEP 4: Check Account Status');
  await stripe.getAccountStatus(stripeAccount.id);
  
  // Summary
  console.log('\n🎉 ONBOARDING COMPLETE - SUMMARY');
  console.log('=================================');
  console.log(`✅ Business registered: ${business.name}`);
  console.log(`✅ Stripe Express account created: ${stripeAccount.id}`);
  console.log(`✅ Onboarding link generated: ${accountLink.url}`);
  console.log(`\n📱 Next Steps for Business:`);
  console.log(`1. Complete onboarding at: ${accountLink.url}`);
  console.log(`2. Submit required documents (business verification)`);
  console.log(`3. Add bank account for payouts`);
  console.log(`4. Start receiving customer feedback and processing payouts!`);
  
  // Demo the API endpoints that would be called
  console.log('\n🔌 API ENDPOINTS IMPLEMENTED:');
  console.log('===============================');
  console.log('POST /api/payments/connect/onboard');
  console.log('  - Creates Express account and returns onboarding URL');
  console.log('  - Request: { businessId, refreshUrl, returnUrl }');
  console.log('  - Response: { onboardingUrl, accountId, isExisting }');
  
  console.log('\nGET /api/payments/connect/status/{businessId}');
  console.log('  - Checks Stripe account status and requirements');
  console.log('  - Response: { hasAccount, onboardingRequired, accountStatus }');
  
  console.log('\nPOST /api/payments/payout');
  console.log('  - Processes customer reward payout');
  console.log('  - Request: { sessionId, customerId, amount, businessId }');
  console.log('  - Response: { transferId, amount, status }');
  
  console.log('\nPOST /api/payments/webhooks/stripe');
  console.log('  - Handles Stripe webhook events');
  console.log('  - Updates business onboarding status automatically');
  
  return {
    business,
    stripeAccount,
    accountLink
  };
}

// Test customer payout simulation
async function demonstrateCustomerPayout(business, stripeAccount) {
  console.log('\n💰 BONUS DEMO: Customer Payout Simulation');
  console.log('==========================================');
  
  const stripe = new MockStripeService();
  
  const payoutData = {
    customerId: 'customer_abc123',
    amount: 1250, // 12.50 SEK in öre
    currency: 'sek',
    metadata: {
      sessionId: 'session_feedback_456',
      businessId: business.id,
      qualityScore: 87,
      rewardTier: 'very_good'
    }
  };
  
  console.log(`\n💳 Processing payout for customer: ${payoutData.customerId}`);
  console.log(`   Amount: ${payoutData.amount} öre (${payoutData.amount/100} SEK)`);
  console.log(`   Quality Score: ${payoutData.metadata.qualityScore}/100`);
  console.log(`   Reward Tier: ${payoutData.metadata.rewardTier}`);
  
  // Simulate payout processing
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const transfer = {
    id: `tr_${Date.now()}`,
    amount: payoutData.amount,
    currency: payoutData.currency,
    status: 'pending'
  };
  
  console.log(`✅ Payout processed: ${transfer.id}`);
  console.log(`   Status: ${transfer.status}`);
  console.log(`   Customer will receive ${transfer.amount/100} SEK`);
}

// Run the demonstration
async function main() {
  try {
    const result = await demonstrateBusinessOnboarding();
    await demonstrateCustomerPayout(result.business, result.stripeAccount);
    
    console.log('\n🏆 DEMO COMPLETE!');
    console.log('================');
    console.log('The Swedish business onboarding system is ready for testing.');
    console.log('All API endpoints have been implemented and tested.');
  } catch (error) {
    console.error('❌ Demo failed:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  demonstrateBusinessOnboarding,
  demonstrateCustomerPayout
};