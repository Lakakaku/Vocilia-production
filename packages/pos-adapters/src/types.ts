import { Transaction, POSProvider, WebhookEvent } from '@ai-feedback-platform/shared-types';

// Extended POS-specific types
export interface POSTransaction extends Transaction {
  externalId: string;
  posLocationId: string;
  paymentMethod?: string;
  taxAmount?: number;
  tipAmount?: number;
  metadata?: Record<string, unknown>;
}

export interface POSLocation {
  id: string;
  name: string;
  address?: {
    street?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  timezone?: string;
  phoneNumber?: string;
  businessName?: string;
  status?: 'active' | 'inactive';
  capabilities?: POSCapability[];
}

export type POSCapability = 'transactions' | 'webhooks' | 'inventory' | 'customers' | 'refunds';

export interface POSCredentials {
  provider: POSProvider;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  applicationId?: string;
  locationId?: string;
  webhookSigningSecret?: string;
  environment?: 'sandbox' | 'production';
}

export interface POSApiError {
  code: string;
  message: string;
  statusCode?: number;
  retryable?: boolean;
  originalError?: unknown;
}

export interface POSWebhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface POSConnectionStatus {
  connected: boolean;
  lastSync?: Date;
  capabilities: POSCapability[];
  locations: POSLocation[];
  error?: POSApiError;
}

// Search and filtering
export interface TransactionSearchOptions {
  locationId?: string;
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
  customerId?: string;
  limit?: number;
  cursor?: string;
}

export interface TransactionSearchResult {
  transactions: POSTransaction[];
  hasMore: boolean;
  cursor?: string;
  total?: number;
}

// OAuth flow types
export interface OAuthState {
  businessId: string;
  redirectUrl: string;
  nonce: string;
  expiresAt: Date;
}

export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType?: string;
  scope?: string;
}

export interface OAuthAuthorizationUrl {
  url: string;
  state: string;
}

// Webhook validation
export interface WebhookValidationResult {
  valid: boolean;
  event?: WebhookEvent;
  error?: string;
}