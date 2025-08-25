import { POSProvider } from '@ai-feedback-platform/shared-types';
import { db } from '@ai-feedback/database';
import { logger } from '../utils/logger';
import { POSMetricsCollector } from './pos-metrics-collector';

export interface POSHealthStatus {
  healthy: boolean;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  lastCheck: Date;
  error?: string;
  details: {
    apiConnectivity: boolean;
    authenticationStatus: 'valid' | 'expired' | 'invalid' | 'missing';
    webhookEndpoint: boolean;
    rateLimit: {
      remaining: number;
      reset: Date;
      exceeded: boolean;
    };
    lastSuccessfulCall?: Date;
    errorRate: number; // percentage
  };
}

export interface BusinessConnectionHealth {
  businessId: string;
  businessName: string;
  healthy: boolean;
  lastSync: Date;
  errors: string[];
  metrics: {
    successRate: number;
    averageResponseTime: number;
    totalCalls: number;
    failedCalls: number;
  };
}

export interface WebhookHealth {
  webhookId: string;
  url: string;
  active: boolean;
  healthy: boolean;
  lastDelivery?: Date;
  deliveryRate: number;
  recentFailures: number;
  averageProcessingTime: number;
  retryAttempts: number;
}

export class POSHealthMonitor {
  private metricsCollector: POSMetricsCollector;
  
  constructor() {
    this.metricsCollector = new POSMetricsCollector();
  }

  async checkAllProviders(): Promise<Record<POSProvider, POSHealthStatus>> {
    const providers: POSProvider[] = ['square', 'shopify', 'zettle'];
    const results: Record<POSProvider, POSHealthStatus> = {} as any;

    await Promise.allSettled(
      providers.map(async (provider) => {
        try {
          results[provider] = await this.checkProvider(provider);
        } catch (error) {
          logger.error(`Failed to check ${provider} health:`, error);
          results[provider] = this.createUnhealthyStatus(error);
        }
      })
    );

    return results;
  }

  async checkProvider(provider: POSProvider): Promise<POSHealthStatus> {
    const startTime = Date.now();
    
    try {
      // Check API connectivity
      const apiConnectivity = await this.checkApiConnectivity(provider);
      
      // Check authentication status
      const authStatus = await this.checkAuthenticationStatus(provider);
      
      // Check webhook endpoint
      const webhookStatus = await this.checkWebhookEndpoint(provider);
      
      // Check rate limits
      const rateLimit = await this.checkRateLimit(provider);
      
      // Get error rate from metrics
      const errorRate = await this.getErrorRate(provider);
      
      // Get last successful call
      const lastSuccessfulCall = await this.getLastSuccessfulCall(provider);

      const responseTime = Date.now() - startTime;
      const healthy = apiConnectivity && authStatus === 'valid' && webhookStatus && !rateLimit.exceeded;

      // Record health check metrics
      this.metricsCollector.recordHealthCheck(provider, healthy, responseTime);

      return {
        healthy,
        status: this.determineStatus(healthy, errorRate),
        responseTime,
        lastCheck: new Date(),
        details: {
          apiConnectivity,
          authenticationStatus: authStatus,
          webhookEndpoint: webhookStatus,
          rateLimit,
          lastSuccessfulCall,
          errorRate
        }
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error(`Error checking ${provider} health:`, error);
      
      // Record failed health check
      this.metricsCollector.recordHealthCheck(provider, false, responseTime);
      
      return this.createUnhealthyStatus(error);
    }
  }

  private async checkApiConnectivity(provider: POSProvider): Promise<boolean> {
    try {
      switch (provider) {
        case 'square':
          return await this.checkSquareConnectivity();
        case 'shopify':
          return await this.checkShopifyConnectivity();
        case 'zettle':
          return await this.checkZettleConnectivity();
        default:
          return false;
      }
    } catch (error) {
      logger.error(`API connectivity check failed for ${provider}:`, error);
      return false;
    }
  }

  private async checkSquareConnectivity(): Promise<boolean> {
    try {
      // Test Square API with a lightweight endpoint
      const response = await fetch('https://connect.squareup.com/v2/locations', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
          'Square-Version': '2023-10-18',
          'Content-Type': 'application/json'
        }
      });
      
      return response.status === 200 || response.status === 401; // 401 means API is up but token might be expired
    } catch (error) {
      return false;
    }
  }

  private async checkShopifyConnectivity(): Promise<boolean> {
    try {
      // Test Shopify API status endpoint
      const response = await fetch('https://status.shopify.com/api/v2/status.json');
      const data = await response.json();
      return data.status.indicator === 'none' || data.status.indicator === 'minor';
    } catch (error) {
      return false;
    }
  }

  private async checkZettleConnectivity(): Promise<boolean> {
    try {
      // Test Zettle API with a lightweight endpoint
      const response = await fetch('https://oauth.zettle.com/users/self', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${process.env.ZETTLE_ACCESS_TOKEN}`
        }
      });
      
      return response.status === 200 || response.status === 401;
    } catch (error) {
      return false;
    }
  }

  private async checkAuthenticationStatus(provider: POSProvider): Promise<'valid' | 'expired' | 'invalid' | 'missing'> {
    try {
      // Get active credentials for this provider
      const { data: credentials } = await db.client
        .from('pos_credentials')
        .select('*')
        .eq('provider', provider)
        .eq('is_active', true);

      if (!credentials || credentials.length === 0) {
        return 'missing';
      }

      // Check if tokens are expired
      const now = new Date();
      const expiredCredentials = credentials.filter(cred => 
        cred.token_expires_at && new Date(cred.token_expires_at) < now
      );

      if (expiredCredentials.length > 0) {
        return 'expired';
      }

      // Test authentication with API call
      const validCredentials = await Promise.allSettled(
        credentials.map(cred => this.testCredentials(provider, cred))
      );

      const validCount = validCredentials.filter(result => 
        result.status === 'fulfilled' && result.value
      ).length;

      if (validCount === credentials.length) {
        return 'valid';
      } else if (validCount > 0) {
        return 'expired'; // Some valid, some invalid
      } else {
        return 'invalid';
      }
    } catch (error) {
      logger.error(`Authentication check failed for ${provider}:`, error);
      return 'invalid';
    }
  }

  private async testCredentials(provider: POSProvider, credentials: any): Promise<boolean> {
    try {
      switch (provider) {
        case 'square':
          const squareResponse = await fetch('https://connect.squareup.com/v2/locations', {
            headers: { 'Authorization': `Bearer ${credentials.access_token}` }
          });
          return squareResponse.status === 200;
          
        case 'shopify':
          const shopifyResponse = await fetch(`${credentials.shop_domain}/admin/api/2023-10/shop.json`, {
            headers: { 'X-Shopify-Access-Token': credentials.access_token }
          });
          return shopifyResponse.status === 200;
          
        case 'zettle':
          const zettleResponse = await fetch('https://oauth.zettle.com/users/self', {
            headers: { 'Authorization': `Bearer ${credentials.access_token}` }
          });
          return zettleResponse.status === 200;
          
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  private async checkWebhookEndpoint(provider: POSProvider): Promise<boolean> {
    try {
      // Test webhook endpoint accessibility
      const webhookUrl = `${process.env.API_BASE_URL}/webhooks/${provider}`;
      
      const response = await fetch(webhookUrl, {
        method: 'GET',
        timeout: 5000
      });
      
      // Webhook endpoints should return 405 (Method Not Allowed) for GET requests
      return response.status === 405 || response.status === 200;
    } catch (error) {
      logger.error(`Webhook endpoint check failed for ${provider}:`, error);
      return false;
    }
  }

  private async checkRateLimit(provider: POSProvider): Promise<{
    remaining: number;
    reset: Date;
    exceeded: boolean;
  }> {
    try {
      // Get rate limit info from Redis cache
      const rateLimitKey = `rate_limit:${provider}`;
      const redisData = await this.metricsCollector.getCachedData(rateLimitKey);
      
      if (redisData) {
        return JSON.parse(redisData);
      }

      // Default rate limit status
      return {
        remaining: 1000,
        reset: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        exceeded: false
      };
    } catch (error) {
      return {
        remaining: 0,
        reset: new Date(),
        exceeded: false
      };
    }
  }

  private async getErrorRate(provider: POSProvider): Promise<number> {
    try {
      // Get error rate from last 24 hours
      const { data: errorLogs } = await db.client
        .from('pos_api_logs')
        .select('success')
        .eq('provider', provider)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!errorLogs || errorLogs.length === 0) {
        return 0;
      }

      const errorCount = errorLogs.filter(log => !log.success).length;
      return Math.round((errorCount / errorLogs.length) * 100);
    } catch (error) {
      return 0;
    }
  }

  private async getLastSuccessfulCall(provider: POSProvider): Promise<Date | undefined> {
    try {
      const { data: lastSuccess } = await db.client
        .from('pos_api_logs')
        .select('created_at')
        .eq('provider', provider)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(1);

      return lastSuccess?.[0]?.created_at ? new Date(lastSuccess[0].created_at) : undefined;
    } catch (error) {
      return undefined;
    }
  }

  async checkBusinessConnections(provider: POSProvider): Promise<BusinessConnectionHealth[]> {
    try {
      const { data: businesses } = await db.client
        .from('businesses')
        .select(`
          id,
          name,
          pos_credentials!inner (
            provider,
            is_active,
            last_sync_at
          )
        `)
        .eq('pos_credentials.provider', provider)
        .eq('pos_credentials.is_active', true);

      if (!businesses) {
        return [];
      }

      return Promise.all(
        businesses.map(async (business) => {
          const metrics = await this.getBusinessMetrics(business.id, provider);
          
          return {
            businessId: business.id,
            businessName: business.name,
            healthy: metrics.successRate > 80,
            lastSync: new Date(business.pos_credentials.last_sync_at || Date.now()),
            errors: await this.getBusinessErrors(business.id, provider),
            metrics
          };
        })
      );
    } catch (error) {
      logger.error(`Error checking business connections for ${provider}:`, error);
      return [];
    }
  }

  private async getBusinessMetrics(businessId: string, provider: POSProvider) {
    try {
      const { data: logs } = await db.client
        .from('pos_api_logs')
        .select('*')
        .eq('business_id', businessId)
        .eq('provider', provider)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      if (!logs || logs.length === 0) {
        return {
          successRate: 100,
          averageResponseTime: 0,
          totalCalls: 0,
          failedCalls: 0
        };
      }

      const successfulCalls = logs.filter(log => log.success);
      const successRate = Math.round((successfulCalls.length / logs.length) * 100);
      const averageResponseTime = logs.reduce((sum, log) => sum + (log.response_time || 0), 0) / logs.length;

      return {
        successRate,
        averageResponseTime: Math.round(averageResponseTime),
        totalCalls: logs.length,
        failedCalls: logs.length - successfulCalls.length
      };
    } catch (error) {
      return {
        successRate: 0,
        averageResponseTime: 0,
        totalCalls: 0,
        failedCalls: 0
      };
    }
  }

  private async getBusinessErrors(businessId: string, provider: POSProvider): Promise<string[]> {
    try {
      const { data: errorLogs } = await db.client
        .from('pos_api_logs')
        .select('error_message')
        .eq('business_id', businessId)
        .eq('provider', provider)
        .eq('success', false)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      return errorLogs?.map(log => log.error_message).filter(Boolean) || [];
    } catch (error) {
      return [];
    }
  }

  async checkWebhookHealth(provider: POSProvider): Promise<WebhookHealth[]> {
    try {
      const { data: webhooks } = await db.client
        .from('pos_webhooks')
        .select('*')
        .eq('provider', provider);

      if (!webhooks) {
        return [];
      }

      return Promise.all(
        webhooks.map(async (webhook) => {
          const deliveryMetrics = await this.getWebhookDeliveryMetrics(webhook.id);
          
          return {
            webhookId: webhook.id,
            url: webhook.url,
            active: webhook.is_active,
            healthy: deliveryMetrics.deliveryRate > 95,
            lastDelivery: deliveryMetrics.lastDelivery,
            deliveryRate: deliveryMetrics.deliveryRate,
            recentFailures: deliveryMetrics.recentFailures,
            averageProcessingTime: deliveryMetrics.averageProcessingTime,
            retryAttempts: deliveryMetrics.retryAttempts
          };
        })
      );
    } catch (error) {
      logger.error(`Error checking webhook health for ${provider}:`, error);
      return [];
    }
  }

  private async getWebhookDeliveryMetrics(webhookId: string) {
    try {
      const { data: deliveries } = await db.client
        .from('webhook_deliveries')
        .select('*')
        .eq('webhook_id', webhookId)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (!deliveries || deliveries.length === 0) {
        return {
          lastDelivery: undefined,
          deliveryRate: 100,
          recentFailures: 0,
          averageProcessingTime: 0,
          retryAttempts: 0
        };
      }

      const successfulDeliveries = deliveries.filter(d => d.status === 'success');
      const deliveryRate = Math.round((successfulDeliveries.length / deliveries.length) * 100);
      const recentFailures = deliveries.filter(d => d.status === 'failed').length;
      const averageProcessingTime = deliveries.reduce((sum, d) => sum + (d.processing_time || 0), 0) / deliveries.length;
      const retryAttempts = deliveries.reduce((sum, d) => sum + (d.retry_count || 0), 0);

      return {
        lastDelivery: deliveries[0]?.created_at ? new Date(deliveries[0].created_at) : undefined,
        deliveryRate,
        recentFailures,
        averageProcessingTime: Math.round(averageProcessingTime),
        retryAttempts
      };
    } catch (error) {
      return {
        lastDelivery: undefined,
        deliveryRate: 0,
        recentFailures: 0,
        averageProcessingTime: 0,
        retryAttempts: 0
      };
    }
  }

  async testConnection(provider: POSProvider, businessId?: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      let credentials;
      
      if (businessId) {
        const { data: businessCredentials } = await db.client
          .from('pos_credentials')
          .select('*')
          .eq('business_id', businessId)
          .eq('provider', provider)
          .eq('is_active', true)
          .single();
          
        credentials = businessCredentials;
      } else {
        // Use system credentials for testing
        credentials = this.getSystemCredentials(provider);
      }

      if (!credentials) {
        return {
          success: false,
          error: 'No credentials found',
          responseTime: Date.now() - startTime
        };
      }

      const testResult = await this.performConnectionTest(provider, credentials);
      const responseTime = Date.now() - startTime;

      // Log test results
      if (businessId) {
        await this.logApiCall(businessId, provider, 'test_connection', testResult.success, responseTime, testResult.error);
      }

      return {
        ...testResult,
        responseTime
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      if (businessId) {
        await this.logApiCall(businessId, provider, 'test_connection', false, responseTime, error);
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime
      };
    }
  }

  private async performConnectionTest(provider: POSProvider, credentials: any): Promise<{ success: boolean; error?: string; details?: any }> {
    try {
      switch (provider) {
        case 'square':
          return await this.testSquareConnection(credentials);
        case 'shopify':
          return await this.testShopifyConnection(credentials);
        case 'zettle':
          return await this.testZettleConnection(credentials);
        default:
          return { success: false, error: 'Unsupported provider' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async testSquareConnection(credentials: any) {
    const response = await fetch('https://connect.squareup.com/v2/locations', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Square-Version': '2023-10-18',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        details: {
          locations: data.locations?.length || 0,
          merchant_id: data.locations?.[0]?.merchant_id
        }
      };
    } else {
      const error = await response.text();
      return { success: false, error: `Square API error: ${response.status} - ${error}` };
    }
  }

  private async testShopifyConnection(credentials: any) {
    const response = await fetch(`${credentials.shop_domain}/admin/api/2023-10/shop.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': credentials.access_token,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        details: {
          shop_name: data.shop?.name,
          shop_domain: data.shop?.domain,
          plan: data.shop?.plan_name
        }
      };
    } else {
      const error = await response.text();
      return { success: false, error: `Shopify API error: ${response.status} - ${error}` };
    }
  }

  private async testZettleConnection(credentials: any) {
    const response = await fetch('https://oauth.zettle.com/users/self', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${credentials.access_token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        success: true,
        details: {
          user_uuid: data.uuid,
          organization_uuid: data.organizationUuid
        }
      };
    } else {
      const error = await response.text();
      return { success: false, error: `Zettle API error: ${response.status} - ${error}` };
    }
  }

  async getMetrics(): Promise<any> {
    return this.metricsCollector.getAllMetrics();
  }

  private async logApiCall(
    businessId: string,
    provider: POSProvider,
    endpoint: string,
    success: boolean,
    responseTime: number,
    error?: any
  ): Promise<void> {
    try {
      await db.client
        .from('pos_api_logs')
        .insert({
          business_id: businessId,
          provider,
          endpoint,
          success,
          response_time: responseTime,
          error_message: error ? (error instanceof Error ? error.message : String(error)) : null,
          created_at: new Date().toISOString()
        });
    } catch (logError) {
      logger.error('Failed to log API call:', logError);
    }
  }

  private getSystemCredentials(provider: POSProvider): any {
    switch (provider) {
      case 'square':
        return {
          access_token: process.env.SQUARE_ACCESS_TOKEN,
          application_id: process.env.SQUARE_APPLICATION_ID
        };
      case 'shopify':
        return {
          access_token: process.env.SHOPIFY_ACCESS_TOKEN,
          shop_domain: process.env.SHOPIFY_SHOP_DOMAIN
        };
      case 'zettle':
        return {
          access_token: process.env.ZETTLE_ACCESS_TOKEN,
          client_id: process.env.ZETTLE_CLIENT_ID
        };
      default:
        return null;
    }
  }

  private determineStatus(healthy: boolean, errorRate: number): 'healthy' | 'degraded' | 'unhealthy' {
    if (!healthy) return 'unhealthy';
    if (errorRate > 10) return 'degraded';
    return 'healthy';
  }

  private createUnhealthyStatus(error: any): POSHealthStatus {
    return {
      healthy: false,
      status: 'unhealthy',
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : String(error),
      details: {
        apiConnectivity: false,
        authenticationStatus: 'invalid',
        webhookEndpoint: false,
        rateLimit: {
          remaining: 0,
          reset: new Date(),
          exceeded: false
        },
        errorRate: 100
      }
    };
  }
}