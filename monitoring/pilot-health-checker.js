/**
 * Pilot Health Checker - Comprehensive system readiness verification
 * For Swedish Café Pilot Program
 */

const axios = require('axios');
const { promisify } = require('util');
const redis = require('redis');
const { Pool } = require('pg');

class PilotHealthChecker {
  constructor(config = {}) {
    this.config = {
      apiGatewayUrl: process.env.API_GATEWAY_URL || 'http://api-gateway:3001',
      customerPwaUrl: process.env.CUSTOMER_PWA_URL || 'http://customer-pwa:3000',
      businessDashboardUrl: process.env.BUSINESS_DASHBOARD_URL || 'http://business-dashboard:3002',
      adminDashboardUrl: process.env.ADMIN_DASHBOARD_URL || 'http://admin-dashboard:3003',
      redisUrl: process.env.REDIS_URL || 'redis://redis:6379',
      databaseUrl: process.env.DATABASE_URL || 'postgresql://user:pass@db:5432/feedback_platform',
      checkInterval: config.checkInterval || 30000, // 30 seconds
      alertThresholds: {
        voiceLatency: 2000, // 2 seconds
        apiLatency: 500, // 500ms
        errorRate: 0.05, // 5%
        uptime: 0.995, // 99.5%
        queueDepth: 100
      },
      pilotCafes: [
        { name: 'aurora', location: 'stockholm', businessId: 'aurora-stockholm' },
        { name: 'malmohuset', location: 'malmo', businessId: 'malmohuset-malmo' },
        { name: 'goteborg', location: 'goteborg', businessId: 'goteborg-center' }
      ],
      ...config
    };

    this.metrics = {
      lastCheck: null,
      status: 'unknown',
      checks: {},
      alerts: [],
      history: []
    };

    this.setupClients();
  }

  async setupClients() {
    // Redis client
    this.redisClient = redis.createClient({ url: this.config.redisUrl });
    await this.redisClient.connect();

    // Database pool
    this.dbPool = new Pool({ connectionString: this.config.databaseUrl });

    console.log('🇸🇪 Pilot Health Checker initialized for Swedish Café Program');
  }

  async runHealthCheck() {
    const checkStart = Date.now();
    console.log(`🏥 Starting comprehensive pilot health check - ${new Date().toISOString()}`);

    const results = {
      timestamp: new Date().toISOString(),
      duration: 0,
      overallStatus: 'healthy',
      checks: {},
      alerts: [],
      businessReadiness: 'unknown'
    };

    try {
      // Run all health checks in parallel for speed
      const checks = await Promise.allSettled([
        this.checkCoreServices(),
        this.checkPilotCafes(),
        this.checkVoiceSystem(),
        this.checkPaymentSystem(),
        this.checkPOSIntegrations(),
        this.checkAISystem(),
        this.checkFraudDetection(),
        this.checkSwedishCompliance(),
        this.checkPerformanceMetrics(),
        this.checkDatabaseHealth(),
        this.checkRedisHealth()
      ]);

      // Process results
      const checkNames = [
        'coreServices', 'pilotCafes', 'voiceSystem', 'paymentSystem',
        'posIntegrations', 'aiSystem', 'fraudDetection', 'swedishCompliance',
        'performanceMetrics', 'databaseHealth', 'redisHealth'
      ];

      checks.forEach((check, index) => {
        const checkName = checkNames[index];
        if (check.status === 'fulfilled') {
          results.checks[checkName] = check.value;
        } else {
          results.checks[checkName] = {
            status: 'error',
            error: check.reason.message,
            timestamp: new Date().toISOString()
          };
          results.alerts.push({
            severity: 'critical',
            message: `Health check failed: ${checkName}`,
            error: check.reason.message
          });
        }
      });

      // Determine overall status
      results.overallStatus = this.calculateOverallStatus(results.checks);
      results.businessReadiness = this.assessBusinessReadiness(results.checks);
      results.duration = Date.now() - checkStart;

      this.metrics.lastCheck = results;
      this.updateMetrics(results);

      console.log(`✅ Health check completed in ${results.duration}ms - Status: ${results.overallStatus}`);
      return results;

    } catch (error) {
      console.error('❌ Health check failed:', error);
      results.overallStatus = 'critical';
      results.checks.error = { message: error.message, timestamp: new Date().toISOString() };
      return results;
    }
  }

  async checkCoreServices() {
    const services = [
      { name: 'API Gateway', url: `${this.config.apiGatewayUrl}/health` },
      { name: 'Customer PWA', url: `${this.config.customerPwaUrl}/api/health` },
      { name: 'Business Dashboard', url: `${this.config.businessDashboardUrl}/api/health` },
      { name: 'Admin Dashboard', url: `${this.config.adminDashboardUrl}/api/health` }
    ];

    const results = {};
    for (const service of services) {
      const start = Date.now();
      try {
        const response = await axios.get(service.url, { timeout: 5000 });
        results[service.name] = {
          status: response.status === 200 ? 'healthy' : 'unhealthy',
          responseTime: Date.now() - start,
          statusCode: response.status,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        results[service.name] = {
          status: 'error',
          error: error.message,
          responseTime: Date.now() - start,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      status: Object.values(results).every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
      services: results,
      timestamp: new Date().toISOString()
    };
  }

  async checkPilotCafes() {
    const results = {};
    
    for (const cafe of this.config.pilotCafes) {
      try {
        // Check café-specific health endpoint
        const response = await axios.get(
          `${this.config.apiGatewayUrl}/api/pilot/cafe/${cafe.businessId}/health`,
          { timeout: 3000 }
        );

        results[cafe.name] = {
          status: 'healthy',
          location: cafe.location,
          businessId: cafe.businessId,
          qrCodeActive: response.data.qrCodeActive || false,
          posConnected: response.data.posConnected || false,
          lastTransaction: response.data.lastTransaction,
          activeSessions: response.data.activeSessions || 0,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        results[cafe.name] = {
          status: 'error',
          location: cafe.location,
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      status: Object.values(results).every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
      cafes: results,
      totalCafes: this.config.pilotCafes.length,
      healthyCafes: Object.values(results).filter(r => r.status === 'healthy').length,
      timestamp: new Date().toISOString()
    };
  }

  async checkVoiceSystem() {
    try {
      const start = Date.now();
      
      // Test voice processing endpoint
      const response = await axios.post(
        `${this.config.apiGatewayUrl}/api/voice/test`,
        { text: 'Pilot health check test', language: 'sv-SE' },
        { timeout: 5000 }
      );

      const responseTime = Date.now() - start;
      const isWithinSLA = responseTime < this.config.alertThresholds.voiceLatency;

      return {
        status: isWithinSLA ? 'healthy' : 'degraded',
        responseTime,
        slaCompliant: isWithinSLA,
        slaThreshold: this.config.alertThresholds.voiceLatency,
        aiModel: response.data.model || 'unknown',
        language: 'sv-SE',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkPaymentSystem() {
    try {
      // Test Stripe Connect integration
      const stripeResponse = await axios.get(
        `${this.config.apiGatewayUrl}/api/payments/health`,
        { timeout: 3000 }
      );

      // Test Swedish payment methods
      const swedishResponse = await axios.get(
        `${this.config.apiGatewayUrl}/api/payments/swedish/health`,
        { timeout: 3000 }
      );

      return {
        status: 'healthy',
        stripeConnect: stripeResponse.data.status || 'unknown',
        swishIntegration: swedishResponse.data.swish || false,
        bankgiroIntegration: swedishResponse.data.bankgiro || false,
        ibanIntegration: swedishResponse.data.iban || false,
        processingQueue: swedishResponse.data.queueDepth || 0,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkPOSIntegrations() {
    const providers = ['square', 'shopify', 'zettle'];
    const results = {};

    for (const provider of providers) {
      try {
        const response = await axios.get(
          `${this.config.apiGatewayUrl}/api/pos/${provider}/health`,
          { timeout: 3000 }
        );

        results[provider] = {
          status: 'healthy',
          connected: response.data.connected || false,
          lastSync: response.data.lastSync,
          webhooksActive: response.data.webhooksActive || false,
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        results[provider] = {
          status: 'error',
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      status: Object.values(results).some(r => r.status === 'healthy') ? 'healthy' : 'unhealthy',
      providers: results,
      swedishOptimized: results.zettle?.status === 'healthy', // Zettle is most popular in Sweden
      timestamp: new Date().toISOString()
    };
  }

  async checkAISystem() {
    try {
      // Test AI evaluation endpoint
      const response = await axios.post(
        `${this.config.apiGatewayUrl}/api/ai/evaluate`,
        {
          transcript: 'Pilot health check - kaffet var bra idag',
          businessContext: { type: 'café', language: 'sv' }
        },
        { timeout: 5000 }
      );

      const qualityScore = response.data.qualityScore || {};

      return {
        status: 'healthy',
        model: response.data.model || 'unknown',
        qualityScoring: {
          authenticity: qualityScore.authenticity || 0,
          concreteness: qualityScore.concreteness || 0,
          depth: qualityScore.depth || 0,
          total: qualityScore.total || 0
        },
        swedishLanguage: response.data.language === 'sv-SE',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkFraudDetection() {
    try {
      const response = await axios.get(
        `${this.config.apiGatewayUrl}/api/fraud/health`,
        { timeout: 3000 }
      );

      return {
        status: 'healthy',
        activeRules: response.data.activeRules || 0,
        recentFlags: response.data.recentFlags || 0,
        mlModel: response.data.mlModelStatus || 'unknown',
        geographicAnalysis: response.data.geographicAnalysis || false,
        voiceAnalysis: response.data.voiceAnalysis || false,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkSwedishCompliance() {
    try {
      const response = await axios.get(
        `${this.config.apiGatewayUrl}/api/compliance/gdpr/health`,
        { timeout: 3000 }
      );

      return {
        status: 'healthy',
        gdprCompliant: response.data.gdprCompliant || false,
        dataRetentionActive: response.data.dataRetentionActive || false,
        cookieConsent: response.data.cookieConsent || false,
        voiceDataDeletion: response.data.voiceDataDeletion || false,
        swedishRegulatory: response.data.swedishRegulatory || false,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkPerformanceMetrics() {
    try {
      const response = await axios.get(
        `${this.config.apiGatewayUrl}/metrics`,
        { timeout: 3000 }
      );

      // Parse Prometheus metrics (simplified)
      const metrics = this.parsePrometheusMetrics(response.data);

      return {
        status: 'healthy',
        uptime: metrics.uptime || 'unknown',
        requestRate: metrics.requestRate || 0,
        errorRate: metrics.errorRate || 0,
        p95Latency: metrics.p95Latency || 0,
        memoryUsage: metrics.memoryUsage || 0,
        cpuUsage: metrics.cpuUsage || 0,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkDatabaseHealth() {
    try {
      const start = Date.now();
      const result = await this.dbPool.query('SELECT 1 as health_check');
      const responseTime = Date.now() - start;

      const statsResult = await this.dbPool.query('SELECT count(*) FROM pg_stat_activity');
      const connectionCount = parseInt(statsResult.rows[0].count);

      return {
        status: 'healthy',
        responseTime,
        connectionCount,
        maxConnections: 100,
        connectionUtilization: connectionCount / 100,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async checkRedisHealth() {
    try {
      const start = Date.now();
      await this.redisClient.ping();
      const responseTime = Date.now() - start;

      const info = await this.redisClient.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const usedMemory = memoryMatch ? parseInt(memoryMatch[1]) : 0;

      return {
        status: 'healthy',
        responseTime,
        usedMemory,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  calculateOverallStatus(checks) {
    const statusPriority = { healthy: 3, degraded: 2, unhealthy: 1, error: 0 };
    
    let lowestStatus = 'healthy';
    let lowestPriority = 3;

    Object.values(checks).forEach(check => {
      const priority = statusPriority[check.status] || 0;
      if (priority < lowestPriority) {
        lowestPriority = priority;
        lowestStatus = check.status;
      }
    });

    return lowestStatus;
  }

  assessBusinessReadiness(checks) {
    const criticalSystems = [
      'coreServices', 'pilotCafes', 'voiceSystem', 
      'paymentSystem', 'posIntegrations', 'swedishCompliance'
    ];

    const readyCriticalSystems = criticalSystems.filter(system => 
      checks[system]?.status === 'healthy'
    );

    const readinessPercentage = readyCriticalSystems.length / criticalSystems.length;

    if (readinessPercentage >= 1.0) return 'fully-ready';
    if (readinessPercentage >= 0.8) return 'mostly-ready';
    if (readinessPercentage >= 0.6) return 'partially-ready';
    return 'not-ready';
  }

  parsePrometheusMetrics(metricsText) {
    // Simplified Prometheus metrics parsing
    const lines = metricsText.split('\n');
    const metrics = {};

    lines.forEach(line => {
      if (line.includes('process_uptime_seconds')) {
        const match = line.match(/process_uptime_seconds (\d+\.?\d*)/);
        if (match) metrics.uptime = parseFloat(match[1]);
      }
      // Add more metric parsing as needed
    });

    return metrics;
  }

  updateMetrics(results) {
    // Update internal metrics and emit to monitoring systems
    this.metrics.history.unshift(results);
    if (this.metrics.history.length > 100) {
      this.metrics.history = this.metrics.history.slice(0, 100);
    }

    // Emit metrics to Prometheus/Grafana if configured
    this.emitMetrics(results);
  }

  emitMetrics(results) {
    // Emit metrics to external monitoring systems
    console.log(`📊 Health Check Metrics Emitted - ${results.timestamp}`);
    console.log(`   Overall Status: ${results.overallStatus}`);
    console.log(`   Business Readiness: ${results.businessReadiness}`);
    console.log(`   Duration: ${results.duration}ms`);
    console.log(`   Alerts: ${results.alerts.length}`);
  }

  async startMonitoring() {
    console.log('🚀 Starting pilot health monitoring...');
    
    // Initial health check
    await this.runHealthCheck();

    // Schedule regular checks
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        console.error('❌ Health check interval error:', error);
      }
    }, this.config.checkInterval);

    console.log(`✅ Health monitoring started - checking every ${this.config.checkInterval}ms`);
  }

  async stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    await this.redisClient.disconnect();
    await this.dbPool.end();
    
    console.log('🛑 Health monitoring stopped');
  }

  getLatestMetrics() {
    return this.metrics.lastCheck;
  }

  getHealthHistory() {
    return this.metrics.history;
  }
}

// Export for use in monitoring systems
module.exports = { PilotHealthChecker };

// CLI usage
if (require.main === module) {
  const checker = new PilotHealthChecker();
  
  process.on('SIGINT', async () => {
    console.log('\\n🛑 Shutting down health checker...');
    await checker.stopMonitoring();
    process.exit(0);
  });

  checker.startMonitoring().catch(console.error);
}