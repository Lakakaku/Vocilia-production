import { SquareAdapter } from '../../packages/pos-adapters/src/adapters/square/SquareAdapter';
import { SquareMockData } from '../../packages/pos-adapters/src/adapters/square/SquareMockData';
import { POSCredentials, POSTransaction, POSLocation } from '../../packages/pos-adapters/src/types';
import { SquareAPIClient } from '../../packages/pos-adapters/src/adapters/square/SquareAPIClient';

// Mock the Square API Client
jest.mock('../../packages/pos-adapters/src/adapters/square/SquareAPIClient');

describe('Square POS Adapter Integration Tests', () => {
  let adapter: SquareAdapter;
  let mockData: SquareMockData;
  let mockCredentials: POSCredentials;
  let mockApiClient: jest.Mocked<SquareAPIClient>;

  beforeEach(() => {
    mockCredentials = {
      provider: 'square',
      accessToken: 'mock_access_token',
      refreshToken: 'mock_refresh_token',
      applicationId: 'mock_app_id',
      environment: 'sandbox',
      locationId: 'AURORA_STOCKHOLM_LOC'
    };

    adapter = new SquareAdapter();
    mockData = new SquareMockData();
    
    // Create mock API client
    mockApiClient = new SquareAPIClient(mockCredentials as any) as jest.Mocked<SquareAPIClient>;
    (SquareAPIClient as jest.MockedClass<typeof SquareAPIClient>).mockImplementation(() => mockApiClient);

    // Setup default mock implementations
    mockApiClient.initialize.mockResolvedValue();
    mockApiClient.getMerchant.mockResolvedValue({
      id: 'MERCHANT_123',
      business_name: 'Aurora Café Stockholm',
      country: 'SE',
      language_code: 'sv-SE',
      currency: 'SEK',
      status: 'ACTIVE'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should successfully initialize with valid Swedish credentials', async () => {
      const locations = mockData.getAllBusinesses().map(b => mockData.generateSquareLocation(b));
      mockApiClient.getLocations.mockResolvedValue(locations);

      await adapter.initialize(mockCredentials);
      
      expect(adapter.isInitialized()).toBe(true);
      expect(mockApiClient.initialize).toHaveBeenCalledTimes(1);
    });

    it('should test connection and return valid status for Swedish business', async () => {
      const swedishLocations = mockData.getAllBusinesses().map(b => mockData.generateSquareLocation(b));
      mockApiClient.getLocations.mockResolvedValue(swedishLocations);

      const status = await adapter.testConnection(mockCredentials);

      expect(status.connected).toBe(true);
      expect(status.locations.length).toBeGreaterThan(0);
      expect(status.locations[0].address?.country).toBe('SE');
      expect(status.capabilities).toContain('transactions');
    });

    it('should handle connection failures gracefully', async () => {
      mockApiClient.getMerchant.mockRejectedValue(new Error('Network timeout'));

      const status = await adapter.testConnection(mockCredentials);

      expect(status.connected).toBe(false);
      expect(status.error?.code).toBe('CONNECTION_FAILED');
      expect(status.error?.retryable).toBe(true);
    });

    it('should validate Swedish business requirements', async () => {
      const swedishBusiness = mockData.getBusinessByLocation('AURORA_STOCKHOLM_LOC');
      const location = mockData.generateSquareLocation(swedishBusiness!);
      mockApiClient.getLocation.mockResolvedValue(location);

      const result = await adapter.getLocation('AURORA_STOCKHOLM_LOC');

      expect(result.address?.country).toBe('SE');
      expect(result.timezone).toBe('Europe/Stockholm');
      expect(result.businessName).toBe('Aurora Café Stockholm');
    });
  });

  describe('OAuth Flow Testing', () => {
    it('should generate valid OAuth URL for Swedish market', async () => {
      const redirectUri = 'https://app.ai-feedback.se/auth/callback';
      const scopes = ['PAYMENTS_READ', 'MERCHANT_PROFILE_READ'];

      const authUrl = await adapter.generateAuthUrl(redirectUri, scopes);

      expect(authUrl.url).toContain('connect.squareupsandbox.com/oauth2/authorize');
      expect(authUrl.url).toContain('PAYMENTS_READ');
      expect(authUrl.url).toContain('MERCHANT_PROFILE_READ');
      expect(authUrl.state).toBeDefined();
    });

    it('should exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: new Date(Date.now() + 7200000).toISOString(), // 2 hours
        token_type: 'bearer',
        merchant_id: 'MERCHANT_123'
      };

      mockApiClient.exchangeOAuthCode.mockResolvedValue(mockTokenResponse);

      const result = await adapter.exchangeCodeForToken('auth_code_123', 'valid_state');

      expect(result.accessToken).toBe('new_access_token');
      expect(result.refreshToken).toBe('new_refresh_token');
      expect(result.tokenType).toBe('bearer');
    });

    it('should refresh expired tokens', async () => {
      const mockRefreshResponse = {
        access_token: 'refreshed_access_token',
        refresh_token: 'new_refresh_token',
        expires_at: new Date(Date.now() + 7200000).toISOString(),
        token_type: 'bearer'
      };

      mockApiClient.refreshOAuthToken.mockResolvedValue(mockRefreshResponse);

      const result = await adapter.refreshToken('expired_refresh_token');

      expect(result.accessToken).toBe('refreshed_access_token');
      expect(mockApiClient.refreshOAuthToken).toHaveBeenCalledWith('expired_refresh_token');
    });
  });

  describe('Swedish Transaction Retrieval', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should retrieve transactions with Swedish currency and products', async () => {
      const swedishTransactions = mockData.generateSwedishTransactions(10, 'AURORA_STOCKHOLM_LOC');
      const mockPayments = swedishTransactions.map(tx => ({
        id: tx.id,
        created_at: tx.timestamp,
        total_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        amount_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        status: 'COMPLETED',
        location_id: 'AURORA_STOCKHOLM_LOC',
        source_type: 'CARD'
      }));

      mockApiClient.searchPayments.mockResolvedValue({
        payments: mockPayments,
        cursor: null
      });

      const result = await adapter.searchTransactions({
        locationId: 'AURORA_STOCKHOLM_LOC',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-08-25')
      });

      expect(result.transactions).toHaveLength(10);
      expect(result.transactions[0].currency).toBe('SEK');
      expect(result.transactions[0].amount).toBeGreaterThan(0);
    });

    it('should find matching transaction within time tolerance', async () => {
      const timestamp = new Date('2024-08-25T10:30:00.000Z');
      const amount = 87.50; // 87.50 SEK
      
      const matchingTransaction = mockData.generateVerificationTransaction(
        'AURORA_STOCKHOLM_LOC',
        amount,
        timestamp,
        ['Kaffe', 'Kanelbulle']
      );

      const mockPayment = {
        id: matchingTransaction.id,
        created_at: matchingTransaction.timestamp,
        total_money: { amount: Math.round(matchingTransaction.amount * 100), currency: 'SEK' },
        amount_money: { amount: Math.round(matchingTransaction.amount * 100), currency: 'SEK' },
        status: 'COMPLETED',
        location_id: 'AURORA_STOCKHOLM_LOC',
        source_type: 'CARD'
      };

      mockApiClient.searchPayments.mockResolvedValue({
        payments: [mockPayment],
        cursor: null
      });

      const result = await adapter.findMatchingTransaction(
        'AURORA_STOCKHOLM_LOC',
        amount,
        timestamp,
        2 // 2 minute tolerance
      );

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(amount);
      expect(new Date(result!.timestamp)).toEqual(timestamp);
    });

    it('should handle transaction search with Swedish business context', async () => {
      const locationId = 'ICA_VASASTAN_LOC';
      const groceryTransactions = mockData.generateSwedishTransactions(5, locationId);
      
      const mockPayments = groceryTransactions.map(tx => ({
        id: tx.id,
        created_at: tx.timestamp,
        total_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        amount_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        status: 'COMPLETED',
        location_id: locationId,
        source_type: 'CARD',
        order_id: `ORDER_${tx.id}`
      }));

      const mockOrders = groceryTransactions.map(tx => ({
        id: `ORDER_${tx.id}`,
        line_items: tx.items?.map((item, index) => ({
          uid: `ITEM_${index}`,
          name: item,
          quantity: '1',
          base_price_money: { amount: Math.round((tx.amount / (tx.items?.length || 1)) * 100), currency: 'SEK' }
        })) || []
      }));

      mockApiClient.searchPayments.mockResolvedValue({
        payments: mockPayments,
        orders: mockOrders,
        cursor: null
      });

      const result = await adapter.searchTransactions({
        locationId,
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-08-25')
      });

      expect(result.transactions).toHaveLength(5);
      expect(result.transactions[0].items?.length).toBeGreaterThan(0);
      expect(result.transactions[0].items?.[0].name).toMatch(/^(Mjölk|Bröd|Smör|Ost|Äpplen)/);
    });
  });

  describe('Webhook Management', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should create webhook subscription for Swedish business', async () => {
      const mockWebhookResponse = {
        id: 'WEBHOOK_123',
        name: 'AI Feedback Platform Webhook',
        event_types: ['payment.created', 'payment.updated'],
        notification_url: 'https://api.ai-feedback.se/webhooks/square',
        signature_key: 'webhook_signature_key_123',
        enabled: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        api_version: '2023-10-18'
      };

      mockApiClient.createWebhookSubscription.mockResolvedValue(mockWebhookResponse);

      const webhook = await adapter.createWebhook({
        url: 'https://api.ai-feedback.se/webhooks/square',
        events: ['payment.created', 'payment.updated'],
        secret: 'temp_secret',
        active: true
      });

      expect(webhook.id).toBe('WEBHOOK_123');
      expect(webhook.url).toBe('https://api.ai-feedback.se/webhooks/square');
      expect(webhook.secret).toBe('webhook_signature_key_123');
    });

    it('should validate webhook signatures correctly', async () => {
      const payload = JSON.stringify({
        event_id: 'EVENT_123',
        type: 'payment.created',
        data: { payment: { id: 'PAYMENT_123', amount: 8750, currency: 'SEK' } },
        created_at: new Date().toISOString()
      });
      const secret = 'webhook_secret_key';
      
      // Calculate expected signature using the same algorithm as the adapter
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(payload)
        .digest('base64');

      const result = await adapter.validateWebhook(payload, expectedSignature, secret);

      expect(result.valid).toBe(true);
      expect(result.event?.type).toBe('payment.created');
      expect(result.event?.source).toBe('square');
    });

    it('should reject invalid webhook signatures', async () => {
      const payload = JSON.stringify({ event: 'test' });
      const invalidSignature = 'invalid_signature';
      const secret = 'webhook_secret_key';

      const result = await adapter.validateWebhook(payload, invalidSignature, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });
  });

  describe('Location Mapping for Swedish Businesses', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should map Square locations to Swedish business locations', async () => {
      const businessId = 'BUSINESS_AURORA_CAFE';
      const swedishLocations = mockData.getAllBusinesses().map(b => mockData.generateSquareLocation(b));
      
      mockApiClient.getLocations.mockResolvedValue(swedishLocations);

      const result = await adapter.initializeLocationMapping(businessId);

      expect(result.discovered).toBeGreaterThan(0);
      expect(result.mapped).toBeDefined();
      expect(result.requiresVerification).toBeDefined();
    });

    it('should handle Swedish address formatting correctly', async () => {
      const business = mockData.getBusinessByLocation('AURORA_STOCKHOLM_LOC');
      const location = mockData.generateSquareLocation(business!);
      
      mockApiClient.getLocation.mockResolvedValue(location);

      const result = await adapter.getLocation('AURORA_STOCKHOLM_LOC');

      expect(result.address?.country).toBe('SE');
      expect(result.address?.postalCode).toMatch(/^\d{3} \d{2}$/); // Swedish postal code format
      expect(result.address?.city).toMatch(/^(Stockholm|Göteborg|Malmö|Lund)$/);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      (rateLimitError as any).headers = { 'retry-after': '60' };

      mockApiClient.searchPayments.mockRejectedValueOnce(rateLimitError);

      expect(adapter.isRetryableError(rateLimitError)).toBe(true);
      expect(adapter.getRetryDelay(1)).toBeGreaterThan(0);
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout');
      (timeoutError as any).code = 'ECONNABORTED';

      mockApiClient.getTransaction.mockRejectedValueOnce(timeoutError);

      await expect(adapter.getTransaction('PAYMENT_123')).rejects.toThrow();
      expect(adapter.isRetryableError(timeoutError)).toBe(true);
    });

    it('should handle expired OAuth tokens', async () => {
      const unauthorizedError = new Error('Unauthorized');
      (unauthorizedError as any).status = 401;

      mockApiClient.getMerchant.mockRejectedValueOnce(unauthorizedError);

      const status = await adapter.testConnection(mockCredentials);
      expect(status.connected).toBe(false);
      expect(status.error?.code).toBe('CONNECTION_FAILED');
    });

    it('should handle malformed transaction data', async () => {
      const malformedPayment = {
        id: 'PAYMENT_123',
        created_at: 'invalid_date',
        total_money: null,
        location_id: 'LOCATION_123'
      };

      mockApiClient.searchPayments.mockResolvedValue({
        payments: [malformedPayment],
        cursor: null
      });

      const result = await adapter.searchTransactions({
        locationId: 'LOCATION_123'
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].amount).toBe(0); // Should default to 0
      expect(result.transactions[0].currency).toBe('SEK'); // Should default to SEK
    });
  });

  describe('Performance and Caching', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should cache transaction results for performance', async () => {
      const locationId = 'AURORA_STOCKHOLM_LOC';
      const startTime = new Date('2024-08-25T10:00:00Z');
      const endTime = new Date('2024-08-25T11:00:00Z');
      
      const swedishTransactions = mockData.generateTransactionsForTimeWindow(
        locationId,
        startTime,
        endTime,
        5
      );

      const mockPayments = swedishTransactions.map(tx => ({
        id: tx.id,
        created_at: tx.timestamp,
        total_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        amount_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        status: 'COMPLETED',
        location_id: locationId,
        source_type: 'CARD'
      }));

      mockApiClient.searchPayments.mockResolvedValue({
        payments: mockPayments,
        cursor: null
      });

      // First call should hit API
      const result1 = await adapter.getTransactionsInTimeWindow(locationId, startTime, endTime);
      
      // Second call should use cache
      const result2 = await adapter.getTransactionsInTimeWindow(locationId, startTime, endTime);

      expect(result1).toEqual(result2);
      expect(mockApiClient.searchPayments).toHaveBeenCalledTimes(1); // Only called once due to caching
    });

    it('should handle concurrent transaction requests', async () => {
      const locationId = 'AURORA_STOCKHOLM_LOC';
      const transactions = mockData.generateSwedishTransactions(20, locationId);
      
      const mockPayments = transactions.map(tx => ({
        id: tx.id,
        created_at: tx.timestamp,
        total_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        amount_money: { amount: Math.round(tx.amount * 100), currency: 'SEK' },
        status: 'COMPLETED',
        location_id: locationId,
        source_type: 'CARD'
      }));

      mockApiClient.searchPayments.mockResolvedValue({
        payments: mockPayments,
        cursor: null
      });

      const promises = Array(10).fill(null).map(() =>
        adapter.searchTransactions({
          locationId,
          startDate: new Date('2024-08-01'),
          endDate: new Date('2024-08-25')
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r.transactions.length === 20)).toBe(true);
    });
  });

  describe('Swedish Business Context Integration', () => {
    it('should validate Swedish organization numbers', async () => {
      const businesses = mockData.getAllBusinesses();
      
      businesses.forEach(business => {
        expect(business.orgNumber).toMatch(/^\d{6}-\d{4}$/); // Swedish org number format
      });
    });

    it('should handle Swedish phone number formats', async () => {
      const business = mockData.getBusinessByLocation('AURORA_STOCKHOLM_LOC');
      const location = mockData.generateSquareLocation(business!);
      
      expect(location.phone_number).toMatch(/^\+46 \d{2,3} \d{3} \d{2} \d{2}$/);
    });

    it('should process Swedish product names correctly', async () => {
      const transactions = mockData.generateSwedishTransactions(10, 'AURORA_STOCKHOLM_LOC');
      
      transactions.forEach(tx => {
        tx.items?.forEach(item => {
          expect(typeof item).toBe('string');
          expect(item.length).toBeGreaterThan(0);
          // Should contain Swedish product names
          expect(['Kaffe', 'Kanelbulle', 'Cappuccino', 'Latte', 'Smörgås'].some(product => 
            item.includes(product)
          )).toBeTruthy();
        });
      });
    });
  });
});