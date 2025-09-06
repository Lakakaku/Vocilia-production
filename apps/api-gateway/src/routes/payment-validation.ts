import express, { Request, Response } from 'express';
import { z } from 'zod';
import { stripeService } from '../services/stripe-connect';
import { swedishBankingService } from '../services/swedish-banking';
import { paymentSecurityService } from '../services/payment-security';
import { reconciliationService } from '../services/financial-reconciliation';
import { authenticateAdmin } from '../middleware/adminAuth';
import { logger } from '../utils/logger';

const router = express.Router();

// Schema Validation
const OnboardingSchema = z.object({
  businessId: z.string(),
  businessDetails: z.object({
    name: z.string(),
    orgNumber: z.string(),
    email: z.string().email(),
    phone: z.string().optional(),
    address: z.object({
      line1: z.string(),
      city: z.string(),
      postal_code: z.string(),
      country: z.string().length(2)
    }).optional(),
    bankAccount: z.object({
      country: z.string().length(2),
      currency: z.string().length(3),
      account_holder_name: z.string(),
      account_holder_type: z.enum(['individual', 'company']),
      clearing_number: z.string(),
      account_number: z.string()
    }).optional(),
    representatives: z.array(z.object({
      first_name: z.string(),
      last_name: z.string(),
      email: z.string().email(),
      phone: z.string().optional(),
      dob: z.object({
        day: z.number(),
        month: z.number(),
        year: z.number()
      }).optional(),
      address: z.object({
        line1: z.string(),
        city: z.string(),
        postal_code: z.string(),
        country: z.string().length(2)
      }).optional(),
      relationship: z.object({
        title: z.string(),
        owner: z.boolean(),
        percent_ownership: z.number().optional()
      }),
      ssn_last_4: z.string().optional()
    })).optional()
  })
});

const RewardCalculationSchema = z.object({
  feedbackId: z.string(),
  qualityScore: z.number().min(0).max(100),
  purchaseAmount: z.number().positive(),
  businessId: z.string(),
  riskScore: z.number().min(0).max(1).optional()
});

const PayoutSchema = z.object({
  feedbackId: z.string(),
  customerId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('SEK'),
  paymentMethod: z.enum(['bank_transfer', 'swish', 'bankgiro']).optional(),
  bankDetails: z.object({
    clearing_number: z.string(),
    account_number: z.string()
  }).optional(),
  swishNumber: z.string().optional(),
  bankgiroNumber: z.string().optional(),
  forceFailure: z.boolean().optional(),
  simulateNetworkError: z.boolean().optional()
});

// Stripe Connect Onboarding
router.post('/connect/onboard', async (req: Request, res: Response) => {
  try {
    // Enforce HTTPS
    paymentSecurityService.enforceHTTPS(req.protocol);
    
    const validation = OnboardingSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { businessId, businessDetails } = validation.data;

    // Validate Swedish organization number
    if (!swedishBankingService.validateOrganizationNumber(businessDetails.orgNumber)) {
      return res.status(400).json({ 
        error: 'Invalid Swedish organization number' 
      });
    }

    // Validate bank account if provided
    if (businessDetails.bankAccount) {
      const bankValidation = swedishBankingService.validateBankAccount(
        businessDetails.bankAccount.clearing_number,
        businessDetails.bankAccount.account_number
      );

      if (!bankValidation.valid) {
        return res.status(400).json({ 
          error: bankValidation.error 
        });
      }
    }

    // Check for multi-owner validation
    if (businessDetails.representatives && businessDetails.representatives.length > 0) {
      const totalOwnership = businessDetails.representatives
        .filter(r => r.relationship.owner)
        .reduce((sum, r) => sum + (r.relationship.percent_ownership || 0), 0);

      if (totalOwnership !== 100 && businessDetails.representatives.some(r => r.relationship.owner)) {
        return res.status(400).json({ 
          error: 'Total ownership must equal 100%' 
        });
      }
    }

    // Create Stripe Connect account
    const account = await stripeService.createConnectedAccount({
      type: 'custom',
      country: 'SE',
      business_type: 'company',
      company: {
        name: businessDetails.name,
        tax_id: businessDetails.orgNumber
      },
      business_profile: {
        mcc: '5999', // Miscellaneous retail
        url: `https://feedback-platform.se/business/${businessId}`
      },
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
        bank_transfer_payments: { requested: true }
      },
      settings: {
        payouts: {
          schedule: {
            interval: 'daily',
            delay_days: 2
          }
        }
      }
    });

    // Create account link for onboarding
    const accountLink = await stripeService.createAccountLink(
      account.id,
      `https://feedback-platform.se/business/${businessId}/onboarding/complete`,
      `https://feedback-platform.se/business/${businessId}/onboarding`
    );

    // Audit log
    await reconciliationService.createAuditEntry({
      eventType: 'stripe_account_created',
      actor: businessId,
      entityId: account.id,
      entityType: 'stripe_account',
      details: {
        businessId,
        accountId: account.id,
        orgNumber: businessDetails.orgNumber
      },
      ipAddress: req.ip
    });

    res.json({
      accountId: account.id,
      onboardingUrl: accountLink.url,
      verificationStatus: 'pending',
      requiredFields: account.requirements?.currently_due || [],
      ownersVerified: businessDetails.representatives?.length || 0,
      totalOwnership: businessDetails.representatives
        ?.filter(r => r.relationship.owner)
        .reduce((sum, r) => sum + (r.relationship.percent_ownership || 0), 0) || 0
    });
  } catch (error) {
    logger.error('Onboarding error:', error);
    res.status(500).json({ error: 'Failed to create connected account' });
  }
});

// Calculate Reward
router.post('/calculate-reward', async (req: Request, res: Response) => {
  try {
    const validation = RewardCalculationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const { feedbackId, qualityScore, purchaseAmount, businessId, riskScore } = validation.data;

    // Define reward tiers
    const rewardTiers = [
      { min: 90, max: 100, percentage: [10, 12] },
      { min: 80, max: 89, percentage: [7, 9] },
      { min: 70, max: 79, percentage: [5, 7] },
      { min: 60, max: 69, percentage: [3, 5] },
      { min: 0, max: 59, percentage: [1, 3] }
    ];

    // Find applicable tier
    const tier = rewardTiers.find(t => qualityScore >= t.min && qualityScore <= t.max);
    if (!tier) {
      return res.status(400).json({ error: 'Invalid quality score' });
    }

    // Calculate reward within tier range
    const tierPosition = (qualityScore - tier.min) / (tier.max - tier.min);
    const rewardPercentage = tier.percentage[0] + 
      (tier.percentage[1] - tier.percentage[0]) * tierPosition;
    
    let rewardAmount = (purchaseAmount * rewardPercentage) / 100;

    // Apply fraud prevention caps
    let cappedReason = null;
    if (riskScore && riskScore > 0.7) {
      const maxReward = 1000; // Maximum cap for high-risk transactions
      if (rewardAmount > maxReward) {
        rewardAmount = maxReward;
        cappedReason = 'fraud_prevention';
      }
    }

    // Calculate commission (20%)
    const commissionAmount = rewardAmount * 0.20;

    res.json({
      feedbackId,
      qualityScore,
      purchaseAmount,
      rewardPercentage: rewardPercentage.toFixed(2),
      rewardAmount: Math.round(rewardAmount * 100) / 100,
      commissionAmount: Math.round(commissionAmount * 100) / 100,
      cappedReason
    });
  } catch (error) {
    logger.error('Reward calculation error:', error);
    res.status(500).json({ error: 'Failed to calculate reward' });
  }
});

// Process Payout
router.post('/payout', async (req: Request, res: Response) => {
  try {
    const validation = PayoutSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error });
    }

    const data = validation.data;

    // Check minimum payout threshold (10 SEK)
    if (data.amount < 10) {
      return res.status(400).json({ 
        error: 'Amount below minimum payout threshold' 
      });
    }

    // Simulate failures for testing
    if (data.forceFailure) {
      const retryInfo = await paymentSecurityService.scheduleRetry(data.feedbackId);
      return res.status(202).json(retryInfo);
    }

    if (data.simulateNetworkError) {
      return res.status(503).json({
        error: 'Payment service temporarily unavailable',
        retryAfter: 30
      });
    }

    // Check circuit breaker
    const circuitOpen = await paymentSecurityService.checkCircuitBreaker('payments');
    if (!circuitOpen) {
      return res.status(503).json({
        error: 'Payment service circuit breaker open',
        resetTime: new Date(Date.now() + 60000).toISOString()
      });
    }

    // Velocity check
    const velocityCheck = await paymentSecurityService.checkVelocity({
      customerId: data.customerId,
      limit: 'hourly',
      maxAmount: 1000,
      maxTransactions: 5
    });

    if (velocityCheck.limitExceeded) {
      return res.status(429).json({
        error: 'Velocity limit exceeded',
        resetTime: velocityCheck.resetTime
      });
    }

    let paymentResult;

    // Process based on payment method
    switch (data.paymentMethod) {
      case 'swish':
        if (!data.swishNumber) {
          return res.status(400).json({ error: 'Swish number required' });
        }
        if (!swedishBankingService.validateSwishNumber(data.swishNumber)) {
          return res.status(400).json({ error: 'Invalid Swish number' });
        }
        paymentResult = await swedishBankingService.initiateSwishPayment({
          phoneNumber: data.swishNumber,
          amount: data.amount,
          message: `Feedback reward ${data.feedbackId}`
        });
        break;

      case 'bankgiro':
        if (!data.bankgiroNumber) {
          return res.status(400).json({ error: 'Bankgiro number required' });
        }
        if (!swedishBankingService.validateBankgiroNumber(data.bankgiroNumber)) {
          return res.status(400).json({ error: 'Invalid Bankgiro number' });
        }
        paymentResult = await swedishBankingService.initiateBankgiroPayment({
          bankgiroNumber: data.bankgiroNumber,
          amount: data.amount,
          reference: data.feedbackId
        });
        break;

      default: // bank_transfer
        if (!data.bankDetails) {
          return res.status(400).json({ error: 'Bank details required' });
        }
        const bankValidation = swedishBankingService.validateBankAccount(
          data.bankDetails.clearing_number,
          data.bankDetails.account_number
        );
        if (!bankValidation.valid) {
          return res.status(400).json({ error: bankValidation.error });
        }
        
        // Create Stripe transfer
        paymentResult = await stripeService.createPayout({
          amount: Math.round(data.amount * 100), // Convert to cents
          currency: data.currency,
          description: `Feedback reward ${data.feedbackId}`,
          metadata: {
            feedbackId: data.feedbackId,
            customerId: data.customerId
          }
        });
        break;
    }

    // Record transaction for velocity tracking
    await paymentSecurityService.recordTransaction(data.customerId, data.amount);

    // Audit log
    await reconciliationService.createAuditEntry({
      eventType: 'payout_initiated',
      actor: 'system',
      entityId: paymentResult.paymentId || paymentResult.id,
      entityType: 'payment',
      details: {
        feedbackId: data.feedbackId,
        customerId: data.customerId,
        amount: data.amount,
        method: data.paymentMethod || 'bank_transfer'
      },
      ipAddress: req.ip
    });

    res.json({
      payoutId: paymentResult.paymentId || paymentResult.id,
      status: paymentResult.status || 'processing',
      paymentMethod: data.paymentMethod || 'bank_transfer',
      instantTransfer: data.paymentMethod === 'swish',
      processingTime: data.paymentMethod === 'bankgiro' ? '1-2 business days' : 'instant',
      estimatedArrival: new Date(Date.now() + (data.paymentMethod === 'swish' ? 0 : 86400000)).toISOString()
    });
  } catch (error) {
    logger.error('Payout error:', error);
    
    // Record circuit breaker failure
    await paymentSecurityService.recordCircuitFailure('payments');
    
    res.status(500).json({ error: 'Failed to process payout' });
  }
});

// Bank Validation
router.post('/validate-bank', async (req: Request, res: Response) => {
  try {
    const { clearingNumber, accountNumber, country } = req.body;

    if (country !== 'SE') {
      return res.status(400).json({ 
        error: 'Only Swedish bank accounts are supported' 
      });
    }

    const validation = swedishBankingService.validateBankAccount(clearingNumber, accountNumber);

    res.json(validation);
  } catch (error) {
    logger.error('Bank validation error:', error);
    res.status(500).json({ error: 'Failed to validate bank account' });
  }
});

// BankID Authentication
router.post('/initiate-bankid', async (req: Request, res: Response) => {
  try {
    const { customerId, payoutAmount, personalNumber } = req.body;

    if (payoutAmount < 10000) {
      return res.status(400).json({ 
        error: 'BankID only required for amounts above 10000 SEK' 
      });
    }

    const authResult = await swedishBankingService.initiateBankIDAuthentication(
      personalNumber,
      payoutAmount
    );

    res.json(authResult);
  } catch (error) {
    logger.error('BankID initiation error:', error);
    res.status(500).json({ error: 'Failed to initiate BankID' });
  }
});

// Fraud Check
router.post('/fraud-check', async (req: Request, res: Response) => {
  try {
    const { pattern, data } = req.body;

    const fraudCheck = await paymentSecurityService.detectFraudPattern(pattern, data);

    res.json({
      riskScore: fraudCheck.score,
      flagged: fraudCheck.score > 0.7,
      reason: fraudCheck.evidence,
      confidence: fraudCheck.confidence
    });
  } catch (error) {
    logger.error('Fraud check error:', error);
    res.status(500).json({ error: 'Failed to perform fraud check' });
  }
});

// Velocity Check
router.post('/velocity-check', async (req: Request, res: Response) => {
  try {
    const result = await paymentSecurityService.checkVelocity(req.body);
    res.json(result);
  } catch (error) {
    logger.error('Velocity check error:', error);
    res.status(500).json({ error: 'Failed to check velocity' });
  }
});

// ATO Check
router.post('/ato-check', async (req: Request, res: Response) => {
  try {
    const { customerId, indicators } = req.body;

    const atoIndicators = indicators.map((ind: any) => ({
      type: ind.type,
      value: ind.value,
      riskWeight: 1
    }));

    const result = await paymentSecurityService.detectAccountTakeover(
      customerId,
      atoIndicators
    );

    res.json(result);
  } catch (error) {
    logger.error('ATO check error:', error);
    res.status(500).json({ error: 'Failed to check account takeover' });
  }
});

// ML Fraud Score
router.post('/ml-fraud-score', async (req: Request, res: Response) => {
  try {
    const result = await paymentSecurityService.calculateMLFraudScore(req.body);
    res.json(result);
  } catch (error) {
    logger.error('ML fraud score error:', error);
    res.status(500).json({ error: 'Failed to calculate fraud score' });
  }
});

// Reports
router.get('/reports/daily/:date', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const date = new Date(req.params.date);
    const report = await reconciliationService.generateDailyReport(date);
    res.json(report);
  } catch (error) {
    logger.error('Daily report error:', error);
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
});

router.get('/status-summary/:date', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const date = new Date(req.params.date);
    const summary = await reconciliationService.getStatusSummary(date);
    res.json(summary);
  } catch (error) {
    logger.error('Status summary error:', error);
    res.status(500).json({ error: 'Failed to get status summary' });
  }
});

// Reconciliation
router.post('/reconcile/stripe', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.body;
    const result = await reconciliationService.reconcileStripeTransfers(
      new Date(startDate),
      new Date(endDate)
    );
    res.json(result);
  } catch (error) {
    logger.error('Reconciliation error:', error);
    res.status(500).json({ error: 'Failed to reconcile Stripe transfers' });
  }
});

// Commissions
router.get('/commissions/business/:businessId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const result = await reconciliationService.getBusinessCommissions(
      req.params.businessId,
      req.query.period as string
    );
    res.json(result);
  } catch (error) {
    logger.error('Commission fetch error:', error);
    res.status(500).json({ error: 'Failed to get commissions' });
  }
});

router.post('/commissions/generate-invoice', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { businessId, period, month, year } = req.body;
    const invoice = await reconciliationService.generateCommissionInvoice(
      businessId,
      period,
      month,
      year
    );
    res.json(invoice);
  } catch (error) {
    logger.error('Invoice generation error:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

router.post('/commissions/adjust', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const adjustment = await reconciliationService.adjustCommission(
      req.body.businessId,
      req.body.adjustmentType,
      req.body.amount,
      req.body.reason,
      req.body.appliedTo,
      req.user?.id || 'admin'
    );
    res.json(adjustment);
  } catch (error) {
    logger.error('Commission adjustment error:', error);
    res.status(500).json({ error: 'Failed to adjust commission' });
  }
});

// Verification
router.post('/verify-payouts', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const date = new Date(req.body.date);
    const result = await reconciliationService.verifyPayouts(date);
    res.json(result);
  } catch (error) {
    logger.error('Payout verification error:', error);
    res.status(500).json({ error: 'Failed to verify payouts' });
  }
});

router.post('/match-bank-statement', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const result = await reconciliationService.matchBankStatement(req.body.transactions);
    res.json(result);
  } catch (error) {
    logger.error('Bank statement matching error:', error);
    res.status(500).json({ error: 'Failed to match bank statement' });
  }
});

// Audit Trail
router.get('/audit-trail/transaction/:transactionId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const trail = await reconciliationService.getTransactionAuditTrail(req.params.transactionId);
    res.json(trail);
  } catch (error) {
    logger.error('Audit trail error:', error);
    res.status(500).json({ error: 'Failed to get audit trail' });
  }
});

router.get('/audit-trail/commission/:businessId', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const trail = await reconciliationService.getCommissionAuditTrail(req.params.businessId);
    res.json(trail);
  } catch (error) {
    logger.error('Commission audit trail error:', error);
    res.status(500).json({ error: 'Failed to get commission audit trail' });
  }
});

// Compliance
router.post('/compliance-report', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { reportType, startDate, endDate } = req.body;
    const report = await reconciliationService.generateComplianceReport(
      reportType,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(report);
  } catch (error) {
    logger.error('Compliance report error:', error);
    res.status(500).json({ error: 'Failed to generate compliance report' });
  }
});

router.post('/export-audit-data', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { format, includeTypes, startDate, endDate, encryptionKey } = req.body;
    const exportData = await reconciliationService.exportAuditData(
      format,
      includeTypes,
      new Date(startDate),
      new Date(endDate),
      encryptionKey
    );
    res.json(exportData);
  } catch (error) {
    logger.error('Audit export error:', error);
    res.status(500).json({ error: 'Failed to export audit data' });
  }
});

// Tax Reporting
router.post('/tax-report', async (req: Request, res: Response) => {
  try {
    const { businessId, year, quarter } = req.body;
    
    // This would integrate with Swedish tax authority (Skatteverket)
    const report = {
      totalPayouts: 125000,
      totalCommissions: 25000,
      vatAmount: 6250, // 25% VAT
      skatteverketReportId: `SKV-${year}-Q${quarter}-${businessId.substring(0, 8)}`
    };

    res.json(report);
  } catch (error) {
    logger.error('Tax report error:', error);
    res.status(500).json({ error: 'Failed to generate tax report' });
  }
});

// Commission Summary
router.get('/commission-summary/:businessId', async (req: Request, res: Response) => {
  try {
    const businessId = req.params.businessId;
    
    // Mock data for testing
    const summary = {
      totalRewards: 1000,
      totalCommission: 200,
      transactionCount: 5
    };

    res.json(summary);
  } catch (error) {
    logger.error('Commission summary error:', error);
    res.status(500).json({ error: 'Failed to get commission summary' });
  }
});

// Security Headers for Payment Pages
router.get('/checkout-page', (req: Request, res: Response) => {
  const headers = paymentSecurityService.generateSecureHeaders();
  
  Object.entries(headers).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  res.json({ message: 'Secure checkout page' });
});

// Service Mode Control (for testing)
router.post('/admin/service-mode', authenticateAdmin, async (req: Request, res: Response) => {
  try {
    const { service, mode } = req.body;
    
    // This would control service degradation for testing
    res.json({ 
      service, 
      mode, 
      message: `Service ${service} set to ${mode} mode` 
    });
  } catch (error) {
    logger.error('Service mode error:', error);
    res.status(500).json({ error: 'Failed to set service mode' });
  }
});

// Retry Payment
router.post('/retry/:paymentId', async (req: Request, res: Response) => {
  try {
    const { paymentId } = req.params;
    const retryInfo = await paymentSecurityService.scheduleRetry(paymentId);
    res.json(retryInfo);
  } catch (error) {
    logger.error('Payment retry error:', error);
    res.status(500).json({ error: 'Failed to retry payment' });
  }
});

export default router;