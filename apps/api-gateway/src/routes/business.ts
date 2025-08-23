import { Router, type Request, type Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '@ai-feedback/database';
import type { APIResponse, Business, POSConnection } from '@ai-feedback/shared-types';

const router = Router();

/**
 * @openapi
 * /api/business/{businessId}/dashboard:
 *   get:
 *     summary: Business dashboard data
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Dashboard data
 */
// Get business dashboard data
router.get('/:businessId/dashboard',
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1-365')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      // Verify business exists
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

      // Get analytics data
      const analytics = await db.getBusinessAnalytics(businessId, days);

      // Get recent feedback sessions
      const recentSessions = await db.getFeedbackSessionsByBusiness(businessId, 10);

      const response: APIResponse<{
        business: {
          id: string;
          name: string;
          status: string;
          trialFeedbacksRemaining: number;
        };
        analytics: {
          totalSessions: number;
          averageQuality: number;
          totalRewards: number;
          topCategories: Array<{ category: string; count: number }>;
        };
        recentSessions: Array<{
          id: string;
          qualityScore: number;
          rewardAmount: number;
          categories: string[];
          createdAt: string;
        }>;
      }> = {
        success: true,
        data: {
          business: {
            id: business.id,
            name: business.name,
            status: business.status,
            trialFeedbacksRemaining: business.trial_feedbacks_remaining
          },
          analytics,
          recentSessions: recentSessions.map(session => ({
            id: session.id,
            qualityScore: session.quality_score || 0,
            rewardAmount: parseFloat(session.reward_amount?.toString() || '0'),
            categories: session.feedback_categories || [],
            createdAt: session.created_at
          }))
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Business dashboard error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DASHBOARD_ERROR',
          message: 'Failed to load dashboard data'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business:
 *   post:
 *     summary: Create business
 *     tags: [Business]
 *     responses:
 *       201:
 *         description: Business created
 */
// Create new business
router.post('/',
  [
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Business name must be 2-100 characters'),
    body('email').isEmail().withMessage('Valid email address required'),
    body('orgNumber').optional().matches(/^\d{6}-\d{4}$/).withMessage('Valid Swedish organization number required (XXXXXX-XXXX)'),
    body('phone').optional().isMobilePhone('sv-SE').withMessage('Valid Swedish phone number required'),
    body('address').optional().isObject().withMessage('Address must be an object')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid business data',
          details: errors.array()
        }
      });
    }

    try {
      const businessData = req.body;

      // Check if business with this email already exists
      const { data: existingBusiness } = await db.client
        .from('businesses')
        .select('id')
        .eq('email', businessData.email)
        .single();

      if (existingBusiness) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'BUSINESS_EXISTS',
            message: 'Business with this email already exists'
          }
        });
      }

      const business = await db.createBusiness(businessData);

      const response: APIResponse<{ business: Business }> = {
        success: true,
        data: { business }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create business error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_BUSINESS_ERROR',
          message: 'Failed to create business'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}:
 *   put:
 *     summary: Update business
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Business updated
 */
// Update business settings
router.put('/:businessId',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Business name must be 2-100 characters'),
    body('phone').optional().isMobilePhone('sv-SE').withMessage('Valid Swedish phone number required'),
    body('address').optional().isObject().withMessage('Address must be an object'),
    body('rewardSettings').optional().isObject().withMessage('Reward settings must be an object')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid business data',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const updates = req.body;

      const business = await db.updateBusiness(businessId, updates);

      const response: APIResponse<{ business: Business }> = {
        success: true,
        data: { business }
      };

      res.json(response);
    } catch (error) {
      console.error('Update business error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_BUSINESS_ERROR',
          message: 'Failed to update business'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/pos:
 *   get:
 *     summary: Get POS connections
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: POS connections
 */
// Get POS connections
router.get('/:businessId/pos',
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

      const connections = await db.getPOSConnections(businessId);

      // Remove sensitive credentials from response
      const sanitizedConnections = connections.map(conn => ({
        ...conn,
        credentials: undefined // Don't expose encrypted credentials
      }));

      const response: APIResponse<{ connections: POSConnection[] }> = {
        success: true,
        data: { connections: sanitizedConnections }
      };

      res.json(response);
    } catch (error) {
      console.error('Get POS connections error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'POS_CONNECTIONS_ERROR',
          message: 'Failed to get POS connections'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/pos:
 *   post:
 *     summary: Add POS connection
 *     tags: [Business]
 *     responses:
 *       201:
 *         description: Connection created
 */
// Add POS connection
router.post('/:businessId/pos',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    body('provider').isIn(['square', 'shopify', 'zettle']).withMessage('Provider must be square, shopify, or zettle'),
    body('providerAccountId').trim().notEmpty().withMessage('Provider account ID required'),
    body('credentials').isObject().withMessage('Credentials object required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid POS connection data',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const { provider, providerAccountId, credentials } = req.body;

      // Check if connection already exists
      const { data: existingConnection } = await db.client
        .from('pos_connections')
        .select('id')
        .eq('business_id', businessId)
        .eq('provider', provider)
        .single();

      if (existingConnection) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'CONNECTION_EXISTS',
            message: `${provider} connection already exists for this business`
          }
        });
      }

      const connectionData: Omit<POSConnection, 'id' | 'createdAt' | 'updatedAt'> = {
        businessId,
        provider,
        providerAccountId,
        credentials, // TODO: Encrypt these credentials
        syncStatus: 'connected',
        active: true
      };

      const connection = await db.createPOSConnection(connectionData);

      // Remove credentials from response
      const sanitizedConnection = { ...connection, credentials: undefined };

      const response: APIResponse<{ connection: POSConnection }> = {
        success: true,
        data: { connection: sanitizedConnection }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create POS connection error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_POS_CONNECTION_ERROR',
          message: 'Failed to create POS connection'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/qr:
 *   post:
 *     summary: Generate QR for business
 *     tags: [Business]
 *     responses:
 *       200:
 *         description: QR URL
 */
// Generate QR code for business
router.post('/:businessId/qr',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    body('locationId').optional().isUUID('4').withMessage('Valid location ID required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const { locationId } = req.body;

      // Forward to QR route
      req.body = { businessId, locationId };
      // We could call the QR generation logic directly here
      // For now, return a placeholder response
      
      const response: APIResponse<{ qrUrl: string; message: string }> = {
        success: true,
        data: {
          qrUrl: `${process.env.NEXT_PUBLIC_APP_URL}/feedback?b=${businessId}${locationId ? `&l=${locationId}` : ''}`,
          message: 'Use the /api/qr/generate endpoint for full QR generation functionality'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Generate QR error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GENERATE_QR_ERROR',
          message: 'Failed to generate QR code'
        }
      });
    }
  }
);

export { router as businessRoutes };