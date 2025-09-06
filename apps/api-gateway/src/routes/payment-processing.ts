import { Router, type Request, type Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '@ai-feedback/database';
import { PaymentProcessor } from '@ai-feedback/swish-payout';
import type { APIResponse } from '@ai-feedback/shared-types';

const router = Router();

// Initialize payment processor (will be injected with database connection)
const paymentProcessor = new PaymentProcessor(db);

/**
 * @openapi
 * /api/payment-processing/process-monthly:
 *   post:
 *     summary: Process monthly payments for simple verifications
 *     tags: [Payment Processing]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [year, month]
 *             properties:
 *               year:
 *                 type: integer
 *                 minimum: 2020
 *                 maximum: 2030
 *               month:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *     responses:
 *       200:
 *         description: Payment processing completed
 *       400:
 *         description: Invalid request parameters
 *       403:
 *         description: Unauthorized - admin access required
 */
router.post('/process-monthly', [
  body('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year required (2020-2030)'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('Valid month required (1-12)')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const { year, month } = req.body;

    // Check if batch already processed for this month
    const existingBatch = await db.payment_batches.findFirst({
      where: {
        batch_month: `${year}-${month.toString().padStart(2, '0')}`,
        status: { in: ['completed', 'processing'] }
      }
    });

    if (existingBatch) {
      return res.status(400).json({
        success: false,
        error: `Payment batch for ${year}-${month} already exists with status: ${existingBatch.status}`,
        data: { existingBatchId: existingBatch.batch_id }
      } as APIResponse);
    }

    // Process payments
    console.log(`Starting monthly payment processing for ${year}-${month}`);
    const result = await paymentProcessor.processMonthlyPayments(year, month);

    res.json({
      success: true,
      data: {
        batchId: result.batchId,
        processedPayments: result.processedPayments,
        successfulPayments: result.successfulPayments,
        failedPayments: result.failedPayments,
        totalAmount: result.totalAmount,
        successRate: result.processedPayments > 0 ? 
          (result.successfulPayments / result.processedPayments * 100).toFixed(1) + '%' : '0%',
        errors: result.errors
      }
    } as APIResponse);

  } catch (error) {
    console.error('Monthly payment processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Payment processing failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/payment-processing/batch/{batchId}/status:
 *   get:
 *     summary: Get payment batch status
 *     tags: [Payment Processing]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: path
 *         name: batchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Batch status retrieved
 *       404:
 *         description: Batch not found
 */
router.get('/batch/:batchId/status', [
  param('batchId').notEmpty().withMessage('Batch ID required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const { batchId } = req.params;

    const batch = await paymentProcessor.getPaymentBatch(batchId);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Payment batch not found'
      } as APIResponse);
    }

    res.json({
      success: true,
      data: batch
    } as APIResponse);

  } catch (error) {
    console.error('Batch status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get batch status'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/payment-processing/monthly-stats:
 *   get:
 *     summary: Get monthly payment statistics
 *     tags: [Payment Processing]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: month
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Monthly statistics retrieved
 */
router.get('/monthly-stats', [
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('Valid year required'),
  query('month').isInt({ min: 1, max: 12 }).withMessage('Valid month required')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const year = parseInt(req.query.year as string);
    const month = parseInt(req.query.month as string);

    const stats = await paymentProcessor.getMonthlyPaymentStats(year, month);

    res.json({
      success: true,
      data: {
        period: `${year}-${month.toString().padStart(2, '0')}`,
        ...stats,
        averagePaymentPerCustomer: stats.uniqueCustomers > 0 ? 
          Math.round((stats.totalPaidAmount + stats.totalPendingAmount) / stats.uniqueCustomers * 100) / 100 : 0,
        approvalRate: stats.totalVerifications > 0 ?
          Math.round(stats.approvedVerifications / stats.totalVerifications * 100) : 0
      }
    } as APIResponse);

  } catch (error) {
    console.error('Monthly stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monthly statistics'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/payment-processing/test-swish:
 *   post:
 *     summary: Test Swish API connection
 *     tags: [Payment Processing]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Connection test result
 */
router.post('/test-swish', async (req: Request, res: Response) => {
  try {
    console.log('Testing Swish connection...');
    const connectionOk = await paymentProcessor.testSwishConnection();

    res.json({
      success: true,
      data: {
        connectionStatus: connectionOk ? 'connected' : 'failed',
        testedAt: new Date().toISOString(),
        message: connectionOk ? 'Swish API connection successful' : 'Swish API connection failed'
      }
    } as APIResponse);

  } catch (error) {
    console.error('Swish connection test error:', error);
    res.status(500).json({
      success: false,
      error: 'Connection test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/payment-processing/batches:
 *   get:
 *     summary: List all payment batches
 *     tags: [Payment Processing]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Payment batches listed
 */
router.get('/batches', [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0')
], async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;

    const batches = await db.payment_batches.findMany({
      orderBy: {
        created_at: 'desc'
      },
      take: limit,
      skip: offset
    });

    const totalCount = await db.payment_batches.count();

    res.json({
      success: true,
      data: {
        batches,
        pagination: {
          limit,
          offset,
          total: totalCount,
          hasMore: offset + limit < totalCount
        }
      }
    } as APIResponse);

  } catch (error) {
    console.error('Payment batches list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list payment batches'
    } as APIResponse);
  }
});

export default router;