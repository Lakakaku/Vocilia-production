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

      // Get recent feedback sessions (with proper verification filtering for delayed delivery)
      const recentSessions = await db.getFeedbackSessionsWithVerification(businessId, 10, false);

      // Get pending feedback awaiting verification release (if using simple verification)
      const pendingFeedback = await db.getPendingFeedbackSessions(businessId);

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
        pendingFeedback: {
          count: number;
          awaitingVerificationRelease: number;
        };
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
          })),
          pendingFeedback: {
            count: pendingFeedback.length,
            awaitingVerificationRelease: pendingFeedback.length
          }
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
    body('address').optional().isObject().withMessage('Address must be an object'),
    body('createStripeAccount').optional().isBoolean().withMessage('Create Stripe account flag must be boolean'),
    body('verificationMethod').optional().isIn(['pos_integration', 'simple_verification']).withMessage('Verification method must be pos_integration or simple_verification')
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
      const { createStripeAccount = true, verificationMethod = 'pos_integration', ...businessData } = req.body;

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

      // Create business with verification method
      const business = await db.createBusiness({
        ...businessData,
        verificationMethod,
        verificationPreferences: {
          pos_integration: {
            preferred_provider: null,
            auto_connect: verificationMethod === 'pos_integration',
            require_transaction_match: true
          },
          simple_verification: {
            enabled: verificationMethod === 'simple_verification',
            verification_tolerance: {
              time_minutes: 5,
              amount_sek: 0.5
            },
            review_period_days: 14,
            auto_approve_threshold: 0.1,
            daily_limits: {
              max_per_phone: 3,
              max_per_ip: 10
            },
            fraud_settings: {
              auto_reject_threshold: 0.7,
              manual_review_threshold: 0.3
            }
          }
        }
      });

      // Create store code for simple verification businesses
      let storeCode = null;
      if (verificationMethod === 'simple_verification') {
        try {
          // Generate a unique 6-digit store code
          let code: string;
          let isUnique = false;
          let attempts = 0;
          
          do {
            // Generate random 6-digit code
            code = Math.floor(100000 + Math.random() * 900000).toString();
            
            // Check if code is unique
            const { data: existingCode } = await db.client
              .from('store_codes')
              .select('id')
              .eq('code', code)
              .single();
              
            isUnique = !existingCode;
            attempts++;
          } while (!isUnique && attempts < 10);
          
          if (!isUnique) {
            throw new Error('Could not generate unique store code');
          }
          
          // Create store code record
          const { data: storeCodeData, error } = await db.client
            .from('store_codes')
            .insert({
              business_id: business.id,
              code,
              name: 'Main Store Code',
              active: true,
              expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
            })
            .select()
            .single();
            
          if (error) throw error;
          storeCode = code;
          
          console.log(`🏪 Generated store code ${code} for simple verification business ${business.id}`);
        } catch (storeCodeError) {
          console.error('Store code creation failed:', storeCodeError);
          // Continue without store code - can be created later
        }
      }

      // Create Stripe Connect TEST account if requested and using POS integration
      let stripeAccountId = null;
      let onboardingUrl = null;
      
      if (createStripeAccount) {
        try {
          const { stripeService, SwedishBusinessAccount } = await import('../services/stripe-connect');
          
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
          stripeAccountId = account.id;

          // Update business with Stripe account ID
          await db.updateBusiness(business.id, {
            stripe_account_id: account.id,
            updated_at: new Date().toISOString()
          });

          // Create onboarding link for immediate use
          const accountLink = await stripeService.createAccountLink(
            account.id,
            `${process.env.NEXT_PUBLIC_BUSINESS_URL}/onboarding/refresh`,
            `${process.env.NEXT_PUBLIC_BUSINESS_URL}/onboarding/complete`
          );
          onboardingUrl = accountLink.url;

          console.log(`✅ Created Stripe TEST account ${account.id} for business ${business.id}`);
        } catch (stripeError) {
          console.error('Stripe account creation failed:', stripeError);
          // Continue without Stripe - can be set up later
        }
      }

      const response: APIResponse<{ 
        business: Business; 
        stripeAccountId?: string;
        onboardingUrl?: string;
        storeCode?: string;
        verification: {
          required: boolean;
          status: string;
          documents: string[];
          method: string;
        };
      }> = {
        success: true,
        data: { 
          business,
          stripeAccountId: stripeAccountId || undefined,
          onboardingUrl: onboardingUrl || undefined,
          storeCode: storeCode || undefined,
          verification: {
            required: true,
            status: 'pending',
            method: verificationMethod,
            documents: verificationMethod === 'pos_integration' ? [
              'business_registration',
              'tax_document',
              'id_verification',
              'bank_statement'
            ] : [
              'business_registration',
              'tax_document',
              'id_verification'
            ]
          }
        }
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

/**
 * @openapi
 * /api/business/{businessId}/verification:
 *   get:
 *     summary: Get business verification status
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification status
 */
// Get business verification status
router.get('/:businessId/verification',
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

      // Mock verification data - in real implementation, this would come from database
      const mockVerification = {
        id: `verification-${businessId}`,
        businessId,
        status: 'pending',
        documents: [],
        businessInfo: {
          legalName: 'Test Business AB',
          organizationNumber: '556123-4567',
          registeredAddress: 'Testgatan 123, 111 11 Stockholm',
          contactPerson: 'Test Person',
          contactEmail: 'test@example.com',
          contactPhone: '+46 8 123 456',
          businessDescription: 'Test business for development',
          website: 'https://test.example.com',
          expectedMonthlyFeedbacks: 100
        },
        requiredDocuments: [
          'business_registration',
          'tax_document', 
          'id_verification',
          'bank_statement'
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response: APIResponse<{
        verification: typeof mockVerification;
        canSubmit: boolean;
        isComplete: boolean;
      }> = {
        success: true,
        data: {
          verification: mockVerification,
          canSubmit: mockVerification.documents.length === mockVerification.requiredDocuments.length,
          isComplete: mockVerification.status === 'approved'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get verification error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VERIFICATION_ERROR',
          message: 'Failed to get verification status'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/verification/documents:
 *   post:
 *     summary: Upload verification document (MOCK)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               documentType:
 *                 type: string
 *                 enum: [business_registration, tax_document, id_verification, bank_statement]
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Document uploaded
 */
// Upload verification document (MOCK)
router.post('/:businessId/verification/documents',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    body('documentType').isIn(['business_registration', 'tax_document', 'id_verification', 'bank_statement']).withMessage('Valid document type required'),
    body('fileName').notEmpty().withMessage('File name required'),
    body('fileSize').isNumeric().withMessage('File size required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid document upload data',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const { documentType, fileName, fileSize } = req.body;

      // Validate file requirements (MOCK)
      const documentRequirements = {
        business_registration: { maxSize: 5, formats: ['pdf', 'jpg', 'png'] },
        tax_document: { maxSize: 5, formats: ['pdf', 'jpg', 'png'] },
        id_verification: { maxSize: 3, formats: ['jpg', 'png', 'pdf'] },
        bank_statement: { maxSize: 5, formats: ['pdf', 'jpg', 'png'] }
      };

      const requirements = documentRequirements[documentType as keyof typeof documentRequirements];
      const fileExtension = fileName.split('.').pop()?.toLowerCase();

      if (!requirements.formats.includes(fileExtension || '')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_FILE_FORMAT',
            message: `Filformatet ${fileExtension} stöds inte. Tillåtna format: ${requirements.formats.join(', ')}`
          }
        });
      }

      if (fileSize > requirements.maxSize * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: `Filen är för stor. Max storlek: ${requirements.maxSize}MB`
          }
        });
      }

      // Simulate document processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockDocument = {
        id: Date.now().toString(),
        type: documentType,
        name: fileName,
        url: `https://mock-storage.example.com/documents/${businessId}/${documentType}/${fileName}`,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      };

      const response: APIResponse<{
        document: typeof mockDocument;
        message: string;
      }> = {
        success: true,
        data: {
          document: mockDocument,
          message: 'Dokument uppladdades framgångsrikt'
        }
      };

      console.log(`📄 Mock document uploaded: ${documentType} for business ${businessId}`);
      res.json(response);
    } catch (error) {
      console.error('Document upload error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DOCUMENT_UPLOAD_ERROR',
          message: 'Failed to upload document'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/verification/submit:
 *   post:
 *     summary: Submit business for verification (MOCK)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification submitted
 */
// Submit business for verification (MOCK)
router.post('/:businessId/verification/submit',
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

      // Simulate verification submission processing
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update business status to submitted
      await db.updateBusiness(businessId, {
        verification_status: 'submitted',
        verification_submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

      // Mock automatic approval for TEST environment
      setTimeout(async () => {
        try {
          await db.updateBusiness(businessId, {
            verification_status: 'approved',
            verification_approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            status: 'active'
          });
          console.log(`🎉 Mock verification approved for business ${businessId}`);
        } catch (error) {
          console.error('Mock approval error:', error);
        }
      }, 3000); // Auto-approve after 3 seconds for testing

      const response: APIResponse<{
        status: string;
        message: string;
        estimatedReviewTime: string;
      }> = {
        success: true,
        data: {
          status: 'submitted',
          message: 'Din ansökan har skickats in för granskning',
          estimatedReviewTime: '3 sekunder (TEST-läge: automatisk godkännande)'
        }
      };

      console.log(`📝 Mock verification submitted for business ${businessId}`);
      res.json(response);
    } catch (error) {
      console.error('Verification submission error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VERIFICATION_SUBMISSION_ERROR',
          message: 'Failed to submit verification'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/verification/approve:
 *   post:
 *     summary: Approve business verification (ADMIN MOCK)
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Business approved
 */
// Approve business verification (ADMIN MOCK)
router.post('/:businessId/verification/approve',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    body('approvedBy').optional().isString().withMessage('Approved by must be string'),
    body('notes').optional().isString().withMessage('Notes must be string')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid approval data',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId } = req.params;
      const { approvedBy = 'TEST_ADMIN', notes = 'Automatic TEST approval' } = req.body;

      // Update business to approved status
      const business = await db.updateBusiness(businessId, {
        verification_status: 'approved',
        verification_approved_at: new Date().toISOString(),
        verification_approved_by: approvedBy,
        verification_notes: notes,
        status: 'active',
        updated_at: new Date().toISOString()
      });

      const response: APIResponse<{
        business: typeof business;
        message: string;
      }> = {
        success: true,
        data: {
          business,
          message: 'Företag godkänt och aktiverat'
        }
      };

      console.log(`✅ Business ${businessId} approved by ${approvedBy}`);
      res.json(response);
    } catch (error) {
      console.error('Business approval error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'APPROVAL_ERROR',
          message: 'Failed to approve business'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/feedback/pending:
 *   get:
 *     summary: Get pending feedback awaiting verification release
 *     tags: [Business]
 *     parameters:
 *       - in: path
 *         name: businessId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pending feedback data
 */
router.get('/:businessId/feedback/pending',
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

      // Get pending feedback sessions awaiting verification release
      const pendingFeedback = await db.getPendingFeedbackSessions(businessId);

      // Group by billing batch for better organization
      const batchGroups = new Map();
      for (const session of pendingFeedback) {
        const verification = session.simple_verification;
        if (verification?.billing_batch_id) {
          const batchId = verification.billing_batch_id;
          if (!batchGroups.has(batchId)) {
            batchGroups.set(batchId, {
              batchId,
              reviewDeadline: verification.monthly_billing_batch?.review_deadline,
              sessions: []
            });
          }
          batchGroups.get(batchId).sessions.push({
            id: session.id,
            qualityScore: session.quality_score || 0,
            categories: session.feedback_categories || [],
            createdAt: session.created_at,
            verificationStatus: verification.review_status
          });
        }
      }

      const response: APIResponse<{
        totalPending: number;
        batches: Array<{
          batchId: string;
          reviewDeadline?: string;
          sessionCount: number;
          sessions: Array<{
            id: string;
            qualityScore: number;
            categories: string[];
            createdAt: string;
            verificationStatus: string;
          }>;
        }>;
        message: string;
      }> = {
        success: true,
        data: {
          totalPending: pendingFeedback.length,
          batches: Array.from(batchGroups.values()).map(batch => ({
            batchId: batch.batchId,
            reviewDeadline: batch.reviewDeadline,
            sessionCount: batch.sessions.length,
            sessions: batch.sessions
          })),
          message: pendingFeedback.length > 0 
            ? `${pendingFeedback.length} feedback sessions are verified and awaiting batch completion for release.`
            : 'No pending feedback awaiting release.'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get pending feedback error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PENDING_FEEDBACK_ERROR',
          message: 'Failed to get pending feedback'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/business/{businessId}/feedback/released:
 *   get:
 *     summary: Get released feedback (available after verification and batch completion)
 *     tags: [Business]
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
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of feedback sessions to return
 *     responses:
 *       200:
 *         description: Released feedback data
 */
router.get('/:businessId/feedback/released',
  [
    param('businessId').isUUID('4').withMessage('Valid business ID required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1-100')
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
      const limit = parseInt(req.query.limit as string) || 50;

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

      // Get released feedback sessions (only verified and batch completed)
      const releasedFeedback = await db.getFeedbackSessionsWithVerification(businessId, limit, false);

      const response: APIResponse<{
        totalReleased: number;
        feedback: Array<{
          id: string;
          qualityScore: number;
          rewardAmount: number;
          categories: string[];
          transcript?: string;
          sentiment?: number;
          createdAt: string;
          verificationType: string;
          verificationStatus?: string;
        }>;
        message: string;
      }> = {
        success: true,
        data: {
          totalReleased: releasedFeedback.length,
          feedback: releasedFeedback.map(session => ({
            id: session.id,
            qualityScore: session.quality_score || 0,
            rewardAmount: parseFloat(session.reward_amount?.toString() || '0'),
            categories: session.feedback_categories || [],
            transcript: session.transcript,
            sentiment: session.sentiment_score,
            createdAt: session.created_at,
            verificationType: session.verification_type || 'pos_integration',
            verificationStatus: session.simple_verification?.review_status
          })),
          message: releasedFeedback.length > 0 
            ? `${releasedFeedback.length} feedback sessions are available.`
            : 'No feedback available yet.'
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get released feedback error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RELEASED_FEEDBACK_ERROR',
          message: 'Failed to get released feedback'
        }
      });
    }
  }
);

export { router as businessRoutes };