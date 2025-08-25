#!/usr/bin/env node

/**
 * Admin Authentication Service
 * Swedish Pilot Admin Monitoring - Secure Authentication & Authorization
 * 
 * Provides secure authentication and authorization for admin users:
 * - JWT-based authentication with Swedish compliance
 * - Multi-factor authentication (MFA) support
 * - Role-based access control (RBAC)
 * - Session management with Redis
 * - Audit logging for all auth events
 * - Swedish data protection compliance
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('redis');
const { Pool } = require('pg');
const winston = require('winston');
const moment = require('moment-timezone');
const rateLimit = require('express-rate-limit');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const crypto = require('crypto');

// Environment configuration
const {
  NODE_ENV = 'production',
  PORT = 3000,
  DATABASE_URL,
  REDIS_URL,
  JWT_SECRET,
  SESSION_TIMEOUT_MINUTES = '480',
  MFA_REQUIRED = 'true',
  SWEDISH_ADMIN_COMPLIANCE = 'true'
} = process.env;

const app = express();

// Swedish timezone configuration
moment.tz.setDefault('Europe/Stockholm');

// Logging configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({
      format: () => moment().tz('Europe/Stockholm').format('YYYY-MM-DD HH:mm:ss Z')
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const logEntry = {
        timestamp,
        level,
        message,
        service: 'admin-auth-service',
        environment: NODE_ENV,
        swedish_compliance: SWEDISH_ADMIN_COMPLIANCE === 'true',
        ...meta
      };
      return JSON.stringify(logEntry);
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: '/var/log/admin/admin-auth.log',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 10
    }),
    new winston.transports.File({
      filename: '/var/log/admin/admin-auth-security.log',
      level: 'warn',
      maxsize: 20 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// Database connection
const db = new Pool({
  connectionString: DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Redis connection for sessions
let redisClient;
if (REDIS_URL) {
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', err => logger.error('Redis Client Error', err));
  redisClient.connect().catch(err => logger.error('Redis connection failed', err));
}

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many authentication attempts' },
  skipSuccessfulRequests: true
});

const mfaLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // 10 MFA attempts
  message: { error: 'Too many MFA attempts' }
});

// Admin roles and permissions
const ADMIN_ROLES = {
  'super_admin': {
    name: 'Super Administrator',
    permissions: ['*'], // All permissions
    description: 'Full system access'
  },
  'pilot_admin': {
    name: 'Swedish Pilot Administrator',
    permissions: [
      'pilot:view', 'pilot:manage', 'pilot:approve', 'pilot:report',
      'business:view', 'business:manage', 
      'monitoring:view', 'monitoring:configure'
    ],
    description: 'Swedish pilot program management'
  },
  'finance_admin': {
    name: 'Finance Administrator',
    permissions: [
      'payments:view', 'payments:manage', 'reports:view', 'reports:export',
      'compliance:view', 'compliance:report'
    ],
    description: 'Financial operations and compliance'
  },
  'support_admin': {
    name: 'Support Administrator',
    permissions: [
      'business:view', 'support:manage', 'feedback:view',
      'monitoring:view'
    ],
    description: 'Customer and business support'
  },
  'monitoring_admin': {
    name: 'Monitoring Administrator',
    permissions: [
      'monitoring:view', 'monitoring:configure', 'monitoring:alert',
      'system:view', 'logs:view'
    ],
    description: 'System monitoring and alerting'
  }
};

// Middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Helper functions
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 12);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

// Log authentication events
async function logAuthEvent(eventType, details = {}) {
  try {
    const response = await fetch('http://admin-activity-logger:3000/api/log-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: details.userId || 'unknown',
        userRole: details.userRole || 'unknown',
        sessionId: details.sessionId,
        activity: eventType,
        category: `auth_${eventType.toLowerCase()}`,
        details: details,
        success: details.success !== false
      })
    });

    if (!response.ok) {
      logger.warn('Failed to log auth event to activity logger', { eventType });
    }
  } catch (error) {
    logger.error('Error logging auth event', { error: error.message, eventType });
  }
}

// API Endpoints

// Health check
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    const redisStatus = redisClient ? await redisClient.ping() : 'disabled';
    
    res.json({
      status: 'healthy',
      service: 'admin-auth-service',
      environment: NODE_ENV,
      database: 'connected',
      redis: redisStatus,
      mfa_required: MFA_REQUIRED === 'true',
      swedish_compliance: SWEDISH_ADMIN_COMPLIANCE === 'true',
      session_timeout_minutes: parseInt(SESSION_TIMEOUT_MINUTES),
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Admin login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { email, password, mfaToken } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password required'
      });
    }

    // Find admin user
    const userResult = await db.query(
      `SELECT id, email, password_hash, role, name, mfa_secret, 
              mfa_enabled, account_locked, last_login, failed_attempts,
              created_at, updated_at
       FROM admin_users 
       WHERE email = $1 AND active = true`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      await logAuthEvent('AUTH_FAILED', {
        email,
        reason: 'user_not_found',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        success: false
      });

      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    const user = userResult.rows[0];

    // Check if account is locked
    if (user.account_locked) {
      await logAuthEvent('AUTH_FAILED', {
        userId: user.id,
        email,
        reason: 'account_locked',
        ipAddress: req.ip,
        success: false
      });

      return res.status(423).json({
        error: 'Account is locked. Please contact administrator.'
      });
    }

    // Verify password
    if (!verifyPassword(password, user.password_hash)) {
      // Increment failed attempts
      await db.query(
        `UPDATE admin_users 
         SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
             account_locked = CASE WHEN COALESCE(failed_attempts, 0) >= 4 THEN true ELSE false END
         WHERE id = $1`,
        [user.id]
      );

      await logAuthEvent('AUTH_FAILED', {
        userId: user.id,
        email,
        reason: 'invalid_password',
        ipAddress: req.ip,
        success: false
      });

      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check MFA if required
    if (MFA_REQUIRED === 'true' && user.mfa_enabled) {
      if (!mfaToken) {
        return res.status(200).json({
          requireMFA: true,
          message: 'MFA token required',
          userId: user.id
        });
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: mfaToken,
        window: 2 // Allow 2 time steps of drift
      });

      if (!verified) {
        await logAuthEvent('AUTH_MFA', {
          userId: user.id,
          email,
          reason: 'invalid_mfa_token',
          ipAddress: req.ip,
          success: false
        });

        return res.status(401).json({
          error: 'Invalid MFA token'
        });
      }

      await logAuthEvent('AUTH_MFA', {
        userId: user.id,
        email,
        ipAddress: req.ip,
        success: true
      });
    }

    // Generate JWT token and session
    const sessionToken = generateSessionToken();
    const jwtToken = jwt.sign({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionToken
    }, JWT_SECRET, {
      expiresIn: `${SESSION_TIMEOUT_MINUTES}m`,
      issuer: 'admin-auth-service',
      audience: 'ai-feedback-admin'
    });

    // Store session in Redis
    if (redisClient) {
      const sessionData = {
        userId: user.id,
        email: user.email,
        role: user.role,
        loginTime: new Date().toISOString(),
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        swedishTime: moment().tz('Europe/Stockholm').toISOString()
      };

      await redisClient.setex(
        `admin_session:${sessionToken}`,
        parseInt(SESSION_TIMEOUT_MINUTES) * 60,
        JSON.stringify(sessionData)
      );
    }

    // Update user login info
    await db.query(
      `UPDATE admin_users 
       SET last_login = NOW(), failed_attempts = 0, 
           last_login_ip = $2, account_locked = false
       WHERE id = $1`,
      [user.id, req.ip]
    );

    await logAuthEvent('AUTH_LOGIN', {
      userId: user.id,
      userRole: user.role,
      email: user.email,
      sessionId: sessionToken,
      ipAddress: req.ip,
      success: true
    });

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleInfo: ADMIN_ROLES[user.role],
        lastLogin: user.last_login,
        sessionTimeout: parseInt(SESSION_TIMEOUT_MINUTES)
      },
      session: {
        token: sessionToken,
        expiresAt: moment().add(parseInt(SESSION_TIMEOUT_MINUTES), 'minutes').toISOString()
      },
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });

  } catch (error) {
    logger.error('Login failed', error);
    res.status(500).json({
      error: 'Authentication service error',
      message: error.message
    });
  }
});

// Admin logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const sessionToken = req.headers['x-session-token'];

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Remove session from Redis
        if (redisClient && sessionToken) {
          await redisClient.del(`admin_session:${sessionToken}`);
        }

        await logAuthEvent('AUTH_LOGOUT', {
          userId: decoded.id,
          userRole: decoded.role,
          sessionId: sessionToken,
          ipAddress: req.ip,
          success: true
        });

        res.json({
          success: true,
          message: 'Logged out successfully',
          timestamp: new Date().toISOString()
        });

      } catch (jwtError) {
        // Token might be expired, still try to clean up session
        if (redisClient && sessionToken) {
          await redisClient.del(`admin_session:${sessionToken}`);
        }
        
        res.json({
          success: true,
          message: 'Session cleared',
          timestamp: new Date().toISOString()
        });
      }
    } else {
      res.status(400).json({
        error: 'No authentication token provided'
      });
    }

  } catch (error) {
    logger.error('Logout failed', error);
    res.status(500).json({
      error: 'Logout service error',
      message: error.message
    });
  }
});

// Verify token and session
app.post('/api/auth/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const sessionToken = req.headers['x-session-token'];

    if (!token) {
      return res.status(401).json({
        error: 'No authentication token provided'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Check session in Redis
    if (redisClient && sessionToken) {
      const sessionData = await redisClient.get(`admin_session:${sessionToken}`);
      
      if (!sessionData) {
        return res.status(401).json({
          error: 'Session expired or invalid'
        });
      }

      const session = JSON.parse(sessionData);
      
      if (session.userId !== decoded.id) {
        return res.status(401).json({
          error: 'Session mismatch'
        });
      }
    }

    // Get fresh user data
    const userResult = await db.query(
      `SELECT id, email, name, role, last_login, active 
       FROM admin_users 
       WHERE id = $1 AND active = true`,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        error: 'User not found or inactive'
      });
    }

    const user = userResult.rows[0];

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        roleInfo: ADMIN_ROLES[user.role],
        lastLogin: user.last_login
      },
      token: {
        issuedAt: new Date(decoded.iat * 1000).toISOString(),
        expiresAt: new Date(decoded.exp * 1000).toISOString()
      },
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Invalid or expired token'
      });
    }

    logger.error('Token verification failed', error);
    res.status(500).json({
      error: 'Token verification service error',
      message: error.message
    });
  }
});

// Setup MFA for user
app.post('/api/auth/mfa/setup', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Generate MFA secret
    const secret = speakeasy.generateSecret({
      name: `AI Feedback Admin (${decoded.email})`,
      issuer: 'AI Feedback Platform',
      length: 32
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store temporary secret (not yet activated)
    await db.query(
      `UPDATE admin_users 
       SET mfa_secret_temp = $2, mfa_setup_at = NOW()
       WHERE id = $1`,
      [decoded.id, secret.base32]
    );

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
      instructions: 'Scan the QR code with your authenticator app, then verify with a token to complete setup',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MFA setup failed', error);
    res.status(500).json({
      error: 'MFA setup service error',
      message: error.message
    });
  }
});

// Verify MFA setup
app.post('/api/auth/mfa/verify-setup', mfaLimiter, async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const { mfaToken } = req.body;
    
    if (!token || !mfaToken) {
      return res.status(400).json({
        error: 'Authentication token and MFA token required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Get temporary secret
    const userResult = await db.query(
      'SELECT mfa_secret_temp FROM admin_users WHERE id = $1',
      [decoded.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].mfa_secret_temp) {
      return res.status(400).json({
        error: 'No MFA setup in progress'
      });
    }

    const tempSecret = userResult.rows[0].mfa_secret_temp;

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token: mfaToken,
      window: 2
    });

    if (!verified) {
      return res.status(400).json({
        error: 'Invalid MFA token'
      });
    }

    // Activate MFA
    await db.query(
      `UPDATE admin_users 
       SET mfa_secret = mfa_secret_temp, 
           mfa_secret_temp = NULL,
           mfa_enabled = true,
           mfa_activated_at = NOW()
       WHERE id = $1`,
      [decoded.id]
    );

    await logAuthEvent('AUTH_MFA_SETUP', {
      userId: decoded.id,
      userRole: decoded.role,
      ipAddress: req.ip,
      success: true
    });

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('MFA verification failed', error);
    res.status(500).json({
      error: 'MFA verification service error',
      message: error.message
    });
  }
});

// Get admin roles and permissions
app.get('/api/auth/roles', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Only super_admin can view all roles
    if (decoded.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Insufficient permissions'
      });
    }

    res.json({
      roles: ADMIN_ROLES,
      current_user: {
        id: decoded.id,
        role: decoded.role,
        permissions: ADMIN_ROLES[decoded.role]?.permissions || []
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get roles', error);
    res.status(500).json({
      error: 'Roles service error',
      message: error.message
    });
  }
});

// Create admin user (super_admin only)
app.post('/api/auth/users', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.role !== 'super_admin') {
      return res.status(403).json({
        error: 'Only super administrators can create admin users'
      });
    }

    const { email, name, role, password } = req.body;

    if (!email || !name || !role || !password) {
      return res.status(400).json({
        error: 'Email, name, role, and password are required'
      });
    }

    if (!ADMIN_ROLES[role]) {
      return res.status(400).json({
        error: 'Invalid role',
        validRoles: Object.keys(ADMIN_ROLES)
      });
    }

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM admin_users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    // Create user
    const passwordHash = hashPassword(password);
    
    const result = await db.query(`
      INSERT INTO admin_users (email, name, role, password_hash, active, created_by, created_at)
      VALUES ($1, $2, $3, $4, true, $5, NOW())
      RETURNING id, email, name, role, created_at
    `, [email.toLowerCase(), name, role, passwordHash, decoded.id]);

    const newUser = result.rows[0];

    await logAuthEvent('SYSTEM_USER_MANAGE', {
      userId: decoded.id,
      userRole: decoded.role,
      action: 'create_admin_user',
      targetUserId: newUser.id,
      targetEmail: newUser.email,
      targetRole: role,
      success: true
    });

    res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
        roleInfo: ADMIN_ROLES[newUser.role],
        createdAt: newUser.created_at
      },
      message: 'Admin user created successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to create admin user', error);
    res.status(500).json({
      error: 'User creation service error',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Database initialization
async function initializeDatabase() {
  try {
    // Create admin users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL,
        password_hash TEXT NOT NULL,
        mfa_secret TEXT,
        mfa_secret_temp TEXT,
        mfa_enabled BOOLEAN DEFAULT false,
        mfa_setup_at TIMESTAMP WITH TIME ZONE,
        mfa_activated_at TIMESTAMP WITH TIME ZONE,
        active BOOLEAN DEFAULT true,
        account_locked BOOLEAN DEFAULT false,
        failed_attempts INTEGER DEFAULT 0,
        last_login TIMESTAMP WITH TIME ZONE,
        last_login_ip INET,
        created_by VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_email 
      ON admin_users(email);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_users_role 
      ON admin_users(role);
    `);

    // Create default super admin if none exists
    const adminCount = await db.query(
      "SELECT COUNT(*) as count FROM admin_users WHERE role = 'super_admin' AND active = true"
    );

    if (parseInt(adminCount.rows[0].count) === 0) {
      const defaultPassword = hashPassword('admin123!');
      await db.query(`
        INSERT INTO admin_users (email, name, role, password_hash, active, created_at)
        VALUES ('admin@ai-feedback.se', 'Default Admin', 'super_admin', $1, true, NOW())
        ON CONFLICT (email) DO NOTHING
      `, [defaultPassword]);

      logger.warn('Created default super admin user', {
        email: 'admin@ai-feedback.se',
        password: 'admin123!',
        warning: 'Please change this password immediately'
      });
    }

    logger.info('Admin authentication database initialized');
  } catch (error) {
    logger.error('Failed to initialize database', error);
    throw error;
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully');
  
  if (redisClient) {
    await redisClient.quit();
  }
  
  await db.end();
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      logger.info('Admin Authentication Service started', {
        port: PORT,
        environment: NODE_ENV,
        mfa_required: MFA_REQUIRED === 'true',
        session_timeout_minutes: parseInt(SESSION_TIMEOUT_MINUTES),
        swedish_compliance: SWEDISH_ADMIN_COMPLIANCE === 'true',
        swedish_time: moment().tz('Europe/Stockholm').format()
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, ADMIN_ROLES };