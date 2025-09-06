import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '@ai-feedback/database';
import { createDeviceFingerprint, encryptQRPayload, decryptQRPayload } from '../utils/crypto';
import type { QRPayload, APIResponse, FeedbackSession } from '@ai-feedback/shared-types';

const router = Router();

/**
 * @openapi
 * /api/qr/generate:
 *   post:
 *     summary: Generate QR for business/location
 *     tags: [QR]
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: QR URL returned
 */
// Generate QR code for business location
router.post('/generate',
  [
    body('businessId').isUUID('4').withMessage('Valid business ID required'),
    body('locationId').optional().isUUID('4').withMessage('Valid location ID required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { businessId, locationId } = req.body;

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

      // Create QR payload
      const qrPayload: QRPayload = {
        v: 1, // version
        b: businessId,
        l: locationId,
        t: Date.now()
      };

      // Encrypt payload
      const encryptedPayload = encryptQRPayload(qrPayload);
      const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL}/feedback?q=${encryptedPayload}`;

      const response: APIResponse<{ qrUrl: string; payload: QRPayload }> = {
        success: true,
        data: {
          qrUrl,
          payload: qrPayload
        }
      };

      res.json(response);
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QR_GENERATION_ERROR',
          message: 'Failed to generate QR code'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/qr/scan:
 *   post:
 *     summary: Validate QR scan and create session
 *     tags: [QR]
 *     responses:
 *       200:
 *         description: Session created
 */
// Validate QR scan and create feedback session
router.post('/scan',
  [
    body('qrToken').notEmpty().withMessage('QR token is required'),
    body('deviceFingerprint').isObject().withMessage('Device fingerprint is required'),
    body('customerPhone').optional().isMobilePhone('sv-SE').withMessage('Valid Swedish phone number required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input parameters',
          details: errors.array()
        }
      });
    }

    try {
      const { qrToken, deviceFingerprint, customerPhone } = req.body;

      // Decrypt and validate QR payload
      let qrPayload: QRPayload;
      try {
        qrPayload = decryptQRPayload(qrToken);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_QR_TOKEN',
            message: 'Invalid or corrupted QR token'
          }
        });
      }

      // Check QR token age (15 minute window)
      const tokenAge = Date.now() - qrPayload.t;
      const maxAge = 15 * 60 * 1000; // 15 minutes
      
      if (tokenAge > maxAge) {
        return res.status(410).json({
          success: false,
          error: {
            code: 'QR_TOKEN_EXPIRED',
            message: 'QR code has expired. Please scan a new code.'
          }
        });
      }

      // Verify business exists and is active
      const business = await db.getBusiness(qrPayload.b);
      if (!business || business.status !== 'active') {
        return res.status(404).json({
          success: false,
          error: {
            code: 'BUSINESS_UNAVAILABLE',
            message: 'Business is not available for feedback'
          }
        });
      }

      // Create customer hash for anonymous identification
      const customerHash = createDeviceFingerprint(deviceFingerprint, customerPhone);

      // Generate unique session QR token
      const sessionQRToken = db.generateQRToken();

      // Create feedback session
      const sessionData: Omit<FeedbackSession, 'id' | 'createdAt' | 'updatedAt'> = {
        businessId: qrPayload.b,
        locationId: qrPayload.l,
        customerHash,
        deviceFingerprint,
        qrToken: sessionQRToken,
        qrScannedAt: new Date().toISOString(),
        transcriptLanguage: 'sv',
        fraudReviewStatus: 'auto',
        status: 'qr_scanned'
      };

      const session = await db.createFeedbackSession(sessionData);

      const response: APIResponse<{
        sessionId: string;
        businessName: string;
        qrToken: string;
        maxRewardAmount?: number;
      }> = {
        success: true,
        data: {
          sessionId: session.id,
          businessName: business.name,
          qrToken: sessionQRToken,
          maxRewardAmount: business.reward_settings?.reward_tiers?.exceptional?.reward?.[1] 
            ? business.reward_settings.reward_tiers.exceptional.reward[1] * 100 // Convert to percentage
            : undefined
        }
      };

      res.json(response);
    } catch (error) {
      console.error('QR scan error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'QR_SCAN_ERROR',
          message: 'Failed to process QR scan'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/qr/session/{sessionId}/validate:
 *   get:
 *     summary: Validate session token
 *     tags: [QR]
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session validity info
 */
// Validate session token
router.get('/session/:sessionId/validate',
  [
    param('sessionId').isUUID('4').withMessage('Valid session ID required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid session ID'
        }
      });
    }

    try {
      const { sessionId } = req.params;

      const session = await db.getFeedbackSession(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'SESSION_NOT_FOUND',
            message: 'Session not found'
          }
        });
      }

      // Check session is still valid for recording
      const validStatuses = ['qr_scanned', 'transaction_verified', 'recording'];
      if (!validStatuses.includes(session.status)) {
        return res.status(410).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session is no longer active'
          }
        });
      }

      // Check session age (30 minute window for completion)
      const sessionAge = Date.now() - new Date(session.qr_scanned_at).getTime();
      const maxSessionAge = 30 * 60 * 1000; // 30 minutes
      
      if (sessionAge > maxSessionAge) {
        return res.status(410).json({
          success: false,
          error: {
            code: 'SESSION_EXPIRED',
            message: 'Session has expired'
          }
        });
      }

      const response: APIResponse<{
        sessionId: string;
        status: string;
        remainingTime: number;
      }> = {
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          remainingTime: Math.max(0, maxSessionAge - sessionAge)
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Session validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Failed to validate session'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/qr/create-simple-session:
 *   post:
 *     summary: Create session for simple verification flow
 *     tags: [QR]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeCode, deviceFingerprint]
 *             properties:
 *               storeCode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *               deviceFingerprint:
 *                 type: object
 *     responses:
 *       201:
 *         description: Session created successfully
 *       400:
 *         description: Invalid store code or request data
 */
router.post('/create-simple-session',
  [
    body('storeCode').matches(/^[0-9]{6}$/).withMessage('Store code must be 6 digits'),
    body('deviceFingerprint').isObject().withMessage('Device fingerprint required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      } as APIResponse);
    }

    try {
      const { storeCode, deviceFingerprint } = req.body;

      // Validate store code
      const storeCodeRecord = await db.storeCode.findFirst({
        where: {
          code: storeCode,
          active: true,
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              simpleVerificationSettings: true,
              status: true
            }
          },
          location: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!storeCodeRecord) {
        return res.status(400).json({
          success: false,
          error: 'Invalid or expired store code'
        } as APIResponse);
      }

      // Check if business has simple verification enabled
      const settings = storeCodeRecord.business.simpleVerificationSettings as any;
      if (!settings || !settings.enabled) {
        return res.status(400).json({
          success: false,
          error: 'Simple verification not enabled for this business'
        } as APIResponse);
      }

      // Check business status
      if (storeCodeRecord.business.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Business is not available for feedback'
        } as APIResponse);
      }

      // Create customer hash for anonymous identification
      const customerHash = createDeviceFingerprint(deviceFingerprint, '');

      // Create feedback session for simple verification
      const sessionData = {
        businessId: storeCodeRecord.business.id,
        locationId: storeCodeRecord.location?.id,
        customerHash,
        deviceFingerprint,
        qrToken: '', // Not used in simple verification
        qrScannedAt: new Date().toISOString(),
        transcriptLanguage: 'sv',
        fraudReviewStatus: 'auto',
        status: 'qr_scanned',
        verificationType: 'simple_verification'
      };

      const session = await db.createFeedbackSession(sessionData);

      const response: APIResponse<{
        sessionId: string;
        businessName: string;
        locationName?: string;
      }> = {
        success: true,
        data: {
          sessionId: session.id,
          businessName: storeCodeRecord.business.name,
          locationName: storeCodeRecord.location?.name
        }
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Simple session creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during session creation'
      } as APIResponse);
    }
  }
);

export { router as qrRoutes };