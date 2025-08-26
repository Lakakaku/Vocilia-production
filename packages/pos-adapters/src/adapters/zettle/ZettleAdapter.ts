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
  ZettleCredentials,
  ZettlePurchase,
  ZettleLocation,
  ZettleWebhook,
  ZettleTransactionCache,
  ZettleOAuthTokenResponse,
  ZettleMerchant,
  ZettleSwedishFeatures
} from './types';
import { ZettleAPIClient } from './ZettleAPIClient';
import { createLogger } from '../../utils/logger';
import crypto from 'crypto';

const logger = createLogger('ZettleAdapter');

/**
 * Zettle POS Adapter
 * 
 * Implements the POSAdapter interface for PayPal Zettle (formerly iZettle)
 * Optimized for Swedish market with support for:
 * - Swedish payment methods (Swish, invoice)
 * - Kassaregister compliance
 * - SEK currency handling
 * - Swedish business validation
 */
export class ZettleAdapter extends BasePOSAdapter implements POSAdapter {
  public readonly provider = 'zettle' as const;
  public readonly capabilities: POSCapability[] = [
    'transactions',
    'webhooks',
    'inventory',
    'customers',
    'finance_reports',
    'swedish_payments' // Custom capability for Swedish market
  ];

  private apiClient?: ZettleAPIClient;
  private transactionCache = new Map<string, ZettleTransactionCache>();
  private readonly cacheExpiryMs = 5 * 60 * 1000; // 5 minutes
  private locationCache?: ZettleLocation[];
  private merchantInfo?: ZettleMerchant;
  private swedishFeatures?: ZettleSwedishFeatures;

  // OAuth configuration
  private readonly oauthConfig = {
    authorizationUrl: 'https://oauth.zettle.com/authorize',
    tokenUrl: 'https://oauth.zettle.com/token',
    scopes: [
      'READ:PURCHASE',
      'READ:PRODUCT',
      'READ:INVENTORY',
      'READ:FINANCE',
      'WRITE:WEBHOOK',
      'READ:USERINFO'
    ]
  };

  constructor() {
    super('zettle', [
      'transactions',
      'webhooks', 
      'inventory',
      'customers',
      'finance_reports',
      'swedish_payments'
    ]);
  }

  // Connection Management
  async initialize(credentials: POSCredentials): Promise<void> {
    await super.initialize(credentials);
    this.apiClient = new ZettleAPIClient(credentials as ZettleCredentials);
    await this.apiClient.initialize();
    
    // Cache merchant info
    this.merchantInfo = await this.apiClient.getMerchantInfo();
    
    // Load Swedish features if in Sweden
    if (this.merchantInfo.country === 'SE') {
      this.swedishFeatures = await this.apiClient.getSwedishFeatures();
      logger.info('Swedish features loaded', this.swedishFeatures);
    }
  }

  async testConnection(credentials: POSCredentials): Promise<POSConnectionStatus> {
    try {
      const testClient = new ZettleAPIClient(credentials as ZettleCredentials);
      await testClient.initialize();
      
      const [merchant, locations] = await Promise.all([
        testClient.getMerchantInfo(),
        testClient.getLocations()
      ]);

      return {
        connected: true,
        lastSync: new Date(),
        capabilities: this.capabilities,
        locations: locations.map(loc => this.formatLocation(loc)),
        metadata: {
          merchantName: merchant.name,
          country: merchant.country,
          currency: merchant.currency,
          organizationNumber: merchant.organizationNumber
        }
      };
    } catch (error) {
      logger.error('Connection test failed', error);
      return {
        connected: false,
        capabilities: [],
        locations: [],
        error: {
          code: 'CONNECTION_FAILED',
          message: 'Failed to connect to Zettle API',
          retryable: this.isRetryableError(error)
        }
      };
    }
  }

  protected async validateConnection(): Promise<void> {
    if (!this.apiClient) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Zettle adapter not initialized'
      });
    }

    try {
      await this.apiClient.getMerchantInfo();
    } catch (error) {
      throw new POSApiError({
        code: 'CONNECTION_VALIDATION_FAILED',
        message: 'Failed to validate Zettle connection',
        originalError: error,
        retryable: this.isRetryableError(error)
      });
    }
  }

  // OAuth Flow Implementation
  async generateAuthUrl(redirectUri: string, scopes?: string[]): Promise<OAuthAuthorizationUrl> {
    if (!this.credentials?.clientId) {
      throw new POSApiError({
        code: 'MISSING_CLIENT_ID',
        message: 'Client ID is required for OAuth flow'
      });
    }

    const state = this.generateOAuthState(
      this.credentials.businessId || 'unknown',
      redirectUri
    );

    const scopesToUse = scopes || this.oauthConfig.scopes;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.credentials.clientId,
      redirect_uri: redirectUri,
      scope: scopesToUse.join(' '),
      state
    });

    return {
      url: `${this.oauthConfig.authorizationUrl}?${params.toString()}`,
      state,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };
  }

  async exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse> {
    const oauthState = await this.validateState(state);
    
    if (!this.credentials?.clientId || !this.credentials?.clientSecret) {
      throw new POSApiError({
        code: 'MISSING_CREDENTIALS',
        message: 'Client ID and secret are required for token exchange'
      });
    }

    try {
      const tokenResponse = await this.apiClient!.exchangeCodeForToken(
        code,
        oauthState.redirectUrl,
        this.credentials.clientId,
        this.credentials.clientSecret
      );

      return this.formatTokenResponse(tokenResponse);
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
    if (!this.credentials?.clientId || !this.credentials?.clientSecret) {
      throw new POSApiError({
        code: 'MISSING_CREDENTIALS',
        message: 'Client ID and secret are required for token refresh'
      });
    }

    // Update credentials with refresh token
    const newCredentials = {
      ...this.credentials,
      refreshToken
    } as ZettleCredentials;

    // Reinitialize with new credentials to trigger refresh
    await this.initialize(newCredentials);
    
    return {
      provider: 'zettle',
      accessToken: this.credentials.accessToken!,
      refreshToken: (this.credentials as ZettleCredentials).refreshToken,
      expiresIn: 3600,
      scope: this.oauthConfig.scopes.join(' '),
      tokenType: 'Bearer'
    };
  }

  // Location Management
  async getLocations(): Promise<POSLocation[]> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const locations = await this.apiClient.getLocations();
      this.locationCache = locations;
      
      // Fetch devices for each location
      const locationsWithDevices = await Promise.all(
        locations.map(async (location) => {
          try {
            const devices = await this.apiClient.getLocationDevices(location.uuid);
            return { ...location, devices };
          } catch (error) {
            logger.warn(`Failed to fetch devices for location ${location.uuid}`, error);
            return location;
          }
        })
      );

      return locationsWithDevices.map(loc => this.formatLocation(loc));
    });
  }

  async getLocation(locationId: string): Promise<POSLocation> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const location = await this.apiClient.getLocation(locationId);
      return this.formatLocation(location);
    });
  }

  // Transaction Operations
  async searchTransactions(options: TransactionSearchOptions): Promise<TransactionSearchResult> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const { purchases, hasMore } = await this.apiClient.getPurchases({
        startDate: options.startDate?.toISOString(),
        endDate: options.endDate?.toISOString(),
        limit: options.limit || 100,
        offset: options.offset || 0,
        locationUuid: options.locationId
      });

      const transactions = purchases.map(purchase => this.formatTransaction(purchase));

      return {
        transactions,
        total: transactions.length,
        hasMore,
        nextOffset: hasMore ? (options.offset || 0) + transactions.length : undefined
      };
    });
  }

  async getTransaction(transactionId: string, locationId?: string): Promise<POSTransaction> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const purchase = await this.apiClient.getPurchase(transactionId);
      return this.formatTransaction(purchase);
    });
  }

  async getTransactionsInTimeWindow(
    locationId: string,
    startTime: Date,
    endTime: Date
  ): Promise<POSTransaction[]> {
    // Check cache first
    const cacheKey = `${locationId}_${startTime.getTime()}_${endTime.getTime()}`;
    const cached = this.transactionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp.getTime() < this.cacheExpiryMs) {
      logger.debug('Returning cached transactions', { locationId, count: cached.transactions.length });
      return cached.transactions.map(tx => this.formatTransaction(tx));
    }

    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const allTransactions: ZettlePurchase[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { purchases, hasMore: more } = await this.apiClient.getPurchases({
          startDate: startTime.toISOString(),
          endDate: endTime.toISOString(),
          locationUuid: locationId,
          limit: 100,
          offset
        });

        allTransactions.push(...purchases);
        hasMore = more;
        offset += purchases.length;
      }

      // Update cache
      this.transactionCache.set(cacheKey, {
        transactions: allTransactions,
        timestamp: new Date(),
        locationId
      });

      return allTransactions.map(tx => this.formatTransaction(tx));
    });
  }

  async findMatchingTransaction(
    locationId: string,
    amount: number,
    timestamp: Date,
    toleranceMinutes: number = 2
  ): Promise<POSTransaction | null> {
    const startTime = new Date(timestamp.getTime() - toleranceMinutes * 60 * 1000);
    const endTime = new Date(timestamp.getTime() + toleranceMinutes * 60 * 1000);

    const transactions = await this.getTransactionsInTimeWindow(
      locationId,
      startTime,
      endTime
    );

    const amountInOre = this.normalizeCurrencyAmount(amount, 'major'); // Convert SEK to öre
    const found = this.findTransactionByAmountAndTime(
      transactions,
      amountInOre,
      timestamp,
      toleranceMinutes
    );

    return found;
  }

  // Webhook Management
  async createWebhook(webhook: Omit<POSWebhook, 'id' | 'createdAt' | 'updatedAt'>): Promise<POSWebhook> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const zettleWebhook = await this.apiClient.createWebhook({
        url: webhook.url,
        eventTypes: webhook.events
      });

      return this.formatWebhook(zettleWebhook);
    });
  }

  async listWebhooks(): Promise<POSWebhook[]> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const webhooks = await this.apiClient.listWebhooks();
      return webhooks.map(wh => this.formatWebhook(wh));
    });
  }

  async updateWebhook(webhookId: string, updates: Partial<POSWebhook>): Promise<POSWebhook> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      const zettleUpdates: Partial<ZettleWebhook> = {};
      if (updates.url) zettleUpdates.url = updates.url;
      if (updates.events) zettleUpdates.eventTypes = updates.events as any;
      if (updates.active !== undefined) {
        zettleUpdates.status = updates.active ? 'ACTIVE' : 'INACTIVE';
      }

      const updated = await this.apiClient.updateWebhook(webhookId, zettleUpdates);
      return this.formatWebhook(updated);
    });
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    return this.withRetry(async () => {
      if (!this.apiClient) {
        throw new POSApiError({
          code: 'NOT_INITIALIZED',
          message: 'Adapter not initialized'
        });
      }

      await this.apiClient.deleteWebhook(webhookId);
    });
  }

  async validateWebhook(
    payload: string,
    signature: string,
    secret: string
  ): Promise<WebhookValidationResult> {
    try {
      const isValid = this.apiClient?.validateWebhookSignature(payload, signature, secret) || false;
      
      if (!isValid) {
        logger.warn('Invalid webhook signature');
      }

      return {
        valid: isValid,
        message: isValid ? 'Valid signature' : 'Invalid signature'
      };
    } catch (error) {
      logger.error('Webhook validation error', error);
      return {
        valid: false,
        message: 'Validation failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Format Methods
  formatTransaction(purchase: ZettlePurchase | any): POSTransaction {
    // Handle both Zettle format and internal format
    if (purchase.id && purchase.provider === 'zettle') {
      return purchase as POSTransaction;
    }

    return {
      id: purchase.purchaseUUID,
      provider: 'zettle',
      amount: purchase.amount, // Already in öre
      currency: purchase.currency || 'SEK',
      timestamp: new Date(purchase.timestamp || purchase.created),
      status: purchase.refunded ? 'refunded' : 'completed',
      paymentMethod: this.getPaymentMethod(purchase),
      locationId: purchase.locationId,
      reference: purchase.reference || purchase.receiptNumber,
      items: purchase.products?.map((product: any) => ({
        name: product.name,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        totalPrice: product.unitPrice * product.quantity,
        discount: product.discountAmount || 0,
        vatRate: product.vatRate
      })),
      metadata: {
        receiptNumber: purchase.receiptNumber,
        globalPurchaseNumber: purchase.globalPurchaseNumber,
        userId: purchase.userId,
        deviceId: purchase.deviceId,
        vat: purchase.vat,
        gratuity: purchase.gratuity,
        serviceCharge: purchase.serviceCharge,
        cashback: purchase.cashback
      }
    };
  }

  private formatLocation(location: ZettleLocation): POSLocation {
    return {
      id: location.uuid,
      name: location.name,
      address: location.address ? {
        line1: location.address.addressLine1,
        line2: location.address.addressLine2,
        city: location.address.city,
        state: location.address.region,
        postalCode: location.address.postalCode,
        country: location.address.country
      } : undefined,
      timezone: location.timezone,
      currency: this.merchantInfo?.currency || 'SEK',
      status: location.status === 'ACTIVE' ? 'active' : 'inactive',
      capabilities: this.getLocationCapabilities(location),
      metadata: {
        type: location.type,
        phoneNumber: location.phoneNumber,
        description: location.description,
        coordinates: location.coordinates,
        devices: location.devices?.map(device => ({
          id: device.uuid,
          name: device.name,
          model: device.model,
          status: device.status,
          lastSeen: device.lastSeen
        }))
      }
    };
  }

  private formatWebhook(webhook: ZettleWebhook): POSWebhook {
    return {
      id: webhook.uuid,
      url: webhook.url,
      events: webhook.eventTypes,
      active: webhook.status === 'ACTIVE',
      createdAt: new Date(webhook.createdAt),
      updatedAt: new Date(webhook.updatedAt),
      metadata: {
        signingKey: webhook.signingKey
      }
    };
  }

  private formatTokenResponse(tokenResponse: ZettleOAuthTokenResponse): OAuthTokenResponse {
    return {
      provider: 'zettle',
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresIn: tokenResponse.expires_in,
      scope: tokenResponse.scope,
      tokenType: tokenResponse.token_type
    };
  }

  // Helper Methods
  private getPaymentMethod(purchase: ZettlePurchase): string {
    if (purchase.cardPayments?.length > 0) return 'card';
    if (purchase.cashPayments?.length > 0) return 'cash';
    if (purchase.voucherPayments?.length > 0) return 'voucher';
    
    // Check for Swedish payment methods
    const payment = purchase.payments?.[0];
    if (payment) {
      if (payment.type === 'SWISH') return 'swish';
      if (payment.type === 'INVOICE') return 'invoice';
      if (payment.type === 'MOBILE') return 'mobile';
      return payment.type.toLowerCase();
    }
    
    return 'unknown';
  }

  private getLocationCapabilities(location: ZettleLocation): string[] {
    const capabilities = ['transactions'];
    
    if (location.type === 'STORE') {
      capabilities.push('inventory', 'staff');
    }
    
    if (this.swedishFeatures?.swishIntegration) {
      capabilities.push('swish');
    }
    
    if (this.swedishFeatures?.kassaregister?.enabled) {
      capabilities.push('kassaregister');
    }
    
    return capabilities;
  }

  // Swedish-specific methods
  async getSwedishBusinessInfo(): Promise<any> {
    if (!this.merchantInfo || this.merchantInfo.country !== 'SE') {
      throw new POSApiError({
        code: 'NOT_SWEDISH_MERCHANT',
        message: 'This merchant is not registered in Sweden'
      });
    }

    return {
      organizationNumber: this.merchantInfo.organizationNumber,
      vatNumber: this.merchantInfo.vatNumber,
      vatRegistered: !!this.merchantInfo.vatNumber,
      currency: 'SEK',
      country: 'SE',
      features: this.swedishFeatures
    };
  }

  async verifySwedishOrganization(orgNumber: string): Promise<boolean> {
    // Validate Swedish organization number format (XXXXXX-XXXX)
    const orgNumberRegex = /^\d{6}-\d{4}$/;
    if (!orgNumberRegex.test(orgNumber)) {
      return false;
    }

    // Compare with merchant's organization number
    return this.merchantInfo?.organizationNumber === orgNumber;
  }

  // Clear caches periodically
  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, cache] of this.transactionCache.entries()) {
        if (now - cache.timestamp.getTime() > this.cacheExpiryMs) {
          this.transactionCache.delete(key);
        }
      }
      this.cleanupExpiredStates();
    }, 60000); // Clean up every minute
  }
}