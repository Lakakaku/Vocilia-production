import { createLogger } from './logger';
import { POSProvider } from '@ai-feedback-platform/shared-types';

const logger = createLogger('ErrorHandler');

/**
 * Comprehensive Error Handler for POS API Failures
 * 
 * Provides intelligent error categorization, handling, and recovery strategies
 * for all POS provider APIs with detailed diagnostics and remediation suggestions
 */
export class POSErrorHandler {
  private errorHistory: ErrorHistoryEntry[] = [];
  private errorPatterns = new Map<string, ErrorPattern>();
  private providerErrorMappings: ProviderErrorMappings;
  private readonly maxHistorySize = 1000;

  constructor() {
    this.providerErrorMappings = this.initializeProviderMappings();
    this.initializeErrorPatterns();
  }

  /**
   * Handle and categorize an error
   */
  handleError(
    error: any,
    context: ErrorContext
  ): ErrorHandlingResult {
    logger.debug('Handling error', { provider: context.provider, operation: context.operation });

    // Categorize the error
    const category = this.categorizeError(error, context);
    
    // Get provider-specific error details
    const providerError = this.mapProviderError(error, context.provider);
    
    // Determine severity
    const severity = this.determineSeverity(category, providerError);
    
    // Get recovery strategy
    const recovery = this.getRecoveryStrategy(category, severity, context);
    
    // Generate diagnostic information
    const diagnostics = this.generateDiagnostics(error, context, category);
    
    // Record in history
    this.recordError({
      timestamp: new Date(),
      provider: context.provider,
      operation: context.operation,
      category,
      severity,
      errorCode: providerError?.code,
      message: this.getErrorMessage(error),
      context
    });
    
    // Detect patterns
    const pattern = this.detectErrorPattern(context.provider, category);
    
    const result: ErrorHandlingResult = {
      category,
      severity,
      isRetryable: this.isRetryable(category, severity),
      providerError,
      recovery,
      diagnostics,
      pattern,
      suggestedActions: this.getSuggestedActions(category, severity, context),
      userMessage: this.generateUserMessage(category, severity, context),
      shouldNotify: severity === 'critical' || pattern?.isRecurring
    };

    logger.info('Error handled', {
      category: result.category,
      severity: result.severity,
      retryable: result.isRetryable,
      pattern: result.pattern?.type
    });

    return result;
  }

  /**
   * Categorize error based on type and context
   */
  private categorizeError(error: any, context: ErrorContext): ErrorCategory {
    // Check for specific error types
    if (this.isNetworkError(error)) return 'network';
    if (this.isAuthenticationError(error)) return 'authentication';
    if (this.isRateLimitError(error)) return 'rate_limit';
    if (this.isValidationError(error)) return 'validation';
    if (this.isTimeoutError(error)) return 'timeout';
    if (this.isPermissionError(error)) return 'permission';
    if (this.isNotFoundError(error)) return 'not_found';
    if (this.isConflictError(error)) return 'conflict';
    if (this.isServerError(error)) return 'server_error';
    if (this.isMaintenanceError(error)) return 'maintenance';
    if (this.isDataIntegrityError(error)) return 'data_integrity';
    
    return 'unknown';
  }

  /**
   * Map provider-specific error
   */
  private mapProviderError(error: any, provider?: POSProvider): ProviderError | undefined {
    if (!provider) return undefined;

    const mapping = this.providerErrorMappings[provider];
    if (!mapping) return undefined;

    const errorCode = this.extractErrorCode(error);
    const providerSpecific = mapping[errorCode];

    if (providerSpecific) {
      return {
        code: errorCode,
        provider,
        ...providerSpecific
      };
    }

    // Try to extract generic provider error information
    return {
      code: errorCode || 'UNKNOWN',
      provider,
      message: this.getErrorMessage(error),
      retryable: false,
      category: 'unknown'
    };
  }

  /**
   * Determine error severity
   */
  private determineSeverity(category: ErrorCategory, providerError?: ProviderError): ErrorSeverity {
    // Provider-specific severity override
    if (providerError?.severity) {
      return providerError.severity;
    }

    // Category-based severity
    switch (category) {
      case 'authentication':
      case 'permission':
      case 'data_integrity':
        return 'critical';
      
      case 'server_error':
      case 'maintenance':
      case 'rate_limit':
        return 'high';
      
      case 'network':
      case 'timeout':
      case 'conflict':
        return 'medium';
      
      case 'validation':
      case 'not_found':
        return 'low';
      
      default:
        return 'medium';
    }
  }

  /**
   * Get recovery strategy
   */
  private getRecoveryStrategy(
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext
  ): RecoveryStrategy {
    const strategy: RecoveryStrategy = {
      actions: [],
      estimatedRecoveryTime: 0,
      requiresUserAction: false
    };

    switch (category) {
      case 'authentication':
        strategy.actions.push('refresh_token', 're_authenticate');
        strategy.requiresUserAction = true;
        strategy.estimatedRecoveryTime = 300000; // 5 minutes
        break;
      
      case 'rate_limit':
        strategy.actions.push('wait', 'reduce_frequency', 'use_batch_api');
        strategy.estimatedRecoveryTime = 60000; // 1 minute
        break;
      
      case 'network':
        strategy.actions.push('retry', 'check_connection', 'use_fallback');
        strategy.estimatedRecoveryTime = 30000; // 30 seconds
        break;
      
      case 'server_error':
        strategy.actions.push('retry', 'contact_support', 'use_fallback');
        strategy.estimatedRecoveryTime = 300000; // 5 minutes
        break;
      
      case 'validation':
        strategy.actions.push('fix_input', 'validate_data', 'check_schema');
        strategy.requiresUserAction = true;
        break;
      
      case 'maintenance':
        strategy.actions.push('wait', 'check_status_page', 'use_fallback');
        strategy.estimatedRecoveryTime = 3600000; // 1 hour
        break;
      
      default:
        strategy.actions.push('retry', 'log_error', 'contact_support');
        strategy.estimatedRecoveryTime = 60000; // 1 minute
    }

    return strategy;
  }

  /**
   * Generate diagnostics
   */
  private generateDiagnostics(
    error: any,
    context: ErrorContext,
    category: ErrorCategory
  ): ErrorDiagnostics {
    return {
      timestamp: new Date(),
      errorStack: error?.stack,
      requestId: context.requestId,
      provider: context.provider,
      operation: context.operation,
      category,
      httpStatus: this.extractHttpStatus(error),
      headers: this.extractHeaders(error),
      responseBody: this.extractResponseBody(error),
      metadata: {
        ...context.metadata,
        errorName: error?.name,
        errorMessage: this.getErrorMessage(error),
        errorCode: this.extractErrorCode(error)
      }
    };
  }

  /**
   * Detect error patterns
   */
  private detectErrorPattern(provider?: POSProvider, category?: ErrorCategory): ErrorPattern | undefined {
    const key = `${provider || 'unknown'}_${category || 'unknown'}`;
    const history = this.getRecentErrors(provider, category, 300000); // Last 5 minutes
    
    if (history.length >= 3) {
      const pattern: ErrorPattern = {
        type: 'recurring',
        count: history.length,
        timeWindow: 300000,
        firstOccurrence: history[0].timestamp,
        lastOccurrence: history[history.length - 1].timestamp,
        isRecurring: true,
        frequency: history.length / (300000 / 60000) // Per minute
      };
      
      this.errorPatterns.set(key, pattern);
      return pattern;
    }
    
    return this.errorPatterns.get(key);
  }

  /**
   * Get suggested actions
   */
  private getSuggestedActions(
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext
  ): string[] {
    const actions: string[] = [];

    // Category-specific actions
    switch (category) {
      case 'authentication':
        actions.push(
          'Check API credentials are valid',
          'Verify OAuth tokens are not expired',
          'Ensure proper scopes are granted',
          'Re-authenticate with the POS provider'
        );
        break;
      
      case 'rate_limit':
        actions.push(
          'Reduce API call frequency',
          'Implement request batching',
          'Check rate limit headers for reset time',
          'Consider upgrading API plan'
        );
        break;
      
      case 'network':
        actions.push(
          'Check network connectivity',
          'Verify firewall settings',
          'Try alternative network route',
          'Check DNS resolution'
        );
        break;
      
      case 'validation':
        actions.push(
          'Review request parameters',
          'Check data format and types',
          'Verify required fields are present',
          'Validate against API schema'
        );
        break;
      
      case 'server_error':
        actions.push(
          'Wait and retry the request',
          'Check provider status page',
          'Contact provider support',
          'Use fallback mechanism if available'
        );
        break;
    }

    // Severity-specific actions
    if (severity === 'critical') {
      actions.push('Notify system administrator immediately');
    }

    return actions;
  }

  /**
   * Generate user-friendly message
   */
  private generateUserMessage(
    category: ErrorCategory,
    severity: ErrorSeverity,
    context: ErrorContext
  ): string {
    const provider = context.provider || 'POS system';
    
    switch (category) {
      case 'authentication':
        return `Authentication with ${provider} failed. Please re-connect your account.`;
      
      case 'rate_limit':
        return `Too many requests to ${provider}. Please wait a moment and try again.`;
      
      case 'network':
        return `Unable to connect to ${provider}. Please check your internet connection.`;
      
      case 'validation':
        return `Invalid data sent to ${provider}. Please check your input and try again.`;
      
      case 'server_error':
        return `${provider} is experiencing issues. We'll retry automatically.`;
      
      case 'maintenance':
        return `${provider} is currently under maintenance. Please try again later.`;
      
      case 'permission':
        return `You don't have permission to perform this action in ${provider}.`;
      
      case 'not_found':
        return `The requested resource was not found in ${provider}.`;
      
      default:
        return `An error occurred with ${provider}. We're working on resolving it.`;
    }
  }

  // Error detection helper methods
  private isNetworkError(error: any): boolean {
    const networkCodes = ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EHOSTUNREACH'];
    return error?.code && networkCodes.includes(error.code);
  }

  private isAuthenticationError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 401 || status === 403 ||
           error?.code === 'INVALID_TOKEN' ||
           error?.message?.toLowerCase().includes('unauthorized');
  }

  private isRateLimitError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 429 ||
           error?.code === 'RATE_LIMIT_EXCEEDED' ||
           error?.message?.toLowerCase().includes('rate limit');
  }

  private isValidationError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 400 || status === 422 ||
           error?.code === 'VALIDATION_ERROR' ||
           error?.message?.toLowerCase().includes('validation');
  }

  private isTimeoutError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 408 || status === 504 ||
           error?.code === 'ETIMEDOUT' ||
           error?.message?.toLowerCase().includes('timeout');
  }

  private isPermissionError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 403 ||
           error?.code === 'PERMISSION_DENIED' ||
           error?.message?.toLowerCase().includes('permission');
  }

  private isNotFoundError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 404 ||
           error?.code === 'NOT_FOUND' ||
           error?.message?.toLowerCase().includes('not found');
  }

  private isConflictError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 409 ||
           error?.code === 'CONFLICT' ||
           error?.message?.toLowerCase().includes('conflict');
  }

  private isServerError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return (status >= 500 && status < 600) ||
           error?.code === 'INTERNAL_SERVER_ERROR';
  }

  private isMaintenanceError(error: any): boolean {
    const status = this.extractHttpStatus(error);
    return status === 503 ||
           error?.code === 'SERVICE_UNAVAILABLE' ||
           error?.message?.toLowerCase().includes('maintenance');
  }

  private isDataIntegrityError(error: any): boolean {
    return error?.code === 'DATA_INTEGRITY_ERROR' ||
           error?.message?.toLowerCase().includes('data integrity') ||
           error?.message?.toLowerCase().includes('constraint violation');
  }

  private isRetryable(category: ErrorCategory, severity: ErrorSeverity): boolean {
    const retryableCategories: ErrorCategory[] = [
      'network', 'timeout', 'rate_limit', 'server_error', 'maintenance'
    ];
    return retryableCategories.includes(category) && severity !== 'critical';
  }

  // Extraction helper methods
  private extractHttpStatus(error: any): number | undefined {
    return error?.response?.status || error?.status || error?.statusCode;
  }

  private extractHeaders(error: any): Record<string, string> | undefined {
    return error?.response?.headers || error?.headers;
  }

  private extractResponseBody(error: any): any {
    return error?.response?.data || error?.data || error?.body;
  }

  private extractErrorCode(error: any): string | undefined {
    return error?.code || 
           error?.response?.data?.code ||
           error?.response?.data?.error_code ||
           error?.response?.data?.errorCode;
  }

  private getErrorMessage(error: any): string {
    return error?.message ||
           error?.response?.data?.message ||
           error?.response?.data?.error ||
           error?.response?.statusText ||
           'Unknown error';
  }

  // History management
  private recordError(entry: ErrorHistoryEntry): void {
    this.errorHistory.push(entry);
    
    // Trim history if too large
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  private getRecentErrors(
    provider?: POSProvider,
    category?: ErrorCategory,
    timeWindowMs: number = 300000
  ): ErrorHistoryEntry[] {
    const cutoffTime = Date.now() - timeWindowMs;
    
    return this.errorHistory.filter(entry => {
      const matchesProvider = !provider || entry.provider === provider;
      const matchesCategory = !category || entry.category === category;
      const isRecent = entry.timestamp.getTime() > cutoffTime;
      
      return matchesProvider && matchesCategory && isRecent;
    });
  }

  /**
   * Initialize provider error mappings
   */
  private initializeProviderMappings(): ProviderErrorMappings {
    return {
      square: {
        'UNAUTHORIZED': { category: 'authentication', retryable: false, severity: 'critical' },
        'RATE_LIMITED': { category: 'rate_limit', retryable: true, severity: 'medium' },
        'NOT_FOUND': { category: 'not_found', retryable: false, severity: 'low' },
        'INTERNAL_SERVER_ERROR': { category: 'server_error', retryable: true, severity: 'high' }
      },
      shopify: {
        '401': { category: 'authentication', retryable: false, severity: 'critical' },
        '429': { category: 'rate_limit', retryable: true, severity: 'medium' },
        '404': { category: 'not_found', retryable: false, severity: 'low' },
        '500': { category: 'server_error', retryable: true, severity: 'high' }
      },
      zettle: {
        'INVALID_TOKEN': { category: 'authentication', retryable: false, severity: 'critical' },
        'RATE_LIMIT_EXCEEDED': { category: 'rate_limit', retryable: true, severity: 'medium' },
        'RESOURCE_NOT_FOUND': { category: 'not_found', retryable: false, severity: 'low' },
        'SERVICE_ERROR': { category: 'server_error', retryable: true, severity: 'high' }
      }
    };
  }

  /**
   * Initialize error patterns
   */
  private initializeErrorPatterns(): void {
    // Patterns will be detected dynamically
  }

  /**
   * Get error statistics
   */
  getStatistics(timeWindowMs: number = 3600000): ErrorStatistics {
    const recentErrors = this.getRecentErrors(undefined, undefined, timeWindowMs);
    
    const byCategory = new Map<ErrorCategory, number>();
    const byProvider = new Map<POSProvider, number>();
    const bySeverity = new Map<ErrorSeverity, number>();
    
    recentErrors.forEach(error => {
      byCategory.set(error.category, (byCategory.get(error.category) || 0) + 1);
      if (error.provider) {
        byProvider.set(error.provider, (byProvider.get(error.provider) || 0) + 1);
      }
      bySeverity.set(error.severity, (bySeverity.get(error.severity) || 0) + 1);
    });
    
    return {
      totalErrors: recentErrors.length,
      timeWindow: timeWindowMs,
      byCategory: Object.fromEntries(byCategory),
      byProvider: Object.fromEntries(byProvider),
      bySeverity: Object.fromEntries(bySeverity),
      patterns: Array.from(this.errorPatterns.values())
    };
  }
}

// Type definitions
export type ErrorCategory = 
  | 'network'
  | 'authentication'
  | 'rate_limit'
  | 'validation'
  | 'timeout'
  | 'permission'
  | 'not_found'
  | 'conflict'
  | 'server_error'
  | 'maintenance'
  | 'data_integrity'
  | 'unknown';

export type ErrorSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface ErrorContext {
  provider?: POSProvider;
  operation?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface ErrorHandlingResult {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  providerError?: ProviderError;
  recovery: RecoveryStrategy;
  diagnostics: ErrorDiagnostics;
  pattern?: ErrorPattern;
  suggestedActions: string[];
  userMessage: string;
  shouldNotify: boolean;
}

export interface ProviderError {
  code: string;
  provider: POSProvider;
  message?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  retryable?: boolean;
}

export interface RecoveryStrategy {
  actions: string[];
  estimatedRecoveryTime: number;
  requiresUserAction: boolean;
}

export interface ErrorDiagnostics {
  timestamp: Date;
  errorStack?: string;
  requestId?: string;
  provider?: POSProvider;
  operation?: string;
  category: ErrorCategory;
  httpStatus?: number;
  headers?: Record<string, string>;
  responseBody?: any;
  metadata: Record<string, any>;
}

export interface ErrorPattern {
  type: string;
  count: number;
  timeWindow: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  isRecurring: boolean;
  frequency: number;
}

export interface ErrorHistoryEntry {
  timestamp: Date;
  provider?: POSProvider;
  operation?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  errorCode?: string;
  message: string;
  context: ErrorContext;
}

export interface ErrorStatistics {
  totalErrors: number;
  timeWindow: number;
  byCategory: Record<string, number>;
  byProvider: Record<string, number>;
  bySeverity: Record<string, number>;
  patterns: ErrorPattern[];
}

type ProviderErrorMappings = Record<POSProvider, Record<string, Partial<ProviderError>>>;

// Export factory function
export function createPOSErrorHandler(): POSErrorHandler {
  return new POSErrorHandler();
}