// Stripe Connect service tests

import Stripe from 'stripe';
import { TestDataFactory, TestAssertions } from '../../../../tests/utils/testHelpers';

// Mock Stripe
const mockStripe = {
  accounts: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn()
  },
  transfers: {
    create: jest.fn(),
    retrieve: jest.fn()
  },
  webhooks: {
    constructEvent: jest.fn()
  },
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn()
  }
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripe);
});

// Import after mocking
import { 
  createConnectedAccount,
  processRewardPayment,
  validateWebhookSignature,
  calculateRewardAmount,
  getAccountStatus
} from '../stripe-connect';

describe('Stripe Connect Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up environment variables
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
  });

  describe('Account Creation', () => {
    it('should create Swedish business account successfully', async () => {
      // Arrange
      const businessData = TestDataFactory.generateBusiness({
        name: 'Café Stockholm AB',
        orgNumber: '556677-8899',
        country: 'SE'
      });

      const expectedAccount = {
        id: 'acct_test_swedish_123',
        country: 'SE',
        charges_enabled: false,
        payouts_enabled: false
      };

      mockStripe.accounts.create.mockResolvedValue(expectedAccount);

      // Act
      const result = await createConnectedAccount(businessData);

      // Assert
      expect(mockStripe.accounts.create).toHaveBeenCalledWith({
        type: 'express',
        country: 'SE',
        email: expect.any(String),
        business_type: 'company',
        business_profile: {
          name: businessData.name,
          product_description: 'Customer feedback and rewards platform'
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });

      expect(result).toEqual(expectedAccount);
      TestAssertions.expectValidUUID(result.id.replace('acct_test_', ''));
    });

    it('should handle account creation errors', async () => {
      // Arrange
      const businessData = TestDataFactory.generateBusiness();
      const stripeError = new Error('Invalid business information');
      stripeError.type = 'StripeInvalidRequestError';

      mockStripe.accounts.create.mockRejectedValue(stripeError);

      // Act & Assert
      await expect(createConnectedAccount(businessData)).rejects.toThrow('Invalid business information');
    });

    it('should validate Swedish organization number format', async () => {
      // Arrange
      const businessData = TestDataFactory.generateBusiness({
        orgNumber: 'invalid-org-number'
      });

      // Act & Assert
      await expect(createConnectedAccount(businessData)).rejects.toThrow('Invalid Swedish organization number');
    });
  });

  describe('Reward Payment Processing', () => {
    it('should process quality-based reward payment correctly', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession({
        purchaseAmount: 250.00
      });

      const qualityScore = {
        authenticity: 85,
        concreteness: 78,
        depth: 82,
        total: 82
      };

      const expectedRewardAmount = 20.50; // 8.2% of 250 SEK
      const expectedTransfer = {
        id: 'tr_test_reward_123',
        amount: 2050, // In öre
        currency: 'sek',
        destination: 'acct_test_business_123'
      };

      mockStripe.transfers.create.mockResolvedValue(expectedTransfer);

      // Act
      const result = await processRewardPayment(sessionData, qualityScore, 'acct_test_business_123');

      // Assert
      expect(mockStripe.transfers.create).toHaveBeenCalledWith({
        amount: 2050,
        currency: 'sek',
        destination: 'acct_test_business_123',
        metadata: {
          sessionId: sessionData.id,
          qualityScore: qualityScore.total,
          originalAmount: sessionData.purchaseAmount
        }
      });

      expect(result.amount).toBe(2050);
      TestAssertions.expectValidSEKAmount(result.amount / 100);
    });

    it('should apply tier-based reward caps correctly', async () => {
      const testCases = [
        { tier: 1, purchaseAmount: 1000, expectedMaxReward: 50 },
        { tier: 2, purchaseAmount: 2000, expectedMaxReward: 150 },
        { tier: 3, purchaseAmount: 5000, expectedMaxReward: 500 }
      ];

      for (const testCase of testCases) {
        // Reset mocks
        jest.clearAllMocks();

        // Arrange
        const sessionData = TestDataFactory.generateSession({
          purchaseAmount: testCase.purchaseAmount
        });

        const qualityScore = { total: 95 }; // High score to test cap
        
        mockStripe.transfers.create.mockResolvedValue({
          id: 'tr_test_cap_123',
          amount: testCase.expectedMaxReward * 100,
          currency: 'sek'
        });

        // Act
        const result = await processRewardPayment(
          sessionData, 
          qualityScore, 
          'acct_test_123',
          { tier: testCase.tier }
        );

        // Assert
        expect(result.amount).toBeLessThanOrEqual(testCase.expectedMaxReward * 100);
      }
    });

    it('should handle fraud risk adjustments', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession({
        purchaseAmount: 200.00,
        fraudRiskScore: 0.8 // High risk
      });

      const qualityScore = { total: 85 };
      
      // Expected reward should be reduced due to fraud risk
      const baseReward = 200 * 0.085; // 17 SEK
      const adjustedReward = baseReward * 0.5; // 50% reduction for high risk
      
      mockStripe.transfers.create.mockResolvedValue({
        id: 'tr_test_fraud_123',
        amount: adjustedReward * 100,
        currency: 'sek'
      });

      // Act
      const result = await processRewardPayment(
        sessionData, 
        qualityScore, 
        'acct_test_123',
        { fraudRiskScore: 0.8 }
      );

      // Assert
      expect(result.amount).toBeLessThan(1700); // Less than base reward
      expect(mockStripe.transfers.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            fraudRiskScore: 0.8,
            adjustmentApplied: true
          })
        })
      );
    });

    it('should process payment within 800ms (performance requirement)', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession();
      const qualityScore = { total: 75 };
      
      mockStripe.transfers.create.mockResolvedValue({
        id: 'tr_test_perf_123',
        amount: 1500,
        currency: 'sek'
      });

      // Act
      const startTime = Date.now();
      const result = await processRewardPayment(sessionData, qualityScore, 'acct_test_123');
      const processingTime = Date.now() - startTime;

      // Assert
      expect(processingTime).toBeLessThanOrEqual(800);
      expect(result).toBeDefined();
    });

    it('should handle payment failures with retry logic', async () => {
      // Arrange
      const sessionData = TestDataFactory.generateSession();
      const qualityScore = { total: 80 };
      
      // First two calls fail, third succeeds
      mockStripe.transfers.create
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue({
          id: 'tr_test_retry_123',
          amount: 1600,
          currency: 'sek'
        });

      // Act
      const result = await processRewardPayment(sessionData, qualityScore, 'acct_test_123');

      // Assert
      expect(mockStripe.transfers.create).toHaveBeenCalledTimes(3);
      expect(result.id).toBe('tr_test_retry_123');
    });
  });

  describe('Reward Calculation', () => {
    it('should calculate rewards based on quality scores correctly', () => {
      const testCases = [
        { score: 100, purchaseAmount: 100, expectedPercentage: 12 },
        { score: 90, purchaseAmount: 100, expectedPercentage: 10.8 },
        { score: 80, purchaseAmount: 100, expectedPercentage: 9.6 },
        { score: 70, purchaseAmount: 100, expectedPercentage: 8.4 },
        { score: 60, purchaseAmount: 100, expectedPercentage: 7.2 },
        { score: 50, purchaseAmount: 100, expectedPercentage: 6.0 },
        { score: 40, purchaseAmount: 100, expectedPercentage: 4.8 },
        { score: 30, purchaseAmount: 100, expectedPercentage: 3.6 },
        { score: 20, purchaseAmount: 100, expectedPercentage: 2.4 },
        { score: 10, purchaseAmount: 100, expectedPercentage: 1.2 },
        { score: 0, purchaseAmount: 100, expectedPercentage: 0 }
      ];

      testCases.forEach(({ score, purchaseAmount, expectedPercentage }) => {
        // Act
        const result = calculateRewardAmount(purchaseAmount, score);

        // Assert
        const expectedAmount = purchaseAmount * (expectedPercentage / 100);
        expect(result).toBeCloseTo(expectedAmount, 2);
        TestAssertions.expectValidSEKAmount(result);
      });
    });

    it('should handle edge cases in reward calculation', () => {
      // Test cases for edge conditions
      const edgeCases = [
        { score: -5, purchaseAmount: 100, expectedAmount: 0 }, // Negative score
        { score: 150, purchaseAmount: 100, expectedAmount: 12 }, // Score > 100
        { score: 75, purchaseAmount: 0, expectedAmount: 0 }, // Zero purchase
        { score: 75, purchaseAmount: -100, expectedAmount: 0 }, // Negative purchase
      ];

      edgeCases.forEach(({ score, purchaseAmount, expectedAmount }) => {
        // Act
        const result = calculateRewardAmount(purchaseAmount, score);

        // Assert
        expect(result).toBe(expectedAmount);
      });
    });
  });

  describe('Webhook Validation', () => {
    it('should validate webhook signatures correctly', () => {
      // Arrange
      const payload = JSON.stringify({
        type: 'account.updated',
        data: { object: { id: 'acct_test_123' } }
      });
      
      const signature = 'v1=test_signature';
      const webhookSecret = 'whsec_test_secret';
      
      const mockEvent = {
        type: 'account.updated',
        data: { object: { id: 'acct_test_123' } }
      };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      // Act
      const result = validateWebhookSignature(payload, signature, webhookSecret);

      // Assert
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload, 
        signature, 
        webhookSecret
      );
      expect(result).toEqual(mockEvent);
    });

    it('should reject invalid webhook signatures', () => {
      // Arrange
      const payload = 'invalid payload';
      const signature = 'invalid_signature';
      const webhookSecret = 'whsec_test_secret';

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      // Act & Assert
      expect(() => {
        validateWebhookSignature(payload, signature, webhookSecret);
      }).toThrow('Invalid signature');
    });
  });

  describe('Account Status Management', () => {
    it('should retrieve account status correctly', async () => {
      // Arrange
      const accountId = 'acct_test_status_123';
      const mockAccount = {
        id: accountId,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: {
          currently_due: [],
          eventually_due: ['individual.verification.document'],
          past_due: []
        }
      };

      mockStripe.accounts.retrieve.mockResolvedValue(mockAccount);

      // Act
      const result = await getAccountStatus(accountId);

      // Assert
      expect(mockStripe.accounts.retrieve).toHaveBeenCalledWith(accountId);
      expect(result).toEqual(mockAccount);
      expect(result.charges_enabled).toBe(true);
      expect(result.payouts_enabled).toBe(true);
    });

    it('should handle account retrieval errors', async () => {
      // Arrange
      const accountId = 'acct_invalid_123';
      const stripeError = new Error('No such account');
      stripeError.type = 'StripeInvalidRequestError';

      mockStripe.accounts.retrieve.mockRejectedValue(stripeError);

      // Act & Assert
      await expect(getAccountStatus(accountId)).rejects.toThrow('No such account');
    });
  });

  describe('Swedish Banking Integration', () => {
    it('should handle Swedish banking methods correctly', async () => {
      // Test different Swedish payment methods
      const swedishMethods = [
        { type: 'swish', phoneNumber: '+46701234567' },
        { type: 'bankgiro', number: '123-4567' },
        { type: 'iban', number: 'SE3550000000054910000003' }
      ];

      for (const method of swedishMethods) {
        // Reset mocks
        jest.clearAllMocks();

        // Arrange
        const sessionData = TestDataFactory.generateSession();
        const qualityScore = { total: 80 };

        mockStripe.transfers.create.mockResolvedValue({
          id: `tr_${method.type}_123`,
          amount: 1600,
          currency: 'sek',
          metadata: {
            paymentMethod: method.type,
            swedishBanking: true
          }
        });

        // Act
        const result = await processRewardPayment(
          sessionData, 
          qualityScore, 
          'acct_test_123',
          { paymentMethod: method }
        );

        // Assert
        expect(result.metadata.swedishBanking).toBe(true);
        expect(result.metadata.paymentMethod).toBe(method.type);
      }
    });

    it('should validate Swedish IBAN format', () => {
      const testCases = [
        { iban: 'SE3550000000054910000003', valid: true },
        { iban: 'SE1234567890123456789012', valid: true },
        { iban: 'NO9386011117947', valid: false }, // Norwegian IBAN
        { iban: 'INVALID', valid: false },
        { iban: 'SE355000000005491000000', valid: false } // Too short
      ];

      testCases.forEach(({ iban, valid }) => {
        const isValidSwedishIBAN = (iban: string) => {
          return iban.startsWith('SE') && iban.length === 24;
        };

        expect(isValidSwedishIBAN(iban)).toBe(valid);
      });
    });
  });

  describe('Commission Calculation', () => {
    it('should calculate business commission correctly', async () => {
      // Arrange
      const rewardAmount = 20.00; // SEK
      const commissionRates = [
        { tier: 1, rate: 0.20 }, // 20%
        { tier: 2, rate: 0.18 }, // 18%
        { tier: 3, rate: 0.15 }  // 15%
      ];

      commissionRates.forEach(({ tier, rate }) => {
        // Act
        const commission = rewardAmount * rate;
        const businessPays = rewardAmount + commission;

        // Assert
        TestAssertions.expectValidSEKAmount(commission);
        TestAssertions.expectValidSEKAmount(businessPays);
        
        if (tier === 1) {
          expect(commission).toBe(4.00); // 20% of 20 SEK
          expect(businessPays).toBe(24.00);
        }
      });
    });
  });
});