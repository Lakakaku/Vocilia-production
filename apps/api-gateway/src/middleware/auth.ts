import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { APIResponse } from '@ai-feedback/shared-types';

// Extended Request interface to include user/session info
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    type: 'business' | 'customer' | 'admin';
    businessId?: string;
    sessionId?: string;
  };
  session?: {
    id: string;
    sessionToken: string;
    businessId: string;
    locationId: string;
    status: string;
    expiresAt: Date;
  };
}

/**
 * Session-based authentication for customer feedback sessions
 * Uses session tokens from QR code scanning
 */
export function authenticateSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const sessionToken = req.headers['x-session-token'] as string;
    
    if (!sessionToken) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'MISSING_SESSION_TOKEN',
          message: 'Session token is required'
        }
      };
      return res.status(401).json(response);
    }

    // TODO: Validate session token against database
    // For now, we'll use a simple JWT validation
    try {
      const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET || 'default-secret') as any;
      
      // Check if session is expired
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new Error('Session expired');
      }

      req.session = {
        id: decoded.sessionId,
        sessionToken,
        businessId: decoded.businessId,
        locationId: decoded.locationId,
        status: decoded.status || 'active',
        expiresAt: new Date(decoded.exp * 1000)
      };

      next();
    } catch (jwtError) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'INVALID_SESSION_TOKEN',
          message: 'Invalid or expired session token'
        }
      };
      return res.status(401).json(response);
    }

  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'SESSION_AUTHENTICATION_ERROR',
        message: 'Session authentication failed'
      }
    };
    return res.status(500).json(response);
  }
}

/**
 * JWT-based authentication for business dashboard users
 */
export function authenticateBusiness(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'MISSING_AUTH_TOKEN',
          message: 'Authorization token is required'
        }
      };
      return res.status(401).json(response);
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
      
      if (decoded.type !== 'business') {
        throw new Error('Invalid token type');
      }

      req.user = {
        id: decoded.userId,
        type: 'business',
        businessId: decoded.businessId
      };

      next();
    } catch (jwtError) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'INVALID_AUTH_TOKEN',
          message: 'Invalid or expired authorization token'
        }
      };
      return res.status(401).json(response);
    }

  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'BUSINESS_AUTHENTICATION_ERROR',
        message: 'Business authentication failed'
      }
    };
    return res.status(500).json(response);
  }
}

/**
 * Admin authentication middleware
 * Enhanced version of the existing adminAuth
 */
export function authenticateAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const adminToken = req.headers['x-admin-token'] as string;
    
    // Support both JWT and simple token authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
        
        if (decoded.type !== 'admin') {
          throw new Error('Invalid token type');
        }

        req.user = {
          id: decoded.userId,
          type: 'admin'
        };

        return next();
      } catch (jwtError) {
        // Fall through to admin token check
      }
    }

    // Fallback to simple admin token
    if (!adminToken || adminToken !== process.env.ADMIN_DASHBOARD_TOKEN) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'ADMIN_UNAUTHORIZED',
          message: 'Admin authentication required'
        }
      };
      return res.status(401).json(response);
    }

    req.user = {
      id: 'admin-token',
      type: 'admin'
    };

    next();
  } catch (error) {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'ADMIN_AUTHENTICATION_ERROR',
        message: 'Admin authentication failed'
      }
    };
    return res.status(500).json(response);
  }
}

/**
 * Optional authentication - sets user info if token is present but doesn't require it
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const sessionToken = req.headers['x-session-token'] as string;

    // Try business auth first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret') as any;
        req.user = {
          id: decoded.userId,
          type: decoded.type,
          businessId: decoded.businessId
        };
      } catch {
        // Ignore JWT errors in optional auth
      }
    }

    // Try session auth
    if (sessionToken && !req.user) {
      try {
        const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET || 'default-secret') as any;
        req.session = {
          id: decoded.sessionId,
          sessionToken,
          businessId: decoded.businessId,
          locationId: decoded.locationId,
          status: decoded.status || 'active',
          expiresAt: new Date(decoded.exp * 1000)
        };
      } catch {
        // Ignore JWT errors in optional auth
      }
    }

    next();
  } catch (error) {
    // In optional auth, we continue even if there's an error
    next();
  }
}

/**
 * Middleware to require specific user types
 */
export function requireUserType(...allowedTypes: Array<'business' | 'admin' | 'customer'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required'
        }
      };
      return res.status(401).json(response);
    }

    if (!allowedTypes.includes(req.user.type)) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Access denied. Required user type: ${allowedTypes.join(' or ')}`
        }
      };
      return res.status(403).json(response);
    }

    next();
  };
}

/**
 * Middleware to require business ownership (business user accessing their own data)
 */
export function requireBusinessOwnership(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.type !== 'business') {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'BUSINESS_AUTH_REQUIRED',
        message: 'Business authentication is required'
      }
    };
    return res.status(401).json(response);
  }

  const businessId = req.params.businessId || req.body.businessId;
  
  if (businessId && req.user.businessId !== businessId) {
    const response: APIResponse = {
      success: false,
      error: {
        code: 'BUSINESS_ACCESS_DENIED',
        message: 'Access denied to business data'
      }
    };
    return res.status(403).json(response);
  }

  next();
}

/**
 * Rate limiting based on user/session
 */
export function createUserRateLimit(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const now = Date.now();
    const identifier = req.user?.id || req.session?.id || req.ip;
    
    if (!identifier) {
      return next();
    }

    const userLimit = rateLimitMap.get(identifier);
    
    if (!userLimit || now > userLimit.resetTime) {
      rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (userLimit.count >= maxRequests) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.'
        }
      };
      return res.status(429).json(response);
    }

    userLimit.count++;
    next();
  };
}

/**
 * Utility function to generate JWT tokens
 */
export function generateToken(payload: any, expiresIn: string = '24h'): string {
  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', { expiresIn });
}

/**
 * Utility function to generate session tokens
 */
export function generateSessionToken(sessionData: {
  sessionId: string;
  businessId: string;
  locationId: string;
  status?: string;
}, expiresIn: string = '15m'): string {
  return jwt.sign({
    sessionId: sessionData.sessionId,
    businessId: sessionData.businessId,
    locationId: sessionData.locationId,
    status: sessionData.status || 'active',
    type: 'session'
  }, process.env.JWT_SECRET || 'default-secret', { expiresIn });
}