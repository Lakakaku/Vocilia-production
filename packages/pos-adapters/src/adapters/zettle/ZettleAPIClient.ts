import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import {
  ZettleCredentials,
  ZettleMerchant,
  ZettleLocation,
  ZettlePurchase,
  ZettleWebhook,
  ZettleApiResponse,
  ZettleOAuthTokenResponse,
  ZettleApiError,
  ZettleDevice,
  ZettleFinanceReport
} from './types';
import { POSApiError } from '../../base/BasePOSAdapter';
import { createLogger } from '../../utils/logger';

const logger = createLogger('ZettleAPIClient');

/**
 * Zettle API Client
 * 
 * Handles all HTTP communication with PayPal Zettle API
 * Includes automatic retry logic, error handling, and token refresh
 */
export class ZettleAPIClient {
  private axiosInstance: AxiosInstance;
  private readonly baseURL = 'https://api.zettle.com';
  private readonly authURL = 'https://oauth.zettle.com';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;
  private tokenRefreshPromise?: Promise<void>;
  
  constructor(private credentials: ZettleCredentials) {
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Initialize the API client
   */
  async initialize(): Promise<void> {
    if (!this.credentials.accessToken) {
      throw new POSApiError({
        code: 'NO_ACCESS_TOKEN',
        message: 'Access token is required for Zettle API'
      });
    }

    this.axiosInstance.defaults.headers.common['Authorization'] = 
      `Bearer ${this.credentials.accessToken}`;

    // Test the connection
    await this.getMerchantInfo();
  }

  /**
   * Setup axios interceptors for error handling and token refresh
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('API Request', {
          method: config.method,
          url: config.url,
          params: config.params
        });
        return config;
      },
      (error) => {
        logger.error('Request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle 401 Unauthorized - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          if (this.credentials.refreshToken && this.credentials.clientId && this.credentials.clientSecret) {
            try {
              await this.refreshAccessToken();
              // Retry the original request with new token
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers['Authorization'] = `Bearer ${this.credentials.accessToken}`;
              return this.axiosInstance(originalRequest);
            } catch (refreshError) {
              logger.error('Token refresh failed', refreshError);
              throw this.handleApiError(error);
            }
          }
        }

        // Handle rate limiting with exponential backoff
        if (error.response?.status === 429 && !originalRequest._retry) {
          originalRequest._retry = true;
          const retryAfter = parseInt(error.response.headers['retry-after'] || '5', 10);
          await this.sleep(retryAfter * 1000);
          return this.axiosInstance(originalRequest);
        }

        throw this.handleApiError(error);
      }
    );
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    if (this.tokenRefreshPromise) {
      return this.tokenRefreshPromise;
    }

    this.tokenRefreshPromise = this.performTokenRefresh();
    
    try {
      await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = undefined;
    }
  }

  private async performTokenRefresh(): Promise<void> {
    if (!this.credentials.refreshToken || !this.credentials.clientId || !this.credentials.clientSecret) {
      throw new POSApiError({
        code: 'REFRESH_CREDENTIALS_MISSING',
        message: 'Cannot refresh token: missing credentials'
      });
    }

    try {
      const response = await axios.post<ZettleOAuthTokenResponse>(
        `${this.authURL}/token`,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.credentials.clientId,
          client_secret: this.credentials.clientSecret,
          refresh_token: this.credentials.refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.credentials.accessToken = response.data.access_token;
      if (response.data.refresh_token) {
        this.credentials.refreshToken = response.data.refresh_token;
      }

      this.axiosInstance.defaults.headers.common['Authorization'] = 
        `Bearer ${this.credentials.accessToken}`;

      logger.info('Access token refreshed successfully');
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw new POSApiError({
        code: 'TOKEN_REFRESH_FAILED',
        message: 'Failed to refresh access token',
        originalError: error
      });
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string
  ): Promise<ZettleOAuthTokenResponse> {
    try {
      const response = await axios.post<ZettleOAuthTokenResponse>(
        `${this.authURL}/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw this.handleApiError(error as AxiosError);
    }
  }

  /**
   * Get merchant information
   */
  async getMerchantInfo(): Promise<ZettleMerchant> {
    const response = await this.axiosInstance.get<ZettleMerchant>('/merchants/me');
    return response.data;
  }

  /**
   * Get all locations
   */
  async getLocations(): Promise<ZettleLocation[]> {
    const response = await this.axiosInstance.get<ZettleLocation[]>('/organizations/self/locations');
    return response.data || [];
  }

  /**
   * Get specific location
   */
  async getLocation(locationId: string): Promise<ZettleLocation> {
    const response = await this.axiosInstance.get<ZettleLocation>(
      `/organizations/self/locations/${locationId}`
    );
    return response.data;
  }

  /**
   * Get devices for a location
   */
  async getLocationDevices(locationId: string): Promise<ZettleDevice[]> {
    const response = await this.axiosInstance.get<ZettleDevice[]>(
      `/organizations/self/locations/${locationId}/devices`
    );
    return response.data || [];
  }

  /**
   * Get purchases (transactions)
   */
  async getPurchases(params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
    locationUuid?: string;
  }): Promise<{ purchases: ZettlePurchase[], hasMore: boolean }> {
    const response = await this.axiosInstance.get('/purchases/v2', {
      params: {
        startDate: params?.startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: params?.endDate || new Date().toISOString(),
        limit: params?.limit || 100,
        offset: params?.offset || 0,
        locationUuid: params?.locationUuid
      }
    });

    return {
      purchases: response.data.purchases || [],
      hasMore: response.data.hasMore || false
    };
  }

  /**
   * Get specific purchase by UUID
   */
  async getPurchase(purchaseUuid: string): Promise<ZettlePurchase> {
    const response = await this.axiosInstance.get<ZettlePurchase>(
      `/purchases/v2/${purchaseUuid}`
    );
    return response.data;
  }

  /**
   * Create webhook subscription
   */
  async createWebhook(webhook: {
    url: string;
    eventTypes: string[];
  }): Promise<ZettleWebhook> {
    const response = await this.axiosInstance.post<ZettleWebhook>(
      '/organizations/self/webhooks',
      webhook
    );
    return response.data;
  }

  /**
   * List webhooks
   */
  async listWebhooks(): Promise<ZettleWebhook[]> {
    const response = await this.axiosInstance.get<ZettleWebhook[]>(
      '/organizations/self/webhooks'
    );
    return response.data || [];
  }

  /**
   * Update webhook
   */
  async updateWebhook(webhookId: string, updates: Partial<ZettleWebhook>): Promise<ZettleWebhook> {
    const response = await this.axiosInstance.put<ZettleWebhook>(
      `/organizations/self/webhooks/${webhookId}`,
      updates
    );
    return response.data;
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.axiosInstance.delete(`/organizations/self/webhooks/${webhookId}`);
  }

  /**
   * Get finance report
   */
  async getFinanceReport(startDate: string, endDate: string): Promise<ZettleFinanceReport> {
    const response = await this.axiosInstance.get<ZettleFinanceReport>('/finance/report', {
      params: { startDate, endDate }
    });
    return response.data;
  }

  /**
   * Handle API errors
   */
  private handleApiError(error: AxiosError): POSApiError {
    const response = error.response;
    const data = response?.data as ZettleApiError | undefined;

    // Determine if error is retryable
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    const isRetryable = response ? retryableStatusCodes.includes(response.status) : true;

    logger.error('Zettle API Error', {
      status: response?.status,
      error: data?.error,
      message: data?.message,
      violations: data?.violations
    });

    return new POSApiError({
      code: data?.errorType || 'ZETTLE_API_ERROR',
      message: data?.message || error.message || 'Zettle API request failed',
      statusCode: response?.status,
      retryable: isRetryable,
      originalError: error
    });
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(payload: string, signature: string, secret: string): boolean {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  }

  /**
   * Get organization details
   */
  async getOrganization(): Promise<any> {
    const response = await this.axiosInstance.get('/organizations/self');
    return response.data;
  }

  /**
   * Get products/inventory
   */
  async getProducts(params?: {
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const response = await this.axiosInstance.get('/products', {
      params: {
        limit: params?.limit || 100,
        offset: params?.offset || 0
      }
    });
    return response.data.products || [];
  }

  /**
   * Get Swedish-specific features status
   */
  async getSwedishFeatures(): Promise<any> {
    try {
      const [organization, merchant] = await Promise.all([
        this.getOrganization(),
        this.getMerchantInfo()
      ]);

      return {
        swishEnabled: organization.paymentMethods?.includes('SWISH'),
        kassaregister: organization.kassaregister,
        invoiceEnabled: organization.paymentMethods?.includes('INVOICE'),
        country: merchant.country,
        currency: merchant.currency,
        vatRegistered: !!merchant.vatNumber,
        organizationNumber: merchant.organizationNumber
      };
    } catch (error) {
      logger.error('Failed to get Swedish features', error);
      return null;
    }
  }
}