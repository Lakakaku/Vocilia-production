import { POSProvider } from '@ai-feedback-platform/shared-types';
import { POSAdapter } from '../interfaces/POSAdapter';
import { POSAdapterFactory } from '../factory/POSAdapterFactory';
import { createLogger } from '../utils/logger';
import { POSErrorHandler, ErrorCategory } from '../utils/ErrorHandler';
import { RetryManager } from '../utils/RetryManager';
import EventEmitter from 'events';

const logger = createLogger('POSHealthMonitor');

/**
 * POS API Health Monitor
 * 
 * Monitors health of all POS integrations with:
 * - Periodic health checks
 * - Real-time monitoring
 * - Automatic failover
 * - Performance tracking
 * - Alert management
 * - Degradation detection
 */
export class POSHealthMonitor extends EventEmitter {
  private healthStatus = new Map<string, ProviderHealthStatus>();
  private healthCheckers = new Map<string, NodeJS.Timeout>();
  private performanceMetrics = new Map<string, PerformanceMetrics>();
  private failoverConfig = new Map<string, FailoverConfiguration>();
  private alerts: HealthAlert[] = [];
  private readonly factory: POSAdapterFactory;
  private readonly errorHandler: POSErrorHandler;
  private readonly retryManager: RetryManager;
  private monitoringStarted = false;
  
  constructor(
    private config: HealthMonitorConfig = defaultHealthMonitorConfig
  ) {
    super();
    this.factory = new POSAdapterFactory();
    this.errorHandler = new POSErrorHandler();
    this.retryManager = new RetryManager();
  }

  /**
   * Start health monitoring
   */
  async startMonitoring(providers?: ProviderConfig[]): Promise<void> {
    if (this.monitoringStarted) {
      logger.warn('Health monitoring already started');
      return;
    }

    logger.info('Starting POS health monitoring');
    this.monitoringStarted = true;

    // Initialize providers
    const providersToMonitor = providers || this.config.providers;
    for (const providerConfig of providersToMonitor) {
      await this.initializeProvider(providerConfig);
    }

    // Start periodic health checks
    this.startPeriodicHealthChecks();

    // Start performance monitoring
    this.startPerformanceMonitoring();

    this.emit('monitoring:started', {
      providers: Array.from(this.healthStatus.keys()),
      timestamp: new Date()
    });
  }

  /**
   * Stop health monitoring
   */
  async stopMonitoring(): Promise<void> {
    logger.info('Stopping POS health monitoring');
    
    // Clear all health checkers
    this.healthCheckers.forEach(timer => clearInterval(timer));
    this.healthCheckers.clear();
    
    this.monitoringStarted = false;
    
    this.emit('monitoring:stopped', {
      timestamp: new Date()
    });
  }

  /**
   * Initialize provider monitoring
   */
  private async initializeProvider(config: ProviderConfig): Promise<void> {
    const key = this.getProviderKey(config.provider, config.locationId);
    
    // Initialize health status
    this.healthStatus.set(key, {
      provider: config.provider,
      locationId: config.locationId,
      status: 'unknown',
      lastCheck: new Date(),
      consecutiveFailures: 0,
      uptime: 0,
      isHealthy: false,
      capabilities: [],
      metadata: {}
    });

    // Initialize performance metrics
    this.performanceMetrics.set(key, {
      averageResponseTime: 0,
      successRate: 0,
      totalRequests: 0,
      failedRequests: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      responseTimes: []
    });

    // Set failover configuration
    if (config.failover) {
      this.failoverConfig.set(key, config.failover);
    }

    // Perform initial health check
    await this.performHealthCheck(config);
  }

  /**
   * Perform health check for a provider
   */
  private async performHealthCheck(config: ProviderConfig): Promise<HealthCheckResult> {
    const key = this.getProviderKey(config.provider, config.locationId);
    const startTime = Date.now();
    
    logger.debug(`Performing health check for ${key}`);
    
    try {
      // Create adapter for health check
      const adapter = await this.factory.createAdapter({
        provider: config.provider,
        credentials: config.credentials
      });

      // Test connection
      const connectionStatus = await this.retryManager.executeWithRetry(
        () => adapter.testConnection(config.credentials),
        {
          maxAttempts: 2,
          baseDelay: 1000,
          key: `health_check_${key}`
        }
      );

      const responseTime = Date.now() - startTime;
      
      // Update health status
      const status = this.healthStatus.get(key)!;
      status.status = connectionStatus.connected ? 'healthy' : 'unhealthy';
      status.isHealthy = connectionStatus.connected;
      status.lastCheck = new Date();
      status.consecutiveFailures = connectionStatus.connected ? 0 : status.consecutiveFailures + 1;
      status.capabilities = connectionStatus.capabilities || [];
      status.metadata = {
        ...status.metadata,
        lastResponseTime: responseTime,
        locations: connectionStatus.locations?.length || 0
      };

      // Update performance metrics
      this.updatePerformanceMetrics(key, responseTime, connectionStatus.connected);

      // Check for degradation
      const isDegraded = this.checkForDegradation(key);
      if (isDegraded) {
        status.status = 'degraded';
      }

      const result: HealthCheckResult = {
        provider: config.provider,
        locationId: config.locationId,
        healthy: connectionStatus.connected && !isDegraded,
        responseTime,
        timestamp: new Date(),
        details: connectionStatus
      };

      // Emit health check event
      this.emit('health:check', result);

      // Handle state changes
      this.handleStateChange(key, status);

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Handle health check failure
      const errorResult = this.errorHandler.handleError(error, {
        provider: config.provider,
        operation: 'health_check'
      });

      // Update health status
      const status = this.healthStatus.get(key)!;
      status.status = 'unhealthy';
      status.isHealthy = false;
      status.lastCheck = new Date();
      status.consecutiveFailures++;
      status.lastError = {
        category: errorResult.category,
        message: errorResult.userMessage,
        timestamp: new Date()
      };

      // Update performance metrics
      this.updatePerformanceMetrics(key, responseTime, false);

      const result: HealthCheckResult = {
        provider: config.provider,
        locationId: config.locationId,
        healthy: false,
        responseTime,
        timestamp: new Date(),
        error: errorResult
      };

      // Emit health check failure
      this.emit('health:check:failed', result);

      // Handle state changes
      this.handleStateChange(key, status);

      // Check for failover
      await this.checkFailoverTrigger(key, status);

      return result;
    }
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicHealthChecks(): void {
    for (const providerConfig of this.config.providers) {
      const key = this.getProviderKey(providerConfig.provider, providerConfig.locationId);
      const interval = providerConfig.checkInterval || this.config.checkInterval;
      
      const timer = setInterval(async () => {
        await this.performHealthCheck(providerConfig);
      }, interval);
      
      this.healthCheckers.set(key, timer);
    }
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    // Monitor performance trends
    setInterval(() => {
      this.analyzePerformanceTrends();
    }, this.config.performanceAnalysisInterval);
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(key: string, responseTime: number, success: boolean): void {
    const metrics = this.performanceMetrics.get(key);
    if (!metrics) return;

    metrics.totalRequests++;
    if (!success) metrics.failedRequests++;
    
    // Update response times
    metrics.responseTimes.push(responseTime);
    if (metrics.responseTimes.length > 100) {
      metrics.responseTimes = metrics.responseTimes.slice(-100);
    }
    
    // Calculate statistics
    const sortedTimes = [...metrics.responseTimes].sort((a, b) => a - b);
    metrics.averageResponseTime = sortedTimes.reduce((sum, time) => sum + time, 0) / sortedTimes.length;
    metrics.p50ResponseTime = this.getPercentile(sortedTimes, 50);
    metrics.p95ResponseTime = this.getPercentile(sortedTimes, 95);
    metrics.p99ResponseTime = this.getPercentile(sortedTimes, 99);
    metrics.successRate = ((metrics.totalRequests - metrics.failedRequests) / metrics.totalRequests) * 100;
  }

  /**
   * Check for service degradation
   */
  private checkForDegradation(key: string): boolean {
    const metrics = this.performanceMetrics.get(key);
    if (!metrics || metrics.totalRequests < 10) return false;

    // Check success rate
    if (metrics.successRate < this.config.degradationThresholds.successRate) {
      logger.warn(`Degradation detected for ${key}: Low success rate ${metrics.successRate}%`);
      return true;
    }

    // Check response time
    if (metrics.p95ResponseTime > this.config.degradationThresholds.responseTime) {
      logger.warn(`Degradation detected for ${key}: High response time ${metrics.p95ResponseTime}ms`);
      return true;
    }

    return false;
  }

  /**
   * Handle state changes
   */
  private handleStateChange(key: string, status: ProviderHealthStatus): void {
    const previousStatus = this.healthStatus.get(key);
    
    if (!previousStatus || previousStatus.status !== status.status) {
      logger.info(`Health status changed for ${key}: ${previousStatus?.status || 'unknown'} -> ${status.status}`);
      
      // Emit state change event
      this.emit('health:state:changed', {
        provider: status.provider,
        locationId: status.locationId,
        previousState: previousStatus?.status || 'unknown',
        currentState: status.status,
        timestamp: new Date()
      });

      // Create alert if needed
      if (status.status === 'unhealthy' || status.status === 'degraded') {
        this.createAlert({
          severity: status.status === 'unhealthy' ? 'critical' : 'warning',
          provider: status.provider,
          locationId: status.locationId,
          message: `${status.provider} is ${status.status}`,
          details: {
            consecutiveFailures: status.consecutiveFailures,
            lastError: status.lastError
          }
        });
      }
    }
  }

  /**
   * Check failover trigger
   */
  private async checkFailoverTrigger(key: string, status: ProviderHealthStatus): Promise<void> {
    const failoverConfig = this.failoverConfig.get(key);
    if (!failoverConfig) return;

    // Check if failover should be triggered
    if (status.consecutiveFailures >= failoverConfig.triggerAfterFailures) {
      logger.warn(`Triggering failover for ${key} after ${status.consecutiveFailures} failures`);
      
      await this.performFailover(key, failoverConfig);
    }
  }

  /**
   * Perform failover
   */
  private async performFailover(key: string, config: FailoverConfiguration): Promise<void> {
    try {
      // Find healthy alternative
      const alternative = this.findHealthyAlternative(key, config.alternatives);
      
      if (!alternative) {
        logger.error(`No healthy alternative found for ${key}`);
        this.createAlert({
          severity: 'critical',
          provider: this.parseProviderKey(key).provider,
          message: 'Failover failed: No healthy alternatives available',
          details: { originalProvider: key }
        });
        return;
      }

      logger.info(`Failing over from ${key} to ${alternative}`);
      
      // Emit failover event
      this.emit('failover:triggered', {
        from: key,
        to: alternative,
        timestamp: new Date()
      });

      // Execute failover action
      if (config.action) {
        await config.action(key, alternative);
      }

      this.createAlert({
        severity: 'warning',
        provider: this.parseProviderKey(key).provider,
        message: `Failover completed: ${key} -> ${alternative}`,
        details: { from: key, to: alternative }
      });
    } catch (error) {
      logger.error('Failover failed', error);
      this.createAlert({
        severity: 'critical',
        provider: this.parseProviderKey(key).provider,
        message: 'Failover failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }

  /**
   * Find healthy alternative provider
   */
  private findHealthyAlternative(currentKey: string, alternatives: string[]): string | null {
    for (const alternative of alternatives) {
      const status = this.healthStatus.get(alternative);
      if (status?.isHealthy) {
        return alternative;
      }
    }
    return null;
  }

  /**
   * Analyze performance trends
   */
  private analyzePerformanceTrends(): void {
    for (const [key, metrics] of this.performanceMetrics.entries()) {
      const status = this.healthStatus.get(key);
      if (!status) continue;

      // Detect performance anomalies
      const anomalies = this.detectAnomalies(metrics);
      
      if (anomalies.length > 0) {
        logger.warn(`Performance anomalies detected for ${key}`, anomalies);
        
        this.emit('performance:anomaly', {
          provider: status.provider,
          locationId: status.locationId,
          anomalies,
          metrics,
          timestamp: new Date()
        });
      }
    }
  }

  /**
   * Detect performance anomalies
   */
  private detectAnomalies(metrics: PerformanceMetrics): PerformanceAnomaly[] {
    const anomalies: PerformanceAnomaly[] = [];
    
    // Check for response time spike
    if (metrics.p99ResponseTime > metrics.averageResponseTime * 3) {
      anomalies.push({
        type: 'response_time_spike',
        severity: 'warning',
        value: metrics.p99ResponseTime,
        threshold: metrics.averageResponseTime * 3
      });
    }
    
    // Check for low success rate
    if (metrics.successRate < 95 && metrics.totalRequests > 10) {
      anomalies.push({
        type: 'low_success_rate',
        severity: metrics.successRate < 90 ? 'critical' : 'warning',
        value: metrics.successRate,
        threshold: 95
      });
    }
    
    return anomalies;
  }

  /**
   * Create health alert
   */
  private createAlert(alert: Omit<HealthAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const fullAlert: HealthAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      acknowledged: false,
      ...alert
    };
    
    this.alerts.push(fullAlert);
    
    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    // Emit alert event
    this.emit('alert:created', fullAlert);
    
    logger.warn('Health alert created', {
      severity: fullAlert.severity,
      provider: fullAlert.provider,
      message: fullAlert.message
    });
  }

  // Utility methods
  private getProviderKey(provider: POSProvider, locationId?: string): string {
    return locationId ? `${provider}_${locationId}` : provider;
  }

  private parseProviderKey(key: string): { provider: POSProvider; locationId?: string } {
    const parts = key.split('_');
    return {
      provider: parts[0] as POSProvider,
      locationId: parts[1]
    };
  }

  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil(sortedArray.length * (percentile / 100)) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Get current health status
   */
  getHealthStatus(provider?: POSProvider, locationId?: string): ProviderHealthStatus | Map<string, ProviderHealthStatus> {
    if (provider) {
      const key = this.getProviderKey(provider, locationId);
      return this.healthStatus.get(key)!;
    }
    return new Map(this.healthStatus);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(provider?: POSProvider, locationId?: string): PerformanceMetrics | Map<string, PerformanceMetrics> {
    if (provider) {
      const key = this.getProviderKey(provider, locationId);
      return this.performanceMetrics.get(key)!;
    }
    return new Map(this.performanceMetrics);
  }

  /**
   * Get recent alerts
   */
  getAlerts(unacknowledgedOnly: boolean = false): HealthAlert[] {
    if (unacknowledgedOnly) {
      return this.alerts.filter(alert => !alert.acknowledged);
    }
    return [...this.alerts];
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Get health summary
   */
  getHealthSummary(): HealthSummary {
    const providers = Array.from(this.healthStatus.values());
    const healthy = providers.filter(p => p.isHealthy).length;
    const unhealthy = providers.filter(p => !p.isHealthy && p.status === 'unhealthy').length;
    const degraded = providers.filter(p => p.status === 'degraded').length;
    
    return {
      totalProviders: providers.length,
      healthyProviders: healthy,
      unhealthyProviders: unhealthy,
      degradedProviders: degraded,
      overallHealth: healthy === providers.length ? 'healthy' : 
                     unhealthy > 0 ? 'unhealthy' : 
                     'degraded',
      unacknowledgedAlerts: this.alerts.filter(a => !a.acknowledged).length,
      timestamp: new Date()
    };
  }
}

// Type definitions
export interface HealthMonitorConfig {
  providers: ProviderConfig[];
  checkInterval: number;
  performanceAnalysisInterval: number;
  degradationThresholds: {
    successRate: number;
    responseTime: number;
  };
}

export interface ProviderConfig {
  provider: POSProvider;
  locationId?: string;
  credentials: any;
  checkInterval?: number;
  failover?: FailoverConfiguration;
}

export interface FailoverConfiguration {
  triggerAfterFailures: number;
  alternatives: string[];
  action?: (from: string, to: string) => Promise<void>;
}

export interface ProviderHealthStatus {
  provider: POSProvider;
  locationId?: string;
  status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  lastCheck: Date;
  consecutiveFailures: number;
  uptime: number;
  isHealthy: boolean;
  capabilities: string[];
  lastError?: {
    category: ErrorCategory;
    message: string;
    timestamp: Date;
  };
  metadata: Record<string, any>;
}

export interface HealthCheckResult {
  provider: POSProvider;
  locationId?: string;
  healthy: boolean;
  responseTime: number;
  timestamp: Date;
  details?: any;
  error?: any;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  totalRequests: number;
  failedRequests: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  responseTimes: number[];
}

export interface PerformanceAnomaly {
  type: string;
  severity: 'warning' | 'critical';
  value: number;
  threshold: number;
}

export interface HealthAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  provider: POSProvider;
  locationId?: string;
  message: string;
  details?: any;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedAt?: Date;
}

export interface HealthSummary {
  totalProviders: number;
  healthyProviders: number;
  unhealthyProviders: number;
  degradedProviders: number;
  overallHealth: 'healthy' | 'unhealthy' | 'degraded';
  unacknowledgedAlerts: number;
  timestamp: Date;
}

// Default configuration
const defaultHealthMonitorConfig: HealthMonitorConfig = {
  providers: [],
  checkInterval: 60000, // 1 minute
  performanceAnalysisInterval: 300000, // 5 minutes
  degradationThresholds: {
    successRate: 95,
    responseTime: 5000
  }
};

// Export factory function
export function createPOSHealthMonitor(config?: Partial<HealthMonitorConfig>): POSHealthMonitor {
  const mergedConfig = config ? {
    ...defaultHealthMonitorConfig,
    ...config,
    degradationThresholds: {
      ...defaultHealthMonitorConfig.degradationThresholds,
      ...config.degradationThresholds
    }
  } : defaultHealthMonitorConfig;
  
  return new POSHealthMonitor(mergedConfig);
}