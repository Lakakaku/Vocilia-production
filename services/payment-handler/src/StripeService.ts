/**
 * Stripe Connect Service for Swedish Business Payments
 * 
 * This service handles:
 * - Express account creation for Swedish businesses
 * - Instant payouts to customer bank accounts
 * - Webhook processing
 * - Test environment configuration
 */

import Stripe from 'stripe';
import { Business, RewardTier } from '@ai-feedback/shared-types';

// TEST CONFIGURATION - Uses Stripe test keys for development
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_...', {
  apiVersion: '2024-06-20',
  typescript: true,
});

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
  amount: number; // in öre (Swedish cents)
  currency: 'sek';
  metadata: {
    sessionId: string;
    businessId: string;
    qualityScore: number;
    rewardTier: RewardTier;
  };
}

export class StripeService {
  private stripe: Stripe;
  private testMode: boolean;

  constructor() {
    this.stripe = stripe;
    this.testMode = process.env.NODE_ENV !== 'production';
    
    console.log(`🔧 Stripe Service initialized in ${this.testMode ? 'TEST' : 'LIVE'} mode`);
  }

  /**
   * Creates a Stripe Express account for a Swedish business
   * Uses TEST mode with fake Swedish business data
   */
  async createExpressAccount(businessData: SwedishBusinessAccount): Promise<Stripe.Account> {
    try {
      console.log(`📝 Creating Express account for: ${businessData.businessName}`);
      
      const accountParams: Stripe.AccountCreateParams = {
        type: 'express',
        country: 'SE',
        email: businessData.email,
        
        // Business details
        business_type: 'company',
        company: {
          name: businessData.businessName,
          phone: businessData.phone,
          address: businessData.address,
          tax_id: businessData.orgNumber,
          // TEST: Using test org numbers that Stripe accepts
          structure: 'public_corporation', // Standard for Swedish businesses
        },
        
        // Business representative (required for Swedish businesses)
        individual: {
          first_name: businessData.representative.first_name,
          last_name: businessData.representative.last_name,
          email: businessData.representative.email,
          phone: businessData.representative.phone,
          dob: businessData.representative.dob,
          address: businessData.address, // Same as business address for small companies
        },
        
        // Enable instant payouts for Swedish businesses
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
          // Enable instant payouts to Swedish bank accounts
          instant_payout: { requested: true },
        },
        
        // Swedish banking requirements
        settings: {
          payouts: {
            schedule: {
              interval: 'manual', // Enable instant payouts
            },
          },
        },
        
        // TEST metadata
        metadata: {
          businessId: businessData.businessId,
          environment: 'test',
          market: 'sweden',
        }
      };

      const account = await this.stripe.accounts.create(accountParams);
      
      console.log(`✅ Express account created: ${account.id} for ${businessData.businessName}`);
      
      return account;
    } catch (error) {
      console.error(`❌ Failed to create Express account:`, error);
      throw new Error(`Failed to create Stripe account: ${error.message}`);
    }
  }

  /**
   * Creates an account link for business onboarding
   * This is where businesses complete their Stripe setup
   */
  async createAccountLink(accountId: string, refreshUrl: string, returnUrl: string): Promise<Stripe.AccountLink> {
    try {
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      console.log(`🔗 Account link created for ${accountId}`);
      return accountLink;
    } catch (error) {
      console.error(`❌ Failed to create account link:`, error);
      throw new Error(`Failed to create account link: ${error.message}`);
    }
  }

  /**
   * Processes instant payout to customer
   * Uses TEST mode with fake Swedish bank accounts
   */
  async processCustomerPayout(accountId: string, payout: CustomerPayout): Promise<Stripe.Transfer> {
    try {
      console.log(`💰 Processing payout: ${payout.amount} öre to customer ${payout.customerId}`);
      
      // In TEST mode, we use Stripe's test bank account numbers
      // Real implementation would use customer's actual bank account
      const transfer = await this.stripe.transfers.create({
        amount: payout.amount,
        currency: payout.currency,
        destination: accountId,
        metadata: {
          ...payout.metadata,
          customerId: payout.customerId,
          type: 'customer_reward',
          test_mode: this.testMode.toString(),
        }
      });

      console.log(`✅ Transfer created: ${transfer.id} for ${payout.amount} öre`);
      
      return transfer;
    } catch (error) {
      console.error(`❌ Failed to process payout:`, error);
      throw new Error(`Failed to process payout: ${error.message}`);
    }
  }

  /**
   * Retrieves account status and capabilities
   */
  async getAccountStatus(accountId: string): Promise<{
    id: string;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    details_submitted: boolean;
    requirements: Stripe.Account.Requirements;
  }> {
    try {
      const account = await this.stripe.accounts.retrieve(accountId);
      
      return {
        id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements,
      };
    } catch (error) {
      console.error(`❌ Failed to get account status:`, error);
      throw new Error(`Failed to get account status: ${error.message}`);
    }
  }

  /**
   * Creates test webhook endpoint for development
   */
  async createWebhookEndpoint(url: string): Promise<Stripe.WebhookEndpoint> {
    try {
      const endpoint = await this.stripe.webhookEndpoints.create({
        url,
        enabled_events: [
          'account.updated',
          'account.application.authorized',
          'transfer.created',
          'transfer.updated',
          'payout.created',
          'payout.updated',
          'payment_intent.succeeded',
        ],
        connect: true, // For Connect webhooks
      });

      console.log(`🪝 Webhook endpoint created: ${endpoint.id}`);
      return endpoint;
    } catch (error) {
      console.error(`❌ Failed to create webhook endpoint:`, error);
      throw new Error(`Failed to create webhook endpoint: ${error.message}`);
    }
  }

  /**
   * Verifies webhook signature (for security)
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string): Stripe.Event {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error(`❌ Webhook signature verification failed:`, error);
      throw new Error(`Webhook signature verification failed: ${error.message}`);
    }
  }

  /**
   * TEST HELPER: Creates fake Swedish business data for testing
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

export { stripe };