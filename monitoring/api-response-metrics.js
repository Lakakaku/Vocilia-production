/**
 * API Response Time Metrics Middleware
 * Comprehensive monitoring of POS API response times and performance
 */

const { Histogram, Counter, Gauge, Summary, register } = require('prom-client');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  buckets: {
    fast: [5, 10, 25, 50, 100, 250, 500], // milliseconds
    standard: [50, 100, 200, 500, 1000, 2000, 5000], // milliseconds
    slow: [100, 500, 1000, 2000, 5000, 10000, 30000, 60000] // milliseconds
  },
  percentiles: [0.5, 0.75, 0.90, 0.95, 0.99],
  slidingWindowSize: 60, // seconds
  providers: ['square', 'shopify', 'zettle']
};

// Prometheus Metrics
const metrics = {
  // Core response time histogram
  apiResponseTime: new Histogram({
    name: 'pos_api_response_time_seconds',
    help: 'API response time in seconds',
    labelNames: ['provider', 'endpoint', 'method', 'status_code', 'business_id'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
  }),

  // Detailed response time summary with percentiles
  apiResponseTimeSummary: new Summary({
    name: 'pos_api_response_time_summary',
    help: 'API response time summary with percentiles',
    labelNames: ['provider', 'endpoint', 'method'],
    percentiles: CONFIG.percentiles,
    maxAgeSeconds: CONFIG.slidingWindowSize,
    ageBuckets: 5
  }),

  // Request rate counter
  apiRequestsTotal: new Counter({
    name: 'pos_api_requests_total',
    help: 'Total number of API requests',
    labelNames: ['provider', 'endpoint', 'method', 'business_id']
  }),

  // Error rate counter
  apiErrorsTotal: new Counter({
    name: 'pos_api_errors_total',
    help: 'Total number of API errors',
    labelNames: ['provider', 'endpoint', 'method', 'error_type', 'status_code']
  }),

  // Current active requests
  apiActiveRequests: new Gauge({
    name: 'pos_api_active_requests',
    help: 'Number of currently active API requests',
    labelNames: ['provider', 'endpoint']
  }),

  // Rate limiting metrics
  apiRateLimitHits: new Counter({
    name: 'pos_api_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['provider', 'endpoint']
  }),

  // Timeout metrics
  apiTimeouts: new Counter({
    name: 'pos_api_timeouts_total',
    help: 'Total number of API request timeouts',
    labelNames: ['provider', 'endpoint', 'timeout_type']
  }),

  // Circuit breaker metrics
  apiCircuitBreakerState: new Gauge({
    name: 'pos_api_circuit_breaker_state',
    help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
    labelNames: ['provider', 'endpoint']
  }),

  // Cache metrics
  apiCacheHits: new Counter({
    name: 'pos_api_cache_hits_total',
    help: 'Total number of API cache hits',
    labelNames: ['provider', 'endpoint', 'cache_type']
  }),

  apiCacheMisses: new Counter({
    name: 'pos_api_cache_misses_total',
    help: 'Total number of API cache misses',
    labelNames: ['provider', 'endpoint', 'cache_type']
  }),

  // Payload size metrics
  apiRequestSize: new Histogram({
    name: 'pos_api_request_size_bytes',
    help: 'API request payload size in bytes',
    labelNames: ['provider', 'endpoint', 'method'],
    buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
  }),

  apiResponseSize: new Histogram({
    name: 'pos_api_response_size_bytes',
    help: 'API response payload size in bytes',
    labelNames: ['provider', 'endpoint', 'method'],
    buckets: [100, 1000, 5000, 10000, 50000, 100000, 500000, 1000000]
  }),

  // Connection pool metrics
  apiConnectionPoolSize: new Gauge({
    name: 'pos_api_connection_pool_size',
    help: 'Current connection pool size',
    labelNames: ['provider']
  }),

  apiConnectionPoolActive: new Gauge({
    name: 'pos_api_connection_pool_active',
    help: 'Active connections in pool',
    labelNames: ['provider']
  }),

  // Retry metrics
  apiRetryAttempts: new Counter({
    name: 'pos_api_retry_attempts_total',
    help: 'Total number of retry attempts',
    labelNames: ['provider', 'endpoint', 'attempt_number']
  }),

  apiRetrySuccess: new Counter({
    name: 'pos_api_retry_success_total',
    help: 'Total number of successful retries',
    labelNames: ['provider', 'endpoint']
  })
};

/**
 * API Response Metrics Collector
 */
class APIResponseMetricsCollector {
  constructor() {
    this.activeRequests = new Map();
    this.providerStats = new Map();
    this.circuitBreakers = new Map();
    this.cacheManager = new CacheMetricsManager();
    
    // Initialize provider stats
    for (const provider of CONFIG.providers) {
      this.providerStats.set(provider, {
        totalRequests: 0,
        totalErrors: 0,
        avgResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0
      });
    }
  }

  /**
   * Express middleware for tracking API metrics
   */
  middleware() {
    return (req, res, next) => {
      // Skip non-API routes
      if (!req.path.startsWith('/api/pos/')) {
        return next();
      }

      const provider = this.extractProvider(req.path);
      const endpoint = this.extractEndpoint(req.path);
      const method = req.method;
      const businessId = req.headers['x-business-id'] || 'unknown';

      // Start tracking
      const requestId = this.generateRequestId();
      const startTime = performance.now();

      // Track active request
      this.trackActiveRequest(provider, endpoint, requestId);

      // Track request size
      if (req.body) {
        const size = JSON.stringify(req.body).length;
        metrics.apiRequestSize.observe(
          { provider, endpoint, method },
          size
        );
      }

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000; // Convert to seconds

        // Untrack active request
        this.untrackActiveRequest(provider, endpoint, requestId);

        // Record response time
        metrics.apiResponseTime.observe(
          { provider, endpoint, method, status_code: res.statusCode, business_id: businessId },
          duration
        );

        metrics.apiResponseTimeSummary.observe(
          { provider, endpoint, method },
          duration * 1000 // Convert to milliseconds for summary
        );

        // Count request
        metrics.apiRequestsTotal.inc({
          provider, endpoint, method, business_id: businessId
        });

        // Track errors
        if (res.statusCode >= 400) {
          metrics.apiErrorsTotal.inc({
            provider,
            endpoint,
            method,
            error_type: this.classifyStatusCode(res.statusCode),
            status_code: res.statusCode
          });

          // Update circuit breaker
          this.updateCircuitBreaker(provider, endpoint, false);
        } else {
          // Update circuit breaker for success
          this.updateCircuitBreaker(provider, endpoint, true);
        }

        // Track rate limiting
        if (res.statusCode === 429) {
          metrics.apiRateLimitHits.inc({ provider, endpoint });
        }

        // Track response size
        if (args[0]) {
          const responseSize = Buffer.byteLength(args[0]);
          metrics.apiResponseSize.observe(
            { provider, endpoint, method },
            responseSize
          );
        }

        // Update provider stats
        this.updateProviderStats(provider, duration, res.statusCode);

        // Log slow requests
        if (duration > 5) { // Requests taking more than 5 seconds
          console.warn(`⚠️ Slow API request: ${provider}/${endpoint} took ${duration.toFixed(2)}s`);
        }

        // Call original end
        originalEnd.apply(res, args);
      };

      // Handle timeouts
      req.on('timeout', () => {
        metrics.apiTimeouts.inc({
          provider,
          endpoint,
          timeout_type: 'request'
        });
      });

      res.on('timeout', () => {
        metrics.apiTimeouts.inc({
          provider,
          endpoint,
          timeout_type: 'response'
        });
      });

      next();
    };
  }

  /**
   * Track API call with detailed timing
   */
  async trackAPICall(provider, endpoint, operation) {
    const startTime = performance.now();
    const requestId = this.generateRequestId();
    
    // Track active request
    this.trackActiveRequest(provider, endpoint, requestId);

    try {
      // Check circuit breaker
      if (this.isCircuitOpen(provider, endpoint)) {
        throw new Error('Circuit breaker open');
      }

      // Check cache
      const cacheKey = `${provider}:${endpoint}:${JSON.stringify(operation.params || {})}`;
      const cached = await this.cacheManager.get(cacheKey);
      
      if (cached) {
        metrics.apiCacheHits.inc({
          provider,
          endpoint,
          cache_type: 'memory'
        });
        return cached;
      }

      metrics.apiCacheMisses.inc({
        provider,
        endpoint,
        cache_type: 'memory'
      });

      // Execute operation
      const result = await operation();

      // Cache successful result
      if (result) {
        await this.cacheManager.set(cacheKey, result, 60000); // 1 minute TTL
      }

      // Record success metrics
      const duration = (performance.now() - startTime) / 1000;
      
      metrics.apiResponseTime.observe(
        { provider, endpoint, method: 'GET', status_code: 200, business_id: 'system' },
        duration
      );

      this.updateCircuitBreaker(provider, endpoint, true);

      return result;

    } catch (error) {
      // Record error metrics
      const duration = (performance.now() - startTime) / 1000;
      
      metrics.apiResponseTime.observe(
        { provider, endpoint, method: 'GET', status_code: 500, business_id: 'system' },
        duration
      );

      metrics.apiErrorsTotal.inc({
        provider,
        endpoint,
        method: 'GET',
        error_type: error.message,
        status_code: 500
      });

      this.updateCircuitBreaker(provider, endpoint, false);

      throw error;

    } finally {
      // Untrack active request
      this.untrackActiveRequest(provider, endpoint, requestId);
    }
  }

  /**
   * Track retry attempts
   */
  async trackRetry(provider, endpoint, attemptNumber, operation) {
    metrics.apiRetryAttempts.inc({
      provider,
      endpoint,
      attempt_number: attemptNumber
    });

    try {
      const result = await operation();
      
      if (attemptNumber > 1) {
        metrics.apiRetrySuccess.inc({ provider, endpoint });
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Track connection pool metrics
   */
  updateConnectionPoolMetrics(provider, poolStats) {
    metrics.apiConnectionPoolSize.set(
      { provider },
      poolStats.size
    );

    metrics.apiConnectionPoolActive.set(
      { provider },
      poolStats.active
    );
  }

  /**
   * Track active requests
   */
  trackActiveRequest(provider, endpoint, requestId) {
    const key = `${provider}:${endpoint}`;
    
    if (!this.activeRequests.has(key)) {
      this.activeRequests.set(key, new Set());
    }
    
    this.activeRequests.get(key).add(requestId);
    
    metrics.apiActiveRequests.set(
      { provider, endpoint },
      this.activeRequests.get(key).size
    );
  }

  untrackActiveRequest(provider, endpoint, requestId) {
    const key = `${provider}:${endpoint}`;
    
    if (this.activeRequests.has(key)) {
      this.activeRequests.get(key).delete(requestId);
      
      metrics.apiActiveRequests.set(
        { provider, endpoint },
        this.activeRequests.get(key).size
      );
    }
  }

  /**
   * Circuit breaker management
   */
  updateCircuitBreaker(provider, endpoint, success) {
    const key = `${provider}:${endpoint}`;
    
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker());
    }
    
    const breaker = this.circuitBreakers.get(key);
    
    if (success) {
      breaker.recordSuccess();
    } else {
      breaker.recordFailure();
    }
    
    // Update metric
    const state = breaker.getState();
    const stateValue = state === 'closed' ? 0 : state === 'open' ? 1 : 2;
    
    metrics.apiCircuitBreakerState.set(
      { provider, endpoint },
      stateValue
    );
  }

  isCircuitOpen(provider, endpoint) {
    const key = `${provider}:${endpoint}`;
    const breaker = this.circuitBreakers.get(key);
    
    return breaker && breaker.getState() === 'open';
  }

  /**
   * Update provider statistics
   */
  updateProviderStats(provider, responseTime, statusCode) {
    const stats = this.providerStats.get(provider);
    
    if (stats) {
      stats.totalRequests++;
      
      if (statusCode >= 400) {
        stats.totalErrors++;
      }
      
      // Update rolling average
      stats.avgResponseTime = (stats.avgResponseTime * (stats.totalRequests - 1) + responseTime) / stats.totalRequests;
      
      // Update percentiles (simplified - in production use proper percentile calculation)
      if (responseTime > stats.p95ResponseTime) {
        stats.p95ResponseTime = responseTime;
      }
      
      if (responseTime > stats.p99ResponseTime) {
        stats.p99ResponseTime = responseTime;
      }
    }
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      providers: {}
    };
    
    for (const [provider, stats] of this.providerStats) {
      report.providers[provider] = {
        totalRequests: stats.totalRequests,
        totalErrors: stats.totalErrors,
        errorRate: stats.totalRequests > 0 ? (stats.totalErrors / stats.totalRequests) * 100 : 0,
        avgResponseTime: stats.avgResponseTime * 1000, // Convert to ms
        p95ResponseTime: stats.p95ResponseTime * 1000,
        p99ResponseTime: stats.p99ResponseTime * 1000
      };
    }
    
    return report;
  }

  /**
   * Helper methods
   */
  extractProvider(path) {
    const match = path.match(/\/api\/pos\/([^\/]+)/);
    return match ? match[1] : 'unknown';
  }

  extractEndpoint(path) {
    const match = path.match(/\/api\/pos\/[^\/]+\/(.+)/);
    return match ? match[1] : 'unknown';
  }

  classifyStatusCode(statusCode) {
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown';
  }

  generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.threshold = threshold;
    this.timeout = timeout;
    this.failures = 0;
    this.lastFailureTime = null;
    this.state = 'closed'; // closed, open, half-open
  }

  recordSuccess() {
    if (this.state === 'half-open') {
      this.state = 'closed';
    }
    this.failures = 0;
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'open';
    }
  }

  getState() {
    if (this.state === 'open') {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      }
    }
    
    return this.state;
  }
}

/**
 * Cache Metrics Manager
 */
class CacheMetricsManager {
  constructor() {
    this.cache = new Map();
  }

  async get(key) {
    const entry = this.cache.get(key);
    
    if (entry && entry.expiry > Date.now()) {
      return entry.value;
    }
    
    // Remove expired entry
    if (entry) {
      this.cache.delete(key);
    }
    
    return null;
  }

  async set(key, value, ttl) {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }
}

// Export for use
module.exports = {
  APIResponseMetricsCollector,
  metrics,
  CircuitBreaker,
  CacheMetricsManager
};