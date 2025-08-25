import { POSAdapter } from '../../interfaces/POSAdapter';
import { BasePOSAdapter, POSApiError } from '../../base/BasePOSAdapter';
import {
  POSTransaction,
  POSLocation,
  POSCredentials,
  POSConnectionStatus,
  TransactionSearchOptions,
  TransactionSearchResult,
  OAuthAuthorizationUrl,
  OAuthTokenResponse,
  POSWebhook,
  WebhookValidationResult,
  POSCapability,
  TransactionStatus,
  PaymentMethod
} from '../../types';
import {
  ShopifyCredentials,
  ShopifyOrder,
  ShopifyLocation,
  ShopifyShop,
  ShopifyWebhookSubscription,
  ShopifyOAuthResponse,
  ShopifyOrderSearchOptions,
  ShopifyMultiStoreConfig,
  ShopifyPlusStore,
  SHOPIFY_WEBHOOK_TOPICS
} from './types';
import { ShopifyAPIClient } from './ShopifyAPIClient';
import crypto from 'crypto';

/**
 * Shopify POS Adapter
 * 
 * Implements the POSAdapter interface for Shopify and Shopify Plus systems with:
 * - OAuth2 authentication flows
 * - Multi-store support for Shopify Plus
 * - Order/Transaction management
 * - Webhook subscription management
 * - In-store vs online order filtering
 * - Product-level transaction details
 */
export class ShopifyAdapter extends BasePOSAdapter implements POSAdapter {
  public readonly provider = 'shopify' as const;
  public readonly capabilities: POSCapability[] = [
    'transactions',
    'webhooks',
    'inventory',
    'customers',
    'refunds',
    'multi-store'
  ];

  private apiClient?: ShopifyAPIClient;
  private multiStoreConfig?: ShopifyMultiStoreConfig;
  private transactionCache = new Map<string, { data: POSTransaction; expires: Date }>();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super('shopify', ['transactions', 'webhooks', 'inventory', 'customers', 'refunds', 'multi-store']);
  }

  // Connection Management
  async initialize(credentials: POSCredentials): Promise<void> {
    await super.initialize(credentials);
    this.apiClient = new ShopifyAPIClient(credentials as ShopifyCredentials);
    await this.apiClient.initialize();
    
    // Check for multi-store configuration
    if ((credentials as ShopifyCredentials).scopes?.includes('read_all_orders')) {
      await this.initializeMultiStore(credentials as ShopifyCredentials);
    }
  }

  async testConnection(credentials: POSCredentials): Promise<POSConnectionStatus> {
    try {
      const testClient = new ShopifyAPIClient(credentials as ShopifyCredentials);
      await testClient.initialize();
      
      // Test by fetching shop info
      const shop = await testClient.getShop();
      const locations = await testClient.getLocations();

      return {
        connected: true,
        lastSync: new Date(),
        capabilities: this.capabilities,
        locations: locations.map(loc => this.formatLocation(loc)),
        metadata: {
          shopName: shop.name,
          plan: shop.plan_name,
          multiLocationEnabled: shop.multi_location_enabled
        }
      };
    } catch (error) {
      return {
        connected: false,
        capabilities: [],
        locations: [],
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to Shopify API',
          retryable: this.isRetryableError(error)
        }
      };
    }
  }

  protected async validateConnection(): Promise<void> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Shopify API client not initialized'
      });
    }

    try {
      await this.apiClient.getShop();
    } catch (error) {
      throw new POSApiError({
        code: 'CONNECTION_VALIDATION_FAILED',
        message: 'Failed to validate Shopify API connection',
        originalError: error,
        retryable: this.isRetryableError(error)
      });
    }
  }

  // OAuth Flow Implementation
  async generateAuthUrl(redirectUri: string, scopes: string[] = []): Promise<OAuthAuthorizationUrl> {
    const state = this.generateOAuthState('temp-business-id', redirectUri);
    const nonce = this.generateNonce();
    
    const defaultScopes = [
      'read_orders',
      'read_products',
      'read_locations',
      'read_customers',
      'read_merchant_managed_fulfillment_orders',
      'read_assigned_fulfillment_orders'
    ];
    
    // Add write scopes if needed for webhook management
    const webhookScopes = ['write_webhooks', 'read_webhooks'];
    
    const allScopes = [...new Set([...defaultScopes, ...webhookScopes, ...scopes])];
    
    const params = new URLSearchParams({
      client_id: this.getCredentials().apiKey,
      scope: allScopes.join(','),
      redirect_uri: redirectUri,
      state,
      nonce,
      access_mode: 'value' // Permanent access token
    });

    const shopDomain = this.getCredentials().shopDomain;
    const url = `https://${shopDomain}/admin/oauth/authorize?${params.toString()}`;

    return { url, state };
  }

  async exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse> {
    const oauthState = await this.validateState(state);
    
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Shopify API client not initialized'
      });
    }

    try {
      const tokenResponse = await this.apiClient.exchangeCodeForToken(code);
      
      return {
        accessToken: tokenResponse.access_token,
        refreshToken: undefined, // Shopify doesn't use refresh tokens
        expiresIn: tokenResponse.expires_in,
        scope: tokenResponse.scope,
        tokenType: 'Bearer',
        metadata: {
          associatedUser: tokenResponse.associated_user,
          associatedUserScope: tokenResponse.associated_user_scope
        }
      };
    } catch (error) {
      throw new POSApiError({
        code: 'TOKEN_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code for token',
        originalError: error,
        retryable: false
      });
    }
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    // Shopify doesn't support refresh tokens
    throw new POSApiError({
      code: 'NOT_SUPPORTED',
      message: 'Shopify does not support refresh tokens. Access tokens are permanent until revoked.'
    });
  }

  // Location Management
  async getLocations(): Promise<POSLocation[]> {
    this.ensureInitialized();
    
    const locations = await this.apiClient!.getLocations();
    return locations.map(loc => this.formatLocation(loc));
  }

  async getLocation(locationId: string): Promise<POSLocation> {
    this.ensureInitialized();
    
    const location = await this.apiClient!.getLocation(locationId);
    return this.formatLocation(location);
  }

  // Transaction Operations
  async searchTransactions(options: TransactionSearchOptions): Promise<TransactionSearchResult> {
    this.ensureInitialized();
    
    const searchOptions: ShopifyOrderSearchOptions = {
      created_at_min: options.startDate?.toISOString(),
      created_at_max: options.endDate?.toISOString(),
      limit: options.limit || 50,
      page: options.cursor
    };

    if (options.status) {
      searchOptions.financial_status = this.mapTransactionStatus(options.status);
    }

    const orders = await this.apiClient!.searchOrders(searchOptions);
    const transactions = orders.map(order => this.formatTransaction(order));

    return {
      transactions,
      hasMore: orders.length === (options.limit || 50),
      nextCursor: orders.length > 0 ? String(orders[orders.length - 1].id) : undefined,
      totalCount: transactions.length
    };
  }

  async getTransaction(transactionId: string, locationId?: string): Promise<POSTransaction> {
    this.ensureInitialized();
    
    // Check cache first
    const cached = this.transactionCache.get(transactionId);
    if (cached && cached.expires > new Date()) {
      return cached.data;
    }

    const order = await this.apiClient!.getOrder(transactionId);
    const transaction = this.formatTransaction(order);

    // Cache the transaction
    this.transactionCache.set(transactionId, {
      data: transaction,
      expires: new Date(Date.now() + this.cacheExpiryMs)
    });

    return transaction;
  }

  async getTransactionsInTimeWindow(
    locationId: string,
    startTime: Date,
    endTime: Date
  ): Promise<POSTransaction[]> {
    this.ensureInitialized();
    
    const orders = await this.apiClient!.getOrdersInTimeWindow(startTime, endTime, locationId);
    return orders.map(order => this.formatTransaction(order));
  }

  async findMatchingTransaction(
    locationId: string,
    amount: number,
    timestamp: Date,
    toleranceMinutes: number = 5
  ): Promise<POSTransaction | null> {
    this.ensureInitialized();
    
    const startTime = new Date(timestamp.getTime() - toleranceMinutes * 60 * 1000);
    const endTime = new Date(timestamp.getTime() + toleranceMinutes * 60 * 1000);

    const orders = await this.apiClient!.getOrdersInTimeWindow(startTime, endTime, locationId);
    
    // Find order with matching amount
    const matchingOrder = orders.find(order => {
      const orderAmount = parseFloat(order.total_price);
      return Math.abs(orderAmount - amount) < 0.01; // Allow for small rounding differences
    });

    return matchingOrder ? this.formatTransaction(matchingOrder) : null;
  }

  // Webhook Management
  async createWebhook(webhook: Omit<POSWebhook, 'id' | 'createdAt' | 'updatedAt'>): Promise<POSWebhook> {
    this.ensureInitialized();
    
    const subscription = await this.apiClient!.createWebhook(
      webhook.eventTypes[0], // Shopify creates one webhook per topic
      webhook.url
    );

    return this.formatWebhook(subscription);
  }

  async listWebhooks(): Promise<POSWebhook[]> {
    this.ensureInitialized();
    
    const subscriptions = await this.apiClient!.listWebhooks();
    return subscriptions.map(sub => this.formatWebhook(sub));
  }

  async updateWebhook(webhookId: string, updates: Partial<POSWebhook>): Promise<POSWebhook> {
    this.ensureInitialized();
    
    const subscription = await this.apiClient!.updateWebhook(webhookId, {
      address: updates.url,
      fields: updates.metadata?.fields
    });

    return this.formatWebhook(subscription);
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    this.ensureInitialized();
    await this.apiClient!.deleteWebhook(webhookId);
  }

  async validateWebhook(
    payload: string,
    signature: string,
    secret: string
  ): Promise<WebhookValidationResult> {
    try {
      const isValid = this.apiClient!.verifyWebhookSignature(payload, signature);
      
      return {
        valid: isValid,
        event: isValid ? JSON.parse(payload) : undefined
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Failed to validate webhook signature'
      };
    }
  }

  // Multi-store Support (Shopify Plus)
  async initializeMultiStore(credentials: ShopifyCredentials): Promise<void> {
    // This would be extended to support multiple store connections
    // For now, we'll just mark it as a single store config
    this.multiStoreConfig = {
      mainStore: {
        id: credentials.shopDomain,
        domain: credentials.shopDomain,
        myshopifyDomain: credentials.shopDomain,
        name: credentials.shopDomain.split('.')[0],
        accessToken: credentials.accessToken!,
        isMainStore: true
      },
      additionalStores: [],
      syncSettings: {
        syncOrders: true,
        syncInventory: true,
        syncCustomers: true
      }
    };
  }

  async addLinkedStore(storeCredentials: ShopifyCredentials): Promise<void> {
    if (!this.multiStoreConfig) {
      throw new POSApiError({
        code: 'MULTI_STORE_NOT_INITIALIZED',
        message: 'Multi-store configuration not initialized'
      });
    }

    const newStore: ShopifyPlusStore = {
      id: storeCredentials.shopDomain,
      domain: storeCredentials.shopDomain,
      myshopifyDomain: storeCredentials.shopDomain,
      name: storeCredentials.shopDomain.split('.')[0],
      accessToken: storeCredentials.accessToken!,
      isMainStore: false,
      linkedStores: [this.multiStoreConfig.mainStore.id]
    };

    this.multiStoreConfig.additionalStores.push(newStore);
  }

  async getInStoreTransactions(locationId?: string): Promise<POSTransaction[]> {
    this.ensureInitialized();
    
    const orders = await this.apiClient!.getInStoreOrders(locationId || '');
    return orders.map(order => this.formatTransaction(order));
  }

  // Error Handling
  isRetryableError(error: unknown): boolean {
    if (error instanceof POSApiError) {
      return error.retryable || false;
    }
    
    const axiosError = error as any;
    if (axiosError?.response) {
      const status = axiosError.response.status;
      return status === 429 || status === 502 || status === 503 || status === 504;
    }
    
    return true; // Network errors are retryable
  }

  getRetryDelay(attemptNumber: number): number {
    return Math.min(1000 * Math.pow(2, attemptNumber), 10000);
  }

  // Utility Methods
  formatTransaction(rawTransaction: unknown): POSTransaction {
    const order = rawTransaction as ShopifyOrder;
    
    // Determine if this is an in-store transaction
    const isInStore = order.source_name === 'pos' || 
                     order.source_name === 'shopify_draft_order' ||
                     order.location_id !== null;

    // Map financial status to our transaction status
    let status: TransactionStatus = 'pending';
    switch (order.financial_status) {
      case 'paid':
        status = 'completed';
        break;
      case 'partially_refunded':
      case 'refunded':
        status = 'refunded';
        break;
      case 'voided':
        status = 'cancelled';
        break;
      case 'authorized':
      case 'partially_paid':
        status = 'pending';
        break;
    }

    // Extract payment method from gateway
    let paymentMethod: PaymentMethod = 'other';
    if (order.payment_gateway_names?.length > 0) {
      const gateway = order.payment_gateway_names[0].toLowerCase();
      if (gateway.includes('card') || gateway.includes('stripe') || gateway.includes('shopify_payments')) {
        paymentMethod = 'card';
      } else if (gateway.includes('cash')) {
        paymentMethod = 'cash';
      } else if (gateway.includes('gift')) {
        paymentMethod = 'gift_card';
      }
    }

    return {
      id: order.id.toString(),
      provider: 'shopify',
      externalId: order.id.toString(),
      locationId: order.location_id?.toString() || 'online',
      amount: parseFloat(order.total_price),
      currency: order.currency,
      status,
      paymentMethod,
      customerId: order.customer?.id?.toString(),
      createdAt: new Date(order.created_at),
      updatedAt: new Date(order.updated_at),
      metadata: {
        orderNumber: order.order_number,
        orderName: order.name,
        isInStore,
        source: order.source_name,
        tags: order.tags,
        note: order.note,
        lineItems: order.line_items.map(item => ({
          id: item.id.toString(),
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: parseFloat(item.price),
          totalDiscount: parseFloat(item.total_discount)
        })),
        refunds: order.refunds?.map(refund => ({
          id: refund.id.toString(),
          amount: refund.transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0),
          createdAt: refund.created_at,
          note: refund.note
        }))
      }
    };
  }

  private formatLocation(location: ShopifyLocation): POSLocation {
    return {
      id: location.id.toString(),
      name: location.name,
      address: {
        line1: location.address1 || '',
        line2: location.address2 || '',
        city: location.city || '',
        state: location.province || '',
        postalCode: location.zip || '',
        country: location.country_code || ''
      },
      timezone: 'Europe/Stockholm', // Default for Swedish market
      currency: 'SEK',
      status: location.active ? 'active' : 'inactive',
      capabilities: ['transactions', 'inventory'],
      metadata: {
        legacy: location.legacy,
        phone: location.phone,
        createdAt: location.created_at,
        updatedAt: location.updated_at
      }
    };
  }

  private formatWebhook(subscription: ShopifyWebhookSubscription): POSWebhook {
    return {
      id: subscription.id.toString(),
      provider: 'shopify',
      url: subscription.address,
      eventTypes: [subscription.topic],
      active: true,
      createdAt: new Date(subscription.created_at),
      updatedAt: new Date(subscription.updated_at),
      metadata: {
        format: subscription.format,
        apiVersion: subscription.api_version,
        fields: subscription.fields,
        metafieldNamespaces: subscription.metafield_namespaces
      }
    };
  }

  private mapTransactionStatus(status: TransactionStatus): ShopifyOrderSearchOptions['financial_status'] {
    switch (status) {
      case 'completed':
        return 'paid';
      case 'pending':
        return 'pending';
      case 'refunded':
        return 'refunded';
      case 'cancelled':
        return 'voided';
      default:
        return 'any';
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized() || !this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Shopify adapter not initialized. Call initialize() first.'
      });
    }
  }

  private getCredentials(): ShopifyCredentials {
    if (!this.credentials) {
      throw new POSApiError({
        code: 'NO_CREDENTIALS',
        message: 'No credentials configured'
      });
    }
    return this.credentials as ShopifyCredentials;
  }
}