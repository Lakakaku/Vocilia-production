import {
  POSTransaction,
  POSLocation,
  POSCredentials,
  POSConnectionStatus,
  TransactionSearchOptions,
  TransactionSearchResult,
  OAuthState,
  OAuthTokenResponse,
  OAuthAuthorizationUrl,
  POSWebhook,
  WebhookValidationResult,
  POSCapability
} from '../types';
import { WebhookEvent, POSProvider } from '@ai-feedback-platform/shared-types';

/**
 * Universal POS Adapter Interface
 * 
 * This interface provides a standardized way to interact with different POS systems.
 * All POS adapters (Square, Shopify, Zettle) must implement this interface.
 */
export interface POSAdapter {
  readonly provider: POSProvider;
  readonly capabilities: POSCapability[];

  // Connection Management
  /**
   * Test the connection to the POS system
   */
  testConnection(credentials: POSCredentials): Promise<POSConnectionStatus>;

  /**
   * Initialize the adapter with credentials
   */
  initialize(credentials: POSCredentials): Promise<void>;

  /**
   * Check if the adapter is properly initialized
   */
  isInitialized(): boolean;

  // OAuth Flow
  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(redirectUri: string, scopes?: string[]): Promise<OAuthAuthorizationUrl>;

  /**
   * Exchange authorization code for access token
   */
  exchangeCodeForToken(code: string, state: string): Promise<OAuthTokenResponse>;

  /**
   * Refresh access token if supported
   */
  refreshToken(refreshToken: string): Promise<OAuthTokenResponse>;

  /**
   * Validate OAuth state parameter
   */
  validateState(state: string): Promise<OAuthState>;

  // Location Management
  /**
   * Get all locations for the connected merchant
   */
  getLocations(): Promise<POSLocation[]>;

  /**
   * Get specific location by ID
   */
  getLocation(locationId: string): Promise<POSLocation>;

  // Transaction Operations
  /**
   * Search for transactions
   */
  searchTransactions(options: TransactionSearchOptions): Promise<TransactionSearchResult>;

  /**
   * Get a specific transaction by ID
   */
  getTransaction(transactionId: string, locationId?: string): Promise<POSTransaction>;

  /**
   * Get transactions within a time window (for verification)
   */
  getTransactionsInTimeWindow(
    locationId: string,
    startTime: Date,
    endTime: Date
  ): Promise<POSTransaction[]>;

  /**
   * Find transaction matching criteria (amount, time tolerance)
   */
  findMatchingTransaction(
    locationId: string,
    amount: number,
    timestamp: Date,
    toleranceMinutes?: number
  ): Promise<POSTransaction | null>;

  // Webhook Management
  /**
   * Create a webhook subscription
   */
  createWebhook(webhook: Omit<POSWebhook, 'id' | 'createdAt' | 'updatedAt'>): Promise<POSWebhook>;

  /**
   * List all webhooks
   */
  listWebhooks(): Promise<POSWebhook[]>;

  /**
   * Update webhook configuration
   */
  updateWebhook(webhookId: string, updates: Partial<POSWebhook>): Promise<POSWebhook>;

  /**
   * Delete webhook subscription
   */
  deleteWebhook(webhookId: string): Promise<void>;

  /**
   * Validate webhook payload and signature
   */
  validateWebhook(
    payload: string,
    signature: string,
    secret: string
  ): Promise<WebhookValidationResult>;

  // Error Handling
  /**
   * Determine if an error is retryable
   */
  isRetryableError(error: unknown): boolean;

  /**
   * Get retry delay for failed requests
   */
  getRetryDelay(attemptNumber: number): number;

  // Utility Methods
  /**
   * Format transaction for internal use
   */
  formatTransaction(rawTransaction: unknown): POSTransaction;

  /**
   * Cleanup resources
   */
  disconnect(): Promise<void>;
}