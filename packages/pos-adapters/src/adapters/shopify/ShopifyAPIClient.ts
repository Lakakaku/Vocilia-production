import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import {
  ShopifyCredentials,
  ShopifyOrder,
  ShopifyLocation,
  ShopifyShop,
  ShopifyWebhookSubscription,
  ShopifyOAuthResponse,
  ShopifyOrderSearchOptions,
  ShopifyAPIResponse,
  SHOPIFY_WEBHOOK_TOPICS
} from './types';
import { POSApiError } from '../../base/BasePOSAdapter';
import crypto from 'crypto';

/**
 * Shopify API Client
 * 
 * Handles all direct API communication with Shopify including:
 * - Authentication and token management
 * - Order/Transaction retrieval
 * - Location management
 * - Webhook subscriptions
 * - Rate limiting and retries
 */
export class ShopifyAPIClient {
  private axiosInstance?: AxiosInstance;
  private readonly apiVersion: string;
  private readonly maxRetries = 3;
  private readonly baseRetryDelay = 1000;
  private rateLimitRemaining = 40;
  private rateLimitReset?: Date;

  constructor(private credentials: ShopifyCredentials) {
    this.apiVersion = credentials.apiVersion || '2024-01';
  }

  /**
   * Initialize the API client
   */
  async initialize(): Promise<void> {
    if (!this.credentials.shopDomain) {
      throw new POSApiError({
        code: 'MISSING_SHOP_DOMAIN',
        message: 'Shop domain is required for Shopify API'
      });
    }

    if (!this.credentials.accessToken) {
      throw new POSApiError({
        code: 'MISSING_ACCESS_TOKEN',
        message: 'Access token is required for Shopify API'
      });
    }

    const baseURL = `https://${this.credentials.shopDomain}/admin/api/${this.apiVersion}`;

    this.axiosInstance = axios.create({
      baseURL,
      headers: {
        'X-Shopify-Access-Token': this.credentials.accessToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // Add request interceptor for rate limiting
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        await this.handleRateLimiting();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(response.headers);
        return response;
      },
      async (error) => {
        if (error.response?.status === 429) {
          return this.handleRateLimitError(error);
        }
        throw this.formatError(error);
      }
    );
  }

  /**
   * Get shop information
   */
  async getShop(): Promise<ShopifyShop> {
    const response = await this.request<{ shop: ShopifyShop }>({
      method: 'GET',
      url: '/shop.json'
    });
    return response.shop;
  }

  /**
   * Get all locations
   */
  async getLocations(): Promise<ShopifyLocation[]> {
    const response = await this.request<{ locations: ShopifyLocation[] }>({
      method: 'GET',
      url: '/locations.json'
    });
    return response.locations || [];
  }

  /**
   * Get specific location
   */
  async getLocation(locationId: string): Promise<ShopifyLocation> {
    const response = await this.request<{ location: ShopifyLocation }>({
      method: 'GET',
      url: `/locations/${locationId}.json`
    });
    return response.location;
  }

  /**
   * Search orders with filters
   */
  async searchOrders(options: ShopifyOrderSearchOptions): Promise<ShopifyOrder[]> {
    const params = new URLSearchParams();
    
    Object.entries(options).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });

    const response = await this.request<{ orders: ShopifyOrder[] }>({
      method: 'GET',
      url: `/orders.json?${params.toString()}`
    });
    
    return response.orders || [];
  }

  /**
   * Get a specific order by ID
   */
  async getOrder(orderId: string): Promise<ShopifyOrder> {
    const response = await this.request<{ order: ShopifyOrder }>({
      method: 'GET',
      url: `/orders/${orderId}.json`
    });
    return response.order;
  }

  /**
   * Get orders for in-store purchases only (Shopify POS)
   */
  async getInStoreOrders(locationId: string, options: ShopifyOrderSearchOptions = {}): Promise<ShopifyOrder[]> {
    // Filter for orders created via Shopify POS
    const orders = await this.searchOrders({
      ...options,
      attribution_app_id: '580111' // Shopify POS app ID
    });

    // Further filter by location if provided
    if (locationId) {
      return orders.filter(order => order.location_id?.toString() === locationId);
    }

    return orders;
  }

  /**
   * Create webhook subscription
   */
  async createWebhook(topic: string, address: string): Promise<ShopifyWebhookSubscription> {
    const response = await this.request<{ webhook: ShopifyWebhookSubscription }>({
      method: 'POST',
      url: '/webhooks.json',
      data: {
        webhook: {
          topic,
          address,
          format: 'json',
          api_version: this.apiVersion
        }
      }
    });
    return response.webhook;
  }

  /**
   * List all webhooks
   */
  async listWebhooks(): Promise<ShopifyWebhookSubscription[]> {
    const response = await this.request<{ webhooks: ShopifyWebhookSubscription[] }>({
      method: 'GET',
      url: '/webhooks.json'
    });
    return response.webhooks || [];
  }

  /**
   * Update webhook
   */
  async updateWebhook(webhookId: string, updates: Partial<ShopifyWebhookSubscription>): Promise<ShopifyWebhookSubscription> {
    const response = await this.request<{ webhook: ShopifyWebhookSubscription }>({
      method: 'PUT',
      url: `/webhooks/${webhookId}.json`,
      data: { webhook: updates }
    });
    return response.webhook;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request({
      method: 'DELETE',
      url: `/webhooks/${webhookId}.json`
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.credentials.webhookSecret) {
      throw new POSApiError({
        code: 'MISSING_WEBHOOK_SECRET',
        message: 'Webhook secret is required for signature verification'
      });
    }

    const hash = crypto
      .createHmac('sha256', this.credentials.webhookSecret)
      .update(rawBody, 'utf8')
      .digest('base64');

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
  }

  /**
   * Exchange OAuth code for access token
   */
  async exchangeCodeForToken(code: string): Promise<ShopifyOAuthResponse> {
    if (!this.credentials.apiKey || !this.credentials.apiSecret) {
      throw new POSApiError({
        code: 'MISSING_API_CREDENTIALS',
        message: 'API key and secret are required for OAuth'
      });
    }

    const response = await axios.post(
      `https://${this.credentials.shopDomain}/admin/oauth/access_token`,
      {
        client_id: this.credentials.apiKey,
        client_secret: this.credentials.apiSecret,
        code
      }
    );

    return response.data;
  }

  /**
   * Verify HMAC for OAuth requests
   */
  verifyOAuthHmac(params: Record<string, string>, hmac: string): boolean {
    if (!this.credentials.apiSecret) {
      throw new POSApiError({
        code: 'MISSING_API_SECRET',
        message: 'API secret is required for HMAC verification'
      });
    }

    const message = Object.keys(params)
      .filter(key => key !== 'hmac' && key !== 'signature')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    const hash = crypto
      .createHmac('sha256', this.credentials.apiSecret)
      .update(message)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac));
  }

  /**
   * Subscribe to multiple webhook topics
   */
  async subscribeToWebhooks(webhookUrl: string, topics: string[] = []): Promise<ShopifyWebhookSubscription[]> {
    const topicsToSubscribe = topics.length > 0 ? topics : [
      ...SHOPIFY_WEBHOOK_TOPICS.ORDERS,
      ...SHOPIFY_WEBHOOK_TOPICS.REFUNDS
    ];

    const subscriptions: ShopifyWebhookSubscription[] = [];

    for (const topic of topicsToSubscribe) {
      try {
        const webhook = await this.createWebhook(topic, webhookUrl);
        subscriptions.push(webhook);
      } catch (error: any) {
        // Skip if webhook already exists
        if (error.code !== 'WEBHOOK_EXISTS') {
          throw error;
        }
      }
    }

    return subscriptions;
  }

  /**
   * Get orders within time window
   */
  async getOrdersInTimeWindow(startTime: Date, endTime: Date, locationId?: string): Promise<ShopifyOrder[]> {
    const orders = await this.searchOrders({
      created_at_min: startTime.toISOString(),
      created_at_max: endTime.toISOString(),
      status: 'any',
      limit: 250
    });

    if (locationId) {
      return orders.filter(order => order.location_id?.toString() === locationId);
    }

    return orders;
  }

  /**
   * Generic request method with retry logic
   */
  private async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    if (!this.axiosInstance) {
      throw new POSApiError({
        code: 'NOT_INITIALIZED',
        message: 'Shopify API client not initialized'
      });
    }

    let lastError: any;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await this.axiosInstance.request<T>(config);
        return response.data;
      } catch (error: any) {
        lastError = error;
        
        if (!this.isRetryableError(error) || attempt === this.maxRetries - 1) {
          throw error;
        }

        const delay = this.getRetryDelay(attempt);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Handle rate limiting
   */
  private async handleRateLimiting(): Promise<void> {
    if (this.rateLimitRemaining <= 2 && this.rateLimitReset) {
      const now = new Date();
      if (now < this.rateLimitReset) {
        const waitTime = this.rateLimitReset.getTime() - now.getTime();
        await this.delay(waitTime);
      }
    }
  }

  /**
   * Handle rate limit errors
   */
  private async handleRateLimitError(error: AxiosError): Promise<any> {
    const retryAfter = error.response?.headers['retry-after'];
    const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
    
    await this.delay(waitTime);
    
    if (error.config) {
      return this.axiosInstance?.request(error.config);
    }
    
    throw error;
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(headers: any): void {
    const remaining = headers['x-shopify-shop-api-call-limit'];
    if (remaining) {
      const [used, total] = remaining.split('/').map(Number);
      this.rateLimitRemaining = total - used;
    }

    const resetTime = headers['x-shopify-api-retry-after'];
    if (resetTime) {
      this.rateLimitReset = new Date(resetTime);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (!error.response) {
      return true; // Network errors are retryable
    }

    const status = error.response.status;
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    return Math.min(this.baseRetryDelay * Math.pow(2, attempt), 10000);
  }

  /**
   * Format API errors
   */
  private formatError(error: any): POSApiError {
    if (error.response) {
      const { status, data } = error.response;
      const message = data?.errors 
        ? Object.values(data.errors).flat().join(', ')
        : data?.error_description || data?.error || 'Shopify API error';

      return new POSApiError({
        code: `SHOPIFY_${status}`,
        message,
        httpStatus: status,
        originalError: error,
        retryable: this.isRetryableError(error)
      });
    }

    return new POSApiError({
      code: 'SHOPIFY_NETWORK_ERROR',
      message: error.message || 'Network error',
      originalError: error,
      retryable: true
    });
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}