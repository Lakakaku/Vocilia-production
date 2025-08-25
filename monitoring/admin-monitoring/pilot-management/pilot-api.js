#!/usr/bin/env node

/**
 * Swedish Pilot Management API
 * Admin Monitoring Infrastructure - Pilot Business Management
 * 
 * Provides comprehensive management for Swedish pilot businesses:
 * - Business onboarding and approval workflow
 * - Regional business analytics and reporting
 * - Compliance status monitoring
 * - Performance metrics aggregation
 * - Finansinspektionen reporting integration
 */

const express = require('express');
const { createClient } = require('redis');
const { Pool } = require('pg');
const winston = require('winston');
const moment = require('moment-timezone');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

// Environment configuration
const {
  NODE_ENV = 'production',
  PORT = 3000,
  DATABASE_URL,
  REDIS_URL,
  JWT_SECRET,
  SWEDISH_PILOT_ADMIN_ROLE = 'pilot_admin',
  FINANSINSPEKTIONEN_REPORTING = 'true'
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
        service: 'pilot-management-api',
        environment: NODE_ENV,
        swedish_pilot: true,
        ...meta
      };
      return JSON.stringify(logEntry);
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: '/var/log/admin/pilot-management.log',
      maxsize: 50 * 1024 * 1024,
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

// Redis connection
let redisClient;
if (REDIS_URL) {
  redisClient = createClient({ url: REDIS_URL });
  redisClient.on('error', err => logger.error('Redis Client Error', err));
  redisClient.connect().catch(err => logger.error('Redis connection failed', err));
}

// Rate limiting
const pilotApiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many pilot API requests' }
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(pilotApiLimiter);

// Swedish regions and business classifications
const SWEDISH_REGIONS = {
  'stockholm': {
    name: 'Stockholm County',
    code: 'SE-AB',
    timezone: 'Europe/Stockholm',
    population: 2377081,
    major_cities: ['Stockholm', 'Sollentuna', 'Sundbyberg']
  },
  'gothenburg': {
    name: 'Västra Götaland County', 
    code: 'SE-O',
    timezone: 'Europe/Stockholm',
    population: 1725881,
    major_cities: ['Gothenburg', 'Borås', 'Trollhättan']
  },
  'malmo': {
    name: 'Skåne County',
    code: 'SE-M', 
    timezone: 'Europe/Stockholm',
    population: 1377827,
    major_cities: ['Malmö', 'Helsingborg', 'Lund']
  },
  'uppsala': {
    name: 'Uppsala County',
    code: 'SE-C',
    timezone: 'Europe/Stockholm',
    population: 383713,
    major_cities: ['Uppsala', 'Enköping', 'Östhammar']
  },
  'linkoping': {
    name: 'Östergötland County',
    code: 'SE-E',
    timezone: 'Europe/Stockholm',
    population: 465495,
    major_cities: ['Linköping', 'Norrköping', 'Motala']
  }
};

const BUSINESS_TIERS = {
  1: { name: 'Startup', max_locations: 1, monthly_feedback_limit: 100, commission_rate: 0.25 },
  2: { name: 'Growth', max_locations: 5, monthly_feedback_limit: 500, commission_rate: 0.22 },
  3: { name: 'Enterprise', max_locations: 50, monthly_feedback_limit: 2500, commission_rate: 0.20 }
};

const PILOT_STATUS = {
  PENDING: 'pending_approval',
  APPROVED: 'approved_active',
  SUSPENDED: 'suspended',
  GRADUATED: 'graduated_to_production',
  DECLINED: 'declined'
};

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      logger.warn('Invalid JWT token', { error: err.message, ip: req.ip });
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    if (user.role !== SWEDISH_PILOT_ADMIN_ROLE && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Insufficient permissions for pilot management' });
    }

    req.user = user;
    next();
  });
}

// Activity logging integration
async function logPilotActivity(req, activity, details = {}) {
  try {
    // Call admin activity logger service
    const response = await fetch('http://admin-activity-logger:3000/api/log-activity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: req.user?.id || 'system',
        userRole: req.user?.role || 'system',
        sessionId: req.headers['x-session-id'],
        activity,
        category: activity.toLowerCase().startsWith('pilot_') ? activity.toLowerCase() : `pilot_${activity.toLowerCase()}`,
        details,
        success: true
      })
    });

    if (!response.ok) {
      logger.warn('Failed to log pilot activity', { activity, status: response.status });
    }
  } catch (error) {
    logger.error('Error logging pilot activity', { error: error.message, activity });
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
      service: 'pilot-management-api',
      environment: NODE_ENV,
      database: 'connected',
      redis: redisStatus,
      swedish_pilot: true,
      finansinspektionen_reporting: FINANSINSPEKTIONEN_REPORTING === 'true',
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

// Get all Swedish pilot businesses
app.get('/api/pilot/businesses', authenticateToken, async (req, res) => {
  try {
    const { region, status, tier, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT b.*, bl.region, bl.address, bl.city,
             COUNT(DISTINCT fs.id) as total_feedback_sessions,
             COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_sessions,
             AVG(f.quality_score_total) as avg_quality_score,
             SUM(p.amount) as total_rewards_paid
      FROM businesses b
      LEFT JOIN business_locations bl ON b.id = bl.business_id
      LEFT JOIN feedback_sessions fs ON bl.id = fs.location_id
      LEFT JOIN feedback f ON fs.id = f.session_id
      LEFT JOIN payments p ON f.id = p.feedback_id
      WHERE b.pilot_program = true
    `;
    
    const params = [];
    let paramCount = 0;

    if (region && SWEDISH_REGIONS[region]) {
      paramCount++;
      query += ` AND bl.region = $${paramCount}`;
      params.push(region);
    }

    if (status && Object.values(PILOT_STATUS).includes(status)) {
      paramCount++;
      query += ` AND b.pilot_status = $${paramCount}`;
      params.push(status);
    }

    if (tier && BUSINESS_TIERS[tier]) {
      paramCount++;
      query += ` AND b.tier = $${paramCount}`;
      params.push(parseInt(tier));
    }

    query += `
      GROUP BY b.id, bl.region, bl.address, bl.city
      ORDER BY b.created_at DESC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    await logPilotActivity(req, 'PILOT_BUSINESS_VIEW', {
      filters: { region, status, tier, limit, offset },
      resultCount: result.rows.length
    });

    res.json({
      businesses: result.rows.map(row => ({
        ...row,
        region_info: SWEDISH_REGIONS[row.region],
        tier_info: BUSINESS_TIERS[row.tier],
        performance_metrics: {
          completion_rate: row.total_feedback_sessions > 0 
            ? (row.completed_sessions / row.total_feedback_sessions * 100).toFixed(2)
            : 0,
          avg_quality_score: row.avg_quality_score ? parseFloat(row.avg_quality_score).toFixed(1) : null,
          total_rewards_sek: row.total_rewards_paid ? parseFloat(row.total_rewards_paid).toFixed(2) : 0
        }
      })),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rows.length
      },
      filters: { region, status, tier },
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });

  } catch (error) {
    logger.error('Failed to get pilot businesses', error);
    res.status(500).json({
      error: 'Failed to retrieve pilot businesses',
      message: error.message
    });
  }
});

// Get specific pilot business details
app.get('/api/pilot/businesses/:businessId', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req.params;

    const businessQuery = `
      SELECT b.*, 
             COUNT(DISTINCT bl.id) as location_count,
             COUNT(DISTINCT fs.id) as total_sessions,
             COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_sessions,
             AVG(f.quality_score_total) as avg_quality_score,
             SUM(p.amount) as total_rewards,
             MAX(fs.created_at) as last_activity
      FROM businesses b
      LEFT JOIN business_locations bl ON b.id = bl.business_id  
      LEFT JOIN feedback_sessions fs ON bl.id = fs.location_id
      LEFT JOIN feedback f ON fs.id = f.session_id
      LEFT JOIN payments p ON f.id = p.feedback_id
      WHERE b.id = $1 AND b.pilot_program = true
      GROUP BY b.id
    `;

    const locationsQuery = `
      SELECT bl.*, 
             COUNT(fs.id) as session_count,
             AVG(f.quality_score_total) as avg_score
      FROM business_locations bl
      LEFT JOIN feedback_sessions fs ON bl.id = fs.location_id
      LEFT JOIN feedback f ON fs.id = f.session_id
      WHERE bl.business_id = $1
      GROUP BY bl.id
      ORDER BY bl.created_at
    `;

    const recentFeedbackQuery = `
      SELECT f.*, fs.created_at, bl.name as location_name
      FROM feedback f
      JOIN feedback_sessions fs ON f.session_id = fs.id
      JOIN business_locations bl ON fs.location_id = bl.id
      WHERE bl.business_id = $1
      ORDER BY fs.created_at DESC
      LIMIT 10
    `;

    const [businessResult, locationsResult, feedbackResult] = await Promise.all([
      db.query(businessQuery, [businessId]),
      db.query(locationsQuery, [businessId]),
      db.query(recentFeedbackQuery, [businessId])
    ]);

    if (businessResult.rows.length === 0) {
      return res.status(404).json({
        error: 'Pilot business not found',
        businessId
      });
    }

    const business = businessResult.rows[0];

    await logPilotActivity(req, 'PILOT_BUSINESS_VIEW', {
      businessId,
      businessName: business.name,
      locations: locationsResult.rows.length
    });

    res.json({
      business: {
        ...business,
        tier_info: BUSINESS_TIERS[business.tier],
        performance_summary: {
          completion_rate: business.total_sessions > 0 
            ? (business.completed_sessions / business.total_sessions * 100).toFixed(2)
            : 0,
          avg_quality_score: business.avg_quality_score ? parseFloat(business.avg_quality_score).toFixed(1) : null,
          total_rewards_sek: business.total_rewards ? parseFloat(business.total_rewards).toFixed(2) : 0,
          last_activity: business.last_activity
        }
      },
      locations: locationsResult.rows.map(location => ({
        ...location,
        region_info: SWEDISH_REGIONS[location.region],
        performance: {
          avg_score: location.avg_score ? parseFloat(location.avg_score).toFixed(1) : null,
          session_count: parseInt(location.session_count)
        }
      })),
      recent_feedback: feedbackResult.rows,
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });

  } catch (error) {
    logger.error('Failed to get pilot business details', error);
    res.status(500).json({
      error: 'Failed to retrieve business details',
      message: error.message
    });
  }
});

// Approve/reject pilot business application
app.post('/api/pilot/businesses/:businessId/status', authenticateToken, async (req, res) => {
  try {
    const { businessId } = req.params;
    const { status, reason, tier } = req.body;

    if (!Object.values(PILOT_STATUS).includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        validStatuses: Object.values(PILOT_STATUS)
      });
    }

    let updateQuery = `
      UPDATE businesses 
      SET pilot_status = $1, pilot_status_updated_at = NOW(), pilot_status_updated_by = $2
    `;
    const params = [status, req.user.id];
    let paramCount = 2;

    if (reason) {
      paramCount++;
      updateQuery += `, pilot_status_reason = $${paramCount}`;
      params.push(reason);
    }

    if (tier && BUSINESS_TIERS[tier]) {
      paramCount++;
      updateQuery += `, tier = $${paramCount}`;
      params.push(parseInt(tier));
    }

    updateQuery += ` WHERE id = $${paramCount + 1} AND pilot_program = true RETURNING *`;
    params.push(businessId);

    const result = await db.query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Pilot business not found',
        businessId
      });
    }

    const business = result.rows[0];

    // Log activity
    await logPilotActivity(req, 'PILOT_BUSINESS_APPROVE', {
      businessId,
      businessName: business.name,
      newStatus: status,
      previousStatus: business.pilot_status,
      reason,
      tier
    });

    // Send notification to business (mock for now)
    logger.info('Business status updated - notification should be sent', {
      businessId,
      businessName: business.name,
      newStatus: status,
      adminUser: req.user.id
    });

    res.json({
      success: true,
      business: {
        ...business,
        tier_info: BUSINESS_TIERS[business.tier]
      },
      status_change: {
        new_status: status,
        updated_by: req.user.id,
        updated_at: new Date().toISOString(),
        reason
      },
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });

  } catch (error) {
    logger.error('Failed to update business status', error);
    res.status(500).json({
      error: 'Failed to update business status',
      message: error.message
    });
  }
});

// Get pilot program analytics
app.get('/api/pilot/analytics', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, region } = req.query;
    
    let dateFilter = '';
    let regionFilter = '';
    const params = [];
    let paramCount = 0;

    if (startDate) {
      paramCount++;
      dateFilter = ` AND fs.created_at >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      dateFilter += ` AND fs.created_at <= $${paramCount}`;
      params.push(endDate);
    }

    if (region && SWEDISH_REGIONS[region]) {
      paramCount++;
      regionFilter = ` AND bl.region = $${paramCount}`;
      params.push(region);
    }

    const queries = {
      overview: `
        SELECT 
          COUNT(DISTINCT b.id) as total_businesses,
          COUNT(DISTINCT CASE WHEN b.pilot_status = 'approved_active' THEN b.id END) as active_businesses,
          COUNT(DISTINCT bl.id) as total_locations,
          COUNT(DISTINCT fs.id) as total_sessions,
          COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_sessions,
          AVG(f.quality_score_total) as avg_quality_score,
          SUM(p.amount) as total_rewards_paid
        FROM businesses b
        LEFT JOIN business_locations bl ON b.id = bl.business_id
        LEFT JOIN feedback_sessions fs ON bl.id = fs.location_id ${dateFilter}
        LEFT JOIN feedback f ON fs.id = f.session_id
        LEFT JOIN payments p ON f.id = p.feedback_id
        WHERE b.pilot_program = true ${regionFilter}
      `,
      
      regional_breakdown: `
        SELECT 
          bl.region,
          COUNT(DISTINCT b.id) as business_count,
          COUNT(DISTINCT fs.id) as session_count,
          AVG(f.quality_score_total) as avg_score,
          SUM(p.amount) as total_rewards
        FROM businesses b
        JOIN business_locations bl ON b.id = bl.business_id
        LEFT JOIN feedback_sessions fs ON bl.id = fs.location_id ${dateFilter}
        LEFT JOIN feedback f ON fs.id = f.session_id
        LEFT JOIN payments p ON f.id = p.feedback_id
        WHERE b.pilot_program = true ${regionFilter}
        GROUP BY bl.region
        ORDER BY business_count DESC
      `,

      tier_breakdown: `
        SELECT 
          b.tier,
          COUNT(DISTINCT b.id) as business_count,
          COUNT(DISTINCT fs.id) as session_count,
          AVG(f.quality_score_total) as avg_score
        FROM businesses b
        LEFT JOIN business_locations bl ON b.id = bl.business_id
        LEFT JOIN feedback_sessions fs ON bl.id = fs.location_id ${dateFilter}
        LEFT JOIN feedback f ON fs.id = f.session_id
        WHERE b.pilot_program = true ${regionFilter}
        GROUP BY b.tier
        ORDER BY b.tier
      `,

      daily_activity: `
        SELECT 
          DATE(fs.created_at AT TIME ZONE 'Europe/Stockholm') as date,
          COUNT(fs.id) as session_count,
          COUNT(CASE WHEN fs.status = 'completed' THEN 1 END) as completed_count,
          AVG(f.quality_score_total) as avg_score
        FROM feedback_sessions fs
        JOIN business_locations bl ON fs.location_id = bl.id
        JOIN businesses b ON bl.business_id = b.id
        LEFT JOIN feedback f ON fs.id = f.session_id
        WHERE b.pilot_program = true ${dateFilter} ${regionFilter}
        GROUP BY DATE(fs.created_at AT TIME ZONE 'Europe/Stockholm')
        ORDER BY date DESC
        LIMIT 30
      `
    };

    const results = {};
    for (const [key, query] of Object.entries(queries)) {
      const result = await db.query(query, params);
      results[key] = result.rows;
    }

    await logPilotActivity(req, 'PILOT_METRICS_VIEW', {
      filters: { startDate, endDate, region },
      totalBusinesses: results.overview[0]?.total_businesses || 0
    });

    res.json({
      overview: {
        ...results.overview[0],
        completion_rate: results.overview[0].total_sessions > 0 
          ? (results.overview[0].completed_sessions / results.overview[0].total_sessions * 100).toFixed(2)
          : 0,
        avg_quality_score: results.overview[0].avg_quality_score 
          ? parseFloat(results.overview[0].avg_quality_score).toFixed(1) 
          : null,
        total_rewards_sek: results.overview[0].total_rewards_paid 
          ? parseFloat(results.overview[0].total_rewards_paid).toFixed(2)
          : 0
      },
      breakdowns: {
        by_region: results.regional_breakdown.map(row => ({
          ...row,
          region_info: SWEDISH_REGIONS[row.region],
          avg_score: row.avg_score ? parseFloat(row.avg_score).toFixed(1) : null,
          total_rewards_sek: row.total_rewards ? parseFloat(row.total_rewards).toFixed(2) : 0
        })),
        by_tier: results.tier_breakdown.map(row => ({
          ...row,
          tier_info: BUSINESS_TIERS[row.tier],
          avg_score: row.avg_score ? parseFloat(row.avg_score).toFixed(1) : null
        }))
      },
      daily_activity: results.daily_activity.map(row => ({
        ...row,
        completion_rate: row.session_count > 0 
          ? (row.completed_count / row.session_count * 100).toFixed(2)
          : 0,
        avg_score: row.avg_score ? parseFloat(row.avg_score).toFixed(1) : null
      })),
      filters: { startDate, endDate, region },
      swedish_regions: SWEDISH_REGIONS,
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });

  } catch (error) {
    logger.error('Failed to get pilot analytics', error);
    res.status(500).json({
      error: 'Failed to retrieve pilot analytics',
      message: error.message
    });
  }
});

// Generate Finansinspektionen compliance report
app.post('/api/pilot/fi-report', authenticateToken, async (req, res) => {
  try {
    const { reportType = 'monthly', startDate, endDate } = req.body;

    if (!FINANSINSPEKTIONEN_REPORTING === 'true') {
      return res.status(400).json({
        error: 'Finansinspektionen reporting is disabled'
      });
    }

    const reportDate = moment().tz('Europe/Stockholm');
    const reportId = `FI-${reportType.toUpperCase()}-${reportDate.format('YYYYMMDD-HHmmss')}`;

    // Generate compliance report data
    const complianceQuery = `
      SELECT 
        b.org_number,
        b.name as business_name,
        bl.region,
        COUNT(DISTINCT fs.id) as total_transactions,
        COUNT(DISTINCT CASE WHEN fs.status = 'completed' THEN fs.id END) as completed_transactions,
        SUM(p.amount) as total_amount_sek,
        AVG(f.quality_score_total) as avg_quality_score,
        MIN(fs.created_at) as first_transaction,
        MAX(fs.created_at) as last_transaction
      FROM businesses b
      JOIN business_locations bl ON b.id = bl.business_id
      LEFT JOIN feedback_sessions fs ON bl.id = fs.location_id
      LEFT JOIN feedback f ON fs.id = f.session_id
      LEFT JOIN payments p ON f.id = p.feedback_id
      WHERE b.pilot_program = true 
        AND b.pilot_status = 'approved_active'
        ${startDate ? `AND fs.created_at >= '${startDate}'` : ''}
        ${endDate ? `AND fs.created_at <= '${endDate}'` : ''}
      GROUP BY b.id, b.org_number, b.name, bl.region
      HAVING COUNT(fs.id) > 0
      ORDER BY total_amount_sek DESC
    `;

    const result = await db.query(complianceQuery);

    const reportData = {
      report_id: reportId,
      report_type: reportType,
      generated_date: reportDate.toISOString(),
      generated_by: req.user.id,
      period: {
        start_date: startDate || moment().startOf('month').toISOString(),
        end_date: endDate || moment().endOf('month').toISOString()
      },
      summary: {
        total_businesses: result.rows.length,
        total_transactions: result.rows.reduce((sum, row) => sum + parseInt(row.total_transactions), 0),
        completed_transactions: result.rows.reduce((sum, row) => sum + parseInt(row.completed_transactions), 0),
        total_amount_sek: result.rows.reduce((sum, row) => sum + parseFloat(row.total_amount_sek || 0), 0),
        avg_quality_score: result.rows.length > 0 
          ? (result.rows.reduce((sum, row) => sum + parseFloat(row.avg_quality_score || 0), 0) / result.rows.length).toFixed(2)
          : 0
      },
      businesses: result.rows.map(row => ({
        organization_number: row.org_number,
        business_name: row.business_name,
        region: row.region,
        region_info: SWEDISH_REGIONS[row.region],
        transaction_summary: {
          total: parseInt(row.total_transactions),
          completed: parseInt(row.completed_transactions),
          completion_rate: ((row.completed_transactions / row.total_transactions) * 100).toFixed(2)
        },
        financial_summary: {
          total_amount_sek: parseFloat(row.total_amount_sek || 0).toFixed(2),
          avg_quality_score: row.avg_quality_score ? parseFloat(row.avg_quality_score).toFixed(1) : null
        },
        period_info: {
          first_transaction: row.first_transaction,
          last_transaction: row.last_transaction
        }
      })),
      compliance_notes: [
        'All data represents TEST environment activities only',
        'Swedish Financial Supervisory Authority (Finansinspektionen) compliance reporting',
        'Payment services provided under pilot program authorization',
        'All amounts in Swedish Krona (SEK)',
        'Quality scoring based on AI-powered feedback analysis'
      ]
    };

    // Store report in database
    await db.query(`
      INSERT INTO fi_compliance_reports (
        report_id, report_type, generated_by, report_data, 
        start_date, end_date, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [
      reportId,
      reportType,
      req.user.id,
      JSON.stringify(reportData),
      startDate || moment().startOf('month').toISOString(),
      endDate || moment().endOf('month').toISOString()
    ]);

    await logPilotActivity(req, 'FI_REPORT_SUBMIT', {
      reportId,
      reportType,
      businessCount: result.rows.length,
      totalTransactions: reportData.summary.total_transactions
    });

    res.json({
      success: true,
      report: reportData,
      download_url: `/api/pilot/fi-report/${reportId}/download`,
      timestamp: moment().tz('Europe/Stockholm').toISOString()
    });

  } catch (error) {
    logger.error('Failed to generate FI compliance report', error);
    res.status(500).json({
      error: 'Failed to generate compliance report',
      message: error.message
    });
  }
});

// Download FI compliance report
app.get('/api/pilot/fi-report/:reportId/download', authenticateToken, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { format = 'json' } = req.query;

    const result = await db.query(
      'SELECT * FROM fi_compliance_reports WHERE report_id = $1',
      [reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Compliance report not found',
        reportId
      });
    }

    const report = result.rows[0];
    const reportData = JSON.parse(report.report_data);

    await logPilotActivity(req, 'FI_REPORT_VIEW', {
      reportId,
      format
    });

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${reportId}.csv"`);
      
      // Convert to CSV
      const headers = 'Organization Number,Business Name,Region,Total Transactions,Completed Transactions,Completion Rate,Total Amount SEK,Avg Quality Score\n';
      const rows = reportData.businesses.map(b => [
        b.organization_number,
        b.business_name,
        b.region,
        b.transaction_summary.total,
        b.transaction_summary.completed,
        b.transaction_summary.completion_rate,
        b.financial_summary.total_amount_sek,
        b.financial_summary.avg_quality_score
      ].join(',')).join('\n');
      
      res.send(headers + rows);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${reportId}.json"`);
      res.json(reportData);
    }

  } catch (error) {
    logger.error('Failed to download FI report', error);
    res.status(500).json({
      error: 'Failed to download report',
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
    method: req.method,
    user: req.user?.id
  });
  
  res.status(500).json({
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// Database initialization
async function initializeDatabase() {
  try {
    // Create compliance reports table
    await db.query(`
      CREATE TABLE IF NOT EXISTS fi_compliance_reports (
        id SERIAL PRIMARY KEY,
        report_id VARCHAR(255) UNIQUE NOT NULL,
        report_type VARCHAR(100) NOT NULL,
        generated_by VARCHAR(255) NOT NULL,
        report_data JSONB NOT NULL,
        start_date TIMESTAMP WITH TIME ZONE,
        end_date TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_fi_reports_report_id 
      ON fi_compliance_reports(report_id);
    `);

    logger.info('Pilot management database initialized');
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
      logger.info('Swedish Pilot Management API started', {
        port: PORT,
        environment: NODE_ENV,
        pilot_admin_role: SWEDISH_PILOT_ADMIN_ROLE,
        fi_reporting: FINANSINSPEKTIONEN_REPORTING === 'true',
        swedish_time: moment().tz('Europe/Stockholm').format()
      });
    });
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, SWEDISH_REGIONS, BUSINESS_TIERS, PILOT_STATUS };