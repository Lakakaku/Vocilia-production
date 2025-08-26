import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import axios from 'axios';
import Stripe from 'stripe';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_...';
const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

describe('Payment System Validation - Stripe Connect', () => {
  let testBusinessId: string;
  let testCustomerId: string;
  let testAccountId: string;

  beforeEach(async () => {
    // Create test business
    testBusinessId = `test_business_${Date.now()}`;
    testCustomerId = `test_customer_${Date.now()}`;
  });

  afterEach(async () => {
    // Cleanup test data
    if (testAccountId) {
      try {
        await stripe.accounts.del(testAccountId);
      } catch (error) {
        console.log('Failed to delete test account:', error);
      }
    }
  });

  describe('A. Stripe Connect Testing', () => {
    describe('Customer Onboarding & KYC', () => {
      it('should create a connected account for a Swedish business', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/connect/onboard`, {
          businessId: testBusinessId,
          businessDetails: {
            name: 'Test Swedish Business AB',
            orgNumber: '556677-8899',
            email: 'test@business.se',
            phone: '+46701234567',
            address: {
              line1: 'Testgatan 123',
              city: 'Stockholm',
              postal_code: '111 22',
              country: 'SE'
            },
            bankAccount: {
              country: 'SE',
              currency: 'SEK',
              account_holder_name: 'Test Swedish Business AB',
              account_holder_type: 'company',
              clearing_number: '8327',
              account_number: '1234567890'
            }
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('accountId');
        expect(response.data).toHaveProperty('onboardingUrl');
        expect(response.data.accountId).toMatch(/^acct_/);
        
        testAccountId = response.data.accountId;
      });

      it('should validate Swedish organization number format', async () => {
        const invalidOrgNumbers = [
          '12345678',      // Too short
          '1234567890123', // Too long
          'ABC123-4567',   // Contains letters
          '556677-889X'    // Invalid checksum character
        ];

        for (const orgNumber of invalidOrgNumbers) {
          await expect(
            axios.post(`${API_BASE_URL}/api/payments/connect/onboard`, {
              businessId: testBusinessId,
              businessDetails: {
                name: 'Test Business',
                orgNumber,
                email: 'test@business.se'
              }
            })
          ).rejects.toThrow();
        }
      });

      it('should verify KYC requirements for business representatives', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/connect/onboard`, {
          businessId: testBusinessId,
          businessDetails: {
            name: 'Test Swedish Business AB',
            orgNumber: '556677-8899',
            representatives: [
              {
                first_name: 'Erik',
                last_name: 'Andersson',
                email: 'erik@business.se',
                phone: '+46701234567',
                dob: {
                  day: 15,
                  month: 3,
                  year: 1980
                },
                address: {
                  line1: 'Hemgatan 456',
                  city: 'Stockholm',
                  postal_code: '111 33',
                  country: 'SE'
                },
                relationship: {
                  title: 'CEO',
                  owner: true,
                  percent_ownership: 51
                },
                ssn_last_4: '1234'
              }
            ]
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.verificationStatus).toBe('pending');
        expect(response.data.requiredFields).toBeInstanceOf(Array);
      });

      it('should handle multi-owner businesses correctly', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/connect/onboard`, {
          businessId: testBusinessId,
          businessDetails: {
            name: 'Multi-Owner Business AB',
            orgNumber: '556677-8899',
            representatives: [
              {
                first_name: 'Anna',
                last_name: 'Svensson',
                email: 'anna@business.se',
                relationship: {
                  title: 'Co-founder',
                  owner: true,
                  percent_ownership: 30
                }
              },
              {
                first_name: 'Johan',
                last_name: 'Nilsson',
                email: 'johan@business.se',
                relationship: {
                  title: 'Co-founder',
                  owner: true,
                  percent_ownership: 30
                }
              },
              {
                first_name: 'Maria',
                last_name: 'Eriksson',
                email: 'maria@business.se',
                relationship: {
                  title: 'Co-founder',
                  owner: true,
                  percent_ownership: 40
                }
              }
            ]
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.ownersVerified).toBe(3);
        expect(response.data.totalOwnership).toBe(100);
      });
    });

    describe('Reward Calculation Accuracy', () => {
      it('should calculate rewards based on quality score tiers', async () => {
        const testCases = [
          { qualityScore: 95, purchaseAmount: 1000, expectedReward: { min: 100, max: 120 } }, // 10-12%
          { qualityScore: 85, purchaseAmount: 1000, expectedReward: { min: 70, max: 90 } },   // 7-9%
          { qualityScore: 75, purchaseAmount: 1000, expectedReward: { min: 50, max: 70 } },   // 5-7%
          { qualityScore: 65, purchaseAmount: 1000, expectedReward: { min: 30, max: 50 } },   // 3-5%
          { qualityScore: 45, purchaseAmount: 1000, expectedReward: { min: 10, max: 30 } },   // 1-3%
        ];

        for (const testCase of testCases) {
          const response = await axios.post(`${API_BASE_URL}/api/payments/calculate-reward`, {
            feedbackId: 'test_feedback_123',
            qualityScore: testCase.qualityScore,
            purchaseAmount: testCase.purchaseAmount,
            businessId: testBusinessId
          });

          expect(response.status).toBe(200);
          expect(response.data.rewardAmount).toBeGreaterThanOrEqual(testCase.expectedReward.min);
          expect(response.data.rewardAmount).toBeLessThanOrEqual(testCase.expectedReward.max);
          expect(response.data.commissionAmount).toBe(response.data.rewardAmount * 0.20);
        }
      });

      it('should apply fraud prevention caps correctly', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/calculate-reward`, {
          feedbackId: 'test_feedback_456',
          qualityScore: 98,
          purchaseAmount: 100000, // Very high purchase amount
          businessId: testBusinessId,
          riskScore: 0.8 // High risk
        });

        expect(response.status).toBe(200);
        expect(response.data.rewardAmount).toBeLessThanOrEqual(1000); // Maximum cap
        expect(response.data.cappedReason).toBe('fraud_prevention');
      });

      it('should handle business-specific reward configurations', async () => {
        // Create business with custom reward configuration
        await axios.post(`${API_BASE_URL}/api/business/configure-rewards`, {
          businessId: testBusinessId,
          configuration: {
            maxRewardPercentage: 8,
            minRewardPercentage: 0.5,
            maxRewardAmount: 500,
            customTiers: [
              { min: 90, max: 100, percentage: [6, 8] },
              { min: 80, max: 89, percentage: [4, 6] },
              { min: 70, max: 79, percentage: [2, 4] },
              { min: 50, max: 69, percentage: [1, 2] },
              { min: 0, max: 49, percentage: [0.5, 1] }
            ]
          }
        });

        const response = await axios.post(`${API_BASE_URL}/api/payments/calculate-reward`, {
          feedbackId: 'test_feedback_789',
          qualityScore: 95,
          purchaseAmount: 10000,
          businessId: testBusinessId
        });

        expect(response.status).toBe(200);
        expect(response.data.rewardAmount).toBeGreaterThanOrEqual(600); // 6% minimum
        expect(response.data.rewardAmount).toBeLessThanOrEqual(800);  // 8% maximum
      });
    });

    describe('Payout Processing', () => {
      it('should process instant payout to customer', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/payout`, {
          feedbackId: 'test_feedback_001',
          customerId: testCustomerId,
          amount: 150,
          currency: 'SEK',
          paymentMethod: 'bank_transfer',
          bankDetails: {
            clearing_number: '8327',
            account_number: '1234567890'
          }
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('payoutId');
        expect(response.data.status).toBe('processing');
        expect(response.data.estimatedArrival).toBeDefined();
      });

      it('should handle Swish payments for Swedish customers', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/payout`, {
          feedbackId: 'test_feedback_002',
          customerId: testCustomerId,
          amount: 200,
          currency: 'SEK',
          paymentMethod: 'swish',
          swishNumber: '+46701234567'
        });

        expect(response.status).toBe(200);
        expect(response.data.paymentMethod).toBe('swish');
        expect(response.data.instantTransfer).toBe(true);
      });

      it('should handle Bankgiro transfers for larger amounts', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/payout`, {
          feedbackId: 'test_feedback_003',
          customerId: testCustomerId,
          amount: 5000,
          currency: 'SEK',
          paymentMethod: 'bankgiro',
          bankgiroNumber: '5050-1234'
        });

        expect(response.status).toBe(200);
        expect(response.data.paymentMethod).toBe('bankgiro');
        expect(response.data.processingTime).toBe('1-2 business days');
      });

      it('should validate minimum payout thresholds', async () => {
        await expect(
          axios.post(`${API_BASE_URL}/api/payments/payout`, {
            feedbackId: 'test_feedback_004',
            customerId: testCustomerId,
            amount: 5, // Below minimum
            currency: 'SEK'
          })
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: {
              error: 'Amount below minimum payout threshold'
            }
          }
        });
      });
    });

    describe('Commission Calculations', () => {
      it('should calculate platform commission correctly', async () => {
        const testPayouts = [
          { rewardAmount: 100, expectedCommission: 20 },
          { rewardAmount: 250, expectedCommission: 50 },
          { rewardAmount: 1000, expectedCommission: 200 },
          { rewardAmount: 75.50, expectedCommission: 15.10 }
        ];

        for (const test of testPayouts) {
          const response = await axios.post(`${API_BASE_URL}/api/payments/calculate-commission`, {
            rewardAmount: test.rewardAmount,
            businessId: testBusinessId
          });

          expect(response.status).toBe(200);
          expect(response.data.commissionAmount).toBeCloseTo(test.expectedCommission, 2);
          expect(response.data.commissionRate).toBe(0.20);
          expect(response.data.netPayout).toBeCloseTo(
            test.rewardAmount - test.expectedCommission,
            2
          );
        }
      });

      it('should handle tiered commission rates for enterprise businesses', async () => {
        // Configure enterprise tier
        await axios.post(`${API_BASE_URL}/api/business/set-tier`, {
          businessId: testBusinessId,
          tier: 'enterprise',
          commissionRate: 0.15 // 15% for enterprise
        });

        const response = await axios.post(`${API_BASE_URL}/api/payments/calculate-commission`, {
          rewardAmount: 1000,
          businessId: testBusinessId
        });

        expect(response.status).toBe(200);
        expect(response.data.commissionRate).toBe(0.15);
        expect(response.data.commissionAmount).toBe(150);
      });

      it('should track cumulative commissions for billing', async () => {
        // Process multiple payouts
        const payouts = [100, 200, 150, 300, 250];
        
        for (const amount of payouts) {
          await axios.post(`${API_BASE_URL}/api/payments/payout`, {
            feedbackId: `test_${Date.now()}`,
            customerId: testCustomerId,
            amount,
            businessId: testBusinessId
          });
        }

        const response = await axios.get(
          `${API_BASE_URL}/api/payments/commission-summary/${testBusinessId}`
        );

        expect(response.status).toBe(200);
        expect(response.data.totalRewards).toBe(1000);
        expect(response.data.totalCommission).toBe(200);
        expect(response.data.transactionCount).toBe(5);
      });
    });

    describe('Swedish Banking Integration', () => {
      it('should validate Swedish bank account numbers', async () => {
        const validAccounts = [
          { clearing: '8327', account: '1234567890' },     // Swedbank
          { clearing: '5000', account: '12345678901' },    // SEB
          { clearing: '3000', account: '1234567' },        // Nordea
          { clearing: '6000', account: '123456789' }       // Handelsbanken
        ];

        for (const account of validAccounts) {
          const response = await axios.post(`${API_BASE_URL}/api/payments/validate-bank`, {
            clearingNumber: account.clearing,
            accountNumber: account.account,
            country: 'SE'
          });

          expect(response.status).toBe(200);
          expect(response.data.valid).toBe(true);
          expect(response.data.bankName).toBeDefined();
        }
      });

      it('should detect invalid Swedish bank accounts', async () => {
        const invalidAccounts = [
          { clearing: '0000', account: '1234567890' },     // Invalid clearing
          { clearing: '8327', account: '123' },            // Too short
          { clearing: '5000', account: '123456789012345' } // Too long
        ];

        for (const account of invalidAccounts) {
          const response = await axios.post(`${API_BASE_URL}/api/payments/validate-bank`, {
            clearingNumber: account.clearing,
            accountNumber: account.account,
            country: 'SE'
          });

          expect(response.status).toBe(200);
          expect(response.data.valid).toBe(false);
          expect(response.data.error).toBeDefined();
        }
      });

      it('should handle BankID verification for large payouts', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/initiate-bankid`, {
          customerId: testCustomerId,
          payoutAmount: 10000,
          personalNumber: '199001011234'
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('authToken');
        expect(response.data).toHaveProperty('qrCode');
        expect(response.data.expiresIn).toBe(30);
      });

      it('should integrate with Swedish tax reporting requirements', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/tax-report`, {
          businessId: testBusinessId,
          year: new Date().getFullYear(),
          quarter: Math.floor(new Date().getMonth() / 3) + 1
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('totalPayouts');
        expect(response.data).toHaveProperty('totalCommissions');
        expect(response.data).toHaveProperty('vatAmount');
        expect(response.data).toHaveProperty('skatteverketReportId');
      });
    });
  });

  describe('B. Payment Security Testing', () => {
    describe('PCI Compliance Verification', () => {
      it('should never store or log sensitive card data', async () => {
        const sensitiveData = {
          cardNumber: '4242424242424242',
          cvv: '123',
          expiryMonth: '12',
          expiryYear: '2025'
        };

        // Attempt to send sensitive data
        const response = await axios.post(`${API_BASE_URL}/api/payments/process`, {
          amount: 100,
          paymentMethod: {
            type: 'card',
            ...sensitiveData
          }
        });

        // Check audit logs don't contain sensitive data
        const logs = await axios.get(`${API_BASE_URL}/api/audit/recent`);
        const logContent = JSON.stringify(logs.data);
        
        expect(logContent).not.toContain(sensitiveData.cardNumber);
        expect(logContent).not.toContain(sensitiveData.cvv);
      });

      it('should use tokenization for payment methods', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/tokenize`, {
          paymentMethod: {
            type: 'bank_account',
            clearing_number: '8327',
            account_number: '1234567890'
          }
        });

        expect(response.status).toBe(200);
        expect(response.data.token).toMatch(/^pm_/);
        expect(response.data).not.toHaveProperty('account_number');
        expect(response.data.last4).toBe('7890');
      });

      it('should enforce HTTPS for all payment endpoints', async () => {
        const paymentEndpoints = [
          '/api/payments/payout',
          '/api/payments/connect/onboard',
          '/api/payments/webhooks/stripe',
          '/api/payments/tokenize'
        ];

        for (const endpoint of paymentEndpoints) {
          // Attempt HTTP request (should be redirected or rejected)
          await expect(
            axios.post(`http://localhost:3001${endpoint}`, {})
          ).rejects.toMatchObject({
            response: {
              status: 426, // Upgrade Required
              data: {
                error: 'HTTPS required for payment operations'
              }
            }
          });
        }
      });

      it('should implement secure headers for payment pages', async () => {
        const response = await axios.get(`${API_BASE_URL}/api/payments/checkout-page`, {
          validateStatus: () => true
        });

        expect(response.headers['content-security-policy']).toContain("default-src 'self'");
        expect(response.headers['strict-transport-security']).toContain('max-age=31536000');
        expect(response.headers['x-frame-options']).toBe('DENY');
        expect(response.headers['x-content-type-options']).toBe('nosniff');
      });
    });

    describe('Webhook Signature Validation', () => {
      it('should validate Stripe webhook signatures', async () => {
        const payload = JSON.stringify({
          type: 'transfer.created',
          data: {
            object: {
              id: 'tr_test_123',
              amount: 10000,
              currency: 'sek'
            }
          }
        });

        const signature = stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
        });

        const response = await axios.post(
          `${API_BASE_URL}/api/payments/webhooks/stripe`,
          payload,
          {
            headers: {
              'stripe-signature': signature,
              'content-type': 'application/json'
            }
          }
        );

        expect(response.status).toBe(200);
        expect(response.data.received).toBe(true);
      });

      it('should reject webhooks with invalid signatures', async () => {
        const payload = JSON.stringify({
          type: 'transfer.created',
          data: { object: { id: 'tr_test_456' } }
        });

        await expect(
          axios.post(
            `${API_BASE_URL}/api/payments/webhooks/stripe`,
            payload,
            {
              headers: {
                'stripe-signature': 'invalid_signature',
                'content-type': 'application/json'
              }
            }
          )
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: {
              error: 'Invalid webhook signature'
            }
          }
        });
      });

      it('should handle webhook replay attacks', async () => {
        const payload = JSON.stringify({
          type: 'transfer.created',
          data: {
            object: {
              id: 'tr_test_789',
              amount: 5000
            }
          },
          created: Math.floor(Date.now() / 1000) - 400 // 400 seconds ago
        });

        const signature = stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
        });

        await expect(
          axios.post(
            `${API_BASE_URL}/api/payments/webhooks/stripe`,
            payload,
            {
              headers: {
                'stripe-signature': signature,
                'content-type': 'application/json'
              }
            }
          )
        ).rejects.toMatchObject({
          response: {
            status: 400,
            data: {
              error: 'Webhook timestamp too old'
            }
          }
        });
      });

      it('should implement idempotency for webhook processing', async () => {
        const eventId = `evt_${Date.now()}`;
        const payload = JSON.stringify({
          id: eventId,
          type: 'transfer.created',
          data: {
            object: {
              id: 'tr_test_999',
              amount: 7500
            }
          }
        });

        const signature = stripe.webhooks.generateTestHeaderString({
          payload,
          secret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
        });

        // First request
        const response1 = await axios.post(
          `${API_BASE_URL}/api/payments/webhooks/stripe`,
          payload,
          {
            headers: {
              'stripe-signature': signature,
              'content-type': 'application/json'
            }
          }
        );

        // Second request with same event ID
        const response2 = await axios.post(
          `${API_BASE_URL}/api/payments/webhooks/stripe`,
          payload,
          {
            headers: {
              'stripe-signature': signature,
              'content-type': 'application/json'
            }
          }
        );

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(response2.data.message).toBe('Event already processed');
      });
    });

    describe('Payment Retry Mechanisms', () => {
      it('should retry failed payouts with exponential backoff', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/payout`, {
          feedbackId: 'test_retry_001',
          customerId: testCustomerId,
          amount: 100,
          forceFailure: true // Test flag to simulate failure
        });

        expect(response.status).toBe(202); // Accepted for retry
        expect(response.data.status).toBe('pending_retry');
        expect(response.data.retrySchedule).toEqual([
          expect.objectContaining({ attempt: 1, delay: 1000 }),
          expect.objectContaining({ attempt: 2, delay: 2000 }),
          expect.objectContaining({ attempt: 3, delay: 4000 }),
          expect.objectContaining({ attempt: 4, delay: 8000 }),
          expect.objectContaining({ attempt: 5, delay: 16000 })
        ]);
      });

      it('should handle network failures gracefully', async () => {
        // Simulate network failure
        const response = await axios.post(`${API_BASE_URL}/api/payments/payout`, {
          feedbackId: 'test_network_001',
          customerId: testCustomerId,
          amount: 150,
          simulateNetworkError: true
        });

        expect(response.status).toBe(503); // Service Unavailable
        expect(response.data.error).toBe('Payment service temporarily unavailable');
        expect(response.data.retryAfter).toBeDefined();
      });

      it('should implement circuit breaker for payment service', async () => {
        // Trigger multiple failures to open circuit
        for (let i = 0; i < 5; i++) {
          await axios.post(`${API_BASE_URL}/api/payments/payout`, {
            feedbackId: `test_circuit_${i}`,
            customerId: testCustomerId,
            amount: 50,
            forceFailure: true
          }).catch(() => {});
        }

        // Circuit should be open now
        const response = await axios.post(`${API_BASE_URL}/api/payments/payout`, {
          feedbackId: 'test_circuit_open',
          customerId: testCustomerId,
          amount: 75
        }).catch(err => err.response);

        expect(response.status).toBe(503);
        expect(response.data.error).toBe('Payment service circuit breaker open');
        expect(response.data.resetTime).toBeDefined();
      });

      it('should queue payments during service degradation', async () => {
        // Enable degraded mode
        await axios.post(`${API_BASE_URL}/api/admin/service-mode`, {
          service: 'payments',
          mode: 'degraded'
        });

        const response = await axios.post(`${API_BASE_URL}/api/payments/payout`, {
          feedbackId: 'test_degraded_001',
          customerId: testCustomerId,
          amount: 200
        });

        expect(response.status).toBe(202); // Accepted
        expect(response.data.status).toBe('queued');
        expect(response.data.queuePosition).toBeDefined();
        expect(response.data.estimatedProcessingTime).toBeDefined();

        // Restore normal mode
        await axios.post(`${API_BASE_URL}/api/admin/service-mode`, {
          service: 'payments',
          mode: 'normal'
        });
      });
    });

    describe('Fraud Detection Systems', () => {
      it('should detect suspicious payment patterns', async () => {
        const suspiciousPatterns = [
          {
            scenario: 'rapid_successive_payouts',
            requests: Array(10).fill(null).map((_, i) => ({
              feedbackId: `rapid_${i}`,
              customerId: testCustomerId,
              amount: 100,
              timestamp: Date.now() + i * 100 // 100ms apart
            }))
          },
          {
            scenario: 'unusual_amount_spike',
            requests: [
              { amount: 50 },
              { amount: 75 },
              { amount: 100 },
              { amount: 5000 } // Sudden spike
            ]
          },
          {
            scenario: 'multiple_accounts_same_device',
            requests: Array(5).fill(null).map((_, i) => ({
              customerId: `customer_${i}`,
              deviceFingerprint: 'same_device_123'
            }))
          }
        ];

        for (const pattern of suspiciousPatterns) {
          const response = await axios.post(`${API_BASE_URL}/api/payments/fraud-check`, {
            pattern: pattern.scenario,
            data: pattern.requests
          });

          expect(response.status).toBe(200);
          expect(response.data.riskScore).toBeGreaterThan(0.7);
          expect(response.data.flagged).toBe(true);
          expect(response.data.reason).toBeDefined();
        }
      });

      it('should implement velocity checks', async () => {
        const velocityTests = [
          {
            customerId: testCustomerId,
            limit: 'hourly',
            maxAmount: 1000,
            maxTransactions: 5
          },
          {
            customerId: testCustomerId,
            limit: 'daily',
            maxAmount: 5000,
            maxTransactions: 20
          },
          {
            customerId: testCustomerId,
            limit: 'weekly',
            maxAmount: 20000,
            maxTransactions: 50
          }
        ];

        for (const test of velocityTests) {
          const response = await axios.post(`${API_BASE_URL}/api/payments/velocity-check`, test);

          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('currentAmount');
          expect(response.data).toHaveProperty('currentTransactions');
          expect(response.data).toHaveProperty('limitExceeded');
          expect(response.data).toHaveProperty('remainingAmount');
          expect(response.data).toHaveProperty('remainingTransactions');
        }
      });

      it('should detect and prevent account takeover attempts', async () => {
        const takoverIndicators = {
          customerId: testCustomerId,
          indicators: [
            { type: 'new_device', value: 'device_xyz_789' },
            { type: 'new_location', value: { lat: 51.5074, lon: -0.1278 } }, // London
            { type: 'unusual_time', value: '03:45:00' },
            { type: 'changed_bank_account', value: true },
            { type: 'multiple_failed_verifications', value: 3 }
          ]
        };

        const response = await axios.post(
          `${API_BASE_URL}/api/payments/ato-check`,
          takoverIndicators
        );

        expect(response.status).toBe(200);
        expect(response.data.riskLevel).toBe('high');
        expect(response.data.requiresAdditionalVerification).toBe(true);
        expect(response.data.suggestedActions).toContain('require_2fa');
        expect(response.data.suggestedActions).toContain('manual_review');
      });

      it('should implement ML-based fraud scoring', async () => {
        const transactionFeatures = {
          feedbackId: 'test_ml_fraud_001',
          customerId: testCustomerId,
          features: {
            purchaseAmount: 500,
            qualityScore: 85,
            feedbackLength: 45, // seconds
            wordCount: 120,
            sentimentScore: 0.8,
            timeOfDay: '14:30',
            dayOfWeek: 'Monday',
            deviceType: 'iPhone',
            osVersion: 'iOS 17.0',
            locationAccuracy: 10, // meters
            previousFeedbacks: 5,
            averageQualityScore: 82,
            accountAge: 30, // days
            businessCategory: 'restaurant',
            distanceFromUsualLocation: 2.5 // km
          }
        };

        const response = await axios.post(
          `${API_BASE_URL}/api/payments/ml-fraud-score`,
          transactionFeatures
        );

        expect(response.status).toBe(200);
        expect(response.data.fraudProbability).toBeGreaterThanOrEqual(0);
        expect(response.data.fraudProbability).toBeLessThanOrEqual(1);
        expect(response.data.confidence).toBeGreaterThanOrEqual(0);
        expect(response.data.confidence).toBeLessThanOrEqual(1);
        expect(response.data.topRiskFactors).toBeInstanceOf(Array);
        expect(response.data.recommendation).toMatch(/^(approve|review|decline)$/);
      });
    });
  });

  describe('C. Financial Reconciliation', () => {
    describe('Daily Transaction Reports', () => {
      it('should generate comprehensive daily reports', async () => {
        const response = await axios.get(
          `${API_BASE_URL}/api/payments/reports/daily/${new Date().toISOString().split('T')[0]}`
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          date: expect.any(String),
          summary: {
            totalTransactions: expect.any(Number),
            totalRewards: expect.any(Number),
            totalCommissions: expect.any(Number),
            totalPayouts: expect.any(Number),
            successRate: expect.any(Number),
            averageRewardAmount: expect.any(Number),
            averageQualityScore: expect.any(Number)
          },
          byBusinessType: expect.any(Array),
          byPaymentMethod: expect.any(Array),
          byHour: expect.any(Array),
          failures: expect.any(Array),
          disputes: expect.any(Array)
        });
      });

      it('should track payment statuses accurately', async () => {
        const statuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];
        
        const response = await axios.get(
          `${API_BASE_URL}/api/payments/status-summary/${new Date().toISOString().split('T')[0]}`
        );

        expect(response.status).toBe(200);
        for (const status of statuses) {
          expect(response.data).toHaveProperty(status);
          expect(typeof response.data[status]).toBe('number');
        }
        
        // Verify total matches sum of statuses
        const total = Object.values(response.data).reduce(
          (sum: number, count: any) => sum + (typeof count === 'number' ? count : 0), 
          0
        );
        expect(response.data.total).toBe(total);
      });

      it('should reconcile Stripe transfers with internal records', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/reconcile/stripe`, {
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          stripeTransfers: expect.any(Number),
          internalRecords: expect.any(Number),
          matched: expect.any(Number),
          discrepancies: expect.any(Array),
          reconciliationStatus: expect.stringMatching(/^(balanced|discrepancy)$/)
        });

        if (response.data.discrepancies.length > 0) {
          expect(response.data.discrepancies[0]).toMatchObject({
            type: expect.any(String),
            stripeId: expect.any(String),
            internalId: expect.any(String),
            amount: expect.any(Number),
            reason: expect.any(String)
          });
        }
      });
    });

    describe('Commission Tracking', () => {
      it('should track commissions by business accurately', async () => {
        const response = await axios.get(
          `${API_BASE_URL}/api/payments/commissions/business/${testBusinessId}`
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          businessId: testBusinessId,
          period: expect.any(String),
          totalCommission: expect.any(Number),
          totalRewards: expect.any(Number),
          commissionRate: expect.any(Number),
          transactions: expect.any(Array),
          invoiceGenerated: expect.any(Boolean),
          paymentStatus: expect.any(String)
        });
      });

      it('should generate commission invoices automatically', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/commissions/generate-invoice`, {
          businessId: testBusinessId,
          period: 'monthly',
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear()
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          invoiceId: expect.any(String),
          invoiceNumber: expect.any(String),
          businessId: testBusinessId,
          period: expect.any(String),
          totalAmount: expect.any(Number),
          vat: expect.any(Number),
          totalWithVat: expect.any(Number),
          dueDate: expect.any(String),
          downloadUrl: expect.any(String)
        });
      });

      it('should handle commission adjustments and credits', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/commissions/adjust`, {
          businessId: testBusinessId,
          adjustmentType: 'credit',
          amount: 100,
          reason: 'Service disruption compensation',
          appliedTo: 'next_invoice'
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          adjustmentId: expect.any(String),
          businessId: testBusinessId,
          type: 'credit',
          amount: 100,
          reason: expect.any(String),
          appliedTo: 'next_invoice',
          createdBy: expect.any(String),
          createdAt: expect.any(String)
        });
      });
    });

    describe('Payout Verification', () => {
      it('should verify all payouts are delivered', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/verify-payouts`, {
          date: new Date().toISOString().split('T')[0]
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          totalPayouts: expect.any(Number),
          verified: expect.any(Number),
          pending: expect.any(Number),
          failed: expect.any(Number),
          verificationRate: expect.any(Number),
          unverified: expect.any(Array)
        });

        if (response.data.unverified.length > 0) {
          expect(response.data.unverified[0]).toMatchObject({
            payoutId: expect.any(String),
            amount: expect.any(Number),
            status: expect.any(String),
            lastAttempt: expect.any(String),
            nextRetry: expect.any(String)
          });
        }
      });

      it('should match bank statements with payouts', async () => {
        // Simulate bank statement upload
        const bankStatement = {
          transactions: [
            { reference: 'FBCK_001', amount: 150, date: '2024-01-15' },
            { reference: 'FBCK_002', amount: 200, date: '2024-01-15' },
            { reference: 'FBCK_003', amount: 175, date: '2024-01-15' }
          ]
        };

        const response = await axios.post(
          `${API_BASE_URL}/api/payments/match-bank-statement`,
          bankStatement
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          totalTransactions: 3,
          matched: expect.any(Number),
          unmatched: expect.any(Array),
          matchRate: expect.any(Number)
        });
      });
    });

    describe('Financial Audit Trails', () => {
      it('should maintain complete audit trail for all transactions', async () => {
        const response = await axios.get(
          `${API_BASE_URL}/api/payments/audit-trail/transaction/test_transaction_123`
        );

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          transactionId: 'test_transaction_123',
          events: expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(String),
              eventType: expect.any(String),
              actor: expect.any(String),
              details: expect.any(Object),
              ipAddress: expect.any(String)
            })
          ])
        });

        // Verify chronological order
        const timestamps = response.data.events.map((e: any) => new Date(e.timestamp).getTime());
        expect(timestamps).toEqual([...timestamps].sort());
      });

      it('should track all commission changes', async () => {
        const response = await axios.get(
          `${API_BASE_URL}/api/payments/audit-trail/commission/${testBusinessId}`
        );

        expect(response.status).toBe(200);
        expect(response.data.changes).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              timestamp: expect.any(String),
              previousRate: expect.any(Number),
              newRate: expect.any(Number),
              reason: expect.any(String),
              approvedBy: expect.any(String)
            })
          ])
        );
      });

      it('should generate compliance reports for regulators', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/compliance-report`, {
          reportType: 'swedish_financial_supervisory',
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          reportId: expect.any(String),
          reportType: 'swedish_financial_supervisory',
          period: expect.any(Object),
          summary: {
            totalVolume: expect.any(Number),
            totalTransactions: expect.any(Number),
            averageTransactionValue: expect.any(Number),
            fraudRate: expect.any(Number),
            disputeRate: expect.any(Number)
          },
          amlCompliance: {
            suspiciousActivities: expect.any(Number),
            reportedCases: expect.any(Number),
            enhancedDueDiligence: expect.any(Number)
          },
          dataProtection: {
            gdprCompliant: true,
            dataBreaches: expect.any(Number),
            accessRequests: expect.any(Number),
            deletionRequests: expect.any(Number)
          }
        });
      });

      it('should export data for external auditors', async () => {
        const response = await axios.post(`${API_BASE_URL}/api/payments/export-audit-data`, {
          format: 'csv',
          includeTypes: ['transactions', 'commissions', 'disputes', 'refunds'],
          startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString(),
          encryptionKey: 'auditor-public-key'
        });

        expect(response.status).toBe(200);
        expect(response.data).toMatchObject({
          exportId: expect.any(String),
          files: expect.arrayContaining([
            expect.objectContaining({
              filename: expect.stringMatching(/\.(csv|xlsx)$/),
              size: expect.any(Number),
              checksum: expect.any(String),
              encrypted: true
            })
          ]),
          downloadUrl: expect.any(String),
          expiresAt: expect.any(String)
        });
      });
    });
  });
});