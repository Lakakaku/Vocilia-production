import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { stripeService, SwedishBusinessAccount, CustomerPayout } from '../services/stripe-connect';
import { db } from '@ai-feedback/database';
import type { APIResponse, Business } from '@ai-feedback/shared-types';

const router = Router();

/**
 * @openapi
 * /api/payments/connect/onboard:
 *   post:
 *     summary: Start Stripe Connect onboarding for business
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               businessId:
 *                 type: string
 *                 format: uuid
 *               refreshUrl:
 *                 type: string
 *                 format: uri
 *               returnUrl:
 *                 type: string
 *                 format: uri
 *     responses:
 *       200:
 *         description: Onboarding link created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     onboardingUrl:
 *                       type: string
 *                     accountId:
 *                       type: string
 */
router.post('/connect/onboard',
  [
    body('businessId').isUUID('4').withMessage('Valid business ID required'),
    body('refreshUrl').isURL().withMessage('Valid refresh URL required'),
    body('returnUrl').isURL().withMessage('Valid return URL required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId, refreshUrl, returnUrl } = req.body;

      // Get business details from database
      const business = await db.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'BUSINESS_NOT_FOUND',
            message: 'Business not found'
          }
        });
      }

      // Check if business already has Stripe account
      if (business.stripe_account_id) {
        // Create account link for existing account
        const accountLink = await stripeService.createAccountLink(
          business.stripe_account_id,
          refreshUrl,
          returnUrl
        );

        return res.json({
          success: true,
          data: {
            onboardingUrl: accountLink.url,
            accountId: business.stripe_account_id,
            isExisting: true
          }
        });
      }

      // Create new Express account using TEST data
      const testBusinessData: SwedishBusinessAccount = {
        businessId: business.id,
        orgNumber: business.org_number || '556123-4567', // TEST org number
        businessName: business.name,
        email: business.email,
        phone: business.phone || '+46701234567',
        address: {
          line1: business.address?.street || 'Drottninggatan 123',
          city: business.address?.city || 'Stockholm',
          postal_code: business.address?.postal_code || '11151',
          country: 'SE',
        },
        representative: {
          first_name: 'Test',
          last_name: 'Representative',
          email: business.email,
          phone: business.phone || '+46701234567',
          dob: {
            day: 15,
            month: 6,
            year: 1980,
          },
        },
      };

      // Create Stripe Express account
      const account = await stripeService.createExpressAccount(testBusinessData);

      // Save account ID to database
      await db.updateBusiness(businessId, {
        stripe_account_id: account.id,
        updated_at: new Date().toISOString()
      });

      // Create onboarding link
      const accountLink = await stripeService.createAccountLink(
        account.id,
        refreshUrl,
        returnUrl
      );

      const response: APIResponse<{
        onboardingUrl: string;
        accountId: string;
        isExisting: boolean;
      }> = {
        success: true,
        data: {
          onboardingUrl: accountLink.url,
          accountId: account.id,
          isExisting: false
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Stripe onboarding error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STRIPE_ONBOARDING_ERROR',
          message: 'Failed to start Stripe onboarding'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/connect/status/{businessId}:
 *   get:
 *     summary: Get Stripe Connect account status
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Account status
 */
router.get('/connect/status/:businessId',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid business ID'
        }
      });
    }

    try {
      const { businessId } = req.params;

      const business = await db.getBusiness(businessId);
      if (!business) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'BUSINESS_NOT_FOUND',
            message: 'Business not found'
          }
        });
      }

      if (!business.stripe_account_id) {
        return res.json({
          success: true,
          data: {
            hasAccount: false,
            onboardingRequired: true
          }
        });
      }

      const accountStatus = await stripeService.getAccountStatus(business.stripe_account_id);

      const response: APIResponse<{
        hasAccount: boolean;
        onboardingRequired: boolean;
        accountStatus: typeof accountStatus;
      }> = {
        success: true,
        data: {
          hasAccount: true,
          onboardingRequired: !accountStatus.details_submitted || !accountStatus.charges_enabled,
          accountStatus
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get account status error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ACCOUNT_STATUS_ERROR',
          message: 'Failed to get account status'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/payout:
 *   post:
 *     summary: Process customer payout (TEST)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sessionId:
 *                 type: string
 *               customerId:
 *                 type: string
 *               amount:
 *                 type: number
 *               businessId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Payout processed
 */
router.post('/payout',
  [
    body('sessionId').isString().notEmpty().withMessage('Session ID required'),
    body('customerId').isString().notEmpty().withMessage('Customer ID required'),
    body('amount').isNumeric().isFloat({ min: 100 }).withMessage('Amount must be at least 100 öre (1 SEK)'),
    body('businessId').isUUID('4').withMessage('Valid business ID required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid payout data',
          details: errors.array()
        }
      });
    }

    try {
      const { sessionId, customerId, amount, businessId } = req.body;

      // Get business and verify Stripe account
      const business = await db.getBusiness(businessId);
      if (!business || !business.stripe_account_id) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'BUSINESS_NOT_CONNECTED',
            message: 'Business not connected to Stripe'
          }
        });
      }

      // Get feedback session for metadata
      const session = await db.getFeedbackSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Feedback session not found'
          }
        });
      }

      const payoutData: CustomerPayout = {
        customerId,
        amount,
        currency: 'sek',
        metadata: {
          sessionId,
          businessId,
          qualityScore: session.quality_score || 0,
          rewardTier: session.reward_tier || 'insufficient'
        }
      };

      // Process payout through Stripe
      const transfer = await stripeService.processCustomerPayout(
        business.stripe_account_id,
        payoutData
      );

      // Update session with transfer ID
      await db.updateFeedbackSession(sessionId, {
        stripe_transfer_id: transfer.id,
        reward_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      const response: APIResponse<{
        transferId: string;
        amount: number;
        status: string;
      }> = {
        success: true,
        data: {
          transferId: transfer.id,
          amount: transfer.amount,
          status: 'processed'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Payout processing error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYOUT_ERROR',
          message: 'Failed to process payout'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/webhooks/stripe:
 *   post:
 *     summary: Handle Stripe webhooks
 *     tags: [Payments]
 *     responses:
 *       200:
 *         description: Webhook processed
 */
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const payload = JSON.stringify(req.body);
    
    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_SIGNATURE',
          message: 'Missing webhook signature or secret'
        }
      });
    }

    // Verify webhook signature
    const event = stripeService.verifyWebhookSignature(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    console.log(`📨 Received webhook: ${event.type}`);

    // Handle different webhook events
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as any);
        break;
        
      case 'transfer.created':
        await handleTransferCreated(event.data.object as any);
        break;
        
      case 'transfer.updated':
        await handleTransferUpdated(event.data.object as any);
        break;
        
      default:
        console.log(`🤷 Unhandled webhook event: ${event.type}`);
    }

    res.json({ success: true, received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(400).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: 'Failed to process webhook'
      }
    });
  }
});

// Webhook event handlers
async function handleAccountUpdated(account: any): Promise<void> {
  try {
    // Update business onboarding status
    const { data: business } = await db.client
      .from('businesses')
      .select('id')
      .eq('stripe_account_id', account.id)
      .single();

    if (business) {
      await db.updateBusiness(business.id, {
        stripe_onboarding_complete: account.details_submitted && account.charges_enabled,
        updated_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error handling account.updated webhook:', error);
  }
}

async function handleTransferCreated(transfer: any): Promise<void> {
  try {
    console.log(`💰 Transfer created: ${transfer.id} for ${transfer.amount} ${transfer.currency}`);
    // Additional logging or processing can be added here
  } catch (error) {
    console.error('Error handling transfer.created webhook:', error);
  }
}

async function handleTransferUpdated(transfer: any): Promise<void> {
  try {
    console.log(`📋 Transfer updated: ${transfer.id} status: ${transfer.status}`);
    
    // Update feedback session if transfer failed
    if (transfer.metadata?.sessionId && transfer.status === 'failed') {
      await db.updateFeedbackSession(transfer.metadata.sessionId, {
        status: 'failed',
        error_message: 'Payout transfer failed',
        updated_at: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Error handling transfer.updated webhook:', error);
  }
}

/**
 * @openapi
 * /api/payments/disputes:
 *   get:
 *     summary: Get disputes for business (MOCK)
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: businessId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, investigating, resolved, rejected]
 *     responses:
 *       200:
 *         description: List of disputes
 */
// Get disputes for business (MOCK)
router.get('/disputes',
  [
    query('businessId').optional().isUUID('4').withMessage('Valid business ID required'),
    query('status').optional().isIn(['pending', 'investigating', 'resolved', 'rejected']).withMessage('Valid status required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId, status, limit = 50, offset = 0 } = req.query;

      // Mock dispute data
      const mockDisputes = [
        {
          id: 'dispute-001',
          type: 'chargeback',
          amount: 2500, // 25 SEK
          currency: 'sek',
          businessId: businessId || 'business-123',
          customerId: 'customer-456',
          transactionId: 'trans-789',
          sessionId: 'session-abc',
          status: 'pending',
          reason: 'Kunden hävdar att feedbacken inte lämnades',
          evidence: [],
          createdAt: '2024-08-24T10:00:00Z',
          updatedAt: '2024-08-24T10:00:00Z',
          dueDate: '2024-08-31T23:59:59Z',
          timeline: [
            {
              timestamp: '2024-08-24T10:00:00Z',
              status: 'created',
              description: 'Tvist skapad av kund',
              actor: 'customer'
            }
          ]
        },
        {
          id: 'dispute-002',
          type: 'quality_complaint',
          amount: 1800, // 18 SEK
          currency: 'sek',
          businessId: businessId || 'business-123',
          customerId: 'customer-789',
          transactionId: 'trans-456',
          sessionId: 'session-def',
          status: 'investigating',
          reason: 'Kunden anser att belöningen var för låg för feedbackens kvalitet',
          evidence: [
            {
              id: 'evidence-001',
              type: 'audio_recording',
              url: 'https://mock-storage.example.com/evidence/audio-001.wav',
              uploadedAt: '2024-08-24T11:00:00Z',
              description: 'Original voice feedback recording'
            }
          ],
          createdAt: '2024-08-23T14:30:00Z',
          updatedAt: '2024-08-24T09:15:00Z',
          dueDate: '2024-08-30T23:59:59Z',
          timeline: [
            {
              timestamp: '2024-08-23T14:30:00Z',
              status: 'created',
              description: 'Tvist skapad av kund',
              actor: 'customer'
            },
            {
              timestamp: '2024-08-24T09:15:00Z',
              status: 'investigating',
              description: 'Utredning påbörjad av support',
              actor: 'admin',
              notes: 'Granskar AI-bedömning och ljudinspelning'
            }
          ]
        },
        {
          id: 'dispute-003',
          type: 'technical_issue',
          amount: 5000, // 50 SEK
          currency: 'sek',
          businessId: businessId || 'business-456',
          customerId: 'customer-101',
          transactionId: 'trans-202',
          sessionId: 'session-ghi',
          status: 'resolved',
          reason: 'Tekniskt fel resulterade i ingen utbetalning trots godkänd feedback',
          evidence: [
            {
              id: 'evidence-002',
              type: 'system_logs',
              url: 'https://mock-storage.example.com/evidence/logs-002.txt',
              uploadedAt: '2024-08-22T16:45:00Z',
              description: 'System logs showing payment processing error'
            }
          ],
          resolution: {
            action: 'refund_issued',
            amount: 5000,
            description: 'Full refund issued due to technical error. Customer feedback was valid.',
            resolvedBy: 'admin-001',
            resolvedAt: '2024-08-23T10:20:00Z'
          },
          createdAt: '2024-08-22T15:00:00Z',
          updatedAt: '2024-08-23T10:20:00Z',
          dueDate: '2024-08-29T23:59:59Z',
          timeline: [
            {
              timestamp: '2024-08-22T15:00:00Z',
              status: 'created',
              description: 'Tvist skapad av kund',
              actor: 'customer'
            },
            {
              timestamp: '2024-08-22T16:45:00Z',
              status: 'investigating',
              description: 'Teknisk utredning påbörjad',
              actor: 'admin'
            },
            {
              timestamp: '2024-08-23T10:20:00Z',
              status: 'resolved',
              description: 'Full återbetalning genomförd',
              actor: 'admin',
              notes: 'Tekniskt fel bekräftat, kund kompenserad'
            }
          ]
        }
      ];

      // Filter by status if provided
      let filteredDisputes = mockDisputes;
      if (status) {
        filteredDisputes = mockDisputes.filter(d => d.status === status);
      }
      if (businessId) {
        filteredDisputes = filteredDisputes.filter(d => d.businessId === businessId);
      }

      // Apply pagination
      const paginatedDisputes = filteredDisputes.slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string)
      );

      const response: APIResponse<{
        disputes: typeof paginatedDisputes;
        total: number;
        pagination: {
          limit: number;
          offset: number;
          hasMore: boolean;
        };
      }> = {
        success: true,
        data: {
          disputes: paginatedDisputes,
          total: filteredDisputes.length,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: parseInt(offset as string) + parseInt(limit as string) < filteredDisputes.length
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get disputes error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DISPUTES_ERROR',
          message: 'Failed to get disputes'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/disputes:
 *   post:
 *     summary: Create dispute (MOCK)
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [chargeback, quality_complaint, technical_issue]
 *               transactionId:
 *                 type: string
 *               reason:
 *                 type: string
 *               customerId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Dispute created
 */
// Create dispute (MOCK)
router.post('/disputes',
  [
    body('type').isIn(['chargeback', 'quality_complaint', 'technical_issue']).withMessage('Valid dispute type required'),
    body('transactionId').notEmpty().withMessage('Transaction ID required'),
    body('reason').trim().isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
    body('customerId').notEmpty().withMessage('Customer ID required'),
    body('amount').optional().isNumeric().withMessage('Amount must be numeric')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid dispute data',
          details: errors.array()
        }
      });
    }

    try {
      const { type, transactionId, reason, customerId, amount = 2500 } = req.body;

      // Create mock dispute
      const dispute = {
        id: `dispute-${Date.now()}`,
        type,
        amount,
        currency: 'sek',
        businessId: 'business-mock',
        customerId,
        transactionId,
        sessionId: `session-${Date.now()}`,
        status: 'pending',
        reason,
        evidence: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        timeline: [
          {
            timestamp: new Date().toISOString(),
            status: 'created',
            description: 'Tvist skapad av kund',
            actor: 'customer'
          }
        ]
      };

      // Mock notification to business
      console.log(`📧 Mock notification sent to business: New ${type} dispute created`);
      console.log(`💰 Amount in dispute: ${amount / 100} SEK`);
      console.log(`📝 Reason: ${reason}`);

      const response: APIResponse<{
        dispute: typeof dispute;
        message: string;
      }> = {
        success: true,
        data: {
          dispute,
          message: 'Tvist skapad framgångsrikt. Företaget har informerats.'
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create dispute error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_DISPUTE_ERROR',
          message: 'Failed to create dispute'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/disputes/{disputeId}:
 *   put:
 *     summary: Update dispute status (ADMIN MOCK)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: disputeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, investigating, resolved, rejected]
 *               notes:
 *                 type: string
 *               adminId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispute updated
 */
// Update dispute status (ADMIN MOCK)
router.put('/disputes/:disputeId',
  [
    param('disputeId').notEmpty().withMessage('Dispute ID required'),
    body('status').isIn(['pending', 'investigating', 'resolved', 'rejected']).withMessage('Valid status required'),
    body('notes').optional().trim().isLength({ max: 1000 }).withMessage('Notes max 1000 characters'),
    body('adminId').optional().notEmpty().withMessage('Admin ID required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid update data',
          details: errors.array()
        }
      });
    }

    try {
      const { disputeId } = req.params;
      const { status, notes, adminId = 'admin-mock' } = req.body;

      // Mock dispute update
      const updatedDispute = {
        id: disputeId,
        status,
        updatedAt: new Date().toISOString(),
        updatedBy: adminId,
        timeline: [
          {
            timestamp: new Date().toISOString(),
            status,
            description: `Status uppdaterad till ${status}`,
            actor: 'admin',
            notes: notes || ''
          }
        ]
      };

      // Mock notifications based on status
      const notifications = {
        investigating: 'Vi utreder nu din tvist. Förväntat svar inom 3-5 arbetsdagar.',
        resolved: 'Din tvist har lösts. Eventuell kompensation är på väg.',
        rejected: 'Din tvist har avslagits efter granskning.'
      };

      if (notifications[status as keyof typeof notifications]) {
        console.log(`📧 Mock notification to customer: ${notifications[status as keyof typeof notifications]}`);
      }

      const response: APIResponse<{
        dispute: typeof updatedDispute;
        message: string;
      }> = {
        success: true,
        data: {
          dispute: updatedDispute,
          message: `Tvist ${disputeId} uppdaterad till ${status}`
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Update dispute error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_DISPUTE_ERROR',
          message: 'Failed to update dispute'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/disputes/{disputeId}/resolve:
 *   post:
 *     summary: Resolve dispute with compensation (ADMIN MOCK)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: disputeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [refund_issued, partial_refund, no_compensation, additional_reward]
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               adminId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Dispute resolved
 */
// Resolve dispute with compensation (ADMIN MOCK)
router.post('/disputes/:disputeId/resolve',
  [
    param('disputeId').notEmpty().withMessage('Dispute ID required'),
    body('action').isIn(['refund_issued', 'partial_refund', 'no_compensation', 'additional_reward']).withMessage('Valid resolution action required'),
    body('amount').optional().isNumeric().withMessage('Amount must be numeric'),
    body('description').trim().isLength({ min: 10, max: 500 }).withMessage('Description must be 10-500 characters'),
    body('adminId').optional().notEmpty().withMessage('Admin ID required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid resolution data',
          details: errors.array()
        }
      });
    }

    try {
      const { disputeId } = req.params;
      const { action, amount = 0, description, adminId = 'admin-mock' } = req.body;

      // Mock resolution processing
      const resolution = {
        disputeId,
        action,
        amount,
        description,
        resolvedBy: adminId,
        resolvedAt: new Date().toISOString(),
        status: 'resolved'
      };

      // Mock payment processing if compensation involved
      if (amount > 0) {
        console.log(`💰 Mock compensation payment: ${amount / 100} SEK processing...`);
        console.log(`🏦 Payment method: Swedish banking (TEST mode)`);
        
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log(`✅ Mock compensation payment completed: ${amount / 100} SEK`);
      }

      // Mock customer notification
      const actionMessages = {
        refund_issued: `Full återbetalning på ${amount / 100} SEK är på väg till ditt konto.`,
        partial_refund: `Partiell återbetalning på ${amount / 100} SEK är på väg till ditt konto.`,
        no_compensation: 'Din tvist har granskats men ingen kompensation kommer att utbetalas.',
        additional_reward: `Ytterligare belöning på ${amount / 100} SEK är på väg till ditt konto.`
      };

      console.log(`📧 Mock notification to customer: ${actionMessages[action as keyof typeof actionMessages]}`);
      console.log(`📝 Resolution details: ${description}`);

      const response: APIResponse<{
        resolution: typeof resolution;
        message: string;
        paymentProcessed: boolean;
      }> = {
        success: true,
        data: {
          resolution,
          message: `Tvist ${disputeId} löst med åtgärd: ${action}`,
          paymentProcessed: amount > 0
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Resolve dispute error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RESOLVE_DISPUTE_ERROR',
          message: 'Failed to resolve dispute'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/history/{businessId}:
 *   get:
 *     summary: Get payment history for business (MOCK)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, completed, failed, refunded]
 *     responses:
 *       200:
 *         description: Payment history
 */
// Get payment history for business (MOCK)
router.get('/history/:businessId',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be >= 0'),
    query('status').optional().isIn(['pending', 'completed', 'failed', 'refunded']).withMessage('Valid status required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid query parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const { limit = 50, offset = 0, status } = req.query;

      // Mock payment history data
      const mockPayments = [
        {
          id: 'payment-001',
          type: 'customer_payout',
          amount: 2500, // 25 SEK
          currency: 'sek',
          businessId,
          customerId: 'customer-123',
          sessionId: 'session-abc',
          transactionId: 'trans-001',
          stripeTransferId: 'tr_test_123',
          status: 'completed',
          qualityScore: 85,
          rewardTier: 'good',
          paymentMethod: 'swish',
          recipientDetails: {
            type: 'swish',
            phone: '+46701234567',
            name: 'Anna Larsson'
          },
          createdAt: '2024-08-24T14:30:00Z',
          completedAt: '2024-08-24T14:30:42Z',
          processingTimeMs: 742
        },
        {
          id: 'payment-002',
          type: 'customer_payout',
          amount: 4200, // 42 SEK
          currency: 'sek',
          businessId,
          customerId: 'customer-456',
          sessionId: 'session-def',
          transactionId: 'trans-002',
          stripeTransferId: 'tr_test_456',
          status: 'completed',
          qualityScore: 92,
          rewardTier: 'excellent',
          paymentMethod: 'bankgiro',
          recipientDetails: {
            type: 'bankgiro',
            accountNumber: '123-4567',
            name: 'Erik Svensson'
          },
          createdAt: '2024-08-24T13:15:00Z',
          completedAt: '2024-08-24T13:15:28Z',
          processingTimeMs: 628
        },
        {
          id: 'payment-003',
          type: 'customer_payout',
          amount: 1800, // 18 SEK
          currency: 'sek',
          businessId,
          customerId: 'customer-789',
          sessionId: 'session-ghi',
          transactionId: 'trans-003',
          stripeTransferId: 'tr_test_789',
          status: 'failed',
          qualityScore: 78,
          rewardTier: 'fair',
          paymentMethod: 'iban',
          recipientDetails: {
            type: 'iban',
            iban: 'SE35 5000 0000 0549 1000 0003',
            name: 'Maria Johansson'
          },
          failureReason: 'Invalid IBAN format',
          createdAt: '2024-08-24T12:00:00Z',
          failedAt: '2024-08-24T12:00:15Z',
          processingTimeMs: 15000,
          retryAttempts: 3,
          nextRetryAt: '2024-08-24T18:00:00Z'
        },
        {
          id: 'payment-004',
          type: 'commission_payment',
          amount: 500, // 5 SEK (20% of 25 SEK)
          currency: 'sek',
          businessId,
          description: 'Plattformskommission för feedback session-abc',
          status: 'completed',
          createdAt: '2024-08-24T14:30:00Z',
          completedAt: '2024-08-24T14:30:45Z',
          processingTimeMs: 745
        },
        {
          id: 'payment-005',
          type: 'dispute_refund',
          amount: 3200, // 32 SEK
          currency: 'sek',
          businessId,
          customerId: 'customer-101',
          disputeId: 'dispute-003',
          reason: 'Technical error compensation',
          status: 'completed',
          createdAt: '2024-08-23T10:20:00Z',
          completedAt: '2024-08-23T10:20:18Z',
          processingTimeMs: 518
        }
      ];

      // Filter by status if provided
      let filteredPayments = mockPayments;
      if (status) {
        filteredPayments = mockPayments.filter(p => p.status === status);
      }

      // Apply pagination
      const paginatedPayments = filteredPayments.slice(
        parseInt(offset as string),
        parseInt(offset as string) + parseInt(limit as string)
      );

      // Calculate summary statistics
      const summary = {
        totalPayments: filteredPayments.length,
        totalAmount: filteredPayments.reduce((sum, p) => sum + p.amount, 0),
        successfulPayments: filteredPayments.filter(p => p.status === 'completed').length,
        failedPayments: filteredPayments.filter(p => p.status === 'failed').length,
        averageProcessingTime: Math.round(
          filteredPayments
            .filter(p => p.processingTimeMs)
            .reduce((sum, p) => sum + (p.processingTimeMs || 0), 0) /
          filteredPayments.filter(p => p.processingTimeMs).length
        ),
        paymentsByType: {
          customer_payout: filteredPayments.filter(p => p.type === 'customer_payout').length,
          commission_payment: filteredPayments.filter(p => p.type === 'commission_payment').length,
          dispute_refund: filteredPayments.filter(p => p.type === 'dispute_refund').length
        }
      };

      const response: APIResponse<{
        payments: typeof paginatedPayments;
        summary: typeof summary;
        pagination: {
          limit: number;
          offset: number;
          total: number;
          hasMore: boolean;
        };
      }> = {
        success: true,
        data: {
          payments: paginatedPayments,
          summary,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            total: filteredPayments.length,
            hasMore: parseInt(offset as string) + parseInt(limit as string) < filteredPayments.length
          }
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get payment history error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_HISTORY_ERROR',
          message: 'Failed to get payment history'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/tracking/{paymentId}:
 *   get:
 *     summary: Track individual payment status (MOCK)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment tracking details
 */
// Track individual payment status (MOCK)
router.get('/tracking/:paymentId',
  [
    param('paymentId').notEmpty().withMessage('Payment ID required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid payment ID'
        }
      });
    }

    try {
      const { paymentId } = req.params;

      // Mock payment tracking data
      const mockTrackingData = {
        id: paymentId,
        status: 'completed',
        amount: 2500, // 25 SEK
        currency: 'sek',
        paymentMethod: 'swish',
        recipient: {
          type: 'swish',
          phone: '+46701234567',
          name: 'Anna Larsson'
        },
        timeline: [
          {
            timestamp: '2024-08-24T14:30:00Z',
            status: 'created',
            description: 'Betalning skapad efter godkänd feedback',
            details: {
              sessionId: 'session-abc',
              qualityScore: 85,
              rewardAmount: 2500
            }
          },
          {
            timestamp: '2024-08-24T14:30:05Z',
            status: 'processing',
            description: 'Betalning skickas till Stripe för hantering',
            details: {
              stripeTransferId: 'tr_test_123',
              processingMethod: 'instant_transfer'
            }
          },
          {
            timestamp: '2024-08-24T14:30:25Z',
            status: 'sent_to_bank',
            description: 'Betalning skickad till mottagarens bank',
            details: {
              bankCode: 'SWEDSESS',
              estimatedArrival: '2024-08-24T14:35:00Z'
            }
          },
          {
            timestamp: '2024-08-24T14:30:42Z',
            status: 'completed',
            description: 'Betalning slutförd - mottagaren har fått pengarna',
            details: {
              confirmationCode: 'SWISH-123456789',
              totalProcessingTime: '42 sekunder'
            }
          }
        ],
        metadata: {
          businessId: 'business-123',
          customerId: 'customer-123',
          sessionId: 'session-abc',
          qualityScore: 85,
          rewardTier: 'good',
          fraudRiskScore: 0.15,
          processingFee: 50, // 0.5 SEK
          netAmount: 2450 // 24.5 SEK
        },
        estimatedArrival: '2024-08-24T14:35:00Z',
        actualArrival: '2024-08-24T14:30:42Z'
      };

      const response: APIResponse<{
        tracking: typeof mockTrackingData;
        canRefund: boolean;
        canDispute: boolean;
      }> = {
        success: true,
        data: {
          tracking: mockTrackingData,
          canRefund: mockTrackingData.status === 'completed' && 
                    (Date.now() - new Date(mockTrackingData.timeline[0].timestamp).getTime()) < 7 * 24 * 60 * 60 * 1000, // 7 days
          canDispute: mockTrackingData.status === 'completed' || mockTrackingData.status === 'failed'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Payment tracking error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_TRACKING_ERROR',
          message: 'Failed to get payment tracking'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/analytics/{businessId}:
 *   get:
 *     summary: Get payment analytics for business (MOCK)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Payment analytics data
 */
// Get payment analytics for business (MOCK)
router.get('/analytics/:businessId',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    query('period').optional().isIn(['day', 'week', 'month', 'quarter', 'year']).withMessage('Valid period required'),
    query('startDate').optional().isISO8601().withMessage('Valid start date required'),
    query('endDate').optional().isISO8601().withMessage('Valid end date required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid analytics parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const { period = 'month' } = req.query;

      // Mock analytics data
      const mockAnalytics = {
        summary: {
          totalPayments: 247,
          totalAmount: 618500, // 6,185 SEK
          averagePaymentAmount: 2505, // 25.05 SEK
          successRate: 96.8, // percentage
          totalCommissions: 123700, // 1,237 SEK (20%)
          netRevenue: 494800 // 4,948 SEK
        },
        trends: {
          paymentsOverTime: [
            { date: '2024-08-17', payments: 32, amount: 80000 },
            { date: '2024-08-18', payments: 28, amount: 70000 },
            { date: '2024-08-19', payments: 45, amount: 112500 },
            { date: '2024-08-20', payments: 38, amount: 95000 },
            { date: '2024-08-21', payments: 41, amount: 102500 },
            { date: '2024-08-22', payments: 29, amount: 72500 },
            { date: '2024-08-23', payments: 34, amount: 85000 }
          ],
          successRateOverTime: [
            { date: '2024-08-17', rate: 95.2 },
            { date: '2024-08-18', rate: 97.1 },
            { date: '2024-08-19', rate: 96.8 },
            { date: '2024-08-20', rate: 98.2 },
            { date: '2024-08-21', rate: 96.5 },
            { date: '2024-08-22', rate: 95.8 },
            { date: '2024-08-23', rate: 97.3 }
          ]
        },
        paymentMethods: {
          swish: { count: 142, percentage: 57.5, averageAmount: 2480 },
          bankgiro: { count: 68, percentage: 27.5, averageAmount: 2520 },
          iban: { count: 37, percentage: 15.0, averageAmount: 2580 }
        },
        qualityTiers: {
          excellent: { count: 45, percentage: 18.2, averageAmount: 4200 },
          good: { count: 89, percentage: 36.0, averageAmount: 2800 },
          fair: { count: 76, percentage: 30.8, averageAmount: 2100 },
          insufficient: { count: 37, percentage: 15.0, averageAmount: 1200 }
        },
        processing: {
          averageProcessingTime: 687, // milliseconds
          fastestPayment: 342, // milliseconds
          slowestPayment: 1250, // milliseconds
          failureReasons: {
            'invalid_account': 5,
            'insufficient_funds': 2,
            'network_error': 1,
            'fraud_prevention': 1
          }
        },
        geography: {
          stockholm: { count: 89, percentage: 36.0 },
          gothenburg: { count: 67, percentage: 27.1 },
          malmö: { count: 45, percentage: 18.2 },
          other: { count: 46, percentage: 18.7 }
        },
        hourlyDistribution: [
          { hour: 9, count: 12, amount: 30000 },
          { hour: 10, count: 18, amount: 45000 },
          { hour: 11, count: 25, amount: 62500 },
          { hour: 12, count: 32, amount: 80000 },
          { hour: 13, count: 28, amount: 70000 },
          { hour: 14, count: 35, amount: 87500 },
          { hour: 15, count: 31, amount: 77500 },
          { hour: 16, count: 27, amount: 67500 },
          { hour: 17, count: 22, amount: 55000 },
          { hour: 18, count: 17, amount: 42500 }
        ]
      };

      const response: APIResponse<{
        analytics: typeof mockAnalytics;
        period: string;
        businessId: string;
        generatedAt: string;
      }> = {
        success: true,
        data: {
          analytics: mockAnalytics,
          period: period as string,
          businessId,
          generatedAt: new Date().toISOString()
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Payment analytics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_ANALYTICS_ERROR',
          message: 'Failed to get payment analytics'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/payments/retry/{paymentId}:
 *   post:
 *     summary: Retry failed payment (MOCK)
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [swish, bankgiro, iban]
 *               recipientDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Payment retry initiated
 */
// Retry failed payment (MOCK)
router.post('/retry/:paymentId',
  [
    param('paymentId').notEmpty().withMessage('Payment ID required'),
    body('paymentMethod').optional().isIn(['swish', 'bankgiro', 'iban']).withMessage('Valid payment method required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid retry parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { paymentId } = req.params;
      const { paymentMethod, recipientDetails } = req.body;

      // Mock retry processing
      console.log(`🔄 Retrying payment ${paymentId}...`);
      
      if (paymentMethod) {
        console.log(`📝 Updated payment method: ${paymentMethod}`);
      }
      
      if (recipientDetails) {
        console.log(`📝 Updated recipient details:`, recipientDetails);
      }

      // Simulate retry processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      const retryResult = {
        paymentId,
        status: 'processing',
        retryAttempt: 4,
        estimatedCompletion: new Date(Date.now() + 30000).toISOString(), // 30 seconds
        message: 'Betalning försöks igen med uppdaterade uppgifter'
      };

      const response: APIResponse<{
        retry: typeof retryResult;
        trackingUrl: string;
      }> = {
        success: true,
        data: {
          retry: retryResult,
          trackingUrl: `/api/payments/tracking/${paymentId}`
        }
      };

      console.log(`✅ Payment retry initiated for ${paymentId}`);
      res.json(response);
    } catch (error) {
      console.error('Payment retry error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_RETRY_ERROR',
          message: 'Failed to retry payment'
        }
      });
    }
  }
);

export { router as paymentsRoutes };