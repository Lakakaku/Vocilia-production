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
  POSCapability
} from '../../types';
import {
  SquareLocation,
  SquareMerchant,
  SquarePayment,
  SquareOrder,
  SquareCredentials,
  SquareApiResponse,
  SquarePaymentFilter,
  SquareTransactionCache,
  SquareWebhookEvent
} from './types';
import { SquareAPIClient } from './SquareAPIClient';
import { SquareMockData } from './SquareMockData';
import crypto from 'crypto';

/**
 * Square POS Adapter
 * 
 * Implements the POSAdapter interface for Square POS systems with:
 * - OAuth2 authentication flows
 * - Location discovery and management
 * - Transaction retrieval and caching
 * - Webhook processing
 * - Swedish market support
 */
export class SquareAdapter extends BasePOSAdapter implements POSAdapter {
  public readonly provider = 'square' as const;
  public readonly capabilities: POSCapability[] = [
    'transactions',
    'webhooks', 
    'inventory',
    'customers'
  ];

  private apiClient?: SquareAPIClient;
  private mockData: SquareMockData;
  private transactionCache = new Map<string, SquareTransactionCache>();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super('square', ['transactions', 'webhooks', 'inventory', 'customers']);
    this.mockData = new SquareMockData();
  }

  // Connection Management
  async initialize(credentials: POSCredentials): Promise<void> {
    await super.initialize(credentials);
    this.apiClient = new SquareAPIClient(credentials as SquareCredentials);
    await this.apiClient.initialize();
  }

  async testConnection(credentials: POSCredentials): Promise<POSConnectionStatus> {
    try {
      const testClient = new SquareAPIClient(credentials as SquareCredentials);
      await testClient.initialize();
      
      // Test by fetching merchant info
      const merchant = await testClient.getMerchant();
      const locations = await testClient.getLocations();

      return {
        connected: true,
        lastSync: new Date(),
        capabilities: this.capabilities,
        locations: locations.map(loc => this.formatLocation(loc))
      };
    } catch (error) {
      return {
        connected: false,
        capabilities: [],
        locations: [],
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to Square API',
          retryable: this.isRetryableError(error)
        }
      };
    }
  }

  protected async validateConnection(): Promise<void> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square API client not initialized'
      });
    }

    try {
      await this.apiClient.getMerchant();
    } catch (error) {
      throw new POSApiError({
        code: 'CONNECTION_VALIDATION_FAILED',
        message: 'Failed to validate Square API connection',
        originalError: error,
        retryable: this.isRetryableError(error)
      });
    }
  }

  // OAuth Flow Implementation
  async generateAuthUrl(redirectUri: string, scopes: string[] = []): Promise<OAuthAuthorizationUrl> {
    const state = this.generateOAuthState('temp-business-id', redirectUri);
    
    const defaultScopes = [
      'PAYMENTS_READ',
      'MERCHANT_PROFILE_READ',
      'ORDERS_READ'
    ];
    
    const allScopes = [...defaultScopes, ...scopes];
    
    const params = new URLSearchParams({
      client_id: this.getApplicationId(),
      scope: allScopes.join(' '),
      session: 'false',
      state
    });

    const baseUrl = this.getCredentials().environment === 'sandbox' 
      ? 'https://connect.squareupsandbox.com/oauth2/authorize'
      : 'https://connect.squareup.com/oauth2/authorize';

    return {
      url: `${baseUrl}?${params.toString()}`,
      state
    };
  }

  async exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse> {
    const oauthState = await this.validateState(state);
    
    const tokenData = await this.withRetry(async () => {
      if (!this.apiClient) throw new Error('API client not initialized');
      return this.apiClient.exchangeOAuthCode(code);
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_at ? 
        Math.floor((new Date(tokenData.expires_at).getTime() - Date.now()) / 1000) : 
        undefined,
      tokenType: tokenData.token_type || 'Bearer'
    };
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const tokenData = await this.withRetry(async () => {
      if (!this.apiClient) throw new Error('API client not initialized');
      return this.apiClient.refreshOAuthToken(refreshToken);
    });

    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_at ? 
        Math.floor((new Date(tokenData.expires_at).getTime() - Date.now()) / 1000) : 
        undefined,
      tokenType: tokenData.token_type || 'Bearer'
    };
  }

  // Location Management
  async getLocations(): Promise<POSLocation[]> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    const locations = await this.withRetry(async () => {
      return this.apiClient!.getLocations();
    });

    return locations.map(loc => this.formatLocation(loc));
  }

  async getLocation(locationId: string): Promise<POSLocation> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    const location = await this.withRetry(async () => {
      return this.apiClient!.getLocation(locationId);
    });

    return this.formatLocation(location);
  }

  // Transaction Operations
  async searchTransactions(options: TransactionSearchOptions): Promise<TransactionSearchResult> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    const filter: SquarePaymentFilter = {
      begin_time: options.startDate?.toISOString(),
      end_time: options.endDate?.toISOString(),
      location_id: options.locationId,
      cursor: options.cursor
    };

    if (options.minAmount || options.maxAmount) {
      filter.total = {
        amount: options.minAmount || options.maxAmount,
        currency: 'SEK' // Default to SEK for Swedish market
      };
    }

    const result = await this.withRetry(async () => {
      return this.apiClient!.searchPayments(filter, options.limit);
    });

    const transactions = result.payments?.map(payment => 
      this.formatTransaction(payment, result.orders)
    ) || [];

    return {
      transactions,
      hasMore: !!result.cursor,
      cursor: result.cursor,
      total: transactions.length
    };
  }

  async getTransaction(transactionId: string, locationId?: string): Promise<POSTransaction> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    const payment = await this.withRetry(async () => {
      return this.apiClient!.getPayment(transactionId);
    });

    let order: SquareOrder | undefined;
    if (payment.order_id) {
      try {
        order = await this.apiClient.getOrder(payment.order_id);
      } catch (error) {
        // Order might not exist or be accessible
        console.warn('Failed to fetch order details:', error);
      }
    }

    return this.formatTransaction(payment, order ? [order] : undefined);
  }

  async getTransactionsInTimeWindow(
    locationId: string,
    startTime: Date,
    endTime: Date
  ): Promise<POSTransaction[]> {
    // Check cache first
    const cached = this.getFromCache(locationId, startTime, endTime);
    if (cached.length > 0) {
      return cached;
    }

    const result = await this.searchTransactions({
      locationId,
      startDate: startTime,
      endDate: endTime,
      limit: 100
    });

    // Update cache
    this.updateCache(locationId, result.transactions);

    return result.transactions;
  }

  async findMatchingTransaction(
    locationId: string,
    amount: number,
    timestamp: Date,
    toleranceMinutes: number = 2
  ): Promise<POSTransaction | null> {
    const startTime = new Date(timestamp.getTime() - toleranceMinutes * 60 * 1000);
    const endTime = new Date(timestamp.getTime() + toleranceMinutes * 60 * 1000);
    
    const transactions = await this.getTransactionsInTimeWindow(locationId, startTime, endTime);
    
    // Convert amount to minor units (öre for SEK)
    const targetAmountMinor = this.normalizeCurrencyAmount(amount);
    
    return transactions.find(tx => {
      const txAmountMinor = this.normalizeCurrencyAmount(tx.amount);
      const amountDiff = Math.abs(txAmountMinor - targetAmountMinor);
      const amountTolerance = Math.max(100, targetAmountMinor * 0.01); // 1% or 1 SEK
      
      return amountDiff <= amountTolerance;
    }) || null;
  }

  // Webhook Management
  async createWebhook(webhook: Omit<POSWebhook, 'id' | 'createdAt' | 'updatedAt'>): Promise<POSWebhook> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    const squareWebhook = await this.withRetry(async () => {
      return this.apiClient!.createWebhookSubscription({
        name: 'AI Feedback Platform Webhook',
        event_types: webhook.events.map(event => this.mapEventToSquare(event)),
        notification_url: webhook.url,
        api_version: '2023-10-18'
      });
    });

    return {
      id: squareWebhook.id,
      url: webhook.url,
      events: webhook.events,
      secret: squareWebhook.signature_key,
      active: squareWebhook.enabled,
      createdAt: new Date(squareWebhook.created_at),
      updatedAt: new Date(squareWebhook.updated_at)
    };
  }

  async listWebhooks(): Promise<POSWebhook[]> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    const webhooks = await this.withRetry(async () => {
      return this.apiClient!.listWebhookSubscriptions();
    });

    return webhooks.map(webhook => ({
      id: webhook.id,
      url: webhook.notification_url,
      events: webhook.event_types?.map(event => this.mapEventFromSquare(event)) || [],
      secret: webhook.signature_key,
      active: webhook.enabled,
      createdAt: new Date(webhook.created_at),
      updatedAt: new Date(webhook.updated_at)
    }));
  }

  async updateWebhook(webhookId: string, updates: Partial<POSWebhook>): Promise<POSWebhook> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    const updateData: any = {};
    if (updates.events) {
      updateData.event_types = updates.events.map(event => this.mapEventToSquare(event));
    }
    if (updates.url) {
      updateData.notification_url = updates.url;
    }
    if (updates.active !== undefined) {
      updateData.enabled = updates.active;
    }

    const updatedWebhook = await this.withRetry(async () => {
      return this.apiClient!.updateWebhookSubscription(webhookId, updateData);
    });

    return {
      id: updatedWebhook.id,
      url: updatedWebhook.notification_url,
      events: updatedWebhook.event_types?.map(event => this.mapEventFromSquare(event)) || [],
      secret: updatedWebhook.signature_key,
      active: updatedWebhook.enabled,
      createdAt: new Date(updatedWebhook.created_at),
      updatedAt: new Date(updatedWebhook.updated_at)
    };
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Square adapter not initialized'
      });
    }

    await this.withRetry(async () => {
      return this.apiClient!.deleteWebhookSubscription(webhookId);
    });
  }

  async validateWebhook(payload: string, signature: string, secret: string): Promise<WebhookValidationResult> {
    try {
      // Square webhook signature validation
      const expectedSignature = crypto
        .createHmac('sha1', secret)
        .update(payload)
        .digest('base64');

      if (signature !== expectedSignature) {
        return {
          valid: false,
          error: 'Invalid webhook signature'
        };
      }

      const event: SquareWebhookEvent = JSON.parse(payload);
      
      return {
        valid: true,
        event: {
          id: event.event_id,
          type: event.type,
          data: event.data,
          timestamp: event.created_at,
          source: 'square',
          signature
        }
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid webhook payload format'
      };
    }
  }

  // Utility Methods
  formatTransaction(payment: SquarePayment, orders?: SquareOrder[]): POSTransaction {
    const order = orders?.find(o => o.id === payment.order_id);
    const items = order?.line_items?.map(item => ({
      id: item.uid || '',
      name: item.name || 'Unknown Item',
      quantity: parseInt(item.quantity) || 1,
      price: (item.base_price_money?.amount || 0) / 100, // Convert from cents to SEK
      category: undefined
    })) || [];

    return {
      id: payment.id,
      externalId: payment.id,
      posLocationId: payment.location_id || '',
      amount: (payment.total_money?.amount || 0) / 100, // Convert from cents to SEK
      currency: payment.total_money?.currency || 'SEK',
      items,
      timestamp: payment.created_at,
      locationId: payment.location_id,
      customerId: payment.customer_id,
      paymentMethod: payment.source_type,
      tipAmount: payment.tip_money ? payment.tip_money.amount / 100 : undefined,
      metadata: {
        receipt_number: payment.receipt_number,
        receipt_url: payment.receipt_url,
        status: payment.status,
        reference_id: payment.reference_id,
        employee_id: payment.employee_id,
        card_details: payment.card_details
      }
    };
  }

  private formatLocation(location: SquareLocation): POSLocation {
    return {
      id: location.id,
      name: location.name,
      address: location.address ? {
        street: location.address.address_line_1,
        city: location.address.locality,
        postalCode: location.address.postal_code,
        country: location.address.country
      } : undefined,
      timezone: location.timezone,
      phoneNumber: location.phone_number,
      businessName: location.business_name,
      status: location.status === 'ACTIVE' ? 'active' : 'inactive',
      capabilities: this.capabilities
    };
  }

  // Cache Management
  private getFromCache(locationId: string, startTime: Date, endTime: Date): POSTransaction[] {
    const cache = this.transactionCache.get(locationId);
    if (!cache || cache.expiresAt < new Date()) {
      return [];
    }

    const transactions: POSTransaction[] = [];
    for (const [id, payment] of cache.transactions.entries()) {
      const txTime = new Date(payment.created_at);
      if (txTime >= startTime && txTime <= endTime) {
        transactions.push(this.formatTransaction(payment));
      }
    }

    return transactions;
  }

  private updateCache(locationId: string, transactions: POSTransaction[]): void {
    let cache = this.transactionCache.get(locationId);
    if (!cache) {
      cache = {
        locationId,
        transactions: new Map(),
        lastFetch: new Date(),
        expiresAt: new Date(Date.now() + this.cacheExpiryMs)
      };
      this.transactionCache.set(locationId, cache);
    }

    // Add new transactions to cache
    for (const tx of transactions) {
      const payment: SquarePayment = {
        id: tx.id,
        created_at: tx.timestamp,
        total_money: {
          amount: Math.round(tx.amount * 100), // Convert to cents
          currency: tx.currency
        },
        amount_money: {
          amount: Math.round(tx.amount * 100),
          currency: tx.currency
        },
        status: 'COMPLETED',
        source_type: tx.paymentMethod || 'CARD',
        location_id: tx.posLocationId
      };
      cache.transactions.set(tx.id, payment);
    }

    cache.lastFetch = new Date();
    cache.expiresAt = new Date(Date.now() + this.cacheExpiryMs);
  }

  // Helper methods
  private getCredentials(): SquareCredentials {
    return this.credentials as SquareCredentials;
  }

  private getApplicationId(): string {
    const creds = this.getCredentials();
    return creds.applicationId || 'default-app-id';
  }

  private mapEventToSquare(event: string): string {
    const eventMap: Record<string, string> = {
      'payment.created': 'payment.created',
      'payment.updated': 'payment.updated',
      'order.created': 'order.created',
      'order.updated': 'order.updated'
    };
    return eventMap[event] || event;
  }

  private mapEventFromSquare(event: string): string {
    const eventMap: Record<string, string> = {
      'payment.created': 'payment.created',
      'payment.updated': 'payment.updated',
      'order.created': 'order.created',
      'order.updated': 'order.updated'
    };
    return eventMap[event] || event;
  }

  async disconnect(): Promise<void> {
    await super.disconnect();
    this.apiClient = undefined;
    this.transactionCache.clear();
  }
}