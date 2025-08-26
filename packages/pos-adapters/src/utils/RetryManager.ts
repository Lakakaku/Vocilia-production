import { createLogger } from './logger';

const logger = createLogger('RetryManager');

/**
 * Retry Manager with Exponential Backoff and Circuit Breaker
 * 
 * Provides intelligent retry logic for API calls with:
 * - Exponential backoff with jitter
 * - Circuit breaker pattern
 * - Configurable retry strategies
 * - Error categorization
 * - Request deduplication
 */
export class RetryManager {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private pendingRequests = new Map<string, Promise<any>>();
  private retryMetrics = new Map<string, RetryMetrics>();
  
  constructor(private config: RetryConfiguration = defaultRetryConfig) {}

  /**
   * Execute a function with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const mergedOptions = { ...this.config.defaultOptions, ...options };
    const operationKey = options.key || this.generateOperationKey();
    
    // Check for duplicate requests
    if (mergedOptions.deduplication && this.pendingRequests.has(operationKey)) {
      logger.debug('Returning deduplicated request', { key: operationKey });
      return this.pendingRequests.get(operationKey);
    }

    // Check circuit breaker
    const circuitBreaker = this.getOrCreateCircuitBreaker(mergedOptions.circuitBreakerKey || operationKey);
    if (circuitBreaker.isOpen()) {
      throw new RetryError('Circuit breaker is open', 'CIRCUIT_BREAKER_OPEN');
    }

    // Create retry promise
    const retryPromise = this.performRetry(operation, mergedOptions, operationKey, circuitBreaker);
    
    if (mergedOptions.deduplication) {
      this.pendingRequests.set(operationKey, retryPromise);
      retryPromise.finally(() => {
        this.pendingRequests.delete(operationKey);
      });
    }

    return retryPromise;
  }

  /**
   * Perform retry logic
   */
  private async performRetry<T>(
    operation: () => Promise<T>,
    options: Required<RetryOptions>,
    operationKey: string,
    circuitBreaker: CircuitBreaker
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: any;
    let attemptCount = 0;
    const metrics = this.getOrCreateMetrics(operationKey);

    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      attemptCount = attempt;
      
      try {
        // Execute operation
        const result = await this.executeWithTimeout(operation, options.timeout);
        
        // Success - update metrics and circuit breaker
        circuitBreaker.recordSuccess();
        metrics.recordSuccess(Date.now() - startTime, attempt);
        
        logger.debug('Operation succeeded', {
          key: operationKey,
          attempt,
          duration: Date.now() - startTime
        });
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Categorize error
        const errorCategory = this.categorizeError(error);
        metrics.recordError(errorCategory);
        
        // Check if error is retryable
        if (!this.isRetryableError(error, errorCategory, options)) {
          circuitBreaker.recordFailure();
          logger.error('Non-retryable error', {
            key: operationKey,
            attempt,
            category: errorCategory,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          throw error;
        }
        
        // Check if we should continue retrying
        if (attempt === options.maxAttempts) {
          circuitBreaker.recordFailure();
          logger.error('Max retry attempts reached', {
            key: operationKey,
            attempts: attempt,
            duration: Date.now() - startTime
          });
          break;
        }
        
        // Calculate retry delay
        const delay = this.calculateDelay(attempt, errorCategory, options, error);
        
        logger.debug('Retrying after delay', {
          key: operationKey,
          attempt,
          nextAttempt: attempt + 1,
          delayMs: delay,
          errorCategory
        });
        
        // Wait before retry
        await this.sleep(delay);
      }
    }
    
    // All retries exhausted
    metrics.recordFailure(Date.now() - startTime, attemptCount);
    throw new RetryError(
      `Operation failed after ${attemptCount} attempts`,
      'MAX_RETRIES_EXCEEDED',
      lastError
    );
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new RetryError('Operation timed out', 'TIMEOUT')), timeoutMs)
      )
    ]);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateDelay(
    attempt: number,
    errorCategory: ErrorCategory,
    options: Required<RetryOptions>,
    error: any
  ): number {
    let baseDelay: number;
    
    // Check for rate limit header
    if (error?.response?.headers?.['retry-after']) {
      const retryAfter = parseInt(error.response.headers['retry-after'], 10);
      baseDelay = retryAfter * 1000;
    } else {
      // Use strategy-based calculation
      switch (options.strategy) {
        case 'exponential':
          baseDelay = Math.min(
            options.baseDelay * Math.pow(options.multiplier, attempt - 1),
            options.maxDelay
          );
          break;
        
        case 'linear':
          baseDelay = Math.min(
            options.baseDelay * attempt,
            options.maxDelay
          );
          break;
        
        case 'constant':
          baseDelay = options.baseDelay;
          break;
        
        default:
          baseDelay = options.baseDelay;
      }
    }
    
    // Add jitter to prevent thundering herd
    if (options.jitter) {
      const jitterValue = baseDelay * options.jitterFactor * Math.random();
      baseDelay = Math.round(baseDelay + jitterValue);
    }
    
    // Apply error category multiplier
    const categoryMultiplier = this.getErrorCategoryMultiplier(errorCategory);
    baseDelay = Math.round(baseDelay * categoryMultiplier);
    
    return Math.min(baseDelay, options.maxDelay);
  }

  /**
   * Categorize error for intelligent retry decisions
   */
  private categorizeError(error: any): ErrorCategory {
    // Network errors
    if (error?.code && ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(error.code)) {
      return 'network';
    }
    
    // HTTP status-based categorization
    const status = error?.response?.status || error?.status;
    if (status) {
      if (status === 429) return 'rate_limit';
      if (status === 408 || status === 504) return 'timeout';
      if (status >= 500 && status < 600) return 'server_error';
      if (status >= 400 && status < 500) return 'client_error';
    }
    
    // Timeout errors
    if (error?.message?.toLowerCase().includes('timeout')) {
      return 'timeout';
    }
    
    // Circuit breaker errors
    if (error?.code === 'CIRCUIT_BREAKER_OPEN') {
      return 'circuit_breaker';
    }
    
    return 'unknown';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(
    error: any,
    category: ErrorCategory,
    options: Required<RetryOptions>
  ): boolean {
    // Check custom retry predicate
    if (options.retryPredicate) {
      const shouldRetry = options.retryPredicate(error, category);
      if (shouldRetry !== undefined) return shouldRetry;
    }
    
    // Default retry logic by category
    switch (category) {
      case 'network':
      case 'timeout':
      case 'server_error':
      case 'rate_limit':
        return true;
      
      case 'client_error':
        const status = error?.response?.status || error?.status;
        // Retry specific client errors that might be transient
        return [408, 409, 423, 425, 429].includes(status);
      
      case 'circuit_breaker':
      case 'unknown':
      default:
        return false;
    }
  }

  /**
   * Get error category multiplier for delay calculation
   */
  private getErrorCategoryMultiplier(category: ErrorCategory): number {
    switch (category) {
      case 'rate_limit':
        return 2.0; // Longer delays for rate limits
      case 'server_error':
        return 1.5; // Moderate delays for server errors
      case 'timeout':
        return 1.2; // Slight increase for timeouts
      case 'network':
        return 1.0; // Standard delay for network issues
      default:
        return 1.0;
    }
  }

  /**
   * Get or create circuit breaker
   */
  private getOrCreateCircuitBreaker(key: string): CircuitBreaker {
    if (!this.circuitBreakers.has(key)) {
      this.circuitBreakers.set(key, new CircuitBreaker(this.config.circuitBreaker));
    }
    return this.circuitBreakers.get(key)!;
  }

  /**
   * Get or create metrics
   */
  private getOrCreateMetrics(key: string): RetryMetrics {
    if (!this.retryMetrics.has(key)) {
      this.retryMetrics.set(key, new RetryMetrics(key));
    }
    return this.retryMetrics.get(key)!;
  }

  /**
   * Generate unique operation key
   */
  private generateOperationKey(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get metrics for an operation
   */
  getMetrics(key: string): RetryMetrics | undefined {
    return this.retryMetrics.get(key);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, RetryMetrics> {
    return new Map(this.retryMetrics);
  }

  /**
   * Reset metrics
   */
  resetMetrics(key?: string): void {
    if (key) {
      this.retryMetrics.delete(key);
    } else {
      this.retryMetrics.clear();
    }
  }

  /**
   * Reset circuit breakers
   */
  resetCircuitBreakers(key?: string): void {
    if (key) {
      this.circuitBreakers.delete(key);
    } else {
      this.circuitBreakers.clear();
    }
  }
}

/**
 * Circuit Breaker implementation
 */
class CircuitBreaker {
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private failureCount = 0;
  private lastFailureTime?: Date;
  private successCount = 0;
  
  constructor(private config: CircuitBreakerConfig) {}
  
  isOpen(): boolean {
    if (this.state === 'closed') return false;
    
    if (this.state === 'open') {
      // Check if we should transition to half-open
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
        this.successCount = 0;
        logger.debug('Circuit breaker transitioning to half-open');
        return false;
      }
      return true;
    }
    
    // Half-open state
    return false;
  }
  
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed';
        this.failureCount = 0;
        this.successCount = 0;
        logger.info('Circuit breaker closed after successful recovery');
      }
    } else if (this.state === 'closed') {
      this.failureCount = 0;
    }
  }
  
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'half-open') {
      this.state = 'open';
      logger.warn('Circuit breaker opened from half-open state');
    } else if (this.state === 'closed' && this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      logger.warn('Circuit breaker opened after reaching failure threshold');
    }
  }
  
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.config.resetTimeout;
  }
  
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
  
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

/**
 * Retry Metrics collector
 */
class RetryMetrics {
  private attempts: AttemptRecord[] = [];
  private errors: Map<ErrorCategory, number> = new Map();
  private successCount = 0;
  private failureCount = 0;
  private totalDuration = 0;
  
  constructor(private key: string) {}
  
  recordSuccess(duration: number, attempts: number): void {
    this.successCount++;
    this.totalDuration += duration;
    this.attempts.push({
      timestamp: new Date(),
      attempts,
      duration,
      success: true
    });
  }
  
  recordFailure(duration: number, attempts: number): void {
    this.failureCount++;
    this.totalDuration += duration;
    this.attempts.push({
      timestamp: new Date(),
      attempts,
      duration,
      success: false
    });
  }
  
  recordError(category: ErrorCategory): void {
    this.errors.set(category, (this.errors.get(category) || 0) + 1);
  }
  
  getStats(): RetryStats {
    return {
      key: this.key,
      successCount: this.successCount,
      failureCount: this.failureCount,
      totalAttempts: this.attempts.length,
      averageDuration: this.attempts.length > 0 ? this.totalDuration / this.attempts.length : 0,
      successRate: this.attempts.length > 0 
        ? this.successCount / this.attempts.length 
        : 0,
      errorBreakdown: Object.fromEntries(this.errors),
      recentAttempts: this.attempts.slice(-10)
    };
  }
}

/**
 * Custom error class for retry operations
 */
export class RetryError extends Error {
  constructor(
    message: string,
    public code: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'RetryError';
  }
}

// Type definitions
export interface RetryConfiguration {
  defaultOptions: Required<RetryOptions>;
  circuitBreaker: CircuitBreakerConfig;
}

export interface RetryOptions {
  key?: string;
  circuitBreakerKey?: string;
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  multiplier?: number;
  strategy?: 'exponential' | 'linear' | 'constant';
  jitter?: boolean;
  jitterFactor?: number;
  timeout?: number;
  deduplication?: boolean;
  retryPredicate?: (error: any, category: ErrorCategory) => boolean | undefined;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  resetTimeout: number;
}

export interface CircuitBreakerStats {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
}

export type ErrorCategory = 
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'server_error'
  | 'client_error'
  | 'circuit_breaker'
  | 'unknown';

export interface AttemptRecord {
  timestamp: Date;
  attempts: number;
  duration: number;
  success: boolean;
}

export interface RetryStats {
  key: string;
  successCount: number;
  failureCount: number;
  totalAttempts: number;
  averageDuration: number;
  successRate: number;
  errorBreakdown: Record<string, number>;
  recentAttempts: AttemptRecord[];
}

// Default configuration
const defaultRetryConfig: RetryConfiguration = {
  defaultOptions: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    multiplier: 2,
    strategy: 'exponential',
    jitter: true,
    jitterFactor: 0.1,
    timeout: 30000,
    deduplication: false,
    key: '',
    circuitBreakerKey: '',
    retryPredicate: undefined
  },
  circuitBreaker: {
    failureThreshold: 5,
    successThreshold: 2,
    resetTimeout: 60000 // 1 minute
  }
};

// Export factory function
export function createRetryManager(config?: Partial<RetryConfiguration>): RetryManager {
  const mergedConfig = config ? {
    defaultOptions: { ...defaultRetryConfig.defaultOptions, ...config.defaultOptions },
    circuitBreaker: { ...defaultRetryConfig.circuitBreaker, ...config.circuitBreaker }
  } : defaultRetryConfig;
  
  return new RetryManager(mergedConfig);
}