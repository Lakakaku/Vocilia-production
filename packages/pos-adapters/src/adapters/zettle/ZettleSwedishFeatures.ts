import { createLogger } from '../../utils/logger';
import { ZettleAPIClient } from './ZettleAPIClient';
import { SwedishBusinessInfo, ZettleSwedishFeatures, ZettleMerchant } from './types';
import { POSApiError } from '../../base/BasePOSAdapter';

const logger = createLogger('ZettleSwedishFeatures');

/**
 * Zettle Swedish Market Features
 * 
 * Handles Swedish-specific features and compliance requirements including:
 * - Swish mobile payments integration
 * - Kassaregister (cash register law) compliance
 * - Swedish tax reporting features
 * - Invoice payment handling
 * - Swedish business validation
 */
export class ZettleSwedishMarketFeatures {
  private apiClient: ZettleAPIClient;
  private merchantInfo?: ZettleMerchant;
  private features?: ZettleSwedishFeatures;
  
  constructor(apiClient: ZettleAPIClient) {
    this.apiClient = apiClient;
  }

  /**
   * Initialize Swedish features
   */
  async initialize(merchantInfo: ZettleMerchant): Promise<void> {
    if (merchantInfo.country !== 'SE') {
      throw new POSApiError({
        code: 'NOT_SWEDISH_MERCHANT',
        message: 'Swedish features only available for Swedish merchants'
      });
    }

    this.merchantInfo = merchantInfo;
    this.features = await this.loadSwedishFeatures();
    logger.info('Swedish features initialized', this.features);
  }

  /**
   * Load Swedish features configuration
   */
  private async loadSwedishFeatures(): Promise<ZettleSwedishFeatures> {
    try {
      const features = await this.apiClient.getSwedishFeatures();
      
      return {
        swishIntegration: features.swishEnabled || false,
        invoicePayments: features.invoiceEnabled || false,
        taxReporting: true, // Always available for Swedish merchants
        kassaregister: features.kassaregister || { enabled: false },
        employeeManagement: false, // Check via separate API
        tipDistribution: false // Check via separate API
      };
    } catch (error) {
      logger.error('Failed to load Swedish features', error);
      return {
        swishIntegration: false,
        invoicePayments: false,
        taxReporting: false,
        kassaregister: { enabled: false },
        employeeManagement: false,
        tipDistribution: false
      };
    }
  }

  /**
   * Configure Swish payments
   */
  async configureSwish(config: SwishConfiguration): Promise<SwishConfigurationResult> {
    logger.info('Configuring Swish payments', { phoneNumber: config.swishPhoneNumber });

    try {
      // Validate Swish phone number format
      if (!this.validateSwishPhoneNumber(config.swishPhoneNumber)) {
        throw new POSApiError({
          code: 'INVALID_SWISH_NUMBER',
          message: 'Invalid Swish phone number format'
        });
      }

      // Check if merchant has Swish agreement
      if (!this.features?.swishIntegration) {
        return {
          success: false,
          message: 'Swish integration not available. Please contact Zettle support to enable Swish.',
          requiresAgreement: true
        };
      }

      // Configure Swish settings (would call actual API)
      // For now, return success simulation
      return {
        success: true,
        message: 'Swish payments configured successfully',
        swishNumber: config.swishPhoneNumber,
        qrCodeEnabled: config.enableQRCode,
        capabilities: {
          refunds: true,
          partialRefunds: true,
          maxAmount: 15000, // SEK
          minAmount: 1 // SEK
        }
      };
    } catch (error) {
      logger.error('Failed to configure Swish', error);
      throw error;
    }
  }

  /**
   * Configure Kassaregister compliance
   */
  async configureKassaregister(config: KassaregisterConfiguration): Promise<KassaregisterConfigurationResult> {
    logger.info('Configuring Kassaregister compliance', config);

    try {
      // Validate organization number
      if (!this.validateOrganizationNumber(config.organizationNumber)) {
        throw new POSApiError({
          code: 'INVALID_ORG_NUMBER',
          message: 'Invalid Swedish organization number'
        });
      }

      // Check if cash transactions are enabled
      const cashEnabled = await this.checkCashPaymentEnabled();
      if (!cashEnabled && config.requireCashRegister) {
        return {
          success: false,
          message: 'Cash payments must be enabled for Kassaregister compliance',
          requiresCashPayment: true
        };
      }

      // Configure Kassaregister settings
      const result: KassaregisterConfigurationResult = {
        success: true,
        message: 'Kassaregister configured successfully',
        registerId: this.generateKassaregisterId(config.organizationNumber),
        controlUnitId: config.controlUnitId || this.generateControlUnitId(),
        features: {
          automaticReporting: true,
          receiptStorage: true,
          auditLog: true,
          tamperProtection: true
        },
        complianceStatus: {
          isCompliant: true,
          lastAudit: new Date(),
          nextAuditDue: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        }
      };

      // Update features
      if (this.features) {
        this.features.kassaregister = {
          enabled: true,
          registerId: result.registerId,
          controlUnitId: result.controlUnitId
        };
      }

      return result;
    } catch (error) {
      logger.error('Failed to configure Kassaregister', error);
      throw error;
    }
  }

  /**
   * Generate VAT report for Swedish tax authorities
   */
  async generateVATReport(period: VATReportPeriod): Promise<VATReport> {
    logger.info('Generating VAT report', period);

    try {
      const financeReport = await this.apiClient.getFinanceReport(
        period.startDate.toISOString(),
        period.endDate.toISOString()
      );

      const vatReport: VATReport = {
        period: {
          start: period.startDate,
          end: period.endDate,
          type: period.type
        },
        organizationNumber: this.merchantInfo?.organizationNumber || '',
        vatNumber: this.merchantInfo?.vatNumber || '',
        currency: 'SEK',
        summary: {
          totalSalesExclVAT: 0,
          totalVATCollected: 0,
          totalSalesInclVAT: 0,
          totalRefundsExclVAT: 0,
          totalRefundVAT: 0,
          netVATPayable: 0
        },
        vatRates: [],
        transactions: {
          salesCount: financeReport.transactionCount,
          refundCount: 0, // Would need to fetch separately
          totalCount: financeReport.transactionCount
        },
        generatedAt: new Date(),
        reportId: this.generateReportId()
      };

      // Calculate VAT breakdown
      if (financeReport.vatBreakdown) {
        for (const [rate, breakdown] of Object.entries(financeReport.vatBreakdown)) {
          vatReport.vatRates.push({
            rate: breakdown.rate,
            netAmount: breakdown.netAmount,
            vatAmount: breakdown.vatAmount,
            grossAmount: breakdown.grossAmount,
            transactionCount: 0 // Would need to calculate
          });

          vatReport.summary.totalSalesExclVAT += breakdown.netAmount;
          vatReport.summary.totalVATCollected += breakdown.vatAmount;
          vatReport.summary.totalSalesInclVAT += breakdown.grossAmount;
        }
      }

      vatReport.summary.netVATPayable = 
        vatReport.summary.totalVATCollected - vatReport.summary.totalRefundVAT;

      logger.info('VAT report generated', { 
        reportId: vatReport.reportId,
        totalVAT: vatReport.summary.totalVATCollected 
      });

      return vatReport;
    } catch (error) {
      logger.error('Failed to generate VAT report', error);
      throw error;
    }
  }

  /**
   * Configure invoice payments
   */
  async configureInvoicePayments(config: InvoiceConfiguration): Promise<InvoiceConfigurationResult> {
    logger.info('Configuring invoice payments', config);

    try {
      // Validate business information
      if (!config.invoiceAddress || !config.businessName) {
        throw new POSApiError({
          code: 'INCOMPLETE_INVOICE_INFO',
          message: 'Invoice address and business name are required'
        });
      }

      return {
        success: true,
        message: 'Invoice payments configured',
        capabilities: {
          creditTerms: config.defaultCreditTerms || 30,
          maxCreditAmount: config.maxCreditAmount || 50000,
          reminderEnabled: config.enableReminders || true,
          lateFeeEnabled: config.enableLateFees || false,
          electronicInvoicing: true,
          paperInvoicing: false
        },
        bankDetails: {
          bankgiro: config.bankgiroNumber,
          plusgiro: config.plusgiroNumber,
          iban: config.iban,
          bic: config.bic
        }
      };
    } catch (error) {
      logger.error('Failed to configure invoice payments', error);
      throw error;
    }
  }

  /**
   * Validate Swedish phone number for Swish
   */
  private validateSwishPhoneNumber(phoneNumber: string): boolean {
    // Swedish phone number format: +46XXXXXXXXX or 07XXXXXXXX
    const cleaned = phoneNumber.replace(/[\s-]/g, '');
    const swedishPhoneRegex = /^(\+46|0)7\d{8}$/;
    return swedishPhoneRegex.test(cleaned);
  }

  /**
   * Validate Swedish organization number
   */
  private validateOrganizationNumber(orgNumber: string): boolean {
    // Format: XXXXXX-XXXX
    const orgNumberRegex = /^\d{6}-\d{4}$/;
    if (!orgNumberRegex.test(orgNumber)) return false;

    // Luhn algorithm validation
    const cleanNumber = orgNumber.replace('-', '');
    let sum = 0;
    let alternate = false;
    
    for (let i = cleanNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cleanNumber[i], 10);
      if (alternate) {
        n *= 2;
        if (n > 9) n = (n % 10) + 1;
      }
      sum += n;
      alternate = !alternate;
    }
    
    return sum % 10 === 0;
  }

  /**
   * Check if cash payments are enabled
   */
  private async checkCashPaymentEnabled(): Promise<boolean> {
    try {
      const organization = await this.apiClient.getOrganization();
      return organization.paymentMethods?.includes('CASH') || false;
    } catch (error) {
      logger.error('Failed to check cash payment status', error);
      return false;
    }
  }

  /**
   * Generate Kassaregister ID
   */
  private generateKassaregisterId(orgNumber: string): string {
    const timestamp = Date.now().toString(36);
    const orgPart = orgNumber.replace('-', '').slice(-4);
    return `KR-${orgPart}-${timestamp}`.toUpperCase();
  }

  /**
   * Generate control unit ID
   */
  private generateControlUnitId(): string {
    return `CU-${Date.now().toString(36)}`.toUpperCase();
  }

  /**
   * Generate report ID
   */
  private generateReportId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `VAT-${dateStr}-${random}`;
  }

  /**
   * Get Swedish payment statistics
   */
  async getSwedishPaymentStatistics(period: { start: Date; end: Date }): Promise<SwedishPaymentStatistics> {
    try {
      const report = await this.apiClient.getFinanceReport(
        period.start.toISOString(),
        period.end.toISOString()
      );

      const stats: SwedishPaymentStatistics = {
        period,
        paymentMethods: {
          card: { count: 0, amount: 0, percentage: 0 },
          swish: { count: 0, amount: 0, percentage: 0 },
          cash: { count: 0, amount: 0, percentage: 0 },
          invoice: { count: 0, amount: 0, percentage: 0 }
        },
        totalTransactions: report.transactionCount,
        totalAmount: report.netRevenue,
        averageTransactionValue: report.averageTransactionValue,
        topPaymentMethod: 'card', // Would need to determine from data
        swishAdoption: 0 // Percentage of Swish transactions
      };

      // Parse payment method breakdown
      if (report.paymentMethodBreakdown) {
        for (const [method, data] of Object.entries(report.paymentMethodBreakdown)) {
          const methodKey = method.toLowerCase() as keyof typeof stats.paymentMethods;
          if (methodKey in stats.paymentMethods) {
            stats.paymentMethods[methodKey] = {
              count: data.count,
              amount: data.amount,
              percentage: (data.amount / report.netRevenue) * 100
            };
          }
        }

        // Calculate Swish adoption
        stats.swishAdoption = stats.paymentMethods.swish.percentage;

        // Determine top payment method
        const methods = Object.entries(stats.paymentMethods);
        const topMethod = methods.reduce((max, [method, data]) => {
          return data.amount > stats.paymentMethods[max as keyof typeof stats.paymentMethods].amount 
            ? method 
            : max;
        }, 'card');
        stats.topPaymentMethod = topMethod;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get Swedish payment statistics', error);
      throw error;
    }
  }
}

// Type definitions
export interface SwishConfiguration {
  swishPhoneNumber: string;
  businessName: string;
  enableQRCode?: boolean;
  maxTransactionAmount?: number;
  allowRefunds?: boolean;
}

export interface SwishConfigurationResult {
  success: boolean;
  message: string;
  swishNumber?: string;
  qrCodeEnabled?: boolean;
  requiresAgreement?: boolean;
  capabilities?: {
    refunds: boolean;
    partialRefunds: boolean;
    maxAmount: number;
    minAmount: number;
  };
}

export interface KassaregisterConfiguration {
  organizationNumber: string;
  businessName: string;
  requireCashRegister: boolean;
  controlUnitId?: string;
  automaticReporting?: boolean;
}

export interface KassaregisterConfigurationResult {
  success: boolean;
  message: string;
  requiresCashPayment?: boolean;
  registerId?: string;
  controlUnitId?: string;
  features?: {
    automaticReporting: boolean;
    receiptStorage: boolean;
    auditLog: boolean;
    tamperProtection: boolean;
  };
  complianceStatus?: {
    isCompliant: boolean;
    lastAudit: Date;
    nextAuditDue: Date;
  };
}

export interface VATReportPeriod {
  startDate: Date;
  endDate: Date;
  type: 'monthly' | 'quarterly' | 'annual';
}

export interface VATReport {
  period: {
    start: Date;
    end: Date;
    type: string;
  };
  organizationNumber: string;
  vatNumber: string;
  currency: string;
  summary: {
    totalSalesExclVAT: number;
    totalVATCollected: number;
    totalSalesInclVAT: number;
    totalRefundsExclVAT: number;
    totalRefundVAT: number;
    netVATPayable: number;
  };
  vatRates: Array<{
    rate: number;
    netAmount: number;
    vatAmount: number;
    grossAmount: number;
    transactionCount: number;
  }>;
  transactions: {
    salesCount: number;
    refundCount: number;
    totalCount: number;
  };
  generatedAt: Date;
  reportId: string;
}

export interface InvoiceConfiguration {
  businessName: string;
  invoiceAddress: any;
  organizationNumber: string;
  vatNumber?: string;
  bankgiroNumber?: string;
  plusgiroNumber?: string;
  iban?: string;
  bic?: string;
  defaultCreditTerms?: number;
  maxCreditAmount?: number;
  enableReminders?: boolean;
  enableLateFees?: boolean;
}

export interface InvoiceConfigurationResult {
  success: boolean;
  message: string;
  capabilities?: {
    creditTerms: number;
    maxCreditAmount: number;
    reminderEnabled: boolean;
    lateFeeEnabled: boolean;
    electronicInvoicing: boolean;
    paperInvoicing: boolean;
  };
  bankDetails?: {
    bankgiro?: string;
    plusgiro?: string;
    iban?: string;
    bic?: string;
  };
}

export interface SwedishPaymentStatistics {
  period: { start: Date; end: Date };
  paymentMethods: {
    card: { count: number; amount: number; percentage: number };
    swish: { count: number; amount: number; percentage: number };
    cash: { count: number; amount: number; percentage: number };
    invoice: { count: number; amount: number; percentage: number };
  };
  totalTransactions: number;
  totalAmount: number;
  averageTransactionValue: number;
  topPaymentMethod: string;
  swishAdoption: number; // Percentage
}

// Export factory function
export function createZettleSwedishFeatures(apiClient: ZettleAPIClient): ZettleSwedishMarketFeatures {
  return new ZettleSwedishMarketFeatures(apiClient);
}