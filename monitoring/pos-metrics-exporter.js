const express = require('express');
const promClient = require('prom-client');
const { Pool } = require('pg');
const redis = require('redis');
const fetch = require('node-fetch');

const app = express();
const port = process.env.POS_METRICS_PORT || 3004;

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Database connection
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Redis connection
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
    console.log('POS Metrics Exporter connected to Redis');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// POS Integration Metrics
const posMetrics = {
  // Connection health metrics
  connectionHealth: new promClient.Gauge({
    name: 'pos_connection_health_score',
    help: 'POS connection health score (0-100)',
    labelNames: ['provider', 'business_id'],
    registers: [register]
  }),

  // API call success rates
  apiSuccessRate: new promClient.Gauge({
    name: 'pos_api_success_rate_percent',
    help: 'POS API success rate percentage',
    labelNames: ['provider', 'endpoint'],
    registers: [register]
  }),

  // OAuth token status
  tokenExpiryHours: new promClient.Gauge({
    name: 'pos_oauth_token_expiry_hours',
    help: 'Hours until OAuth token expiry',
    labelNames: ['provider', 'business_id'],
    registers: [register]
  }),

  // Webhook delivery stats
  webhookDeliveryRate: new promClient.Gauge({
    name: 'pos_webhook_delivery_rate_percent',
    help: 'Webhook delivery success rate percentage',
    labelNames: ['provider'],
    registers: [register]
  }),

  // Transaction verification metrics
  transactionMatchRate: new promClient.Gauge({
    name: 'pos_transaction_match_rate_percent',
    help: 'Transaction verification match rate percentage',
    labelNames: ['provider'],
    registers: [register]
  }),

  // Business-specific metrics
  businessSyncStatus: new promClient.Gauge({
    name: 'pos_business_sync_status',
    help: 'Business POS sync status (1=synced, 0=out of sync)',
    labelNames: ['provider', 'business_id'],
    registers: [register]
  }),

  // Rate limit tracking
  rateLimitUsage: new promClient.Gauge({
    name: 'pos_rate_limit_usage_percent',
    help: 'POS API rate limit usage percentage',
    labelNames: ['provider'],
    registers: [register]
  }),

  // External provider status
  externalProviderStatus: new promClient.Gauge({
    name: 'pos_external_provider_status',
    help: 'External POS provider status (1=up, 0=down)',
    labelNames: ['provider'],
    registers: [register]
  }),

  // Sync operation metrics
  syncOperationDuration: new promClient.Gauge({
    name: 'pos_sync_operation_duration_seconds',
    help: 'Average POS sync operation duration',
    labelNames: ['provider', 'operation_type'],
    registers: [register]
  }),

  // Error tracking
  recentErrorCount: new promClient.Gauge({
    name: 'pos_recent_error_count',
    help: 'Number of POS errors in the last hour',
    labelNames: ['provider', 'error_type'],
    registers: [register]
  }),

  // Data freshness
  lastSuccessfulSync: new promClient.Gauge({
    name: 'pos_last_successful_sync_timestamp',
    help: 'Timestamp of last successful POS sync',
    labelNames: ['provider', 'business_id'],
    registers: [register]
  }),

  // Webhook processing queue
  webhookQueueLength: new promClient.Gauge({
    name: 'pos_webhook_queue_length',
    help: 'Number of webhooks in processing queue',
    labelNames: ['provider'],
    registers: [register]
  }),

  // Business onboarding metrics
  businessOnboardingStatus: new promClient.Gauge({
    name: 'pos_business_onboarding_status',
    help: 'Business POS onboarding completion status',
    labelNames: ['provider', 'business_id'],
    registers: [register]
  }),

  // Location sync status
  locationSyncStatus: new promClient.Gauge({
    name: 'pos_location_sync_status',
    help: 'POS location sync status',
    labelNames: ['provider', 'location_id'],
    registers: [register]
  }),

  // Credential validation
  credentialValidationStatus: new promClient.Gauge({
    name: 'pos_credential_validation_status',
    help: 'POS credential validation status',
    labelNames: ['provider', 'business_id'],
    registers: [register]
  })
};

// Collect POS-specific metrics
async function collectPOSMetrics() {
  try {
    console.log('Collecting POS metrics...');

    // Collect connection health metrics
    await collectConnectionHealth();

    // Collect API success rates
    await collectAPISuccessRates();

    // Collect OAuth token status
    await collectOAuthTokenStatus();

    // Collect webhook delivery stats
    await collectWebhookDeliveryStats();

    // Collect transaction verification metrics
    await collectTransactionVerificationMetrics();

    // Collect business sync status
    await collectBusinessSyncStatus();

    // Check external provider status
    await checkExternalProviderStatus();

    // Collect sync operation metrics
    await collectSyncOperationMetrics();

    // Collect error metrics
    await collectErrorMetrics();

    // Update webhook queue metrics
    await updateWebhookQueueMetrics();

    console.log('POS metrics collection completed');
  } catch (error) {
    console.error('Error collecting POS metrics:', error);
  }
}

// Connection health collection
async function collectConnectionHealth() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        pc.provider,
        pc.business_id,
        b.name as business_name,
        CASE 
          WHEN pc.last_health_check_at > NOW() - INTERVAL '5 minutes' AND pc.is_healthy = true THEN 100
          WHEN pc.last_health_check_at > NOW() - INTERVAL '15 minutes' AND pc.is_healthy = true THEN 80
          WHEN pc.last_health_check_at > NOW() - INTERVAL '30 minutes' THEN 50
          ELSE 0
        END as health_score
      FROM pos_credentials pc
      JOIN businesses b ON pc.business_id = b.id
      WHERE pc.is_active = true
    `);

    for (const row of rows) {
      posMetrics.connectionHealth
        .labels(row.provider, row.business_id)
        .set(row.health_score);
    }
  } catch (error) {
    console.error('Error collecting connection health:', error);
  }
}

// API success rates collection
async function collectAPISuccessRates() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        provider,
        endpoint,
        COUNT(*) as total_calls,
        COUNT(CASE WHEN success = true THEN 1 END) as successful_calls,
        ROUND(
          (COUNT(CASE WHEN success = true THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as success_rate
      FROM pos_api_logs
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY provider, endpoint
    `);

    for (const row of rows) {
      posMetrics.apiSuccessRate
        .labels(row.provider, row.endpoint)
        .set(row.success_rate);
    }
  } catch (error) {
    console.error('Error collecting API success rates:', error);
  }
}

// OAuth token status collection
async function collectOAuthTokenStatus() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        provider,
        business_id,
        CASE 
          WHEN token_expires_at IS NULL THEN 8760  -- 1 year for non-expiring tokens
          ELSE EXTRACT(EPOCH FROM (token_expires_at - NOW())) / 3600
        END as hours_until_expiry
      FROM pos_credentials
      WHERE is_active = true
    `);

    for (const row of rows) {
      posMetrics.tokenExpiryHours
        .labels(row.provider, row.business_id)
        .set(Math.max(0, row.hours_until_expiry));
    }
  } catch (error) {
    console.error('Error collecting OAuth token status:', error);
  }
}

// Webhook delivery stats collection
async function collectWebhookDeliveryStats() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        provider,
        COUNT(*) as total_deliveries,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as successful_deliveries,
        ROUND(
          (COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as delivery_rate
      FROM webhook_deliveries
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY provider
    `);

    for (const row of rows) {
      posMetrics.webhookDeliveryRate
        .labels(row.provider)
        .set(row.delivery_rate);
    }
  } catch (error) {
    console.error('Error collecting webhook delivery stats:', error);
  }
}

// Transaction verification metrics collection
async function collectTransactionVerificationMetrics() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        provider,
        COUNT(*) as total_verifications,
        COUNT(CASE WHEN result = 'found' THEN 1 END) as successful_matches,
        ROUND(
          (COUNT(CASE WHEN result = 'found' THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as match_rate
      FROM transaction_verifications
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY provider
    `);

    for (const row of rows) {
      posMetrics.transactionMatchRate
        .labels(row.provider)
        .set(row.match_rate);
    }
  } catch (error) {
    console.error('Error collecting transaction verification metrics:', error);
  }
}

// Business sync status collection
async function collectBusinessSyncStatus() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        pc.provider,
        pc.business_id,
        CASE 
          WHEN pc.last_sync_at > NOW() - INTERVAL '1 hour' THEN 1
          ELSE 0
        END as sync_status,
        EXTRACT(EPOCH FROM pc.last_sync_at) as last_sync_timestamp
      FROM pos_credentials pc
      WHERE pc.is_active = true
    `);

    for (const row of rows) {
      posMetrics.businessSyncStatus
        .labels(row.provider, row.business_id)
        .set(row.sync_status);

      if (row.last_sync_timestamp) {
        posMetrics.lastSuccessfulSync
          .labels(row.provider, row.business_id)
          .set(row.last_sync_timestamp);
      }
    }
  } catch (error) {
    console.error('Error collecting business sync status:', error);
  }
}

// External provider status check
async function checkExternalProviderStatus() {
  const providers = [
    { name: 'square', statusUrl: 'https://status.squareup.com/api/v2/status.json' },
    { name: 'shopify', statusUrl: 'https://status.shopify.com/api/v2/status.json' },
    // Zettle doesn't have a public status API
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider.statusUrl, { timeout: 10000 });
      const data = await response.json();
      
      let status = 0;
      if (provider.name === 'square') {
        status = data.status?.indicator === 'none' ? 1 : 0;
      } else if (provider.name === 'shopify') {
        status = data.status?.indicator === 'none' ? 1 : 0;
      }

      posMetrics.externalProviderStatus
        .labels(provider.name)
        .set(status);
    } catch (error) {
      console.error(`Error checking ${provider.name} status:`, error);
      posMetrics.externalProviderStatus
        .labels(provider.name)
        .set(0);
    }
  }

  // Default Zettle to up (no status API available)
  posMetrics.externalProviderStatus
    .labels('zettle')
    .set(1);
}

// Sync operation metrics collection
async function collectSyncOperationMetrics() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        provider,
        operation_type,
        AVG(duration_ms) / 1000.0 as avg_duration_seconds
      FROM pos_sync_operations
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY provider, operation_type
    `);

    for (const row of rows) {
      posMetrics.syncOperationDuration
        .labels(row.provider, row.operation_type)
        .set(row.avg_duration_seconds);
    }
  } catch (error) {
    console.error('Error collecting sync operation metrics:', error);
  }
}

// Error metrics collection
async function collectErrorMetrics() {
  try {
    const { rows } = await dbPool.query(`
      SELECT 
        provider,
        COALESCE(error_type, 'unknown') as error_type,
        COUNT(*) as error_count
      FROM pos_api_logs
      WHERE success = false 
        AND created_at > NOW() - INTERVAL '1 hour'
      GROUP BY provider, error_type
    `);

    for (const row of rows) {
      posMetrics.recentErrorCount
        .labels(row.provider, row.error_type)
        .set(row.error_count);
    }
  } catch (error) {
    console.error('Error collecting error metrics:', error);
  }
}

// Webhook queue metrics
async function updateWebhookQueueMetrics() {
  try {
    if (!redisClient.isOpen) {
      return;
    }

    const providers = ['square', 'shopify', 'zettle'];
    for (const provider of providers) {
      const queueKey = `webhook_queue:${provider}`;
      const queueLength = await redisClient.lLen(queueKey);
      
      posMetrics.webhookQueueLength
        .labels(provider)
        .set(queueLength);
    }
  } catch (error) {
    console.error('Error updating webhook queue metrics:', error);
  }
}

// Rate limit monitoring
async function collectRateLimitMetrics() {
  try {
    if (!redisClient.isOpen) {
      return;
    }

    const providers = ['square', 'shopify', 'zettle'];
    for (const provider of providers) {
      const rateLimitKey = `rate_limit:${provider}`;
      const rateLimitData = await redisClient.get(rateLimitKey);
      
      if (rateLimitData) {
        const data = JSON.parse(rateLimitData);
        const usagePercent = ((data.limit - data.remaining) / data.limit) * 100;
        
        posMetrics.rateLimitUsage
          .labels(provider)
          .set(usagePercent);
      }
    }
  } catch (error) {
    console.error('Error collecting rate limit metrics:', error);
  }
}

// Test POS provider connections
async function testPOSConnections() {
  try {
    const response = await fetch(`${process.env.API_GATEWAY_URL}/pos/health`, {
      timeout: 30000
    });
    
    if (response.ok) {
      const data = await response.json();
      
      for (const [provider, status] of Object.entries(data.providers)) {
        posMetrics.connectionHealth
          .labels(provider, 'system')
          .set(status.healthy ? 100 : 0);
      }
    }
  } catch (error) {
    console.error('Error testing POS connections:', error);
  }
}

// API endpoints for manual metric updates
app.post('/metrics/pos/health', express.json(), (req, res) => {
  const { provider, business_id, health_score } = req.body;
  
  if (provider && health_score !== undefined) {
    posMetrics.connectionHealth
      .labels(provider, business_id || 'unknown')
      .set(health_score);
    
    res.json({ status: 'recorded' });
  } else {
    res.status(400).json({ error: 'Invalid data' });
  }
});

app.post('/metrics/pos/token-expiry', express.json(), (req, res) => {
  const { provider, business_id, hours_until_expiry } = req.body;
  
  if (provider && hours_until_expiry !== undefined) {
    posMetrics.tokenExpiryHours
      .labels(provider, business_id || 'unknown')
      .set(hours_until_expiry);
    
    res.json({ status: 'recorded' });
  } else {
    res.status(400).json({ error: 'Invalid data' });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    // Collect fresh metrics
    await collectPOSMetrics();
    await collectRateLimitMetrics();
    await testPOSConnections();
    
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Error generating POS metrics:', error);
    res.status(500).json({ error: 'Failed to generate metrics' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    database: dbPool.totalCount > 0 ? 'connected' : 'disconnected',
    redis: redisClient.isOpen ? 'connected' : 'disconnected'
  });
});

// Start the server
app.listen(port, () => {
  console.log(`POS metrics exporter listening on port ${port}`);
  console.log(`Metrics available at http://localhost:${port}/metrics`);
  
  // Collect initial metrics
  collectPOSMetrics().catch(console.error);
  
  // Collect metrics every 30 seconds
  setInterval(() => {
    collectPOSMetrics().catch(console.error);
  }, 30000);

  // Collect rate limit metrics every 60 seconds
  setInterval(() => {
    collectRateLimitMetrics().catch(console.error);
  }, 60000);

  // Test POS connections every 2 minutes
  setInterval(() => {
    testPOSConnections().catch(console.error);
  }, 120000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down POS metrics exporter...');
  
  try {
    await dbPool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down POS metrics exporter...');
  
  try {
    await dbPool.end();
    if (redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

module.exports = app;