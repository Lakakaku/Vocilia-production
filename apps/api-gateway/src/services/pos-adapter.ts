import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

interface POSIntegrationConfig {
  provider: string;
  apiKey: string;
  webhookSecret: string;
  merchantId: string;
  storeId?: string;
  environment: 'production' | 'sandbox';
  customSettings?: Record<string, any>;
}

interface Transaction {
  id: string;
  amount: number;
  timestamp: Date;
  status: string;
  reference?: string;
  metadata?: Record<string, any>;
}

interface RateLimits {
  remaining: number;
  limit: number;
  resetAt: Date;
}

export class POSAdapter {
  private client: AxiosInstance;
  private config: POSIntegrationConfig;

  constructor(config: POSIntegrationConfig) {
    this.config = config;
    this.client = this.initializeClient();
  }

  private initializeClient(): AxiosInstance {
    let baseURL: string;
    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    switch (this.config.provider) {
      case 'square':
        baseURL = this.config.environment === 'production' 
          ? 'https://connect.squareup.com/v2'
          : 'https://connect.squareupsandbox.com/v2';
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        headers['Square-Version'] = '2024-01-18';
        break;
      
      case 'shopify':
        baseURL = `https://${this.config.merchantId}.myshopify.com/admin/api/2024-01`;
        headers['X-Shopify-Access-Token'] = this.config.apiKey;
        break;
      
      case 'zettle':
        baseURL = 'https://oauth.zettle.com';
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
        break;
      
      default:
        throw new Error(`Unsupported POS provider: ${this.config.provider}`);
    }

    return axios.create({
      baseURL,
      headers,
      timeout: 10000
    });
  }

  async testConnection(): Promise<{ success: boolean; responseTime: number; statusCode: number }> {
    const startTime = Date.now();
    try {
      let response;
      
      switch (this.config.provider) {
        case 'square':
          response = await this.client.get('/merchants/me');
          break;
        case 'shopify':
          response = await this.client.get('/shop.json');
          break;
        case 'zettle':
          response = await this.client.get('/users/self');
          break;
        default:
          throw new Error(`Unsupported provider: ${this.config.provider}`);
      }
      
      return {
        success: true,
        responseTime: Date.now() - startTime,
        statusCode: response.status
      };
    } catch (error) {
      logger.error('POS connection test failed:', error);
      throw error;
    }
  }

  async authenticate(): Promise<{ success: boolean; tokenExpiry?: Date; scopes?: string[] }> {
    try {
      switch (this.config.provider) {
        case 'square':
          const squareResponse = await this.client.get('/merchants/me');
          return {
            success: true,
            scopes: ['MERCHANT_PROFILE_READ', 'PAYMENTS_READ']
          };
        
        case 'shopify':
          const shopifyResponse = await this.client.get('/shop.json');
          return {
            success: true,
            scopes: shopifyResponse.data.shop.plan_name ? ['read_orders', 'read_products'] : []
          };
        
        case 'zettle':
          const zettleResponse = await this.client.get('/users/self');
          return {
            success: true,
            tokenExpiry: new Date(Date.now() + 3600000) // 1 hour
          };
        
        default:
          return { success: false };
      }
    } catch (error) {
      logger.error('Authentication failed:', error);
      return { success: false };
    }
  }

  async fetchRecentTransactions(limit: number = 10): Promise<Transaction[]> {
    try {
      let transactions: Transaction[] = [];
      
      switch (this.config.provider) {
        case 'square':
          const squareResponse = await this.client.post('/payments/search', {
            limit,
            location_ids: this.config.storeId ? [this.config.storeId] : undefined,
            sort: { field: 'CREATED_AT', order: 'DESC' }
          });
          
          transactions = squareResponse.data.payments?.map((payment: any) => ({
            id: payment.id,
            amount: payment.amount_money.amount / 100,
            timestamp: new Date(payment.created_at),
            status: payment.status,
            reference: payment.reference_id,
            metadata: payment.note ? { note: payment.note } : undefined
          })) || [];
          break;
        
        case 'shopify':
          const shopifyResponse = await this.client.get('/orders.json', {
            params: {
              limit,
              status: 'any',
              order: 'created_at desc'
            }
          });
          
          transactions = shopifyResponse.data.orders?.map((order: any) => ({
            id: order.id.toString(),
            amount: parseFloat(order.total_price),
            timestamp: new Date(order.created_at),
            status: order.financial_status,
            reference: order.name,
            metadata: {
              customer: order.customer?.email,
              line_items: order.line_items?.length
            }
          })) || [];
          break;
        
        case 'zettle':
          const zettleResponse = await this.client.get(`/purchases/v2/${this.config.merchantId}`, {
            params: {
              limit,
              descending: true
            }
          });
          
          transactions = zettleResponse.data.purchases?.map((purchase: any) => ({
            id: purchase.purchaseUUID,
            amount: purchase.amount / 100,
            timestamp: new Date(purchase.timestamp),
            status: purchase.refunded ? 'REFUNDED' : 'COMPLETED',
            reference: purchase.userDisplayName,
            metadata: purchase.products
          })) || [];
          break;
      }
      
      return transactions;
    } catch (error) {
      logger.error('Failed to fetch transactions:', error);
      throw error;
    }
  }

  async getRateLimits(): Promise<RateLimits> {
    try {
      // Make a lightweight request to check rate limits
      let response;
      
      switch (this.config.provider) {
        case 'square':
          response = await this.client.get('/locations');
          return {
            remaining: parseInt(response.headers['x-ratelimit-remaining'] || '1000'),
            limit: parseInt(response.headers['x-ratelimit-limit'] || '1000'),
            resetAt: new Date(parseInt(response.headers['x-ratelimit-reset'] || '0') * 1000)
          };
        
        case 'shopify':
          response = await this.client.get('/shop.json');
          const shopifyHeader = response.headers['x-shopify-shop-api-call-limit'] || '40/40';
          const [used, limit] = shopifyHeader.split('/').map(Number);
          return {
            remaining: limit - used,
            limit,
            resetAt: new Date(Date.now() + 1000) // Shopify uses a leaky bucket
          };
        
        case 'zettle':
          // Zettle doesn't expose rate limits in headers
          return {
            remaining: 100,
            limit: 100,
            resetAt: new Date(Date.now() + 60000)
          };
        
        default:
          return {
            remaining: 1000,
            limit: 1000,
            resetAt: new Date(Date.now() + 3600000)
          };
      }
    } catch (error) {
      logger.error('Failed to get rate limits:', error);
      throw error;
    }
  }

  async verifyTransaction(transactionId: string): Promise<Transaction | null> {
    try {
      switch (this.config.provider) {
        case 'square':
          const squareResponse = await this.client.get(`/payments/${transactionId}`);
          const payment = squareResponse.data.payment;
          return {
            id: payment.id,
            amount: payment.amount_money.amount / 100,
            timestamp: new Date(payment.created_at),
            status: payment.status,
            reference: payment.reference_id
          };
        
        case 'shopify':
          const shopifyResponse = await this.client.get(`/orders/${transactionId}.json`);
          const order = shopifyResponse.data.order;
          return {
            id: order.id.toString(),
            amount: parseFloat(order.total_price),
            timestamp: new Date(order.created_at),
            status: order.financial_status,
            reference: order.name
          };
        
        case 'zettle':
          const zettleResponse = await this.client.get(`/purchases/v2/${transactionId}`);
          const purchase = zettleResponse.data;
          return {
            id: purchase.purchaseUUID,
            amount: purchase.amount / 100,
            timestamp: new Date(purchase.timestamp),
            status: purchase.refunded ? 'REFUNDED' : 'COMPLETED',
            reference: purchase.userDisplayName
          };
        
        default:
          return null;
      }
    } catch (error) {
      logger.error(`Failed to verify transaction ${transactionId}:`, error);
      return null;
    }
  }
}