import { WebhookProcessor } from './WebhookProcessor';
import { ShopifyCredentials, ShopifyWebhookEvent, SHOPIFY_WEBHOOK_TOPICS } from '../adapters/shopify/types';
import { ShopifyAPIClient } from '../adapters/shopify/ShopifyAPIClient';
import { POSApiError } from '../base/BasePOSAdapter';
import { WebhookEvent, WebhookProcessingResult } from '@ai-feedback-platform/shared-types';
import { logger } from '../utils/logger';

/**
 * Shopify Webhook Processor
 * 
 * Handles incoming Shopify webhooks with:
 * - Signature verification
 * - Event processing for orders, refunds, products
 * - Multi-store webhook routing
 * - Event deduplication
 * - Error handling and retry logic
 */
export class ShopifyWebhookProcessor extends WebhookProcessor {
  private apiClients = new Map<string, ShopifyAPIClient>();
  private processedEvents = new Map<string, Date>();
  private readonly eventTTL = 24 * 60 * 60 * 1000; // 24 hours

  constructor(private config: {
    baseUrl: string;
    webhookPath: string;
    credentials?: ShopifyCredentials;
    multiStore?: boolean;
  }) {
    super();
    
    if (config.credentials) {
      this.apiClients.set(
        config.credentials.shopDomain,
        new ShopifyAPIClient(config.credentials)
      );
    }

    // Clean up old processed events periodically
    setInterval(() => this.cleanupProcessedEvents(), 60 * 60 * 1000); // Every hour
  }

  /**
   * Initialize webhooks for a shop
   */
  async initializeWebhooks(shopDomain?: string): Promise<void> {
    const client = shopDomain 
      ? this.apiClients.get(shopDomain)
      : Array.from(this.apiClients.values())[0];

    if (!client) {
      throw new POSApiError({
        code: 'NO_CLIENT',
        message: 'No Shopify API client configured'
      });
    }

    await client.initialize();

    const webhookUrl = `${this.config.baseUrl}${this.config.webhookPath}`;
    
    // Subscribe to essential webhook topics
    const topics = [
      ...SHOPIFY_WEBHOOK_TOPICS.ORDERS,
      ...SHOPIFY_WEBHOOK_TOPICS.REFUNDS,
      'app/uninstalled',
      'shop/update'
    ];

    const subscriptions = await client.subscribeToWebhooks(webhookUrl, topics);
    
    logger.info(`✅ Initialized ${subscriptions.length} Shopify webhooks for ${shopDomain || 'default shop'}`);
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookProcessingResult> {
    try {
      // Extract webhook metadata from headers
      const topic = headers['x-shopify-topic'];
      const shopDomain = headers['x-shopify-shop-domain'];
      const apiVersion = headers['x-shopify-api-version'];
      const webhookId = headers['x-shopify-webhook-id'];
      const hmac = headers['x-shopify-hmac-sha256'];

      if (!topic || !shopDomain || !hmac) {
        throw new POSApiError({
          code: 'MISSING_HEADERS',
          message: 'Required Shopify webhook headers missing'
        });
      }

      // Check for duplicate processing
      if (this.isDuplicateEvent(webhookId)) {
        logger.info(`⏭️ Skipping duplicate webhook: ${webhookId}`);
        return {
          success: true,
          eventId: webhookId,
          message: 'Duplicate event already processed'
        };
      }

      // Get the appropriate API client for the shop
      const client = await this.getOrCreateClient(shopDomain);

      // Verify webhook signature
      const isValid = client.verifyWebhookSignature(rawBody, hmac);
      if (!isValid) {
        throw new POSApiError({
          code: 'INVALID_SIGNATURE',
          message: 'Invalid webhook signature'
        });
      }

      // Parse webhook body
      const eventData = JSON.parse(rawBody);

      // Process based on topic
      const result = await this.processEventByTopic(topic, eventData, shopDomain);

      // Mark as processed
      this.markEventProcessed(webhookId);

      logger.info(`✅ Processed Shopify webhook: ${topic} from ${shopDomain}`);

      return {
        success: true,
        eventId: webhookId,
        data: result
      };

    } catch (error: any) {
      logger.error('❌ Shopify webhook processing error:', error);

      if (error.code === 'INVALID_SIGNATURE') {
        throw error; // Don't retry invalid signatures
      }

      return {
        success: false,
        error: error.message || 'Processing failed',
        retryable: this.isRetryableError(error)
      };
    }
  }

  /**
   * Process event based on topic
   */
  private async processEventByTopic(
    topic: string,
    eventData: any,
    shopDomain: string
  ): Promise<any> {
    const [resource, action] = topic.split('/');

    switch (resource) {
      case 'orders':
        return this.processOrderEvent(action, eventData, shopDomain);
      
      case 'refunds':
        return this.processRefundEvent(action, eventData, shopDomain);
      
      case 'products':
        return this.processProductEvent(action, eventData, shopDomain);
      
      case 'customers':
        return this.processCustomerEvent(action, eventData, shopDomain);
      
      case 'app':
        return this.processAppEvent(action, eventData, shopDomain);
      
      case 'shop':
        return this.processShopEvent(action, eventData, shopDomain);
      
      default:
        logger.warn(`Unhandled Shopify webhook topic: ${topic}`);
        return { acknowledged: true };
    }
  }

  /**
   * Process order events
   */
  private async processOrderEvent(action: string, orderData: any, shopDomain: string): Promise<any> {
    // Store order data for transaction verification
    const transactionData = {
      provider: 'shopify' as const,
      externalId: orderData.id.toString(),
      shopDomain,
      amount: parseFloat(orderData.total_price),
      currency: orderData.currency,
      status: orderData.financial_status,
      locationId: orderData.location_id?.toString(),
      orderNumber: orderData.order_number,
      customerEmail: orderData.email,
      createdAt: orderData.created_at,
      updatedAt: orderData.updated_at,
      lineItems: orderData.line_items,
      isInStore: orderData.source_name === 'pos' || orderData.location_id !== null
    };

    // Emit event for further processing
    await this.emit('order:' + action, transactionData);

    return transactionData;
  }

  /**
   * Process refund events
   */
  private async processRefundEvent(action: string, refundData: any, shopDomain: string): Promise<any> {
    const refundInfo = {
      provider: 'shopify' as const,
      refundId: refundData.id?.toString(),
      orderId: refundData.order_id?.toString(),
      shopDomain,
      amount: refundData.transactions?.reduce((sum: number, t: any) => 
        sum + parseFloat(t.amount), 0),
      createdAt: refundData.created_at,
      note: refundData.note,
      lineItems: refundData.refund_line_items
    };

    // Emit event for further processing
    await this.emit('refund:' + action, refundInfo);

    return refundInfo;
  }

  /**
   * Process product events
   */
  private async processProductEvent(action: string, productData: any, shopDomain: string): Promise<any> {
    const productInfo = {
      provider: 'shopify' as const,
      productId: productData.id?.toString(),
      shopDomain,
      title: productData.title,
      vendor: productData.vendor,
      productType: productData.product_type,
      tags: productData.tags,
      variants: productData.variants,
      updatedAt: productData.updated_at
    };

    await this.emit('product:' + action, productInfo);

    return productInfo;
  }

  /**
   * Process customer events
   */
  private async processCustomerEvent(action: string, customerData: any, shopDomain: string): Promise<any> {
    const customerInfo = {
      provider: 'shopify' as const,
      customerId: customerData.id?.toString(),
      shopDomain,
      email: customerData.email,
      firstName: customerData.first_name,
      lastName: customerData.last_name,
      totalSpent: parseFloat(customerData.total_spent || '0'),
      ordersCount: customerData.orders_count,
      createdAt: customerData.created_at,
      updatedAt: customerData.updated_at
    };

    await this.emit('customer:' + action, customerInfo);

    return customerInfo;
  }

  /**
   * Process app events
   */
  private async processAppEvent(action: string, appData: any, shopDomain: string): Promise<any> {
    if (action === 'uninstalled') {
      logger.warn(`⚠️ Shopify app uninstalled for shop: ${shopDomain}`);
      
      // Remove API client for this shop
      this.apiClients.delete(shopDomain);
      
      await this.emit('app:uninstalled', { shopDomain });
    }

    return { action, shopDomain };
  }

  /**
   * Process shop events
   */
  private async processShopEvent(action: string, shopData: any, shopDomain: string): Promise<any> {
    const shopInfo = {
      provider: 'shopify' as const,
      shopDomain,
      name: shopData.name,
      email: shopData.email,
      plan: shopData.plan_name,
      currency: shopData.currency,
      timezone: shopData.timezone,
      multiLocationEnabled: shopData.multi_location_enabled
    };

    await this.emit('shop:' + action, shopInfo);

    return shopInfo;
  }

  /**
   * Get or create API client for a shop
   */
  private async getOrCreateClient(shopDomain: string): Promise<ShopifyAPIClient> {
    let client = this.apiClients.get(shopDomain);
    
    if (!client) {
      // Try to load credentials from database or config
      const credentials = await this.loadShopCredentials(shopDomain);
      
      if (!credentials) {
        throw new POSApiError({
          code: 'NO_CREDENTIALS',
          message: `No credentials found for shop: ${shopDomain}`
        });
      }

      client = new ShopifyAPIClient(credentials);
      await client.initialize();
      this.apiClients.set(shopDomain, client);
    }

    return client;
  }

  /**
   * Load shop credentials from storage
   */
  private async loadShopCredentials(shopDomain: string): Promise<ShopifyCredentials | null> {
    // This would typically load from database
    // For now, return the default config if it matches
    if (this.config.credentials?.shopDomain === shopDomain) {
      return this.config.credentials;
    }

    // TODO: Implement database lookup
    return null;
  }

  /**
   * Check if event is duplicate
   */
  private isDuplicateEvent(eventId: string): boolean {
    return this.processedEvents.has(eventId);
  }

  /**
   * Mark event as processed
   */
  private markEventProcessed(eventId: string): void {
    this.processedEvents.set(eventId, new Date());
  }

  /**
   * Clean up old processed events
   */
  private cleanupProcessedEvents(): void {
    const now = Date.now();
    const expired: string[] = [];

    this.processedEvents.forEach((processedAt, eventId) => {
      if (now - processedAt.getTime() > this.eventTTL) {
        expired.push(eventId);
      }
    });

    expired.forEach(eventId => this.processedEvents.delete(eventId));
    
    if (expired.length > 0) {
      logger.info(`🧹 Cleaned up ${expired.length} expired webhook events`);
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    if (error.code === 'INVALID_SIGNATURE' || error.code === 'MISSING_HEADERS') {
      return false;
    }

    if (error.response?.status) {
      const status = error.response.status;
      return status >= 500 || status === 429;
    }

    return true;
  }

  /**
   * Get webhook subscription status
   */
  async getSubscriptionStatus(shopDomain?: string): Promise<any> {
    const statuses = [];

    for (const [domain, client] of this.apiClients.entries()) {
      if (shopDomain && domain !== shopDomain) continue;

      try {
        const webhooks = await client.listWebhooks();
        
        statuses.push({
          shopDomain: domain,
          subscriptions: webhooks.map(w => ({
            id: w.id,
            topic: w.topic,
            address: w.address,
            createdAt: w.created_at,
            updatedAt: w.updated_at
          })),
          totalSubscriptions: webhooks.length,
          active: true
        });
      } catch (error) {
        statuses.push({
          shopDomain: domain,
          error: error instanceof Error ? error.message : 'Failed to get webhook status',
          active: false
        });
      }
    }

    return shopDomain ? statuses[0] : statuses;
  }

  /**
   * Update webhook subscriptions
   */
  async updateSubscription(webhookId: string, eventTypes: string[], shopDomain?: string): Promise<any> {
    const client = shopDomain 
      ? this.apiClients.get(shopDomain)
      : Array.from(this.apiClients.values())[0];

    if (!client) {
      throw new POSApiError({
        code: 'NO_CLIENT',
        message: 'No Shopify API client configured'
      });
    }

    // Shopify doesn't support updating topics, so we need to delete and recreate
    await client.deleteWebhook(webhookId);
    
    const webhookUrl = `${this.config.baseUrl}${this.config.webhookPath}`;
    const newWebhook = await client.createWebhook(eventTypes[0], webhookUrl);

    return newWebhook;
  }

  /**
   * Disable webhook subscription
   */
  async disableSubscription(webhookId: string, shopDomain?: string): Promise<void> {
    const client = shopDomain 
      ? this.apiClients.get(shopDomain)
      : Array.from(this.apiClients.values())[0];

    if (!client) {
      throw new POSApiError({
        code: 'NO_CLIENT',
        message: 'No Shopify API client configured'
      });
    }

    await client.deleteWebhook(webhookId);
  }
}