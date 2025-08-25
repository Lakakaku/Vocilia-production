import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AdminRole } from '@ai-feedback/shared-types';

// Enhanced Admin User interface for development
export interface AdminUser {
  id: string;
  email: string;
  name?: string;
  role: AdminRole;
  active: boolean;
  passwordHash: string;
  createdAt: string;
  lastLoginAt?: string;
}

// Extended request interface with admin context
export interface AdminRequest extends Request {
  admin: {
    id: string;
    email: string;
    role: AdminRole;
    permissions: string[];
    sessionId: string;
  };
}

// Admin permissions by role
const ROLE_PERMISSIONS: Record<AdminRole, string[]> = {
  super_admin: [
    'admin:read', 'admin:write', 'admin:delete',
    'business:read', 'business:write', 'business:approve', 'business:suspend',
    'fraud:read', 'fraud:write', 'fraud:ban',
    'feedback:read', 'feedback:override',
    'system:read', 'system:write',
    'analytics:read'
  ],
  admin: [
    'business:read', 'business:write', 'business:approve',
    'fraud:read', 'fraud:write',
    'feedback:read', 'feedback:override', 
    'system:read',
    'analytics:read'
  ]
};

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

// In-memory admin users for development (replace with database in production)
const DEV_ADMIN_USERS: AdminUser[] = [
  {
    id: 'admin-1',
    email: 'admin@feedbackplatform.se',
    name: 'Super Admin',
    role: 'super_admin',
    active: true,
    passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    createdAt: new Date().toISOString(),
    lastLoginAt: undefined
  },
  {
    id: 'admin-2', 
    email: 'moderator@feedbackplatform.se',
    name: 'Moderator',
    role: 'admin',
    active: true,
    passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password
    createdAt: new Date().toISOString(),
    lastLoginAt: undefined
  }
];

// JWT token generation
export function generateTokens(user: AdminUser): { accessToken: string; refreshToken: string } {
  const sessionId = Math.random().toString(36).substring(2, 15);
  
  const accessToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      type: 'access'
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  const refreshToken = jwt.sign(
    {
      id: user.id,
      sessionId,
      type: 'refresh'
    },
    JWT_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
}

// Admin authentication middleware
export function adminAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'] as string;
    
    if (!token) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Admin token missing'
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError: any) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          code: 'TOKEN_EXPIRED',
          message: 'Admin token expired'
        });
      }
      return res.status(401).json({
        code: 'INVALID_TOKEN',
        message: 'Invalid admin token'
      });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({
        code: 'INVALID_TOKEN_TYPE',
        message: 'Invalid token type'
      });
    }

    // Find user (in production, query database)
    const user = DEV_ADMIN_USERS.find(u => u.id === decoded.id && u.active);
    if (!user) {
      return res.status(401).json({
        code: 'USER_NOT_FOUND',
        message: 'Admin user not found or inactive'
      });
    }

    // Set admin context
    (req as AdminRequest).admin = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: ROLE_PERMISSIONS[user.role] || [],
      sessionId: decoded.sessionId
    };

    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Admin authentication failed'
    });
  }
}

// Permission check middleware
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const adminReq = req as AdminRequest;
    
    if (!adminReq.admin) {
      return res.status(401).json({
        code: 'UNAUTHORIZED',
        message: 'Admin authentication required'
      });
    }

    const hasPermission = requiredPermissions.some(permission => 
      adminReq.admin.permissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Insufficient permissions for this action',
        required: requiredPermissions,
        available: adminReq.admin.permissions
      });
    }

    next();
  };
}

// User authentication helper
export async function authenticateAdmin(email: string, password: string): Promise<AdminUser | null> {
  // Find user (in production, query database)
  const user = DEV_ADMIN_USERS.find(u => u.email === email && u.active);
  if (!user || !user.passwordHash) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return null;
  }

  // Update last login (in production, update database)
  user.lastLoginAt = new Date().toISOString();
  
  return user;
}

// Get admin users (for user management)
export function getAdminUsers(): Omit<AdminUser, 'passwordHash'>[] {
  return DEV_ADMIN_USERS.map(user => {
    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
}

// Create admin user
export async function createAdminUser(userData: {
  email: string;
  name?: string;
  password: string;
  role: AdminRole;
}): Promise<Omit<AdminUser, 'passwordHash'>> {
  const passwordHash = await bcrypt.hash(userData.password, 10);
  
  const newUser: AdminUser = {
    id: `admin-${Date.now()}`,
    email: userData.email,
    name: userData.name,
    role: userData.role,
    active: true,
    passwordHash,
    createdAt: new Date().toISOString()
  };

  // In production, save to database
  DEV_ADMIN_USERS.push(newUser);
  
  const { passwordHash: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

// Enhanced audit middleware
export function adminAudit(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  const path = req.path;
  const method = req.method;
  const adminReq = req as AdminRequest;
  const userAgent = req.get('User-Agent') || '';
  const ip = req.ip || req.connection.remoteAddress || '';
  
  res.on('finish', () => {
    try {
      const status = res.statusCode;
      const durationMs = Date.now() - startedAt;
      const record: AuditRecord = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        timestamp: new Date().toISOString(),
        method,
        path,
        status,
        durationMs,
        admin: adminReq.admin ? {
          id: adminReq.admin.id,
          email: adminReq.admin.email,
          role: adminReq.admin.role,
          sessionId: adminReq.admin.sessionId
        } : null,
        ip,
        userAgent,
        body: method !== 'GET' ? req.body : undefined,
        query: Object.keys(req.query).length > 0 ? req.query : undefined
      };
      
      adminAuditBuffer.push(record);
      if (adminAuditBuffer.length > 1000) adminAuditBuffer.shift();
      
      // Log critical actions
      if (status >= 400 || ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
        console.log('Admin audit:', JSON.stringify(record, null, 2));
      }
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  });
  next();
}

// Enhanced audit record type
type AuditRecord = {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  admin?: {
    id: string;
    email: string;
    role: AdminRole;
    sessionId: string;
  } | null;
  ip: string;
  userAgent: string;
  body?: any;
  query?: any;
};

const adminAuditBuffer: AuditRecord[] = [];

// Get audit records with filtering
export function getAdminAuditRecords(filters?: {
  adminId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): AuditRecord[] {
  let records = [...adminAuditBuffer].reverse();
  
  if (filters) {
    if (filters.adminId) {
      records = records.filter(r => r.admin?.id === filters.adminId);
    }
    if (filters.action) {
      records = records.filter(r => r.path.includes(filters.action!));
    }
    if (filters.startDate) {
      records = records.filter(r => r.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      records = records.filter(r => r.timestamp <= filters.endDate!);
    }
    if (filters.limit) {
      records = records.slice(0, filters.limit);
    }
  }
  
  return records;
}

// Refresh token handler
export function refreshToken(req: Request, res: Response) {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      code: 'MISSING_REFRESH_TOKEN',
      message: 'Refresh token required'
    });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    
    if (decoded.type !== 'refresh') {
      return res.status(400).json({
        code: 'INVALID_TOKEN_TYPE',
        message: 'Invalid token type'
      });
    }

    const user = DEV_ADMIN_USERS.find(u => u.id === decoded.id && u.active);
    if (!user) {
      return res.status(401).json({
        code: 'USER_NOT_FOUND',
        message: 'User not found or inactive'
      });
    }

    const tokens = generateTokens(user);
    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    return res.status(401).json({
      code: 'INVALID_REFRESH_TOKEN',
      message: 'Invalid or expired refresh token'
    });
  }
}