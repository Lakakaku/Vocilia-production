import { Router, type Request, type Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '@ai-feedback/database';
import type { APIResponse } from '@ai-feedback/shared-types';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '24h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

interface LoginResponse {
  user: {
    id: string;
    email: string;
    name: string;
    businessName: string;
    location: string;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Business user login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *             required:
 *               - email
 *               - password
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Invalid credentials
 *       401:
 *         description: Authentication failed
 */
router.post('/login',
  [
    body('email').isEmail().withMessage('Valid email address required'),
    body('password').isLength({ min: 1 }).withMessage('Password required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid login data',
          details: errors.array()
        }
      });
    }

    try {
      const { email, password } = req.body;

      // Find business by email
      const { data: business, error } = await db.client
        .from('businesses')
        .select('*')
        .eq('email', email.toLowerCase())
        .single();

      if (error || !business) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Felaktiga inloggningsuppgifter' // Swedish: Invalid credentials
          }
        });
      }

      // Check if business has password hash
      if (!business.password_hash) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'NO_PASSWORD',
            message: 'Kontot har inget lösenord. Kontakta support.' // Swedish: Account has no password. Contact support.
          }
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, business.password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Felaktiga inloggningsuppgifter' // Swedish: Invalid credentials
          }
        });
      }

      // Check if business is approved/active
      if (business.status !== 'active' && business.status !== 'pending_verification') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Kontot är inte aktivt. Kontakta support.' // Swedish: Account is not active. Contact support.
          }
        });
      }

      // Generate JWT tokens
      const tokenPayload = {
        businessId: business.id,
        email: business.email,
        name: business.name,
        type: 'business'
      };

      const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'vocilia-platform',
        subject: business.id
      });

      const refreshToken = jwt.sign(
        { ...tokenPayload, type: 'refresh' }, 
        JWT_SECRET, 
        { 
          expiresIn: REFRESH_TOKEN_EXPIRES_IN,
          issuer: 'vocilia-platform',
          subject: business.id
        }
      );

      // Update last login timestamp
      await db.client
        .from('businesses')
        .update({ 
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', business.id);

      const response: APIResponse<LoginResponse> = {
        success: true,
        data: {
          user: {
            id: business.id,
            email: business.email,
            name: business.name,
            businessName: business.name,
            location: business.address?.city || 'Sverige'
          },
          accessToken,
          refreshToken,
          expiresIn: JWT_EXPIRES_IN
        }
      };

      console.log(`✅ Business login successful: ${business.email} (ID: ${business.id})`);
      res.json(response);

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'LOGIN_ERROR',
          message: 'Ett fel uppstod vid inloggning' // Swedish: An error occurred during login
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *             required:
 *               - refreshToken
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh',
  [
    body('refreshToken').notEmpty().withMessage('Refresh token required')
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid refresh request',
          details: errors.array()
        }
      });
    }

    try {
      const { refreshToken } = req.body;

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
      
      if (decoded.type !== 'refresh') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN_TYPE',
            message: 'Invalid token type'
          }
        });
      }

      // Verify business still exists and is active
      const { data: business, error } = await db.client
        .from('businesses')
        .select('id, email, name, status, address')
        .eq('id', decoded.businessId)
        .single();

      if (error || !business) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'BUSINESS_NOT_FOUND',
            message: 'Business not found'
          }
        });
      }

      if (business.status !== 'active' && business.status !== 'pending_verification') {
        return res.status(401).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is not active'
          }
        });
      }

      // Generate new access token
      const tokenPayload = {
        businessId: business.id,
        email: business.email,
        name: business.name,
        type: 'business'
      };

      const newAccessToken = jwt.sign(tokenPayload, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN,
        issuer: 'vocilia-platform',
        subject: business.id
      });

      const response: APIResponse<{ accessToken: string; expiresIn: string }> = {
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: JWT_EXPIRES_IN
        }
      };

      res.json(response);

    } catch (error) {
      console.error('Token refresh error:', error);
      
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Refresh token expired'
          }
        });
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid refresh token'
          }
        });
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: 'Failed to refresh token'
        }
      });
    }
  }
);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', async (req: Request, res: Response) => {
  try {
    // In a production system, you might want to blacklist the token
    // For now, we just return success and let the client handle token removal
    
    const response: APIResponse<{ message: string }> = {
      success: true,
      data: {
        message: 'Utloggning lyckades' // Swedish: Logout successful
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_ERROR',
        message: 'Ett fel uppstod vid utloggning' // Swedish: An error occurred during logout
      }
    });
  }
});

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Get current user info
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User info retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'NO_TOKEN',
          message: 'Authorization token required'
        }
      });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    if (decoded.type !== 'business') {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_TYPE',
          message: 'Invalid token type'
        }
      });
    }

    // Get fresh business data
    const { data: business, error } = await db.client
      .from('businesses')
      .select('id, email, name, status, address, created_at, trial_feedbacks_remaining')
      .eq('id', decoded.businessId)
      .single();

    if (error || !business) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: 'Business not found'
        }
      });
    }

    const response: APIResponse<{
      user: {
        id: string;
        email: string;
        name: string;
        businessName: string;
        location: string;
        status: string;
        trialFeedbacksRemaining: number;
        createdAt: string;
      };
    }> = {
      success: true,
      data: {
        user: {
          id: business.id,
          email: business.email,
          name: business.name,
          businessName: business.name,
          location: business.address?.city || 'Sverige',
          status: business.status,
          trialFeedbacksRemaining: business.trial_feedbacks_remaining || 0,
          createdAt: business.created_at
        }
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Get user info error:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token expired'
        }
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid token'
        }
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'USER_INFO_ERROR',
        message: 'Failed to get user info'
      }
    });
  }
});

export default router;