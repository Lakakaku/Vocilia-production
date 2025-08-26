import { POSProvider } from '@ai-feedback-platform/shared-types';
import { logger } from '../utils/logger';
import { POSMetricsCollector } from './pos-metrics-collector';
import { createClient } from 'redis';
import { db } from '@ai-feedback/database';

/**
 * Advanced Webhook Reliability System
 * 
 * Features:
 * - Exponential backoff with jitter for retries
 * - Webhook delivery success rate tracking with SLA monitoring
 * - Failure pattern detection and automatic escalation
 * - Dead letter queue management
 * - Circuit breaker pattern for webhook endpoints
 * - Comprehensive delivery analytics
 */

interface WebhookDeliveryAttempt {
  id: string;
  provider: POSProvider;
  eventType: string;
  payload: any;
  attempt: number;
  maxAttempts: number;
  nextRetryAt: Date;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'dead_letter';
  errorMessage?: string;
  responseTime?: number;
  createdAt: Date;
  lastAttemptAt?: Date;
}

interface WebhookCircuitBreaker {
  provider: POSProvider;
  eventType: string;
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  lastFailureAt?: Date;
  successCount: number;
  threshold: number;
  timeout: number; // milliseconds
}

interface WebhookSLAConfig {
  provider: POSProvider;
  successRateThreshold: number; // percentage
  responseTimeThreshold: number; // milliseconds
  monitoringWindow: number; // minutes
}

export class AdvancedWebhookProcessor {
  private redisClient: any;
  private metricsCollector: POSMetricsCollector;
  private circuitBreakers: Map<string, WebhookCircuitBreaker> = new Map();
  
  // SLA configurations for different providers
  private slaConfigs: WebhookSLAConfig[] = [
    {
      provider: 'square',
      successRateThreshold: 99.0, // Square expects very high reliability
      responseTimeThreshold: 2000,
      monitoringWindow: 60
    },
    {
      provider: 'shopify',
      successRateThreshold: 98.5,
      responseTimeThreshold: 3000,
      monitoringWindow: 60
    },
    {
      provider: 'zettle',
      successRateThreshold: 98.0,
      responseTimeThreshold: 5000,
      monitoringWindow: 60
    }
  ];

  // Retry configuration with exponential backoff
  private retryConfig = {
    initialDelay: 1000, // 1 second
    maxDelay: 900000, // 15 minutes
    backoffMultiplier: 2,
    maxAttempts: 10,
    jitterMaxMs: 1000
  };

  constructor() {
    this.metricsCollector = new POSMetricsCollector();
    this.initializeRedis();
    this.initializeCircuitBreakers();
    this.startRetryProcessor();
    this.startSLAMonitor();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Advanced Webhook Processor Redis Error:', err);
      });

      await this.redisClient.connect();
      logger.info('Advanced Webhook Processor connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis for Advanced Webhook Processor:', error);
    }
  }

  private initializeCircuitBreakers() {
    // Initialize circuit breakers for each provider and common event types
    const providers: POSProvider[] = ['square', 'shopify', 'zettle'];
    const eventTypes = ['payment.created', 'payment.updated', 'order.created', 'order.updated', 'inventory.updated'];

    for (const provider of providers) {
      for (const eventType of eventTypes) {
        const key = `${provider}:${eventType}`;
        this.circuitBreakers.set(key, {
          provider,
          eventType,
          state: 'closed',
          failureCount: 0,
          successCount: 0,
          threshold: 5, // Open circuit after 5 consecutive failures
          timeout: 60000 // 1 minute timeout for circuit breaker
        });
      }
    }
  }

  /**
   * Process webhook with advanced reliability features
   */
  async processWebhook(
    provider: POSProvider,
    eventType: string,
    payload: any,
    signature: string
  ): Promise<{
    success: boolean;
    deliveryId: string;
    message: string;
    processingTime: number;
    circuitBreakerState?: string;
  }> {
    const startTime = Date.now();
    const deliveryId = this.generateDeliveryId();
    
    try {
      // Check circuit breaker
      const circuitKey = `${provider}:${eventType}`;
      const circuitBreaker = this.circuitBreakers.get(circuitKey);
      
      if (circuitBreaker && circuitBreaker.state === 'open') {
        // Check if circuit breaker timeout has passed
        if (circuitBreaker.lastFailureAt && 
            Date.now() - circuitBreaker.lastFailureAt.getTime() > circuitBreaker.timeout) {
          circuitBreaker.state = 'half_open';
          logger.info(`Circuit breaker half-open for ${circuitKey}`);
        } else {
          logger.warn(`Circuit breaker open for ${circuitKey}, rejecting webhook`);
          return {
            success: false,
            deliveryId,
            message: 'Circuit breaker open - webhook rejected',
            processingTime: Date.now() - startTime,
            circuitBreakerState: 'open'
          };
        }
      }

      // Create delivery attempt record
      const deliveryAttempt: WebhookDeliveryAttempt = {
        id: deliveryId,
        provider,
        eventType,
        payload,
        attempt: 1,
        maxAttempts: this.retryConfig.maxAttempts,
        nextRetryAt: new Date(),
        status: 'processing',
        createdAt: new Date(),
        lastAttemptAt: new Date()
      };

      // Store delivery attempt
      await this.storeDeliveryAttempt(deliveryAttempt);

      // Process webhook
      const result = await this.executeWebhookProcessing(provider, eventType, payload, signature);
      const processingTime = Date.now() - startTime;

      // Update delivery attempt
      deliveryAttempt.status = result.success ? 'success' : 'failed';
      deliveryAttempt.responseTime = processingTime;
      deliveryAttempt.errorMessage = result.error;
      deliveryAttempt.lastAttemptAt = new Date();

      await this.updateDeliveryAttempt(deliveryAttempt);

      // Update circuit breaker
      this.updateCircuitBreaker(circuitKey, result.success);

      // Record metrics
      this.metricsCollector.recordWebhookDelivery(
        provider,
        eventType,
        result.success,
        processingTime,
        1
      );

      // Schedule retry if failed
      if (!result.success) {
        await this.scheduleRetry(deliveryAttempt);
      }

      return {
        success: result.success,
        deliveryId,
        message: result.success ? 'Webhook processed successfully' : result.error || 'Processing failed',
        processingTime,
        circuitBreakerState: circuitBreaker?.state
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Advanced webhook processing error:', error);

      // Update circuit breaker on error
      const circuitKey = `${provider}:${eventType}`;
      this.updateCircuitBreaker(circuitKey, false);

      return {
        success: false,
        deliveryId,
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTime,
        circuitBreakerState: this.circuitBreakers.get(circuitKey)?.state
      };
    }
  }

  /**
   * Execute the actual webhook processing logic
   */
  private async executeWebhookProcessing(
    provider: POSProvider,
    eventType: string,
    payload: any,
    signature: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate signature
      const signatureValid = await this.validateWebhookSignature(provider, payload, signature);
      if (!signatureValid) {
        return { success: false, error: 'Invalid webhook signature' };
      }

      // Process based on provider and event type
      switch (provider) {
        case 'square':
          return await this.processSquareWebhook(eventType, payload);
        case 'shopify':
          return await this.processShopifyWebhook(eventType, payload);
        case 'zettle':
          return await this.processZettleWebhook(eventType, payload);
        default:
          return { success: false, error: `Unknown provider: ${provider}` };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Processing error' 
      };
    }
  }

  /**
   * Validate webhook signatures for different providers
   */
  private async validateWebhookSignature(
    provider: POSProvider,
    payload: any,
    signature: string
  ): Promise<boolean> {
    try {
      switch (provider) {
        case 'square':
          // Square signature validation logic
          const squareSignature = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
          if (!squareSignature) return false;
          // Implement Square-specific signature validation
          return true; // Placeholder
        
        case 'shopify':
          // Shopify HMAC validation
          const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;
          if (!shopifySecret) return false;
          // Implement Shopify-specific HMAC validation
          return true; // Placeholder
        
        case 'zettle':
          // Zettle signature validation
          const zettleSecret = process.env.ZETTLE_WEBHOOK_SECRET;
          if (!zettleSecret) return false;
          // Implement Zettle-specific validation
          return true; // Placeholder
        
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Signature validation error for ${provider}:`, error);
      return false;
    }
  }

  /**
   * Process Square webhooks
   */
  private async processSquareWebhook(eventType: string, payload: any): Promise<{ success: boolean; error?: string }> {
    try {
      switch (eventType) {
        case 'payment.created':
        case 'payment.updated':
          await this.handlePaymentEvent(payload);
          break;
        case 'order.created':
        case 'order.updated':
          await this.handleOrderEvent(payload);
          break;
        default:
          logger.warn(`Unhandled Square event type: ${eventType}`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process Shopify webhooks
   */
  private async processShopifyWebhook(eventType: string, payload: any): Promise<{ success: boolean; error?: string }> {
    try {
      switch (eventType) {
        case 'orders/create':
        case 'orders/updated':
          await this.handleOrderEvent(payload);
          break;
        case 'orders/paid':
          await this.handlePaymentEvent(payload);
          break;
        default:
          logger.warn(`Unhandled Shopify event type: ${eventType}`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Process Zettle webhooks
   */
  private async processZettleWebhook(eventType: string, payload: any): Promise<{ success: boolean; error?: string }> {
    try {
      switch (eventType) {
        case 'PaymentCompleted':
          await this.handlePaymentEvent(payload);
          break;
        case 'InventoryBalanceChanged':
          await this.handleInventoryEvent(payload);
          break;
        default:
          logger.warn(`Unhandled Zettle event type: ${eventType}`);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle payment-related events
   */
  private async handlePaymentEvent(payload: any): Promise<void> {
    // Implement payment event handling logic
    logger.info('Processing payment event:', { 
      id: payload.id || payload.order_id,
      amount: payload.amount || payload.total_price 
    });
  }

  /**
   * Handle order-related events
   */
  private async handleOrderEvent(payload: any): Promise<void> {
    // Implement order event handling logic
    logger.info('Processing order event:', { 
      id: payload.id || payload.order_number,
      status: payload.status 
    });
  }

  /**
   * Handle inventory-related events
   */
  private async handleInventoryEvent(payload: any): Promise<void> {
    // Implement inventory event handling logic
    logger.info('Processing inventory event:', { 
      productId: payload.productId,
      change: payload.change 
    });
  }

  /**
   * Update circuit breaker state based on success/failure
   */
  private updateCircuitBreaker(key: string, success: boolean): void {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return;

    if (success) {
      breaker.successCount++;
      breaker.failureCount = 0;
      
      if (breaker.state === 'half_open') {
        breaker.state = 'closed';
        logger.info(`Circuit breaker closed for ${key}`);
      }
    } else {
      breaker.failureCount++;
      breaker.successCount = 0;
      breaker.lastFailureAt = new Date();
      
      if (breaker.failureCount >= breaker.threshold) {
        breaker.state = 'open';
        logger.warn(`Circuit breaker opened for ${key} after ${breaker.failureCount} failures`);
        
        // Schedule circuit breaker timeout
        setTimeout(() => {
          if (breaker.state === 'open') {
            breaker.state = 'half_open';
            logger.info(`Circuit breaker half-open for ${key}`);
          }
        }, breaker.timeout);
      }
    }
  }

  /**
   * Schedule webhook retry with exponential backoff and jitter
   */
  private async scheduleRetry(deliveryAttempt: WebhookDeliveryAttempt): Promise<void> {
    if (deliveryAttempt.attempt >= deliveryAttempt.maxAttempts) {
      // Move to dead letter queue
      deliveryAttempt.status = 'dead_letter';
      await this.moveToDeadLetterQueue(deliveryAttempt);
      return;
    }

    // Calculate next retry delay with exponential backoff and jitter
    const baseDelay = Math.min(
      this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, deliveryAttempt.attempt - 1),
      this.retryConfig.maxDelay
    );
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * this.retryConfig.jitterMaxMs;
    const delay = baseDelay + jitter;
    
    deliveryAttempt.nextRetryAt = new Date(Date.now() + delay);
    deliveryAttempt.status = 'pending';
    
    await this.updateDeliveryAttempt(deliveryAttempt);
    
    // Add to retry queue
    await this.addToRetryQueue(deliveryAttempt, delay);
    
    logger.info(`Scheduled retry for ${deliveryAttempt.id} in ${Math.round(delay/1000)}s (attempt ${deliveryAttempt.attempt + 1}/${deliveryAttempt.maxAttempts})`);
  }

  /**
   * Add delivery attempt to retry queue
   */
  private async addToRetryQueue(deliveryAttempt: WebhookDeliveryAttempt, delay: number): Promise<void> {
    if (!this.redisClient || !this.redisClient.isOpen) return;

    try {
      const retryTime = Date.now() + delay;
      await this.redisClient.zAdd('webhook_retry_queue', {
        score: retryTime,
        value: JSON.stringify({
          id: deliveryAttempt.id,
          provider: deliveryAttempt.provider,
          eventType: deliveryAttempt.eventType,
          attempt: deliveryAttempt.attempt + 1
        })
      });
    } catch (error) {
      logger.error('Error adding to retry queue:', error);
    }
  }

  /**
   * Move failed delivery to dead letter queue
   */
  private async moveToDeadLetterQueue(deliveryAttempt: WebhookDeliveryAttempt): Promise<void> {
    try {
      await this.updateDeliveryAttempt(deliveryAttempt);
      
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.lPush('webhook_dead_letter_queue', JSON.stringify({
          id: deliveryAttempt.id,
          provider: deliveryAttempt.provider,
          eventType: deliveryAttempt.eventType,
          finalError: deliveryAttempt.errorMessage,
          attempts: deliveryAttempt.attempt,
          createdAt: deliveryAttempt.createdAt,
          failedAt: new Date()
        }));
      }
      
      logger.warn(`Moved webhook ${deliveryAttempt.id} to dead letter queue after ${deliveryAttempt.attempt} attempts`);
      
      // Trigger escalation for dead letter queue items
      await this.triggerEscalation(deliveryAttempt);
    } catch (error) {
      logger.error('Error moving to dead letter queue:', error);
    }
  }

  /**
   * Trigger escalation for failed webhooks
   */
  private async triggerEscalation(deliveryAttempt: WebhookDeliveryAttempt): Promise<void> {
    // Implement escalation logic (alerts, notifications, etc.)
    logger.error(`ESCALATION: Webhook delivery completely failed`, {
      id: deliveryAttempt.id,
      provider: deliveryAttempt.provider,
      eventType: deliveryAttempt.eventType,
      attempts: deliveryAttempt.attempt,
      error: deliveryAttempt.errorMessage
    });
  }

  /**
   * Store delivery attempt in database
   */
  private async storeDeliveryAttempt(attempt: WebhookDeliveryAttempt): Promise<void> {
    try {
      await db.client.from('webhook_delivery_attempts').insert({
        id: attempt.id,
        provider: attempt.provider,
        event_type: attempt.eventType,
        payload: attempt.payload,
        attempt_number: attempt.attempt,
        max_attempts: attempt.maxAttempts,
        next_retry_at: attempt.nextRetryAt.toISOString(),
        status: attempt.status,
        error_message: attempt.errorMessage,
        response_time: attempt.responseTime,
        created_at: attempt.createdAt.toISOString(),
        last_attempt_at: attempt.lastAttemptAt?.toISOString()
      });
    } catch (error) {
      logger.error('Error storing delivery attempt:', error);
    }
  }

  /**
   * Update delivery attempt in database
   */
  private async updateDeliveryAttempt(attempt: WebhookDeliveryAttempt): Promise<void> {
    try {
      await db.client.from('webhook_delivery_attempts')
        .update({
          attempt_number: attempt.attempt,
          next_retry_at: attempt.nextRetryAt.toISOString(),
          status: attempt.status,
          error_message: attempt.errorMessage,
          response_time: attempt.responseTime,
          last_attempt_at: attempt.lastAttemptAt?.toISOString()
        })
        .eq('id', attempt.id);
    } catch (error) {
      logger.error('Error updating delivery attempt:', error);
    }
  }

  /**
   * Start retry processor
   */
  private startRetryProcessor(): void {
    setInterval(async () => {
      await this.processRetryQueue();
    }, 5000); // Check every 5 seconds
  }

  /**
   * Process retry queue
   */
  private async processRetryQueue(): Promise<void> {
    if (!this.redisClient || !this.redisClient.isOpen) return;

    try {
      const now = Date.now();
      const readyRetries = await this.redisClient.zRangeByScore(
        'webhook_retry_queue',
        '-inf',
        now,
        { LIMIT: { offset: 0, count: 10 } }
      );

      for (const retryStr of readyRetries) {
        try {
          const retryInfo = JSON.parse(retryStr);
          await this.processRetry(retryInfo);
          
          // Remove from retry queue
          await this.redisClient.zRem('webhook_retry_queue', retryStr);
        } catch (error) {
          logger.error('Error processing retry:', error);
        }
      }
    } catch (error) {
      logger.error('Error processing retry queue:', error);
    }
  }

  /**
   * Process individual retry
   */
  private async processRetry(retryInfo: any): Promise<void> {
    try {
      // Get delivery attempt from database
      const { data: attempt } = await db.client
        .from('webhook_delivery_attempts')
        .select('*')
        .eq('id', retryInfo.id)
        .single();

      if (!attempt) {
        logger.warn(`Retry attempt not found: ${retryInfo.id}`);
        return;
      }

      // Update attempt number
      const deliveryAttempt: WebhookDeliveryAttempt = {
        id: attempt.id,
        provider: attempt.provider,
        eventType: attempt.event_type,
        payload: attempt.payload,
        attempt: retryInfo.attempt,
        maxAttempts: attempt.max_attempts,
        nextRetryAt: new Date(),
        status: 'processing',
        createdAt: new Date(attempt.created_at),
        lastAttemptAt: new Date()
      };

      await this.updateDeliveryAttempt(deliveryAttempt);

      // Retry processing
      const result = await this.executeWebhookProcessing(
        deliveryAttempt.provider,
        deliveryAttempt.eventType,
        deliveryAttempt.payload,
        '' // Signature already validated in original attempt
      );

      // Update status based on result
      deliveryAttempt.status = result.success ? 'success' : 'failed';
      deliveryAttempt.errorMessage = result.error;
      deliveryAttempt.lastAttemptAt = new Date();

      await this.updateDeliveryAttempt(deliveryAttempt);

      // Schedule next retry if still failing
      if (!result.success) {
        await this.scheduleRetry(deliveryAttempt);
      }

      // Update circuit breaker
      const circuitKey = `${deliveryAttempt.provider}:${deliveryAttempt.eventType}`;
      this.updateCircuitBreaker(circuitKey, result.success);

      // Record retry metrics
      this.metricsCollector.recordWebhookDelivery(
        deliveryAttempt.provider,
        deliveryAttempt.eventType,
        result.success,
        0,
        deliveryAttempt.attempt
      );

    } catch (error) {
      logger.error(`Error processing retry ${retryInfo.id}:`, error);
    }
  }

  /**
   * Start SLA monitoring
   */
  private startSLAMonitor(): void {
    setInterval(async () => {
      await this.monitorSLAs();
    }, 60000); // Check every minute
  }

  /**
   * Monitor webhook delivery SLAs
   */
  private async monitorSLAs(): Promise<void> {
    for (const slaConfig of this.slaConfigs) {
      try {
        const slaStatus = await this.checkProviderSLA(slaConfig);
        
        if (!slaStatus.meetsSLA) {
          logger.warn(`SLA violation for ${slaConfig.provider}:`, slaStatus);
          await this.handleSLAViolation(slaConfig, slaStatus);
        }
      } catch (error) {
        logger.error(`Error monitoring SLA for ${slaConfig.provider}:`, error);
      }
    }
  }

  /**
   * Check SLA compliance for a provider
   */
  private async checkProviderSLA(config: WebhookSLAConfig): Promise<{
    provider: POSProvider;
    meetsSLA: boolean;
    successRate: number;
    averageResponseTime: number;
    totalDeliveries: number;
    failedDeliveries: number;
  }> {
    try {
      const windowStart = new Date(Date.now() - config.monitoringWindow * 60 * 1000);
      
      const { data: deliveries } = await db.client
        .from('webhook_delivery_attempts')
        .select('status, response_time')
        .eq('provider', config.provider)
        .gte('created_at', windowStart.toISOString());

      const totalDeliveries = deliveries?.length || 0;
      const successfulDeliveries = deliveries?.filter(d => d.status === 'success').length || 0;
      const failedDeliveries = totalDeliveries - successfulDeliveries;
      const successRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 100;
      
      const responseTimes = deliveries?.filter(d => d.response_time).map(d => d.response_time) || [];
      const averageResponseTime = responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0;

      const meetsSLA = successRate >= config.successRateThreshold && 
                      averageResponseTime <= config.responseTimeThreshold;

      return {
        provider: config.provider,
        meetsSLA,
        successRate,
        averageResponseTime,
        totalDeliveries,
        failedDeliveries
      };
    } catch (error) {
      logger.error(`Error checking SLA for ${config.provider}:`, error);
      return {
        provider: config.provider,
        meetsSLA: false,
        successRate: 0,
        averageResponseTime: 0,
        totalDeliveries: 0,
        failedDeliveries: 0
      };
    }
  }

  /**
   * Handle SLA violations
   */
  private async handleSLAViolation(config: WebhookSLAConfig, status: any): Promise<void> {
    // Implement SLA violation handling (alerts, notifications, escalation)
    logger.error(`SLA VIOLATION: ${config.provider} webhook delivery SLA violated`, {
      provider: config.provider,
      requiredSuccessRate: config.successRateThreshold,
      actualSuccessRate: status.successRate,
      requiredResponseTime: config.responseTimeThreshold,
      actualResponseTime: status.averageResponseTime,
      monitoringWindow: config.monitoringWindow
    });
  }

  /**
   * Get webhook delivery statistics
   */
  async getDeliveryStats(provider?: POSProvider, hours: number = 24): Promise<{
    summary: any;
    providers: Record<string, any>;
    slaCompliance: any[];
    circuitBreakerStatus: any[];
  }> {
    try {
      const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      let query = db.client
        .from('webhook_delivery_attempts')
        .select('*')
        .gte('created_at', windowStart.toISOString());
      
      if (provider) {
        query = query.eq('provider', provider);
      }
      
      const { data: deliveries } = await query;
      
      // Calculate summary statistics
      const summary = {
        totalDeliveries: deliveries?.length || 0,
        successful: deliveries?.filter(d => d.status === 'success').length || 0,
        failed: deliveries?.filter(d => d.status === 'failed').length || 0,
        pending: deliveries?.filter(d => d.status === 'pending').length || 0,
        deadLetter: deliveries?.filter(d => d.status === 'dead_letter').length || 0
      };
      
      summary.successRate = summary.totalDeliveries > 0 
        ? (summary.successful / summary.totalDeliveries) * 100 
        : 100;
      
      // Provider-specific statistics
      const providers: Record<string, any> = {};
      const providersList: POSProvider[] = ['square', 'shopify', 'zettle'];
      
      for (const prov of providersList) {
        const providerDeliveries = deliveries?.filter(d => d.provider === prov) || [];
        const successful = providerDeliveries.filter(d => d.status === 'success').length;
        const total = providerDeliveries.length;
        
        providers[prov] = {
          totalDeliveries: total,
          successful,
          failed: providerDeliveries.filter(d => d.status === 'failed').length,
          successRate: total > 0 ? (successful / total) * 100 : 100,
          averageResponseTime: providerDeliveries
            .filter(d => d.response_time)
            .reduce((sum, d) => sum + d.response_time, 0) / Math.max(1, providerDeliveries.filter(d => d.response_time).length)
        };
      }
      
      // SLA compliance
      const slaCompliance = await Promise.all(
        this.slaConfigs.map(config => this.checkProviderSLA(config))
      );
      
      // Circuit breaker status
      const circuitBreakerStatus = Array.from(this.circuitBreakers.entries()).map(([key, breaker]) => ({
        key,
        provider: breaker.provider,
        eventType: breaker.eventType,
        state: breaker.state,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        lastFailureAt: breaker.lastFailureAt
      }));
      
      return {
        summary,
        providers,
        slaCompliance,
        circuitBreakerStatus
      };
    } catch (error) {
      logger.error('Error getting delivery stats:', error);
      throw error;
    }
  }

  /**
   * Generate unique delivery ID
   */
  private generateDeliveryId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.redisClient && this.redisClient.isOpen) {
        await this.redisClient.quit();
      }
      await this.metricsCollector.cleanup();
      logger.info('Advanced Webhook Processor cleaned up');
    } catch (error) {
      logger.error('Error during Advanced Webhook Processor cleanup:', error);
    }
  }
}