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

export { router as paymentsRoutes };