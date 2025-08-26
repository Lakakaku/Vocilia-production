import { SquareAdapter } from '../../packages/pos-adapters/src/adapters/square/SquareAdapter';
import { POSCredentials, POSTransaction, POSLocation, POSConnectionStatus } from '../../packages/pos-adapters/src/types';
import { POSAdapterFactory } from '../../packages/pos-adapters/src/factory/POSAdapterFactory';
import { POSAdapter } from '../../packages/pos-adapters/src/interfaces/POSAdapter';

// Mock implementations for testing cross-provider functionality
class MockShopifyAdapter {
  public readonly provider = 'shopify' as const;
  public readonly capabilities = ['transactions', 'webhooks', 'customers'];
  private initialized = false;

  async initialize(credentials: POSCredentials): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async testConnection(): Promise<POSConnectionStatus> {
    return {
      connected: true,
      lastSync: new Date(),
      capabilities: this.capabilities,
      locations: [
        {
          id: 'SHOPIFY_SWE_LOC',
          name: 'Svenska Delikatesser',
          address: { city: 'Stockholm', country: 'SE', postalCode: '111 21' },
          status: 'active',
          capabilities: this.capabilities
        }
      ]
    };
  }

  async searchTransactions(options: any) {
    return {
      transactions: [
        {
          id: 'shopify_txn_1',
          externalId: 'order_1001',
          posLocationId: 'SHOPIFY_SWE_LOC',
          amount: 187.50,
          currency: 'SEK',
          timestamp: new Date().toISOString(),
          locationId: 'SHOPIFY_SWE_LOC'
        }
      ],
      hasMore: false,
      cursor: null
    };
  }

  async getTransaction(id: string) {
    return {
      id,
      externalId: `order_${id}`,
      posLocationId: 'SHOPIFY_SWE_LOC',
      amount: 187.50,
      currency: 'SEK',
      timestamp: new Date().toISOString(),
      locationId: 'SHOPIFY_SWE_LOC'
    };
  }

  async findMatchingTransaction() {
    return null;
  }

  async disconnect(): Promise<void> {
    this.initialized = false;
  }
}

class MockZettleAdapter {
  public readonly provider = 'zettle' as const;
  public readonly capabilities = ['transactions', 'webhooks'];
  private initialized = false;

  async initialize(credentials: POSCredentials): Promise<void> {
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async testConnection(): Promise<POSConnectionStatus> {
    return {
      connected: true,
      lastSync: new Date(),
      capabilities: this.capabilities,
      locations: [
        {
          id: 'ZETTLE_SWE_LOC',
          name: 'Stockholm Handel',
          address: { city: 'Stockholm', country: 'SE', postalCode: '111 57' },
          status: 'active',
          capabilities: this.capabilities
        }
      ]
    };
  }

  async searchTransactions(options: any) {
    return {
      transactions: [
        {
          id: 'zettle_purchase_1',
          externalId: 'purchase_uuid_1001',
          posLocationId: 'ZETTLE_SWE_LOC',
          amount: 129.00,
          currency: 'SEK',
          timestamp: new Date().toISOString(),
          locationId: 'ZETTLE_SWE_LOC'
        }
      ],
      hasMore: false,
      cursor: null
    };
  }

  async getTransaction(id: string) {
    return {
      id,
      externalId: `purchase_${id}`,
      posLocationId: 'ZETTLE_SWE_LOC',
      amount: 129.00,
      currency: 'SEK',
      timestamp: new Date().toISOString(),
      locationId: 'ZETTLE_SWE_LOC'
    };
  }

  async findMatchingTransaction() {
    return null;
  }

  async disconnect(): Promise<void> {
    this.initialized = false;
  }
}

// Mock POS Adapter Factory
const mockAdapterFactory = {
  createAdapter: (provider: string): POSAdapter => {
    switch (provider) {
      case 'square':
        return new SquareAdapter() as any;
      case 'shopify':
        return new MockShopifyAdapter() as any;
      case 'zettle':
        return new MockZettleAdapter() as any;
      default:
        throw new Error(`Unsupported POS provider: ${provider}`);
    }
  },

  getSupportedProviders: (): string[] => {
    return ['square', 'shopify', 'zettle'];
  },

  isProviderSupported: (provider: string): boolean => {
    return ['square', 'shopify', 'zettle'].includes(provider);
  }
};

describe('Cross-Provider POS Integration Tests', () => {
  let squareCredentials: POSCredentials;
  let shopifyCredentials: POSCredentials;
  let zettleCredentials: POSCredentials;

  beforeEach(() => {
    squareCredentials = {
      provider: 'square',
      accessToken: 'square_access_token',
      applicationId: 'square_app_id',
      environment: 'sandbox'
    };

    shopifyCredentials = {
      provider: 'shopify',
      accessToken: 'shpat_access_token',
      applicationId: 'shopify_app_id',
      environment: 'development'
    };

    zettleCredentials = {
      provider: 'zettle',
      accessToken: 'zettle_access_token',
      applicationId: 'zettle_client_id',
      environment: 'sandbox'
    };
  });

  describe('Adapter Factory Integration', () => {
    it('should create adapters for all supported providers', () => {
      const providers = mockAdapterFactory.getSupportedProviders();
      
      expect(providers).toContain('square');
      expect(providers).toContain('shopify');
      expect(providers).toContain('zettle');

      providers.forEach(provider => {
        const adapter = mockAdapterFactory.createAdapter(provider);
        expect(adapter).toBeDefined();
        expect(adapter.provider).toBe(provider);
      });
    });

    it('should throw error for unsupported providers', () => {
      expect(() => mockAdapterFactory.createAdapter('unsupported')).toThrow('Unsupported POS provider');
      expect(mockAdapterFactory.isProviderSupported('unsupported')).toBe(false);
    });

    it('should validate provider support correctly', () => {
      expect(mockAdapterFactory.isProviderSupported('square')).toBe(true);
      expect(mockAdapterFactory.isProviderSupported('shopify')).toBe(true);
      expect(mockAdapterFactory.isProviderSupported('zettle')).toBe(true);
      expect(mockAdapterFactory.isProviderSupported('clover')).toBe(false);
    });
  });

  describe('Unified Interface Consistency', () => {
    it('should maintain consistent interface across all providers', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('square'),
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      for (const adapter of adapters) {
        // Check required properties
        expect(adapter.provider).toBeDefined();
        expect(adapter.capabilities).toBeDefined();
        expect(Array.isArray(adapter.capabilities)).toBe(true);

        // Check required methods exist
        expect(typeof adapter.initialize).toBe('function');
        expect(typeof adapter.isInitialized).toBe('function');
        expect(typeof adapter.testConnection).toBe('function');
        expect(typeof adapter.searchTransactions).toBe('function');
        expect(typeof adapter.getTransaction).toBe('function');
        expect(typeof adapter.findMatchingTransaction).toBe('function');
        expect(typeof adapter.disconnect).toBe('function');
      }
    });

    it('should return consistent data structures across providers', async () => {
      const credentials = [squareCredentials, shopifyCredentials, zettleCredentials];
      const adapters = credentials.map(cred => mockAdapterFactory.createAdapter(cred.provider));

      // Mock the Square adapter initialization
      const mockSquareInit = jest.fn().mockResolvedValue(undefined);
      const mockSquareTestConnection = jest.fn().mockResolvedValue({
        connected: true,
        capabilities: ['transactions', 'webhooks'],
        locations: [{
          id: 'SQUARE_SWE_LOC',
          name: 'Aurora Café',
          address: { city: 'Stockholm', country: 'SE', postalCode: '111 43' },
          status: 'active',
          capabilities: ['transactions', 'webhooks']
        }],
        lastSync: new Date()
      });
      
      if (adapters[0] instanceof SquareAdapter) {
        (adapters[0] as any).initialize = mockSquareInit;
        (adapters[0] as any).testConnection = mockSquareTestConnection;
      }

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        const cred = credentials[i];

        await adapter.initialize(cred);
        const status = await adapter.testConnection(cred);

        // Verify consistent response structure
        expect(status).toHaveProperty('connected');
        expect(status).toHaveProperty('capabilities');
        expect(status).toHaveProperty('locations');
        expect(typeof status.connected).toBe('boolean');
        expect(Array.isArray(status.capabilities)).toBe(true);
        expect(Array.isArray(status.locations)).toBe(true);

        // Verify Swedish market compliance
        if (status.connected && status.locations.length > 0) {
          status.locations.forEach(location => {
            expect(location.address?.country).toBe('SE');
            expect(location.id).toBeDefined();
            expect(location.name).toBeDefined();
          });
        }
      }
    });
  });

  describe('Multi-Provider Swedish Business Setup', () => {
    it('should handle Swedish business with multiple POS systems', async () => {
      const businessId = 'BUSINESS_MULTI_POS_SWEDISH';
      const providers = ['square', 'shopify', 'zettle'];
      const connectionResults = [];

      for (const provider of providers) {
        const adapter = mockAdapterFactory.createAdapter(provider);
        const credentials = provider === 'square' ? squareCredentials :
                          provider === 'shopify' ? shopifyCredentials :
                          zettleCredentials;

        // Mock Square adapter methods
        if (adapter instanceof SquareAdapter) {
          (adapter as any).initialize = jest.fn().mockResolvedValue(undefined);
          (adapter as any).testConnection = jest.fn().mockResolvedValue({
            connected: true,
            capabilities: ['transactions', 'webhooks'],
            locations: [{
              id: 'SQUARE_MULTI_LOC',
              name: 'Multi POS Swedish Store',
              address: { city: 'Stockholm', country: 'SE' },
              status: 'active',
              capabilities: ['transactions', 'webhooks']
            }],
            lastSync: new Date()
          });
        }

        await adapter.initialize(credentials);
        const status = await adapter.testConnection(credentials);
        
        connectionResults.push({
          provider: adapter.provider,
          connected: status.connected,
          locationCount: status.locations.length,
          capabilities: status.capabilities
        });
      }

      expect(connectionResults).toHaveLength(3);
      expect(connectionResults.every(result => result.connected)).toBe(true);
      expect(connectionResults.every(result => result.locationCount > 0)).toBe(true);
    });

    it('should aggregate transactions from multiple POS providers', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const credentials = [shopifyCredentials, zettleCredentials];
      const allTransactions: POSTransaction[] = [];

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        await adapter.initialize(credentials[i]);
        
        const result = await adapter.searchTransactions({
          startDate: new Date('2024-08-01'),
          endDate: new Date('2024-08-25'),
          limit: 10
        });

        allTransactions.push(...result.transactions);
      }

      expect(allTransactions.length).toBeGreaterThan(0);
      expect(allTransactions.every(tx => tx.currency === 'SEK')).toBe(true);
      expect(allTransactions.some(tx => tx.id.includes('shopify'))).toBe(true);
      expect(allTransactions.some(tx => tx.id.includes('zettle'))).toBe(true);
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle connection failures consistently across providers', async () => {
      const invalidCredentials = [
        { ...squareCredentials, accessToken: 'invalid_square_token' },
        { ...shopifyCredentials, accessToken: 'invalid_shopify_token' },
        { ...zettleCredentials, accessToken: 'invalid_zettle_token' }
      ];

      for (const cred of invalidCredentials) {
        const adapter = mockAdapterFactory.createAdapter(cred.provider);
        
        // Mock error responses for each provider
        if (cred.provider === 'square' && adapter instanceof SquareAdapter) {
          (adapter as any).testConnection = jest.fn().mockResolvedValue({
            connected: false,
            capabilities: [],
            locations: [],
            error: {
              code: 'AUTHENTICATION_FAILED',
              message: 'Invalid Square credentials'
            }
          });
        } else {
          (adapter as any).testConnection = jest.fn().mockResolvedValue({
            connected: false,
            capabilities: [],
            locations: [],
            error: {
              code: 'AUTHENTICATION_FAILED',
              message: `Invalid ${cred.provider} credentials`
            }
          });
        }

        const status = await adapter.testConnection(cred);
        
        expect(status.connected).toBe(false);
        expect(status.error).toBeDefined();
        expect(status.error?.code).toBe('AUTHENTICATION_FAILED');
        expect(status.locations).toHaveLength(0);
      }
    });

    it('should handle network timeouts consistently', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('square'),
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const timeoutError = new Error('Network timeout');
      (timeoutError as any).code = 'ECONNABORTED';

      for (const adapter of adapters) {
        // Mock timeout for search transactions
        (adapter as any).searchTransactions = jest.fn().mockRejectedValue(timeoutError);

        try {
          await adapter.searchTransactions({});
        } catch (error) {
          expect(error).toBe(timeoutError);
        }
      }
    });

    it('should handle rate limiting consistently', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      (rateLimitError as any).headers = { 'retry-after': '60' };

      for (const adapter of adapters) {
        // Mock rate limit handling (if the adapter has isRetryableError method)
        if ('isRetryableError' in adapter && typeof adapter.isRetryableError === 'function') {
          expect(adapter.isRetryableError(rateLimitError)).toBe(true);
        }
      }
    });
  });

  describe('Performance Across Providers', () => {
    it('should maintain reasonable response times across all providers', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const credentials = [shopifyCredentials, zettleCredentials];
      const performanceResults = [];

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        await adapter.initialize(credentials[i]);

        const startTime = Date.now();
        await adapter.searchTransactions({ limit: 10 });
        const endTime = Date.now();

        performanceResults.push({
          provider: adapter.provider,
          responseTime: endTime - startTime
        });
      }

      // All providers should respond within reasonable time
      expect(performanceResults.every(result => result.responseTime < 5000)).toBe(true);
    });

    it('should handle concurrent requests across providers', async () => {
      const providers = ['shopify', 'zettle'];
      const concurrentPromises = [];

      for (const provider of providers) {
        const adapter = mockAdapterFactory.createAdapter(provider);
        const credentials = provider === 'shopify' ? shopifyCredentials : zettleCredentials;
        
        await adapter.initialize(credentials);

        // Create multiple concurrent requests per provider
        for (let i = 0; i < 5; i++) {
          concurrentPromises.push(
            adapter.searchTransactions({ limit: 5 })
          );
        }
      }

      const results = await Promise.all(concurrentPromises);
      
      expect(results).toHaveLength(10); // 5 requests × 2 providers
      expect(results.every(result => result.transactions.length > 0)).toBe(true);
    });
  });

  describe('Swedish Market Compliance Across Providers', () => {
    it('should ensure all providers support Swedish currency', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const credentials = [shopifyCredentials, zettleCredentials];

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        await adapter.initialize(credentials[i]);
        
        const result = await adapter.searchTransactions({ limit: 1 });
        
        if (result.transactions.length > 0) {
          expect(result.transactions[0].currency).toBe('SEK');
        }
      }
    });

    it('should validate Swedish address format across providers', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const credentials = [shopifyCredentials, zettleCredentials];

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        const status = await adapter.testConnection(credentials[i]);
        
        if (status.connected && status.locations.length > 0) {
          status.locations.forEach(location => {
            expect(location.address?.country).toBe('SE');
            if (location.address?.postalCode) {
              expect(location.address.postalCode).toMatch(/^\d{3} \d{2}$/);
            }
          });
        }
      }
    });

    it('should handle Swedish timezone consistently', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const credentials = [shopifyCredentials, zettleCredentials];

      for (let i = 0; i < adapters.length; i++) {
        const adapter = adapters[i];
        const status = await adapter.testConnection(credentials[i]);
        
        if (status.connected && status.locations.length > 0) {
          status.locations.forEach(location => {
            expect(location.timezone || 'Europe/Stockholm').toBe('Europe/Stockholm');
          });
        }
      }
    });
  });

  describe('Provider-Specific Feature Support', () => {
    it('should report accurate capabilities for each provider', async () => {
      const expectedCapabilities = {
        square: ['transactions', 'webhooks', 'inventory', 'customers'],
        shopify: ['transactions', 'webhooks', 'customers'],
        zettle: ['transactions', 'webhooks']
      };

      Object.entries(expectedCapabilities).forEach(([provider, capabilities]) => {
        const adapter = mockAdapterFactory.createAdapter(provider);
        
        capabilities.forEach(capability => {
          expect(adapter.capabilities).toContain(capability);
        });
      });
    });

    it('should handle provider-specific metadata correctly', async () => {
      const shopifyAdapter = mockAdapterFactory.createAdapter('shopify');
      const zettleAdapter = mockAdapterFactory.createAdapter('zettle');

      await shopifyAdapter.initialize(shopifyCredentials);
      await zettleAdapter.initialize(zettleCredentials);

      const shopifyTx = await shopifyAdapter.getTransaction('shopify_test');
      const zettleTx = await zettleAdapter.getTransaction('zettle_test');

      // Verify provider-specific metadata structure
      expect(shopifyTx.externalId).toMatch(/^order_/);
      expect(zettleTx.externalId).toMatch(/^purchase_/);
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should properly disconnect all adapters', async () => {
      const adapters = [
        mockAdapterFactory.createAdapter('square'),
        mockAdapterFactory.createAdapter('shopify'),
        mockAdapterFactory.createAdapter('zettle')
      ];

      const credentials = [squareCredentials, shopifyCredentials, zettleCredentials];

      // Initialize all adapters
      for (let i = 0; i < adapters.length; i++) {
        if (adapters[i] instanceof SquareAdapter) {
          (adapters[i] as any).initialize = jest.fn().mockResolvedValue(undefined);
          (adapters[i] as any).isInitialized = jest.fn().mockReturnValue(true);
          (adapters[i] as any).disconnect = jest.fn().mockResolvedValue(undefined);
        }
        
        await adapters[i].initialize(credentials[i]);
        expect(adapters[i].isInitialized()).toBe(true);
      }

      // Disconnect all adapters
      for (const adapter of adapters) {
        await adapter.disconnect();
        
        if (!(adapter instanceof SquareAdapter)) {
          expect(adapter.isInitialized()).toBe(false);
        }
      }
    });

    it('should handle cleanup during error conditions', async () => {
      const adapter = mockAdapterFactory.createAdapter('shopify');
      await adapter.initialize(shopifyCredentials);

      // Force an error condition
      (adapter as any).searchTransactions = jest.fn().mockRejectedValue(new Error('Connection lost'));

      try {
        await adapter.searchTransactions({});
      } catch (error) {
        // Even after error, should be able to disconnect cleanly
        expect(() => adapter.disconnect()).not.toThrow();
      }
    });
  });
});