import { Router, type Request, type Response } from 'express';
import { query, param, body, validationResult } from 'express-validator';
import { db } from '@ai-feedback/database';
import type { APIResponse } from '@ai-feedback/shared-types';
import { deadlineEnforcementJob } from '../jobs/DeadlineEnforcementJob';
import { verificationMatcher } from '../services/verification-matcher';

const router = Router();

/**
 * @openapi
 * /api/billing-admin/overview:
 *   get:
 *     summary: Get billing system overview
 *     tags: [Billing Admin]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Billing overview retrieved successfully
 */
router.get('/overview', async (req: Request, res: Response) => {
  try {
    // Get current month stats
    const currentDate = new Date();
    const currentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    // Active billing batches
    const activeBatches = await db.monthlyBillingBatch.findMany({
      where: {
        status: { in: ['review_period', 'payment_processing'] }
      },
      include: {
        business: {
          select: {
            name: true
          }
        }
      },
      orderBy: {
        reviewDeadline: 'asc'
      }
    });

    // This month's verifications
    const monthlyStats = await db.simpleVerification.groupBy({
      by: ['reviewStatus'],
      where: {
        submittedAt: {
          gte: currentMonth,
          lt: nextMonth
        }
      },
      _count: {
        id: true
      },
      _sum: {
        paymentAmount: true
      }
    });

    // Payment batch stats
    const paymentBatches = await db.payment_batches.findMany({
      where: {
        created_at: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10
    });

    // Format stats
    const statusStats = {
      pending: 0,
      approved: 0,
      rejected: 0,
      auto_approved: 0,
      totalPendingAmount: 0,
      totalApprovedAmount: 0
    };

    for (const stat of monthlyStats) {
      statusStats[stat.reviewStatus as keyof typeof statusStats] = stat._count.id;
      if (stat.reviewStatus === 'approved' || stat.reviewStatus === 'auto_approved') {
        statusStats.totalApprovedAmount += stat._sum.paymentAmount || 0;
      } else if (stat.reviewStatus === 'pending') {
        statusStats.totalPendingAmount += stat._sum.paymentAmount || 0;
      }
    }

    res.json({
      success: true,
      data: {
        currentMonth: currentMonth.toISOString().substr(0, 7),
        activeBatches: activeBatches.length,
        upcomingDeadlines: activeBatches.filter(b => 
          b.reviewDeadline && b.reviewDeadline <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ).length,
        monthlyVerifications: statusStats,
        recentPaymentBatches: paymentBatches.map(batch => ({
          batchId: batch.batch_id,
          month: batch.batch_month,
          totalPayments: batch.total_payments,
          totalAmount: batch.total_amount,
          status: batch.status,
          createdAt: batch.created_at,
          processedAt: batch.processed_at
        })),
        batches: activeBatches.map(batch => ({
          id: batch.id,
          businessName: batch.business?.name,
          billingMonth: batch.billingMonth,
          status: batch.status,
          reviewDeadline: batch.reviewDeadline,
          totalVerifications: batch.totalVerifications,
          pendingReviews: batch.totalVerifications - batch.approvedVerifications - batch.rejectedVerifications,
          totalStoreCost: batch.totalStoreCost,
          daysUntilDeadline: batch.reviewDeadline ? 
            Math.ceil((batch.reviewDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
        }))
      }
    } as APIResponse);

  } catch (error) {
    console.error('Billing overview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get billing overview'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/billing-admin/batches:
 *   get:
 *     summary: List all billing batches with filters
 *     tags: [Billing Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [collecting, review_period, payment_processing, completed]
 *       - in: query
 *         name: businessId
 *         schema:
 *           type: string
 *       - in: query
 *         name: month
 *         schema:
 *           type: string
 *           pattern: ^\d{4}-\d{2}$
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Billing batches listed successfully
 */
router.get('/batches', [
  query('status').optional().isIn(['collecting', 'review_period', 'payment_processing', 'completed']),
  query('businessId').optional().isUUID(),
  query('month').optional().matches(/^\d{4}-\d{2}$/),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
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

    const { status, businessId, month, limit = 50, offset = 0 } = req.query;

    const where: any = {};
    if (status) where.status = status;
    if (businessId) where.businessId = businessId;
    if (month) {
      const [year, monthNum] = (month as string).split('-');
      const startDate = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      where.billingMonth = startDate;
    }

    const [batches, totalCount] = await Promise.all([
      db.monthlyBillingBatch.findMany({
        where,
        include: {
          business: {
            select: {
              name: true,
              contactEmail: true
            }
          }
        },
        orderBy: {
          billingMonth: 'desc'
        },
        take: parseInt(limit as string),
        skip: parseInt(offset as string)
      }),
      db.monthlyBillingBatch.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        batches: batches.map(batch => ({
          id: batch.id,
          businessId: batch.businessId,
          businessName: batch.business?.name,
          businessEmail: batch.business?.contactEmail,
          billingMonth: batch.billingMonth,
          status: batch.status,
          totalVerifications: batch.totalVerifications,
          approvedVerifications: batch.approvedVerifications,
          rejectedVerifications: batch.rejectedVerifications,
          pendingVerifications: batch.totalVerifications - batch.approvedVerifications - batch.rejectedVerifications,
          totalCustomerPayments: batch.totalCustomerPayments,
          totalCommission: batch.totalCommission,
          totalStoreCost: batch.totalStoreCost,
          reviewDeadline: batch.reviewDeadline,
          paymentDueDate: batch.paymentDueDate,
          storeInvoiceGenerated: batch.storeInvoiceGenerated,
          storePaymentReceived: batch.storePaymentReceived,
          customerPaymentsSent: batch.customerPaymentsSent,
          createdAt: batch.createdAt,
          completedAt: batch.completedAt,
          daysUntilDeadline: batch.reviewDeadline ? 
            Math.ceil((batch.reviewDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
        })),
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: totalCount,
          hasMore: parseInt(offset as string) + parseInt(limit as string) < totalCount
        }
      }
    } as APIResponse);

  } catch (error) {
    console.error('Billing batches list error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list billing batches'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/billing-admin/batch/{batchId}/details:
 *   get:
 *     summary: Get detailed information about a billing batch
 *     tags: [Billing Admin]
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
 *         description: Batch details retrieved successfully
 */
router.get('/batch/:batchId/details', [
  param('batchId').isUUID()
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

    const batch = await db.monthlyBillingBatch.findUnique({
      where: { id: batchId },
      include: {
        business: {
          select: {
            name: true,
            contactEmail: true,
            simpleVerificationSettings: true
          }
        }
      }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Billing batch not found'
      } as APIResponse);
    }

    // Get verifications for this batch
    const verifications = await db.simpleVerification.findMany({
      where: { billingBatchId: batchId },
      include: {
        session: {
          include: {
            feedback: {
              select: {
                qualityScore: true,
                categories: true
              }
            }
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    });

    // Calculate statistics
    const stats = {
      byStatus: {
        pending: verifications.filter(v => v.reviewStatus === 'pending').length,
        approved: verifications.filter(v => v.reviewStatus === 'approved').length,
        rejected: verifications.filter(v => v.reviewStatus === 'rejected').length,
        auto_approved: verifications.filter(v => v.reviewStatus === 'auto_approved').length
      },
      byFraudScore: {
        low: verifications.filter(v => (v.fraudScore || 0) < 0.3).length,
        medium: verifications.filter(v => (v.fraudScore || 0) >= 0.3 && (v.fraudScore || 0) < 0.7).length,
        high: verifications.filter(v => (v.fraudScore || 0) >= 0.7).length
      },
      avgFraudScore: verifications.reduce((sum, v) => sum + (v.fraudScore || 0), 0) / verifications.length,
      totalCustomerPayments: verifications
        .filter(v => v.reviewStatus === 'approved' || v.reviewStatus === 'auto_approved')
        .reduce((sum, v) => sum + (v.paymentAmount || 0), 0),
      totalCommission: verifications
        .filter(v => v.reviewStatus === 'approved' || v.reviewStatus === 'auto_approved')
        .reduce((sum, v) => sum + (v.commissionAmount || 0), 0)
    };

    res.json({
      success: true,
      data: {
        batch: {
          ...batch,
          businessName: batch.business?.name,
          businessEmail: batch.business?.contactEmail,
          daysUntilDeadline: batch.reviewDeadline ? 
            Math.ceil((batch.reviewDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)) : null
        },
        statistics: stats,
        verifications: verifications.map(v => ({
          id: v.id,
          submittedAt: v.submittedAt,
          purchaseTime: v.purchaseTime,
          purchaseAmount: v.purchaseAmount,
          customerPhone: v.customerPhone,
          reviewStatus: v.reviewStatus,
          fraudScore: v.fraudScore,
          paymentAmount: v.paymentAmount,
          qualityScore: v.session?.feedback?.qualityScore,
          categories: v.session?.feedback?.categories,
          reviewedAt: v.reviewedAt,
          reviewedBy: v.reviewedBy,
          rejectionReason: v.rejectionReason
        }))
      }
    } as APIResponse);

  } catch (error) {
    console.error('Batch details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get batch details'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/billing-admin/deadline-enforcement/run:
 *   post:
 *     summary: Manually run deadline enforcement job
 *     tags: [Billing Admin]
 *     security:
 *       - adminAuth: []
 *     responses:
 *       200:
 *         description: Deadline enforcement job executed
 */
router.post('/deadline-enforcement/run', async (req: Request, res: Response) => {
  try {
    const result = await deadlineEnforcementJob.execute();

    res.json({
      success: true,
      data: {
        executedAt: new Date().toISOString(),
        ...result
      }
    } as APIResponse);

  } catch (error) {
    console.error('Manual deadline enforcement error:', error);
    res.status(500).json({
      success: false,
      error: 'Deadline enforcement job failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/billing-admin/batch/{batchId}/force-deadline:
 *   post:
 *     summary: Force deadline processing for a specific batch
 *     tags: [Billing Admin]
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
 *         description: Batch deadline processing forced
 */
router.post('/batch/:batchId/force-deadline', [
  param('batchId').isUUID()
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

    // Verify batch exists and is in review period
    const batch = await db.monthlyBillingBatch.findUnique({
      where: { id: batchId }
    });

    if (!batch) {
      return res.status(404).json({
        success: false,
        error: 'Billing batch not found'
      } as APIResponse);
    }

    if (batch.status !== 'review_period') {
      return res.status(400).json({
        success: false,
        error: `Batch is not in review period (current status: ${batch.status})`
      } as APIResponse);
    }

    // Create a temporary billing batch for deadline enforcement to process
    const tempBatch = {
      id: batch.id,
      business: { name: 'Manual Override', contactEmail: 'admin@system.com' },
      reviewDeadline: new Date(Date.now() - 1000) // Set deadline to 1 second ago
    };

    // This would normally be private, but for admin override we'll simulate the process
    const pendingCount = await db.simpleVerification.count({
      where: {
        billingBatchId: batchId,
        reviewStatus: 'pending'
      }
    });

    if (pendingCount > 0) {
      // Auto-approve all pending verifications
      await db.simpleVerification.updateMany({
        where: {
          billingBatchId: batchId,
          reviewStatus: 'pending'
        },
        data: {
          reviewStatus: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'admin_force_deadline'
        }
      });
    }

    // Update batch status
    await db.monthlyBillingBatch.update({
      where: { id: batchId },
      data: {
        status: 'payment_processing',
        storeInvoiceGenerated: true,
        updatedAt: new Date()
      }
    });

    res.json({
      success: true,
      data: {
        batchId,
        autoApprovedVerifications: pendingCount,
        message: `Forced deadline processing completed. ${pendingCount} verifications auto-approved.`
      }
    } as APIResponse);

  } catch (error) {
    console.error('Force deadline error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to force deadline processing'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/billing-admin/create-batch:
 *   post:
 *     summary: Manually create billing batch for a business
 *     tags: [Billing Admin]
 *     security:
 *       - adminAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [businessId, year, month]
 *             properties:
 *               businessId:
 *                 type: string
 *               year:
 *                 type: integer
 *               month:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Billing batch created successfully
 */
router.post('/create-batch', [
  body('businessId').isUUID(),
  body('year').isInt({ min: 2020, max: 2030 }),
  body('month').isInt({ min: 1, max: 12 })
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

    const { businessId, year, month } = req.body;

    const batchId = await deadlineEnforcementJob.createMonthlyBatch(businessId, year, month);

    res.status(201).json({
      success: true,
      data: {
        batchId,
        message: `Billing batch created for ${year}-${month}`
      }
    } as APIResponse);

  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create billing batch',
      details: error instanceof Error ? error.message : 'Unknown error'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/billing-admin/verification-stats:
 *   get:
 *     summary: Get verification statistics and insights
 *     tags: [Billing Admin]
 *     security:
 *       - adminAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *     responses:
 *       200:
 *         description: Verification statistics retrieved
 */
router.get('/verification-stats', [
  query('days').optional().isInt({ min: 1, max: 365 })
], async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get verification stats
    const verifications = await db.simpleVerification.findMany({
      where: {
        submittedAt: {
          gte: startDate
        }
      },
      select: {
        reviewStatus: true,
        fraudScore: true,
        paymentAmount: true,
        customerPhone: true,
        purchaseAmount: true,
        submittedAt: true
      }
    });

    // Generate matching report using the verification matcher
    const mockTransactionResults = verifications.map(v => ({
      verification: {
        id: 'mock',
        purchaseTime: v.submittedAt,
        purchaseAmount: v.purchaseAmount,
        customerPhone: v.customerPhone,
        storeCode: '123456'
      },
      match: {
        verified: v.reviewStatus === 'approved' || v.reviewStatus === 'auto_approved',
        confidence: v.reviewStatus === 'approved' ? 0.9 : v.reviewStatus === 'auto_approved' ? 0.7 : 0.3,
        reasons: [],
        toleranceChecks: {
          timeWithinTolerance: v.reviewStatus === 'approved',
          amountWithinTolerance: v.reviewStatus === 'approved',
          timeDifferenceSeconds: 0,
          amountDifference: 0
        }
      }
    }));

    const matchingReport = verificationMatcher.generateMatchingReport(mockTransactionResults);

    // Additional fraud statistics
    const fraudStats = {
      highRiskCount: verifications.filter(v => (v.fraudScore || 0) >= 0.7).length,
      mediumRiskCount: verifications.filter(v => (v.fraudScore || 0) >= 0.3 && (v.fraudScore || 0) < 0.7).length,
      lowRiskCount: verifications.filter(v => (v.fraudScore || 0) < 0.3).length,
      avgFraudScore: verifications.reduce((sum, v) => sum + (v.fraudScore || 0), 0) / verifications.length,
      repeatCustomers: new Set(verifications.map(v => v.customerPhone)).size / verifications.length * 100 // Unique customer percentage
    };

    res.json({
      success: true,
      data: {
        period: {
          days,
          startDate,
          endDate: new Date()
        },
        totalVerifications: verifications.length,
        matchingReport,
        fraudStats,
        recommendations: [
          ...matchingReport.recommendations,
          fraudStats.avgFraudScore > 0.5 ? 'High average fraud score detected - review fraud detection settings' : null,
          fraudStats.repeatCustomers < 20 ? 'Low repeat customer rate may indicate fraud or poor customer retention' : null
        ].filter(Boolean)
      }
    } as APIResponse);

  } catch (error) {
    console.error('Verification stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get verification statistics'
    } as APIResponse);
  }
});

export default router;