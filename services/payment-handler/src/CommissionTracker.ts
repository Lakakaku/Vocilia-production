/**
 * Commission Tracker - Automated 20% Commission Calculation and Tracking
 * 
 * Handles automated commission tracking for all customer reward payouts
 * with comprehensive test transaction support and Swedish business compliance.
 */

interface CommissionTransaction {
  id: string;
  businessId: string;
  feedbackSessionId: string;
  customerReward: number;        // Amount paid to customer (SEK)
  commissionRate: number;        // Commission rate (0.15-0.20 based on tier)
  commissionAmount: number;      // Platform commission (SEK)
  grossRevenue: number;          // Total revenue for platform
  transactionDate: Date;
  businessTier: number;          // 1, 2, or 3
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  reconciled: boolean;
  invoiceId?: string;
  notes?: string;
}

interface BusinessCommissionSummary {
  businessId: string;
  billingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  totalTransactions: number;
  totalCustomerRewards: number;  // Total paid to customers
  totalCommissions: number;      // Total platform commission earned
  averageCommissionRate: number;
  transactionBreakdown: {
    tier1: { count: number; commission: number };
    tier2: { count: number; commission: number };
    tier3: { count: number; commission: number };
  };
  status: 'draft' | 'finalized' | 'invoiced' | 'paid';
}

interface CommissionConfig {
  tierRates: {
    tier1: number; // 20% commission rate
    tier2: number; // 18% commission rate  
    tier3: number; // 15% commission rate
  };
  minimumCommission: number;     // Minimum commission per transaction (SEK)
  billingCycle: 'monthly' | 'weekly';
  swedishTaxRate: number;        // Swedish VAT rate (25%)
  currencyPrecision: number;     // Swedish öre precision (2 decimals)
}

export class CommissionTracker {
  private transactions: CommissionTransaction[] = [];
  private businessSummaries: Map<string, BusinessCommissionSummary> = new Map();
  
  private readonly config: CommissionConfig = {
    tierRates: {
      tier1: 0.20, // 20% for small businesses
      tier2: 0.18, // 18% for medium businesses
      tier3: 0.15  // 15% for large businesses
    },
    minimumCommission: 0.50,     // 50 öre minimum
    billingCycle: 'monthly',
    swedishTaxRate: 0.25,        // 25% Swedish VAT
    currencyPrecision: 2
  };

  /**
   * Track commission for a customer reward payout
   */
  async trackCommission(
    businessId: string,
    feedbackSessionId: string,
    customerReward: number,
    businessTier: number
  ): Promise<CommissionTransaction> {
    // Get commission rate based on business tier
    const commissionRate = this.getCommissionRate(businessTier);
    
    // Calculate commission amount (rounded to öre precision)
    const commissionAmount = Math.max(
      Math.round(customerReward * commissionRate * 100) / 100,
      this.config.minimumCommission
    );
    
    // Calculate gross revenue (commission + any processing fees)
    const grossRevenue = commissionAmount;
    
    const transaction: CommissionTransaction = {
      id: this.generateTransactionId(),
      businessId,
      feedbackSessionId,
      customerReward,
      commissionRate,
      commissionAmount,
      grossRevenue,
      transactionDate: new Date(),
      businessTier,
      paymentStatus: 'pending',
      reconciled: false
    };
    
    // Store transaction
    this.transactions.push(transaction);
    
    // Update business summary
    await this.updateBusinessSummary(businessId, transaction);
    
    console.log(`📊 Commission Tracked: ${commissionAmount} SEK (${(commissionRate * 100).toFixed(1)}%) on ${customerReward} SEK reward`);
    
    return transaction;
  }

  /**
   * Get commission rate based on business tier
   */
  private getCommissionRate(tier: number): number {
    switch (tier) {
      case 1: return this.config.tierRates.tier1;
      case 2: return this.config.tierRates.tier2;
      case 3: return this.config.tierRates.tier3;
      default: return this.config.tierRates.tier1; // Default to highest rate
    }
  }

  /**
   * Update business commission summary
   */
  private async updateBusinessSummary(
    businessId: string, 
    transaction: CommissionTransaction
  ): Promise<void> {
    const now = new Date();
    const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const billingPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    let summary = this.businessSummaries.get(businessId);
    
    if (!summary) {
      summary = {
        businessId,
        billingPeriod: {
          startDate: billingPeriodStart,
          endDate: billingPeriodEnd
        },
        totalTransactions: 0,
        totalCustomerRewards: 0,
        totalCommissions: 0,
        averageCommissionRate: 0,
        transactionBreakdown: {
          tier1: { count: 0, commission: 0 },
          tier2: { count: 0, commission: 0 },
          tier3: { count: 0, commission: 0 }
        },
        status: 'draft'
      };
    }
    
    // Update totals
    summary.totalTransactions++;
    summary.totalCustomerRewards += transaction.customerReward;
    summary.totalCommissions += transaction.commissionAmount;
    summary.averageCommissionRate = summary.totalCommissions / summary.totalCustomerRewards;
    
    // Update tier breakdown
    const tierKey = `tier${transaction.businessTier}` as keyof typeof summary.transactionBreakdown;
    summary.transactionBreakdown[tierKey].count++;
    summary.transactionBreakdown[tierKey].commission += transaction.commissionAmount;
    
    this.businessSummaries.set(businessId, summary);
  }

  /**
   * Get commission summary for a business
   */
  async getBusinessCommissionSummary(businessId: string): Promise<BusinessCommissionSummary | null> {
    return this.businessSummaries.get(businessId) || null;
  }

  /**
   * Get all transactions for a business in a date range
   */
  async getBusinessTransactions(
    businessId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<CommissionTransaction[]> {
    return this.transactions.filter(transaction => {
      if (transaction.businessId !== businessId) return false;
      
      if (startDate && transaction.transactionDate < startDate) return false;
      if (endDate && transaction.transactionDate > endDate) return false;
      
      return true;
    });
  }

  /**
   * Mark transaction as completed
   */
  async markTransactionCompleted(transactionId: string): Promise<void> {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (transaction) {
      transaction.paymentStatus = 'completed';
      console.log(`✅ Commission transaction ${transactionId} marked as completed`);
    }
  }

  /**
   * Mark transaction as failed
   */
  async markTransactionFailed(transactionId: string): Promise<void> {
    const transaction = this.transactions.find(t => t.id === transactionId);
    if (transaction) {
      transaction.paymentStatus = 'failed';
      console.log(`❌ Commission transaction ${transactionId} marked as failed`);
    }
  }

  /**
   * Generate test commission data for demonstration
   */
  async generateTestCommissionData(): Promise<{
    transactions: CommissionTransaction[];
    summaries: BusinessCommissionSummary[];
  }> {
    const testBusinesses = [
      { id: 'cafe-aurora-001', tier: 1, name: 'Aurora Café Stockholm' },
      { id: 'malmo-huset-002', tier: 2, name: 'Malmö Huset Restaurant' },
      { id: 'goteborg-store-003', tier: 3, name: 'Göteborg Department Store' }
    ];

    console.log('📊 Generating test commission data...');
    
    // Generate test transactions for the past month
    for (const business of testBusinesses) {
      const transactionCount = Math.floor(Math.random() * 30) + 10; // 10-40 transactions
      
      for (let i = 0; i < transactionCount; i++) {
        // Random customer reward between 5-200 SEK
        const customerReward = Math.round((Math.random() * 195 + 5) * 100) / 100;
        
        // Random date in the past 30 days
        const daysBack = Math.floor(Math.random() * 30);
        const testDate = new Date();
        testDate.setDate(testDate.getDate() - daysBack);
        
        const transaction = await this.trackCommission(
          business.id,
          `feedback-session-${Date.now()}-${i}`,
          customerReward,
          business.tier
        );
        
        // Randomly mark some as completed/failed for realism
        if (Math.random() > 0.9) {
          await this.markTransactionFailed(transaction.id);
        } else if (Math.random() > 0.1) {
          await this.markTransactionCompleted(transaction.id);
        }
      }
    }

    // Return current state
    const summaries = Array.from(this.businessSummaries.values());
    
    console.log(`✅ Generated ${this.transactions.length} test transactions for ${testBusinesses.length} businesses`);
    
    return {
      transactions: this.transactions,
      summaries
    };
  }

  /**
   * Get platform-wide commission statistics
   */
  async getPlatformCommissionStats(): Promise<{
    totalTransactions: number;
    totalCustomerRewards: number;
    totalCommissionsEarned: number;
    averageCommissionRate: number;
    monthlyRevenue: number;
    topPerformingBusinesses: { businessId: string; commission: number }[];
  }> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyTransactions = this.transactions.filter(
      t => t.transactionDate >= monthStart && t.paymentStatus === 'completed'
    );
    
    const totalCustomerRewards = monthlyTransactions.reduce((sum, t) => sum + t.customerReward, 0);
    const totalCommissions = monthlyTransactions.reduce((sum, t) => sum + t.commissionAmount, 0);
    
    // Calculate Swedish VAT on commissions
    const monthlyRevenue = totalCommissions * (1 + this.config.swedishTaxRate);
    
    // Top performing businesses by commission
    const businessCommissions = new Map<string, number>();
    monthlyTransactions.forEach(t => {
      const current = businessCommissions.get(t.businessId) || 0;
      businessCommissions.set(t.businessId, current + t.commissionAmount);
    });
    
    const topPerformingBusinesses = Array.from(businessCommissions.entries())
      .map(([businessId, commission]) => ({ businessId, commission }))
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 5);

    return {
      totalTransactions: monthlyTransactions.length,
      totalCustomerRewards,
      totalCommissionsEarned: totalCommissions,
      averageCommissionRate: totalCustomerRewards > 0 ? totalCommissions / totalCustomerRewards : 0,
      monthlyRevenue,
      topPerformingBusinesses
    };
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `comm-${timestamp}-${random}`;
  }

  /**
   * Export commission data for reconciliation
   */
  async exportCommissionData(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const transactions = this.transactions.filter(
      t => t.transactionDate >= startDate && t.transactionDate <= endDate
    );

    if (format === 'csv') {
      const headers = [
        'Transaction ID',
        'Business ID',
        'Date',
        'Customer Reward (SEK)',
        'Commission Rate (%)',
        'Commission Amount (SEK)',
        'Business Tier',
        'Status',
        'Reconciled'
      ];
      
      const rows = transactions.map(t => [
        t.id,
        t.businessId,
        t.transactionDate.toISOString().split('T')[0],
        t.customerReward.toFixed(2),
        (t.commissionRate * 100).toFixed(1),
        t.commissionAmount.toFixed(2),
        t.businessTier.toString(),
        t.paymentStatus,
        t.reconciled ? 'Yes' : 'No'
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify(transactions, null, 2);
  }
}