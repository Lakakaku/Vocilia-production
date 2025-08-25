const express = require('express');
const promClient = require('prom-client');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
const port = process.env.METRICS_PORT || 3000;

// Create a Registry
const register = new promClient.Registry();

// Add default metrics
promClient.collectDefaultMetrics({ register });

// Database connection
const dbPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
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
    console.log('Connected to Redis');
  } catch (err) {
    console.error('Failed to connect to Redis:', err);
  }
})();

// Business Dashboard Metrics
const businessMetrics = {
  // Active sessions
  activeSessions: new promClient.Gauge({
    name: 'business_dashboard_active_sessions',
    help: 'Number of active business dashboard sessions',
    registers: [register]
  }),

  // Business onboarding metrics
  onboardingDuration: new promClient.Histogram({
    name: 'business_onboarding_duration_seconds',
    help: 'Time taken for business onboarding process',
    buckets: [5, 10, 30, 60, 120, 300, 600],
    registers: [register]
  }),

  // Analytics load time
  analyticsLoadDuration: new promClient.Histogram({
    name: 'business_analytics_load_duration_seconds',
    help: 'Time taken to load business analytics dashboard',
    buckets: [0.5, 1, 2, 3, 5, 10, 15],
    registers: [register]
  }),

  // Report generation time
  reportGenerationDuration: new promClient.Histogram({
    name: 'business_report_generation_duration_seconds',
    help: 'Time taken to generate business reports',
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [register]
  }),

  // Database query performance
  databaseQueryDuration: new promClient.Histogram({
    name: 'database_query_duration_seconds',
    help: 'Database query execution time',
    labelNames: ['service', 'query_type'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    registers: [register]
  }),

  // Database connections
  databaseConnectionsActive: new promClient.Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections',
    labelNames: ['service'],
    registers: [register]
  }),

  databaseConnectionsMax: new promClient.Gauge({
    name: 'database_connections_max',
    help: 'Maximum number of database connections',
    labelNames: ['service'],
    registers: [register]
  }),

  // Cache metrics
  cacheHits: new promClient.Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits',
    labelNames: ['service', 'cache_type'],
    registers: [register]
  }),

  cacheMisses: new promClient.Counter({
    name: 'cache_misses_total',
    help: 'Total number of cache misses',
    labelNames: ['service', 'cache_type'],
    registers: [register]
  }),

  // Business-specific metrics
  businessTotalCount: new promClient.Gauge({
    name: 'businesses_total',
    help: 'Total number of registered businesses',
    registers: [register]
  }),

  businessActiveCount: new promClient.Gauge({
    name: 'businesses_active_total',
    help: 'Total number of active businesses',
    registers: [register]
  }),

  businessLocationCount: new promClient.Gauge({
    name: 'business_locations_total',
    help: 'Total number of business locations',
    registers: [register]
  }),

  feedbackSessionsToday: new promClient.Gauge({
    name: 'feedback_sessions_today_total',
    help: 'Total feedback sessions today',
    registers: [register]
  }),

  revenueToday: new promClient.Gauge({
    name: 'business_revenue_today_sek',
    help: 'Total business revenue today in SEK',
    registers: [register]
  }),

  // Session timeouts
  sessionTimeouts: new promClient.Counter({
    name: 'business_session_timeouts_total',
    help: 'Total number of business dashboard session timeouts',
    registers: [register]
  }),

  // Login performance
  loginDuration: new promClient.Histogram({
    name: 'business_login_duration_seconds',
    help: 'Time taken for business login process',
    buckets: [0.5, 1, 2, 3, 5, 10],
    registers: [register]
  }),

  // Location switch performance
  locationSwitchDuration: new promClient.Histogram({
    name: 'location_switch_duration_seconds',
    help: 'Time taken to switch between business locations',
    buckets: [0.5, 1, 2, 3, 5],
    registers: [register]
  }),

  // Revenue calculation performance
  revenueCalculationDuration: new promClient.Histogram({
    name: 'revenue_calculation_duration_seconds',
    help: 'Time taken for revenue calculations',
    buckets: [0.1, 0.5, 1, 2, 5, 10, 20],
    registers: [register]
  }),

  // Payout processing performance
  payoutProcessingDuration: new promClient.Histogram({
    name: 'payout_processing_duration_seconds',
    help: 'Time taken for payout processing',
    buckets: [1, 5, 10, 30, 60, 120],
    registers: [register]
  }),

  // Business data loading performance
  businessDataLoadDuration: new promClient.Histogram({
    name: 'business_data_load_duration_seconds',
    help: 'Time taken to load business data',
    buckets: [0.5, 1, 2, 3, 5, 10],
    registers: [register]
  }),

  // Export performance
  businessExportDuration: new promClient.Histogram({
    name: 'business_export_duration_seconds',
    help: 'Time taken for business data export',
    buckets: [5, 10, 30, 60, 120, 300],
    registers: [register]
  }),

  // Queue metrics
  businessDashboardQueueLength: new promClient.Gauge({
    name: 'business_dashboard_queue_length',
    help: 'Number of items in business dashboard processing queue',
    registers: [register]
  }),

  // WebSocket metrics
  websocketConnectionsActive: new promClient.Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
    labelNames: ['service'],
    registers: [register]
  }),

  websocketMessageDuration: new promClient.Histogram({
    name: 'websocket_message_duration_seconds',
    help: 'WebSocket message processing time',
    labelNames: ['service', 'message_type'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
    registers: [register]
  }),

  // Health check metrics
  healthCheckFailures: new promClient.Counter({
    name: 'health_check_failures_total',
    help: 'Total number of health check failures',
    labelNames: ['service'],
    registers: [register]
  })
};

// Collect business metrics from database
async function collectBusinessMetrics() {
  try {
    console.log('Collecting business metrics...');

    // Total businesses
    const businessResult = await dbPool.query(`
      SELECT 
        COUNT(*) as total_businesses,
        COUNT(CASE WHEN approved_at IS NOT NULL THEN 1 END) as active_businesses
      FROM businesses
    `);
    
    if (businessResult.rows[0]) {
      businessMetrics.businessTotalCount.set(parseInt(businessResult.rows[0].total_businesses));
      businessMetrics.businessActiveCount.set(parseInt(businessResult.rows[0].active_businesses));
    }

    // Business locations
    const locationResult = await dbPool.query(`
      SELECT COUNT(*) as total_locations
      FROM business_locations
      WHERE is_active = true
    `);
    
    if (locationResult.rows[0]) {
      businessMetrics.businessLocationCount.set(parseInt(locationResult.rows[0].total_locations));
    }

    // Today's feedback sessions
    const feedbackResult = await dbPool.query(`
      SELECT COUNT(*) as sessions_today
      FROM feedback_sessions
      WHERE created_at >= CURRENT_DATE
    `);
    
    if (feedbackResult.rows[0]) {
      businessMetrics.feedbackSessionsToday.set(parseInt(feedbackResult.rows[0].sessions_today));
    }

    // Today's revenue
    const revenueResult = await dbPool.query(`
      SELECT COALESCE(SUM(amount), 0) as revenue_today
      FROM payments
      WHERE created_at >= CURRENT_DATE
      AND status = 'completed'
    `);
    
    if (revenueResult.rows[0]) {
      businessMetrics.revenueToday.set(parseFloat(revenueResult.rows[0].revenue_today));
    }

    // Database connection metrics
    businessMetrics.databaseConnectionsActive.set(
      { service: 'business-dashboard' },
      dbPool.totalCount
    );
    businessMetrics.databaseConnectionsMax.set(
      { service: 'business-dashboard' },
      dbPool.options.max
    );

    console.log('Business metrics collected successfully');

  } catch (error) {
    console.error('Error collecting business metrics:', error);
    businessMetrics.healthCheckFailures.inc({ service: 'business-dashboard' });
  }
}

// Collect Redis metrics
async function collectRedisMetrics() {
  try {
    if (!redisClient.isOpen) {
      console.log('Redis client not connected, skipping Redis metrics');
      return;
    }

    // Get Redis info
    const info = await redisClient.info();
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.startsWith('connected_clients:')) {
        const connections = parseInt(line.split(':')[1]);
        businessMetrics.websocketConnectionsActive.set(
          { service: 'business-dashboard' },
          connections
        );
      }
    }

    console.log('Redis metrics collected successfully');

  } catch (error) {
    console.error('Error collecting Redis metrics:', error);
  }
}

// Simulate some business-specific metrics
function simulateBusinessMetrics() {
  // Simulate active sessions (would be real data in production)
  const activeSessions = Math.floor(Math.random() * 100) + 50;
  businessMetrics.activeSessions.set(activeSessions);

  // Simulate queue length
  const queueLength = Math.floor(Math.random() * 20);
  businessMetrics.businessDashboardQueueLength.set(queueLength);

  // Simulate some performance metrics with realistic values
  businessMetrics.analyticsLoadDuration.observe(Math.random() * 3 + 0.5);
  businessMetrics.reportGenerationDuration.observe(Math.random() * 20 + 5);
  businessMetrics.businessDataLoadDuration.observe(Math.random() * 2 + 0.3);
  
  // Simulate cache hits and misses
  if (Math.random() > 0.2) {
    businessMetrics.cacheHits.inc({ service: 'business-dashboard', cache_type: 'analytics' });
  } else {
    businessMetrics.cacheMisses.inc({ service: 'business-dashboard', cache_type: 'analytics' });
  }

  console.log('Business metrics simulated');
}

// Collect all metrics
async function collectAllMetrics() {
  await collectBusinessMetrics();
  await collectRedisMetrics();
  simulateBusinessMetrics();
}

// API endpoints for additional metrics (for testing)
app.post('/metrics/onboarding', (req, res) => {
  const duration = parseFloat(req.body.duration) || 0;
  businessMetrics.onboardingDuration.observe(duration);
  res.json({ status: 'recorded' });
});

app.post('/metrics/login', (req, res) => {
  const duration = parseFloat(req.body.duration) || 0;
  businessMetrics.loginDuration.observe(duration);
  res.json({ status: 'recorded' });
});

app.post('/metrics/session-timeout', (req, res) => {
  businessMetrics.sessionTimeouts.inc();
  res.json({ status: 'recorded' });
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    // Collect fresh metrics
    await collectAllMetrics();
    
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    console.error('Error generating metrics:', error);
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
  console.log(`Business metrics exporter listening on port ${port}`);
  console.log(`Metrics available at http://localhost:${port}/metrics`);
  
  // Collect initial metrics
  collectAllMetrics().catch(console.error);
  
  // Collect metrics every 30 seconds
  setInterval(() => {
    collectAllMetrics().catch(console.error);
  }, 30000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down metrics exporter...');
  
  try {
    await dbPool.end();
    await redisClient.quit();
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down...');
  
  try {
    await dbPool.end();
    await redisClient.quit();
  } catch (error) {
    console.error('Error during shutdown:', error);
  }
  
  process.exit(0);
});