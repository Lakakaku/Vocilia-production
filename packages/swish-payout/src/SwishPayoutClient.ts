/**
 * Swish Payout API Client
 * Handles batch payments to customers via Swish
 * 
 * Based on Swish Payout API documentation:
 * https://developer.swish.nu/api/payouts
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

interface SwishConfig {
  baseUrl: string;
  certificatePath: string;
  privateKeyPath: string;
  passphrase?: string;
  merchantId: string;
  environment: 'test' | 'production';
}

interface SwishPayoutRequest {
  payoutReference: string;
  payeeAlias: string; // Phone number in format +46XXXXXXXXX
  amount: string; // Amount in SEK (e.g., "100.50")
  currency: 'SEK';
  message?: string;
  payoutType: 'PAYOUT';
}

interface SwishPayoutResponse {
  id: string;
  status: 'CREATED' | 'PAID' | 'DECLINED' | 'ERROR';
  payoutReference: string;
  payeeAlias: string;
  amount: string;
  currency: string;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
  dateCreated: string;
  datePaid?: string;
}

interface BatchPayoutRequest {
  payments: Array<{
    reference: string;
    phoneNumber: string;
    amount: number;
    message?: string;
  }>;
  batchReference: string;
}

interface BatchPayoutResult {
  batchId: string;
  totalAmount: number;
  totalPayments: number;
  successfulPayments: number;
  failedPayments: number;
  results: Array<{
    reference: string;
    phoneNumber: string;
    amount: number;
    status: 'success' | 'failed';
    swishId?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
}

export class SwishPayoutClient {
  private client: AxiosInstance;
  private config: SwishConfig;

  constructor(config: SwishConfig) {
    this.config = config;
    this.client = this.createHttpsClient();
  }

  private createHttpsClient(): AxiosInstance {
    // Load SSL certificates
    const cert = fs.readFileSync(this.config.certificatePath);
    const key = fs.readFileSync(this.config.privateKeyPath);

    // Create HTTPS agent with client certificates
    const httpsAgent = new https.Agent({
      cert,
      key,
      passphrase: this.config.passphrase,
      rejectUnauthorized: this.config.environment === 'production'
    });

    return axios.create({
      baseURL: this.config.baseUrl,
      httpsAgent,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'AI-Feedback-Platform/1.0'
      },
      timeout: 30000, // 30 second timeout
      validateStatus: (status) => status < 500 // Don't throw on 4xx errors
    });
  }

  /**
   * Create a single payout to a customer
   */
  async createPayout(request: SwishPayoutRequest): Promise<SwishPayoutResponse> {
    try {
      console.log(`Creating Swish payout: ${request.payoutReference} -> ${request.payeeAlias} (${request.amount} SEK)`);

      const response = await this.client.post('/payouts', request);

      if (response.status !== 201) {
        throw new Error(`Swish API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      return response.data as SwishPayoutResponse;

    } catch (error) {
      console.error('Swish payout creation failed:', error);
      throw new Error(`Failed to create Swish payout: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check the status of a payout
   */
  async getPayoutStatus(payoutId: string): Promise<SwishPayoutResponse> {
    try {
      const response = await this.client.get(`/payouts/${payoutId}`);

      if (response.status !== 200) {
        throw new Error(`Swish API error: ${response.status} - ${JSON.stringify(response.data)}`);
      }

      return response.data as SwishPayoutResponse;

    } catch (error) {
      console.error('Swish payout status check failed:', error);
      throw new Error(`Failed to get Swish payout status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process batch payouts (sequential processing for reliability)
   */
  async processBatchPayouts(batch: BatchPayoutRequest): Promise<BatchPayoutResult> {
    console.log(`Processing batch payout: ${batch.batchReference} with ${batch.payments.length} payments`);

    const results: BatchPayoutResult['results'] = [];
    let successfulPayments = 0;
    let failedPayments = 0;
    let totalAmount = 0;

    // Process payments sequentially to avoid rate limiting
    for (const payment of batch.payments) {
      totalAmount += payment.amount;

      try {
        // Validate phone number format
        const formattedPhone = this.formatPhoneNumber(payment.phoneNumber);
        
        // Create payout request
        const payoutRequest: SwishPayoutRequest = {
          payoutReference: `${batch.batchReference}-${payment.reference}`,
          payeeAlias: formattedPhone,
          amount: payment.amount.toFixed(2),
          currency: 'SEK',
          message: payment.message || `Cashback från AI Feedback (${payment.reference})`,
          payoutType: 'PAYOUT'
        };

        const result = await this.createPayout(payoutRequest);

        // Wait for completion (Swish payouts are usually instant)
        const finalResult = await this.waitForPayoutCompletion(result.id, 30000); // 30 second timeout

        if (finalResult.status === 'PAID') {
          successfulPayments++;
          results.push({
            reference: payment.reference,
            phoneNumber: payment.phoneNumber,
            amount: payment.amount,
            status: 'success',
            swishId: finalResult.id
          });
        } else {
          failedPayments++;
          results.push({
            reference: payment.reference,
            phoneNumber: payment.phoneNumber,
            amount: payment.amount,
            status: 'failed',
            errorCode: finalResult.errorCode,
            errorMessage: finalResult.errorMessage || `Status: ${finalResult.status}`
          });
        }

        // Rate limiting: Wait 1 second between requests
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        failedPayments++;
        results.push({
          reference: payment.reference,
          phoneNumber: payment.phoneNumber,
          amount: payment.amount,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });

        console.error(`Payment failed for ${payment.reference}:`, error);
      }
    }

    const batchResult: BatchPayoutResult = {
      batchId: batch.batchReference,
      totalAmount,
      totalPayments: batch.payments.length,
      successfulPayments,
      failedPayments,
      results
    };

    console.log(`Batch payout completed: ${successfulPayments}/${batch.payments.length} successful`);
    return batchResult;
  }

  /**
   * Wait for payout to complete (PAID or DECLINED)
   */
  private async waitForPayoutCompletion(payoutId: string, timeoutMs: number = 30000): Promise<SwishPayoutResponse> {
    const startTime = Date.now();
    const pollingInterval = 2000; // 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getPayoutStatus(payoutId);

      if (status.status === 'PAID' || status.status === 'DECLINED' || status.status === 'ERROR') {
        return status;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollingInterval));
    }

    throw new Error(`Payout ${payoutId} did not complete within timeout`);
  }

  /**
   * Format phone number for Swish (must be +46XXXXXXXXX format)
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digits
    const cleaned = phoneNumber.replace(/\D/g, '');

    // Handle different Swedish phone number formats
    if (cleaned.startsWith('46') && cleaned.length === 11) {
      return '+' + cleaned; // Already in international format
    }

    if (cleaned.startsWith('0') && cleaned.length === 10) {
      return '+46' + cleaned.substring(1); // Remove leading 0 and add +46
    }

    if (cleaned.length === 9) {
      return '+46' + cleaned; // Add +46 prefix
    }

    throw new Error(`Invalid Swedish phone number format: ${phoneNumber}`);
  }

  /**
   * Validate configuration and test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to create a test payout with invalid data to check if connection works
      // (This should fail with a validation error, not a connection error)
      await this.createPayout({
        payoutReference: 'TEST-CONNECTION',
        payeeAlias: '+46700000000',
        amount: '0.01',
        currency: 'SEK',
        payoutType: 'PAYOUT'
      });

      return true;
    } catch (error) {
      // If we get a validation error, connection is working
      if (error instanceof Error && error.message.includes('validation')) {
        return true;
      }

      console.error('Swish connection test failed:', error);
      return false;
    }
  }
}

/**
 * Factory function to create Swish client from environment variables
 */
export function createSwishClient(): SwishPayoutClient {
  const config: SwishConfig = {
    baseUrl: process.env.SWISH_API_URL || 'https://mss.cpc.getswish.net/swish-cpcapi/api/v1',
    certificatePath: process.env.SWISH_CERT_PATH || '/certs/swish-client.crt',
    privateKeyPath: process.env.SWISH_KEY_PATH || '/certs/swish-client.key',
    passphrase: process.env.SWISH_CERT_PASSPHRASE,
    merchantId: process.env.SWISH_MERCHANT_ID || '',
    environment: (process.env.NODE_ENV === 'production' ? 'production' : 'test') as 'test' | 'production'
  };

  if (!config.merchantId) {
    throw new Error('SWISH_MERCHANT_ID environment variable is required');
  }

  if (!fs.existsSync(config.certificatePath)) {
    throw new Error(`Swish certificate not found at: ${config.certificatePath}`);
  }

  if (!fs.existsSync(config.privateKeyPath)) {
    throw new Error(`Swish private key not found at: ${config.privateKeyPath}`);
  }

  return new SwishPayoutClient(config);
}