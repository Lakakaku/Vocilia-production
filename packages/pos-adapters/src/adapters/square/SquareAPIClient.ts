import {
  SquareCredentials,
  SquareLocation,
  SquareMerchant,
  SquarePayment,
  SquareOrder,
  SquareApiResponse,
  SquarePaymentFilter
} from './types';
import { POSApiError } from '../../base/BasePOSAdapter';

/**
 * Square API Client
 * 
 * Handles HTTP communication with Square APIs including:
 * - Authentication and token management
 * - Location and merchant management
 * - Payment and order retrieval
 * - Webhook management
 * - Error handling and rate limiting
 */
export class SquareAPIClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(private credentials: SquareCredentials) {
    this.baseUrl = credentials.environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com';
    
    this.headers = {
      'Authorization': `Bearer ${credentials.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Square-Version': '2023-10-18'
    };
  }

  async initialize(): Promise<void> {
    // Test the connection by fetching merchant info
    await this.getMerchant();
  }

  // Merchant and Location APIs
  async getMerchant(): Promise<SquareMerchant> {
    const response = await this.makeRequest<{ merchant: SquareMerchant }>(
      'GET',
      '/v2/merchants/me'
    );
    
    if (!response.merchant) {
      throw new POSApiError({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Merchant information not available'
      });
    }

    return response.merchant;
  }

  async getLocations(): Promise<SquareLocation[]> {
    const response = await this.makeRequest<{ locations: SquareLocation[] }>(
      'GET',
      '/v2/locations'
    );
    
    return response.locations || [];
  }

  async getLocation(locationId: string): Promise<SquareLocation> {
    const response = await this.makeRequest<{ location: SquareLocation }>(
      'GET',
      `/v2/locations/${locationId}`
    );
    
    if (!response.location) {
      throw new POSApiError({
        code: 'LOCATION_NOT_FOUND',
        message: `Location ${locationId} not found`
      });
    }

    return response.location;
  }

  // Payment APIs
  async searchPayments(
    filter: SquarePaymentFilter,
    limit: number = 100
  ): Promise<{ payments?: SquarePayment[]; orders?: SquareOrder[]; cursor?: string }> {
    const body: any = {
      limit: Math.min(limit, 500), // Square's maximum
      sort_order: filter.sort_order || 'DESC'
    };

    if (filter.begin_time || filter.end_time) {
      body.begin_time = filter.begin_time;
      body.end_time = filter.end_time;
    }

    if (filter.location_id) {
      body.location_id = filter.location_id;
    }

    if (filter.cursor) {
      body.cursor = filter.cursor;
    }

    const response = await this.makeRequest<{
      payments?: SquarePayment[];
      cursor?: string;
    }>('POST', '/v2/payments/search', body);

    // Fetch associated orders if we have order IDs
    let orders: SquareOrder[] = [];
    if (response.payments) {
      const orderIds = response.payments
        .map(p => p.order_id)
        .filter(id => id) as string[];
      
      if (orderIds.length > 0) {
        orders = await this.getOrdersBatch(orderIds);
      }
    }

    return {
      payments: response.payments,
      orders,
      cursor: response.cursor
    };
  }

  async getPayment(paymentId: string): Promise<SquarePayment> {
    const response = await this.makeRequest<{ payment: SquarePayment }>(
      'GET',
      `/v2/payments/${paymentId}`
    );
    
    if (!response.payment) {
      throw new POSApiError({
        code: 'PAYMENT_NOT_FOUND',
        message: `Payment ${paymentId} not found`
      });
    }

    return response.payment;
  }

  // Order APIs
  async getOrder(orderId: string): Promise<SquareOrder> {
    const response = await this.makeRequest<{ order: SquareOrder }>(
      'GET',
      `/v2/orders/${orderId}`
    );
    
    if (!response.order) {
      throw new POSApiError({
        code: 'ORDER_NOT_FOUND',
        message: `Order ${orderId} not found`
      });
    }

    return response.order;
  }

  async getOrdersBatch(orderIds: string[]): Promise<SquareOrder[]> {
    const body = {
      order_ids: orderIds.slice(0, 500) // Square's batch limit
    };

    const response = await this.makeRequest<{ orders?: SquareOrder[] }>(
      'POST',
      '/v2/orders/batch-retrieve',
      body
    );
    
    return response.orders || [];
  }

  // OAuth APIs
  async exchangeOAuthCode(code: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    token_type?: string;
    merchant_id?: string;
  }> {
    const body = {
      client_id: this.credentials.applicationId,
      client_secret: 'client-secret', // In production, this would come from secure config
      code,
      grant_type: 'authorization_code'
    };

    // OAuth endpoint doesn't use the same auth headers
    const response = await this.makeRequest<any>(
      'POST',
      '/oauth2/token',
      body,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );

    if (!response.access_token) {
      throw new POSApiError({
        code: 'OAUTH_EXCHANGE_FAILED',
        message: 'Failed to exchange authorization code for token'
      });
    }

    return response;
  }

  async refreshOAuthToken(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_at?: string;
    token_type?: string;
  }> {
    const body = {
      client_id: this.credentials.applicationId,
      client_secret: 'client-secret', // In production, this would come from secure config
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    };

    const response = await this.makeRequest<any>(
      'POST',
      '/oauth2/token',
      body,
      {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    );

    if (!response.access_token) {
      throw new POSApiError({
        code: 'OAUTH_REFRESH_FAILED',
        message: 'Failed to refresh access token'
      });
    }

    return response;
  }

  // Webhook APIs
  async createWebhookSubscription(webhook: {
    name: string;
    event_types: string[];
    notification_url: string;
    api_version: string;
  }): Promise<{
    id: string;
    name: string;
    enabled: boolean;
    event_types: string[];
    notification_url: string;
    signature_key: string;
    created_at: string;
    updated_at: string;
  }> {
    const body = {
      subscription: webhook
    };

    const response = await this.makeRequest<{ subscription: any }>(
      'POST',
      '/v2/webhooks/subscriptions',
      body
    );

    if (!response.subscription) {
      throw new POSApiError({
        code: 'WEBHOOK_CREATION_FAILED',
        message: 'Failed to create webhook subscription'
      });
    }

    return response.subscription;
  }

  async listWebhookSubscriptions(): Promise<Array<{
    id: string;
    name: string;
    enabled: boolean;
    event_types?: string[];
    notification_url: string;
    signature_key: string;
    created_at: string;
    updated_at: string;
  }>> {
    const response = await this.makeRequest<{ subscriptions?: any[] }>(
      'GET',
      '/v2/webhooks/subscriptions'
    );
    
    return response.subscriptions || [];
  }

  async updateWebhookSubscription(subscriptionId: string, updates: any): Promise<{
    id: string;
    name: string;
    enabled: boolean;
    event_types?: string[];
    notification_url: string;
    signature_key: string;
    created_at: string;
    updated_at: string;
  }> {
    const body = {
      subscription: updates
    };

    const response = await this.makeRequest<{ subscription: any }>(
      'PUT',
      `/v2/webhooks/subscriptions/${subscriptionId}`,
      body
    );

    if (!response.subscription) {
      throw new POSApiError({
        code: 'WEBHOOK_UPDATE_FAILED',
        message: 'Failed to update webhook subscription'
      });
    }

    return response.subscription;
  }

  async deleteWebhookSubscription(subscriptionId: string): Promise<void> {
    await this.makeRequest(
      'DELETE',
      `/v2/webhooks/subscriptions/${subscriptionId}`
    );
  }

  // HTTP Client Implementation
  private async makeRequest<T = any>(
    method: string,
    path: string,
    body?: any,
    customHeaders?: Record<string, string>
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...this.headers, ...customHeaders };

    try {
      // In a real implementation, this would use axios or fetch
      // For now, we'll simulate the API calls for development
      const response = await this.simulateRequest<T>(method, path, body);
      
      if (response && typeof response === 'object' && 'errors' in response) {
        const apiResponse = response as SquareApiResponse<T>;
        if (apiResponse.errors && apiResponse.errors.length > 0) {
          const error = apiResponse.errors[0];
          throw new POSApiError({
            code: error.code,
            message: error.detail || error.code,
            statusCode: this.getStatusFromErrorCode(error.code),
            retryable: this.isErrorRetryable(error.code)
          });
        }
      }

      return response;
    } catch (error) {
      if (error instanceof POSApiError) {
        throw error;
      }

      throw new POSApiError({
        code: 'API_REQUEST_FAILED',
        message: 'Failed to make API request to Square',
        originalError: error,
        retryable: true
      });
    }
  }

  // Mock API simulation for development
  private async simulateRequest<T>(method: string, path: string, body?: any): Promise<T> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Return mock data based on the endpoint
    if (path === '/v2/merchants/me') {
      return {
        merchant: {
          id: 'MERCHANT_ID_MOCK',
          business_name: 'Aurora Café (Test)',
          country: 'SE',
          language_code: 'sv-SE',
          currency: 'SEK',
          status: 'ACTIVE',
          main_location_id: 'LOCATION_ID_MOCK',
          created_at: '2024-01-01T00:00:00Z'
        }
      } as T;
    }

    if (path === '/v2/locations') {
      return {
        locations: [
          {
            id: 'LOCATION_ID_MOCK',
            name: 'Aurora Café Huvudkontor',
            address: {
              address_line_1: 'Kungsgatan 12',
              locality: 'Stockholm',
              administrative_district_level_1: 'Stockholm',
              postal_code: '111 43',
              country: 'SE'
            },
            timezone: 'Europe/Stockholm',
            merchant_id: 'MERCHANT_ID_MOCK',
            phone_number: '+46 8 123 456 78',
            business_name: 'Aurora Café',
            status: 'ACTIVE',
            created_at: '2024-01-01T00:00:00Z',
            capabilities: ['CREDIT_CARD_PROCESSING', 'AUTOMATIC_TRANSFERS']
          }
        ]
      } as T;
    }

    if (path.startsWith('/v2/locations/')) {
      return {
        location: {
          id: 'LOCATION_ID_MOCK',
          name: 'Aurora Café Huvudkontor',
          address: {
            address_line_1: 'Kungsgatan 12',
            locality: 'Stockholm',
            administrative_district_level_1: 'Stockholm',
            postal_code: '111 43',
            country: 'SE'
          },
          timezone: 'Europe/Stockholm',
          merchant_id: 'MERCHANT_ID_MOCK',
          phone_number: '+46 8 123 456 78',
          business_name: 'Aurora Café',
          status: 'ACTIVE',
          created_at: '2024-01-01T00:00:00Z',
          capabilities: ['CREDIT_CARD_PROCESSING', 'AUTOMATIC_TRANSFERS']
        }
      } as T;
    }

    if (path === '/v2/payments/search') {
      return {
        payments: [
          {
            id: 'PAYMENT_MOCK_1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            amount_money: { amount: 4500, currency: 'SEK' },
            total_money: { amount: 4500, currency: 'SEK' },
            status: 'COMPLETED',
            source_type: 'CARD',
            location_id: 'LOCATION_ID_MOCK',
            order_id: 'ORDER_MOCK_1',
            receipt_number: '001-001-001',
            card_details: {
              status: 'CAPTURED',
              card: {
                card_brand: 'VISA',
                last_4: '1234',
                card_type: 'DEBIT'
              },
              entry_method: 'CHIP'
            }
          }
        ],
        cursor: undefined
      } as T;
    }

    if (path === '/oauth2/token') {
      return {
        access_token: 'mock_access_token_' + Date.now(),
        refresh_token: 'mock_refresh_token_' + Date.now(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        token_type: 'Bearer',
        merchant_id: 'MERCHANT_ID_MOCK'
      } as T;
    }

    if (path === '/v2/webhooks/subscriptions' && method === 'POST') {
      return {
        subscription: {
          id: 'WEBHOOK_MOCK_' + Date.now(),
          name: body?.subscription?.name || 'AI Feedback Platform Webhook',
          enabled: true,
          event_types: body?.subscription?.event_types || ['payment.created'],
          notification_url: body?.subscription?.notification_url || '',
          signature_key: 'mock_signature_key_' + Date.now(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      } as T;
    }

    if (path === '/v2/webhooks/subscriptions' && method === 'GET') {
      return {
        subscriptions: []
      } as T;
    }

    // Default empty response
    return {} as T;
  }

  private getStatusFromErrorCode(code: string): number {
    const codeMap: Record<string, number> = {
      'UNAUTHORIZED': 401,
      'FORBIDDEN': 403,
      'NOT_FOUND': 404,
      'BAD_REQUEST': 400,
      'RATE_LIMITED': 429,
      'INTERNAL_SERVER_ERROR': 500,
      'SERVICE_UNAVAILABLE': 503
    };
    return codeMap[code] || 400;
  }

  private isErrorRetryable(code: string): boolean {
    const retryableCodes = [
      'RATE_LIMITED',
      'INTERNAL_SERVER_ERROR',
      'SERVICE_UNAVAILABLE',
      'GATEWAY_TIMEOUT'
    ];
    return retryableCodes.includes(code);
  }
}