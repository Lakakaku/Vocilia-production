/**
 * Deadline Enforcement Job
 * 
 * Runs daily to check for overdue verification reviews and enforces deadlines by:
 * 1. Auto-approving unreviewed verifications after deadline
 * 2. Creating invoices for businesses with overdue reviews
 * 3. Sending notifications to businesses approaching deadlines
 */

import { db } from '@ai-feedback/database';
import { PaymentProcessor } from '@ai-feedback/swish-payout';

interface DeadlineEnforcementResult {
  processedBatches: number;
  autoApprovedVerifications: number;
  invoicesGenerated: number;
  notificationsSent: number;
  errors: string[];
}

export class DeadlineEnforcementJob {
  private paymentProcessor: PaymentProcessor;

  constructor() {
    this.paymentProcessor = new PaymentProcessor(db);
  }

  /**
   * Main job execution method
   */
  async execute(): Promise<DeadlineEnforcementResult> {
    console.log('🕒 Starting deadline enforcement job...');
    
    const result: DeadlineEnforcementResult = {
      processedBatches: 0,
      autoApprovedVerifications: 0,
      invoicesGenerated: 0,
      notificationsSent: 0,
      errors: []
    };

    try {
      // Find all batches that are overdue
      const overdueBatches = await this.findOverdueBatches();
      console.log(`Found ${overdueBatches.length} overdue batches`);

      for (const batch of overdueBatches) {
        try {
          const batchResult = await this.processBatchDeadline(batch);
          
          result.processedBatches++;
          result.autoApprovedVerifications += batchResult.autoApprovedCount;
          
          if (batchResult.invoiceGenerated) {
            result.invoicesGenerated++;
          }

        } catch (error) {
          const errorMsg = `Failed to process batch ${batch.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          result.errors.push(errorMsg);
          console.error(errorMsg);
        }
      }

      // Send warning notifications for batches approaching deadline
      const upcomingDeadlines = await this.findUpcomingDeadlines();
      console.log(`Found ${upcomingDeadlines.length} batches approaching deadline`);
      
      for (const batch of upcomingDeadlines) {
        try {
          await this.sendDeadlineWarning(batch);
          result.notificationsSent++;
        } catch (error) {
          result.errors.push(`Failed to send warning for batch ${batch.id}: ${error}`);
        }
      }

      console.log('✅ Deadline enforcement job completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Deadline enforcement job failed:', error);
      throw error;
    }
  }

  /**
   * Find batches that have exceeded their review deadline
   */
  private async findOverdueBatches() {
    const now = new Date();
    
    return await db.monthlyBillingBatch.findMany({
      where: {
        status: 'review_period',
        reviewDeadline: {
          lt: now
        }
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            contactEmail: true
          }
        }
      }
    });
  }

  /**
   * Find batches with deadlines approaching (within 3 days)
   */
  private async findUpcomingDeadlines() {
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));
    
    return await db.monthlyBillingBatch.findMany({
      where: {
        status: 'review_period',
        reviewDeadline: {
          gte: now,
          lte: threeDaysFromNow
        },
        // Only send warning if we haven't sent one recently
        updatedAt: {
          lt: new Date(now.getTime() - (24 * 60 * 60 * 1000)) // Last updated more than 24h ago
        }
      },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            contactEmail: true
          }
        }
      }
    });
  }

  /**
   * Process a single overdue batch
   */
  private async processBatchDeadline(batch: any): Promise<{
    autoApprovedCount: number;
    invoiceGenerated: boolean;
  }> {
    console.log(`Processing overdue batch: ${batch.id} for business ${batch.business.name}`);

    // Get all pending verifications for this batch
    const pendingVerifications = await db.simpleVerification.findMany({
      where: {
        billingBatchId: batch.id,
        reviewStatus: 'pending'
      }
    });

    console.log(`Found ${pendingVerifications.length} pending verifications to auto-approve`);

    // Auto-approve all pending verifications
    let autoApprovedCount = 0;
    if (pendingVerifications.length > 0) {
      const updateResult = await db.simpleVerification.updateMany({
        where: {
          billingBatchId: batch.id,
          reviewStatus: 'pending'
        },
        data: {
          reviewStatus: 'approved',
          reviewedAt: new Date(),
          reviewedBy: 'system_deadline_enforcement',
          rejectionReason: null
        }
      });

      autoApprovedCount = updateResult.count;
      console.log(`Auto-approved ${autoApprovedCount} verifications`);
    }

    // Recalculate batch totals including auto-approved verifications
    const batchStats = await this.calculateBatchTotals(batch.id);

    // Update batch status to payment_processing and generate invoice
    await db.monthlyBillingBatch.update({
      where: { id: batch.id },
      data: {
        status: 'payment_processing',
        approvedVerifications: batchStats.approvedCount,
        totalCustomerPayments: batchStats.totalPayments,
        totalCommission: batchStats.totalCommission,
        totalStoreCost: batchStats.totalStoreCost,
        storeInvoiceGenerated: true,
        updatedAt: new Date()
      }
    });

    // Generate invoice for the business
    await this.generateStoreInvoice(batch.id, batchStats);

    console.log(`Generated invoice for batch ${batch.id}: ${batchStats.totalStoreCost} SEK`);

    return {
      autoApprovedCount,
      invoiceGenerated: true
    };
  }

  /**
   * Calculate totals for a billing batch
   */
  private async calculateBatchTotals(batchId: string) {
    const verificationStats = await db.simpleVerification.aggregate({
      where: {
        billingBatchId: batchId,
        reviewStatus: { in: ['approved', 'auto_approved'] }
      },
      _sum: {
        paymentAmount: true,
        commissionAmount: true,
        storeCost: true
      },
      _count: {
        id: true
      }
    });

    return {
      approvedCount: verificationStats._count.id || 0,
      totalPayments: verificationStats._sum.paymentAmount || 0,
      totalCommission: verificationStats._sum.commissionAmount || 0,
      totalStoreCost: verificationStats._sum.storeCost || 0
    };
  }

  /**
   * Generate invoice for store payment
   * In a real implementation, this would integrate with an invoicing system
   */
  private async generateStoreInvoice(batchId: string, stats: any) {
    // This is a placeholder for invoice generation
    // In production, you would integrate with accounting software like Fortnox, Visma, or similar
    
    const batch = await db.monthlyBillingBatch.findUnique({
      where: { id: batchId },
      include: {
        business: true
      }
    });

    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }

    // Store invoice data in the database for now
    const invoiceData = {
      batchId,
      businessId: batch.businessId,
      businessName: batch.business?.name,
      billingMonth: batch.billingMonth,
      dueDate: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)), // 30 days from now
      lineItems: [
        {
          description: `Customer cashback payments for ${batch.billingMonth}`,
          quantity: stats.approvedCount,
          unitPrice: stats.totalPayments / stats.approvedCount,
          amount: stats.totalPayments
        },
        {
          description: `Platform commission (20%)`,
          quantity: 1,
          unitPrice: stats.totalCommission,
          amount: stats.totalCommission
        }
      ],
      totalAmount: stats.totalStoreCost,
      currency: 'SEK',
      status: 'pending',
      createdAt: new Date()
    };

    // For now, just log the invoice data
    console.log('Invoice generated:', JSON.stringify(invoiceData, null, 2));

    // In production, you would:
    // 1. Send invoice to accounting system
    // 2. Send invoice email to business
    // 3. Set up payment tracking
    // 4. Update batch with invoice reference
    
    return invoiceData;
  }

  /**
   * Send deadline warning notification
   */
  private async sendDeadlineWarning(batch: any) {
    console.log(`Sending deadline warning for batch ${batch.id} to ${batch.business.name}`);
    
    const daysUntilDeadline = Math.ceil(
      (batch.reviewDeadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
    );

    // In production, this would send an email
    const warningMessage = {
      to: batch.business.contactEmail,
      subject: `Urgent: Verification Review Deadline Approaching - ${daysUntilDeadline} Days Remaining`,
      body: `
Dear ${batch.business.name},

This is a reminder that you have ${daysUntilDeadline} days remaining to review your customer verification data for ${batch.billingMonth}.

Deadline: ${batch.reviewDeadline.toLocaleDateString()}

If reviews are not completed by the deadline, all pending verifications will be automatically approved and you will be billed for the full amount including any potentially fraudulent entries.

Please log in to your dashboard to complete the review process.

Best regards,
AI Feedback Platform Team
      `
    };

    // Update batch to mark that warning was sent
    await db.monthlyBillingBatch.update({
      where: { id: batch.id },
      data: {
        updatedAt: new Date() // This prevents sending multiple warnings in the same day
      }
    });

    console.log('Warning notification prepared:', warningMessage);
    
    // In production, integrate with email service like SendGrid, SES, etc.
    return warningMessage;
  }

  /**
   * Create a new monthly billing batch for a business
   */
  async createMonthlyBatch(businessId: string, year: number, month: number): Promise<string> {
    const billingMonth = new Date(year, month - 1, 1);
    const reviewDeadline = new Date(year, month, 15, 23, 59, 59); // 15th of next month
    const paymentDueDate = new Date(year, month, 30, 23, 59, 59); // 30th of next month

    // Check if batch already exists
    const existingBatch = await db.monthlyBillingBatch.findFirst({
      where: {
        businessId,
        billingMonth
      }
    });

    if (existingBatch) {
      throw new Error(`Billing batch already exists for ${businessId} in ${year}-${month}`);
    }

    // Get all verifications for the month
    const monthStart = billingMonth;
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const verifications = await db.simpleVerification.findMany({
      where: {
        businessId,
        submittedAt: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    });

    // Create billing batch
    const batch = await db.monthlyBillingBatch.create({
      data: {
        businessId,
        billingMonth,
        totalVerifications: verifications.length,
        reviewDeadline,
        paymentDueDate,
        status: 'review_period'
      }
    });

    // Link verifications to this batch
    if (verifications.length > 0) {
      await db.simpleVerification.updateMany({
        where: {
          id: { in: verifications.map(v => v.id) }
        },
        data: {
          billingBatchId: batch.id
        }
      });
    }

    console.log(`Created monthly batch ${batch.id} for business ${businessId} with ${verifications.length} verifications`);
    
    return batch.id;
  }
}

export const deadlineEnforcementJob = new DeadlineEnforcementJob();