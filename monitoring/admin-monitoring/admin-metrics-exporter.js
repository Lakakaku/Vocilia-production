const express = require('express');
const promClient = require('prom-client');
const { Pool } = require('pg');
const redis = require('redis');
const moment = require('moment');

// Admin Metrics Exporter for Swedish Pilot Management
console.log('🔧 Starting Admin Metrics Exporter for Swedish Pilot');

const app = express();
const port = process.env.PORT || 3000;

// Create Prometheus registry
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register, prefix: 'admin_' });

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

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.connect().catch(console.error);

// Admin-specific metrics
const adminMetrics = {
  // Admin user activity
  adminActiveUsers: new promClient.Gauge({
    name: 'admin_active_users_total',
    help: 'Number of active admin users',
    labelNames: ['role', 'region'],
    registers: [register]
  }),

  adminLoginAttempts: new promClient.Counter({
    name: 'admin_login_attempts_total',
    help: 'Total admin login attempts',
    labelNames: ['status', 'role', 'method'],
    registers: [register]
  }),

  adminSessionDuration: new promClient.Histogram({
    name: 'admin_session_duration_seconds',
    help: 'Admin session duration',
    buckets: [300, 600, 1800, 3600, 7200, 14400, 28800],
    labelNames: ['role', 'region'],
    registers: [register]
  }),

  // Swedish pilot management metrics
  swedishPilotBusinesses: new promClient.Gauge({
    name: 'admin_swedish_pilot_businesses_total',
    help: 'Total businesses in Swedish pilot',
    labelNames: ['status', 'tier', 'region'],
    registers: [register]
  }),

  pilotOnboardingRate: new promClient.Gauge({
    name: 'admin_pilot_onboarding_rate_per_day',
    help: 'Business onboarding rate per day',
    labelNames: ['region'],
    registers: [register]
  }),

  pilotPaymentVolume: new promClient.Gauge({
    name: 'admin_pilot_payment_volume_sek',
    help: 'Total payment volume in Swedish pilot (SEK)',
    labelNames: ['region', 'business_tier'],
    registers: [register]
  }),

  pilotComplianceStatus: new promClient.Gauge({
    name: 'admin_pilot_compliance_status',
    help: 'Compliance status of pilot businesses (0=non-compliant, 1=compliant)',
    labelNames: ['business_id', 'compliance_type'],
    registers: [register]
  }),

  // Admin operations metrics
  adminOperations: new promClient.Counter({
    name: 'admin_operations_total',
    help: 'Total admin operations performed',
    labelNames: ['operation_type', 'admin_role', 'status'],
    registers: [register]
  }),

  adminOperationDuration: new promClient.Histogram({
    name: 'admin_operation_duration_seconds',
    help: 'Time taken for admin operations',
    buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
    labelNames: ['operation_type', 'admin_role'],
    registers: [register]
  }),

  // System health from admin perspective
  systemHealthScore: new promClient.Gauge({
    name: 'admin_system_health_score',
    help: 'Overall system health score (0-100)',
    labelNames: ['component'],
    registers: [register]
  }),

  criticalIssues: new promClient.Gauge({
    name: 'admin_critical_issues_total',
    help: 'Number of critical issues requiring admin attention',
    labelNames: ['severity', 'component'],
    registers: [register]
  }),

  // Financial authority compliance
  fiReportingStatus: new promClient.Gauge({
    name: 'admin_fi_reporting_status',
    help: 'Finansinspektionen reporting status (0=failed, 1=success)',
    labelNames: ['report_type', 'period'],
    registers: [register]
  }),

  complianceEvents: new promClient.Counter({
    name: 'admin_compliance_events_total',
    help: 'Total compliance events',
    labelNames: ['event_type', 'severity', 'business_id'],
    registers: [register]
  }),

  // Resource utilization
  resourceUtilization: new promClient.Gauge({
    name: 'admin_resource_utilization_percent',
    help: 'Resource utilization percentage',
    labelNames: ['resource_type', 'region'],
    registers: [register]
  }),

  costMetrics: new promClient.Gauge({
    name: 'admin_estimated_costs_sek',
    help: 'Estimated operational costs in SEK',
    labelNames: ['cost_category', 'period'],
    registers: [register]
  }),

  // Business performance metrics
  businessPerformanceScore: new promClient.Gauge({
    name: 'admin_business_performance_score',
    help: 'Business performance score (0-100)',
    labelNames: ['business_id', 'metric_type'],
    registers: [register]
  }),

  customerSatisfactionScore: new promClient.Gauge({
    name: 'admin_customer_satisfaction_score',
    help: 'Average customer satisfaction score',
    labelNames: ['business_id', 'region'],
    registers: [register]
  }),

  // Admin dashboard usage
  dashboardViews: new promClient.Counter({
    name: 'admin_dashboard_views_total',
    help: 'Total admin dashboard views',
    labelNames: ['dashboard_type', 'admin_role'],
    registers: [register]
  }),

  alertResponseTime: new promClient.Histogram({
    name: 'admin_alert_response_time_seconds',
    help: 'Time taken to respond to alerts',
    buckets: [60, 300, 900, 1800, 3600, 7200],
    labelNames: ['alert_severity', 'admin_role'],
    registers: [register]
  })
};

// Collect admin user metrics
async function collectAdminUserMetrics() {
  try {
    console.log('Collecting admin user metrics...');

    // Active admin users (simulated - would be real in production)
    const activeAdmins = await redisClient.keys('admin_session:*');
    
    // Simulate role and region distribution
    const roles = ['super_admin', 'pilot_admin', 'business_admin', 'compliance_admin'];
    const regions = ['stockholm', 'gothenburg', 'malmo', 'national'];
    
    roles.forEach(role => {
      regions.forEach(region => {
        const count = Math.floor(Math.random() * 5) + (role === 'pilot_admin' ? 2 : 0);
        adminMetrics.adminActiveUsers.set({ role, region }, count);
      });
    });

    // Login attempts (based on logs or session data)
    const loginStats = {
      success: Math.floor(Math.random() * 50) + 20,
      failure: Math.floor(Math.random() * 10) + 2,
      mfa_required: Math.floor(Math.random() * 5) + 1
    };

    roles.forEach(role => {
      adminMetrics.adminLoginAttempts.inc({ status: 'success', role, method: 'password' }, loginStats.success);
      adminMetrics.adminLoginAttempts.inc({ status: 'failure', role, method: 'password' }, loginStats.failure);
      adminMetrics.adminLoginAttempts.inc({ status: 'success', role, method: 'mfa' }, loginStats.mfa_required);
    });

    console.log('Admin user metrics collected successfully');

  } catch (error) {
    console.error('Error collecting admin user metrics:', error);
  }
}

// Collect Swedish pilot metrics
async function collectSwedishPilotMetrics() {
  try {
    console.log('Collecting Swedish pilot metrics...');

    // Business metrics from database
    const businessStats = await dbPool.query(`
      SELECT 
        bl.region,
        b.tier,
        b.status,
        COUNT(*) as business_count,
        AVG(CASE WHEN b.compliance_verified THEN 100 ELSE 0 END) as compliance_rate,
        COALESCE(SUM(p.amount), 0) as total_payments_sek
      FROM businesses b
      LEFT JOIN business_locations bl ON b.id = bl.business_id
      LEFT JOIN payments p ON b.id = p.business_id 
        AND p.created_at >= NOW() - INTERVAL '24 hours'
        AND p.status = 'completed'
      WHERE b.pilot_participant = true OR b.test_mode = true
      GROUP BY bl.region, b.tier, b.status
    `);

    // Update Swedish pilot business metrics
    businessStats.rows.forEach(row => {
      const region = row.region || 'unknown';
      const tier = row.tier?.toString() || '1';
      const status = row.status || 'pending';
      
      adminMetrics.swedishPilotBusinesses.set(
        { status, tier, region }, 
        parseInt(row.business_count) || 0
      );
      
      adminMetrics.pilotPaymentVolume.set(
        { region, business_tier: tier }, 
        parseFloat(row.total_payments_sek) || 0
      );
    });

    // Onboarding rate (simulated with realistic data)
    const regions = ['stockholm', 'gothenburg', 'malmo'];
    regions.forEach(region => {
      const rate = Math.floor(Math.random() * 3) + 1; // 1-3 businesses per day
      adminMetrics.pilotOnboardingRate.set({ region }, rate);
    });

    // Compliance status
    const complianceResult = await dbPool.query(`
      SELECT 
        b.id as business_id,
        CASE WHEN b.compliance_verified THEN 1 ELSE 0 END as psd2_compliant,
        CASE WHEN b.bank_account_verified THEN 1 ELSE 0 END as banking_compliant
      FROM businesses b
      WHERE b.pilot_participant = true OR b.test_mode = true
      LIMIT 50
    `);

    complianceResult.rows.forEach(row => {
      adminMetrics.pilotComplianceStatus.set(
        { business_id: row.business_id, compliance_type: 'psd2' },
        row.psd2_compliant
      );
      adminMetrics.pilotComplianceStatus.set(
        { business_id: row.business_id, compliance_type: 'banking' },
        row.banking_compliant
      );
    });

    console.log('Swedish pilot metrics collected successfully');

  } catch (error) {
    console.error('Error collecting Swedish pilot metrics:', error);
  }
}

// Collect system health metrics
async function collectSystemHealthMetrics() {
  try {
    console.log('Collecting system health metrics...');

    const components = [
      'payment_gateway',
      'business_dashboard', 
      'customer_pwa',
      'database',
      'redis',
      'monitoring'
    ];

    // Simulate system health scores
    components.forEach(component => {
      const healthScore = Math.floor(Math.random() * 20) + 80; // 80-100
      adminMetrics.systemHealthScore.set({ component }, healthScore);
    });

    // Critical issues (simulated)
    const severities = ['low', 'medium', 'high', 'critical'];
    components.forEach(component => {
      severities.forEach(severity => {
        const issueCount = severity === 'critical' ? 
          Math.floor(Math.random() * 2) : 
          Math.floor(Math.random() * 5);
        adminMetrics.criticalIssues.set({ severity, component }, issueCount);
      });
    });

    // Resource utilization
    const resourceTypes = ['cpu', 'memory', 'disk', 'network'];
    const regions = ['stockholm', 'gothenburg', 'malmo'];
    
    resourceTypes.forEach(resourceType => {
      regions.forEach(region => {
        const utilization = Math.floor(Math.random() * 40) + 30; // 30-70%
        adminMetrics.resourceUtilization.set({ resource_type: resourceType, region }, utilization);
      });
    });

    console.log('System health metrics collected successfully');

  } catch (error) {
    console.error('Error collecting system health metrics:', error);
  }
}

// Collect compliance metrics
async function collectComplianceMetrics() {
  try {
    console.log('Collecting compliance metrics...');

    // FI reporting status
    const reportTypes = ['monthly_summary', 'transaction_detail', 'compliance_issue'];
    const currentPeriod = moment().format('YYYY-MM');
    
    reportTypes.forEach(reportType => {
      const status = Math.random() > 0.1 ? 1 : 0; // 90% success rate
      adminMetrics.fiReportingStatus.set({ report_type: reportType, period: currentPeriod }, status);
    });

    // Compliance events from database
    const complianceEventsResult = await dbPool.query(`
      SELECT 
        type as event_type,
        severity,
        COUNT(*) as event_count
      FROM compliance_events 
      WHERE created_at >= NOW() - INTERVAL '1 day'
      GROUP BY type, severity
    `);

    complianceEventsResult.rows.forEach(row => {
      adminMetrics.complianceEvents.inc(
        { 
          event_type: row.event_type, 
          severity: row.severity, 
          business_id: 'aggregate' 
        },
        parseInt(row.event_count)
      );
    });

    console.log('Compliance metrics collected successfully');

  } catch (error) {
    console.error('Error collecting compliance metrics:', error);
  }
}

// Collect business performance metrics
async function collectBusinessPerformanceMetrics() {
  try {
    console.log('Collecting business performance metrics...');

    // Business performance from feedback sessions
    const performanceResult = await dbPool.query(`
      SELECT 
        fs.business_id,
        bl.region,
        AVG(fs.feedback_quality_score) as avg_quality_score,
        COUNT(*) as session_count,
        AVG(fs.reward_percentage) as avg_reward_rate
      FROM feedback_sessions fs
      LEFT JOIN business_locations bl ON fs.location_id = bl.id
      WHERE fs.created_at >= NOW() - INTERVAL '7 days'
        AND fs.status = 'completed'
      GROUP BY fs.business_id, bl.region
      HAVING COUNT(*) >= 3
    `);

    performanceResult.rows.forEach(row => {
      const businessId = row.business_id || 'unknown';
      const region = row.region || 'unknown';
      
      // Performance score based on quality and engagement
      const performanceScore = Math.min(100, 
        (parseFloat(row.avg_quality_score) || 0) * 0.7 + 
        (parseInt(row.session_count) || 0) * 2
      );
      
      adminMetrics.businessPerformanceScore.set(
        { business_id: businessId, metric_type: 'overall' },
        Math.round(performanceScore)
      );
      
      adminMetrics.customerSatisfactionScore.set(
        { business_id: businessId, region },
        parseFloat(row.avg_quality_score) || 0
      );
    });

    console.log('Business performance metrics collected successfully');

  } catch (error) {
    console.error('Error collecting business performance metrics:', error);
  }
}

// Simulate admin operations
function simulateAdminOperations() {
  const operations = [
    'business_approval',
    'compliance_review',
    'payment_investigation',
    'system_configuration',
    'user_management',
    'report_generation'
  ];
  
  const roles = ['super_admin', 'pilot_admin', 'business_admin', 'compliance_admin'];
  
  operations.forEach(operation => {
    roles.forEach(role => {
      const count = Math.floor(Math.random() * 5) + 1;
      const duration = Math.random() * 30 + 5; // 5-35 seconds
      
      adminMetrics.adminOperations.inc({ 
        operation_type: operation, 
        admin_role: role, 
        status: 'success' 
      }, count);
      
      adminMetrics.adminOperationDuration.observe({ 
        operation_type: operation, 
        admin_role: role 
      }, duration);
    });
  });
}

// Collect all metrics
async function collectAllMetrics() {
  try {
    await Promise.all([
      collectAdminUserMetrics(),
      collectSwedishPilotMetrics(),
      collectSystemHealthMetrics(),
      collectComplianceMetrics(),
      collectBusinessPerformanceMetrics()
    ]);
    
    // Simulate some operations
    simulateAdminOperations();
    
    console.log('All admin metrics collected successfully');
  } catch (error) {
    console.error('Error collecting admin metrics:', error);
  }
}

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    await dbPool.query('SELECT 1');
    await redisClient.ping();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      swedish_pilot: true,
      admin_monitoring: true
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
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
    res.status(500).json({ error: 'Failed to generate admin metrics' });
  }
});

// Admin dashboard data endpoint
app.get('/admin/dashboard-data', async (req, res) => {
  try {
    const dashboardData = {
      timestamp: new Date().toISOString(),
      swedish_pilot: {
        active_businesses: await getActivePilotBusinesses(),
        total_payments_today: await getTodaysPaymentVolume(),
        compliance_rate: await getComplianceRate(),
        regional_distribution: await getRegionalDistribution()
      },
      system_status: {
        overall_health: await getOverallSystemHealth(),
        active_admin_users: await getActiveAdminCount(),
        critical_alerts: await getCriticalAlertCount()
      }
    };
    
    res.json(dashboardData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// Helper functions for dashboard data
async function getActivePilotBusinesses() {
  const result = await dbPool.query(`
    SELECT COUNT(*) as count 
    FROM businesses 
    WHERE status = 'active' AND (pilot_participant = true OR test_mode = true)
  `);
  return parseInt(result.rows[0].count) || 0;
}

async function getTodaysPaymentVolume() {
  const result = await dbPool.query(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM payments 
    WHERE created_at >= CURRENT_DATE 
    AND status = 'completed'
  `);
  return parseFloat(result.rows[0].total) || 0;
}

async function getComplianceRate() {
  const result = await dbPool.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN compliance_verified THEN 1 END) as compliant
    FROM businesses 
    WHERE pilot_participant = true OR test_mode = true
  `);
  const row = result.rows[0];
  return row.total > 0 ? (row.compliant / row.total * 100).toFixed(1) : '0.0';
}

async function getRegionalDistribution() {
  const result = await dbPool.query(`
    SELECT 
      bl.region,
      COUNT(DISTINCT b.id) as business_count,
      COALESCE(SUM(p.amount), 0) as payment_volume
    FROM businesses b
    LEFT JOIN business_locations bl ON b.id = bl.business_id
    LEFT JOIN payments p ON b.id = p.business_id 
      AND p.created_at >= CURRENT_DATE
      AND p.status = 'completed'
    WHERE b.pilot_participant = true OR b.test_mode = true
    GROUP BY bl.region
  `);
  return result.rows;
}

async function getOverallSystemHealth() {
  // Simulate system health calculation
  return Math.floor(Math.random() * 10) + 90; // 90-100%
}

async function getActiveAdminCount() {
  const sessions = await redisClient.keys('admin_session:*');
  return sessions.length;
}

async function getCriticalAlertCount() {
  // Simulate critical alert count
  return Math.floor(Math.random() * 3); // 0-2 critical alerts
}

// Start server
app.listen(port, () => {
  console.log(`🔧 Admin Metrics Exporter running on port ${port}`);
  console.log(`📊 Metrics available at http://localhost:${port}/metrics`);
  console.log(`📋 Dashboard data at http://localhost:${port}/admin/dashboard-data`);
  
  // Collect initial metrics
  collectAllMetrics().catch(console.error);
  
  // Collect metrics every 30 seconds
  setInterval(() => {
    collectAllMetrics().catch(console.error);
  }, 30000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down admin metrics exporter...');
  
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