import { EventEmitter } from 'events';
import { WebhookProcessingResult } from '@ai-feedback-platform/shared-types';

/**
 * Base Webhook Processor
 * 
 * Abstract base class for POS-specific webhook processors
 */
export abstract class WebhookProcessor extends EventEmitter {
  /**
   * Process incoming webhook
   */
  abstract processWebhook(
    rawBody: string,
    headers: Record<string, string>
  ): Promise<WebhookProcessingResult>;

  /**
   * Initialize webhooks
   */
  abstract initializeWebhooks(): Promise<void>;

  /**
   * Get webhook subscription status
   */
  abstract getSubscriptionStatus(): Promise<any>;

  /**
   * Update webhook subscription
   */
  abstract updateSubscription(
    subscriptionId: string,
    eventTypes: string[]
  ): Promise<any>;

  /**
   * Disable webhook subscription
   */
  abstract disableSubscription(subscriptionId: string): Promise<void>;
}