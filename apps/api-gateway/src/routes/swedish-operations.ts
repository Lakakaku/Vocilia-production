import { Router, type Request, type Response } from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { SwedishBusinessMonitor } from '../services/swedish-business-monitor';
import { AdvancedWebhookProcessor } from '../services/advanced-webhook-processor';
import { POSDisasterRecovery } from '../services/pos-disaster-recovery';
import { POSPerformanceOptimizer } from '../services/pos-performance-optimizer';
import { POSProvider } from '@ai-feedback-platform/shared-types';
import { logger } from '../utils/logger';

const router = Router();

// Initialize services
const swedishMonitor = new SwedishBusinessMonitor();
const webhookProcessor = new AdvancedWebhookProcessor();
const disasterRecovery = new POSDisasterRecovery();
const performanceOptimizer = new POSPerformanceOptimizer();

/**
 * @openapi
 * /swedish-ops/business-context:
 *   get:
 *     summary: Get current Swedish business context and monitoring status
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Swedish business context information
 */
router.get('/business-context', adminAuth, async (req: Request, res: Response) => {
  try {
    const context = await swedishMonitor.getBusinessMonitoringSummary();
    
    res.json({
      success: true,
      context,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting Swedish business context:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/monitoring-schedule:
 *   get:
 *     summary: Get current monitoring schedule based on Swedish business hours
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current monitoring schedule
 */
router.get('/monitoring-schedule', adminAuth, async (req: Request, res: Response) => {
  try {
    const businessContext = swedishMonitor.isBusinessHours();
    const schedule = swedishMonitor.getMonitoringSchedule();
    
    res.json({
      success: true,
      businessContext,
      schedule,
      nextBusinessDay: swedishMonitor.getNextBusinessDay(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting monitoring schedule:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/webhook-stats:
 *   get:
 *     summary: Get advanced webhook delivery statistics
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: provider
 *         in: query
 *         schema:
 *           type: string
 *           enum: [square, shopify, zettle]
 *       - name: hours
 *         in: query
 *         schema:
 *           type: number
 *           default: 24
 *     responses:
 *       200:
 *         description: Webhook delivery statistics
 */
router.get('/webhook-stats', adminAuth, async (req: Request, res: Response) => {
  try {
    const provider = req.query.provider as POSProvider | undefined;
    const hours = parseInt(req.query.hours as string) || 24;
    
    const stats = await webhookProcessor.getDeliveryStats(provider, hours);
    
    res.json({
      success: true,
      stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting webhook stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/performance/optimize:
 *   post:
 *     summary: Trigger performance optimization for POS integrations
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [square, shopify, zettle]
 *               optimization_type:
 *                 type: string
 *                 enum: [cache_optimization, connection_pool_scaling, batch_optimization]
 *     responses:
 *       200:
 *         description: Optimization triggered successfully
 */
router.post('/performance/optimize', adminAuth, async (req: Request, res: Response) => {
  try {
    const { provider, optimization_type } = req.body;
    
    if (!provider || !['square', 'shopify', 'zettle'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Valid provider required (square, shopify, zettle)'
      });
    }
    
    // Get current performance metrics
    const currentMetrics = await performanceOptimizer.getProviderPerformanceMetrics(provider);
    
    // Get optimization recommendations
    const recommendations = await performanceOptimizer.getPerformanceRecommendations(provider);
    
    res.json({
      success: true,
      provider,
      currentMetrics,
      recommendations,
      optimization_triggered: optimization_type,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering performance optimization:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/performance/load-test:
 *   post:
 *     summary: Run load test against POS provider
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [square, shopify, zettle]
 *               target_rps:
 *                 type: number
 *                 default: 10
 *               duration:
 *                 type: number
 *                 default: 60
 *               endpoints:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Load test results
 */
router.post('/performance/load-test', adminAuth, async (req: Request, res: Response) => {
  try {
    const { provider, target_rps = 10, duration = 60, endpoints = ['/health'] } = req.body;
    
    if (!provider || !['square', 'shopify', 'zettle'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Valid provider required'
      });
    }
    
    const loadTestConfig = {
      provider,
      targetRPS: target_rps,
      duration,
      rampUpTime: Math.min(duration * 0.1, 30), // 10% of duration, max 30s
      endpoints,
      expectedResponseTime: 2000, // 2 seconds
      expectedSuccessRate: 95 // 95%
    };
    
    logger.info(`Starting load test for ${provider}:`, loadTestConfig);
    
    const results = await performanceOptimizer.runLoadTest(loadTestConfig);
    
    res.json({
      success: true,
      provider,
      config: loadTestConfig,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error running load test:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/disaster-recovery/status:
 *   get:
 *     summary: Get disaster recovery system status
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Disaster recovery status
 */
router.get('/disaster-recovery/status', adminAuth, async (req: Request, res: Response) => {
  try {
    const status = await disasterRecovery.getDisasterRecoveryStatus();
    
    res.json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error getting disaster recovery status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/disaster-recovery/failover:
 *   post:
 *     summary: Trigger manual failover for POS provider
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, reason]
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [square, shopify, zettle]
 *               reason:
 *                 type: string
 *                 description: Reason for manual failover
 *               automatic:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Failover result
 */
router.post('/disaster-recovery/failover', adminAuth, async (req: Request, res: Response) => {
  try {
    const { provider, reason, automatic = false } = req.body;
    
    if (!provider || !['square', 'shopify', 'zettle'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Valid provider required'
      });
    }
    
    if (!reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        error: 'Detailed reason required (minimum 10 characters)'
      });
    }
    
    logger.warn(`Manual failover initiated for ${provider}: ${reason}`);
    
    const result = await disasterRecovery.triggerFailover(provider, reason, automatic);
    
    res.json({
      success: result.success,
      provider,
      reason,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error triggering failover:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/disaster-recovery/execute-plan:
 *   post:
 *     summary: Execute disaster recovery plan
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan_id]
 *             properties:
 *               plan_id:
 *                 type: string
 *                 enum: [pos_complete_failure, single_pos_provider_failure]
 *               context:
 *                 type: object
 *                 description: Context variables for plan execution
 *     responses:
 *       200:
 *         description: Recovery plan execution result
 */
router.post('/disaster-recovery/execute-plan', adminAuth, async (req: Request, res: Response) => {
  try {
    const { plan_id, context = {} } = req.body;
    
    if (!plan_id) {
      return res.status(400).json({
        success: false,
        error: 'Plan ID required'
      });
    }
    
    logger.warn(`Executing disaster recovery plan: ${plan_id}`);
    
    const result = await disasterRecovery.executeRecoveryPlan(plan_id, context);
    
    res.json({
      success: result.success,
      planId: plan_id,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error executing recovery plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/data-consistency/check:
 *   post:
 *     summary: Run data consistency checks
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data consistency check results
 */
router.post('/data-consistency/check', adminAuth, async (req: Request, res: Response) => {
  try {
    const results = await disasterRecovery.runConsistencyChecks();
    
    res.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error running consistency checks:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/api-request:
 *   post:
 *     summary: Make optimized POS API request with caching and pooling
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [provider, endpoint]
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [square, shopify, zettle]
 *               endpoint:
 *                 type: string
 *               method:
 *                 type: string
 *                 default: GET
 *               params:
 *                 type: object
 *               options:
 *                 type: object
 *                 properties:
 *                   priority:
 *                     type: string
 *                     enum: [low, medium, high, critical]
 *                   use_cache:
 *                     type: boolean
 *                     default: true
 *                   batchable:
 *                     type: boolean
 *                     default: false
 *     responses:
 *       200:
 *         description: API request result
 */
router.post('/api-request', adminAuth, async (req: Request, res: Response) => {
  try {
    const { provider, endpoint, method = 'GET', params, options = {} } = req.body;
    
    if (!provider || !['square', 'shopify', 'zettle'].includes(provider)) {
      return res.status(400).json({
        success: false,
        error: 'Valid provider required'
      });
    }
    
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: 'Endpoint required'
      });
    }
    
    const result = await performanceOptimizer.optimizedAPIRequest(
      provider,
      endpoint,
      method,
      params,
      options
    );
    
    res.json({
      success: true,
      provider,
      endpoint,
      method,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error making optimized API request:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/alert-severity:
 *   post:
 *     summary: Get alert severity level based on Swedish business context
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [base_level]
 *             properties:
 *               base_level:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *     responses:
 *       200:
 *         description: Adjusted alert severity
 */
router.post('/alert-severity', adminAuth, async (req: Request, res: Response) => {
  try {
    const { base_level } = req.body;
    
    if (!base_level || !['low', 'medium', 'high', 'critical'].includes(base_level)) {
      return res.status(400).json({
        success: false,
        error: 'Valid base_level required (low, medium, high, critical)'
      });
    }
    
    const severity = swedishMonitor.getAlertSeverity(base_level);
    const businessContext = swedishMonitor.isBusinessHours();
    
    res.json({
      success: true,
      baseLeve: base_level,
      adjustedSeverity: severity,
      businessContext,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error calculating alert severity:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * @openapi
 * /swedish-ops/business-should-monitor:
 *   post:
 *     summary: Check if specific business should be monitored now
 *     tags: [Swedish Operations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [business_id]
 *             properties:
 *               business_id:
 *                 type: string
 *               custom_hours:
 *                 type: object
 *                 properties:
 *                   weekday_start:
 *                     type: number
 *                   weekday_end:
 *                     type: number
 *                   weekend_start:
 *                     type: number
 *                   weekend_end:
 *                     type: number
 *     responses:
 *       200:
 *         description: Monitoring recommendation for business
 */
router.post('/business-should-monitor', adminAuth, async (req: Request, res: Response) => {
  try {
    const { business_id, custom_hours } = req.body;
    
    if (!business_id) {
      return res.status(400).json({
        success: false,
        error: 'Business ID required'
      });
    }
    
    const shouldMonitor = swedishMonitor.shouldMonitorBusiness(business_id, custom_hours);
    const businessContext = swedishMonitor.isBusinessHours();
    
    res.json({
      success: true,
      businessId: business_id,
      shouldMonitor,
      businessContext,
      customHours: custom_hours || null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error checking business monitoring:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint for Swedish operations
router.get('/health', async (req: Request, res: Response) => {
  try {
    const businessContext = swedishMonitor.isBusinessHours();
    const services = {
      swedishMonitor: true,
      webhookProcessor: true,
      disasterRecovery: true,
      performanceOptimizer: true
    };
    
    res.json({
      success: true,
      status: 'healthy',
      services,
      businessContext,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Cleanup endpoint for graceful shutdown
router.post('/cleanup', adminAuth, async (req: Request, res: Response) => {
  try {
    await Promise.all([
      swedishMonitor.cleanup(),
      webhookProcessor.cleanup(),
      disasterRecovery.cleanup(),
      performanceOptimizer.cleanup()
    ]);
    
    res.json({
      success: true,
      message: 'Swedish operations services cleaned up successfully'
    });
  } catch (error) {
    logger.error('Error cleaning up Swedish operations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as swedishOperationsRoutes };