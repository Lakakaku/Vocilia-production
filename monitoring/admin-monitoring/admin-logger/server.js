#!/usr/bin/env node

/**
 * Admin Activity Logger Service
 * Swedish Pilot Admin Monitoring - Activity Tracking & Audit Logging
 * 
 * Logs all admin activities for Swedish pilot management:
 * - User authentication events
 * - Business onboarding actions
 * - Configuration changes
 * - System access patterns
 * - Compliance audit trails
 */

const express = require('express');
const { createClient } = require('redis');
const { Pool } = require('pg');
const winston = require('winston');
const moment = require('moment-timezone');
const rateLimit = require('express-rate-limit');

// Environment configuration
const {
  NODE_ENV = 'production',
  PORT = 3000,
  DATABASE_URL,
  REDIS_URL,
  LOG_LEVEL = 'info',
  ADMIN_LOG_RETENTION_DAYS = '365',
  GDPR_COMPLIANCE = 'true',
  SWEDISH_LOCALE = 'sv_SE'
} = process.env;

const app = express();

// Swedish timezone configuration
moment.tz.setDefault('Europe/Stockholm');

// Enhanced logging with Swedish compliance requirements
const logger = winston.createLogger({
  level: LOG_LEVEL,
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
        service: 'admin-activity-logger',
        environment: NODE_ENV,
        locale: SWEDISH_LOCALE,
        gdpr_compliant: GDPR_COMPLIANCE === 'true',
        ...meta
      };
      return JSON.stringify(logEntry);
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: '/var/log/admin/admin-activity.log',
      maxsize: 50 * 1024 * 1024, // 50MB
      maxFiles: 10,
      tailable: true
    }),
    new winston.transports.File({
      filename: '/var/log/admin/admin-errors.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

// Database connection
const db = new Pool({
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
});

// Redis connection for session management
let redisClient;
if (REDIS_URL) {
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', err => logger.error('Redis Client Error', err));
  redisClient.connect().catch(err => logger.error('Redis connection failed', err));
}

// Rate limiting for admin activity endpoints
const adminActivityLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: 'Too many admin activity requests' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(adminActivityLimiter);

// GDPR-compliant activity categories
const ACTIVITY_CATEGORIES = {
  // Authentication & Access
  AUTH_LOGIN: 'auth_login',
  AUTH_LOGOUT: 'auth_logout', 
  AUTH_FAILED: 'auth_failed',
  AUTH_MFA: 'auth_mfa',
  
  // Swedish Pilot Management
  PILOT_BUSINESS_VIEW: 'pilot_business_view',
  PILOT_BUSINESS_APPROVE: 'pilot_business_approve',
  PILOT_BUSINESS_SUSPEND: 'pilot_business_suspend',
  PILOT_BUSINESS_CONFIG: 'pilot_business_config',
  PILOT_METRICS_VIEW: 'pilot_metrics_view',
  
  // System Administration
  SYSTEM_CONFIG_CHANGE: 'system_config_change',
  SYSTEM_USER_MANAGE: 'system_user_manage',
  SYSTEM_ALERT_CONFIG: 'system_alert_config',
  SYSTEM_BACKUP_TRIGGER: 'system_backup_trigger',
  
  // Compliance & Audit
  COMPLIANCE_REPORT_VIEW: 'compliance_report_view',
  COMPLIANCE_REPORT_EXPORT: 'compliance_report_export',
  AUDIT_LOG_ACCESS: 'audit_log_access',
  GDPR_DATA_REQUEST: 'gdpr_data_request',
  
  // Finansinspektionen Reporting
  FI_REPORT_VIEW: 'fi_report_view',
  FI_REPORT_SUBMIT: 'fi_report_submit',
  FI_COMPLIANCE_CHECK: 'fi_compliance_check'
};

// Admin activity logging function
async function logAdminActivity({
  userId,
  userRole,
  sessionId,
  activity,
  category,
  resourceId = null,
  resourceType = null,
  details = {},
  ipAddress,
  userAgent,
  success = true,
  errorMessage = null
}) {
  try {
    const activityLog = {
      user_id: userId,
      user_role: userRole,
      session_id: sessionId,
      activity,
      category,
      resource_id: resourceId,
      resource_type: resourceType,
      details: JSON.stringify(details),
      ip_address: ipAddress,
      user_agent: userAgent,
      success,
      error_message: errorMessage,
      timestamp: new Date(),
      swedish_timestamp: moment().tz('Europe/Stockholm').toISOString(),
      gdpr_compliant: true,
      retention_expires: moment().add(parseInt(ADMIN_LOG_RETENTION_DAYS), 'days').toDate()
    };

    // Store in database
    const query = `
      INSERT INTO admin_activity_logs (
        user_id, user_role, session_id, activity, category,
        resource_id, resource_type, details, ip_address, user_agent,
        success, error_message, timestamp, swedish_timestamp,
        gdpr_compliant, retention_expires
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      RETURNING id
    `;
    
    const values = Object.values(activityLog);
    const result = await db.query(query, values);

    // Cache recent activity in Redis for fast access
    if (redisClient) {
      const recentKey = `admin_activity:recent:${userId}`;
      await redisClient.lpush(recentKey, JSON.stringify({
        ...activityLog,
        id: result.rows[0].id
      }));
      await redisClient.ltrim(recentKey, 0, 99); // Keep last 100 activities
      await redisClient.expire(recentKey, 3600); // 1 hour TTL
    }

    // Log to winston for immediate monitoring
    logger.info('Admin activity logged', {
      activityId: result.rows[0].id,
      userId,
      userRole,
      activity,
      category,
      success,
      resourceType,
      resourceId
    });

    return result.rows[0].id;

  } catch (error) {
    logger.error('Failed to log admin activity', {
      error: error.message,
      userId,
      activity,
      category
    });
    throw error;
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
      service: 'admin-activity-logger',
      environment: NODE_ENV,
      database: 'connected',
      redis: redisStatus,
      swedish_time: moment().tz('Europe/Stockholm').format(),
      gdpr_compliant: GDPR_COMPLIANCE === 'true',
      timestamp: new Date().toISOString()
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

// Log admin activity endpoint
app.post('/api/log-activity', async (req, res) => {
  try {
    const {
      userId,
      userRole,
      sessionId,
      activity,
      category,
      resourceId,
      resourceType,
      details,
      success,
      errorMessage
    } = req.body;

    // Validation
    if (!userId || !activity || !category) {
      return res.status(400).json({
        error: 'Missing required fields: userId, activity, category'
      });
    }

    if (!Object.values(ACTIVITY_CATEGORIES).includes(category)) {
      return res.status(400).json({
        error: 'Invalid activity category',
        validCategories: Object.values(ACTIVITY_CATEGORIES)
      });
    }

    const activityId = await logAdminActivity({
      userId,
      userRole,
      sessionId,
      activity,
      category,
      resourceId,
      resourceType,
      details,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      success,
      errorMessage
    });

    res.status(201).json({
      success: true,
      activityId,
      message: 'Admin activity logged successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to log activity via API', error);
    res.status(500).json({
      error: 'Failed to log admin activity',
      message: error.message
    });
  }
});

// Get recent admin activities
app.get('/api/activities/recent/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, category, success } = req.query;

    let query = `
      SELECT id, user_id, user_role, activity, category, resource_type, 
             resource_id, success, swedish_timestamp, details
      FROM admin_activity_logs 
      WHERE user_id = $1
    `;
    const params = [userId];
    let paramCount = 1;

    if (category) {
      paramCount++;
      query += ` AND category = $${paramCount}`;
      params.push(category);
    }

    if (success !== undefined) {
      paramCount++;
      query += ` AND success = $${paramCount}`;
      params.push(success === 'true');
    }

    query += ` ORDER BY timestamp DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    res.json({
      activities: result.rows.map(row => ({
        ...row,
        details: JSON.parse(row.details || '{}')
      })),
      count: result.rows.length,
      userId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get recent activities', error);
    res.status(500).json({
      error: 'Failed to retrieve admin activities',
      message: error.message
    });
  }
});

// Get admin activity statistics
app.get('/api/stats/activities', async (req, res) => {
  try {
    const { startDate, endDate, userRole } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      whereClause += ` AND timestamp >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      whereClause += ` AND timestamp <= $${paramCount}`;
      params.push(endDate);
    }

    if (userRole) {
      paramCount++;
      whereClause += ` AND user_role = $${paramCount}`;
      params.push(userRole);
    }

    const queries = {
      totalActivities: `SELECT COUNT(*) as count FROM admin_activity_logs ${whereClause}`,
      successfulActivities: `SELECT COUNT(*) as count FROM admin_activity_logs ${whereClause} AND success = true`,
      failedActivities: `SELECT COUNT(*) as count FROM admin_activity_logs ${whereClause} AND success = false`,
      categoriesBreakdown: `
        SELECT category, COUNT(*) as count 
        FROM admin_activity_logs ${whereClause} 
        GROUP BY category 
        ORDER BY count DESC
      `,
      userRolesBreakdown: `
        SELECT user_role, COUNT(*) as count 
        FROM admin_activity_logs ${whereClause} 
        GROUP BY user_role 
        ORDER BY count DESC
      `,
      hourlyActivity: `
        SELECT 
          EXTRACT(hour FROM swedish_timestamp) as hour,
          COUNT(*) as count
        FROM admin_activity_logs ${whereClause}
        GROUP BY hour
        ORDER BY hour
      `
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      const result = await db.query(query, params);
      results[key] = result.rows;
    }

    res.json({
      stats: {
        total: parseInt(results.totalActivities[0].count),
        successful: parseInt(results.successfulActivities[0].count),
        failed: parseInt(results.failedActivities[0].count),
        successRate: results.totalActivities[0].count > 0 
          ? (results.successfulActivities[0].count / results.totalActivities[0].count * 100).toFixed(2)
          : 0
      },
      breakdowns: {
        categories: results.categoriesBreakdown,
        userRoles: results.userRolesBreakdown,
        hourlyActivity: results.hourlyActivity
      },
      filters: { startDate, endDate, userRole },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get activity statistics', error);
    res.status(500).json({
      error: 'Failed to retrieve activity statistics',
      message: error.message
    });
  }
});

// Swedish pilot specific activity endpoints
app.get('/api/pilot/activities', async (req, res) => {
  try {
    const { businessId, locationId, limit = 100 } = req.query;
    
    let query = `
      SELECT aal.*, u.email as user_email, u.name as user_name
      FROM admin_activity_logs aal
      LEFT JOIN admin_users u ON aal.user_id = u.id
      WHERE aal.category LIKE 'pilot_%'
    `;
    const params = [];
    let paramCount = 0;

    if (businessId) {
      paramCount++;
      query += ` AND aal.resource_type = 'business' AND aal.resource_id = $${paramCount}`;
      params.push(businessId);
    }

    if (locationId) {
      paramCount++;
      query += ` AND aal.details::jsonb @> $${paramCount}`;
      params.push(JSON.stringify({ locationId }));
    }

    query += ` ORDER BY aal.timestamp DESC LIMIT $${paramCount + 1}`;
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    res.json({
      pilotActivities: result.rows.map(row => ({
        ...row,
        details: JSON.parse(row.details || '{}')
      })),
      count: result.rows.length,
      filters: { businessId, locationId },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Failed to get pilot activities', error);
    res.status(500).json({
      error: 'Failed to retrieve pilot activities',
      message: error.message
    });
  }
});

// GDPR compliance - data export
app.get('/api/gdpr/export/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { format = 'json' } = req.query;

    const query = `
      SELECT * FROM admin_activity_logs 
      WHERE user_id = $1 
      ORDER BY timestamp DESC
    `;
    
    const result = await db.query(query, [userId]);

    const exportData = {
      userId,
      exportDate: new Date().toISOString(),
      swedishTime: moment().tz('Europe/Stockholm').format(),
      totalRecords: result.rows.length,
      gdprCompliant: true,
      activities: result.rows.map(row => ({
        ...row,
        details: JSON.parse(row.details || '{}')
      }))
    };

    // Log the GDPR export request
    await logAdminActivity({
      userId: req.headers['x-admin-user-id'] || 'system',
      userRole: 'admin',
      sessionId: req.headers['x-session-id'],
      activity: 'GDPR data export requested',
      category: ACTIVITY_CATEGORIES.GDPR_DATA_REQUEST,
      resourceId: userId,
      resourceType: 'user_data',
      details: { format, recordCount: result.rows.length },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="admin_activities_${userId}.csv"`);
      
      // Convert to CSV format
      const csv = result.rows.map(row => 
        Object.values(row).map(v => 
          typeof v === 'object' ? JSON.stringify(v) : v
        ).join(',')
      ).join('\n');
      
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="admin_activities_${userId}.json"`);
      res.json(exportData);
    }

  } catch (error) {
    logger.error('Failed to export GDPR data', error);
    res.status(500).json({
      error: 'Failed to export user data',
      message: error.message
    });
  }
});

// Cleanup expired logs (GDPR compliance)
async function cleanupExpiredLogs() {
  try {
    const result = await db.query(`
      DELETE FROM admin_activity_logs 
      WHERE retention_expires < NOW()
      RETURNING COUNT(*) as deleted_count
    `);

    const deletedCount = result.rows[0]?.deleted_count || 0;
    
    logger.info('Cleaned up expired admin activity logs', {
      deletedCount,
      retention_days: ADMIN_LOG_RETENTION_DAYS,
      swedishTime: moment().tz('Europe/Stockholm').format()
    });

    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup expired logs', error);
    throw error;
  }
}

// Database initialization
async function initializeDatabase() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_activity_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        user_role VARCHAR(100) NOT NULL,
        session_id VARCHAR(255),
        activity TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        resource_id VARCHAR(255),
        resource_type VARCHAR(100),
        details JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        swedish_timestamp TIMESTAMP WITH TIME ZONE,
        gdpr_compliant BOOLEAN DEFAULT true,
        retention_expires TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Create indexes for performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_activity_user_id 
      ON admin_activity_logs(user_id);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_activity_category 
      ON admin_activity_logs(category);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_activity_timestamp 
      ON admin_activity_logs(timestamp);
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_admin_activity_retention 
      ON admin_activity_logs(retention_expires);
    `);

    logger.info('Admin activity logs database initialized');
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

// Error handling
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

// Start server
async function startServer() {
  try {
    await initializeDatabase();
    
    // Schedule log cleanup every 24 hours
    setInterval(cleanupExpiredLogs, 24 * 60 * 60 * 1000);
    
    app.listen(PORT, () => {
      logger.info('Admin Activity Logger Service started', {
        port: PORT,
        environment: NODE_ENV,
        swedish_locale: SWEDISH_LOCALE,
        gdpr_compliant: GDPR_COMPLIANCE === 'true',
        log_retention_days: ADMIN_LOG_RETENTION_DAYS,
        swedish_time: moment().tz('Europe/Stockholm').format()
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, logAdminActivity, ACTIVITY_CATEGORIES };