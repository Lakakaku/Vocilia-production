// Node.js environment globals
declare const console: any;
declare const process: any;

/**
 * Performance monitoring system for AI operations
 * Tracks latency, throughput, cache hit rates, and system health
 */
export class PerformanceMonitor {
  private metrics = {
    aiRequests: {
      total: 0,
      successful: 0,
      failed: 0,
      cached: 0
    },
    latency: {
      samples: [] as number[],
      maxSamples: 1000
    },
    concurrent: {
      current: 0,
      peak: 0
    },
    memory: {
      samples: [] as number[],
      maxSamples: 100
    }
  };

  private readonly sampleWindow = 60 * 1000; // 1 minute
  private alertThresholds = {
    maxLatency: 2000,    // 2 seconds
    maxMemoryMB: 512,    // 512 MB
    maxConcurrent: 50    // 50 concurrent requests
  };

  /**
   * Record AI request start
   */
  startRequest(): string {
    const requestId = this.generateRequestId();
    this.metrics.concurrent.current++;
    
    if (this.metrics.concurrent.current > this.metrics.concurrent.peak) {
      this.metrics.concurrent.peak = this.metrics.concurrent.current;
    }

    // Log high concurrent usage
    if (this.metrics.concurrent.current > this.alertThresholds.maxConcurrent) {
      console.warn(`⚠️  High concurrent AI requests: ${this.metrics.concurrent.current}`);
    }

    return requestId;
  }

  /**
   * Record AI request completion
   */
  endRequest(requestId: string, success: boolean, cached: boolean = false): void {
    this.metrics.concurrent.current = Math.max(0, this.metrics.concurrent.current - 1);
    this.metrics.aiRequests.total++;
    
    if (success) {
      this.metrics.aiRequests.successful++;
    } else {
      this.metrics.aiRequests.failed++;
    }

    if (cached) {
      this.metrics.aiRequests.cached++;
    }
  }

  /**
   * Record latency measurement
   */
  recordLatency(duration: number): void {
    this.metrics.latency.samples.push(duration);
    
    // Keep only recent samples
    if (this.metrics.latency.samples.length > this.metrics.latency.maxSamples) {
      this.metrics.latency.samples.shift();
    }

    // Alert on high latency
    if (duration > this.alertThresholds.maxLatency) {
      console.warn(`⚠️  High AI latency: ${duration}ms (threshold: ${this.alertThresholds.maxLatency}ms)`);
    }
  }

  /**
   * Record memory usage
   */
  recordMemoryUsage(): void {
    if (process && process.memoryUsage) {
      const usage = process.memoryUsage();
      const usedMB = Math.round(usage.heapUsed / 1024 / 1024);
      
      this.metrics.memory.samples.push(usedMB);
      
      // Keep only recent samples
      if (this.metrics.memory.samples.length > this.metrics.memory.maxSamples) {
        this.metrics.memory.samples.shift();
      }

      // Alert on high memory usage
      if (usedMB > this.alertThresholds.maxMemoryMB) {
        console.warn(`⚠️  High memory usage: ${usedMB}MB (threshold: ${this.alertThresholds.maxMemoryMB}MB)`);
      }
    }
  }

  /**
   * Get current performance statistics
   */
  getStats(): {
    requests: {
      total: number;
      successRate: number;
      cacheHitRate: number;
      failureRate: number;
    };
    latency: {
      avg: number;
      p50: number;
      p95: number;
      p99: number;
      min: number;
      max: number;
    };
    concurrent: {
      current: number;
      peak: number;
    };
    memory: {
      current: number;
      avg: number;
      peak: number;
    };
    health: {
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
  } {
    const { total, successful, cached, failed } = this.metrics.aiRequests;
    const latencySamples = this.metrics.latency.samples;
    const memorySamples = this.metrics.memory.samples;

    // Calculate latency percentiles
    const sortedLatencies = [...latencySamples].sort((a, b) => a - b);
    const latencyStats = {
      avg: latencySamples.length > 0 ? Math.round(latencySamples.reduce((sum, val) => sum + val, 0) / latencySamples.length) : 0,
      p50: this.percentile(sortedLatencies, 50),
      p95: this.percentile(sortedLatencies, 95),
      p99: this.percentile(sortedLatencies, 99),
      min: latencySamples.length > 0 ? Math.min(...latencySamples) : 0,
      max: latencySamples.length > 0 ? Math.max(...latencySamples) : 0
    };

    // Calculate memory stats
    const currentMemory = memorySamples.length > 0 ? memorySamples[memorySamples.length - 1] : 0;
    const avgMemory = memorySamples.length > 0 ? Math.round(memorySamples.reduce((sum, val) => sum + val, 0) / memorySamples.length) : 0;
    const peakMemory = memorySamples.length > 0 ? Math.max(...memorySamples) : 0;

    // Health assessment
    const issues: string[] = [];
    let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    if (latencyStats.p95 > this.alertThresholds.maxLatency) {
      issues.push(`High latency: P95 ${latencyStats.p95}ms`);
      healthStatus = 'warning';
    }

    if (currentMemory > this.alertThresholds.maxMemoryMB) {
      issues.push(`High memory: ${currentMemory}MB`);
      healthStatus = 'warning';
    }

    if (this.metrics.concurrent.current > this.alertThresholds.maxConcurrent) {
      issues.push(`High concurrent requests: ${this.metrics.concurrent.current}`);
      healthStatus = 'critical';
    }

    if (total > 0 && (failed / total) > 0.05) { // >5% failure rate
      issues.push(`High failure rate: ${Math.round((failed / total) * 100)}%`);
      healthStatus = healthStatus === 'critical' ? 'critical' : 'warning';
    }

    return {
      requests: {
        total,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 0,
        cacheHitRate: total > 0 ? Math.round((cached / total) * 100) : 0,
        failureRate: total > 0 ? Math.round((failed / total) * 100) : 0
      },
      latency: latencyStats,
      concurrent: {
        current: this.metrics.concurrent.current,
        peak: this.metrics.concurrent.peak
      },
      memory: {
        current: currentMemory,
        avg: avgMemory,
        peak: peakMemory
      },
      health: {
        status: healthStatus,
        issues
      }
    };
  }

  /**
   * Get formatted performance report
   */
  getReport(): string {
    const stats = this.getStats();
    
    return `
🔍 AI Performance Monitor Report
================================

📊 REQUEST METRICS
   Total Requests: ${stats.requests.total}
   Success Rate: ${stats.requests.successRate}%
   Cache Hit Rate: ${stats.requests.cacheHitRate}%
   Failure Rate: ${stats.requests.failureRate}%

⚡ LATENCY METRICS
   Average: ${stats.latency.avg}ms
   P50: ${stats.latency.p50}ms
   P95: ${stats.latency.p95}ms
   P99: ${stats.latency.p99}ms
   Range: ${stats.latency.min}ms - ${stats.latency.max}ms

🔄 CONCURRENT SESSIONS
   Current: ${stats.concurrent.current}
   Peak: ${stats.concurrent.peak}

💾 MEMORY USAGE
   Current: ${stats.memory.current}MB
   Average: ${stats.memory.avg}MB
   Peak: ${stats.memory.peak}MB

🏥 HEALTH STATUS: ${stats.health.status.toUpperCase()}
${stats.health.issues.length > 0 ? '   Issues: ' + stats.health.issues.join(', ') : '   No issues detected'}

🎯 TARGET COMPLIANCE
   Latency Target (<2s): ${stats.latency.p95 <= 2000 ? '✅ PASS' : '❌ FAIL'}
   Memory Target (<512MB): ${stats.memory.peak <= 512 ? '✅ PASS' : '❌ FAIL'}
   Concurrent Target (<50): ${stats.concurrent.peak <= 50 ? '✅ PASS' : '❌ FAIL'}
`;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics = {
      aiRequests: {
        total: 0,
        successful: 0,
        failed: 0,
        cached: 0
      },
      latency: {
        samples: [],
        maxSamples: 1000
      },
      concurrent: {
        current: 0,
        peak: 0
      },
      memory: {
        samples: [],
        maxSamples: 100
      }
    };
    console.log('Performance metrics reset');
  }

  /**
   * Start automatic memory monitoring
   */
  startMemoryMonitoring(intervalMs: number = 30000): void {
    setInterval(() => {
      this.recordMemoryUsage();
    }, intervalMs);
    console.log(`Memory monitoring started (interval: ${intervalMs}ms)`);
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = (p / 100) * (arr.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (upper >= arr.length) return arr[lower];
    return Math.round(arr[lower] * (1 - weight) + arr[upper] * weight);
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();