import { POSProvider } from '@ai-feedback-platform/shared-types';
import { logger } from '../utils/logger';
import * as promClient from 'prom-client';
import { createClient } from 'redis';

export class POSMetricsCollector {
  private redisClient: any;
  private metrics: Record<string, any> = {};

  constructor() {
    this.initializeRedis();
    this.initializeMetrics();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Redis Client Error:', err);
      });

      await this.redisClient.connect();
      logger.info('POS Metrics Collector connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis for POS metrics:', error);
    }
  }

  private initializeMetrics() {
    // POS API response times
    this.metrics.posApiResponseTime = new promClient.Histogram({
      name: 'pos_api_response_time_seconds',
      help: 'POS API response time in seconds',
      labelNames: ['provider', 'endpoint', 'status'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
    });

    // POS API success/failure rates
    this.metrics.posApiRequests = new promClient.Counter({
      name: 'pos_api_requests_total',
      help: 'Total number of POS API requests',
      labelNames: ['provider', 'endpoint', 'status']
    });

    // POS connection status
    this.metrics.posConnectionStatus = new promClient.Gauge({
      name: 'pos_connection_status',
      help: 'POS connection status (1 = connected, 0 = disconnected)',
      labelNames: ['provider', 'business_id']
    });

    // POS authentication status
    this.metrics.posAuthStatus = new promClient.Gauge({
      name: 'pos_auth_status',
      help: 'POS authentication status (1 = valid, 0 = invalid)',
      labelNames: ['provider', 'business_id']
    });

    // Webhook delivery metrics
    this.metrics.webhookDeliveries = new promClient.Counter({
      name: 'pos_webhook_deliveries_total',
      help: 'Total number of webhook deliveries',
      labelNames: ['provider', 'status']
    });

    // Webhook processing time
    this.metrics.webhookProcessingTime = new promClient.Histogram({
      name: 'pos_webhook_processing_time_seconds',
      help: 'Webhook processing time in seconds',
      labelNames: ['provider', 'event_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
    });

    // Webhook retry attempts
    this.metrics.webhookRetries = new promClient.Counter({
      name: 'pos_webhook_retries_total',
      help: 'Total number of webhook retry attempts',
      labelNames: ['provider', 'attempt_number']
    });

    // POS rate limit metrics
    this.metrics.posRateLimit = new promClient.Gauge({
      name: 'pos_rate_limit_remaining',
      help: 'Remaining POS API rate limit',
      labelNames: ['provider']
    });

    // POS health check metrics
    this.metrics.posHealthChecks = new promClient.Counter({
      name: 'pos_health_checks_total',
      help: 'Total number of POS health checks',
      labelNames: ['provider', 'status']
    });

    // Transaction verification metrics
    this.metrics.transactionVerifications = new promClient.Counter({
      name: 'pos_transaction_verifications_total',
      help: 'Total number of transaction verifications',
      labelNames: ['provider', 'result']
    });

    // Transaction verification time
    this.metrics.transactionVerificationTime = new promClient.Histogram({
      name: 'pos_transaction_verification_time_seconds',
      help: 'Transaction verification time in seconds',
      labelNames: ['provider'],
      buckets: [0.1, 0.5, 1, 2, 5, 10]
    });

    // POS error rates
    this.metrics.posErrorRate = new promClient.Gauge({
      name: 'pos_error_rate_percent',
      help: 'POS API error rate percentage',
      labelNames: ['provider']
    });

    // Business connection health
    this.metrics.businessConnectionHealth = new promClient.Gauge({
      name: 'pos_business_connection_health',
      help: 'Business POS connection health score (0-100)',
      labelNames: ['provider', 'business_id']
    });

    // OAuth token expiry
    this.metrics.oauthTokenExpiry = new promClient.Gauge({
      name: 'pos_oauth_token_expiry_timestamp',
      help: 'OAuth token expiry timestamp',
      labelNames: ['provider', 'business_id']
    });

    // POS sync metrics
    this.metrics.posSyncDuration = new promClient.Histogram({
      name: 'pos_sync_duration_seconds',
      help: 'POS data sync duration in seconds',
      labelNames: ['provider', 'sync_type'],
      buckets: [1, 5, 10, 30, 60, 300]
    });

    // POS sync success rate
    this.metrics.posSyncSuccess = new promClient.Counter({
      name: 'pos_sync_operations_total',
      help: 'Total number of POS sync operations',
      labelNames: ['provider', 'sync_type', 'status']
    });

    logger.info('POS metrics initialized');
  }

  // Record API call metrics
  recordApiCall(
    provider: POSProvider,
    endpoint: string,
    success: boolean,
    responseTimeMs: number,
    statusCode?: number
  ): void {
    const status = success ? 'success' : 'error';
    const responseTimeSeconds = responseTimeMs / 1000;

    this.metrics.posApiResponseTime
      .labels(provider, endpoint, status)
      .observe(responseTimeSeconds);

    this.metrics.posApiRequests
      .labels(provider, endpoint, status)
      .inc();

    // Update error rate in Redis for quick access
    this.updateErrorRate(provider, success);
  }

  // Record webhook delivery metrics
  recordWebhookDelivery(
    provider: POSProvider,
    eventType: string,
    success: boolean,
    processingTimeMs: number,
    retryAttempt?: number
  ): void {
    const status = success ? 'success' : 'failed';

    this.metrics.webhookDeliveries
      .labels(provider, status)
      .inc();

    this.metrics.webhookProcessingTime
      .labels(provider, eventType)
      .observe(processingTimeMs / 1000);

    if (retryAttempt && retryAttempt > 1) {
      this.metrics.webhookRetries
        .labels(provider, retryAttempt.toString())
        .inc();
    }
  }

  // Record health check metrics
  recordHealthCheck(provider: POSProvider, healthy: boolean, responseTimeMs: number): void {
    const status = healthy ? 'healthy' : 'unhealthy';

    this.metrics.posHealthChecks
      .labels(provider, status)
      .inc();

    this.metrics.posApiResponseTime
      .labels(provider, 'health_check', status)
      .observe(responseTimeMs / 1000);
  }

  // Record connection status
  recordConnectionStatus(provider: POSProvider, businessId: string, connected: boolean): void {
    this.metrics.posConnectionStatus
      .labels(provider, businessId)
      .set(connected ? 1 : 0);
  }

  // Record authentication status
  recordAuthStatus(provider: POSProvider, businessId: string, valid: boolean): void {
    this.metrics.posAuthStatus
      .labels(provider, businessId)
      .set(valid ? 1 : 0);
  }

  // Record transaction verification
  recordTransactionVerification(
    provider: POSProvider,
    result: 'found' | 'not_found' | 'error',
    verificationTimeMs: number
  ): void {
    this.metrics.transactionVerifications
      .labels(provider, result)
      .inc();

    this.metrics.transactionVerificationTime
      .labels(provider)
      .observe(verificationTimeMs / 1000);
  }

  // Record rate limit information
  recordRateLimit(provider: POSProvider, remaining: number): void {
    this.metrics.posRateLimit
      .labels(provider)
      .set(remaining);
  }

  // Record business connection health score
  recordBusinessHealth(provider: POSProvider, businessId: string, healthScore: number): void {
    this.metrics.businessConnectionHealth
      .labels(provider, businessId)
      .set(healthScore);
  }

  // Record OAuth token expiry
  recordTokenExpiry(provider: POSProvider, businessId: string, expiryTimestamp: number): void {
    this.metrics.oauthTokenExpiry
      .labels(provider, businessId)
      .set(expiryTimestamp);
  }

  // Record POS sync operations
  recordSyncOperation(
    provider: POSProvider,
    syncType: string,
    success: boolean,
    durationMs: number
  ): void {
    const status = success ? 'success' : 'error';

    this.metrics.posSyncDuration
      .labels(provider, syncType)
      .observe(durationMs / 1000);

    this.metrics.posSyncSuccess
      .labels(provider, syncType, status)
      .inc();
  }

  // Update error rate in Redis
  private async updateErrorRate(provider: POSProvider, success: boolean): Promise<void> {
    if (!this.redisClient || !this.redisClient.isOpen) {
      return;
    }

    try {
      const key = `pos_error_rate:${provider}`;
      const window = 300; // 5 minutes
      const now = Date.now();

      // Add current call result
      await this.redisClient.zAdd(key, {
        score: now,
        value: success ? '1' : '0'
      });

      // Remove old entries
      await this.redisClient.zRemRangeByScore(key, '-inf', now - (window * 1000));

      // Calculate current error rate
      const allCalls = await this.redisClient.zRange(key, 0, -1);
      const errorCount = allCalls.filter((call: string) => call === '0').length;
      const errorRate = allCalls.length > 0 ? (errorCount / allCalls.length) * 100 : 0;

      // Update Prometheus metric
      this.metrics.posErrorRate
        .labels(provider)
        .set(errorRate);

      // Set expiry for the key
      await this.redisClient.expire(key, window * 2);
    } catch (error) {
      logger.error('Error updating POS error rate in Redis:', error);
    }
  }

  // Get cached data from Redis
  async getCachedData(key: string): Promise<string | null> {
    if (!this.redisClient || !this.redisClient.isOpen) {
      return null;
    }

    try {
      return await this.redisClient.get(key);
    } catch (error) {
      logger.error(`Error getting cached data for key ${key}:`, error);
      return null;
    }
  }

  // Set cached data in Redis
  async setCachedData(key: string, value: string, expirySeconds?: number): Promise<void> {
    if (!this.redisClient || !this.redisClient.isOpen) {
      return;
    }

    try {
      if (expirySeconds) {
        await this.redisClient.setEx(key, expirySeconds, value);
      } else {
        await this.redisClient.set(key, value);
      }
    } catch (error) {
      logger.error(`Error setting cached data for key ${key}:`, error);
    }
  }

  // Get current metrics values
  async getAllMetrics(): Promise<Record<string, any>> {
    try {
      const metricsRegistry = promClient.register;
      const metricsString = await metricsRegistry.metrics();
      
      // Parse metrics and return structured data
      return {
        raw: metricsString,
        summary: await this.getMetricsSummary()
      };
    } catch (error) {
      logger.error('Error getting all metrics:', error);
      return {};
    }
  }

  // Get summary of key metrics
  private async getMetricsSummary(): Promise<Record<string, any>> {
    try {
      const summary: Record<string, any> = {};

      // Get error rates from Redis
      const providers: POSProvider[] = ['square', 'shopify', 'zettle'];
      
      for (const provider of providers) {
        const errorRateKey = `pos_error_rate:${provider}`;
        const allCalls = await this.redisClient?.zRange(errorRateKey, 0, -1) || [];
        const errorCount = allCalls.filter((call: string) => call === '0').length;
        const errorRate = allCalls.length > 0 ? (errorCount / allCalls.length) * 100 : 0;

        summary[provider] = {
          errorRate,
          totalCalls: allCalls.length,
          errors: errorCount
        };
      }

      return summary;
    } catch (error) {
      logger.error('Error getting metrics summary:', error);
      return {};
    }
  }

  // Reset metrics (useful for testing)
  resetMetrics(): void {
    promClient.register.clear();
    this.initializeMetrics();
    logger.info('POS metrics reset');
  }

  // Cleanup resources
  async cleanup(): Promise<void> {
    try {
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.quit();
      }
      logger.info('POS metrics collector cleaned up');
    } catch (error) {
      logger.error('Error during POS metrics collector cleanup:', error);
    }
  }
}