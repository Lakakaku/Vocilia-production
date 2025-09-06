/**
 * Monthly Batch Processor
 * Handles monthly batch processing for simple verification system:
 * 1. Creates monthly billing batches for businesses
 * 2. Sets review deadlines
 * 3. Processes customer payments via Swish
 * 4. Handles deadline enforcement
 */

import { db } from '@ai-feedback/database';
import { PaymentProcessor } from '@ai-feedback/swish-payout';
import { sendEmailNotification } from '../services/email-service';

interface MonthlyBatchSettings {
  reviewPeriodDays: number; // How many days businesses have to review
  reminderDays: number[]; // Days before deadline to send reminders (e.g., [7, 3, 1])
  autoPaymentDeadlineDays: number; // Days after deadline to automatically charge original amount
}

interface BusinessBatchSummary {
  businessId: string;
  businessName: string;
  businessEmail: string;
  totalVerifications: number;
  approvedVerifications: number;
  rejectedVerifications: number;
  pendingVerifications: number;
  totalCustomerPayments: number;
  totalCommission: number;
  totalStoreCost: number;
  reviewDeadline: Date;
  csvExportUrl?: string;
}

export class MonthlyBatchProcessor {
  private paymentProcessor: PaymentProcessor;
  private settings: MonthlyBatchSettings;

  constructor() {
    this.paymentProcessor = new PaymentProcessor(db);
    this.settings = {
      reviewPeriodDays: 14, // 2 weeks to review
      reminderDays: [7, 3, 1], // Remind 7, 3, and 1 days before deadline
      autoPaymentDeadlineDays: 3 // 3 days after deadline = automatic charge
    };
  }

  /**
   * Main monthly processing function - should be called via cron job on 1st of each month
   */
  async processMonthlyBatches(year: number, month: number): Promise<void> {
    const batchMonth = `${year}-${month.toString().padStart(2, '0')}`;
    console.log(`Starting monthly batch processing for ${batchMonth}`);

    try {
      // 1. Create monthly billing batches for all businesses with simple verifications
      const businessBatches = await this.createMonthlyBillingBatches(year, month);
      console.log(`Created ${businessBatches.length} business billing batches`);

      // 2. Send review notifications to businesses
      await this.sendReviewNotifications(businessBatches);

      // 3. Generate CSV exports for businesses
      await this.generateBusinessExports(businessBatches);

      console.log(`Monthly batch processing completed for ${batchMonth}`);

    } catch (error) {
      console.error(`Monthly batch processing failed for ${batchMonth}:`, error);
      throw error;
    }
  }

  /**
   * Create monthly billing batches for all businesses
   */
  private async createMonthlyBillingBatches(year: number, month: number): Promise<BusinessBatchSummary[]> {
    const startDate = new Date(year, month - 1, 1); // Start of month
    const endDate = new Date(year, month, 0, 23, 59, 59); // End of month
    
    // Get all businesses that had simple verifications this month
    const businessesWithVerifications = await db.simpleVerification.findMany({
      where: {
        submittedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        businessId: true,
        reviewStatus: true,
        paymentAmount: true,
        commissionAmount: true,
        storeCost: true,
        session: {
          include: {
            qrCode: {
              include: {
                business: {
                  select: {
                    id: true,
                    name: true,
                    contactEmail: true,
                    simpleVerificationSettings: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        businessId: 'asc'
      }
    });

    // Group by business
    const businessMap = new Map<string, BusinessBatchSummary>();
    
    for (const verification of businessesWithVerifications) {
      const businessId = verification.businessId;
      const business = verification.session.qrCode?.business;
      
      if (!business) continue;

      if (!businessMap.has(businessId)) {
        const reviewDeadline = new Date();
        reviewDeadline.setDate(reviewDeadline.getDate() + this.settings.reviewPeriodDays);
        
        businessMap.set(businessId, {
          businessId: business.id,
          businessName: business.name,
          businessEmail: business.contactEmail || '',
          totalVerifications: 0,
          approvedVerifications: 0,
          rejectedVerifications: 0,
          pendingVerifications: 0,
          totalCustomerPayments: 0,
          totalCommission: 0,
          totalStoreCost: 0,
          reviewDeadline
        });
      }

      const summary = businessMap.get(businessId)!;
      summary.totalVerifications++;
      
      switch (verification.reviewStatus) {
        case 'approved':
        case 'auto_approved':
          summary.approvedVerifications++;
          summary.totalCustomerPayments += verification.paymentAmount || 0;
          summary.totalCommission += verification.commissionAmount || 0;
          summary.totalStoreCost += verification.storeCost || 0;
          break;
        case 'rejected':
          summary.rejectedVerifications++;
          break;
        case 'pending':
          summary.pendingVerifications++;
          // For pending, we estimate based on purchase amounts since payment amounts aren't calculated yet
          summary.totalStoreCost += (verification.storeCost || 0);
          break;
      }
    }

    // Create billing batch records in database
    const billingMonth = startDate;
    const businessBatches: BusinessBatchSummary[] = [];

    for (const [businessId, summary] of businessMap.entries()) {
      // Check if batch already exists
      const existingBatch = await db.monthlyBillingBatch.findFirst({
        where: {
          businessId,
          billingMonth
        }
      });

      if (existingBatch) {
        console.log(`Billing batch already exists for business ${businessId}, skipping`);
        continue;
      }

      // Create new billing batch
      await db.monthlyBillingBatch.create({
        data: {
          businessId,
          billingMonth,
          totalVerifications: summary.totalVerifications,
          approvedVerifications: summary.approvedVerifications,
          rejectedVerifications: summary.rejectedVerifications,
          totalCustomerPayments: summary.totalCustomerPayments,
          totalCommission: summary.totalCommission,
          totalStoreCost: summary.totalStoreCost,
          status: 'review_period',
          reviewDeadline: summary.reviewDeadline,
          paymentDueDate: new Date(summary.reviewDeadline.getTime() + this.settings.autoPaymentDeadlineDays * 24 * 60 * 60 * 1000)
        }
      });

      businessBatches.push(summary);
    }

    return businessBatches;
  }

  /**
   * Send review notification emails to businesses
   */
  private async sendReviewNotifications(businessBatches: BusinessBatchSummary[]): Promise<void> {
    for (const batch of businessBatches) {
      if (!batch.businessEmail) {
        console.warn(`No email address for business ${batch.businessName}, skipping notification`);
        continue;
      }

      try {
        await sendEmailNotification({
          to: batch.businessEmail,
          subject: `Monthly Feedback Review - ${batch.businessName}`,
          template: 'monthly_review_notification',
          data: {
            businessName: batch.businessName,
            totalVerifications: batch.totalVerifications,
            pendingVerifications: batch.pendingVerifications,
            reviewDeadline: batch.reviewDeadline.toLocaleDateString('sv-SE'),
            totalEstimatedCost: batch.totalStoreCost,
            csvExportUrl: batch.csvExportUrl,
            dashboardUrl: `${process.env.NEXT_PUBLIC_BUSINESS_DASHBOARD_URL}/verification-review`
          }
        });

        console.log(`Review notification sent to ${batch.businessEmail}`);
      } catch (error) {
        console.error(`Failed to send review notification to ${batch.businessEmail}:`, error);
      }
    }
  }

  /**
   * Generate CSV exports for businesses to download
   */
  private async generateBusinessExports(businessBatches: BusinessBatchSummary[]): Promise<void> {
    for (const batch of businessBatches) {
      try {
        const csvData = await this.generateBusinessCSV(batch.businessId);
        const filename = `feedback-review-${batch.businessId}-${new Date().toISOString().substr(0, 7)}.csv`;
        
        // In a real implementation, you would upload this to cloud storage (S3, etc.)
        // For now, we'll just log that it would be generated
        console.log(`CSV export would be generated: ${filename} (${csvData.length} bytes)`);
        
        // Update the batch summary with the export URL
        batch.csvExportUrl = `${process.env.NEXT_PUBLIC_API_URL}/exports/${filename}`;
        
      } catch (error) {
        console.error(`Failed to generate CSV export for business ${batch.businessId}:`, error);
      }
    }
  }

  /**
   * Generate CSV data for business verification review
   */
  private async generateBusinessCSV(businessId: string): Promise<string> {
    const currentMonth = new Date();
    currentMonth.setDate(1); // Start of current month
    const nextMonth = new Date(currentMonth);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    const verifications = await db.simpleVerification.findMany({
      where: {
        businessId,
        submittedAt: {
          gte: currentMonth,
          lt: nextMonth
        }
      },
      include: {
        session: {
          include: {
            feedback: {
              select: {
                transcript: true,
                qualityScore: true,
                categories: true,
                sentiment: true
              }
            }
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    });

    // Generate CSV content
    const headers = [
      'Verification ID',
      'Submitted At',
      'Purchase Time',
      'Purchase Amount (SEK)',
      'Customer Phone',
      'Review Status',
      'Payment Amount',
      'Fraud Score',
      'Quality Score',
      'Feedback Categories',
      'Feedback Summary'
    ];

    const csvRows = [headers.join(',')];

    for (const verification of verifications) {
      const feedback = verification.session?.feedback;
      const row = [
        verification.id,
        verification.submittedAt.toISOString(),
        verification.purchaseTime.toISOString(),
        verification.purchaseAmount.toString(),
        `"${verification.customerPhone}"`, // Quoted to handle phone number formatting
        verification.reviewStatus,
        (verification.paymentAmount || 0).toString(),
        verification.fraudScore.toString(),
        feedback?.qualityScore?.toString() || '',
        `"${(feedback?.categories || []).join('; ')}"`,
        `"${feedback?.transcript?.substring(0, 100) || ''}..."`
      ];
      
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Check for overdue reviews and send reminders or automatic payments
   */
  async processOverdueReviews(): Promise<void> {
    const today = new Date();
    
    // Find batches approaching deadline (for reminders)
    for (const reminderDay of this.settings.reminderDays) {
      const reminderDate = new Date(today);
      reminderDate.setDate(reminderDate.getDate() + reminderDay);
      
      const batchesNeedingReminder = await db.monthlyBillingBatch.findMany({
        where: {
          status: 'review_period',
          reviewDeadline: {
            gte: new Date(reminderDate.getTime() - 12 * 60 * 60 * 1000), // 12 hours before
            lte: new Date(reminderDate.getTime() + 12 * 60 * 60 * 1000)   // 12 hours after
          }
        },
        include: {
          business: {
            select: {
              name: true,
              contactEmail: true
            }
          }
        }
      });

      for (const batch of batchesNeedingReminder) {
        await this.sendReviewReminder(batch, reminderDay);
      }
    }

    // Find batches past deadline (for automatic payment)
    const overduePaymentDate = new Date(today);
    overduePaymentDate.setDate(overduePaymentDate.getDate() - this.settings.autoPaymentDeadlineDays);

    const overdueBatches = await db.monthlyBillingBatch.findMany({
      where: {
        status: 'review_period',
        paymentDueDate: {
          lte: today
        }
      }
    });

    for (const batch of overdueBatches) {
      await this.processAutomaticPayment(batch);
    }
  }

  /**
   * Send reminder email to business about approaching deadline
   */
  private async sendReviewReminder(batch: any, daysUntilDeadline: number): Promise<void> {
    if (!batch.business.contactEmail) {
      console.warn(`No email address for business ${batch.business.name}, skipping reminder`);
      return;
    }

    try {
      await sendEmailNotification({
        to: batch.business.contactEmail,
        subject: `Reminder: Feedback Review Deadline in ${daysUntilDeadline} Days`,
        template: 'review_deadline_reminder',
        data: {
          businessName: batch.business.name,
          daysUntilDeadline,
          totalVerifications: batch.totalVerifications,
          pendingVerifications: batch.totalVerifications - batch.approvedVerifications - batch.rejectedVerifications,
          reviewDeadline: batch.reviewDeadline.toLocaleDateString('sv-SE'),
          totalCost: batch.totalStoreCost,
          dashboardUrl: `${process.env.NEXT_PUBLIC_BUSINESS_DASHBOARD_URL}/verification-review`
        }
      });

      console.log(`Review reminder sent to ${batch.business.contactEmail} (${daysUntilDeadline} days)`);
    } catch (error) {
      console.error(`Failed to send review reminder:`, error);
    }
  }

  /**
   * Process automatic payment for overdue review batch
   */
  private async processAutomaticPayment(batch: any): Promise<void> {
    console.log(`Processing automatic payment for overdue batch: ${batch.id}`);

    try {
      // Update batch status to indicate automatic processing
      await db.monthlyBillingBatch.update({
        where: { id: batch.id },
        data: {
          status: 'payment_processing',
          storePaymentReceived: true, // Mark as "paid" since we're charging original amount
          customerPaymentsSent: false
        }
      });

      // Mark all pending verifications as approved (since store missed deadline)
      await db.simpleVerification.updateMany({
        where: {
          businessId: batch.businessId,
          billingBatchId: batch.id,
          reviewStatus: 'pending'
        },
        data: {
          reviewStatus: 'auto_approved',
          reviewedBy: 'system',
          reviewedAt: new Date()
        }
      });

      // Process customer payments
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1; // getMonth() returns 0-based month
      
      await this.paymentProcessor.processMonthlyPayments(year, month);

      // Update batch status to completed
      await db.monthlyBillingBatch.update({
        where: { id: batch.id },
        data: {
          status: 'completed',
          completedAt: new Date()
        }
      });

      // Release feedback for this batch (delayed delivery implementation)
      const feedbackReleaseResult = await db.releaseFeedbackForBatch(batch.id);
      if (feedbackReleaseResult) {
        console.log(`✅ Feedback batch auto-released for business ${batch.businessId}: ${feedbackReleaseResult.releasedFeedbackCount} feedback sessions now available (automatic approval due to missed deadline)`);
        
        // Send notification about automatic approval and feedback release
        try {
          await sendEmailNotification({
            to: '', // Will be filled from business data
            subject: `Feedback Auto-Released - Verification Deadline Passed`,
            template: 'feedback_auto_released',
            data: {
              businessId: batch.businessId,
              batchId: batch.id,
              feedbackCount: feedbackReleaseResult.releasedFeedbackCount,
              releasedAt: feedbackReleaseResult.releasedAt,
              reason: 'automatic_approval_deadline_passed',
              dashboardUrl: `${process.env.NEXT_PUBLIC_BUSINESS_DASHBOARD_URL}/feedback/released`
            }
          });
        } catch (notificationError) {
          console.warn('Failed to send auto-release notification:', notificationError);
        }
      }

      console.log(`Automatic payment processing completed for batch: ${batch.id}`);

    } catch (error) {
      console.error(`Automatic payment processing failed for batch: ${batch.id}`, error);
      
      // Mark batch as failed
      await db.monthlyBillingBatch.update({
        where: { id: batch.id },
        data: {
          status: 'collecting' // Reset to allow manual intervention
        }
      });
    }
  }

  /**
   * Process approved verifications after business review is complete
   */
  async processApprovedVerifications(businessId: string, batchId: string): Promise<void> {
    console.log(`Processing approved verifications for business ${businessId}, batch ${batchId}`);

    try {
      // Update batch status
      await db.monthlyBillingBatch.update({
        where: { id: batchId },
        data: {
          status: 'payment_processing',
          storePaymentReceived: true
        }
      });

      // Process customer payments for approved verifications
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      await this.paymentProcessor.processMonthlyPayments(year, month);

      // Update batch status to completed
      await db.monthlyBillingBatch.update({
        where: { id: batchId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          customerPaymentsSent: true
        }
      });

      // Release feedback for this batch (delayed delivery implementation)
      const feedbackReleaseResult = await db.releaseFeedbackForBatch(batchId);
      if (feedbackReleaseResult) {
        console.log(`✅ Feedback batch released for business ${businessId}: ${feedbackReleaseResult.releasedFeedbackCount} feedback sessions now available`);
        
        // Send notification to business about feedback release
        try {
          await sendEmailNotification({
            to: '', // Will be filled from business data
            subject: `Feedback Released - Monthly Verification Batch Complete`,
            template: 'feedback_batch_released',
            data: {
              businessId,
              batchId,
              feedbackCount: feedbackReleaseResult.releasedFeedbackCount,
              releasedAt: feedbackReleaseResult.releasedAt,
              dashboardUrl: `${process.env.NEXT_PUBLIC_BUSINESS_DASHBOARD_URL}/feedback/released`
            }
          });
        } catch (notificationError) {
          console.warn('Failed to send feedback release notification:', notificationError);
          // Don't fail the entire process for notification errors
        }
      }

      console.log(`Approved verifications processed successfully for batch: ${batchId}`);

    } catch (error) {
      console.error(`Failed to process approved verifications for batch: ${batchId}`, error);
      throw error;
    }
  }
}

// Email service placeholder - would be implemented separately
async function sendEmailNotification(config: {
  to: string;
  subject: string;
  template: string;
  data: any;
}): Promise<void> {
  // This would integrate with your email service (SendGrid, AWS SES, etc.)
  console.log(`Email would be sent to ${config.to}: ${config.subject}`);
  console.log(`Template: ${config.template}`, config.data);
}