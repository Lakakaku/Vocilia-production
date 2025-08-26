// Test helpers and utilities for AI Feedback Platform

const crypto = require('crypto');

/**
 * Generate test data for various entities
 */
class TestDataFactory {
  static generateBusiness(overrides = {}) {
    return {
      id: `business-${crypto.randomUUID()}`,
      name: 'Test Café Stockholm',
      orgNumber: '556677-8899',
      tier: 1,
      stripeAccountId: 'acct_test_123',
      commissionRate: 0.20,
      trialFeedbacksRemaining: 30,
      createdAt: new Date(),
      ...overrides
    };
  }

  static generateSession(overrides = {}) {
    return {
      id: `session-${crypto.randomUUID()}`,
      sessionToken: `token-${crypto.randomUUID()}`,
      qrCodeId: `qr-${crypto.randomUUID()}`,
      transactionId: `txn-${Date.now()}`,
      purchaseAmount: 250.00,
      purchaseTime: new Date(),
      customerHash: crypto.createHash('sha256').update(`customer-${Date.now()}`).digest('hex'),
      status: 'pending',
      startedAt: new Date(),
      ...overrides
    };
  }

  static generateFeedback(overrides = {}) {
    return {
      id: `feedback-${crypto.randomUUID()}`,
      transcript: 'Jag tyckte kaffet var mycket bra och personalen var vänlig. Lokalen var ren och mysig.',
      qualityScore: {
        authenticity: 85,
        concreteness: 78,
        depth: 82,
        total: 82
      },
      categories: ['service', 'quality', 'atmosphere'],
      sentiment: 0.8,
      createdAt: new Date(),
      ...overrides
    };
  }

  static generatePayment(overrides = {}) {
    return {
      id: `payment-${crypto.randomUUID()}`,
      sessionId: `session-${crypto.randomUUID()}`,
      amount: 20.00, // 8% of 250 SEK
      currency: 'SEK',
      status: 'completed',
      stripeTransferId: `tr_${crypto.randomUUID()}`,
      processingTime: 750, // milliseconds
      createdAt: new Date(),
      ...overrides
    };
  }

  static generateQRCode(overrides = {}) {
    return {
      id: `qr-${crypto.randomUUID()}`,
      businessId: `business-${crypto.randomUUID()}`,
      locationId: `location-${crypto.randomUUID()}`,
      encryptedData: crypto.randomBytes(32).toString('hex'),
      version: 1,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      ...overrides
    };
  }
}

/**
 * Mock external services
 */
class MockServices {
  static createOllamaMock() {
    return {
      isAvailable: jest.fn().mockResolvedValue(true),
      
      generateResponse: jest.fn().mockImplementation((prompt) => {
        if (prompt.includes('quality score') || prompt.includes('kvalitet')) {
          return Promise.resolve(JSON.stringify({
            authenticity: 85,
            concreteness: 78,
            depth: 82,
            total: 82
          }));
        }
        return Promise.resolve('Tack för din feedback! Det var mycket användbart.');
      }),
      
      evaluateFeedback: jest.fn().mockResolvedValue({
        authenticity: 85,
        concreteness: 78,
        depth: 82,
        total: 82,
        reasoning: 'Feedback shows authentic experience with specific details'
      })
    };
  }

  static createStripeMock() {
    return {
      accounts: {
        create: jest.fn().mockResolvedValue({ id: 'acct_test_123' }),
        retrieve: jest.fn().mockResolvedValue({ 
          id: 'acct_test_123', 
          charges_enabled: true,
          payouts_enabled: true 
        }),
        update: jest.fn().mockResolvedValue({ id: 'acct_test_123' })
      },
      
      transfers: {
        create: jest.fn().mockResolvedValue({ 
          id: 'tr_test_123', 
          amount: 2000, // 20.00 SEK in öre
          currency: 'sek',
          destination: 'acct_test_123'
        })
      },
      
      webhooks: {
        constructEvent: jest.fn().mockReturnValue({
          type: 'account.updated',
          data: { object: { id: 'acct_test_123' } }
        })
      }
    };
  }

  static createSquareMock() {
    return {
      paymentsApi: {
        listPayments: jest.fn().mockResolvedValue({
          result: {
            payments: [{
              id: 'test-payment-001',
              amountMoney: { amount: 25000, currency: 'SEK' },
              createdAt: new Date().toISOString(),
              locationId: 'test-location-001'
            }]
          }
        }),
        
        getPayment: jest.fn().mockResolvedValue({
          result: {
            payment: {
              id: 'test-payment-001',
              amountMoney: { amount: 25000, currency: 'SEK' },
              createdAt: new Date().toISOString(),
              locationId: 'test-location-001'
            }
          }
        })
      },

      locationsApi: {
        listLocations: jest.fn().mockResolvedValue({
          result: {
            locations: [{
              id: 'test-location-001',
              name: 'Test Café Stockholm',
              address: {
                locality: 'Stockholm',
                postalCode: '11122',
                country: 'SE'
              }
            }]
          }
        })
      }
    };
  }

  static createShopifyMock() {
    return {
      order: {
        list: jest.fn().mockResolvedValue([{
          id: 'test-order-001',
          total_price: '250.00',
          created_at: new Date().toISOString(),
          financial_status: 'paid',
          location_id: 'test-location-001'
        }]),
        
        get: jest.fn().mockResolvedValue({
          id: 'test-order-001',
          total_price: '250.00',
          created_at: new Date().toISOString(),
          financial_status: 'paid'
        })
      },

      shop: {
        get: jest.fn().mockResolvedValue({
          id: 'test-shop-001',
          name: 'Test Café Shop',
          domain: 'test-cafe.myshopify.com'
        })
      }
    };
  }

  static createZettleMock() {
    return {
      purchases: {
        list: jest.fn().mockResolvedValue({
          purchases: [{
            uuid: 'test-purchase-001',
            amount: 25000, // 250.00 SEK in öre
            currency: 'SEK',
            timestamp: new Date().toISOString(),
            organizationUuid: 'test-org-001'
          }]
        }),
        
        get: jest.fn().mockResolvedValue({
          uuid: 'test-purchase-001',
          amount: 25000,
          currency: 'SEK',
          timestamp: new Date().toISOString()
        })
      },

      organizations: {
        get: jest.fn().mockResolvedValue({
          uuid: 'test-org-001',
          name: 'Test Café AB',
          taxationType: 'TAXIS',
          country: 'SE'
        })
      }
    };
  }

  static createWhisperMock() {
    return {
      transcribe: jest.fn().mockResolvedValue({
        transcript: 'Jag tyckte kaffet var mycket bra och personalen var vänlig.',
        confidence: 0.95,
        language: 'sv',
        segments: [{
          start: 0,
          end: 5.2,
          text: 'Jag tyckte kaffet var mycket bra och personalen var vänlig.'
        }]
      })
    };
  }

  static createTTSMock() {
    return {
      synthesize: jest.fn().mockResolvedValue(Buffer.from('mock-audio-data')),
      
      getVoices: jest.fn().mockResolvedValue([
        { name: 'sv-SE-SofiaNeural', language: 'sv-SE', gender: 'female' }
      ])
    };
  }
}

/**
 * Test database utilities
 */
class TestDatabase {
  static async cleanDatabase() {
    // Mock database cleanup
    console.log('🧹 Cleaning test database...');
    return Promise.resolve();
  }

  static async seedTestData() {
    // Mock seeding test data
    console.log('🌱 Seeding test data...');
    return Promise.resolve({
      businesses: 3,
      sessions: 10,
      feedbacks: 15,
      payments: 12
    });
  }

  static createMockSupabaseClient() {
    return {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      then: jest.fn().mockResolvedValue({ data: [], error: null })
    };
  }
}

/**
 * Test assertions
 */
class TestAssertions {
  static expectValidUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(value).toMatch(uuidRegex);
  }

  static expectValidSEKAmount(amount) {
    expect(amount).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(amount)).toBe(true);
    expect(Number.isInteger(amount * 100)).toBe(true); // Check öre precision
  }

  static expectValidQualityScore(score) {
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    expect(Number.isFinite(score)).toBe(true);
  }

  static expectValidTimestamp(timestamp) {
    expect(timestamp).toBeInstanceOf(Date);
    expect(timestamp.getTime()).toBeGreaterThan(0);
  }

  static expectValidSwedishOrgNumber(orgNumber) {
    const orgNumberRegex = /^\d{6}-\d{4}$/;
    expect(orgNumber).toMatch(orgNumberRegex);
  }
}

/**
 * Performance testing utilities
 */
class PerformanceHelpers {
  static async measureExecutionTime(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();
    const executionTimeMs = Number(end - start) / 1000000;
    
    return {
      result,
      executionTime: executionTimeMs
    };
  }

  static expectResponseTime(executionTime, maxMs) {
    expect(executionTime).toBeLessThanOrEqual(maxMs);
  }
}

module.exports = {
  TestDataFactory,
  MockServices,
  TestDatabase,
  TestAssertions,
  PerformanceHelpers
};