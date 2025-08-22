import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import multer from 'multer';
import { db } from '@ai-feedback/database';
import type { APIResponse, FeedbackSession } from '@ai-feedback/shared-types';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files and webm
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm') {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Start recording session
router.post('/start/:sessionId',
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

      if (session.status !== 'qr_scanned') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION_STATUS',
            message: 'Session is not ready for recording'
          }
        });
      }

      // Update session status to recording
      const updatedSession = await db.updateFeedbackSession(sessionId, {
        status: 'recording'
      });

      const response: APIResponse<{ sessionId: string; status: string }> = {
        success: true,
        data: {
          sessionId: updatedSession.id,
          status: updatedSession.status
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Start recording error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'START_RECORDING_ERROR',
          message: 'Failed to start recording'
        }
      });
    }
  }
);

// Submit audio feedback
router.post('/submit/:sessionId',
  upload.single('audio'),
  [
    param('sessionId').isUUID('4').withMessage('Valid session ID required'),
    body('duration').isNumeric().withMessage('Audio duration is required'),
    body('transactionAmount').optional().isNumeric().withMessage('Transaction amount must be numeric'),
    body('transactionId').optional().isString().withMessage('Transaction ID must be a string')
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
      const { sessionId } = req.params;
      const { duration, transactionAmount, transactionId } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_AUDIO_FILE',
            message: 'Audio file is required'
          }
        });
      }

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

      if (session.status !== 'recording') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SESSION_STATUS',
            message: 'Session is not in recording state'
          }
        });
      }

      // TODO: Store audio file temporarily (could use Supabase Storage or AWS S3)
      // For now, we'll simulate processing
      const audioUrl = `temp://${sessionId}-${Date.now()}.webm`;

      // Update session with audio data
      const updateData: Partial<FeedbackSession> = {
        audioDurationSeconds: parseInt(duration),
        audioUrl,
        transactionAmount: transactionAmount ? parseFloat(transactionAmount) : undefined,
        transactionId: transactionId || undefined,
        status: 'processing'
      };

      const updatedSession = await db.updateFeedbackSession(sessionId, updateData);

      // TODO: Trigger AI processing pipeline
      // This would typically be an async job sent to a queue
      console.log(`🎤 Audio submitted for session ${sessionId}, starting AI processing...`);

      const response: APIResponse<{
        sessionId: string;
        status: string;
        estimatedProcessingTime: number;
      }> = {
        success: true,
        data: {
          sessionId: updatedSession.id,
          status: updatedSession.status,
          estimatedProcessingTime: 30000 // 30 seconds estimate
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Submit feedback error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SUBMIT_FEEDBACK_ERROR',
          message: 'Failed to submit feedback'
        }
      });
    }
  }
);

// Get session status and results
router.get('/status/:sessionId',
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

      const response: APIResponse<{
        sessionId: string;
        status: string;
        qualityScore?: number;
        rewardAmount?: number;
        rewardTier?: string;
        feedbackCategories?: string[];
        aiEvaluation?: any;
        errorMessage?: string;
        completedAt?: string;
      }> = {
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          qualityScore: session.quality_score || undefined,
          rewardAmount: session.reward_amount ? parseFloat(session.reward_amount.toString()) : undefined,
          rewardTier: session.reward_tier || undefined,
          feedbackCategories: session.feedback_categories || undefined,
          aiEvaluation: session.ai_evaluation || undefined,
          errorMessage: session.error_message || undefined,
          completedAt: session.completed_at || undefined
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get session status error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATUS_ERROR',
          message: 'Failed to get session status'
        }
      });
    }
  }
);

// Get feedback history for a customer (by hash)
router.get('/history/:customerHash',
  [
    param('customerHash').isHexadecimal().isLength({ min: 64, max: 64 }).withMessage('Valid customer hash required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid customer hash'
        }
      });
    }

    try {
      const { customerHash } = req.params;
      const limit = parseInt(req.query.limit as string) || 10;

      // Get recent feedback sessions for this customer
      const { data: sessions, error } = await db.client
        .from('feedback_sessions')
        .select('id, business_id, quality_score, reward_amount, reward_tier, feedback_categories, completed_at, created_at')
        .eq('customer_hash', customerHash)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Get business names
      const businessIds = [...new Set(sessions.map(s => s.business_id))];
      const { data: businesses } = await db.client
        .from('businesses')
        .select('id, name')
        .in('id', businessIds);

      const businessMap = new Map(businesses?.map(b => [b.id, b.name]) || []);

      const response: APIResponse<{
        sessions: Array<{
          sessionId: string;
          businessName: string;
          qualityScore: number;
          rewardAmount: number;
          rewardTier: string;
          categories: string[];
          completedAt: string;
        }>;
        totalSessions: number;
        totalRewards: number;
      }> = {
        success: true,
        data: {
          sessions: sessions.map(session => ({
            sessionId: session.id,
            businessName: businessMap.get(session.business_id) || 'Unknown Business',
            qualityScore: session.quality_score || 0,
            rewardAmount: parseFloat(session.reward_amount?.toString() || '0'),
            rewardTier: session.reward_tier || 'insufficient',
            categories: session.feedback_categories || [],
            completedAt: session.completed_at || session.created_at
          })),
          totalSessions: sessions.length,
          totalRewards: sessions.reduce((sum, s) => sum + parseFloat(s.reward_amount?.toString() || '0'), 0)
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Get feedback history error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HISTORY_ERROR',
          message: 'Failed to get feedback history'
        }
      });
    }
  }
);

export { router as feedbackRoutes };