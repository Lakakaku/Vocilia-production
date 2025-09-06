/**
 * Transaction Sync Tracking Service
 * Monitors and tracks transaction synchronization across all POS providers
 */

const express = require('express');
const { Histogram, Counter, Gauge, Summary, register } = require('prom-client');
const Redis = require('ioredis');
const { EventEmitter } = require('events');

// Configuration
const CONFIG = {
  port: process.env.TRANSACTION_TRACKER_PORT || 9094,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  syncCheckInterval: 10000, // 10 seconds
  reconciliationInterval: 60000, // 1 minute
  alertThresholds: {
    syncDelay: 30000, // 30 seconds
    accuracyRate: 0.98, // 98% accuracy
    pendingTransactions: 100,
    syncFailureRate: 0.05 // 5% failure threshold
  },
  providers: {
    square: {
      batchSize: 50,
      syncInterval: 5000,
      maxRetries: 3
    },
    shopify: {
      batchSize: 100,
      syncInterval: 10000,
      maxRetries: 3
    },
    zettle: {
      batchSize: 25,
      syncInterval: 7500,
      maxRetries: 3
    }
  }
};

// Prometheus Metrics
const metrics = {
  transactionSyncSuccess: new Counter({
    name: 'pos_transaction_sync_success_total',
    help: 'Total number of successfully synced transactions',
    labelNames: ['provider', 'business_id', 'payment_method']
  }),
  
  transactionSyncFailed: new Counter({
    name: 'pos_transaction_sync_failed_total',
    help: 'Total number of failed transaction syncs',
    labelNames: ['provider', 'business_id', 'error_type']
  }),
  
  transactionSyncPending: new Gauge({
    name: 'pos_transaction_sync_pending_total',
    help: 'Number of transactions pending synchronization',
    labelNames: ['provider', 'business_id']
  }),
  
  transactionSyncLatency: new Histogram({
    name: 'pos_transaction_sync_latency_ms',
    help: 'Transaction sync latency in milliseconds',
    labelNames: ['provider', 'business_id'],
    buckets: [100, 500, 1000, 2000, 5000, 10000, 30000, 60000]
  }),
  
  transactionVerificationAccuracy: new Gauge({
    name: 'pos_transaction_verification_accuracy',
    help: 'Transaction verification accuracy percentage',
    labelNames: ['provider', 'business_id']
  }),
  
  transactionAmountMismatch: new Counter({
    name: 'pos_transaction_amount_mismatch_total',
    help: 'Total number of transactions with amount mismatches',
    labelNames: ['provider', 'business_id', 'mismatch_type']
  }),
  
  transactionReconciliationStatus: new Gauge({
    name: 'pos_transaction_reconciliation_status',
    help: 'Current reconciliation status (0=failed, 1=success)',
    labelNames: ['provider', 'business_id']
  }),
  
  transactionSyncDuration: new Summary({
    name: 'pos_transaction_sync_duration_seconds',
    help: 'Time taken to sync a batch of transactions',
    labelNames: ['provider', 'batch_size']
  }),
  
  transactionDuplicates: new Counter({
    name: 'pos_transaction_duplicates_total',
    help: 'Total number of duplicate transactions detected',
    labelNames: ['provider', 'business_id']
  })
};

/**
 * Transaction Sync Tracker
 */
class TransactionSyncTracker extends EventEmitter {
  constructor() {
    super();
    this.redis = new Redis(CONFIG.redisUrl);
    this.providers = new Map();
    this.syncQueues = new Map();
    this.reconciliationEngine = new ReconciliationEngine(this.redis);
    this.alertManager = new TransactionAlertManager();
  }

  async initialize() {
    console.log('🚀 Starting Transaction Sync Tracker...');
    
    // Initialize provider sync engines
    await this.initializeProviders();
    
    // Start sync monitoring
    this.startSyncMonitoring();
    
    // Start reconciliation process
    this.startReconciliation();
    
    // Setup cleanup handlers
    this.setupCleanupHandlers();
    
    console.log('✅ Transaction Sync Tracker initialized');
  }

  async initializeProviders() {
    for (const [provider, config] of Object.entries(CONFIG.providers)) {
      const syncEngine = new ProviderSyncEngine(provider, config, this.redis);
      
      this.providers.set(provider, syncEngine);
      this.syncQueues.set(provider, new TransactionQueue(provider));
      
      // Initialize metrics
      metrics.transactionSyncPending.set({ provider, business_id: 'all' }, 0);
      metrics.transactionVerificationAccuracy.set({ provider, business_id: 'all' }, 100);
      
      console.log(`📦 Initialized ${provider} sync engine`);
    }
  }

  startSyncMonitoring() {
    // Main sync loop for each provider
    for (const [provider, syncEngine] of this.providers) {
      const config = CONFIG.providers[provider];
      
      setInterval(async () => {
        await this.processSyncBatch(provider, syncEngine);
      }, config.syncInterval);
    }
    
    // Monitor pending transactions
    setInterval(() => this.monitorPendingTransactions(), CONFIG.syncCheckInterval);
    
    // Check sync health
    setInterval(() => this.checkSyncHealth(), 30000);
  }

  /**
   * Process a batch of transactions for synchronization
   */
  async processSyncBatch(provider, syncEngine) {
    const queue = this.syncQueues.get(provider);
    const config = CONFIG.providers[provider];
    const batchStartTime = Date.now();
    
    try {
      // Get batch of transactions to sync
      const batch = await queue.getBatch(config.batchSize);
      
      if (batch.length === 0) {
        return;
      }
      
      console.log(`🔄 Processing ${batch.length} transactions for ${provider}`);
      
      // Process each transaction
      const results = await Promise.allSettled(
        batch.map(transaction => this.syncTransaction(provider, syncEngine, transaction))
      );
      
      // Calculate statistics
      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      
      // Update metrics
      const duration = (Date.now() - batchStartTime) / 1000;
      metrics.transactionSyncDuration.observe(
        { provider, batch_size: batch.length },
        duration
      );
      
      // Log summary
      console.log(`✅ ${provider}: ${successful}/${batch.length} synced successfully (${duration.toFixed(2)}s)`);
      
      if (failed > 0) {
        console.warn(`⚠️ ${provider}: ${failed} transactions failed to sync`);
        
        // Check failure rate
        const failureRate = failed / batch.length;
        if (failureRate > CONFIG.alertThresholds.syncFailureRate) {
          await this.alertManager.triggerAlert('high_sync_failure_rate', {
            provider,
            failureRate,
            threshold: CONFIG.alertThresholds.syncFailureRate
          });
        }
      }
      
    } catch (error) {
      console.error(`❌ Error processing sync batch for ${provider}:`, error);
    }
  }

  /**
   * Sync individual transaction
   */
  async syncTransaction(provider, syncEngine, transaction) {
    const startTime = Date.now();
    const { transactionId, businessId, amount, timestamp, metadata } = transaction;
    
    try {
      // Retrieve transaction from POS provider
      const posTransaction = await syncEngine.getTransaction(transactionId);
      
      if (!posTransaction) {
        throw new Error('Transaction not found in POS');
      }
      
      // Verify transaction details
      const verification = await this.verifyTransaction(transaction, posTransaction);
      
      if (!verification.isValid) {
        // Handle verification failures
        await this.handleVerificationFailure(provider, transaction, verification);
        
        metrics.transactionSyncFailed.inc({
          provider,
          business_id: businessId,
          error_type: 'verification_failed'
        });
        
        throw new Error(`Verification failed: ${verification.errors.join(', ')}`);
      }
      
      // Update transaction status
      await this.updateTransactionStatus(transactionId, 'synced', {
        syncedAt: Date.now(),
        posData: posTransaction,
        verificationScore: verification.score
      });
      
      // Record sync latency
      const latency = Date.now() - startTime;
      metrics.transactionSyncLatency.observe(
        { provider, business_id: businessId },
        latency
      );
      
      // Update success counter
      metrics.transactionSyncSuccess.inc({
        provider,
        business_id: businessId,
        payment_method: posTransaction.paymentMethod || 'unknown'
      });
      
      // Update accuracy metric
      await this.updateAccuracyMetric(provider, businessId, verification.score);
      
      return {
        transactionId,
        status: 'synced',
        latency,
        accuracy: verification.score
      };
      
    } catch (error) {
      console.error(`❌ Failed to sync transaction ${transactionId}:`, error.message);
      
      // Update failure counter
      metrics.transactionSyncFailed.inc({
        provider,
        business_id: businessId,
        error_type: this.classifyError(error)
      });
      
      // Add to retry queue if applicable
      if (transaction.retryCount < CONFIG.providers[provider].maxRetries) {
        await this.queueForRetry(provider, {
          ...transaction,
          retryCount: (transaction.retryCount || 0) + 1,
          lastError: error.message
        });
      } else {
        // Move to dead letter queue
        await this.moveToDeadLetter(provider, transaction, error);
      }
      
      throw error;
    }
  }

  /**
   * Verify transaction details
   */
  async verifyTransaction(localTransaction, posTransaction) {
    const errors = [];
    let score = 100;
    
    // Check transaction ID match
    if (localTransaction.transactionId !== posTransaction.id) {
      errors.push('Transaction ID mismatch');
      score -= 50;
    }
    
    // Check amount (allow small variance for currency conversion)
    const amountDifference = Math.abs(localTransaction.amount - posTransaction.amount);
    const tolerance = 0.01; // 1 cent/öre tolerance
    
    if (amountDifference > tolerance) {
      errors.push(`Amount mismatch: local=${localTransaction.amount}, pos=${posTransaction.amount}`);
      score -= 30;
      
      metrics.transactionAmountMismatch.inc({
        provider: localTransaction.provider,
        business_id: localTransaction.businessId,
        mismatch_type: amountDifference > localTransaction.amount * 0.1 ? 'major' : 'minor'
      });
    }
    
    // Check timestamp (within reasonable window)
    const timeDifference = Math.abs(
      new Date(localTransaction.timestamp).getTime() - 
      new Date(posTransaction.timestamp).getTime()
    );
    
    if (timeDifference > 60000) { // More than 1 minute difference
      errors.push('Timestamp mismatch');
      score -= 10;
    }
    
    // Check for duplicate
    const isDuplicate = await this.checkDuplicate(localTransaction);
    if (isDuplicate) {
      errors.push('Duplicate transaction detected');
      score -= 20;
      
      metrics.transactionDuplicates.inc({
        provider: localTransaction.provider,
        business_id: localTransaction.businessId
      });
    }
    
    // Swedish-specific validations
    if (posTransaction.currency && posTransaction.currency !== 'SEK') {
      errors.push(`Invalid currency: ${posTransaction.currency} (expected SEK)`);
      score -= 15;
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      score: Math.max(0, score),
      details: {
        amountDifference,
        timeDifference,
        isDuplicate
      }
    };
  }

  /**
   * Handle verification failures
   */
  async handleVerificationFailure(provider, transaction, verification) {
    // Log detailed failure information
    const failureRecord = {
      transactionId: transaction.transactionId,
      businessId: transaction.businessId,
      provider,
      verification,
      timestamp: Date.now()
    };
    
    await this.redis.lpush(
      `transaction:verification:failures:${provider}`,
      JSON.stringify(failureRecord)
    );
    
    // Alert if accuracy drops below threshold
    if (verification.score < CONFIG.alertThresholds.accuracyRate * 100) {
      await this.alertManager.triggerAlert('low_verification_accuracy', {
        provider,
        transactionId: transaction.transactionId,
        accuracy: verification.score,
        errors: verification.errors
      });
    }
  }

  /**
   * Monitor pending transactions
   */
  async monitorPendingTransactions() {
    for (const [provider, queue] of this.syncQueues) {
      const pendingCount = await queue.getPendingCount();
      
      // Update metric
      metrics.transactionSyncPending.set(
        { provider, business_id: 'all' },
        pendingCount
      );
      
      // Check threshold
      if (pendingCount > CONFIG.alertThresholds.pendingTransactions) {
        await this.alertManager.triggerAlert('high_pending_transactions', {
          provider,
          pendingCount,
          threshold: CONFIG.alertThresholds.pendingTransactions
        });
      }
      
      // Check for stale transactions
      const staleTransactions = await queue.getStaleTransactions(CONFIG.alertThresholds.syncDelay);
      
      if (staleTransactions.length > 0) {
        console.warn(`⚠️ ${provider}: ${staleTransactions.length} stale transactions detected`);
        
        // Re-queue stale transactions
        for (const transaction of staleTransactions) {
          await this.queueForRetry(provider, transaction);
        }
      }
    }
  }

  /**
   * Start reconciliation process
   */
  startReconciliation() {
    setInterval(async () => {
      console.log('🔍 Starting transaction reconciliation...');
      
      for (const [provider, syncEngine] of this.providers) {
        try {
          const result = await this.reconciliationEngine.reconcile(provider, syncEngine);
          
          // Update reconciliation status
          metrics.transactionReconciliationStatus.set(
            { provider, business_id: 'all' },
            result.success ? 1 : 0
          );
          
          if (!result.success) {
            console.error(`❌ Reconciliation failed for ${provider}:`, result.errors);
            
            await this.alertManager.triggerAlert('reconciliation_failed', {
              provider,
              errors: result.errors,
              discrepancies: result.discrepancies
            });
          } else {
            console.log(`✅ Reconciliation completed for ${provider}: ${result.matched}/${result.total} matched`);
          }
          
        } catch (error) {
          console.error(`❌ Reconciliation error for ${provider}:`, error);
        }
      }
    }, CONFIG.reconciliationInterval);
  }

  /**
   * Check overall sync health
   */
  async checkSyncHealth() {
    const healthReport = {
      timestamp: Date.now(),
      providers: {}
    };
    
    for (const [provider, syncEngine] of this.providers) {
      const queue = this.syncQueues.get(provider);
      
      const health = {
        pending: await queue.getPendingCount(),
        failed: await queue.getFailedCount(),
        accuracy: await this.getAccuracy(provider),
        lastSync: await syncEngine.getLastSyncTime(),
        status: 'healthy'
      };
      
      // Determine health status
      if (health.pending > CONFIG.alertThresholds.pendingTransactions) {
        health.status = 'degraded';
      }
      
      if (health.accuracy < CONFIG.alertThresholds.accuracyRate * 100) {
        health.status = 'unhealthy';
      }
      
      const timeSinceSync = Date.now() - health.lastSync;
      if (timeSinceSync > CONFIG.alertThresholds.syncDelay * 2) {
        health.status = 'critical';
      }
      
      healthReport.providers[provider] = health;
    }
    
    // Store health report
    await this.redis.set(
      'transaction:sync:health',
      JSON.stringify(healthReport),
      'EX',
      300 // 5 minute expiry
    );
    
    return healthReport;
  }

  /**
   * Update transaction status in database
   */
  async updateTransactionStatus(transactionId, status, metadata = {}) {
    const update = {
      transactionId,
      status,
      ...metadata,
      updatedAt: Date.now()
    };
    
    await this.redis.hset(
      `transaction:${transactionId}`,
      'status',
      status,
      'metadata',
      JSON.stringify(metadata),
      'updatedAt',
      Date.now()
    );
  }

  /**
   * Check for duplicate transactions
   */
  async checkDuplicate(transaction) {
    const duplicateKey = `${transaction.businessId}:${transaction.amount}:${transaction.timestamp}`;
    const exists = await this.redis.exists(`transaction:duplicate:${duplicateKey}`);
    
    if (!exists) {
      // Mark as seen
      await this.redis.setex(
        `transaction:duplicate:${duplicateKey}`,
        3600, // 1 hour TTL
        transaction.transactionId
      );
    }
    
    return exists === 1;
  }

  /**
   * Update accuracy metric
   */
  async updateAccuracyMetric(provider, businessId, score) {
    const key = `accuracy:${provider}:${businessId}`;
    
    // Add to rolling average
    await this.redis.zadd(key, Date.now(), score);
    
    // Keep only last 100 scores
    await this.redis.zremrangebyrank(key, 0, -101);
    
    // Calculate average
    const scores = await this.redis.zrange(key, 0, -1);
    const average = scores.reduce((sum, s) => sum + parseFloat(s), 0) / scores.length;
    
    metrics.transactionVerificationAccuracy.set(
      { provider, business_id: businessId },
      average
    );
  }

  /**
   * Get accuracy for provider
   */
  async getAccuracy(provider) {
    const key = `accuracy:${provider}:all`;
    const scores = await this.redis.zrange(key, 0, -1);
    
    if (scores.length === 0) return 100;
    
    return scores.reduce((sum, s) => sum + parseFloat(s), 0) / scores.length;
  }

  /**
   * Queue transaction for retry
   */
  async queueForRetry(provider, transaction) {
    const queue = this.syncQueues.get(provider);
    await queue.addToRetryQueue(transaction);
  }

  /**
   * Move transaction to dead letter queue
   */
  async moveToDeadLetter(provider, transaction, error) {
    await this.redis.lpush(
      `transaction:dlq:${provider}`,
      JSON.stringify({
        transaction,
        error: error.message,
        movedAt: Date.now()
      })
    );
    
    console.error(`💀 Transaction ${transaction.transactionId} moved to DLQ`);
  }

  /**
   * Classify error types
   */
  classifyError(error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('not found')) return 'not_found';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('verification')) return 'verification';
    if (message.includes('amount')) return 'amount_mismatch';
    if (message.includes('duplicate')) return 'duplicate';
    if (message.includes('network')) return 'network';
    
    return 'unknown';
  }

  /**
   * Setup cleanup handlers
   */
  setupCleanupHandlers() {
    process.on('SIGINT', async () => {
      console.log('Shutting down transaction sync tracker...');
      await this.cleanup();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('Shutting down transaction sync tracker...');
      await this.cleanup();
      process.exit(0);
    });
  }

  async cleanup() {
    // Save current state
    for (const [provider, queue] of this.syncQueues) {
      await queue.saveState();
    }
    
    // Close Redis connection
    await this.redis.quit();
  }
}

/**
 * Provider Sync Engine
 */
class ProviderSyncEngine {
  constructor(provider, config, redis) {
    this.provider = provider;
    this.config = config;
    this.redis = redis;
  }

  async getTransaction(transactionId) {
    // Provider-specific implementation
    // This would actually call the provider's API
    
    // For now, return mock data
    return {
      id: transactionId,
      amount: 100 + Math.random() * 900,
      currency: 'SEK',
      timestamp: new Date().toISOString(),
      paymentMethod: 'card',
      status: 'completed'
    };
  }

  async getLastSyncTime() {
    const lastSync = await this.redis.get(`sync:lasttime:${this.provider}`);
    return lastSync ? parseInt(lastSync) : Date.now();
  }
}

/**
 * Transaction Queue
 */
class TransactionQueue {
  constructor(provider) {
    this.provider = provider;
    this.queue = [];
    this.retryQueue = [];
  }

  async getBatch(size) {
    return this.queue.splice(0, size);
  }

  async getPendingCount() {
    return this.queue.length;
  }

  async getFailedCount() {
    return this.retryQueue.length;
  }

  async getStaleTransactions(threshold) {
    const now = Date.now();
    return this.queue.filter(t => now - t.queuedAt > threshold);
  }

  async addToRetryQueue(transaction) {
    this.retryQueue.push({
      ...transaction,
      retriedAt: Date.now()
    });
  }

  async saveState() {
    // Save queue state to Redis
  }
}

/**
 * Reconciliation Engine
 */
class ReconciliationEngine {
  constructor(redis) {
    this.redis = redis;
  }

  async reconcile(provider, syncEngine) {
    // Implementation of reconciliation logic
    // Would compare local records with POS records
    
    return {
      success: true,
      matched: 95,
      total: 100,
      discrepancies: []
    };
  }
}

/**
 * Alert Manager
 */
class TransactionAlertManager {
  constructor() {
    this.activeAlerts = new Map();
    this.alertCooldown = 300000; // 5 minutes
  }

  async triggerAlert(type, details) {
    const alertKey = `${type}:${details.provider || 'global'}`;
    const lastAlert = this.activeAlerts.get(alertKey);
    
    if (lastAlert && Date.now() - lastAlert < this.alertCooldown) {
      return;
    }
    
    console.error(`🚨 ALERT: ${type}`, details);
    this.activeAlerts.set(alertKey, Date.now());
  }
}

/**
 * Express server
 */
function createServer(tracker) {
  const app = express();
  
  app.use(express.json());
  
  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  
  // Health endpoint
  app.get('/health', async (req, res) => {
    const health = await tracker.checkSyncHealth();
    res.json(health);
  });
  
  // Get sync status
  app.get('/status/:provider?', async (req, res) => {
    const { provider } = req.params;
    
    if (provider) {
      const queue = tracker.syncQueues.get(provider);
      if (!queue) {
        return res.status(404).json({ error: 'Provider not found' });
      }
      
      res.json({
        provider,
        pending: await queue.getPendingCount(),
        failed: await queue.getFailedCount(),
        accuracy: await tracker.getAccuracy(provider)
      });
    } else {
      const status = {};
      for (const [name, queue] of tracker.syncQueues) {
        status[name] = {
          pending: await queue.getPendingCount(),
          failed: await queue.getFailedCount(),
          accuracy: await tracker.getAccuracy(name)
        };
      }
      res.json(status);
    }
  });
  
  return app;
}

// Main execution
async function main() {
  const tracker = new TransactionSyncTracker();
  await tracker.initialize();
  
  const app = createServer(tracker);
  
  app.listen(CONFIG.port, () => {
    console.log(`📡 Transaction Sync Tracker listening on port ${CONFIG.port}`);
    console.log(`📊 Metrics available at http://localhost:${CONFIG.port}/metrics`);
  });
}

if (require.main === module) {
  main().catch(error => {
    console.error('Failed to start transaction sync tracker:', error);
    process.exit(1);
  });
}

module.exports = { TransactionSyncTracker, ProviderSyncEngine, ReconciliationEngine };