/**
 * Webhook Delivery Monitoring Service
 * Tracks and monitors webhook delivery across all POS providers
 */

const express = require('express');
const { Histogram, Counter, Gauge, register } = require('prom-client');
const Redis = require('ioredis');
const { EventEmitter } = require('events');

// Configuration
const CONFIG = {
  port: process.env.WEBHOOK_MONITOR_PORT || 9093,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  checkInterval: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 5000,
  alertThresholds: {
    deliveryRate: 0.95, // Alert if delivery rate falls below 95%
    latencyP95: 5000,   // Alert if P95 latency exceeds 5 seconds
    failureCount: 10,   // Alert after 10 consecutive failures
    queueSize: 1000     // Alert if queue size exceeds 1000
  }
};

// Prometheus Metrics
const metrics = {
  webhookDelivered: new Counter({
    name: 'pos_webhook_delivered_total',
    help: 'Total number of successfully delivered webhooks',
    labelNames: ['provider', 'event_type', 'business_id']
  }),
  
  webhookFailed: new Counter({
    name: 'pos_webhook_failed_total',
    help: 'Total number of failed webhook deliveries',
    labelNames: ['provider', 'event_type', 'business_id', 'error_type']
  }),
  
  webhookRetried: new Counter({
    name: 'pos_webhook_retried_total',
    help: 'Total number of webhook retry attempts',
    labelNames: ['provider', 'event_type', 'attempt']
  }),
  
  webhookLatency: new Histogram({
    name: 'pos_webhook_latency_seconds',
    help: 'Webhook delivery latency in seconds',
    labelNames: ['provider', 'event_type'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60]
  }),
  
  webhookQueueSize: new Gauge({
    name: 'pos_webhook_queue_size',
    help: 'Current size of webhook delivery queue',
    labelNames: ['provider', 'priority']
  }),
  
  webhookDeliveryRate: new Gauge({
    name: 'pos_webhook_delivery_rate',
    help: 'Current webhook delivery success rate',
    labelNames: ['provider']
  }),
  
  webhookProcessingTime: new Histogram({
    name: 'pos_webhook_processing_time_ms',
    help: 'Time taken to process webhook payload',
    labelNames: ['provider', 'event_type'],
    buckets: [10, 50, 100, 200, 500, 1000, 2000, 5000]
  }),
  
  webhookValidationErrors: new Counter({
    name: 'pos_webhook_validation_errors_total',
    help: 'Total number of webhook validation errors',
    labelNames: ['provider', 'error_type']
  })
};

/**
 * Webhook Delivery Monitor
 */
class WebhookDeliveryMonitor extends EventEmitter {
  constructor() {
    super();
    this.redis = new Redis(CONFIG.redisUrl);
    this.providers = new Map();
    this.deliveryStats = new Map();
    this.alertManager = new AlertManager();
  }

  async initialize() {
    console.log('🚀 Starting Webhook Delivery Monitor...');
    
    // Initialize provider monitors
    await this.initializeProviders();
    
    // Start monitoring loops
    this.startMonitoring();
    
    // Setup cleanup handlers
    this.setupCleanupHandlers();
    
    console.log('✅ Webhook Delivery Monitor initialized');
  }

  async initializeProviders() {
    const providers = ['square', 'shopify', 'zettle'];
    
    for (const provider of providers) {
      this.providers.set(provider, {
        name: provider,
        queue: [],
        stats: {
          delivered: 0,
          failed: 0,
          retried: 0,
          totalLatency: 0,
          count: 0
        },
        lastCheck: Date.now()
      });
      
      // Initialize delivery stats tracking
      this.deliveryStats.set(provider, new RollingWindow(3600000)); // 1 hour window
    }
  }

  startMonitoring() {
    // Main monitoring loop
    setInterval(() => this.checkDeliveryHealth(), CONFIG.checkInterval);
    
    // Queue size monitoring
    setInterval(() => this.updateQueueMetrics(), 10000);
    
    // Delivery rate calculation
    setInterval(() => this.calculateDeliveryRates(), 60000);
  }

  /**
   * Process incoming webhook for delivery
   */
  async processWebhook(webhook) {
    const { provider, eventType, payload, destination, businessId, webhookId } = webhook;
    const startTime = Date.now();
    
    console.log(`📨 Processing webhook: ${provider}/${eventType} -> ${destination}`);
    
    try {
      // Validate webhook payload
      await this.validateWebhook(webhook);
      
      // Add to delivery queue
      await this.queueWebhook(webhook);
      
      // Attempt delivery
      const delivered = await this.attemptDelivery(webhook);
      
      if (delivered) {
        const latency = (Date.now() - startTime) / 1000;
        
        // Update metrics
        metrics.webhookDelivered.inc({
          provider,
          event_type: eventType,
          business_id: businessId
        });
        
        metrics.webhookLatency.observe(
          { provider, event_type: eventType },
          latency
        );
        
        // Update provider stats
        this.updateProviderStats(provider, 'delivered', latency);
        
        // Record successful delivery
        await this.recordDelivery(webhookId, 'success', latency);
        
        console.log(`✅ Webhook delivered: ${webhookId} (${latency.toFixed(2)}s)`);
        
        return { status: 'delivered', latency };
      } else {
        throw new Error('Delivery failed');
      }
      
    } catch (error) {
      console.error(`❌ Webhook delivery failed: ${error.message}`);
      
      // Update failure metrics
      metrics.webhookFailed.inc({
        provider,
        event_type: eventType,
        business_id: businessId,
        error_type: this.classifyError(error)
      });
      
      // Update provider stats
      this.updateProviderStats(provider, 'failed');
      
      // Handle retry logic
      await this.handleRetry(webhook, error);
      
      return { status: 'failed', error: error.message };
    }
  }

  /**
   * Validate webhook payload
   */
  async validateWebhook(webhook) {
    const { provider, eventType, payload } = webhook;
    
    // Provider-specific validation
    const validators = {
      square: this.validateSquareWebhook,
      shopify: this.validateShopifyWebhook,
      zettle: this.validateZettleWebhook
    };
    
    const validator = validators[provider];
    if (!validator) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    
    try {
      await validator.call(this, webhook);
    } catch (error) {
      metrics.webhookValidationErrors.inc({
        provider,
        error_type: error.message
      });
      throw error;
    }
  }

  /**
   * Attempt webhook delivery with timeout
   */
  async attemptDelivery(webhook, attempt = 1) {
    const { destination, payload, headers = {} } = webhook;
    const timeout = 10000; // 10 second timeout
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(destination, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Attempt': attempt.toString(),
          'X-Webhook-Id': webhook.webhookId,
          'X-Webhook-Timestamp': Date.now().toString(),
          ...headers
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return true;
      
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Delivery timeout');
      }
      throw error;
    }
  }

  /**
   * Handle webhook retry logic
   */
  async handleRetry(webhook, error) {
    const { provider, eventType, webhookId } = webhook;
    const attempt = webhook.attempt || 1;
    
    if (attempt < CONFIG.retryAttempts) {
      console.log(`🔄 Scheduling retry ${attempt + 1}/${CONFIG.retryAttempts} for ${webhookId}`);
      
      metrics.webhookRetried.inc({
        provider,
        event_type: eventType,
        attempt: attempt + 1
      });
      
      // Exponential backoff
      const delay = CONFIG.retryDelay * Math.pow(2, attempt - 1);
      
      setTimeout(() => {
        this.processWebhook({ ...webhook, attempt: attempt + 1 });
      }, delay);
      
      // Store retry in Redis
      await this.redis.zadd(
        `webhook:retry:${provider}`,
        Date.now() + delay,
        JSON.stringify({ ...webhook, attempt: attempt + 1 })
      );
      
    } else {
      console.error(`❌ Webhook ${webhookId} failed after ${attempt} attempts`);
      
      // Store in dead letter queue
      await this.redis.lpush(
        `webhook:dlq:${provider}`,
        JSON.stringify({
          webhook,
          error: error.message,
          failedAt: Date.now(),
          attempts: attempt
        })
      );
      
      // Alert on repeated failures
      await this.alertManager.checkWebhookFailure(webhook, attempt);
    }
  }

  /**
   * Queue webhook for delivery
   */
  async queueWebhook(webhook) {
    const { provider, priority = 'normal' } = webhook;
    const queueKey = `webhook:queue:${provider}:${priority}`;
    
    await this.redis.lpush(queueKey, JSON.stringify({
      ...webhook,
      queuedAt: Date.now()
    }));
    
    // Update queue size metric
    const queueSize = await this.redis.llen(queueKey);
    metrics.webhookQueueSize.set(
      { provider, priority },
      queueSize
    );
    
    // Check queue health
    if (queueSize > CONFIG.alertThresholds.queueSize) {
      await this.alertManager.triggerAlert('queue_overflow', {
        provider,
        queueSize,
        threshold: CONFIG.alertThresholds.queueSize
      });
    }
  }

  /**
   * Check overall delivery health
   */
  async checkDeliveryHealth() {
    for (const [provider, providerData] of this.providers) {
      const stats = this.deliveryStats.get(provider);
      const deliveryRate = stats.getDeliveryRate();
      
      // Update delivery rate metric
      metrics.webhookDeliveryRate.set({ provider }, deliveryRate);
      
      // Check against thresholds
      if (deliveryRate < CONFIG.alertThresholds.deliveryRate) {
        await this.alertManager.triggerAlert('low_delivery_rate', {
          provider,
          currentRate: deliveryRate,
          threshold: CONFIG.alertThresholds.deliveryRate
        });
      }
      
      // Check latency
      const p95Latency = stats.getP95Latency();
      if (p95Latency > CONFIG.alertThresholds.latencyP95) {
        await this.alertManager.triggerAlert('high_latency', {
          provider,
          p95Latency,
          threshold: CONFIG.alertThresholds.latencyP95
        });
      }
    }
  }

  /**
   * Update queue metrics
   */
  async updateQueueMetrics() {
    for (const provider of this.providers.keys()) {
      for (const priority of ['high', 'normal', 'low']) {
        const queueKey = `webhook:queue:${provider}:${priority}`;
        const queueSize = await this.redis.llen(queueKey);
        
        metrics.webhookQueueSize.set(
          { provider, priority },
          queueSize
        );
      }
      
      // Check dead letter queue
      const dlqSize = await this.redis.llen(`webhook:dlq:${provider}`);
      if (dlqSize > 0) {
        console.warn(`⚠️ ${provider} DLQ contains ${dlqSize} failed webhooks`);
      }
    }
  }

  /**
   * Calculate delivery rates
   */
  calculateDeliveryRates() {
    for (const [provider, stats] of this.deliveryStats) {
      const rate = stats.getDeliveryRate();
      metrics.webhookDeliveryRate.set({ provider }, rate);
      
      console.log(`📊 ${provider} delivery rate: ${(rate * 100).toFixed(2)}%`);
    }
  }

  /**
   * Update provider statistics
   */
  updateProviderStats(provider, status, latency = 0) {
    const providerData = this.providers.get(provider);
    if (!providerData) return;
    
    if (status === 'delivered') {
      providerData.stats.delivered++;
      providerData.stats.totalLatency += latency;
      providerData.stats.count++;
      
      // Update rolling window
      this.deliveryStats.get(provider).addSuccess(latency);
    } else if (status === 'failed') {
      providerData.stats.failed++;
      
      // Update rolling window
      this.deliveryStats.get(provider).addFailure();
    } else if (status === 'retried') {
      providerData.stats.retried++;
    }
  }

  /**
   * Record webhook delivery in database
   */
  async recordDelivery(webhookId, status, latency) {
    const record = {
      webhookId,
      status,
      latency,
      timestamp: Date.now()
    };
    
    // Store in Redis with TTL
    await this.redis.setex(
      `webhook:delivery:${webhookId}`,
      86400, // 24 hour TTL
      JSON.stringify(record)
    );
    
    // Add to recent deliveries list
    await this.redis.lpush(
      'webhook:recent',
      JSON.stringify(record)
    );
    
    // Trim to keep only last 1000 deliveries
    await this.redis.ltrim('webhook:recent', 0, 999);
  }

  /**
   * Provider-specific validation methods
   */
  validateSquareWebhook(webhook) {
    const { payload, eventType } = webhook;
    
    if (!payload.merchant_id) {
      throw new Error('Missing merchant_id');
    }
    
    if (!['payment.created', 'payment.updated', 'refund.created'].includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}`);
    }
    
    // Validate signature if present
    if (webhook.signature) {
      // TODO: Implement Square signature validation
    }
  }

  validateShopifyWebhook(webhook) {
    const { payload, eventType } = webhook;
    
    if (!payload.shop_domain) {
      throw new Error('Missing shop_domain');
    }
    
    if (!eventType.startsWith('orders/') && !eventType.startsWith('refunds/')) {
      throw new Error(`Invalid event type: ${eventType}`);
    }
    
    // Validate HMAC if present
    if (webhook.hmac) {
      // TODO: Implement Shopify HMAC validation
    }
  }

  validateZettleWebhook(webhook) {
    const { payload, eventType } = webhook;
    
    if (!payload.organizationUuid) {
      throw new Error('Missing organizationUuid');
    }
    
    if (!['purchase.created', 'purchase.updated', 'refund.created'].includes(eventType)) {
      throw new Error(`Invalid event type: ${eventType}`);
    }
    
    // Validate signature if present
    if (webhook.signature) {
      // TODO: Implement Zettle signature validation
    }
  }

  /**
   * Classify error types for metrics
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('network')) return 'network';
    if (message.includes('validation')) return 'validation';
    if (message.includes('signature')) return 'signature';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('http 4')) return 'client_error';
    if (message.includes('http 5')) return 'server_error';
    
    return 'unknown';
  }

  /**
   * Setup cleanup handlers
   */
  setupCleanupHandlers() {
    process.on('SIGINT', async () => {
      console.log('Shutting down webhook monitor...');
      await this.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Shutting down webhook monitor...');
      await this.cleanup();
      process.exit(0);
    });
  }

  async cleanup() {
    // Close Redis connection
    await this.redis.quit();
    
    // Save current state
    for (const [provider, data] of this.providers) {
      await this.redis.set(
        `webhook:state:${provider}`,
        JSON.stringify(data.stats)
      );
    }
  }
}

/**
 * Rolling Window for statistics
 */
class RollingWindow {
  constructor(windowSize) {
    this.windowSize = windowSize;
    this.events = [];
  }

  addSuccess(latency) {
    this.events.push({
      type: 'success',
      latency,
      timestamp: Date.now()
    });
    this.cleanup();
  }

  addFailure() {
    this.events.push({
      type: 'failure',
      timestamp: Date.now()
    });
    this.cleanup();
  }

  cleanup() {
    const cutoff = Date.now() - this.windowSize;
    this.events = this.events.filter(e => e.timestamp > cutoff);
  }

  getDeliveryRate() {
    this.cleanup();
    if (this.events.length === 0) return 1;
    
    const successes = this.events.filter(e => e.type === 'success').length;
    return successes / this.events.length;
  }

  getP95Latency() {
    this.cleanup();
    const latencies = this.events
      .filter(e => e.type === 'success' && e.latency)
      .map(e => e.latency)
      .sort((a, b) => a - b);
    
    if (latencies.length === 0) return 0;
    
    const p95Index = Math.floor(latencies.length * 0.95);
    return latencies[p95Index];
  }
}

/**
 * Alert Manager
 */
class AlertManager {
  constructor() {
    this.activeAlerts = new Map();
    this.alertCooldown = 300000; // 5 minutes
  }

  async triggerAlert(type, details) {
    const alertKey = `${type}:${details.provider || 'global'}`;
    const lastAlert = this.activeAlerts.get(alertKey);
    
    // Check cooldown
    if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
      return;
    }
    
    console.error(`🚨 ALERT: ${type}`, details);
    
    // Update alert timestamp
    this.activeAlerts.set(alertKey, Date.now());
    
    // Send to monitoring system
    // TODO: Integrate with actual alerting service (PagerDuty, OpsGenie, etc.)
  }

  async checkWebhookFailure(webhook, attempts) {
    if (attempts >= CONFIG.alertThresholds.failureCount) {
      await this.triggerAlert('webhook_failure_threshold', {
        provider: webhook.provider,
        webhookId: webhook.webhookId,
        attempts,
        threshold: CONFIG.alertThresholds.failureCount
      });
    }
  }
}

/**
 * Express server for metrics and health checks
 */
function createServer(monitor) {
  const app = express();
  
  app.use(express.json());
  
  // Prometheus metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end(error);
    }
  });
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      providers: Array.from(monitor.providers.keys()),
      timestamp: new Date().toISOString()
    };
    res.json(health);
  });
  
  // Webhook delivery endpoint
  app.post('/webhook/deliver', async (req, res) => {
    try {
      const result = await monitor.processWebhook(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Get delivery statistics
  app.get('/stats/:provider?', (req, res) => {
    const { provider } = req.params;
    
    if (provider) {
      const stats = monitor.providers.get(provider);
      if (!stats) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      res.json(stats);
    } else {
      const allStats = {};
      for (const [name, data] of monitor.providers) {
        allStats[name] = data.stats;
      }
      res.json(allStats);
    }
  });
  
  return app;
}

// Main execution
async function main() {
  const monitor = new WebhookDeliveryMonitor();
  await monitor.initialize();
  
  const app = createServer(monitor);
  
  app.listen(CONFIG.port, () => {
    console.log(`📡 Webhook Delivery Monitor listening on port ${CONFIG.port}`);
    console.log(`📊 Metrics available at http://localhost:${CONFIG.port}/metrics`);
  });
}

// Start the service
if (require.main === module) {
  main().catch(error => {
    console.error('Failed to start webhook monitor:', error);
    process.exit(1);
  });
}

module.exports = { WebhookDeliveryMonitor, RollingWindow, AlertManager };