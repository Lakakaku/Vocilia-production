// Global setup for Jest tests
// Runs once before all test suites

module.exports = async () => {
  console.log('🚀 Starting Jest global setup for AI Feedback Platform...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TZ = 'Europe/Stockholm'; // Swedish timezone for consistency
  
  // Mock external services for testing
  console.log('📝 Setting up mock services...');
  
  // Start any test services here if needed
  // For example, in-memory Redis or test database
  
  // Initialize test data factories
  global.testData = {
    business: {
      id: 'test-business-001',
      name: 'Test Café Stockholm',
      orgNumber: '556677-8899',
      tier: 1
    },
    
    session: {
      id: 'test-session-001',
      sessionToken: 'test-token-12345',
      qrCodeId: 'test-qr-001',
      transactionId: 'test-txn-001',
      purchaseAmount: 250.00,
      purchaseTime: new Date('2024-08-26T10:00:00Z'),
      customerHash: 'test-customer-hash-001'
    },
    
    feedback: {
      transcript: 'Jag tyckte kaffet var mycket bra och personalen var vänlig. Lokalen var ren och mysig.',
      qualityScore: {
        authenticity: 85,
        concreteness: 78,
        depth: 82,
        total: 82
      }
    }
  };
  
  // Mock Ollama service
  global.mockOllamaService = {
    isAvailable: jest.fn().mockResolvedValue(true),
    generateResponse: jest.fn().mockImplementation((prompt) => {
      if (prompt.includes('quality score')) {
        return Promise.resolve(JSON.stringify(global.testData.feedback.qualityScore));
      }
      return Promise.resolve('Tack för din feedback! Det var mycket användbart.');
    }),
    evaluateFeedback: jest.fn().mockResolvedValue(global.testData.feedback.qualityScore)
  };
  
  // Mock Stripe service
  global.mockStripeService = {
    createAccount: jest.fn().mockResolvedValue({ id: 'acct_test_123' }),
    createTransfer: jest.fn().mockResolvedValue({ id: 'tr_test_123', amount: 2000 }),
    retrieveAccount: jest.fn().mockResolvedValue({ 
      id: 'acct_test_123', 
      charges_enabled: true,
      payouts_enabled: true 
    })
  };
  
  // Mock POS Adapters
  global.mockPOSAdapters = {
    square: {
      authenticate: jest.fn().mockResolvedValue(true),
      getTransaction: jest.fn().mockResolvedValue({
        id: 'test-txn-001',
        amount_money: { amount: 25000, currency: 'SEK' },
        created_at: '2024-08-26T10:00:00Z'
      }),
      listLocations: jest.fn().mockResolvedValue([
        { id: 'test-loc-001', name: 'Test Café Stockholm', address: { locality: 'Stockholm' } }
      ])
    },
    
    shopify: {
      authenticate: jest.fn().mockResolvedValue(true),
      getOrder: jest.fn().mockResolvedValue({
        id: 'test-order-001',
        total_price: '250.00',
        created_at: '2024-08-26T10:00:00Z',
        financial_status: 'paid'
      }),
      listShops: jest.fn().mockResolvedValue([
        { id: 'test-shop-001', name: 'Test Café Shop' }
      ])
    }
  };
  
  // Mock voice processing services
  global.mockVoiceServices = {
    whisperX: {
      transcribe: jest.fn().mockResolvedValue({
        transcript: global.testData.feedback.transcript,
        confidence: 0.95,
        language: 'sv'
      })
    },
    
    tts: {
      synthesize: jest.fn().mockResolvedValue(Buffer.from('mock-audio-data'))
    }
  };
  
  console.log('✅ Jest global setup complete');
};