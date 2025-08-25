import { Router } from 'express';
import { adminAuth, adminAudit, getAdminAuditRecords, requirePermission, authenticateAdmin, generateTokens, refreshToken, getAdminUsers, createAdminUser, AdminRequest } from '../middleware/adminAuth';
import { getActiveVoiceSessionStats, getVoiceAnalytics } from '../websocket/voiceHandler';
import { getAdminWebSocketStats, triggerMetricsBroadcast } from '../websocket/adminHandler';

/**
 * @openapi
 * /api/admin/login:
 *   post:
 *     summary: Admin login
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 */
export const adminRoutes = Router();

// Public auth routes (no authentication required)
adminRoutes.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        code: 'MISSING_CREDENTIALS',
        message: 'Email and password required'
      });
    }

    const user = await authenticateAdmin(email, password);
    if (!user) {
      return res.status(401).json({
        code: 'INVALID_CREDENTIALS',
        message: 'Ogiltiga inloggningsuppgifter' // Swedish: Invalid credentials
      });
    }

    const tokens = generateTokens(user);
    const { passwordHash, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Inloggning lyckades', // Swedish: Login successful
      data: {
        user: userWithoutPassword,
        ...tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Inloggningsfel' // Swedish: Login error
    });
  }
});

/**
 * @openapi
 * /api/admin/refresh:
 *   post:
 *     summary: Refresh admin token
 *     tags: [Admin Auth]
 */
adminRoutes.post('/refresh', refreshToken);

/**
 * @openapi
 * /api/admin/logout:
 *   post:
 *     summary: Admin logout
 *     tags: [Admin Auth]
 */
adminRoutes.post('/logout', adminAuth, (req, res) => {
  // In production, blacklist the token or invalidate the session
  res.json({
    success: true,
    message: 'Utloggning lyckades' // Swedish: Logout successful
  });
});

// Protected admin routes (authentication required)
adminRoutes.use(adminAuth, adminAudit);

/**
 * @openapi
 * /api/admin/metrics:
 *   get:
 *     summary: Admin system metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System metrics
 */
adminRoutes.get('/metrics', requirePermission('system:read'), async (req, res) => {
  try {
    const adminReq = req as AdminRequest;
    const voiceStats = getActiveVoiceSessionStats();
    
    // Enhanced metrics with admin context
    res.json({
      success: true,
      data: {
        system: {
          activeVoiceSessions: voiceStats.activeCount,
          activeSessionIds: voiceStats.activeSessionIds,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          timestamp: new Date().toISOString()
        },
        admin: {
          role: adminReq.admin.role,
          permissions: adminReq.admin.permissions.length,
          sessionId: adminReq.admin.sessionId
        }
      }
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda mätvärden' // Swedish: Failed to load metrics
    });
  }
});

// Voice WebSocket analytics (no PII). In-memory, last ~60min aggregates
/**
 * @openapi
 * /api/admin/voice/analytics:
 *   get:
 *     summary: Voice WebSocket analytics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Analytics
 */
adminRoutes.get('/voice/analytics', requirePermission('analytics:read'), async (req, res) => {
  try {
    const analytics = getVoiceAnalytics();
    res.json({
      success: true,
      data: analytics,
      message: 'Röstanalys laddad' // Swedish: Voice analytics loaded
    });
  } catch (error) {
    console.error('Voice analytics error:', error);
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda röstanalys' // Swedish: Failed to load voice analytics
    });
  }
});

// Admin user management
/**
 * @openapi
 * /api/admin/users:
 *   get:
 *     summary: Get admin users
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/users', requirePermission('admin:read'), async (req, res) => {
  try {
    const users = getAdminUsers();
    res.json({
      success: true,
      data: { users }
    });
  } catch (error) {
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda administratörer' // Swedish: Failed to load administrators
    });
  }
});

/**
 * @openapi
 * /api/admin/users:
 *   post:
 *     summary: Create admin user
 *     tags: [Admin Users]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/users', requirePermission('admin:write'), async (req, res) => {
  try {
    const { email, name, password, role } = req.body;
    
    if (!email || !password || !role) {
      return res.status(400).json({
        code: 'MISSING_FIELDS',
        message: 'E-post, lösenord och roll krävs' // Swedish: Email, password and role required
      });
    }

    const user = await createAdminUser({ email, name, password, role });
    res.status(201).json({
      success: true,
      message: 'Administratör skapad', // Swedish: Administrator created
      data: { user }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte skapa administratör' // Swedish: Failed to create administrator
    });
  }
});

// Business approvals (enhanced with permissions)
/**
 * @openapi
 * /api/admin/business/approvals:
 *   get:
 *     summary: Pending business approvals
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/business/approvals', requirePermission('business:read'), async (req, res) => {
  // TODO: replace with DB query for pending businesses
  res.json({ 
    success: true,
    data: { items: [] },
    message: 'Inga väntande godkännanden' // Swedish: No pending approvals
  });
});

/**
 * @openapi
 * /api/admin/business/{id}/approve:
 *   post:
 *     summary: Approve business
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/approve', requirePermission('business:approve'), async (req, res) => {
  const { id } = req.params;
  const adminReq = req as AdminRequest;
  
  // TODO: update business status in DB
  console.log(`Business ${id} approved by admin ${adminReq.admin.email}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'approved' },
    message: 'Företag godkänt' // Swedish: Business approved
  });
});

/**
 * @openapi
 * /api/admin/business/{id}/reject:
 *   post:
 *     summary: Reject business
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/reject', requirePermission('business:approve'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminReq = req as AdminRequest;
  
  // TODO: update business status in DB
  console.log(`Business ${id} rejected by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'rejected', reason },
    message: 'Företag avvisat' // Swedish: Business rejected
  });
});

// Fraud flags (enhanced with permissions)
/**
 * @openapi
 * /api/admin/fraud/flags:
 *   get:
 *     summary: Fraud flags
 *     tags: [Admin Fraud]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/fraud/flags', requirePermission('fraud:read'), async (req, res) => {
  res.json({ 
    success: true,
    data: { items: [] },
    message: 'Inga bedrägerivarningar' // Swedish: No fraud alerts
  });
});

/**
 * @openapi
 * /api/admin/customers/{id}/ban:
 *   post:
 *     summary: Ban customer
 *     tags: [Admin Fraud]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/customers/:id/ban', requirePermission('fraud:ban'), async (req, res) => {
  const { id } = req.params;
  const { reason, duration } = req.body;
  const adminReq = req as AdminRequest;
  
  console.log(`Customer ${id} banned by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'banned', reason, duration },
    message: 'Kund blockerad' // Swedish: Customer banned
  });
});

/**
 * @openapi
 * /api/admin/customers/{id}/unban:
 *   post:
 *     summary: Unban customer
 *     tags: [Admin Fraud]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/customers/:id/unban', requirePermission('fraud:ban'), async (req, res) => {
  const { id } = req.params;
  const adminReq = req as AdminRequest;
  
  console.log(`Customer ${id} unbanned by admin ${adminReq.admin.email}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'unbanned' },
    message: 'Kund avblockerad' // Swedish: Customer unbanned
  });
});

// Manual score override (enhanced with permissions)
/**
 * @openapi
 * /api/admin/feedback/{id}/override-score:
 *   post:
 *     summary: Override feedback score
 *     tags: [Admin Feedback]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/feedback/:id/override-score', requirePermission('feedback:override'), async (req, res) => {
  const { id } = req.params;
  const { total, reason } = req.body || {};
  const adminReq = req as AdminRequest;
  
  if (!total || !reason) {
    return res.status(400).json({
      code: 'MISSING_FIELDS',
      message: 'Poäng och anledning krävs' // Swedish: Score and reason required
    });
  }
  
  console.log(`Feedback ${id} score overridden to ${total} by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, total, reason },
    message: 'Poäng ändrad' // Swedish: Score changed
  });
});

// Business management (enhanced with permissions)
/**
 * @openapi
 * /api/admin/business/{id}/suspend:
 *   post:
 *     summary: Suspend business
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/suspend', requirePermission('business:suspend'), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const adminReq = req as AdminRequest;
  
  console.log(`Business ${id} suspended by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'suspended', reason },
    message: 'Företag avstängt' // Swedish: Business suspended
  });
});

/**
 * @openapi
 * /api/admin/business/{id}/resume:
 *   post:
 *     summary: Resume business
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.post('/business/:id/resume', requirePermission('business:suspend'), async (req, res) => {
  const { id } = req.params;
  const adminReq = req as AdminRequest;
  
  console.log(`Business ${id} resumed by admin ${adminReq.admin.email}`);
  
  res.json({ 
    success: true, 
    data: { id, action: 'resumed' },
    message: 'Företag återaktiverat' // Swedish: Business resumed
  });
});

/**
 * @openapi
 * /api/admin/business/{id}/tier:
 *   patch:
 *     summary: Change business tier
 *     tags: [Admin Business]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.patch('/business/:id/tier', requirePermission('business:write'), async (req, res) => {
  const { id } = req.params;
  const { tier, reason } = req.body || {};
  const adminReq = req as AdminRequest;
  
  if (!tier) {
    return res.status(400).json({
      code: 'MISSING_TIER',
      message: 'Nivå krävs' // Swedish: Tier required
    });
  }
  
  console.log(`Business ${id} tier changed to ${tier} by admin ${adminReq.admin.email}, reason: ${reason}`);
  
  res.json({ 
    success: true, 
    data: { id, tier, reason },
    message: 'Företagsnivå ändrad' // Swedish: Business tier changed
  });
});

// Live sessions (enhanced with permissions)
/**
 * @openapi
 * /api/admin/live/sessions:
 *   get:
 *     summary: Live voice sessions
 *     tags: [Admin Monitoring]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/live/sessions', requirePermission('system:read'), async (req, res) => {
  try {
    const stats = getActiveVoiceSessionStats();
    res.json({
      success: true,
      data: stats,
      message: `${stats.activeCount} aktiva sessioner` // Swedish: active sessions
    });
  } catch (error) {
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda livesessioner' // Swedish: Failed to load live sessions
    });
  }
});

// Audit logs (enhanced with permissions and filtering)
/**
 * @openapi
 * /api/admin/audit/logs:
 *   get:
 *     summary: Admin audit logs
 *     tags: [Admin Audit]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/audit/logs', requirePermission('system:read'), async (req, res) => {
  try {
    const { adminId, action, startDate, endDate, limit } = req.query;
    
    const filters = {
      adminId: adminId as string,
      action: action as string,
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : 100
    };
    
    const logs = getAdminAuditRecords(filters);
    res.json({ 
      success: true,
      data: { logs, count: logs.length },
      message: `${logs.length} granskningsloggar` // Swedish: audit logs
    });
  } catch (error) {
    res.status(500).json({ 
      code: 'INTERNAL_ERROR', 
      message: 'Kunde inte ladda granskningsloggar' // Swedish: Failed to load audit logs
    });
  }
});

// Current admin user info
/**
 * @openapi
 * /api/admin/me:
 *   get:
 *     summary: Get current admin user info
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/me', (req, res) => {
  const adminReq = req as AdminRequest;
  
  res.json({
    success: true,
    data: {
      id: adminReq.admin.id,
      email: adminReq.admin.email,
      role: adminReq.admin.role,
      permissions: adminReq.admin.permissions,
      sessionId: adminReq.admin.sessionId
    }
  });
});

// WebSocket connection stats
/**
 * @openapi
 * /api/admin/websocket/stats:
 *   get:
 *     summary: Get WebSocket connection statistics
 *     tags: [Admin Monitoring]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/websocket/stats', requirePermission('system:read'), (req, res) => {
  try {
    const adminWsStats = getAdminWebSocketStats();
    const voiceStats = getActiveVoiceSessionStats();
    
    res.json({
      success: true,
      data: {
        admin: adminWsStats,
        voice: {
          activeCount: voiceStats.activeCount,
          activeSessionIds: voiceStats.activeSessionIds
        },
        total: {
          connections: adminWsStats.totalConnections + voiceStats.activeCount
        }
      },
      message: `${adminWsStats.totalConnections} admin + ${voiceStats.activeCount} röst anslutningar` // Swedish: admin + voice connections
    });
  } catch (error) {
    console.error('WebSocket stats error:', error);
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Kunde inte ladda WebSocket statistik' // Swedish: Failed to load WebSocket statistics
    });
  }
});

// WebSocket connection endpoint info
/**
 * @openapi
 * /api/admin/websocket/info:
 *   get:
 *     summary: Get WebSocket connection information for admin dashboard
 *     tags: [Admin Monitoring]
 *     security:
 *       - bearerAuth: []
 */
adminRoutes.get('/websocket/info', requirePermission('system:read'), (req, res) => {
  const wsUrl = process.env.NODE_ENV === 'production' 
    ? `wss://${req.get('host')}/admin-ws`
    : `ws://${req.get('host')}/admin-ws`;
    
  res.json({
    success: true,
    data: {
      url: wsUrl,
      protocol: 'websocket',
      authentication: 'jwt_token',
      reconnectInterval: 5000,
      pingInterval: 30000
    },
    message: 'WebSocket anslutningsinformation' // Swedish: WebSocket connection information
  });
});


