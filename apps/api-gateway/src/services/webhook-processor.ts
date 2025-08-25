import { POSProvider } from '@ai-feedback-platform/shared-types';
import { logger } from '../utils/logger';
import { db } from '@ai-feedback/database';
import crypto from 'crypto';

export interface WebhookProcessingResult {
  success: boolean;
  error?: string;
  data?: any;
}

export class WebhookProcessor {
  
  async validateSignature(provider: POSProvider, payload: any, signature: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'square':
          return this.validateSquareSignature(payload, signature);
        case 'shopify':
          return this.validateShopifySignature(payload, signature);
        case 'zettle':
          return this.validateZettleSignature(payload, signature);
        default:
          return false;
      }
    } catch (error) {
      logger.error(`Signature validation error for ${provider}:`, error);
      return false;
    }
  }

  private validateSquareSignature(payload: any, signature: string): boolean {
    const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (!webhookSignatureKey) {
      logger.warn('Square webhook signature key not configured');
      return false;
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha1', webhookSignatureKey)
      .update(payloadString)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private validateShopifySignature(payload: any, signature: string): boolean {
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('Shopify webhook secret not configured');
      return false;
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  private validateZettleSignature(payload: any, signature: string): boolean {
    const webhookSecret = process.env.ZETTLE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      logger.warn('Zettle webhook secret not configured');
      return false;
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  async processSquareWebhook(webhookEvent: any): Promise<WebhookProcessingResult> {
    try {
      const eventType = webhookEvent.type;
      const eventData = webhookEvent.data;

      logger.info(`Processing Square webhook: ${eventType}`);

      switch (eventType) {
        case 'payment.created':
        case 'payment.updated':
          return await this.processSquarePayment(eventData);
        
        case 'refund.created':
        case 'refund.updated':
          return await this.processSquareRefund(eventData);
        
        case 'order.created':
        case 'order.updated':
          return await this.processSquareOrder(eventData);
        
        case 'location.created':
        case 'location.updated':
          return await this.processSquareLocation(eventData);
        
        default:
          logger.info(`Unhandled Square webhook event: ${eventType}`);
          return { success: true, data: { message: 'Event acknowledged but not processed' } };
      }
    } catch (error) {
      logger.error('Square webhook processing error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async processShopifyWebhook(webhookEvent: any, topic: string): Promise<WebhookProcessingResult> {
    try {
      logger.info(`Processing Shopify webhook: ${topic}`);

      switch (topic) {
        case 'orders/create':
        case 'orders/updated':
        case 'orders/paid':
          return await this.processShopifyOrder(webhookEvent);
        
        case 'orders/refund':
        case 'refunds/create':
          return await this.processShopifyRefund(webhookEvent);
        
        case 'app/uninstalled':
          return await this.processShopifyAppUninstalled(webhookEvent);
        
        case 'shop/update':
          return await this.processShopifyShopUpdate(webhookEvent);
        
        default:
          logger.info(`Unhandled Shopify webhook topic: ${topic}`);
          return { success: true, data: { message: 'Event acknowledged but not processed' } };
      }
    } catch (error) {
      logger.error('Shopify webhook processing error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  async processZettleWebhook(webhookEvent: any): Promise<WebhookProcessingResult> {
    try {
      const eventType = webhookEvent.eventType;
      const payload = webhookEvent.payload;

      logger.info(`Processing Zettle webhook: ${eventType}`);

      switch (eventType) {
        case 'PurchaseCreated':
        case 'PurchaseUpdated':
          return await this.processZettlePurchase(payload);
        
        case 'RefundCreated':
          return await this.processZettleRefund(payload);
        
        case 'ProductCreated':
        case 'ProductUpdated':
        case 'ProductDeleted':
          return await this.processZettleProduct(payload);
        
        default:
          logger.info(`Unhandled Zettle webhook event: ${eventType}`);
          return { success: true, data: { message: 'Event acknowledged but not processed' } };
      }
    } catch (error) {
      logger.error('Zettle webhook processing error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Square event processors
  private async processSquarePayment(paymentData: any): Promise<WebhookProcessingResult> {
    try {
      const payment = paymentData.object.payment;
      
      // Store payment information for transaction verification
      await this.storeTransactionData('square', {
        external_id: payment.id,
        amount: payment.amount_money?.amount / 100, // Convert from cents
        currency: payment.amount_money?.currency,
        status: payment.status,
        location_id: payment.location_id,
        order_id: payment.order_id,
        created_at: payment.created_at,
        updated_at: payment.updated_at
      });

      return { success: true, data: { paymentId: payment.id } };
    } catch (error) {
      return { success: false, error: `Payment processing failed: ${error}` };
    }
  }

  private async processSquareRefund(refundData: any): Promise<WebhookProcessingResult> {
    try {
      const refund = refundData.object.refund;
      
      // Update transaction data with refund information
      await this.updateTransactionRefund('square', refund.payment_id, {
        refund_id: refund.id,
        refund_amount: refund.amount_money?.amount / 100,
        refund_status: refund.status,
        refund_created_at: refund.created_at
      });

      return { success: true, data: { refundId: refund.id } };
    } catch (error) {
      return { success: false, error: `Refund processing failed: ${error}` };
    }
  }

  private async processSquareOrder(orderData: any): Promise<WebhookProcessingResult> {
    try {
      const order = orderData.object.order;
      
      // Store order information
      await this.storeOrderData('square', {
        external_id: order.id,
        location_id: order.location_id,
        total_money: order.total_money?.amount / 100,
        state: order.state,
        line_items: order.line_items,
        created_at: order.created_at,
        updated_at: order.updated_at
      });

      return { success: true, data: { orderId: order.id } };
    } catch (error) {
      return { success: false, error: `Order processing failed: ${error}` };
    }
  }

  private async processSquareLocation(locationData: any): Promise<WebhookProcessingResult> {
    try {
      const location = locationData.object.location;
      
      // Update location information
      await this.updateLocationData('square', {
        external_id: location.id,
        name: location.name,
        address: location.address,
        status: location.status,
        merchant_id: location.merchant_id
      });

      return { success: true, data: { locationId: location.id } };
    } catch (error) {
      return { success: false, error: `Location processing failed: ${error}` };
    }
  }

  // Shopify event processors
  private async processShopifyOrder(orderData: any): Promise<WebhookProcessingResult> {
    try {
      // Store order/transaction information
      await this.storeTransactionData('shopify', {
        external_id: orderData.id.toString(),
        amount: parseFloat(orderData.total_price),
        currency: orderData.currency,
        status: orderData.financial_status,
        order_number: orderData.order_number,
        created_at: orderData.created_at,
        updated_at: orderData.updated_at,
        customer_id: orderData.customer?.id?.toString()
      });

      return { success: true, data: { orderId: orderData.id } };
    } catch (error) {
      return { success: false, error: `Shopify order processing failed: ${error}` };
    }
  }

  private async processShopifyRefund(refundData: any): Promise<WebhookProcessingResult> {
    try {
      const orderId = refundData.order_id?.toString();
      
      // Update transaction with refund information
      await this.updateTransactionRefund('shopify', orderId, {
        refund_id: refundData.id?.toString(),
        refund_amount: parseFloat(refundData.amount || '0'),
        refund_created_at: refundData.created_at
      });

      return { success: true, data: { refundId: refundData.id } };
    } catch (error) {
      return { success: false, error: `Shopify refund processing failed: ${error}` };
    }
  }

  private async processShopifyAppUninstalled(shopData: any): Promise<WebhookProcessingResult> {
    try {
      const shopDomain = shopData.domain;
      
      // Deactivate credentials for this shop
      await db.client
        .from('pos_credentials')
        .update({ 
          is_active: false,
          deactivated_at: new Date().toISOString()
        })
        .eq('provider', 'shopify')
        .eq('shop_domain', shopDomain);

      logger.info(`Shopify app uninstalled for shop: ${shopDomain}`);
      return { success: true, data: { shop: shopDomain } };
    } catch (error) {
      return { success: false, error: `App uninstall processing failed: ${error}` };
    }
  }

  private async processShopifyShopUpdate(shopData: any): Promise<WebhookProcessingResult> {
    try {
      // Update shop information
      await this.updateLocationData('shopify', {
        external_id: shopData.id?.toString(),
        name: shopData.name,
        domain: shopData.domain,
        email: shopData.email,
        plan: shopData.plan_name
      });

      return { success: true, data: { shopId: shopData.id } };
    } catch (error) {
      return { success: false, error: `Shop update processing failed: ${error}` };
    }
  }

  // Zettle event processors
  private async processZettlePurchase(purchaseData: any): Promise<WebhookProcessingResult> {
    try {
      // Store purchase/transaction information
      await this.storeTransactionData('zettle', {
        external_id: purchaseData.uuid,
        amount: purchaseData.amount / 100, // Convert from cents
        currency: purchaseData.currency,
        status: 'completed', // Zettle purchases are typically completed
        created_at: purchaseData.timestamp,
        location_id: purchaseData.organizationUuid,
        payment_method: purchaseData.paymentType
      });

      return { success: true, data: { purchaseId: purchaseData.uuid } };
    } catch (error) {
      return { success: false, error: `Zettle purchase processing failed: ${error}` };
    }
  }

  private async processZettleRefund(refundData: any): Promise<WebhookProcessingResult> {
    try {
      const originalPurchaseId = refundData.originalTransactionUuid;
      
      // Update transaction with refund information
      await this.updateTransactionRefund('zettle', originalPurchaseId, {
        refund_id: refundData.uuid,
        refund_amount: refundData.refundedAmount / 100,
        refund_created_at: refundData.timestamp
      });

      return { success: true, data: { refundId: refundData.uuid } };
    } catch (error) {
      return { success: false, error: `Zettle refund processing failed: ${error}` };
    }
  }

  private async processZettleProduct(productData: any): Promise<WebhookProcessingResult> {
    try {
      // Store/update product information (if needed for analytics)
      logger.info(`Zettle product event: ${productData.uuid}`);
      return { success: true, data: { productId: productData.uuid } };
    } catch (error) {
      return { success: false, error: `Zettle product processing failed: ${error}` };
    }
  }

  // Helper methods for data storage
  private async storeTransactionData(provider: POSProvider, transactionData: any): Promise<void> {
    try {
      await db.client
        .from('pos_transactions')
        .upsert({
          provider,
          external_id: transactionData.external_id,
          amount: transactionData.amount,
          currency: transactionData.currency,
          status: transactionData.status,
          location_id: transactionData.location_id,
          order_id: transactionData.order_id,
          customer_id: transactionData.customer_id,
          payment_method: transactionData.payment_method,
          created_at: transactionData.created_at,
          updated_at: transactionData.updated_at || new Date().toISOString(),
          webhook_processed_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error storing transaction data:', error);
      throw error;
    }
  }

  private async updateTransactionRefund(provider: POSProvider, transactionId: string, refundData: any): Promise<void> {
    try {
      await db.client
        .from('pos_transactions')
        .update({
          refund_id: refundData.refund_id,
          refund_amount: refundData.refund_amount,
          refund_status: refundData.refund_status || 'completed',
          refund_created_at: refundData.refund_created_at,
          updated_at: new Date().toISOString()
        })
        .eq('provider', provider)
        .eq('external_id', transactionId);
    } catch (error) {
      logger.error('Error updating transaction refund:', error);
      throw error;
    }
  }

  private async storeOrderData(provider: POSProvider, orderData: any): Promise<void> {
    try {
      await db.client
        .from('pos_orders')
        .upsert({
          provider,
          external_id: orderData.external_id,
          location_id: orderData.location_id,
          total_money: orderData.total_money,
          state: orderData.state,
          line_items: orderData.line_items,
          created_at: orderData.created_at,
          updated_at: orderData.updated_at || new Date().toISOString(),
          webhook_processed_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error storing order data:', error);
      throw error;
    }
  }

  private async updateLocationData(provider: POSProvider, locationData: any): Promise<void> {
    try {
      await db.client
        .from('pos_locations')
        .upsert({
          provider,
          external_id: locationData.external_id,
          name: locationData.name,
          address: locationData.address,
          status: locationData.status,
          merchant_id: locationData.merchant_id,
          domain: locationData.domain,
          email: locationData.email,
          plan: locationData.plan,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error updating location data:', error);
      throw error;
    }
  }

  async retryWebhookDelivery(delivery: any): Promise<WebhookProcessingResult> {
    try {
      const { provider, event_type, payload } = delivery;
      
      // Parse the original payload
      const webhookEvent = JSON.parse(payload);
      
      // Process based on provider
      switch (provider) {
        case 'square':
          return await this.processSquareWebhook(webhookEvent);
        case 'shopify':
          return await this.processShopifyWebhook(webhookEvent, event_type);
        case 'zettle':
          return await this.processZettleWebhook(webhookEvent);
        default:
          return { success: false, error: 'Unsupported provider for retry' };
      }
    } catch (error) {
      logger.error('Webhook retry processing error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}