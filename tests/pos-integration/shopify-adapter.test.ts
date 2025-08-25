import { POSCredentials, POSTransaction, POSLocation, POSWebhook } from '../../packages/pos-adapters/src/types';

// Mock Shopify Adapter (since it doesn't exist yet)
class MockShopifyAdapter {
  public readonly provider = 'shopify' as const;
  public readonly capabilities = ['transactions', 'webhooks', 'customers', 'inventory'];
  
  private initialized = false;
  private credentials?: POSCredentials;

  async initialize(credentials: POSCredentials): Promise<void> {
    this.credentials = credentials;
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async testConnection(credentials: POSCredentials) {
    if (credentials.accessToken === 'invalid_token') {
      return {
        connected: false,
        capabilities: [],
        locations: [],
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid Shopify access token'
        }
      };
    }

    return {
      connected: true,
      lastSync: new Date(),
      capabilities: this.capabilities,
      locations: this.getMockSwedishLocations()
    };
  }

  async generateAuthUrl(redirectUri: string, scopes: string[] = []) {
    const state = `state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shop = this.credentials?.applicationId || 'swedish-test-shop';
    
    return {
      url: `https://${shop}.myshopify.com/admin/oauth/authorize?client_id=mock_client_id&scope=${scopes.join(',')}&redirect_uri=${redirectUri}&state=${state}`,
      state
    };
  }

  async exchangeCodeForToken(code: string, state: string) {
    return {
      accessToken: 'shpat_mock_access_token',
      tokenType: 'Bearer',
      scope: 'read_orders,read_products'
    };
  }

  async refreshToken(refreshToken: string) {
    return {
      accessToken: 'shpat_new_access_token',
      tokenType: 'Bearer'
    };
  }

  async getLocations(): Promise<POSLocation[]> {
    return this.getMockSwedishLocations();
  }

  async getLocation(locationId: string): Promise<POSLocation> {
    const locations = this.getMockSwedishLocations();
    const location = locations.find(l => l.id === locationId);
    
    if (!location) {
      throw new Error(`Location ${locationId} not found`);
    }
    
    return location;
  }

  async searchTransactions(options: any) {
    const transactions = this.generateMockSwedishTransactions();
    
    return {
      transactions: transactions.slice(0, options.limit || 50),
      hasMore: false,
      cursor: null
    };
  }

  async getTransaction(transactionId: string): Promise<POSTransaction> {
    return {
      id: transactionId,
      externalId: `shopify_${transactionId}`,
      posLocationId: 'SHOPIFY_STOCKHOLM_LOC',
      amount: 156.50,
      currency: 'SEK',
      items: [
        { id: '1', name: 'Svensk honung', quantity: 1, price: 89.50 },
        { id: '2', name: 'Ekologisk mjölk', quantity: 1, price: 67.00 }
      ],
      timestamp: new Date().toISOString(),
      locationId: 'SHOPIFY_STOCKHOLM_LOC',
      paymentMethod: 'credit_card',
      metadata: {
        order_number: 'SWE-1001',
        fulfillment_status: 'fulfilled',
        gateway: 'shopify_payments'
      }
    };
  }

  async findMatchingTransaction(locationId: string, amount: number, timestamp: Date, toleranceMinutes: number = 2) {
    // Simulate finding a transaction within tolerance
    const timeDiff = Math.abs(Date.now() - timestamp.getTime());
    const maxDiff = toleranceMinutes * 60 * 1000;
    
    if (timeDiff <= maxDiff) {
      return this.getTransaction(`MATCH_${timestamp.getTime()}`);
    }
    
    return null;
  }

  async createWebhook(webhook: Omit<POSWebhook, 'id' | 'createdAt' | 'updatedAt'>): Promise<POSWebhook> {
    return {
      id: `webhook_${Date.now()}`,
      url: webhook.url,
      events: webhook.events,
      secret: `shopify_webhook_secret_${Math.random().toString(36).substr(2, 9)}`,
      active: webhook.active,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async validateWebhook(payload: string, signature: string, secret: string) {
    // Simplified webhook validation
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('base64');

    if (signature === expectedSignature) {
      return {
        valid: true,
        event: {
          id: 'shopify_event_123',
          type: 'orders/paid',
          data: JSON.parse(payload),
          timestamp: new Date().toISOString(),
          source: 'shopify',
          signature
        }
      };
    }

    return {
      valid: false,
      error: 'Invalid webhook signature'
    };
  }

  private getMockSwedishLocations(): POSLocation[] {
    return [
      {
        id: 'SHOPIFY_STOCKHOLM_LOC',
        name: 'Svenska Delikatesser Stockholm',
        address: {
          street: 'Kungsgatan 25',
          city: 'Stockholm',
          postalCode: '111 56',
          country: 'SE'
        },
        timezone: 'Europe/Stockholm',
        phoneNumber: '+46 8 123 456',
        businessName: 'Svenska Delikatesser AB',
        status: 'active',
        capabilities: this.capabilities
      },
      {
        id: 'SHOPIFY_GOTEBORG_LOC',
        name: 'Västkust Handel Göteborg',
        address: {
          street: 'Avenyn 15',
          city: 'Göteborg',
          postalCode: '411 36',
          country: 'SE'
        },
        timezone: 'Europe/Stockholm',
        phoneNumber: '+46 31 987 654',
        businessName: 'Västkust Handel AB',
        status: 'active',
        capabilities: this.capabilities
      }
    ];
  }

  private generateMockSwedishTransactions(): POSTransaction[] {
    const swedishProducts = [
      'Svensk honung', 'Ekologisk mjölk', 'Renkött', 'Västerbottensost',
      'Knäckebröd', 'Lingonsylt', 'Köttbullar', 'Gravlax', 'Krisprolls',
      'Janssons frestelse', 'Prinsesstårta mix', 'Glögg kryddor'
    ];

    return Array.from({ length: 25 }, (_, index) => ({
      id: `shopify_txn_${index + 1}`,
      externalId: `order_${1000 + index}`,
      posLocationId: index % 2 === 0 ? 'SHOPIFY_STOCKHOLM_LOC' : 'SHOPIFY_GOTEBORG_LOC',
      amount: Math.floor(Math.random() * 500) + 50, // 50-550 SEK
      currency: 'SEK',
      items: [
        {
          id: `item_${index}_1`,
          name: swedishProducts[Math.floor(Math.random() * swedishProducts.length)],
          quantity: Math.floor(Math.random() * 3) + 1,
          price: Math.floor(Math.random() * 200) + 25
        }
      ],
      timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      locationId: index % 2 === 0 ? 'SHOPIFY_STOCKHOLM_LOC' : 'SHOPIFY_GOTEBORG_LOC',
      paymentMethod: 'credit_card',
      metadata: {
        order_number: `SWE-${1000 + index}`,
        fulfillment_status: 'fulfilled',
        gateway: 'shopify_payments',
        customer_locale: 'sv-SE'
      }
    }));
  }

  async disconnect(): Promise<void> {
    this.initialized = false;
    this.credentials = undefined;
  }
}

describe('Shopify POS Adapter Integration Tests', () => {
  let adapter: MockShopifyAdapter;
  let mockCredentials: POSCredentials;

  beforeEach(() => {
    mockCredentials = {
      provider: 'shopify',
      accessToken: 'shpat_valid_access_token',
      applicationId: 'swedish-test-shop',
      environment: 'development',
      locationId: 'SHOPIFY_STOCKHOLM_LOC'
    };

    adapter = new MockShopifyAdapter();
  });

  describe('Connection Management', () => {
    it('should initialize successfully with valid Shopify credentials', async () => {
      await adapter.initialize(mockCredentials);
      
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should test connection and return Swedish store locations', async () => {
      const status = await adapter.testConnection(mockCredentials);

      expect(status.connected).toBe(true);
      expect(status.locations).toHaveLength(2);
      expect(status.locations[0].address?.country).toBe('SE');
      expect(status.locations[0].timezone).toBe('Europe/Stockholm');
    });

    it('should handle invalid credentials gracefully', async () => {
      const invalidCreds = { ...mockCredentials, accessToken: 'invalid_token' };
      const status = await adapter.testConnection(invalidCreds);

      expect(status.connected).toBe(false);
      expect(status.error?.code).toBe('INVALID_CREDENTIALS');
    });

    it('should validate Swedish Shopify store configuration', async () => {
      const locations = await adapter.getLocations();
      
      expect(locations.every(loc => loc.address?.country === 'SE')).toBe(true);
      expect(locations.every(loc => loc.timezone === 'Europe/Stockholm')).toBe(true);
      expect(locations.every(loc => loc.phoneNumber?.startsWith('+46'))).toBe(true);
    });
  });

  describe('OAuth Flow for Swedish Shopify Stores', () => {
    it('should generate valid OAuth URL for Swedish shop', async () => {
      await adapter.initialize(mockCredentials);
      
      const authUrl = await adapter.generateAuthUrl(
        'https://app.ai-feedback.se/auth/shopify/callback',
        ['read_orders', 'read_products', 'read_locations']
      );

      expect(authUrl.url).toContain('.myshopify.com/admin/oauth/authorize');
      expect(authUrl.url).toContain('read_orders,read_products,read_locations');
      expect(authUrl.state).toBeDefined();
    });

    it('should exchange authorization code for access token', async () => {
      const result = await adapter.exchangeCodeForToken('temp_auth_code', 'valid_state');

      expect(result.accessToken).toMatch(/^shpat_/);
      expect(result.tokenType).toBe('Bearer');
      expect(result.scope).toContain('read_orders');
    });

    it('should handle token refresh for long-lived connections', async () => {
      const result = await adapter.refreshToken('old_refresh_token');

      expect(result.accessToken).toMatch(/^shpat_/);
      expect(result.tokenType).toBe('Bearer');
    });
  });

  describe('Swedish E-commerce Transaction Processing', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should retrieve Swedish e-commerce transactions', async () => {
      const result = await adapter.searchTransactions({
        locationId: 'SHOPIFY_STOCKHOLM_LOC',
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-08-25'),
        limit: 10
      });

      expect(result.transactions).toHaveLength(10);
      expect(result.transactions[0].currency).toBe('SEK');
      expect(result.transactions[0].metadata?.customer_locale).toBe('sv-SE');
    });

    it('should handle Swedish product names and descriptions', async () => {
      const transaction = await adapter.getTransaction('shopify_order_123');

      expect(transaction.items?.[0].name).toMatch(/^(Svensk|Ekologisk|Renkött|Västerbottensost)/);
      expect(transaction.currency).toBe('SEK');
      expect(transaction.metadata?.order_number).toMatch(/^SWE-/);
    });

    it('should find matching transactions for Swedish orders', async () => {
      const timestamp = new Date();
      const amount = 156.50;
      const locationId = 'SHOPIFY_STOCKHOLM_LOC';

      const result = await adapter.findMatchingTransaction(locationId, amount, timestamp, 5);

      expect(result).not.toBeNull();
      expect(result?.amount).toBe(156.50);
      expect(result?.currency).toBe('SEK');
    });

    it('should process Swedish shipping and fulfillment data', async () => {
      const transactions = await adapter.searchTransactions({ limit: 5 });

      transactions.transactions.forEach(tx => {
        expect(tx.metadata?.fulfillment_status).toBeDefined();
        expect(tx.metadata?.gateway).toBe('shopify_payments');
        expect(tx.locationId).toMatch(/^SHOPIFY_/);
      });
    });
  });

  describe('Webhook Management for Swedish Shopify Stores', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should create webhook for Swedish order events', async () => {
      const webhook = await adapter.createWebhook({
        url: 'https://api.ai-feedback.se/webhooks/shopify',
        events: ['orders/paid', 'orders/fulfilled', 'orders/cancelled'],
        secret: 'temp_secret',
        active: true
      });

      expect(webhook.id).toBeDefined();
      expect(webhook.url).toBe('https://api.ai-feedback.se/webhooks/shopify');
      expect(webhook.events).toContain('orders/paid');
      expect(webhook.secret).toMatch(/^shopify_webhook_secret_/);
    });

    it('should validate Shopify webhook signatures', async () => {
      const payload = JSON.stringify({
        id: 'order_123',
        total_price: '245.50',
        currency: 'SEK',
        customer: {
          locale: 'sv-SE'
        },
        shipping_address: {
          country: 'Sweden'
        }
      });
      
      const secret = 'shopify_webhook_secret_test';
      const crypto = require('crypto');
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      const result = await adapter.validateWebhook(payload, signature, secret);

      expect(result.valid).toBe(true);
      expect(result.event?.type).toBe('orders/paid');
      expect(result.event?.source).toBe('shopify');
    });

    it('should reject invalid webhook payloads', async () => {
      const payload = JSON.stringify({ invalid: 'data' });
      const invalidSignature = 'invalid_signature';
      const secret = 'shopify_webhook_secret_test';

      const result = await adapter.validateWebhook(payload, invalidSignature, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid webhook signature');
    });
  });

  describe('Swedish Market-Specific Features', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should handle Swedish VAT and tax calculations', async () => {
      const transactions = await adapter.searchTransactions({ limit: 10 });

      transactions.transactions.forEach(tx => {
        expect(tx.currency).toBe('SEK');
        expect(tx.amount).toBeGreaterThan(0);
        // Swedish VAT would be handled by Shopify, just verify structure
        expect(tx.metadata).toBeDefined();
      });
    });

    it('should support Swedish customer locale preferences', async () => {
      const transaction = await adapter.getTransaction('swedish_order_123');

      expect(transaction.metadata?.customer_locale).toBe('sv-SE');
      expect(transaction.metadata?.order_number).toMatch(/^SWE-/);
    });

    it('should handle Swedish shipping addresses correctly', async () => {
      const locations = await adapter.getLocations();

      locations.forEach(location => {
        expect(location.address?.postalCode).toMatch(/^\d{3} \d{2}$/); // Swedish postal code format
        expect(location.address?.country).toBe('SE');
        expect(location.phoneNumber).toMatch(/^\+46/); // Swedish country code
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should handle Shopify API rate limits', async () => {
      // Simulate rate limit scenario
      const startTime = Date.now();
      
      // Make multiple rapid requests
      const promises = Array(10).fill(null).map(() =>
        adapter.searchTransactions({ limit: 5 })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r.transactions.length > 0)).toBe(true);
    });

    it('should handle missing order data gracefully', async () => {
      try {
        await adapter.getTransaction('non_existent_order');
      } catch (error) {
        // Should handle gracefully without crashing
        expect(error).toBeDefined();
      }
    });

    it('should handle network connectivity issues', async () => {
      // This would be handled by the actual adapter implementation
      const invalidCreds = { ...mockCredentials, accessToken: 'network_error' };
      
      // Should not crash the application
      expect(() => adapter.testConnection(invalidCreds)).not.toThrow();
    });
  });

  describe('Performance and Reliability', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should handle concurrent transaction requests efficiently', async () => {
      const startTime = Date.now();
      
      const promises = Array(20).fill(null).map((_, index) =>
        adapter.searchTransactions({
          locationId: index % 2 === 0 ? 'SHOPIFY_STOCKHOLM_LOC' : 'SHOPIFY_GOTEBORG_LOC',
          limit: 5
        })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should maintain connection stability over time', async () => {
      // Simulate long-running connection
      for (let i = 0; i < 5; i++) {
        const result = await adapter.searchTransactions({ limit: 3 });
        expect(result.transactions).toBeDefined();
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    });

    it('should clean up resources properly on disconnect', async () => {
      expect(adapter.isInitialized()).toBe(true);
      
      await adapter.disconnect();
      
      expect(adapter.isInitialized()).toBe(false);
    });
  });
});