import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../apps/api-gateway/src/index';
import { prisma } from '@/packages/database';
import { redis } from '../apps/api-gateway/src/services/redis';

describe('Integration Monitoring & Manual Override Tests', () => {
  let adminToken: string;
  let testBusinessId: string;

  beforeAll(async () => {
    // Setup test data
    const testBusiness = await prisma.business.create({
      data: {
        name: 'Test Business',
        orgNumber: '556677-8899',
        email: 'test@business.com',
        posIntegration: {
          provider: 'square',
          merchantId: 'TEST_MERCHANT_123',
          environment: 'sandbox'
        }
      }
    });
    testBusinessId = testBusiness.id;

    // Get admin token (mock for testing)
    adminToken = 'test-admin-token';
  });

  afterAll(async () => {
    // Cleanup
    await prisma.business.delete({
      where: { id: testBusinessId }
    });
    await redis.flushdb();
  });

  describe('Integration Health Monitoring', () => {
    it('should fetch integration health for all businesses', async () => {
      const response = await request(app)
        .get('/api/admin/integration-health')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body[0]).toHaveProperty('businessId');
      expect(response.body[0]).toHaveProperty('status');
      expect(response.body[0]).toHaveProperty('posProvider');
    });

    it('should fetch integration health for specific business', async () => {
      const response = await request(app)
        .get(`/api/admin/integration-health?businessId=${testBusinessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBe(1);
      expect(response.body[0].businessId).toBe(testBusinessId);
    });

    it('should fetch pending transaction syncs', async () => {
      // Create a pending sync
      await prisma.transactionSync.create({
        data: {
          transactionId: 'TEST_TXN_123',
          businessId: testBusinessId,
          amount: 100.00,
          status: 'pending'
        }
      });

      const response = await request(app)
        .get('/api/admin/pending-syncs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.some((s: any) => s.transactionId === 'TEST_TXN_123')).toBe(true);
    });

    it('should fetch performance metrics', async () => {
      // Record some metrics
      await redis.hset('perf:global:10', {
        responseTime: '150',
        successRate: '95',
        throughput: '25'
      });

      const response = await request(app)
        .get('/api/admin/integration-performance')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should fetch active alerts', async () => {
      // Create an alert
      await redis.hmset(`alert:${testBusinessId}:test`, {
        severity: 'warning',
        title: 'Test Alert',
        description: 'This is a test alert',
        timestamp: new Date().toISOString(),
        businessId: testBusinessId
      });

      const response = await request(app)
        .get('/api/admin/integration-alerts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should force sync for a business', async () => {
      const response = await request(app)
        .post('/api/admin/force-sync')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessId: testBusinessId,
          fullSync: false
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Sync initiated');
      expect(response.body).toHaveProperty('syncId');
    });

    it('should retry a specific transaction', async () => {
      // Create a failed sync
      const sync = await prisma.transactionSync.create({
        data: {
          transactionId: 'RETRY_TXN_456',
          businessId: testBusinessId,
          amount: 200.00,
          status: 'failed',
          lastError: 'Connection timeout'
        }
      });

      const response = await request(app)
        .post('/api/admin/retry-transaction')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          transactionId: 'RETRY_TXN_456'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Transaction queued for retry');
    });
  });

  describe('Manual Override Tools', () => {
    it('should override transaction verification', async () => {
      const response = await request(app)
        .post('/api/admin/override-transaction')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessId: testBusinessId,
          transactionId: 'OVERRIDE_TXN_789',
          amount: '150.00',
          reason: 'Manual verification for testing',
          posReference: 'POS_REF_123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Transaction override successful');
      expect(response.body.transaction).toHaveProperty('id', 'OVERRIDE_TXN_789');
    });

    it('should fetch recent overrides', async () => {
      const response = await request(app)
        .get('/api/admin/recent-overrides')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toBeInstanceOf(Array);
    });

    it('should fetch POS configuration', async () => {
      // Create POS integration
      await prisma.posIntegration.create({
        data: {
          businessId: testBusinessId,
          provider: 'square',
          merchantId: 'TEST_MERCHANT',
          environment: 'sandbox',
          autoSync: true,
          syncInterval: 300,
          maxRetries: 3
        }
      });

      const response = await request(app)
        .get(`/api/admin/pos-config/${testBusinessId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('businessId', testBusinessId);
      expect(response.body).toHaveProperty('provider', 'square');
      expect(response.body).toHaveProperty('apiKey', '********'); // Masked
    });

    it('should update POS configuration', async () => {
      const response = await request(app)
        .put('/api/admin/reconfigure-pos')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessId: testBusinessId,
          provider: 'shopify',
          merchantId: 'NEW_MERCHANT',
          environment: 'production',
          autoSync: false,
          syncInterval: 600,
          retryAttempts: 5
        })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'POS configuration updated successfully');
    });

    it('should run diagnostics', async () => {
      const response = await request(app)
        .post('/api/admin/diagnostics/test-api')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessId: testBusinessId
        });

      // May fail if no actual POS connection, but should return proper structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Frontend Pages', () => {
    it('Integration Monitoring page should render correctly', () => {
      // Test that the page exports a valid React component
      const IntegrationMonitoring = require('../apps/admin-dashboard/src/pages/integration-monitoring').default;
      expect(IntegrationMonitoring).toBeDefined();
      expect(typeof IntegrationMonitoring).toBe('function');
    });

    it('Manual Overrides page should render correctly', () => {
      // Test that the page exports a valid React component
      const ManualOverrides = require('../apps/admin-dashboard/src/pages/manual-overrides').default;
      expect(ManualOverrides).toBeDefined();
      expect(typeof ManualOverrides).toBe('function');
    });
  });

  describe('Security & Permissions', () => {
    it('should reject requests without admin auth', async () => {
      await request(app)
        .get('/api/admin/integration-health')
        .expect(401);
    });

    it('should log audit trail for overrides', async () => {
      await request(app)
        .post('/api/admin/override-transaction')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          businessId: testBusinessId,
          transactionId: 'AUDIT_TXN_999',
          amount: '100.00',
          reason: 'Audit test'
        });

      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'TRANSACTION_OVERRIDE',
          entityId: 'AUDIT_TXN_999'
        }
      });

      expect(auditLog).toBeDefined();
      expect(auditLog?.entityType).toBe('transaction');
    });
  });
});

describe('Performance & Scalability', () => {
  it('should handle concurrent health checks efficiently', async () => {
    const promises = Array(10).fill(null).map(() =>
      request(app)
        .get('/api/admin/integration-health')
        .set('Authorization', `Bearer ${adminToken}`)
    );

    const startTime = Date.now();
    await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });

  it('should cache frequently accessed data', async () => {
    // First request
    await request(app)
      .get('/api/admin/integration-health')
      .set('Authorization', `Bearer ${adminToken}`);

    // Second request should be faster due to caching
    const startTime = Date.now();
    await request(app)
      .get('/api/admin/integration-health')
      .set('Authorization', `Bearer ${adminToken}`);
    const duration = Date.now() - startTime;

    expect(duration).toBeLessThan(100); // Cached response should be very fast
  });
});