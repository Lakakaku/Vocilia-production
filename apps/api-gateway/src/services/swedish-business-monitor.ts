import { POSProvider } from '@ai-feedback-platform/shared-types';
import { logger } from '../utils/logger';
import { POSMetricsCollector } from './pos-metrics-collector';
import { createClient } from 'redis';

/**
 * Swedish Business Hours Aware POS Monitoring System
 * 
 * Provides intelligent monitoring based on Swedish business patterns:
 * - Standard business hours: 9-18 weekdays, 10-16 weekends
 * - Adjusted alert severity during off-hours
 * - Swedish holiday awareness
 * - Stockholm timezone operations
 */
export class SwedishBusinessMonitor {
  private redisClient: any;
  private metricsCollector: POSMetricsCollector;
  private swedishTimeZone = 'Europe/Stockholm';

  // Swedish holidays 2024-2025 (recurring dates handled separately)
  private static SWEDISH_HOLIDAYS = [
    '2024-01-01', // New Year's Day
    '2024-01-06', // Epiphany
    '2024-03-29', // Good Friday
    '2024-04-01', // Easter Monday
    '2024-05-01', // Labour Day
    '2024-05-09', // Ascension Day
    '2024-05-19', // Whit Sunday
    '2024-06-06', // National Day
    '2024-06-21', // Midsummer Eve
    '2024-06-22', // Midsummer Day
    '2024-11-02', // All Saints' Day
    '2024-12-24', // Christmas Eve
    '2024-12-25', // Christmas Day
    '2024-12-26', // Boxing Day
    '2024-12-31', // New Year's Eve
    '2025-01-01', // New Year's Day
    '2025-01-06', // Epiphany
    '2025-04-18', // Good Friday
    '2025-04-21', // Easter Monday
    '2025-05-01', // Labour Day
    '2025-05-29', // Ascension Day
    '2025-06-06', // National Day
    '2025-06-20', // Midsummer Eve
    '2025-06-21', // Midsummer Day
    '2025-11-01', // All Saints' Day
    '2025-12-24', // Christmas Eve
    '2025-12-25', // Christmas Day
    '2025-12-26', // Boxing Day
    '2025-12-31'  // New Year's Eve
  ];

  constructor() {
    this.metricsCollector = new POSMetricsCollector();
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      this.redisClient = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.redisClient.on('error', (err: Error) => {
        logger.error('Swedish Business Monitor Redis Error:', err);
      });

      await this.redisClient.connect();
      logger.info('Swedish Business Monitor connected to Redis');
    } catch (error) {
      logger.error('Failed to connect to Redis for Swedish Business Monitor:', error);
    }
  }

  /**
   * Get current Swedish time with timezone awareness
   */
  private getSwedishTime(): Date {
    return new Date(new Date().toLocaleString("en-US", {timeZone: this.swedishTimeZone}));
  }

  /**
   * Check if current time is during Swedish business hours
   */
  isBusinessHours(): { 
    isBusinessTime: boolean;
    timeContext: 'business_hours' | 'extended_hours' | 'off_hours';
    businessType: 'weekday' | 'weekend' | 'holiday';
  } {
    const swedishTime = this.getSwedishTime();
    const hour = swedishTime.getHours();
    const dayOfWeek = swedishTime.getDay(); // 0 = Sunday, 6 = Saturday
    const dateString = swedishTime.toISOString().split('T')[0];

    // Check if it's a Swedish holiday
    const isHoliday = SwedishBusinessMonitor.SWEDISH_HOLIDAYS.includes(dateString);
    
    if (isHoliday) {
      return {
        isBusinessTime: false,
        timeContext: 'off_hours',
        businessType: 'holiday'
      };
    }

    // Weekend hours (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      if (hour >= 10 && hour < 16) {
        return {
          isBusinessTime: true,
          timeContext: 'business_hours',
          businessType: 'weekend'
        };
      } else if (hour >= 8 && hour < 18) {
        return {
          isBusinessTime: false,
          timeContext: 'extended_hours',
          businessType: 'weekend'
        };
      } else {
        return {
          isBusinessTime: false,
          timeContext: 'off_hours',
          businessType: 'weekend'
        };
      }
    }

    // Weekday hours (Monday = 1 to Friday = 5)
    if (hour >= 9 && hour < 18) {
      return {
        isBusinessTime: true,
        timeContext: 'business_hours',
        businessType: 'weekday'
      };
    } else if (hour >= 7 && hour < 20) {
      return {
        isBusinessTime: false,
        timeContext: 'extended_hours',
        businessType: 'weekday'
      };
    } else {
      return {
        isBusinessTime: false,
        timeContext: 'off_hours',
        businessType: 'weekday'
      };
    }
  }

  /**
   * Get alert severity level based on Swedish business context
   */
  getAlertSeverity(baseLevel: 'low' | 'medium' | 'high' | 'critical'): {
    adjustedLevel: 'low' | 'medium' | 'high' | 'critical';
    shouldAlert: boolean;
    context: string;
  } {
    const businessContext = this.isBusinessHours();
    
    // Critical issues always alert regardless of time
    if (baseLevel === 'critical') {
      return {
        adjustedLevel: 'critical',
        shouldAlert: true,
        context: `Critical alert during ${businessContext.timeContext} (${businessContext.businessType})`
      };
    }

    // During business hours, maintain normal alerting
    if (businessContext.isBusinessTime) {
      return {
        adjustedLevel: baseLevel,
        shouldAlert: true,
        context: `Business hours alert (${businessContext.businessType})`
      };
    }

    // During extended hours, reduce non-critical alerts
    if (businessContext.timeContext === 'extended_hours') {
      const adjustedLevel = baseLevel === 'high' ? 'medium' : 
                           baseLevel === 'medium' ? 'low' : baseLevel;
      return {
        adjustedLevel,
        shouldAlert: adjustedLevel !== 'low',
        context: `Extended hours - reduced severity (${businessContext.businessType})`
      };
    }

    // During off-hours, only alert on high severity and above
    return {
      adjustedLevel: baseLevel === 'high' ? 'medium' : 'low',
      shouldAlert: baseLevel === 'high',
      context: `Off-hours - minimal alerting (${businessContext.businessType})`
    };
  }

  /**
   * Monitor POS provider health with Swedish business awareness
   */
  async monitorProviderHealth(provider: POSProvider): Promise<{
    health: 'healthy' | 'degraded' | 'unhealthy';
    metrics: any;
    alerts: any[];
    businessContext: any;
  }> {
    const startTime = Date.now();
    const businessContext = this.isBusinessHours();
    
    try {
      // Get cached health metrics
      const healthKey = `pos_health:${provider}:${Math.floor(Date.now() / 60000)}`; // 1-minute buckets
      const cachedHealth = await this.redisClient?.get(healthKey);
      
      if (cachedHealth && businessContext.timeContext === 'off_hours') {
        // Use cached data during off-hours to reduce API calls
        return {
          ...JSON.parse(cachedHealth),
          businessContext,
          cached: true
        };
      }

      // Collect current metrics
      const metrics = await this.collectProviderMetrics(provider);
      const alerts = await this.evaluateProviderAlerts(provider, metrics, businessContext);
      
      // Determine overall health
      const health = this.calculateHealthStatus(metrics, alerts);
      
      // Cache results (longer during off-hours)
      const cacheResult = {
        health,
        metrics,
        alerts,
        businessContext,
        timestamp: new Date().toISOString(),
        cached: false
      };
      
      const cacheTTL = businessContext.isBusinessTime ? 60 : 300; // 1min vs 5min
      await this.redisClient?.setEx(healthKey, cacheTTL, JSON.stringify(cacheResult));
      
      // Record monitoring metrics
      this.metricsCollector.recordHealthCheck(
        provider, 
        health === 'healthy', 
        Date.now() - startTime
      );

      return cacheResult;
    } catch (error) {
      logger.error(`Error monitoring ${provider} health:`, error);
      return {
        health: 'unhealthy' as const,
        metrics: {},
        alerts: [{
          level: 'high',
          message: `Failed to monitor ${provider} health: ${error.message}`,
          timestamp: new Date().toISOString()
        }],
        businessContext
      };
    }
  }

  /**
   * Collect comprehensive metrics for a POS provider
   */
  private async collectProviderMetrics(provider: POSProvider): Promise<any> {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    try {
      // API response times and success rates
      const apiMetrics = await this.metricsCollector.getCachedData(`api_metrics:${provider}`);
      
      // Webhook delivery metrics
      const webhookMetrics = await this.metricsCollector.getCachedData(`webhook_metrics:${provider}`);
      
      // Connection status for businesses
      const connectionMetrics = await this.metricsCollector.getCachedData(`connection_metrics:${provider}`);
      
      // Error rates
      const errorRates = await this.metricsCollector.getCachedData(`error_rates:${provider}`);
      
      return {
        api: apiMetrics ? JSON.parse(apiMetrics) : {},
        webhooks: webhookMetrics ? JSON.parse(webhookMetrics) : {},
        connections: connectionMetrics ? JSON.parse(connectionMetrics) : {},
        errors: errorRates ? JSON.parse(errorRates) : {},
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Error collecting metrics for ${provider}:`, error);
      return {};
    }
  }

  /**
   * Evaluate alerts based on metrics and business context
   */
  private async evaluateProviderAlerts(
    provider: POSProvider, 
    metrics: any, 
    businessContext: any
  ): Promise<any[]> {
    const alerts = [];

    // API response time alerts
    if (metrics.api?.avgResponseTime > 5000) {
      const severity = this.getAlertSeverity('high');
      alerts.push({
        type: 'api_slow_response',
        level: severity.adjustedLevel,
        shouldAlert: severity.shouldAlert,
        message: `${provider} API response time is ${metrics.api.avgResponseTime}ms (threshold: 5000ms)`,
        context: severity.context,
        timestamp: new Date().toISOString()
      });
    }

    // Error rate alerts
    if (metrics.errors?.rate > 5) {
      const severity = this.getAlertSeverity('medium');
      alerts.push({
        type: 'high_error_rate',
        level: severity.adjustedLevel,
        shouldAlert: severity.shouldAlert,
        message: `${provider} error rate is ${metrics.errors.rate}% (threshold: 5%)`,
        context: severity.context,
        timestamp: new Date().toISOString()
      });
    }

    // Webhook delivery failures
    if (metrics.webhooks?.failureRate > 10) {
      const severity = this.getAlertSeverity('medium');
      alerts.push({
        type: 'webhook_failures',
        level: severity.adjustedLevel,
        shouldAlert: severity.shouldAlert,
        message: `${provider} webhook failure rate is ${metrics.webhooks.failureRate}% (threshold: 10%)`,
        context: severity.context,
        timestamp: new Date().toISOString()
      });
    }

    // Connection health alerts
    if (metrics.connections?.unhealthyCount > 0) {
      const severity = this.getAlertSeverity('high');
      alerts.push({
        type: 'unhealthy_connections',
        level: severity.adjustedLevel,
        shouldAlert: severity.shouldAlert,
        message: `${provider} has ${metrics.connections.unhealthyCount} unhealthy business connections`,
        context: severity.context,
        timestamp: new Date().toISOString()
      });
    }

    return alerts;
  }

  /**
   * Calculate overall health status from metrics and alerts
   */
  private calculateHealthStatus(metrics: any, alerts: any[]): 'healthy' | 'degraded' | 'unhealthy' {
    const criticalAlerts = alerts.filter(a => a.level === 'critical').length;
    const highAlerts = alerts.filter(a => a.level === 'high').length;
    const mediumAlerts = alerts.filter(a => a.level === 'medium').length;

    if (criticalAlerts > 0 || highAlerts > 2) {
      return 'unhealthy';
    }

    if (highAlerts > 0 || mediumAlerts > 3) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Get Swedish business-aware monitoring schedule
   */
  getMonitoringSchedule(): {
    healthCheckInterval: number;
    webhookMonitorInterval: number;
    alertingEnabled: boolean;
    reducedFrequency: boolean;
  } {
    const businessContext = this.isBusinessHours();

    if (businessContext.isBusinessTime) {
      return {
        healthCheckInterval: 30, // 30 seconds during business hours
        webhookMonitorInterval: 15, // 15 seconds for webhook monitoring
        alertingEnabled: true,
        reducedFrequency: false
      };
    }

    if (businessContext.timeContext === 'extended_hours') {
      return {
        healthCheckInterval: 60, // 1 minute during extended hours
        webhookMonitorInterval: 30, // 30 seconds for webhook monitoring
        alertingEnabled: true,
        reducedFrequency: true
      };
    }

    // Off-hours scheduling
    return {
      healthCheckInterval: 300, // 5 minutes during off-hours
      webhookMonitorInterval: 120, // 2 minutes for webhook monitoring
      alertingEnabled: false, // Only critical alerts
      reducedFrequency: true
    };
  }

  /**
   * Check if a specific Swedish business should be monitored now
   */
  shouldMonitorBusiness(businessId: string, businessHours?: {
    weekdayStart: number;
    weekdayEnd: number;
    weekendStart: number;
    weekendEnd: number;
    timezone?: string;
  }): boolean {
    const context = this.isBusinessHours();
    
    // Always monitor during standard business hours
    if (context.isBusinessTime) {
      return true;
    }

    // Use custom business hours if provided
    if (businessHours) {
      const swedishTime = this.getSwedishTime();
      const hour = swedishTime.getHours();
      const isWeekend = swedishTime.getDay() === 0 || swedishTime.getDay() === 6;
      
      if (isWeekend) {
        return hour >= businessHours.weekendStart && hour < businessHours.weekendEnd;
      } else {
        return hour >= businessHours.weekdayStart && hour < businessHours.weekdayEnd;
      }
    }

    // Don't monitor individual businesses during off-hours unless critical
    return false;
  }

  /**
   * Get next Swedish business day
   */
  getNextBusinessDay(): Date {
    const swedishTime = this.getSwedishTime();
    let nextDay = new Date(swedishTime);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Skip weekends and holidays
    while (nextDay.getDay() === 0 || nextDay.getDay() === 6 || 
           SwedishBusinessMonitor.SWEDISH_HOLIDAYS.includes(nextDay.toISOString().split('T')[0])) {
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    nextDay.setHours(9, 0, 0, 0); // 9 AM start
    return nextDay;
  }

  /**
   * Get comprehensive Swedish business monitoring summary
   */
  async getBusinessMonitoringSummary(): Promise<{
    currentTime: string;
    businessContext: any;
    monitoringSchedule: any;
    providerHealth: Record<POSProvider, any>;
    nextBusinessDay: string;
  }> {
    const providers: POSProvider[] = ['square', 'shopify', 'zettle'];
    const providerHealth: Record<string, any> = {};

    // Collect health status for all providers
    for (const provider of providers) {
      try {
        providerHealth[provider] = await this.monitorProviderHealth(provider);
      } catch (error) {
        providerHealth[provider] = {
          health: 'unhealthy',
          error: error.message
        };
      }
    }

    return {
      currentTime: this.getSwedishTime().toISOString(),
      businessContext: this.isBusinessHours(),
      monitoringSchedule: this.getMonitoringSchedule(),
      providerHealth,
      nextBusinessDay: this.getNextBusinessDay().toISOString()
    };
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
      logger.info('Swedish Business Monitor cleaned up');
    } catch (error) {
      logger.error('Error during Swedish Business Monitor cleanup:', error);
    }
  }
}