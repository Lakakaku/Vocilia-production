import { Router } from 'express';
import { adminAuth, adminAudit, getAdminAuditRecords } from '../middleware/adminAuth';
import { getActiveVoiceSessionStats, getVoiceAnalytics } from '../websocket/voiceHandler';

/**
 * @openapi
 * /api/admin/metrics:
 *   get:
 *     summary: Admin metrics
 *     tags: [Admin]
 *     responses:
 *       200:
 *         description: Metrics
 */
export const adminRoutes = Router();

// Protect all admin routes
adminRoutes.use(adminAuth, adminAudit);

adminRoutes.get('/metrics', async (req, res) => {
  try {
    // Basic metrics using existing health endpoint assumptions
    const voiceStats = getActiveVoiceSessionStats();
    res.json({
      status: 'ok',
      metrics: {
        activeVoiceSessions: voiceStats.activeCount,
        activeSessionIds: voiceStats.activeSessionIds,
      }
    });
  } catch (error) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to load metrics' });
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
adminRoutes.get('/voice/analytics', async (req, res) => {
  try {
    const analytics = getVoiceAnalytics();
    res.json(analytics);
  } catch (error) {
    res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Failed to load voice analytics' });
  }
});

// Business approvals (stubs)
/**
 * @openapi
 * /api/admin/business/approvals:
 *   get:
 *     summary: Pending business approvals
 *     tags: [Admin]
 */
adminRoutes.get('/business/approvals', async (req, res) => {
  // TODO: replace with DB query for pending businesses
  res.json({ items: [] });
});

/**
 * @openapi
 * /api/admin/business/{id}/approve:
 *   post:
 *     summary: Approve business
 *     tags: [Admin]
 */
adminRoutes.post('/business/:id/approve', async (req, res) => {
  const { id } = req.params;
  // TODO: update business status in DB
  res.json({ success: true, id, action: 'approved' });
});

/**
 * @openapi
 * /api/admin/business/{id}/reject:
 *   post:
 *     summary: Reject business
 *     tags: [Admin]
 */
adminRoutes.post('/business/:id/reject', async (req, res) => {
  const { id } = req.params;
  // TODO: update business status in DB
  res.json({ success: true, id, action: 'rejected' });
});

// Fraud flags (stub)
/**
 * @openapi
 * /api/admin/fraud/flags:
 *   get:
 *     summary: Fraud flags
 *     tags: [Admin]
 */
adminRoutes.get('/fraud/flags', async (req, res) => {
  res.json({ items: [] });
});

/**
 * @openapi
 * /api/admin/users/{id}/ban:
 *   post:
 *     summary: Ban user
 *     tags: [Admin]
 */
adminRoutes.post('/users/:id/ban', async (req, res) => {
  const { id } = req.params;
  res.json({ success: true, id, action: 'banned' });
});

/**
 * @openapi
 * /api/admin/users/{id}/unban:
 *   post:
 *     summary: Unban user
 *     tags: [Admin]
 */
adminRoutes.post('/users/:id/unban', async (req, res) => {
  const { id } = req.params;
  res.json({ success: true, id, action: 'unbanned' });
});

// Manual score override (stub)
/**
 * @openapi
 * /api/admin/feedback/{id}/override-score:
 *   post:
 *     summary: Override feedback score
 *     tags: [Admin]
 */
adminRoutes.post('/feedback/:id/override-score', async (req, res) => {
  const { id } = req.params;
  const { total } = req.body || {};
  res.json({ success: true, id, total });
});

// Business management (stub)
/**
 * @openapi
 * /api/admin/business/{id}/suspend:
 *   post:
 *     summary: Suspend business
 *     tags: [Admin]
 */
adminRoutes.post('/business/:id/suspend', async (req, res) => {
  const { id } = req.params;
  res.json({ success: true, id, action: 'suspended' });
});

/**
 * @openapi
 * /api/admin/business/{id}/resume:
 *   post:
 *     summary: Resume business
 *     tags: [Admin]
 */
adminRoutes.post('/business/:id/resume', async (req, res) => {
  const { id } = req.params;
  res.json({ success: true, id, action: 'resumed' });
});

/**
 * @openapi
 * /api/admin/business/{id}/tier:
 *   patch:
 *     summary: Change business tier
 *     tags: [Admin]
 */
adminRoutes.patch('/business/:id/tier', async (req, res) => {
  const { id } = req.params;
  const { tier } = req.body || {};
  res.json({ success: true, id, tier });
});

// Live sessions
/**
 * @openapi
 * /api/admin/live/sessions:
 *   get:
 *     summary: Live voice sessions
 *     tags: [Admin]
 */
adminRoutes.get('/live/sessions', async (req, res) => {
  const stats = getActiveVoiceSessionStats();
  res.json(stats);
});

// Audit logs
/**
 * @openapi
 * /api/admin/audit/logs:
 *   get:
 *     summary: Admin audit logs
 *     tags: [Admin]
 */
adminRoutes.get('/audit/logs', async (req, res) => {
  const logs = getAdminAuditRecords();
  res.json({ items: logs });
});


