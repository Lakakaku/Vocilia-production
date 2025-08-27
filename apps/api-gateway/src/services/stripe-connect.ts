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
/**
 * Utility class for handling timeouts and retries in payment processing
 */
class PaymentTimeoutHandler {
  /**
   * Creates a promise that will timeout after specified milliseconds
   */
  static createTimeout<T>(ms: number, operation: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operation} timeout after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Executes an operation with timeout and retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 2,
    timeoutMs: number = 5000,
    operationName: string = 'Operation'
  ): Promise<T> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        const timeoutPromise = this.createTimeout(timeoutMs, operationName);
        const operationPromise = operation();
        
        const result = await Promise.race([operationPromise, timeoutPromise]);
        
        if (attempt > 1) {
          console.log(`✅ ${operationName} succeeded on attempt ${attempt}`);
        }
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (attempt <= maxRetries) {
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
          console.log(`⚠️ ${operationName} failed on attempt ${attempt}, retrying in ${backoffDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        } else {
          console.error(`❌ ${operationName} failed after ${attempt} attempts:`, lastError);
        }
      }
    }
    
    throw lastError;
  }
}

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
    
    try {
      // Simulate API delay with timeout protection
      const createAccountPromise = new Promise<MockStripeAccount>((resolve) => {
        setTimeout(() => {
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
          resolve(mockAccount);
        }, 200); // Reduced delay from 500ms to 200ms for better performance
      });

      // Add timeout protection (5 second timeout)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Stripe account creation timeout after 5 seconds')), 5000);
      });

      const mockAccount = await Promise.race([createAccountPromise, timeoutPromise]);

      console.log(`✅ [MOCK] Express account created: ${mockAccount.id} for ${businessData.businessName}`);
      return mockAccount;
    } catch (error) {
      console.error(`❌ [MOCK] Express account creation failed:`, error);
      throw new Error(`Failed to create Express account: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Creates a mock account link for business onboarding
   */
  async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<MockAccountLink> {
    console.log(`🔗 [MOCK] Creating account link for ${accountId}`);
    
    try {
      // Create account link promise with timeout protection
      const createLinkPromise = new Promise<MockAccountLink>((resolve) => {
        setTimeout(() => {
          const mockLink: MockAccountLink = {
            url: `https://connect.stripe.com/express/mock_onboarding?account=${accountId}&refresh=${encodeURIComponent(refreshUrl)}&return=${encodeURIComponent(returnUrl)}`,
            expires_at: Math.floor(Date.now() / 1000) + (5 * 60) // 5 minutes from now
          };
          resolve(mockLink);
        }, 100); // Reduced delay from 200ms to 100ms for faster processing
      });

      // Add timeout protection (2 second timeout)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Account link creation timeout after 2 seconds')), 2000);
      });

      const mockLink = await Promise.race([createLinkPromise, timeoutPromise]);

      console.log(`✅ [MOCK] Account link created for ${accountId}`);
      return mockLink;
    } catch (error) {
      console.error(`❌ [MOCK] Account link creation failed:`, error);
      throw new Error(`Failed to create account link: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Mock customer payout processing
   */
  async processCustomerPayout(accountId: string, payout: CustomerPayout): Promise<MockTransfer> {
    console.log(`💰 [MOCK] Processing payout: ${payout.amount} öre to customer ${payout.customerId}`);
    
    try {
      // Create payout processing promise with reduced delay
      const processPayoutPromise = new Promise<MockTransfer>((resolve) => {
        setTimeout(() => {
          const mockTransfer: MockTransfer = {
            id: `tr_mock_${Date.now()}`,
            amount: payout.amount,
            currency: payout.currency,
            status: 'pending' // In test mode, transfers are typically pending
          };
          resolve(mockTransfer);
        }, 300); // Reduced delay from 1000ms to 300ms for faster processing
      });

      // Add timeout protection (3 second timeout for payment processing)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Payment processing timeout after 3 seconds')), 3000);
      });

      const mockTransfer = await Promise.race([processPayoutPromise, timeoutPromise]);

      console.log(`✅ [MOCK] Transfer created: ${mockTransfer.id} for ${payout.amount} öre`);
      return mockTransfer;
    } catch (error) {
      console.error(`❌ [MOCK] Payment processing failed:`, error);
      
      // Return failed transfer instead of throwing for better error handling
      const failedTransfer: MockTransfer = {
        id: `tr_failed_${Date.now()}`,
        amount: payout.amount,
        currency: payout.currency,
        status: 'failed'
      };
      
      // Still throw the error but provide the failed transfer for reference
      throw Object.assign(error, { failedTransfer });
    }
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
    
    try {
      // Create account status promise with timeout protection
      const getStatusPromise = new Promise<{
        id: string;
        charges_enabled: boolean;
        payouts_enabled: boolean;
        details_submitted: boolean;
        requirements: MockStripeAccount['requirements'];
      }>((resolve) => {
        setTimeout(() => {
          // Mock different states based on account ID for testing
          const isCompleted = accountId.includes('completed');
          const isPending = accountId.includes('pending');
          
          resolve({
            id: accountId,
            charges_enabled: isCompleted,
            payouts_enabled: isCompleted,
            details_submitted: isCompleted || isPending,
            requirements: {
              currently_due: isCompleted ? [] : ['business_profile.url'],
              eventually_due: isCompleted ? [] : ['individual.verification.document'],
              past_due: []
            }
          });
        }, 150); // Reduced delay from 300ms to 150ms for faster processing
      });

      // Add timeout protection (2 second timeout)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Account status check timeout after 2 seconds')), 2000);
      });

      const accountStatus = await Promise.race([getStatusPromise, timeoutPromise]);

      console.log(`✅ [MOCK] Account status retrieved for ${accountId}`);
      return accountStatus;
    } catch (error) {
      console.error(`❌ [MOCK] Account status check failed:`, error);
      throw new Error(`Failed to get account status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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