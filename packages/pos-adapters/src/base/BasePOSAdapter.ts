import { POSAdapter } from '../interfaces/POSAdapter';
import {
  POSCredentials,
  POSApiError,
  OAuthState,
  POSCapability
} from '../types';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

/**
 * Base POS Adapter Class
 * 
 * Provides common functionality for all POS adapters including:
 * - Credential management
 * - Error handling
 * - Retry logic
 * - OAuth state management
 */
export abstract class BasePOSAdapter implements Partial<POSAdapter> {
  protected credentials?: POSCredentials;
  protected initialized = false;
  protected oauthStates = new Map<string, OAuthState>();

  constructor(
    public readonly provider: POSProvider,
    public readonly capabilities: POSCapability[] = []
  ) {}

  /**
   * Initialize the adapter with credentials
   */
  async initialize(credentials: POSCredentials): Promise<void> {
    this.validateCredentials(credentials);
    this.credentials = credentials;
    await this.validateConnection();
    this.initialized = true;
  }

  /**
   * Check if the adapter is properly initialized
   */
  isInitialized(): boolean {
    return this.initialized && !!this.credentials;
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    this.credentials = undefined;
    this.initialized = false;
    this.oauthStates.clear();
  }

  // OAuth State Management
  /**
   * Generate OAuth state parameter
   */
  protected generateOAuthState(businessId: string, redirectUrl: string): string {
    const state = uuidv4();
    const nonce = this.generateNonce();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    this.oauthStates.set(state, {
      businessId,
      redirectUrl,
      nonce,
      expiresAt
    });

    return state;
  }

  /**
   * Validate OAuth state parameter
   */
  async validateState(state: string): Promise<OAuthState> {
    const oauthState = this.oauthStates.get(state);
    
    if (!oauthState) {
      throw new POSApiError({
        code: 'INVALID_STATE',
        message: 'Invalid or expired OAuth state parameter'
      });
    }

    if (oauthState.expiresAt < new Date()) {
      this.oauthStates.delete(state);
      throw new POSApiError({
        code: 'EXPIRED_STATE',
        message: 'OAuth state parameter has expired'
      });
    }

    return oauthState;
  }

  /**
   * Clean up expired OAuth states
   */
  protected cleanupExpiredStates(): void {
    const now = new Date();
    for (const [state, oauthState] of this.oauthStates.entries()) {
      if (oauthState.expiresAt < now) {
        this.oauthStates.delete(state);
      }
    }
  }

  // Error Handling
  /**
   * Determine if an error is retryable
   */
  isRetryableError(error: unknown): boolean {
    if (error instanceof POSApiError) {
      return error.retryable === true;
    }

    // Network errors are generally retryable
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as any).code;
      return ['ENOTFOUND', 'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED'].includes(code);
    }

    // HTTP status codes that are retryable
    if (error && typeof error === 'object' && 'status' in error) {
      const status = (error as any).status;
      return [408, 429, 500, 502, 503, 504].includes(status);
    }

    return false;
  }

  /**
   * Get retry delay with exponential backoff
   */
  getRetryDelay(attemptNumber: number): number {
    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attemptNumber - 1), maxDelay);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    return delay + jitter;
  }

  /**
   * Execute a function with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxAttempts || !this.isRetryableError(error)) {
          throw error;
        }

        const delay = this.getRetryDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  // Utility Methods
  /**
   * Generate a secure nonce
   */
  protected generateNonce(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Sleep for specified milliseconds
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate credentials structure
   */
  protected validateCredentials(credentials: POSCredentials): void {
    if (!credentials.provider) {
      throw new POSApiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Provider is required'
      });
    }

    if (credentials.provider !== this.provider) {
      throw new POSApiError({
        code: 'INVALID_PROVIDER',
        message: `Expected provider ${this.provider}, got ${credentials.provider}`
      });
    }

    if (!credentials.accessToken) {
      throw new POSApiError({
        code: 'INVALID_CREDENTIALS',
        message: 'Access token is required'
      });
    }
  }

  /**
   * Abstract method to validate connection - must be implemented by subclasses
   */
  protected abstract validateConnection(): Promise<void>;

  /**
   * Find transaction within time tolerance
   */
  protected findTransactionByAmountAndTime(
    transactions: any[],
    amount: number,
    timestamp: Date,
    toleranceMinutes: number = 2
  ): any | null {
    const targetTime = timestamp.getTime();
    const tolerance = toleranceMinutes * 60 * 1000;

    return transactions.find(tx => {
      const txTime = new Date(tx.timestamp || tx.created_at || tx.createdAt).getTime();
      const timeDiff = Math.abs(txTime - targetTime);
      
      // Check amount match (allow small rounding differences)
      const amountDiff = Math.abs((tx.amount || tx.total) - amount);
      const amountTolerance = Math.max(1, amount * 0.01); // 1% or minimum 1 currency unit

      return timeDiff <= tolerance && amountDiff <= amountTolerance;
    });
  }

  /**
   * Normalize currency amount to cents/öre
   */
  protected normalizeCurrencyAmount(amount: number, currencyUnit: 'major' | 'minor' = 'minor'): number {
    if (currencyUnit === 'major') {
      return Math.round(amount * 100); // Convert SEK to öre
    }
    return Math.round(amount); // Already in minor units
  }
}

// Custom error class for POS API errors
export class POSApiError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly retryable?: boolean;
  public readonly originalError?: unknown;

  constructor(options: {
    code: string;
    message: string;
    statusCode?: number;
    retryable?: boolean;
    originalError?: unknown;
  }) {
    super(options.message);
    this.name = 'POSApiError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable;
    this.originalError = options.originalError;
  }
}