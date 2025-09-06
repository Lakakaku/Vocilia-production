import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import crypto from 'crypto';

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });

interface DailyReport {
  date: string;
  summary: {
    totalTransactions: number;
    totalRewards: number;
    totalCommissions: number;
    totalPayouts: number;
    successRate: number;
    averageRewardAmount: number;
    averageQualityScore: number;
  };
  byBusinessType: Array<{
    type: string;
    count: number;
    totalAmount: number;
  }>;
  byPaymentMethod: Array<{
    method: string;
    count: number;
    totalAmount: number;
  }>;
  byHour: Array<{
    hour: number;
    count: number;
    totalAmount: number;
  }>;
  failures: Array<{
    id: string;
    amount: number;
    reason: string;
    timestamp: string;
  }>;
  disputes: Array<{
    id: string;
    amount: number;
    status: string;
    reason: string;
  }>;
}

interface ReconciliationResult {
  stripeTransfers: number;
  internalRecords: number;
  matched: number;
  discrepancies: Array<{
    type: string;
    stripeId: string;
    internalId: string;
    amount: number;
    reason: string;
  }>;
  reconciliationStatus: 'balanced' | 'discrepancy';
}

interface AuditEntry {
  id: string;
  timestamp: Date;
  eventType: string;
  actor: string;
  entityId: string;
  entityType: string;
  details: any;
  ipAddress?: string;
  userAgent?: string;
}

export class FinancialReconciliationService {
  // Daily Transaction Reports
  async generateDailyReport(date: Date): Promise<DailyReport> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    // Fetch all transactions for the day
    const transactions = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      include: {
        feedback: {
          include: {
            business: true,
            session: true
          }
        }
      }
    });

    // Calculate summary metrics
    const summary = {
      totalTransactions: transactions.length,
      totalRewards: transactions
        .filter(t => t.type === 'REWARD')
        .reduce((sum, t) => sum + t.amount, 0),
      totalCommissions: transactions
        .filter(t => t.type === 'COMMISSION')
        .reduce((sum, t) => sum + t.amount, 0),
      totalPayouts: transactions
        .filter(t => t.status === 'COMPLETED')
        .reduce((sum, t) => sum + t.amount, 0),
      successRate: transactions.length > 0 
        ? (transactions.filter(t => t.status === 'COMPLETED').length / transactions.length) * 100
        : 0,
      averageRewardAmount: transactions.length > 0
        ? transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length
        : 0,
      averageQualityScore: transactions.length > 0
        ? transactions.reduce((sum, t) => sum + (t.feedback?.qualityScore || 0), 0) / transactions.length
        : 0
    };

    // Group by business type
    const byBusinessType = this.groupByBusinessType(transactions);

    // Group by payment method
    const byPaymentMethod = this.groupByPaymentMethod(transactions);

    // Group by hour
    const byHour = this.groupByHour(transactions);

    // Get failures
    const failures = transactions
      .filter(t => t.status === 'FAILED')
      .map(t => ({
        id: t.id,
        amount: t.amount,
        reason: t.failureReason || 'Unknown',
        timestamp: t.createdAt.toISOString()
      }));

    // Get disputes
    const disputes = await this.getDisputes(dayStart, dayEnd);

    return {
      date: format(date, 'yyyy-MM-dd'),
      summary,
      byBusinessType,
      byPaymentMethod,
      byHour,
      failures,
      disputes
    };
  }

  private groupByBusinessType(transactions: any[]): any[] {
    const groups = new Map<string, { count: number; totalAmount: number }>();

    for (const transaction of transactions) {
      const type = transaction.feedback?.business?.type || 'unknown';
      const existing = groups.get(type) || { count: 0, totalAmount: 0 };
      existing.count++;
      existing.totalAmount += transaction.amount;
      groups.set(type, existing);
    }

    return Array.from(groups.entries()).map(([type, data]) => ({
      type,
      ...data
    }));
  }

  private groupByPaymentMethod(transactions: any[]): any[] {
    const groups = new Map<string, { count: number; totalAmount: number }>();

    for (const transaction of transactions) {
      const method = transaction.paymentMethod || 'bank_transfer';
      const existing = groups.get(method) || { count: 0, totalAmount: 0 };
      existing.count++;
      existing.totalAmount += transaction.amount;
      groups.set(method, existing);
    }

    return Array.from(groups.entries()).map(([method, data]) => ({
      method,
      ...data
    }));
  }

  private groupByHour(transactions: any[]): any[] {
    const hourly = Array(24).fill(null).map((_, hour) => ({
      hour,
      count: 0,
      totalAmount: 0
    }));

    for (const transaction of transactions) {
      const hour = transaction.createdAt.getHours();
      hourly[hour].count++;
      hourly[hour].totalAmount += transaction.amount;
    }

    return hourly;
  }

  private async getDisputes(startDate: Date, endDate: Date): Promise<any[]> {
    // In production, fetch from Stripe
    const disputes = await stripe.disputes.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      }
    });

    return disputes.data.map(dispute => ({
      id: dispute.id,
      amount: dispute.amount / 100, // Convert from cents
      status: dispute.status,
      reason: dispute.reason
    }));
  }

  // Status Summary
  async getStatusSummary(date: Date): Promise<any> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const statuses = await prisma.payment.groupBy({
      by: ['status'],
      where: {
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      },
      _count: true
    });

    const result: any = {
      total: 0
    };

    for (const status of statuses) {
      result[status.status.toLowerCase()] = status._count;
      result.total += status._count;
    }

    // Ensure all statuses are present
    const allStatuses = ['pending', 'processing', 'completed', 'failed', 'refunded'];
    for (const status of allStatuses) {
      if (!(status in result)) {
        result[status] = 0;
      }
    }

    return result;
  }

  // Stripe Reconciliation
  async reconcileStripeTransfers(startDate: Date, endDate: Date): Promise<ReconciliationResult> {
    // Fetch Stripe transfers
    const stripeTransfers = await stripe.transfers.list({
      created: {
        gte: Math.floor(startDate.getTime() / 1000),
        lte: Math.floor(endDate.getTime() / 1000)
      },
      limit: 100
    });

    // Fetch internal records
    const internalPayments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        },
        stripeTransferId: {
          not: null
        }
      }
    });

    // Create maps for comparison
    const stripeMap = new Map(
      stripeTransfers.data.map(t => [t.id, { amount: t.amount / 100, metadata: t.metadata }])
    );
    const internalMap = new Map(
      internalPayments.map(p => [p.stripeTransferId!, { amount: p.amount, id: p.id }])
    );

    // Find discrepancies
    const discrepancies: any[] = [];
    let matched = 0;

    // Check each Stripe transfer
    for (const [stripeId, stripeData] of stripeMap.entries()) {
      const internal = internalMap.get(stripeId);
      
      if (!internal) {
        discrepancies.push({
          type: 'missing_internal',
          stripeId,
          internalId: '',
          amount: stripeData.amount,
          reason: 'Transfer found in Stripe but not in internal records'
        });
      } else if (Math.abs(stripeData.amount - internal.amount) > 0.01) {
        discrepancies.push({
          type: 'amount_mismatch',
          stripeId,
          internalId: internal.id,
          amount: stripeData.amount - internal.amount,
          reason: `Amount mismatch: Stripe ${stripeData.amount} vs Internal ${internal.amount}`
        });
      } else {
        matched++;
      }
    }

    // Check for internal records without Stripe transfers
    for (const payment of internalPayments) {
      if (!stripeMap.has(payment.stripeTransferId!)) {
        discrepancies.push({
          type: 'missing_stripe',
          stripeId: payment.stripeTransferId!,
          internalId: payment.id,
          amount: payment.amount,
          reason: 'Payment found in internal records but not in Stripe'
        });
      }
    }

    return {
      stripeTransfers: stripeTransfers.data.length,
      internalRecords: internalPayments.length,
      matched,
      discrepancies,
      reconciliationStatus: discrepancies.length === 0 ? 'balanced' : 'discrepancy'
    };
  }

  // Commission Tracking
  async getBusinessCommissions(businessId: string, period?: string): Promise<any> {
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    if (period === 'monthly') {
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    } else {
      // Default to current month
      startDate = startOfMonth(now);
      endDate = endOfMonth(now);
    }

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        type: 'COMMISSION',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    const totalCommission = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalRewards = totalCommission / (business?.commissionRate || 0.20);

    const invoice = await prisma.invoice.findFirst({
      where: {
        businessId,
        period: format(startDate, 'yyyy-MM')
      }
    });

    return {
      businessId,
      period: format(startDate, 'yyyy-MM'),
      totalCommission,
      totalRewards,
      commissionRate: business?.commissionRate || 0.20,
      transactions: payments.map(p => ({
        id: p.id,
        amount: p.amount,
        date: p.createdAt.toISOString()
      })),
      invoiceGenerated: !!invoice,
      paymentStatus: invoice?.status || 'pending'
    };
  }

  async generateCommissionInvoice(
    businessId: string,
    period: string,
    month: number,
    year: number
  ): Promise<any> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const payments = await prisma.payment.findMany({
      where: {
        businessId,
        type: 'COMMISSION',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        locations: true
      }
    });

    if (!business) {
      throw new Error('Business not found');
    }

    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const vat = totalAmount * 0.25; // 25% Swedish VAT
    const totalWithVat = totalAmount + vat;

    const invoiceNumber = `INV-${year}${month.toString().padStart(2, '0')}-${businessId.substring(0, 8)}`;

    // Create invoice record
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        businessId,
        period: format(startDate, 'yyyy-MM'),
        totalAmount,
        vat,
        totalWithVat,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        status: 'PENDING',
        items: payments.map(p => ({
          description: `Commission for feedback ${p.feedbackId}`,
          amount: p.amount
        }))
      }
    });

    // Generate PDF
    const pdfUrl = await this.generateInvoicePDF(invoice, business);

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      businessId,
      period: invoice.period,
      totalAmount,
      vat,
      totalWithVat,
      dueDate: invoice.dueDate.toISOString(),
      downloadUrl: pdfUrl
    };
  }

  private async generateInvoicePDF(invoice: any, business: any): Promise<string> {
    const doc = new PDFDocument();
    const filename = `invoice_${invoice.invoiceNumber}.pdf`;
    const filepath = `/tmp/${filename}`;

    // Pipe to file
    doc.pipe(require('fs').createWriteStream(filepath));

    // Add content
    doc.fontSize(20).text('INVOICE', 50, 50);
    doc.fontSize(12);
    doc.text(`Invoice Number: ${invoice.invoiceNumber}`, 50, 100);
    doc.text(`Date: ${format(new Date(), 'yyyy-MM-dd')}`, 50, 120);
    doc.text(`Due Date: ${format(invoice.dueDate, 'yyyy-MM-dd')}`, 50, 140);

    // Business details
    doc.text('Bill To:', 50, 180);
    doc.text(business.name, 50, 200);
    doc.text(business.orgNumber, 50, 220);
    if (business.locations[0]) {
      doc.text(business.locations[0].address, 50, 240);
    }

    // Invoice details
    doc.text('Details:', 50, 300);
    doc.text(`Platform Commission for ${invoice.period}`, 50, 320);
    doc.text(`Subtotal: ${invoice.totalAmount} SEK`, 50, 340);
    doc.text(`VAT (25%): ${invoice.vat} SEK`, 50, 360);
    doc.text(`Total: ${invoice.totalWithVat} SEK`, 50, 380);

    // Payment instructions
    doc.text('Payment Instructions:', 50, 440);
    doc.text('Bank: Swedbank', 50, 460);
    doc.text('Clearing: 8327-9', 50, 480);
    doc.text('Account: 123 456 789-0', 50, 500);
    doc.text(`OCR: ${this.generateOCR(invoice.invoiceNumber)}`, 50, 520);

    doc.end();

    // In production, upload to S3 or similar
    return `/api/invoices/download/${filename}`;
  }

  private generateOCR(reference: string): string {
    // Simplified OCR generation
    const numbers = reference.replace(/\D/g, '');
    return numbers.padStart(20, '0');
  }

  async adjustCommission(
    businessId: string,
    adjustmentType: string,
    amount: number,
    reason: string,
    appliedTo: string,
    userId: string
  ): Promise<any> {
    const adjustment = await prisma.commissionAdjustment.create({
      data: {
        businessId,
        type: adjustmentType.toUpperCase(),
        amount,
        reason,
        appliedTo,
        createdBy: userId,
        status: 'PENDING'
      }
    });

    // Create audit entry
    await this.createAuditEntry({
      eventType: 'commission_adjustment',
      actor: userId,
      entityId: adjustment.id,
      entityType: 'commission_adjustment',
      details: {
        businessId,
        adjustmentType,
        amount,
        reason,
        appliedTo
      }
    });

    return {
      adjustmentId: adjustment.id,
      businessId,
      type: adjustmentType,
      amount,
      reason,
      appliedTo,
      createdBy: userId,
      createdAt: adjustment.createdAt.toISOString()
    };
  }

  // Payout Verification
  async verifyPayouts(date: Date): Promise<any> {
    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const payouts = await prisma.payment.findMany({
      where: {
        type: 'REWARD',
        createdAt: {
          gte: dayStart,
          lte: dayEnd
        }
      }
    });

    const verified = payouts.filter(p => p.verificationStatus === 'VERIFIED').length;
    const pending = payouts.filter(p => p.status === 'PENDING').length;
    const failed = payouts.filter(p => p.status === 'FAILED').length;
    const verificationRate = payouts.length > 0 ? (verified / payouts.length) * 100 : 0;

    const unverified = payouts
      .filter(p => p.verificationStatus !== 'VERIFIED')
      .map(p => ({
        payoutId: p.id,
        amount: p.amount,
        status: p.status,
        lastAttempt: p.lastAttemptAt?.toISOString() || null,
        nextRetry: p.nextRetryAt?.toISOString() || null
      }));

    return {
      totalPayouts: payouts.length,
      verified,
      pending,
      failed,
      verificationRate,
      unverified
    };
  }

  async matchBankStatement(transactions: any[]): Promise<any> {
    const matched = [];
    const unmatched = [];

    for (const transaction of transactions) {
      const payment = await prisma.payment.findFirst({
        where: {
          reference: transaction.reference,
          amount: transaction.amount
        }
      });

      if (payment) {
        matched.push({
          bankReference: transaction.reference,
          internalId: payment.id,
          amount: transaction.amount,
          date: transaction.date
        });

        // Update verification status
        await prisma.payment.update({
          where: { id: payment.id },
          data: { 
            verificationStatus: 'VERIFIED',
            verifiedAt: new Date()
          }
        });
      } else {
        unmatched.push(transaction);
      }
    }

    return {
      totalTransactions: transactions.length,
      matched: matched.length,
      unmatched,
      matchRate: (matched.length / transactions.length) * 100
    };
  }

  // Audit Trail
  async createAuditEntry(data: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    await prisma.auditLog.create({
      data: {
        ...data,
        timestamp: new Date(),
        details: JSON.stringify(data.details)
      }
    });
  }

  async getTransactionAuditTrail(transactionId: string): Promise<any> {
    const events = await prisma.auditLog.findMany({
      where: {
        entityId: transactionId,
        entityType: 'payment'
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return {
      transactionId,
      events: events.map(e => ({
        timestamp: e.timestamp.toISOString(),
        eventType: e.eventType,
        actor: e.actor,
        details: JSON.parse(e.details as string),
        ipAddress: e.ipAddress
      }))
    };
  }

  async getCommissionAuditTrail(businessId: string): Promise<any> {
    const events = await prisma.auditLog.findMany({
      where: {
        OR: [
          {
            entityId: businessId,
            entityType: 'business',
            eventType: 'commission_rate_change'
          },
          {
            details: {
              contains: businessId
            },
            eventType: 'commission_adjustment'
          }
        ]
      },
      orderBy: {
        timestamp: 'asc'
      }
    });

    return {
      changes: events.map(e => {
        const details = JSON.parse(e.details as string);
        return {
          timestamp: e.timestamp.toISOString(),
          previousRate: details.previousRate,
          newRate: details.newRate,
          reason: details.reason,
          approvedBy: e.actor
        };
      })
    };
  }

  // Compliance Reporting
  async generateComplianceReport(
    reportType: string,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const payments = await prisma.payment.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        feedback: true
      }
    });

    const totalVolume = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalTransactions = payments.length;
    const averageTransactionValue = totalTransactions > 0 ? totalVolume / totalTransactions : 0;

    // Calculate fraud metrics
    const fraudChecks = await prisma.fraudCheck.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const suspiciousActivities = fraudChecks.filter(f => f.riskScore > 0.7).length;
    const reportedCases = fraudChecks.filter(f => f.reported).length;
    const fraudRate = totalTransactions > 0 
      ? (suspiciousActivities / totalTransactions) * 100 
      : 0;

    // Calculate dispute rate
    const disputes = await prisma.dispute.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const disputeRate = totalTransactions > 0 
      ? (disputes.length / totalTransactions) * 100 
      : 0;

    // GDPR compliance metrics
    const accessRequests = await prisma.gdprRequest.count({
      where: {
        type: 'ACCESS',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const deletionRequests = await prisma.gdprRequest.count({
      where: {
        type: 'DELETION',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    const dataBreaches = await prisma.securityIncident.count({
      where: {
        type: 'DATA_BREACH',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      }
    });

    return {
      reportId: crypto.randomBytes(16).toString('hex'),
      reportType,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      summary: {
        totalVolume,
        totalTransactions,
        averageTransactionValue,
        fraudRate,
        disputeRate
      },
      amlCompliance: {
        suspiciousActivities,
        reportedCases,
        enhancedDueDiligence: fraudChecks.filter(f => f.requiresEDD).length
      },
      dataProtection: {
        gdprCompliant: true,
        dataBreaches,
        accessRequests,
        deletionRequests
      }
    };
  }

  async exportAuditData(
    format: string,
    includeTypes: string[],
    startDate: Date,
    endDate: Date,
    encryptionKey: string
  ): Promise<any> {
    const exportId = crypto.randomBytes(16).toString('hex');
    const files = [];

    for (const type of includeTypes) {
      let data: any[];
      
      switch (type) {
        case 'transactions':
          data = await prisma.payment.findMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          break;
        case 'commissions':
          data = await prisma.payment.findMany({
            where: {
              type: 'COMMISSION',
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          break;
        case 'disputes':
          data = await prisma.dispute.findMany({
            where: {
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          break;
        case 'refunds':
          data = await prisma.payment.findMany({
            where: {
              status: 'REFUNDED',
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          });
          break;
        default:
          data = [];
      }

      const filename = await this.createExportFile(type, data, format, encryptionKey);
      
      files.push({
        filename,
        size: require('fs').statSync(`/tmp/${filename}`).size,
        checksum: this.calculateChecksum(`/tmp/${filename}`),
        encrypted: true
      });
    }

    return {
      exportId,
      files,
      downloadUrl: `/api/audit/export/${exportId}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  private async createExportFile(
    type: string,
    data: any[],
    format: string,
    encryptionKey: string
  ): Promise<string> {
    const filename = `${type}_${Date.now()}.${format}`;
    const filepath = `/tmp/${filename}`;

    if (format === 'csv') {
      const csv = this.convertToCSV(data);
      const encrypted = this.encryptData(csv, encryptionKey);
      require('fs').writeFileSync(filepath, encrypted);
    } else if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(type);
      
      if (data.length > 0) {
        worksheet.columns = Object.keys(data[0]).map(key => ({
          header: key,
          key: key
        }));
        worksheet.addRows(data);
      }
      
      await workbook.xlsx.writeFile(filepath);
      
      // Encrypt the file
      const fileContent = require('fs').readFileSync(filepath);
      const encrypted = this.encryptData(fileContent.toString('base64'), encryptionKey);
      require('fs').writeFileSync(filepath, encrypted);
    }

    return filename;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(item => 
      headers.map(header => {
        const value = item[header];
        // Escape quotes and wrap in quotes if contains comma
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  private encryptData(data: string, publicKey: string): string {
    // In production, use proper RSA encryption with the auditor's public key
    // This is a simplified version
    const cipher = crypto.createCipher('aes256', publicKey);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private calculateChecksum(filepath: string): string {
    const fileBuffer = require('fs').readFileSync(filepath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  }
}

export const reconciliationService = new FinancialReconciliationService();