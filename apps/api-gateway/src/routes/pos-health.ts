import { Router, type Request, type Response } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { POSHealthMonitor } from '../services/pos-health-monitor';
import { db } from '@ai-feedback/database';
import { logger } from '../utils/logger';

const router = Router();
const posHealthMonitor = new POSHealthMonitor();

/**
 * @openapi
 * /pos/health:
 *   get:
 *     summary: Get health status of all POS integrations
 *     tags: [POS Health]
 *     responses:
 *       200:
 *         description: POS health status
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const healthStatus = await posHealthMonitor.checkAllProviders();
    
    const overallHealthy = Object.values(healthStatus).every(status => status.healthy);
    
    res.status(overallHealthy ? 200 : 503).json({
      success: true,
      status: overallHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      providers: healthStatus
    });
  } catch (error) {
    logger.error('Error checking POS health:', error);
    res.status(500).json({
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /pos/health/{provider}:
 *   get:
 *     summary: Get health status for specific POS provider
 *     tags: [POS Health]
 *     parameters:
 *       - name: provider
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [square, shopify, zettle]
 *     responses:
 *       200:
 *         description: Provider-specific health status
 */
router.get('/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    
    if (!['square', 'shopify', 'zettle'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PROVIDER', message: 'Invalid POS provider' }
      });
    }

    const healthStatus = await posHealthMonitor.checkProvider(provider as any);
    
    res.status(healthStatus.healthy ? 200 : 503).json({
      success: true,
      provider,
      ...healthStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error checking ${req.params.provider} health:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /pos/health/{provider}/connections:
 *   get:
 *     summary: Get connection status for all businesses using a provider
 *     tags: [POS Health]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: provider
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [square, shopify, zettle]
 *     responses:
 *       200:
 *         description: Connection status for all businesses
 */
router.get('/:provider/connections', adminAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    
    const connections = await posHealthMonitor.checkBusinessConnections(provider as any);
    
    const healthyCount = connections.filter(conn => conn.healthy).length;
    const totalCount = connections.length;
    
    res.json({
      success: true,
      provider,
      summary: {
        total: totalCount,
        healthy: healthyCount,
        unhealthy: totalCount - healthyCount,
        healthPercentage: totalCount > 0 ? Math.round((healthyCount / totalCount) * 100) : 0
      },
      connections,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error checking ${req.params.provider} connections:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /pos/health/{provider}/webhooks:
 *   get:
 *     summary: Get webhook health status for a provider
 *     tags: [POS Health]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: provider
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [square, shopify, zettle]
 *     responses:
 *       200:
 *         description: Webhook health status
 */
router.get('/:provider/webhooks', adminAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    
    const webhookStatus = await posHealthMonitor.checkWebhookHealth(provider as any);
    
    res.json({
      success: true,
      provider,
      webhooks: webhookStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error checking ${req.params.provider} webhooks:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /pos/health/{provider}/test:
 *   post:
 *     summary: Test POS provider connection
 *     tags: [POS Health]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: provider
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           enum: [square, shopify, zettle]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessId:
 *                 type: string
 *                 description: Test specific business connection
 *     responses:
 *       200:
 *         description: Test results
 */
router.post('/:provider/test', adminAuth, async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const { businessId } = req.body;
    
    const testResult = await posHealthMonitor.testConnection(provider as any, businessId);
    
    res.json({
      success: true,
      provider,
      businessId,
      test: testResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error testing ${req.params.provider} connection:`, error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /pos/health/metrics:
 *   get:
 *     summary: Get POS integration metrics
 *     tags: [POS Health]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: POS integration metrics
 */
router.get('/metrics', adminAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await posHealthMonitor.getMetrics();
    
    res.json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting POS metrics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as posHealthRoutes };