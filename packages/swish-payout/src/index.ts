/**
 * Swish Payout Package
 * Handles customer cashback payments via Swish API
 */

export { SwishPayoutClient, createSwishClient } from './SwishPayoutClient';
export { PaymentProcessor } from './PaymentProcessor';

// Re-export types for convenience
export type {
  SwishPayoutRequest,
  SwishPayoutResponse,
  BatchPayoutRequest,
  BatchPayoutResult
} from './SwishPayoutClient';

// Configuration helper
export interface SwishPayoutConfig {
  enabled: boolean;
  testMode: boolean;
  merchantId: string;
  certificatePath: string;
  privateKeyPath: string;
  passphrase?: string;
  batchProcessingEnabled: boolean;
  maxBatchSize: number;
  retryAttempts: number;
}

export const defaultSwishConfig: SwishPayoutConfig = {
  enabled: process.env.SWISH_ENABLED === 'true',
  testMode: process.env.NODE_ENV !== 'production',
  merchantId: process.env.SWISH_MERCHANT_ID || '',
  certificatePath: process.env.SWISH_CERT_PATH || '/certs/swish-client.crt',
  privateKeyPath: process.env.SWISH_KEY_PATH || '/certs/swish-client.key',
  passphrase: process.env.SWISH_CERT_PASSPHRASE,
  batchProcessingEnabled: process.env.SWISH_BATCH_ENABLED === 'true',
  maxBatchSize: parseInt(process.env.SWISH_MAX_BATCH_SIZE || '100'),
  retryAttempts: parseInt(process.env.SWISH_RETRY_ATTEMPTS || '3')
};