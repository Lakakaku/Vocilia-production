import express from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { prisma } from '@/packages/database';
import { POSHealthMonitor } from '../services/pos-health-monitor';
import { redis } from '../services/redis';
import { logger } from '../utils/logger';

const router = express.Router();

// Get integration health for all or specific business
router.get('/integration-health', adminAuth, async (req, res) => {
  try {
    const { businessId } = req.query;
    
    let businesses;
    if (businessId) {
      businesses = await prisma.business.findMany({
        where: { id: businessId as string },
        include: {
          locations: true,
          _count: {
            select: {
              feedbacks: true,
              payments: true
            }
          }
        }
      });
    } else {
      businesses = await prisma.business.findMany({
        where: { 
          posIntegration: { not: null } 
        },
        include: {
          locations: true,
          _count: {
            select: {
              feedbacks: true,
              payments: true
            }
          }
        }
      });
    }
    
    const healthData = await Promise.all(businesses.map(async (business) => {
      const healthMonitor = new POSHealthMonitor(business.id);
      const health = await healthMonitor.getHealth();
      
      // Get recent sync stats
      const recentSyncs = await prisma.transactionSync.findMany({
        where: {
          businessId: business.id,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24h
          }
        }
      });
      
      const successCount = recentSyncs.filter(s => s.status === 'completed').length;
      const failureCount = recentSyncs.filter(s => s.status === 'failed').length;
      
      // Get webhook stats from Redis
      const webhookStats = await redis.hgetall(`webhook:stats:${business.id}`);
      
      // Get API call stats
      const apiStats = await redis.hgetall(`api:stats:${business.id}`);
      
      return {
        businessId: business.id,
        businessName: business.name,
        posProvider: business.posIntegration?.provider || 'unknown',
        status: health.status,
        lastSync: health.lastSync,
        syncSuccess: successCount,
        syncFailures: failureCount,
        avgResponseTime: health.avgResponseTime,
        webhookHealth: {
          received: parseInt(webhookStats?.received || '0'),
          processed: parseInt(webhookStats?.processed || '0'),
          failed: parseInt(webhookStats?.failed || '0'),
          lastReceived: webhookStats?.lastReceived || null
        },
        apiHealth: {
          calls: parseInt(apiStats?.calls || '0'),
          errors: parseInt(apiStats?.errors || '0'),
          avgLatency: parseFloat(apiStats?.avgLatency || '0'),
          lastCall: apiStats?.lastCall || null
        },
        issues: health.issues || []
      };
    }));
    
    res.json(healthData);
  } catch (error) {
    logger.error('Error fetching integration health:', error);
    res.status(500).json({ error: 'Failed to fetch integration health' });
  }
});

// Get pending transaction syncs
router.get('/pending-syncs', adminAuth, async (req, res) => {
  try {
    const { businessId } = req.query;
    
    const where: any = {
      status: { in: ['pending', 'syncing', 'retrying'] }
    };
    
    if (businessId) {
      where.businessId = businessId as string;
    }
    
    const pendingSyncs = await prisma.transactionSync.findMany({
      where,
      include: {
        business: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    
    const formattedSyncs = pendingSyncs.map(sync => ({
      transactionId: sync.transactionId,
      businessName: sync.business.name,
      status: sync.status,
      attempts: sync.attempts,
      lastAttempt: sync.lastAttemptAt,
      error: sync.lastError,
      amount: sync.amount,
      posProvider: sync.business.posIntegration?.provider || 'unknown'
    }));
    
    res.json(formattedSyncs);
  } catch (error) {
    logger.error('Error fetching pending syncs:', error);
    res.status(500).json({ error: 'Failed to fetch pending syncs' });
  }
});

// Get integration performance metrics
router.get('/integration-performance', adminAuth, async (req, res) => {
  try {
    const { businessId } = req.query;
    const timeRange = 24 * 60 * 60 * 1000; // 24 hours
    
    // Generate time buckets (hourly)
    const buckets = [];
    const now = Date.now();
    for (let i = 23; i >= 0; i--) {
      const timestamp = new Date(now - i * 60 * 60 * 1000);
      buckets.push({
        timestamp: timestamp.toISOString(),
        hour: timestamp.getHours()
      });
    }
    
    // Fetch performance data from Redis time series
    const performanceData = await Promise.all(buckets.map(async (bucket) => {
      const key = businessId 
        ? `perf:${businessId}:${bucket.hour}`
        : `perf:global:${bucket.hour}`;
      
      const data = await redis.hgetall(key);
      
      return {
        timestamp: bucket.timestamp.split('T')[1].slice(0, 5), // HH:MM format
        responseTime: parseFloat(data?.responseTime || '0'),
        successRate: parseFloat(data?.successRate || '0'),
        throughput: parseInt(data?.throughput || '0')
      };
    }));
    
    res.json(performanceData);
  } catch (error) {
    logger.error('Error fetching performance metrics:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

// Get active integration alerts
router.get('/integration-alerts', adminAuth, async (req, res) => {
  try {
    const { businessId } = req.query;
    
    // Fetch alerts from Redis
    const alertKeys = await redis.keys(
      businessId ? `alert:${businessId}:*` : 'alert:*'
    );
    
    const alerts = await Promise.all(alertKeys.map(async (key) => {
      const alert = await redis.hgetall(key);
      return {
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        timestamp: alert.timestamp,
        businessId: alert.businessId
      };
    }));
    
    // Sort by timestamp and return latest
    const sortedAlerts = alerts
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
    
    res.json(sortedAlerts);
  } catch (error) {
    logger.error('Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Force sync for a business
router.post('/force-sync', adminAuth, async (req, res) => {
  try {
    const { businessId, fullSync = false } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }
    
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });
    
    if (!business || !business.posIntegration) {
      return res.status(404).json({ error: 'Business or POS integration not found' });
    }
    
    // Queue sync job
    await redis.rpush('sync:queue', JSON.stringify({
      businessId,
      type: fullSync ? 'full' : 'incremental',
      priority: 'high',
      requestedAt: new Date().toISOString(),
      requestedBy: req.user?.id
    }));
    
    // Trigger immediate processing
    await redis.publish('sync:trigger', businessId);
    
    // Track force sync
    await prisma.auditLog.create({
      data: {
        action: 'FORCE_SYNC',
        entityType: 'business',
        entityId: businessId,
        userId: req.user?.id,
        metadata: { fullSync }
      }
    });
    
    res.json({ 
      message: 'Sync initiated',
      syncId: `sync_${businessId}_${Date.now()}`
    });
  } catch (error) {
    logger.error('Error forcing sync:', error);
    res.status(500).json({ error: 'Failed to initiate sync' });
  }
});

// Retry specific transaction
router.post('/retry-transaction', adminAuth, async (req, res) => {
  try {
    const { transactionId } = req.body;
    
    if (!transactionId) {
      return res.status(400).json({ error: 'Transaction ID required' });
    }
    
    const transactionSync = await prisma.transactionSync.findUnique({
      where: { transactionId },
      include: { business: true }
    });
    
    if (!transactionSync) {
      return res.status(404).json({ error: 'Transaction sync not found' });
    }
    
    // Reset status and queue for retry
    await prisma.transactionSync.update({
      where: { transactionId },
      data: {
        status: 'retrying',
        attempts: { increment: 1 },
        lastAttemptAt: new Date()
      }
    });
    
    // Queue retry job
    await redis.rpush('retry:queue', JSON.stringify({
      transactionId,
      businessId: transactionSync.businessId,
      priority: 'high',
      retryRequestedBy: req.user?.id
    }));
    
    res.json({ message: 'Transaction queued for retry' });
  } catch (error) {
    logger.error('Error retrying transaction:', error);
    res.status(500).json({ error: 'Failed to retry transaction' });
  }
});

// Get businesses for dropdown
router.get('/businesses', adminAuth, async (req, res) => {
  try {
    const businesses = await prisma.business.findMany({
      where: { 
        posIntegration: { not: null } 
      },
      select: {
        id: true,
        name: true,
        posIntegration: {
          select: {
            provider: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    const formatted = businesses.map(b => ({
      id: b.id,
      name: b.name,
      posProvider: b.posIntegration?.provider
    }));
    
    res.json(formatted);
  } catch (error) {
    logger.error('Error fetching businesses:', error);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

export default router;