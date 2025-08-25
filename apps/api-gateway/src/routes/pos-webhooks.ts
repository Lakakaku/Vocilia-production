import { Router, type Request, type Response } from 'express';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { POSMetricsCollector } from '../services/pos-metrics-collector';
import { WebhookProcessor } from '../services/webhook-processor';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { db } from '@ai-feedback/database';

const router = Router();
const metricsCollector = new POSMetricsCollector();
const webhookProcessor = new WebhookProcessor();

// Middleware to validate webhook signatures
const validateWebhookSignature = (provider: POSProvider) => {
  return async (req: Request, res: Response, next: any) => {
    try {
      const signature = req.headers['x-webhook-signature'] || 
                       req.headers['x-square-signature'] ||
                       req.headers['x-shopify-hmac-sha256'] ||
                       req.headers['x-zettle-signature'] as string;
      
      const payload = req.body;
      
      if (!signature) {
        return res.status(401).json({ error: 'Missing webhook signature' });
      }

      const isValid = await webhookProcessor.validateSignature(provider, payload, signature);
      
      if (!isValid) {
        logger.warn(`Invalid webhook signature for ${provider}`);
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      next();
    } catch (error) {
      logger.error(`Webhook signature validation error for ${provider}:`, error);
      res.status(500).json({ error: 'Signature validation failed' });
    }
  };
};

// Square webhook endpoint
router.post('/square', validateWebhookSignature('square'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const webhookEvent = req.body;
    
    logger.info('Received Square webhook:', {
      type: webhookEvent.type,
      id: webhookEvent.data?.id
    });

    // Process webhook
    const result = await webhookProcessor.processSquareWebhook(webhookEvent);
    
    const processingTime = Date.now() - startTime;
    
    // Record metrics
    metricsCollector.recordWebhookDelivery(
      'square',
      webhookEvent.type || 'unknown',
      result.success,
      processingTime
    );

    // Log webhook delivery
    await logWebhookDelivery(req, 'square', result.success, processingTime);

    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        processingTime: `${processingTime}ms`
      });
    } else {
      res.status(422).json({ 
        success: false, 
        error: result.error,
        processingTime: `${processingTime}ms`
      });
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Square webhook processing error:', error);
    
    metricsCollector.recordWebhookDelivery(
      'square',
      'error',
      false,
      processingTime
    );

    await logWebhookDelivery(req, 'square', false, processingTime, error);

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      processingTime: `${processingTime}ms`
    });
  }
});

// Shopify webhook endpoint
router.post('/shopify', validateWebhookSignature('shopify'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const webhookEvent = req.body;
    const topic = req.headers['x-shopify-topic'] as string;
    
    logger.info('Received Shopify webhook:', {
      topic,
      shop: req.headers['x-shopify-shop-domain']
    });

    // Process webhook
    const result = await webhookProcessor.processShopifyWebhook(webhookEvent, topic);
    
    const processingTime = Date.now() - startTime;
    
    // Record metrics
    metricsCollector.recordWebhookDelivery(
      'shopify',
      topic || 'unknown',
      result.success,
      processingTime
    );

    // Log webhook delivery
    await logWebhookDelivery(req, 'shopify', result.success, processingTime);

    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        processingTime: `${processingTime}ms`
      });
    } else {
      res.status(422).json({ 
        success: false, 
        error: result.error,
        processingTime: `${processingTime}ms`
      });
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Shopify webhook processing error:', error);
    
    metricsCollector.recordWebhookDelivery(
      'shopify',
      'error',
      false,
      processingTime
    );

    await logWebhookDelivery(req, 'shopify', false, processingTime, error);

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      processingTime: `${processingTime}ms`
    });
  }
});

// Zettle webhook endpoint
router.post('/zettle', validateWebhookSignature('zettle'), async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const webhookEvent = req.body;
    
    logger.info('Received Zettle webhook:', {
      type: webhookEvent.eventType,
      id: webhookEvent.payload?.uuid
    });

    // Process webhook
    const result = await webhookProcessor.processZettleWebhook(webhookEvent);
    
    const processingTime = Date.now() - startTime;
    
    // Record metrics
    metricsCollector.recordWebhookDelivery(
      'zettle',
      webhookEvent.eventType || 'unknown',
      result.success,
      processingTime
    );

    // Log webhook delivery
    await logWebhookDelivery(req, 'zettle', result.success, processingTime);

    if (result.success) {
      res.status(200).json({ 
        success: true, 
        message: 'Webhook processed successfully',
        processingTime: `${processingTime}ms`
      });
    } else {
      res.status(422).json({ 
        success: false, 
        error: result.error,
        processingTime: `${processingTime}ms`
      });
    }
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Zettle webhook processing error:', error);
    
    metricsCollector.recordWebhookDelivery(
      'zettle',
      'error',
      false,
      processingTime
    );

    await logWebhookDelivery(req, 'zettle', false, processingTime, error);

    res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      processingTime: `${processingTime}ms`
    });
  }
});

// Webhook retry endpoint (for failed deliveries)
router.post('/retry/:provider/:deliveryId', async (req: Request, res: Response) => {
  try {
    const { provider, deliveryId } = req.params;
    
    if (!['square', 'shopify', 'zettle'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Get failed webhook delivery
    const { data: delivery } = await db.client
      .from('webhook_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .eq('provider', provider)
      .eq('status', 'failed')
      .single();

    if (!delivery) {
      return res.status(404).json({ error: 'Webhook delivery not found' });
    }

    // Retry processing
    const startTime = Date.now();
    const result = await webhookProcessor.retryWebhookDelivery(delivery);
    const processingTime = Date.now() - startTime;

    // Record retry metrics
    metricsCollector.recordWebhookDelivery(
      provider as POSProvider,
      delivery.event_type,
      result.success,
      processingTime,
      delivery.retry_count + 1
    );

    // Update delivery record
    await db.client
      .from('webhook_deliveries')
      .update({
        status: result.success ? 'success' : 'failed',
        retry_count: delivery.retry_count + 1,
        last_retry_at: new Date().toISOString(),
        error_message: result.success ? null : result.error,
        processing_time: processingTime
      })
      .eq('id', deliveryId);

    res.json({
      success: result.success,
      message: result.success ? 'Webhook retry successful' : 'Webhook retry failed',
      error: result.error,
      processingTime: `${processingTime}ms`
    });
  } catch (error) {
    logger.error('Webhook retry error:', error);
    res.status(500).json({ error: 'Retry failed' });
  }
});

// Webhook delivery status endpoint
router.get('/deliveries/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { limit = 50, offset = 0, status } = req.query;
    
    let query = db.client
      .from('webhook_deliveries')
      .select('*')
      .eq('provider', provider)
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: deliveries, error } = await query;

    if (error) {
      throw error;
    }

    // Get summary stats
    const { data: summary } = await db.client
      .from('webhook_deliveries')
      .select('status')
      .eq('provider', provider)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const totalDeliveries = summary?.length || 0;
    const successfulDeliveries = summary?.filter(d => d.status === 'success').length || 0;
    const failedDeliveries = summary?.filter(d => d.status === 'failed').length || 0;

    res.json({
      success: true,
      provider,
      deliveries: deliveries || [],
      summary: {
        total: totalDeliveries,
        successful: successfulDeliveries,
        failed: failedDeliveries,
        successRate: totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 0
      }
    });
  } catch (error) {
    logger.error('Error getting webhook deliveries:', error);
    res.status(500).json({ error: 'Failed to get webhook deliveries' });
  }
});

// Health check endpoint for webhooks
router.get('/health', async (req: Request, res: Response) => {
  try {
    const providers: POSProvider[] = ['square', 'shopify', 'zettle'];
    const healthStatus: Record<string, any> = {};

    for (const provider of providers) {
      const { data: recentDeliveries } = await db.client
        .from('webhook_deliveries')
        .select('status, processing_time')
        .eq('provider', provider)
        .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

      const total = recentDeliveries?.length || 0;
      const successful = recentDeliveries?.filter(d => d.status === 'success').length || 0;
      const avgProcessingTime = recentDeliveries?.length 
        ? recentDeliveries.reduce((sum, d) => sum + (d.processing_time || 0), 0) / recentDeliveries.length 
        : 0;

      healthStatus[provider] = {
        healthy: total === 0 || (successful / total) > 0.95,
        successRate: total > 0 ? Math.round((successful / total) * 100) : 100,
        totalDeliveries: total,
        averageProcessingTime: Math.round(avgProcessingTime)
      };
    }

    const overallHealthy = Object.values(healthStatus).every((status: any) => status.healthy);

    res.status(overallHealthy ? 200 : 503).json({
      success: true,
      status: overallHealthy ? 'healthy' : 'degraded',
      providers: healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Webhook health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Helper function to log webhook deliveries
async function logWebhookDelivery(
  req: Request, 
  provider: POSProvider, 
  success: boolean, 
  processingTime: number, 
  error?: any
): Promise<void> {
  try {
    const eventType = req.headers['x-shopify-topic'] as string || 
                     req.body.type || 
                     req.body.eventType || 
                     'unknown';

    await db.client
      .from('webhook_deliveries')
      .insert({
        provider,
        event_type: eventType,
        status: success ? 'success' : 'failed',
        processing_time: processingTime,
        error_message: error ? (error instanceof Error ? error.message : String(error)) : null,
        payload_size: JSON.stringify(req.body).length,
        source_ip: req.ip,
        user_agent: req.headers['user-agent'],
        created_at: new Date().toISOString()
      });
  } catch (logError) {
    logger.error('Failed to log webhook delivery:', logError);
  }
}

export { router as posWebhookRoutes };