import { Router, type Request, type Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '@ai-feedback/database';
import type { 
  APIResponse, 
  SimpleVerification, 
  SimpleVerificationFormData,
  SimpleVerificationReviewStatus,
  FeedbackSession 
} from '@ai-feedback/shared-types';
import { generateDeviceFingerprint } from '../utils/device-fingerprinting';
import { calculateFraudScore } from '../services/fraud-detection';
import { validateStoreCode, checkVerificationTolerance } from '../services/store-validation';

const router = Router();

/**
 * @openapi
 * /api/simple-verification/validate:
 *   post:
 *     summary: Validate store code and basic verification data
 *     tags: [Simple Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeCode, purchaseTime, purchaseAmount]
 *             properties:
 *               storeCode:
 *                 type: string
 *                 description: 6-digit store code
 *                 pattern: '^[0-9]{6}$'
 *               purchaseTime:
 *                 type: string
 *                 format: date-time
 *                 description: When customer claims purchase was made
 *               purchaseAmount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 50000
 *                 description: Purchase amount in SEK
 *     responses:
 *       200:
 *         description: Store code validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 businessName:
 *                   type: string
 *                 locationName:
 *                   type: string
 *                 verificationSettings:
 *                   type: object
 *       400:
 *         description: Invalid request data
 */
router.post('/validate', [
  body('storeCode')
    .matches(/^[0-9]{6}$/)
    .withMessage('Store code must be exactly 6 digits'),
  body('purchaseTime')
    .isISO8601()
    .withMessage('Purchase time must be valid ISO 8601 date'),
  body('purchaseAmount')
    .isFloat({ min: 1, max: 50000 })
    .withMessage('Purchase amount must be between 1 and 50,000 SEK')
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

    const { storeCode, purchaseTime, purchaseAmount } = req.body;

    // Validate store code exists and is active
    const storeInfo = await validateStoreCode(storeCode);
    if (!storeInfo.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive store code'
      } as APIResponse);
    }

    // Check if purchase time/amount are within tolerance
    const toleranceCheck = await checkVerificationTolerance(
      storeInfo.businessId!,
      new Date(purchaseTime),
      purchaseAmount
    );

    res.json({
      success: true,
      data: {
        valid: toleranceCheck.withinTolerance,
        businessName: storeInfo.businessName,
        locationName: storeInfo.locationName,
        verificationSettings: storeInfo.verificationSettings,
        toleranceIssues: toleranceCheck.issues
      }
    } as APIResponse);

  } catch (error) {
    console.error('Store code validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during validation'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/simple-verification/create:
 *   post:
 *     summary: Create simple verification for feedback session
 *     tags: [Simple Verification]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, storeCode, purchaseTime, purchaseAmount, customerPhone]
 *             properties:
 *               sessionId:
 *                 type: string
 *                 description: Feedback session ID
 *               storeCode:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *               purchaseTime:
 *                 type: string
 *                 format: date-time
 *               purchaseAmount:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 50000
 *               customerPhone:
 *                 type: string
 *                 pattern: '^(\+46|0)[0-9]{8,9}$'
 *                 description: Swedish phone number for Swish payment
 *     responses:
 *       201:
 *         description: Simple verification created successfully
 *       400:
 *         description: Invalid request data or verification failed
 */
router.post('/create', [
  body('sessionId').isUUID().withMessage('Session ID must be valid UUID'),
  body('storeCode').matches(/^[0-9]{6}$/).withMessage('Invalid store code format'),
  body('purchaseTime').isISO8601().withMessage('Invalid purchase time format'),
  body('purchaseAmount').isFloat({ min: 1, max: 50000 }).withMessage('Invalid purchase amount'),
  body('customerPhone').matches(/^(\+46|0)[0-9]{8,9}$/).withMessage('Invalid Swedish phone number format')
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

    const { sessionId, storeCode, purchaseTime, purchaseAmount, customerPhone } = req.body;

    // Check if session exists and is pending
    const session = await db.feedbackSession.findUnique({
      where: { id: sessionId },
      include: { qrCode: { include: { location: { include: { business: true } } } } }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Feedback session not found'
      } as APIResponse);
    }

    if (session.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Session is not in pending state'
      } as APIResponse);
    }

    // Validate store code
    const storeInfo = await validateStoreCode(storeCode);
    if (!storeInfo.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or inactive store code'
      } as APIResponse);
    }

    // Check daily limits for phone number and IP
    const deviceFingerprint = generateDeviceFingerprint(req);
    const dailyLimits = await checkDailyLimits(customerPhone, req.ip, storeInfo.businessId!);
    
    if (!dailyLimits.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Daily verification limit exceeded',
        details: dailyLimits.reason
      } as APIResponse);
    }

    // Calculate fraud score
    const fraudAnalysis = await calculateFraudScore({
      customerPhone,
      purchaseAmount,
      purchaseTime: new Date(purchaseTime),
      deviceFingerprint,
      businessId: storeInfo.businessId!,
      ipAddress: req.ip || 'unknown'
    });

    // Determine review status based on fraud score
    const settings = storeInfo.verificationSettings;
    let reviewStatus: SimpleVerificationReviewStatus = 'pending';
    
    if (fraudAnalysis.score >= settings.fraudSettings.autoRejectThreshold) {
      reviewStatus = 'rejected';
    } else if (fraudAnalysis.score <= settings.autoApproveThreshold) {
      reviewStatus = 'auto_approved';
    }

    // Create simple verification record
    const verification = await db.simpleVerification.create({
      data: {
        sessionId,
        businessId: storeInfo.businessId!,
        locationId: storeInfo.locationId,
        storeCode,
        purchaseTime: new Date(purchaseTime),
        purchaseAmount,
        customerPhone,
        deviceFingerprint: deviceFingerprint as any,
        ipAddress: req.ip || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        reviewStatus,
        rejectionReason: reviewStatus === 'rejected' ? 'Automatic rejection due to high fraud score' : undefined,
        reviewedBy: reviewStatus === 'auto_approved' ? 'system' : undefined,
        reviewedAt: reviewStatus !== 'pending' ? new Date() : undefined,
        fraudScore: fraudAnalysis.score,
        fraudFlags: fraudAnalysis.flags as any
      }
    });

    // Update feedback session to reference simple verification
    await db.feedbackSession.update({
      where: { id: sessionId },
      data: {
        verificationType: 'simple_verification',
        simpleVerificationId: verification.id
      }
    });

    res.status(201).json({
      success: true,
      data: {
        verificationId: verification.id,
        reviewStatus: verification.reviewStatus,
        fraudScore: verification.fraudScore,
        autoApproved: reviewStatus === 'auto_approved'
      }
    } as APIResponse);

  } catch (error) {
    console.error('Simple verification creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during verification creation'
    } as APIResponse);
  }
});

/**
 * @openapi
 * /api/simple-verification/status/{verificationId}:
 *   get:
 *     summary: Get verification status
 *     tags: [Simple Verification]
 *     parameters:
 *       - in: path
 *         name: verificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification status retrieved successfully
 *       404:
 *         description: Verification not found
 */
router.get('/status/:verificationId', [
  param('verificationId').isUUID().withMessage('Verification ID must be valid UUID')
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

    const { verificationId } = req.params;

    const verification = await db.simpleVerification.findUnique({
      where: { id: verificationId },
      include: {
        session: {
          include: {
            feedback: {
              select: {
                id: true,
                qualityScore: true,
                categories: true,
                sentiment: true,
                createdAt: true
              }
            }
          }
        }
      }
    });

    if (!verification) {
      return res.status(404).json({
        success: false,
        error: 'Verification not found'
      } as APIResponse);
    }

    // Only return feedback if verification is approved and feedback has been released
    const feedbackAvailable = verification.reviewStatus === 'approved' || verification.reviewStatus === 'auto_approved';
    
    res.json({
      success: true,
      data: {
        id: verification.id,
        reviewStatus: verification.reviewStatus,
        paymentStatus: verification.paymentStatus,
        paymentAmount: verification.paymentAmount,
        fraudScore: verification.fraudScore,
        submittedAt: verification.submittedAt,
        reviewedAt: verification.reviewedAt,
        paidAt: verification.paidAt,
        feedback: feedbackAvailable ? verification.session?.feedback : null
      }
    } as APIResponse);

  } catch (error) {
    console.error('Verification status check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during status check'
    } as APIResponse);
  }
});

// Helper function to check daily limits
async function checkDailyLimits(phone: string, ip: string, businessId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get business settings for limits
  const business = await db.business.findUnique({
    where: { id: businessId }
  });

  const settings = business?.simpleVerificationSettings as any;
  const maxPerPhone = settings?.dailyLimits?.maxPerPhone || 3;
  const maxPerIp = settings?.dailyLimits?.maxPerIp || 10;

  // Check phone limit
  const phoneCount = await db.simpleVerification.count({
    where: {
      customerPhone: phone,
      submittedAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  if (phoneCount >= maxPerPhone) {
    return {
      allowed: false,
      reason: `Phone number has exceeded daily limit of ${maxPerPhone} verifications`
    };
  }

  // Check IP limit
  const ipCount = await db.simpleVerification.count({
    where: {
      ipAddress: ip,
      submittedAt: {
        gte: today,
        lt: tomorrow
      }
    }
  });

  if (ipCount >= maxPerIp) {
    return {
      allowed: false,
      reason: `IP address has exceeded daily limit of ${maxPerIp} verifications`
    };
  }

  return { allowed: true };
}

export default router;