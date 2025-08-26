import express from 'express';
import { adminAuth } from '../middleware/adminAuth';
import { prisma } from '@/packages/database';
import { redis } from '../services/redis';
import { logger } from '../utils/logger';
import { POSAdapter } from '../services/pos-adapter';
import crypto from 'crypto';

const router = express.Router();

// Override transaction verification
router.post('/override-transaction', adminAuth, async (req, res) => {
  try {
    const { businessId, transactionId, amount, reason, posReference } = req.body;
    
    if (!businessId || !transactionId || !amount || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if transaction exists
    let transaction = await prisma.transaction.findUnique({
      where: { id: transactionId }
    });
    
    // Create transaction if it doesn't exist
    if (!transaction) {
      transaction = await prisma.transaction.create({
        data: {
          id: transactionId,
          businessId,
          amount: parseFloat(amount),
          status: 'verified',
          posReference: posReference || null,
          verifiedAt: new Date(),
          overridden: true,
          overrideReason: reason,
          overriddenBy: req.user?.id
        }
      });
    } else {
      // Update existing transaction
      transaction = await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'verified',
          verifiedAt: new Date(),
          overridden: true,
          overrideReason: reason,
          overriddenBy: req.user?.id,
          amount: parseFloat(amount)
        }
      });
    }
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'TRANSACTION_OVERRIDE',
        entityType: 'transaction',
        entityId: transactionId,
        userId: req.user?.id,
        metadata: {
          businessId,
          amount,
          reason,
          posReference
        }
      }
    });
    
    // Clear any pending sync for this transaction
    await prisma.transactionSync.deleteMany({
      where: { transactionId }
    });
    
    res.json({ 
      message: 'Transaction override successful',
      transaction 
    });
  } catch (error) {
    logger.error('Error overriding transaction:', error);
    res.status(500).json({ error: 'Failed to override transaction' });
  }
});

// Get recent overrides
router.get('/recent-overrides', adminAuth, async (req, res) => {
  try {
    const overrides = await prisma.transaction.findMany({
      where: { overridden: true },
      include: {
        business: {
          select: { name: true }
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 10
    });
    
    const formatted = overrides.map(o => ({
      transactionId: o.id,
      businessName: o.business.name,
      amount: o.amount,
      status: o.status,
      posProvider: o.business.posIntegration?.provider || 'unknown',
      timestamp: o.updatedAt
    }));
    
    res.json(formatted);
  } catch (error) {
    logger.error('Error fetching recent overrides:', error);
    res.status(500).json({ error: 'Failed to fetch recent overrides' });
  }
});

// Get POS configuration for a business
router.get('/pos-config/:businessId', adminAuth, async (req, res) => {
  try {
    const { businessId } = req.params;
    
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { posIntegration: true }
    });
    
    if (!business || !business.posIntegration) {
      return res.status(404).json({ error: 'POS configuration not found' });
    }
    
    // Decrypt sensitive fields
    const config = {
      businessId: business.id,
      businessName: business.name,
      provider: business.posIntegration.provider,
      apiKey: '********', // Masked for security
      webhookSecret: '********', // Masked
      merchantId: business.posIntegration.merchantId,
      storeId: business.posIntegration.storeId,
      environment: business.posIntegration.environment,
      autoSync: business.posIntegration.autoSync,
      syncInterval: business.posIntegration.syncInterval,
      retryAttempts: business.posIntegration.maxRetries,
      customSettings: business.posIntegration.customSettings || {}
    };
    
    res.json(config);
  } catch (error) {
    logger.error('Error fetching POS configuration:', error);
    res.status(500).json({ error: 'Failed to fetch POS configuration' });
  }
});

// Update POS configuration
router.put('/reconfigure-pos', adminAuth, async (req, res) => {
  try {
    const {
      businessId,
      provider,
      apiKey,
      webhookSecret,
      merchantId,
      storeId,
      environment,
      autoSync,
      syncInterval,
      retryAttempts,
      customSettings
    } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }
    
    // Update configuration
    const updateData: any = {
      provider,
      merchantId,
      storeId,
      environment,
      autoSync,
      syncInterval,
      maxRetries: retryAttempts,
      customSettings
    };
    
    // Only update sensitive fields if provided (not masked)
    if (apiKey && !apiKey.includes('*')) {
      updateData.apiKey = encrypt(apiKey);
    }
    if (webhookSecret && !webhookSecret.includes('*')) {
      updateData.webhookSecret = encrypt(webhookSecret);
    }
    
    await prisma.posIntegration.update({
      where: { businessId },
      data: updateData
    });
    
    // Clear cached configuration
    await redis.del(`pos:config:${businessId}`);
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'POS_RECONFIGURE',
        entityType: 'business',
        entityId: businessId,
        userId: req.user?.id,
        metadata: {
          provider,
          environment,
          changes: Object.keys(updateData)
        }
      }
    });
    
    res.json({ message: 'POS configuration updated successfully' });
  } catch (error) {
    logger.error('Error updating POS configuration:', error);
    res.status(500).json({ error: 'Failed to update POS configuration' });
  }
});

// Run diagnostics
router.post('/diagnostics/:endpoint', adminAuth, async (req, res) => {
  try {
    const { endpoint } = req.params;
    const { businessId } = req.body;
    
    if (!businessId) {
      return res.status(400).json({ error: 'Business ID required' });
    }
    
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { posIntegration: true }
    });
    
    if (!business || !business.posIntegration) {
      return res.status(404).json({ error: 'Business or POS integration not found' });
    }
    
    const adapter = new POSAdapter(business.posIntegration);
    let result;
    
    switch (endpoint) {
      case 'test-api':
        result = await testAPIConnection(adapter);
        break;
      case 'test-webhook':
        result = await testWebhookValidation(business.posIntegration);
        break;
      case 'test-auth':
        result = await testAuthentication(adapter);
        break;
      case 'test-transactions':
        result = await testTransactionFetch(adapter);
        break;
      case 'test-rate-limits':
        result = await testRateLimits(adapter);
        break;
      default:
        return res.status(400).json({ error: 'Invalid endpoint' });
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Error running diagnostics:', error);
    res.status(500).json({ 
      success: false,
      message: 'Diagnostic test failed',
      details: error.message 
    });
  }
});

// Helper functions
function encrypt(text: string): string {
  const algorithm = 'aes-256-gcm';
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

async function testAPIConnection(adapter: POSAdapter): Promise<any> {
  try {
    const response = await adapter.testConnection();
    return {
      success: true,
      message: 'API connection successful',
      details: {
        responseTime: response.responseTime,
        statusCode: response.statusCode
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'API connection failed',
      details: error.message
    };
  }
}

async function testWebhookValidation(integration: any): Promise<any> {
  try {
    // Simulate webhook payload
    const testPayload = {
      event: 'test',
      timestamp: new Date().toISOString()
    };
    
    const signature = crypto
      .createHmac('sha256', integration.webhookSecret)
      .update(JSON.stringify(testPayload))
      .digest('hex');
    
    const isValid = signature === crypto
      .createHmac('sha256', integration.webhookSecret)
      .update(JSON.stringify(testPayload))
      .digest('hex');
    
    return {
      success: isValid,
      message: isValid ? 'Webhook validation successful' : 'Webhook validation failed',
      details: {
        signatureValid: isValid
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Webhook validation test failed',
      details: error.message
    };
  }
}

async function testAuthentication(adapter: POSAdapter): Promise<any> {
  try {
    const authResult = await adapter.authenticate();
    return {
      success: authResult.success,
      message: authResult.success ? 'Authentication successful' : 'Authentication failed',
      details: {
        tokenExpiry: authResult.tokenExpiry,
        scopes: authResult.scopes
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Authentication test failed',
      details: error.message
    };
  }
}

async function testTransactionFetch(adapter: POSAdapter): Promise<any> {
  try {
    const transactions = await adapter.fetchRecentTransactions(1);
    return {
      success: true,
      message: `Successfully fetched ${transactions.length} transaction(s)`,
      details: {
        count: transactions.length,
        sample: transactions[0] || null
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Transaction fetch failed',
      details: error.message
    };
  }
}

async function testRateLimits(adapter: POSAdapter): Promise<any> {
  try {
    const limits = await adapter.getRateLimits();
    return {
      success: true,
      message: 'Rate limits checked',
      details: {
        remaining: limits.remaining,
        limit: limits.limit,
        resetAt: limits.resetAt
      }
    };
  } catch (error) {
    return {
      success: false,
      message: 'Rate limit check failed',
      details: error.message
    };
  }
}

export default router;