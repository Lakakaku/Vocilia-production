/**
 * Model Performance Monitor for Llama 3.2 in Production
 * Tracks performance metrics, latency, accuracy, and system health
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface PerformanceMetrics {
  // Timing metrics
  responseTime: number;           // milliseconds
  processingTime: number;         // milliseconds  
  queueTime: number;             // milliseconds
  totalTime: number;             // milliseconds
  
  // Quality metrics
  confidenceScore: number;       // 0-1
  qualityScore: number;          // 0-100
  authenticityScore: number;     // 0-100
  concretenessScore: number;     // 0-100
  depthScore: number;            // 0-100
  
  // System metrics
  memoryUsage: number;           // MB
  cpuUsage: number;             // percentage
  gpuUsage?: number;            // percentage (if available)
  tokenCount: number;           // input + output tokens
  
  // Business metrics
  customerSatisfaction?: number; // 0-100 (if available)
  rewardAmount?: number;        // SEK
  businessValue?: number;       // estimated value
  
  // Context
  language: string;
  audioLength: number;          // seconds
  sessionId: string;
  businessId: string;
  timestamp: Date;
  
  // Error tracking
  errorType?: string;
  errorMessage?: string;
  recoveryAttempts?: number;
}

export interface AlertThresholds {
  responseTimeMs: number;        // Alert if > threshold
  confidenceScore: number;       // Alert if < threshold
  qualityScore: number;          // Alert if < threshold
  errorRatePercent: number;      // Alert if > threshold
  memoryUsageMB: number;         // Alert if > threshold
  cpuUsagePercent: number;       // Alert if > threshold
}

export interface PerformanceReport {
  timeRange: { start: Date; end: Date; };
  totalSessions: number;
  successfulSessions: number;
  failedSessions: number;
  averageMetrics: {
    responseTime: number;
    confidenceScore: number;
    qualityScore: number;
    customerSatisfaction: number;
  };
  percentiles: {
    p50: { responseTime: number; qualityScore: number; };
    p95: { responseTime: number; qualityScore: number; };
    p99: { responseTime: number; qualityScore: number; };
  };
  errorAnalysis: {
    totalErrors: number;
    errorTypes: Record<string, number>;
    errorRate: number;
  };
  systemHealth: {
    averageMemoryUsage: number;
    averageCpuUsage: number;
    peakMemoryUsage: number;
    peakCpuUsage: number;
  };
  businessImpact: {
    totalRewardsDistributed: number;
    averageRewardAmount: number;
    estimatedBusinessValue: number;
  };
}

export class ModelPerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private alertThresholds: AlertThresholds;
  private maxMetricsInMemory: number = 10000;
  private metricsFilePath: string;
  private alertsEnabled: boolean = true;
  
  constructor(config: {
    alertThresholds?: Partial<AlertThresholds>;
    maxMetricsInMemory?: number;
    metricsFilePath?: string;
    alertsEnabled?: boolean;
  } = {}) {
    super();
    
    this.alertThresholds = {
      responseTimeMs: 2000,        // 2 seconds
      confidenceScore: 0.7,        // 70%
      qualityScore: 60,            // 60/100
      errorRatePercent: 5,         // 5%
      memoryUsageMB: 2048,         // 2GB
      cpuUsagePercent: 80,         // 80%
      ...config.alertThresholds
    };
    
    this.maxMetricsInMemory = config.maxMetricsInMemory || 10000;
    this.metricsFilePath = config.metricsFilePath || join(process.cwd(), 'performance-metrics.jsonl');
    this.alertsEnabled = config.alertsEnabled !== false;
    
    // Setup periodic cleanup and reporting
    this.setupPeriodicTasks();
  }

  /**
   * Record a performance metric from a feedback session
   */
  async recordMetric(metric: PerformanceMetrics): Promise<void> {
    // Add to in-memory storage
    this.metrics.push(metric);
    
    // Check if we need to persist and cleanup
    if (this.metrics.length > this.maxMetricsInMemory) {
      await this.persistMetrics();
      this.metrics = this.metrics.slice(-Math.floor(this.maxMetricsInMemory / 2));
    }
    
    // Check for alerts
    if (this.alertsEnabled) {
      await this.checkAlerts(metric);
    }
    
    // Emit event for real-time monitoring
    this.emit('metric', metric);
  }

  /**
   * Check if metric triggers any alerts
   */
  private async checkAlerts(metric: PerformanceMetrics): Promise<void> {
    const alerts: string[] = [];
    
    // Response time alert
    if (metric.responseTime > this.alertThresholds.responseTimeMs) {
      alerts.push(`High response time: ${metric.responseTime}ms (threshold: ${this.alertThresholds.responseTimeMs}ms)`);
    }
    
    // Confidence score alert
    if (metric.confidenceScore < this.alertThresholds.confidenceScore) {
      alerts.push(`Low confidence score: ${metric.confidenceScore} (threshold: ${this.alertThresholds.confidenceScore})`);
    }
    
    // Quality score alert
    if (metric.qualityScore < this.alertThresholds.qualityScore) {
      alerts.push(`Low quality score: ${metric.qualityScore} (threshold: ${this.alertThresholds.qualityScore})`);
    }
    
    // Memory usage alert
    if (metric.memoryUsage > this.alertThresholds.memoryUsageMB) {
      alerts.push(`High memory usage: ${metric.memoryUsage}MB (threshold: ${this.alertThresholds.memoryUsageMB}MB)`);
    }
    
    // CPU usage alert
    if (metric.cpuUsage > this.alertThresholds.cpuUsagePercent) {
      alerts.push(`High CPU usage: ${metric.cpuUsage}% (threshold: ${this.alertThresholds.cpuUsagePercent}%)`);
    }
    
    // Error alert
    if (metric.errorType) {
      alerts.push(`Error occurred: ${metric.errorType} - ${metric.errorMessage}`);
    }
    
    // Emit alerts
    for (const alert of alerts) {
      this.emit('alert', {
        level: 'warning',
        message: alert,
        metric,
        timestamp: new Date()
      });
    }
    
    // Check error rate (requires recent metrics)
    await this.checkErrorRate();
  }

  /**
   * Check error rate over recent period
   */
  private async checkErrorRate(): Promise<void> {
    const recentPeriod = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const cutoff = new Date(now.getTime() - recentPeriod);
    
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length >= 10) { // Only check if we have enough samples
      const errorCount = recentMetrics.filter(m => m.errorType).length;
      const errorRate = (errorCount / recentMetrics.length) * 100;
      
      if (errorRate > this.alertThresholds.errorRatePercent) {
        this.emit('alert', {
          level: 'critical',
          message: `High error rate: ${errorRate.toFixed(1)}% over last 5 minutes (threshold: ${this.alertThresholds.errorRatePercent}%)`,
          timestamp: now,
          errorRate,
          sampleSize: recentMetrics.length
        });
      }
    }
  }

  /**
   * Generate performance report for a time range
   */
  async generateReport(startDate: Date, endDate: Date): Promise<PerformanceReport> {
    // Get metrics from memory and disk
    const allMetrics = await this.getAllMetrics(startDate, endDate);
    
    if (allMetrics.length === 0) {
      throw new Error('No metrics found for the specified time range');
    }
    
    const successfulMetrics = allMetrics.filter(m => !m.errorType);
    const failedMetrics = allMetrics.filter(m => m.errorType);
    
    // Calculate averages
    const averageMetrics = this.calculateAverages(successfulMetrics);
    
    // Calculate percentiles
    const percentiles = this.calculatePercentiles(successfulMetrics);
    
    // Error analysis
    const errorAnalysis = this.analyzeErrors(failedMetrics);
    
    // System health
    const systemHealth = this.analyzeSystemHealth(allMetrics);
    
    // Business impact
    const businessImpact = this.analyzeBusinessImpact(successfulMetrics);
    
    return {
      timeRange: { start: startDate, end: endDate },
      totalSessions: allMetrics.length,
      successfulSessions: successfulMetrics.length,
      failedSessions: failedMetrics.length,
      averageMetrics,
      percentiles,
      errorAnalysis,
      systemHealth,
      businessImpact
    };
  }

  /**
   * Get current system status
   */
  async getSystemStatus(): Promise<{
    isHealthy: boolean;
    alerts: number;
    recentMetrics: number;
    averageResponseTime: number;
    errorRate: number;
    memoryUsage: number;
    cpuUsage: number;
  }> {
    const recentPeriod = 15 * 60 * 1000; // 15 minutes
    const now = new Date();
    const cutoff = new Date(now.getTime() - recentPeriod);
    
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    if (recentMetrics.length === 0) {
      return {
        isHealthy: false,
        alerts: 0,
        recentMetrics: 0,
        averageResponseTime: 0,
        errorRate: 0,
        memoryUsage: 0,
        cpuUsage: 0
      };
    }
    
    const errorCount = recentMetrics.filter(m => m.errorType).length;
    const errorRate = (errorCount / recentMetrics.length) * 100;
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length;
    const avgMemoryUsage = recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length;
    const avgCpuUsage = recentMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / recentMetrics.length;
    
    // Check health conditions
    const isHealthy = 
      avgResponseTime <= this.alertThresholds.responseTimeMs &&
      errorRate <= this.alertThresholds.errorRatePercent &&
      avgMemoryUsage <= this.alertThresholds.memoryUsageMB &&
      avgCpuUsage <= this.alertThresholds.cpuUsagePercent;
    
    return {
      isHealthy,
      alerts: errorCount,
      recentMetrics: recentMetrics.length,
      averageResponseTime: avgResponseTime,
      errorRate,
      memoryUsage: avgMemoryUsage,
      cpuUsage: avgCpuUsage
    };
  }

  /**
   * Persist metrics to disk
   */
  private async persistMetrics(): Promise<void> {
    try {
      const lines = this.metrics.map(m => JSON.stringify(m)).join('\n') + '\n';
      await fs.appendFile(this.metricsFilePath, lines);
    } catch (error) {
      console.error('Failed to persist metrics:', error);
    }
  }

  /**
   * Load metrics from disk for time range
   */
  private async getAllMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics[]> {
    const metrics = [...this.metrics];
    
    // Try to load from disk
    try {
      const content = await fs.readFile(this.metricsFilePath, 'utf-8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const metric = JSON.parse(line);
            metric.timestamp = new Date(metric.timestamp);
            
            if (metric.timestamp >= startDate && metric.timestamp <= endDate) {
              metrics.push(metric);
            }
          } catch (parseError) {
            console.warn('Failed to parse metric line:', parseError);
          }
        }
      }
    } catch (fileError) {
      console.warn('Could not read metrics file:', fileError);
    }
    
    // Filter by time range and deduplicate
    return metrics
      .filter(m => m.timestamp >= startDate && m.timestamp <= endDate)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateAverages(metrics: PerformanceMetrics[]) {
    if (metrics.length === 0) return { responseTime: 0, confidenceScore: 0, qualityScore: 0, customerSatisfaction: 0 };
    
    return {
      responseTime: metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length,
      confidenceScore: metrics.reduce((sum, m) => sum + m.confidenceScore, 0) / metrics.length,
      qualityScore: metrics.reduce((sum, m) => sum + m.qualityScore, 0) / metrics.length,
      customerSatisfaction: metrics.filter(m => m.customerSatisfaction).reduce((sum, m) => sum + (m.customerSatisfaction || 0), 0) / Math.max(1, metrics.filter(m => m.customerSatisfaction).length)
    };
  }

  private calculatePercentiles(metrics: PerformanceMetrics[]) {
    if (metrics.length === 0) return { p50: { responseTime: 0, qualityScore: 0 }, p95: { responseTime: 0, qualityScore: 0 }, p99: { responseTime: 0, qualityScore: 0 } };
    
    const sortedByResponseTime = metrics.slice().sort((a, b) => a.responseTime - b.responseTime);
    const sortedByQuality = metrics.slice().sort((a, b) => a.qualityScore - b.qualityScore);
    
    const getPercentile = (arr: any[], p: number) => {
      const index = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, index)];
    };
    
    return {
      p50: {
        responseTime: getPercentile(sortedByResponseTime, 50)?.responseTime || 0,
        qualityScore: getPercentile(sortedByQuality, 50)?.qualityScore || 0
      },
      p95: {
        responseTime: getPercentile(sortedByResponseTime, 95)?.responseTime || 0,
        qualityScore: getPercentile(sortedByQuality, 95)?.qualityScore || 0
      },
      p99: {
        responseTime: getPercentile(sortedByResponseTime, 99)?.responseTime || 0,
        qualityScore: getPercentile(sortedByQuality, 99)?.qualityScore || 0
      }
    };
  }

  private analyzeErrors(failedMetrics: PerformanceMetrics[]) {
    const errorTypes: Record<string, number> = {};
    
    for (const metric of failedMetrics) {
      if (metric.errorType) {
        errorTypes[metric.errorType] = (errorTypes[metric.errorType] || 0) + 1;
      }
    }
    
    return {
      totalErrors: failedMetrics.length,
      errorTypes,
      errorRate: failedMetrics.length > 0 ? (failedMetrics.length / (failedMetrics.length + this.metrics.filter(m => !m.errorType).length)) * 100 : 0
    };
  }

  private analyzeSystemHealth(metrics: PerformanceMetrics[]) {
    if (metrics.length === 0) return { averageMemoryUsage: 0, averageCpuUsage: 0, peakMemoryUsage: 0, peakCpuUsage: 0 };
    
    return {
      averageMemoryUsage: metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length,
      averageCpuUsage: metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length,
      peakMemoryUsage: Math.max(...metrics.map(m => m.memoryUsage)),
      peakCpuUsage: Math.max(...metrics.map(m => m.cpuUsage))
    };
  }

  private analyzeBusinessImpact(metrics: PerformanceMetrics[]) {
    const metricsWithRewards = metrics.filter(m => m.rewardAmount);
    
    if (metricsWithRewards.length === 0) {
      return { totalRewardsDistributed: 0, averageRewardAmount: 0, estimatedBusinessValue: 0 };
    }
    
    const totalRewards = metricsWithRewards.reduce((sum, m) => sum + (m.rewardAmount || 0), 0);
    const averageReward = totalRewards / metricsWithRewards.length;
    const estimatedBusinessValue = totalRewards * 5; // Assume 5x multiplier for business value
    
    return {
      totalRewardsDistributed: totalRewards,
      averageRewardAmount: averageReward,
      estimatedBusinessValue
    };
  }

  private setupPeriodicTasks(): void {
    // Persist metrics every 5 minutes
    setInterval(async () => {
      if (this.metrics.length > 0) {
        await this.persistMetrics();
      }
    }, 5 * 60 * 1000);
    
    // Generate health report every hour
    setInterval(async () => {
      try {
        const status = await this.getSystemStatus();
        this.emit('healthReport', status);
      } catch (error) {
        console.error('Failed to generate health report:', error);
      }
    }, 60 * 60 * 1000);
  }

  /**
   * Close the monitor and persist remaining metrics
   */
  async close(): Promise<void> {
    if (this.metrics.length > 0) {
      await this.persistMetrics();
    }
  }
}