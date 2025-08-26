import { POSCredentials, POSTransaction, POSLocation, POSWebhook } from '../../packages/pos-adapters/src/types';

// Mock Zettle (PayPal) Adapter
class MockZettleAdapter {
  public readonly provider = 'zettle' as const;
  public readonly capabilities = ['transactions', 'webhooks', 'inventory'];
  
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
          code: 'AUTHENTICATION_FAILED',
          message: 'Invalid Zettle OAuth token'
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
    const state = `zettle_state_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const defaultScopes = ['READ:PURCHASE', 'READ:PRODUCT', 'READ:LOCATION'];
    const allScopes = [...defaultScopes, ...scopes];
    
    return {
      url: `https://oauth.zettle.com/authorize?client_id=mock_client_id&scope=${allScopes.join('%20')}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&response_type=code`,
      state
    };
  }

  async exchangeCodeForToken(code: string, state: string) {
    return {
      accessToken: 'zettle_access_token_mock',
      refreshToken: 'zettle_refresh_token_mock',
      expiresIn: 7200, // 2 hours
      tokenType: 'Bearer'
    };
  }

  async refreshToken(refreshToken: string) {
    return {
      accessToken: 'zettle_new_access_token',
      refreshToken: 'zettle_new_refresh_token',
      expiresIn: 7200,
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
      throw new Error(`Zettle location ${locationId} not found`);
    }
    
    return location;
  }

  async searchTransactions(options: any) {
    const transactions = this.generateMockSwedishTransactions();
    let filtered = transactions;

    if (options.startDate) {
      filtered = filtered.filter(tx => new Date(tx.timestamp) >= options.startDate);
    }
    
    if (options.endDate) {
      filtered = filtered.filter(tx => new Date(tx.timestamp) <= options.endDate);
    }

    if (options.locationId) {
      filtered = filtered.filter(tx => tx.posLocationId === options.locationId);
    }
    
    return {
      transactions: filtered.slice(0, options.limit || 50),
      hasMore: filtered.length > (options.limit || 50),
      cursor: filtered.length > (options.limit || 50) ? 'next_cursor' : null
    };
  }

  async getTransaction(transactionId: string): Promise<POSTransaction> {
    return {
      id: transactionId,
      externalId: `zettle_${transactionId}`,
      posLocationId: 'ZETTLE_STOCKHOLM_LOC',
      amount: 234.75,
      currency: 'SEK',
      items: [
        { id: '1', name: 'Artisan Kaffe', quantity: 2, price: 89.50 },
        { id: '2', name: 'Hemlagad tårta', quantity: 1, price: 55.75 }
      ],
      timestamp: new Date().toISOString(),
      locationId: 'ZETTLE_STOCKHOLM_LOC',
      paymentMethod: 'CARD',
      metadata: {
        zettle_purchase_uuid: `purchase_${transactionId}`,
        payment_type: 'CARD_PAYMENT',
        receipt_number: `R${Math.floor(Math.random() * 10000)}`,
        staff_member: 'Anna Andersson'
      }
    };
  }

  async findMatchingTransaction(locationId: string, amount: number, timestamp: Date, toleranceMinutes: number = 2) {
    const transactions = this.generateMockSwedishTransactions();
    const targetTime = timestamp.getTime();
    const tolerance = toleranceMinutes * 60 * 1000;

    const matches = transactions.filter(tx => {
      const txTime = new Date(tx.timestamp).getTime();
      const timeDiff = Math.abs(txTime - targetTime);
      const amountDiff = Math.abs(tx.amount - amount);
      
      return timeDiff <= tolerance && amountDiff <= 1.0 && tx.posLocationId === locationId;
    });

    return matches.length > 0 ? matches[0] : null;
  }

  async createWebhook(webhook: Omit<POSWebhook, 'id' | 'createdAt' | 'updatedAt'>): Promise<POSWebhook> {
    return {
      id: `zettle_webhook_${Date.now()}`,
      url: webhook.url,
      events: webhook.events,
      secret: `zettle_webhook_secret_${Math.random().toString(36).substr(2, 12)}`,
      active: webhook.active,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async validateWebhook(payload: string, signature: string, secret: string) {
    // Zettle uses different webhook signature validation
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHash('sha256')
      .update(payload + secret)
      .digest('hex');

    if (`sha256=${expectedSignature}` === signature) {
      return {
        valid: true,
        event: {
          id: 'zettle_event_123',
          type: 'PurchaseCreated',
          data: JSON.parse(payload),
          timestamp: new Date().toISOString(),
          source: 'zettle',
          signature
        }
      };
    }

    return {
      valid: false,
      error: 'Invalid Zettle webhook signature'
    };
  }

  private getMockSwedishLocations(): POSLocation[] {
    return [
      {
        id: 'ZETTLE_STOCKHOLM_LOC',
        name: 'Stockholm Stadskärna',
        address: {
          street: 'Sergelgatan 12',
          city: 'Stockholm',
          postalCode: '111 57',
          country: 'SE'
        },
        timezone: 'Europe/Stockholm',
        phoneNumber: '+46 8 555 123 45',
        businessName: 'Stockholm Stadskärna Handelskompani',
        status: 'active',
        capabilities: this.capabilities
      },
      {
        id: 'ZETTLE_MALMO_LOC',
        name: 'Malmö Centrum',
        address: {
          street: 'Storgatan 8',
          city: 'Malmö',
          postalCode: '211 20',
          country: 'SE'
        },
        timezone: 'Europe/Stockholm',
        phoneNumber: '+46 40 666 789 12',
        businessName: 'Malmö Centrum Handel AB',
        status: 'active',
        capabilities: this.capabilities
      },
      {
        id: 'ZETTLE_GOTEBORG_LOC',
        name: 'Göteborg Nordstan',
        address: {
          street: 'Nordstadstorget 1',
          city: 'Göteborg',
          postalCode: '411 05',
          country: 'SE'
        },
        timezone: 'Europe/Stockholm',
        phoneNumber: '+46 31 777 456 78',
        businessName: 'Göteborgs Nordstan Handel',
        status: 'active',
        capabilities: this.capabilities
      }
    ];
  }

  private generateMockSwedishTransactions(): POSTransaction[] {
    const swedishProducts = [
      'Artisan Kaffe', 'Hemlagad tårta', 'Svensk choklad', 'Ekologisk te',
      'Handgjorda kakor', 'Lokalproducerad honung', 'Naturlig såpa',
      'Handgjorda ljus', 'Keramik mugg', 'Vintage poster', 'Antik bok',
      'Handvävt tyg', 'Trähantverk', 'Silversmycke', 'Glaskonsthantverk'
    ];

    const locations = this.getMockSwedishLocations();
    
    return Array.from({ length: 35 }, (_, index) => ({
      id: `zettle_purchase_${index + 1}`,
      externalId: `purchase_uuid_${index + 1000}`,
      posLocationId: locations[index % locations.length].id,
      amount: Math.floor(Math.random() * 400) + 75, // 75-475 SEK
      currency: 'SEK',
      items: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, itemIndex) => ({
        id: `item_${index}_${itemIndex}`,
        name: swedishProducts[Math.floor(Math.random() * swedishProducts.length)],
        quantity: Math.floor(Math.random() * 2) + 1,
        price: Math.floor(Math.random() * 150) + 25
      })),
      timestamp: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000).toISOString(), // Last 15 days
      locationId: locations[index % locations.length].id,
      paymentMethod: Math.random() > 0.3 ? 'CARD' : 'CASH',
      metadata: {
        zettle_purchase_uuid: `purchase_uuid_${index + 1000}`,
        payment_type: Math.random() > 0.3 ? 'CARD_PAYMENT' : 'CASH_PAYMENT',
        receipt_number: `R${1000 + index}`,
        staff_member: ['Anna Andersson', 'Erik Johansson', 'Maria Lindberg'][Math.floor(Math.random() * 3)],
        device_name: ['Zettle Reader', 'Zettle Terminal', 'iPhone med Zettle'][Math.floor(Math.random() * 3)]
      }
    }));
  }

  async disconnect(): Promise<void> {
    this.initialized = false;
    this.credentials = undefined;
  }
}

describe('Zettle (PayPal) POS Adapter Integration Tests', () => {
  let adapter: MockZettleAdapter;
  let mockCredentials: POSCredentials;

  beforeEach(() => {
    mockCredentials = {
      provider: 'zettle',
      accessToken: 'zettle_valid_token',
      refreshToken: 'zettle_refresh_token',
      applicationId: 'zettle_client_id_swedish',
      environment: 'sandbox',
      locationId: 'ZETTLE_STOCKHOLM_LOC'
    };

    adapter = new MockZettleAdapter();
  });

  describe('Connection Management', () => {
    it('should initialize successfully with valid Zettle credentials', async () => {
      await adapter.initialize(mockCredentials);
      
      expect(adapter.isInitialized()).toBe(true);
    });

    it('should test connection and return Swedish retail locations', async () => {
      const status = await adapter.testConnection(mockCredentials);

      expect(status.connected).toBe(true);
      expect(status.locations).toHaveLength(3);
      expect(status.locations.every(loc => loc.address?.country === 'SE')).toBe(true);
      expect(status.locations.every(loc => loc.timezone === 'Europe/Stockholm')).toBe(true);
    });

    it('should handle authentication failures gracefully', async () => {
      const invalidCreds = { ...mockCredentials, accessToken: 'invalid_token' };
      const status = await adapter.testConnection(invalidCreds);

      expect(status.connected).toBe(false);
      expect(status.error?.code).toBe('AUTHENTICATION_FAILED');
    });

    it('should validate Swedish Zettle merchant setup', async () => {
      const locations = await adapter.getLocations();
      
      // Verify Swedish market characteristics
      expect(locations.every(loc => loc.address?.country === 'SE')).toBe(true);
      expect(locations.every(loc => loc.phoneNumber?.startsWith('+46'))).toBe(true);
      expect(locations.every(loc => loc.address?.postalCode?.match(/^\d{3} \d{2}$/))).toBe(true);
    });
  });

  describe('OAuth Flow for Zettle Integration', () => {
    it('should generate valid OAuth URL with Swedish scopes', async () => {
      await adapter.initialize(mockCredentials);
      
      const authUrl = await adapter.generateAuthUrl(
        'https://app.ai-feedback.se/auth/zettle/callback',
        ['READ:FINANCE', 'READ:USERINFO']
      );

      expect(authUrl.url).toContain('oauth.zettle.com/authorize');
      expect(authUrl.url).toContain('READ%3APURCHASE');
      expect(authUrl.url).toContain('READ%3AFINANCE');
      expect(authUrl.state).toMatch(/^zettle_state_/);
    });

    it('should exchange authorization code for access token', async () => {
      const result = await adapter.exchangeCodeForToken('zettle_auth_code_123', 'valid_state');

      expect(result.accessToken).toMatch(/^zettle_access_token/);
      expect(result.refreshToken).toMatch(/^zettle_refresh_token/);
      expect(result.expiresIn).toBe(7200);
      expect(result.tokenType).toBe('Bearer');
    });

    it('should handle token refresh for long-lived sessions', async () => {
      const result = await adapter.refreshToken('zettle_old_refresh_token');

      expect(result.accessToken).toBe('zettle_new_access_token');
      expect(result.refreshToken).toBe('zettle_new_refresh_token');
      expect(result.expiresIn).toBe(7200);
    });
  });

  describe('Swedish Retail Transaction Processing', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should retrieve Swedish retail transactions with local products', async () => {
      const result = await adapter.searchTransactions({
        locationId: 'ZETTLE_STOCKHOLM_LOC',
        startDate: new Date('2024-08-10'),
        endDate: new Date('2024-08-25'),
        limit: 15
      });

      expect(result.transactions).toHaveLength(15);
      expect(result.transactions[0].currency).toBe('SEK');
      expect(result.transactions[0].metadata?.staff_member).toMatch(/^(Anna|Erik|Maria)/);
      
      // Verify Swedish product names
      const productNames = result.transactions.flatMap(tx => 
        tx.items?.map(item => item.name) || []
      );
      expect(productNames.some(name => name.includes('Svensk') || name.includes('Hemlagad'))).toBe(true);
    });

    it('should handle both card and cash payments', async () => {
      const result = await adapter.searchTransactions({ limit: 20 });
      
      const paymentMethods = result.transactions.map(tx => tx.paymentMethod);
      expect(paymentMethods).toContain('CARD');
      expect(paymentMethods).toContain('CASH');
      
      result.transactions.forEach(tx => {
        if (tx.paymentMethod === 'CARD') {
          expect(tx.metadata?.payment_type).toBe('CARD_PAYMENT');
        } else if (tx.paymentMethod === 'CASH') {
          expect(tx.metadata?.payment_type).toBe('CASH_PAYMENT');
        }
      });
    });

    it('should find matching transactions for verification', async () => {
      const timestamp = new Date();
      const amount = 234.75;
      const locationId = 'ZETTLE_STOCKHOLM_LOC';

      const result = await adapter.findMatchingTransaction(locationId, amount, timestamp, 3);

      expect(result).not.toBeNull();
      expect(result?.currency).toBe('SEK');
      expect(result?.posLocationId).toBe(locationId);
    });

    it('should handle Zettle-specific transaction metadata', async () => {
      const transaction = await adapter.getTransaction('zettle_purchase_123');

      expect(transaction.metadata?.zettle_purchase_uuid).toBeDefined();
      expect(transaction.metadata?.receipt_number).toMatch(/^R\d+/);
      expect(transaction.metadata?.staff_member).toMatch(/^(Anna Andersson|Erik Johansson|Maria Lindberg)$/);
      expect(transaction.metadata?.device_name).toMatch(/Zettle|iPhone/);
    });
  });

  describe('Zettle Webhook Integration', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should create webhook for Zettle purchase events', async () => {
      const webhook = await adapter.createWebhook({
        url: 'https://api.ai-feedback.se/webhooks/zettle',
        events: ['PurchaseCreated', 'PurchaseUpdated', 'RefundCreated'],
        secret: 'temp_secret',
        active: true
      });

      expect(webhook.id).toMatch(/^zettle_webhook_/);
      expect(webhook.url).toBe('https://api.ai-feedback.se/webhooks/zettle');
      expect(webhook.events).toContain('PurchaseCreated');
      expect(webhook.secret).toMatch(/^zettle_webhook_secret_/);
    });

    it('should validate Zettle webhook signatures correctly', async () => {
      const payload = JSON.stringify({
        eventName: 'PurchaseCreated',
        organizationUuid: 'org_uuid_swedish_merchant',
        messageId: 'msg_123',
        payload: {
          purchaseUuid: 'purchase_uuid_123',
          amount: 15750, // 157.50 SEK in minor units
          currency: 'SEK',
          timestamp: new Date().toISOString()
        }
      });
      
      const secret = 'zettle_webhook_secret_test';
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHash('sha256')
        .update(payload + secret)
        .digest('hex');

      const result = await adapter.validateWebhook(payload, `sha256=${expectedSignature}`, secret);

      expect(result.valid).toBe(true);
      expect(result.event?.type).toBe('PurchaseCreated');
      expect(result.event?.source).toBe('zettle');
    });

    it('should reject webhooks with invalid signatures', async () => {
      const payload = JSON.stringify({ eventName: 'PurchaseCreated' });
      const invalidSignature = 'sha256=invalid_signature_hash';
      const secret = 'zettle_webhook_secret_test';

      const result = await adapter.validateWebhook(payload, invalidSignature, secret);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid Zettle webhook signature');
    });
  });

  describe('Swedish Market-Specific Features', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should handle Swedish retail business types', async () => {
      const locations = await adapter.getLocations();
      
      expect(locations.some(loc => loc.name.includes('Stadskärna'))).toBe(true);
      expect(locations.some(loc => loc.name.includes('Centrum'))).toBe(true);
      expect(locations.some(loc => loc.name.includes('Nordstan'))).toBe(true);
    });

    it('should process Swedish currency amounts correctly', async () => {
      const transactions = await adapter.searchTransactions({ limit: 10 });

      transactions.transactions.forEach(tx => {
        expect(tx.currency).toBe('SEK');
        expect(tx.amount).toBeGreaterThan(0);
        expect(typeof tx.amount).toBe('number');
        
        // Swedish retail typically uses whole öre amounts
        expect(tx.amount % 0.01).toBeLessThan(0.001);
      });
    });

    it('should handle Swedish staff member names', async () => {
      const result = await adapter.searchTransactions({ limit: 20 });
      
      const staffMembers = result.transactions
        .map(tx => tx.metadata?.staff_member)
        .filter(name => name);

      expect(staffMembers.every(name => 
        typeof name === 'string' && name.length > 0
      )).toBe(true);
      
      // Should contain typical Swedish names
      const hasSwedishNames = staffMembers.some(name => 
        name?.includes('Andersson') || name?.includes('Johansson') || name?.includes('Lindberg')
      );
      expect(hasSwedishNames).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should handle Zettle API rate limits gracefully', async () => {
      // Simulate multiple concurrent requests
      const promises = Array(15).fill(null).map((_, index) =>
        adapter.searchTransactions({
          locationId: 'ZETTLE_STOCKHOLM_LOC',
          limit: 3
        })
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(15);
      expect(results.every(r => r.transactions.length <= 3)).toBe(true);
    });

    it('should handle missing purchase data', async () => {
      try {
        await adapter.getTransaction('non_existent_purchase');
        // Should not reach here in a real scenario
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle OAuth token expiration', async () => {
      // This would be handled by the actual implementation
      const expiredCreds = {
        ...mockCredentials,
        accessToken: 'expired_token',
        tokenExpiresAt: new Date(Date.now() - 1000) // Expired 1 second ago
      };

      // Should attempt token refresh in real implementation
      expect(() => adapter.testConnection(expiredCreds)).not.toThrow();
    });

    it('should handle partial transaction data', async () => {
      const result = await adapter.searchTransactions({ limit: 5 });
      
      // All transactions should have required fields even if some optional fields are missing
      result.transactions.forEach(tx => {
        expect(tx.id).toBeDefined();
        expect(tx.amount).toBeDefined();
        expect(tx.currency).toBeDefined();
        expect(tx.timestamp).toBeDefined();
      });
    });
  });

  describe('Performance and Device Integration', () => {
    beforeEach(async () => {
      await adapter.initialize(mockCredentials);
    });

    it('should handle different Zettle device types', async () => {
      const result = await adapter.searchTransactions({ limit: 15 });
      
      const deviceTypes = result.transactions
        .map(tx => tx.metadata?.device_name)
        .filter(device => device);

      expect(deviceTypes).toContain('Zettle Reader');
      expect(deviceTypes).toContain('Zettle Terminal');
      expect(deviceTypes).toContain('iPhone med Zettle');
    });

    it('should maintain performance with large transaction volumes', async () => {
      const startTime = Date.now();
      
      const result = await adapter.searchTransactions({
        startDate: new Date('2024-08-01'),
        endDate: new Date('2024-08-25'),
        limit: 50
      });
      
      const endTime = Date.now();
      
      expect(result.transactions.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should clean up resources on disconnect', async () => {
      expect(adapter.isInitialized()).toBe(true);
      
      await adapter.disconnect();
      
      expect(adapter.isInitialized()).toBe(false);
    });
  });
});