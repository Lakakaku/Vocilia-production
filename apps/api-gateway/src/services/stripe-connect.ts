/**
 * Temporary Stripe Connect service implementation
 * This will be moved to the payment-handler service once dependencies are resolved
 */

// Interface definitions (temporary until proper import works)
export interface SwedishBusinessAccount {
  businessId: string;
  orgNumber: string;
  businessName: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    city: string;
    postal_code: string;
    country: 'SE';
  };
  representative: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    dob: {
      day: number;
      month: number;
      year: number;
    };
  };
}

export interface CustomerPayout {
  customerId: string;
  amount: number;
  currency: 'sek';
  metadata: {
    sessionId: string;
    businessId: string;
    qualityScore: number;
    rewardTier: string;
  };
}

// Mock Stripe types for development
export interface MockStripeAccount {
  id: string;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  requirements: {
    currently_due: string[];
    eventually_due: string[];
    past_due: string[];
  };
}

export interface MockAccountLink {
  url: string;
  expires_at: number;
}

export interface MockTransfer {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/**
 * Mock Stripe service for development when Stripe SDK is not available
 * This mimics the real Stripe API for testing purposes
 */
export class MockStripeService {
  private testMode: boolean;

  constructor() {
    this.testMode = process.env.NODE_ENV !== 'production';
    console.log(`🔧 Mock Stripe Service initialized in ${this.testMode ? 'TEST' : 'LIVE'} mode`);
  }

  /**
   * Creates a mock Express account for Swedish business
   */
  async createExpressAccount(businessData: SwedishBusinessAccount): Promise<MockStripeAccount> {
    console.log(`📝 [MOCK] Creating Express account for: ${businessData.businessName}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockAccount: MockStripeAccount = {
      id: `acct_mock_${Date.now()}`,
      charges_enabled: false, // Requires onboarding completion
      payouts_enabled: false, // Requires onboarding completion
      details_submitted: false,
      requirements: {
        currently_due: ['business_profile.url', 'external_account'],
        eventually_due: ['individual.verification.document'],
        past_due: []
      }
    };

    console.log(`✅ [MOCK] Express account created: ${mockAccount.id} for ${businessData.businessName}`);
    return mockAccount;
  }

  /**
   * Creates a mock account link for business onboarding
   */
  async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<MockAccountLink> {
    console.log(`🔗 [MOCK] Creating account link for ${accountId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const mockLink: MockAccountLink = {
      url: `https://connect.stripe.com/express/mock_onboarding?account=${accountId}&refresh=${encodeURIComponent(refreshUrl)}&return=${encodeURIComponent(returnUrl)}`,
      expires_at: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes from now
    };

    console.log(`✅ [MOCK] Account link created for ${accountId}`);
    return mockLink;
  }

  /**
   * Mock customer payout processing
   */
  async processCustomerPayout(accountId: string, payout: CustomerPayout): Promise<MockTransfer> {
    console.log(`💰 [MOCK] Processing payout: ${payout.amount} öre to customer ${payout.customerId}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockTransfer: MockTransfer = {
      id: `tr_mock_${Date.now()}`,
      amount: payout.amount,
      currency: payout.currency,
      status: 'pending' // In test mode, transfers are typically pending
    };

    console.log(`✅ [MOCK] Transfer created: ${mockTransfer.id} for ${payout.amount} öre`);
    return mockTransfer;
  }

  /**
   * Gets mock account status
   */
  async getAccountStatus(accountId: string): Promise<{
    id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    requirements: MockStripeAccount['requirements'];
  }> {
    console.log(`🔍 [MOCK] Getting account status for ${accountId}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Mock different states based on account ID for testing
    const isCompleted = accountId.includes('completed');
    const isPending = accountId.includes('pending');
    
    return {
      id: accountId,
      charges_enabled: isCompleted,
      payouts_enabled: isCompleted,
      details_submitted: isCompleted || isPending,
      requirements: {
        currently_due: isCompleted ? [] : ['business_profile.url'],
        eventually_due: isCompleted ? [] : ['individual.verification.document'],
        past_due: []
      }
    };
  }

  /**
   * Mock webhook signature verification
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): any {
    console.log(`🪝 [MOCK] Verifying webhook signature`);
    
    // In test mode, just return a mock event
    return {
      id: `evt_mock_${Date.now()}`,
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_mock_123',
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true
        }
      },
      created: Math.floor(Date.now() / 1000)
    };
  }

  /**
   * Creates test Swedish business data
   */
  static createTestSwedishBusiness(businessId: string): SwedishBusinessAccount {
    return {
      businessId,
      orgNumber: '556123-4567', // TEST: Fake Swedish org number format
      businessName: 'Test Café Aurora',
      email: 'test@cafeaurora.se',
      phone: '+46701234567',
      address: {
        line1: 'Drottninggatan 123',
        city: 'Stockholm',
        postal_code: '11151',
        country: 'SE',
      },
      representative: {
        first_name: 'Erik',
        last_name: 'Andersson',
        email: 'erik@cafeaurora.se',
        phone: '+46701234567',
        dob: {
          day: 15,
          month: 6,
          year: 1980,
        },
      },
    };
  }
}

// Export the mock service for development
export const stripeService = new MockStripeService();