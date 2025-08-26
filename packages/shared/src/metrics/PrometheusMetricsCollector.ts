/**
 * Comprehensive Prometheus Metrics Collection System
 * Designed for AI Feedback Platform Performance Monitoring
 */

import prometheus from 'prom-client';
import { EventEmitter } from 'events';

// Register default metrics
prometheus.register.clear();
prometheus.collectDefaultMetrics({ 
  timeout: 5000,
  prefix: 'ai_feedback_',
  labels: { environment: process.env.NODE_ENV || 'development' }
});

/**
 * Core Business Metrics
 */
export class BusinessMetricsCollector {
  private static instance: BusinessMetricsCollector;
  
  // Voice Processing Metrics
  public voiceSessionDuration = new prometheus.Histogram({
    name: 'ai_feedback_voice_session_duration_seconds',
    help: 'Duration of voice feedback sessions',
    labelNames: ['business_id', 'location_id', 'outcome'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120]
  });

  public voiceProcessingLatency = new prometheus.Histogram({
    name: 'ai_feedback_voice_processing_latency_seconds',
    help: 'Time from voice input to AI response',
    labelNames: ['step', 'ai_provider', 'language'],
    buckets: [0.1, 0.2, 0.5, 1, 2, 5, 10]
  });

  public voiceQualityScore = new prometheus.Histogram({
    name: 'ai_feedback_voice_quality_score',
    help: 'Voice recording quality scores',
    labelNames: ['business_id', 'device_type'],
    buckets: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
  });

  // AI Evaluation Metrics
  public aiFeedbackScore = new prometheus.Histogram({
    name: 'ai_feedback_quality_score',
    help: 'AI-evaluated feedback quality scores',
    labelNames: ['business_id', 'ai_model', 'language'],
    buckets: [0, 20, 40, 60, 75, 85, 90, 95, 100]
  });

  public aiProcessingTime = new prometheus.Histogram({
    name: 'ai_feedback_processing_duration_seconds',
    help: 'AI processing time for feedback evaluation',
    labelNames: ['model', 'provider', 'cache_hit'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
  });

  public aiModelAccuracy = new prometheus.Gauge({
    name: 'ai_feedback_model_accuracy',
    help: 'AI model accuracy based on manual reviews',
    labelNames: ['model', 'score_type']
  });

  // Payment & Reward Metrics
  public rewardAmount = new prometheus.Histogram({
    name: 'ai_feedback_reward_amount_sek',
    help: 'Reward amounts distributed (SEK)',
    labelNames: ['business_id', 'tier', 'payment_method'],
    buckets: [5, 10, 25, 50, 100, 250, 500, 1000]
  });

  public paymentProcessingTime = new prometheus.Histogram({
    name: 'ai_feedback_payment_processing_duration_seconds',
    help: 'Payment processing duration',
    labelNames: ['provider', 'method', 'success'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60]
  });

  public stripeApiLatency = new prometheus.Histogram({
    name: 'ai_feedback_stripe_api_latency_seconds',
    help: 'Stripe API call latency',
    labelNames: ['operation', 'outcome'],
    buckets: [0.1, 0.2, 0.5, 1, 2, 5]
  });

  // Business Metrics
  public dailyActiveBusinesses = new prometheus.Gauge({
    name: 'ai_feedback_active_businesses_daily',
    help: 'Number of businesses with activity in last 24h',
    labelNames: ['tier', 'region']
  });

  public feedbackVolume = new prometheus.Counter({
    name: 'ai_feedback_sessions_total',
    help: 'Total feedback sessions processed',
    labelNames: ['business_id', 'status', 'source']
  });

  public businessRevenue = new prometheus.Histogram({
    name: 'ai_feedback_business_revenue_sek',
    help: 'Business revenue generated through platform',
    labelNames: ['business_id', 'period'],
    buckets: [100, 500, 1000, 5000, 10000, 25000, 50000]
  });

  // Fraud Detection Metrics
  public fraudDetectionScore = new prometheus.Histogram({
    name: 'ai_feedback_fraud_risk_score',
    help: 'Fraud detection risk scores',
    labelNames: ['business_id', 'detector_type'],
    buckets: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
  });

  public fraudDetectionTime = new prometheus.Histogram({
    name: 'ai_feedback_fraud_detection_duration_seconds',
    help: 'Fraud detection processing time',
    labelNames: ['check_type', 'complexity'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  public fraudActionsTotal = new prometheus.Counter({
    name: 'ai_feedback_fraud_actions_total',
    help: 'Fraud prevention actions taken',
    labelNames: ['action', 'reason', 'severity']
  });

  private constructor() {}

  public static getInstance(): BusinessMetricsCollector {
    if (!BusinessMetricsCollector.instance) {
      BusinessMetricsCollector.instance = new BusinessMetricsCollector();
    }
    return BusinessMetricsCollector.instance;
  }

  /**
   * Record voice session completion
   */
  public recordVoiceSession(metrics: {
    businessId: string;
    locationId: string;
    duration: number;
    outcome: 'completed' | 'abandoned' | 'failed';
    processingSteps: {
      stt: number;
      ai_evaluation: number;
      tts: number;
    };
    qualityScore?: number;
    rewardAmount?: number;
    aiProvider: string;
  }) {
    const { businessId, locationId, duration, outcome } = metrics;
    
    this.voiceSessionDuration
      .labels({ business_id: businessId, location_id: locationId, outcome })
      .observe(duration);

    // Record processing latency for each step
    Object.entries(metrics.processingSteps).forEach(([step, latency]) => {
      this.voiceProcessingLatency
        .labels({ step, ai_provider: metrics.aiProvider, language: 'sv' })
        .observe(latency);
    });

    if (metrics.qualityScore) {
      this.aiFeedbackScore
        .labels({ business_id: businessId, ai_model: metrics.aiProvider, language: 'sv' })
        .observe(metrics.qualityScore);
    }

    if (metrics.rewardAmount) {
      const tier = this.determineRewardTier(metrics.rewardAmount);
      this.rewardAmount
        .labels({ business_id: businessId, tier, payment_method: 'stripe' })
        .observe(metrics.rewardAmount);
    }

    this.feedbackVolume
      .labels({ business_id: businessId, status: outcome, source: 'voice' })
      .inc();
  }

  /**
   * Record AI processing metrics
   */
  public recordAIProcessing(metrics: {
    model: string;
    provider: string;
    processingTime: number;
    cacheHit: boolean;
    accuracy?: number;
    scoreType?: string;
  }) {
    this.aiProcessingTime
      .labels({ 
        model: metrics.model, 
        provider: metrics.provider, 
        cache_hit: metrics.cacheHit ? 'true' : 'false' 
      })
      .observe(metrics.processingTime);

    if (metrics.accuracy && metrics.scoreType) {
      this.aiModelAccuracy
        .labels({ model: metrics.model, score_type: metrics.scoreType })
        .set(metrics.accuracy);
    }
  }

  /**
   * Record payment processing metrics
   */
  public recordPaymentProcessing(metrics: {
    provider: string;
    method: string;
    processingTime: number;
    success: boolean;
    amount?: number;
    operation?: string;
  }) {
    this.paymentProcessingTime
      .labels({ 
        provider: metrics.provider, 
        method: metrics.method, 
        success: metrics.success ? 'true' : 'false' 
      })
      .observe(metrics.processingTime);

    if (metrics.operation) {
      this.stripeApiLatency
        .labels({ 
          operation: metrics.operation, 
          outcome: metrics.success ? 'success' : 'error' 
        })
        .observe(metrics.processingTime);
    }
  }

  /**
   * Record fraud detection metrics
   */
  public recordFraudDetection(metrics: {
    businessId: string;
    detectorType: string;
    riskScore: number;
    processingTime: number;
    action?: string;
    reason?: string;
    severity?: string;
  }) {
    this.fraudDetectionScore
      .labels({ business_id: metrics.businessId, detector_type: metrics.detectorType })
      .observe(metrics.riskScore);

    this.fraudDetectionTime
      .labels({ check_type: metrics.detectorType, complexity: 'standard' })
      .observe(metrics.processingTime);

    if (metrics.action) {
      this.fraudActionsTotal
        .labels({ 
          action: metrics.action, 
          reason: metrics.reason || 'unknown', 
          severity: metrics.severity || 'medium' 
        })
        .inc();
    }
  }

  /**
   * Update business activity metrics
   */
  public updateBusinessMetrics(metrics: {
    activeBusinesses: { tier: string; region: string; count: number }[];
    revenueData: { businessId: string; revenue: number; period: string }[];
  }) {
    // Update active businesses
    metrics.activeBusinesses.forEach(({ tier, region, count }) => {
      this.dailyActiveBusinesses
        .labels({ tier, region })
        .set(count);
    });

    // Update revenue metrics
    metrics.revenueData.forEach(({ businessId, revenue, period }) => {
      this.businessRevenue
        .labels({ business_id: businessId, period })
        .observe(revenue);
    });
  }

  private determineRewardTier(amount: number): string {
    if (amount >= 100) return 'exceptional';
    if (amount >= 50) return 'very_good';
    if (amount >= 10) return 'acceptable';
    return 'insufficient';
  }
}

/**
 * System Performance Metrics
 */
export class SystemMetricsCollector {
  private static instance: SystemMetricsCollector;
  
  // API Performance Metrics
  public httpRequestDuration = new prometheus.Histogram({
    name: 'ai_feedback_http_request_duration_seconds',
    help: 'HTTP request durations',
    labelNames: ['method', 'route', 'status_code', 'app'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  });

  public httpRequestsTotal = new prometheus.Counter({
    name: 'ai_feedback_http_requests_total',
    help: 'Total HTTP requests processed',
    labelNames: ['method', 'route', 'status_code', 'app']
  });

  public websocketConnections = new prometheus.Gauge({
    name: 'ai_feedback_websocket_connections_current',
    help: 'Current WebSocket connections',
    labelNames: ['app', 'type']
  });

  public websocketMessages = new prometheus.Counter({
    name: 'ai_feedback_websocket_messages_total',
    help: 'WebSocket messages processed',
    labelNames: ['app', 'type', 'direction']
  });

  // Database Performance
  public dbQueryDuration = new prometheus.Histogram({
    name: 'ai_feedback_db_query_duration_seconds',
    help: 'Database query execution time',
    labelNames: ['operation', 'table', 'success'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
  });

  public dbConnectionsActive = new prometheus.Gauge({
    name: 'ai_feedback_db_connections_active',
    help: 'Active database connections',
    labelNames: ['pool', 'state']
  });

  // Cache Performance
  public cacheHitRatio = new prometheus.Gauge({
    name: 'ai_feedback_cache_hit_ratio',
    help: 'Cache hit ratio',
    labelNames: ['cache_type', 'key_pattern']
  });

  public cacheOperationDuration = new prometheus.Histogram({
    name: 'ai_feedback_cache_operation_duration_seconds',
    help: 'Cache operation duration',
    labelNames: ['operation', 'cache_type', 'result'],
    buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1]
  });

  // Load Testing Metrics
  public loadTestResults = new prometheus.Gauge({
    name: 'ai_feedback_load_test_result',
    help: 'Load test results',
    labelNames: ['test_type', 'metric', 'scenario']
  });

  public concurrentUsers = new prometheus.Gauge({
    name: 'ai_feedback_concurrent_users_peak',
    help: 'Peak concurrent users during tests',
    labelNames: ['test_scenario', 'region']
  });

  private constructor() {}

  public static getInstance(): SystemMetricsCollector {
    if (!SystemMetricsCollector.instance) {
      SystemMetricsCollector.instance = new SystemMetricsCollector();
    }
    return SystemMetricsCollector.instance;
  }

  /**
   * Record HTTP request metrics
   */
  public recordHttpRequest(metrics: {
    method: string;
    route: string;
    statusCode: number;
    duration: number;
    app: string;
  }) {
    const { method, route, statusCode, duration, app } = metrics;
    
    this.httpRequestDuration
      .labels({ method, route, status_code: statusCode.toString(), app })
      .observe(duration);

    this.httpRequestsTotal
      .labels({ method, route, status_code: statusCode.toString(), app })
      .inc();
  }

  /**
   * Record database query metrics
   */
  public recordDbQuery(metrics: {
    operation: string;
    table: string;
    duration: number;
    success: boolean;
  }) {
    this.dbQueryDuration
      .labels({ 
        operation: metrics.operation, 
        table: metrics.table, 
        success: metrics.success ? 'true' : 'false' 
      })
      .observe(metrics.duration);
  }

  /**
   * Update WebSocket connection metrics
   */
  public updateWebSocketMetrics(metrics: {
    app: string;
    type: string;
    connections: number;
    messageCount?: number;
    direction?: 'inbound' | 'outbound';
  }) {
    this.websocketConnections
      .labels({ app: metrics.app, type: metrics.type })
      .set(metrics.connections);

    if (metrics.messageCount && metrics.direction) {
      this.websocketMessages
        .labels({ app: metrics.app, type: metrics.type, direction: metrics.direction })
        .inc(metrics.messageCount);
    }
  }

  /**
   * Record cache performance metrics
   */
  public recordCacheMetrics(metrics: {
    cacheType: string;
    keyPattern: string;
    hitRatio: number;
    operation?: string;
    duration?: number;
    result?: 'hit' | 'miss' | 'error';
  }) {
    this.cacheHitRatio
      .labels({ cache_type: metrics.cacheType, key_pattern: metrics.keyPattern })
      .set(metrics.hitRatio);

    if (metrics.operation && metrics.duration && metrics.result) {
      this.cacheOperationDuration
        .labels({ 
          operation: metrics.operation, 
          cache_type: metrics.cacheType, 
          result: metrics.result 
        })
        .observe(metrics.duration);
    }
  }

  /**
   * Record load test results
   */
  public recordLoadTestResults(results: {
    testType: string;
    scenario: string;
    metrics: { [key: string]: number };
    peakUsers?: { region: string; count: number }[];
  }) {
    // Record test metrics
    Object.entries(results.metrics).forEach(([metric, value]) => {
      this.loadTestResults
        .labels({ 
          test_type: results.testType, 
          metric, 
          scenario: results.scenario 
        })
        .set(value);
    });

    // Record peak concurrent users
    if (results.peakUsers) {
      results.peakUsers.forEach(({ region, count }) => {
        this.concurrentUsers
          .labels({ test_scenario: results.scenario, region })
          .set(count);
      });
    }
  }
}

/**
 * SLA Tracking Metrics
 */
export class SLAMetricsCollector {
  private static instance: SLAMetricsCollector;

  // SLA Target Metrics
  public slaCompliance = new prometheus.Gauge({
    name: 'ai_feedback_sla_compliance_percentage',
    help: 'SLA compliance percentage',
    labelNames: ['sla_type', 'period', 'severity']
  });

  public slaViolations = new prometheus.Counter({
    name: 'ai_feedback_sla_violations_total',
    help: 'Total SLA violations',
    labelNames: ['sla_type', 'severity', 'component']
  });

  public availabilityUptime = new prometheus.Gauge({
    name: 'ai_feedback_availability_uptime_percentage',
    help: 'Service availability uptime percentage',
    labelNames: ['service', 'period']
  });

  public errorRateSLA = new prometheus.Gauge({
    name: 'ai_feedback_error_rate_sla',
    help: 'Error rate SLA tracking',
    labelNames: ['service', 'period', 'error_type']
  });

  private constructor() {}

  public static getInstance(): SLAMetricsCollector {
    if (!SLAMetricsCollector.instance) {
      SLAMetricsCollector.instance = new SLAMetricsCollector();
    }
    return SLAMetricsCollector.instance;
  }

  /**
   * Update SLA compliance metrics
   */
  public updateSLACompliance(metrics: {
    slaType: string;
    period: string;
    compliancePercentage: number;
    violations?: number;
    severity?: string;
    component?: string;
  }) {
    this.slaCompliance
      .labels({ 
        sla_type: metrics.slaType, 
        period: metrics.period, 
        severity: metrics.severity || 'normal' 
      })
      .set(metrics.compliancePercentage);

    if (metrics.violations && metrics.violations > 0) {
      this.slaViolations
        .labels({ 
          sla_type: metrics.slaType, 
          severity: metrics.severity || 'medium',
          component: metrics.component || 'system'
        })
        .inc(metrics.violations);
    }
  }
}

/**
 * Unified Metrics Registry
 */
export class MetricsRegistry {
  private businessMetrics: BusinessMetricsCollector;
  private systemMetrics: SystemMetricsCollector;
  private slaMetrics: SLAMetricsCollector;
  private metricsEventEmitter: EventEmitter;

  constructor() {
    this.businessMetrics = BusinessMetricsCollector.getInstance();
    this.systemMetrics = SystemMetricsCollector.getInstance();
    this.slaMetrics = SLAMetricsCollector.getInstance();
    this.metricsEventEmitter = new EventEmitter();
  }

  /**
   * Get Prometheus registry for metrics endpoint
   */
  public getRegistry(): prometheus.Registry {
    return prometheus.register;
  }

  /**
   * Get all metrics collectors
   */
  public getCollectors() {
    return {
      business: this.businessMetrics,
      system: this.systemMetrics,
      sla: this.slaMetrics
    };
  }

  /**
   * Export metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    return prometheus.register.metrics();
  }

  /**
   * Clear all metrics (for testing)
   */
  public clearMetrics(): void {
    prometheus.register.clear();
  }

  /**
   * Subscribe to metrics events
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.metricsEventEmitter.on(event, listener);
  }

  /**
   * Emit metrics event
   */
  public emit(event: string, ...args: any[]): void {
    this.metricsEventEmitter.emit(event, ...args);
  }
}

// Export singleton instance
export const metricsRegistry = new MetricsRegistry();

/**
 * Express middleware for automatic HTTP metrics collection
 */
export function createMetricsMiddleware(appName: string) {
  const systemMetrics = SystemMetricsCollector.getInstance();

  return (req: any, res: any, next: any) => {
    const startTime = process.hrtime();
    const originalEnd = res.end;

    res.end = function(chunk: any, encoding: any) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds + nanoseconds / 1e9;

      systemMetrics.recordHttpRequest({
        method: req.method,
        route: req.route?.path || req.path,
        statusCode: res.statusCode,
        duration,
        app: appName
      });

      originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}