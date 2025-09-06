/**
 * Payment Processor Service
 * Handles the business logic for processing customer payments via Swish
 * Integrates with database and handles batch processing, aggregation, and reconciliation
 */

import { SwishPayoutClient, createSwishClient } from './SwishPayoutClient';
import type { SimpleVerification } from '@ai-feedback/shared-types';

interface PaymentAggregation {
  phoneNumber: string;
  totalAmount: number;
  verificationIds: string[];
  verificationCount: number;
  businessBreakdown: Array<{
    businessId: string;
    businessName: string;
    amount: number;
    count: number;
  }>;
}

interface PaymentBatch {
  batchId: string;
  batchMonth: string; // YYYY-MM format
  createdAt: Date;
  totalPayments: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processedAt?: Date;
  swishBatchId?: string;
  results?: any;
}

interface ProcessingResult {
  batchId: string;
  processedPayments: number;
  successfulPayments: number;
  failedPayments: number;
  totalAmount: number;
  errors: Array<{
    phoneNumber: string;
    amount: number;
    error: string;
  }>;
}

export class PaymentProcessor {
  private swishClient: SwishPayoutClient;
  private db: any; // Database connection - will be injected

  constructor(db: any, swishClient?: SwishPayoutClient) {
    this.db = db;
    this.swishClient = swishClient || createSwishClient();
  }

  /**
   * Process all approved verifications for a given month
   * Aggregates payments per phone number and processes via Swish
   */
  async processMonthlyPayments(year: number, month: number): Promise<ProcessingResult> {
    const batchId = `${year}-${month.toString().padStart(2, '0')}-${Date.now()}`;
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    console.log(`Processing monthly payments for ${year}-${month} (batch: ${batchId})`);

    try {
      // Get all approved verifications for the month that haven't been paid yet
      const verifications = await this.getApprovedVerifications(monthStart, monthEnd);
      
      if (verifications.length === 0) {
        console.log('No approved verifications found for payment processing');
        return {
          batchId,
          processedPayments: 0,
          successfulPayments: 0,
          failedPayments: 0,
          totalAmount: 0,
          errors: []
        };
      }

      console.log(`Found ${verifications.length} approved verifications for payment`);

      // Aggregate payments by phone number (one payment per customer per month)
      const aggregatedPayments = this.aggregatePaymentsByPhone(verifications);
      console.log(`Aggregated into ${aggregatedPayments.length} unique customers`);

      // Create batch record
      await this.createPaymentBatch({
        batchId,
        batchMonth: `${year}-${month.toString().padStart(2, '0')}`,
        createdAt: new Date(),
        totalPayments: aggregatedPayments.length,
        totalAmount: aggregatedPayments.reduce((sum, p) => sum + p.totalAmount, 0),
        status: 'processing'
      });

      // Process payments via Swish
      const swishBatch = {
        batchReference: batchId,
        payments: aggregatedPayments.map(payment => ({
          reference: `AGG-${payment.phoneNumber.replace(/\D/g, '')}-${Date.now()}`,
          phoneNumber: payment.phoneNumber,
          amount: payment.totalAmount,
          message: `Feedback cashback ${year}-${month.toString().padStart(2, '0')} (${payment.verificationCount} feedback)`
        }))
      };

      const swishResult = await this.swishClient.processBatchPayouts(swishBatch);

      // Update database with results
      await this.updatePaymentResults(batchId, swishResult, aggregatedPayments);

      const result: ProcessingResult = {
        batchId,
        processedPayments: swishResult.totalPayments,
        successfulPayments: swishResult.successfulPayments,
        failedPayments: swishResult.failedPayments,
        totalAmount: swishResult.totalAmount,
        errors: swishResult.results
          .filter(r => r.status === 'failed')
          .map(r => ({
            phoneNumber: r.phoneNumber,
            amount: r.amount,
            error: r.errorMessage || 'Unknown error'
          }))
      };

      console.log(`Payment processing completed: ${result.successfulPayments}/${result.processedPayments} successful`);
      return result;

    } catch (error) {
      console.error('Payment processing failed:', error);
      
      // Mark batch as failed
      await this.updatePaymentBatch(batchId, {
        status: 'failed',
        processedAt: new Date(),
        results: { error: error instanceof Error ? error.message : 'Unknown error' }
      });

      throw error;
    }
  }

  /**
   * Get approved verifications that haven't been paid yet
   */
  private async getApprovedVerifications(startDate: Date, endDate: Date): Promise<any[]> {
    return await this.db.simpleVerification.findMany({
      where: {
        submittedAt: {
          gte: startDate,
          lte: endDate
        },
        reviewStatus: 'approved',
        paymentStatus: 'pending',
        paymentAmount: {
          gt: 0 // Only verifications with non-zero payment amounts
        }
      },
      include: {
        session: {
          include: {
            qrCode: {
              include: {
                business: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: {
        submittedAt: 'asc'
      }
    });
  }

  /**
   * Aggregate verifications by phone number (one payment per customer per month)
   */
  private aggregatePaymentsByPhone(verifications: any[]): PaymentAggregation[] {
    const aggregationMap = new Map<string, PaymentAggregation>();

    for (const verification of verifications) {
      const phoneNumber = verification.customerPhone;
      
      if (!aggregationMap.has(phoneNumber)) {
        aggregationMap.set(phoneNumber, {
          phoneNumber,
          totalAmount: 0,
          verificationIds: [],
          verificationCount: 0,
          businessBreakdown: []
        });
      }

      const aggregation = aggregationMap.get(phoneNumber)!;
      aggregation.totalAmount += verification.paymentAmount || 0;
      aggregation.verificationIds.push(verification.id);
      aggregation.verificationCount++;

      // Track business breakdown
      const businessId = verification.session.qrCode?.business?.id || verification.businessId;
      const businessName = verification.session.qrCode?.business?.name || 'Unknown Business';
      
      let businessEntry = aggregation.businessBreakdown.find(b => b.businessId === businessId);
      if (!businessEntry) {
        businessEntry = {
          businessId,
          businessName,
          amount: 0,
          count: 0
        };
        aggregation.businessBreakdown.push(businessEntry);
      }
      
      businessEntry.amount += verification.paymentAmount || 0;
      businessEntry.count++;
    }

    return Array.from(aggregationMap.values())
      .filter(agg => agg.totalAmount > 0) // Only include customers with positive amounts
      .sort((a, b) => b.totalAmount - a.totalAmount); // Sort by amount descending
  }

  /**
   * Create payment batch record in database
   */
  private async createPaymentBatch(batch: PaymentBatch): Promise<void> {
    await this.db.payment_batches.create({
      data: {
        batch_id: batch.batchId,
        batch_month: batch.batchMonth,
        total_payments: batch.totalPayments,
        total_amount: batch.totalAmount,
        status: batch.status,
        created_at: batch.createdAt,
        processed_at: batch.processedAt,
        swish_batch_id: batch.swishBatchId,
        results: batch.results
      }
    });
  }

  /**
   * Update payment batch with processing results
   */
  private async updatePaymentBatch(batchId: string, updates: Partial<PaymentBatch>): Promise<void> {
    // Convert camelCase to snake_case for database
    const dbUpdates: any = {};
    
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.processedAt !== undefined) dbUpdates.processed_at = updates.processedAt;
    if (updates.swishBatchId !== undefined) dbUpdates.swish_batch_id = updates.swishBatchId;
    if (updates.results !== undefined) dbUpdates.results = updates.results;
    
    await this.db.payment_batches.update({
      where: { batch_id: batchId },
      data: dbUpdates
    });
  }

  /**
   * Update database with Swish payment results
   */
  private async updatePaymentResults(batchId: string, swishResult: any, aggregatedPayments: PaymentAggregation[]): Promise<void> {
    // Update batch record
    await this.updatePaymentBatch(batchId, {
      status: swishResult.successfulPayments === swishResult.totalPayments ? 'completed' : 'failed',
      processedAt: new Date(),
      swishBatchId: swishResult.batchId,
      results: swishResult
    });

    // Update individual verifications
    for (const swishPayment of swishResult.results) {
      const aggregation = aggregatedPayments.find(a => a.phoneNumber === swishPayment.phoneNumber);
      
      if (aggregation) {
        const updateData = {
          paymentStatus: swishPayment.status === 'success' ? 'paid' : 'failed',
          paymentId: swishPayment.swishId,
          paidAt: swishPayment.status === 'success' ? new Date() : null
        };

        // Update all verifications for this phone number
        await this.db.simpleVerification.updateMany({
          where: {
            id: { in: aggregation.verificationIds }
          },
          data: updateData
        });
      }
    }
  }

  /**
   * Get payment batch status
   */
  async getPaymentBatch(batchId: string): Promise<PaymentBatch | null> {
    const dbBatch = await this.db.payment_batches.findUnique({
      where: { batch_id: batchId }
    });
    
    if (!dbBatch) return null;
    
    // Convert snake_case back to camelCase for TypeScript interface
    return {
      batchId: dbBatch.batch_id,
      batchMonth: dbBatch.batch_month,
      createdAt: dbBatch.created_at,
      totalPayments: dbBatch.total_payments,
      totalAmount: dbBatch.total_amount,
      status: dbBatch.status,
      processedAt: dbBatch.processed_at,
      swishBatchId: dbBatch.swish_batch_id,
      results: dbBatch.results
    };
  }

  /**
   * Get payment statistics for a given month
   */
  async getMonthlyPaymentStats(year: number, month: number): Promise<{
    totalVerifications: number;
    approvedVerifications: number;
    pendingPayments: number;
    paidVerifications: number;
    totalPendingAmount: number;
    totalPaidAmount: number;
    uniqueCustomers: number;
  }> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const stats = await this.db.simpleVerification.groupBy({
      by: ['reviewStatus', 'paymentStatus'],
      where: {
        submittedAt: {
          gte: monthStart,
          lte: monthEnd
        }
      },
      _count: {
        id: true
      },
      _sum: {
        paymentAmount: true
      }
    });

    const uniqueCustomers = await this.db.simpleVerification.findMany({
      where: {
        submittedAt: {
          gte: monthStart,
          lte: monthEnd
        },
        reviewStatus: 'approved'
      },
      select: {
        customerPhone: true
      },
      distinct: ['customerPhone']
    });

    // Calculate totals
    let totalVerifications = 0;
    let approvedVerifications = 0;
    let pendingPayments = 0;
    let paidVerifications = 0;
    let totalPendingAmount = 0;
    let totalPaidAmount = 0;

    for (const stat of stats) {
      totalVerifications += stat._count.id;
      
      if (stat.reviewStatus === 'approved') {
        approvedVerifications += stat._count.id;
        
        if (stat.paymentStatus === 'pending') {
          pendingPayments += stat._count.id;
          totalPendingAmount += stat._sum.paymentAmount || 0;
        } else if (stat.paymentStatus === 'paid') {
          paidVerifications += stat._count.id;
          totalPaidAmount += stat._sum.paymentAmount || 0;
        }
      }
    }

    return {
      totalVerifications,
      approvedVerifications,
      pendingPayments,
      paidVerifications,
      totalPendingAmount,
      totalPaidAmount,
      uniqueCustomers: uniqueCustomers.length
    };
  }

  /**
   * Test Swish connection
   */
  async testSwishConnection(): Promise<boolean> {
    return await this.swishClient.testConnection();
  }
}