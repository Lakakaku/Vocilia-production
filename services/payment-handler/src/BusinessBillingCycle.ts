/**
 * Business Billing Cycle Manager - Mock Business Billing Implementation
 * 
 * Handles automated monthly billing cycles for Swedish businesses
 * with comprehensive commission tracking and invoice generation.
 */

interface BillingCycle {
  id: string;
  businessId: string;
  billingPeriod: {
    startDate: Date;
    endDate: Date;
    month: number;
    year: number;
  };
  transactions: {
    totalCount: number;
    completedCount: number;
    failedCount: number;
    pendingCount: number;
  };
  financials: {
    totalCustomerRewards: number;      // Total paid to customers (SEK)
    totalCommissions: number;          // Platform commission earned (SEK)
    averageCommissionRate: number;     // Average commission rate
    swedishVAT: number;               // 25% Swedish VAT on commissions
    netRevenue: number;               // Commission - processing fees
    grossRevenue: number;             // Commission + VAT
  };
  status: 'active' | 'finalized' | 'invoiced' | 'paid' | 'overdue';
  invoiceId?: string;
  dueDate: Date;
  paidDate?: Date;
  businessInfo: {
    name: string;
    orgNumber: string;
    tier: number;
    contactEmail: string;
  };
  processingFees: {
    stripeProcessingFee: number;       // Mock Stripe processing fees
    bankingFees: number;               // Swedish banking fees
    systemFees: number;                // Platform operational costs
    total: number;
  };
  paymentHistory: {
    date: Date;
    amount: number;
    method: string;
    status: 'completed' | 'pending' | 'failed';
    reference: string;
  }[];
}

interface BillingConfig {
  billingDay: number;                  // Day of month for billing (1st)
  dueDays: number;                     // Days until payment due (30)
  overdueGraceDays: number;           // Grace period for overdue (7)
  swedishVATRate: number;             // Swedish VAT rate (25%)
  processingFeeRates: {
    stripeRate: number;               // 2.9% + 0.30 SEK
    bankingFeeFlat: number;           // 5.00 SEK per payout
    systemFeeRate: number;            // 1% operational fee
  };
  minimumBillAmount: number;          // Minimum bill amount (10 SEK)
  currency: 'SEK';
  businessTiers: {
    [key: number]: {
      name: string;
      commissionRate: number;
      processingDiscount: number;      // Tier-based discount on processing fees
    };
  };
}

export class BusinessBillingCycle {
  private billingCycles: Map<string, BillingCycle[]> = new Map();
  private currentCycles: Map<string, BillingCycle> = new Map();
  
  private readonly config: BillingConfig = {
    billingDay: 1,                     // Bill on 1st of each month
    dueDays: 30,                       // 30 days to pay
    overdueGraceDays: 7,               // 7 day grace period
    swedishVATRate: 0.25,              // 25% Swedish VAT
    processingFeeRates: {
      stripeRate: 0.029,               // 2.9%
      bankingFeeFlat: 5.00,           // 5 SEK per payout
      systemFeeRate: 0.01             // 1% operational fee
    },
    minimumBillAmount: 10.00,          // 10 SEK minimum
    currency: 'SEK',
    businessTiers: {
      1: { name: 'Small', commissionRate: 0.20, processingDiscount: 0.0 },
      2: { name: 'Medium', commissionRate: 0.18, processingDiscount: 0.1 },
      3: { name: 'Large', commissionRate: 0.15, processingDiscount: 0.2 }
    }
  };

  /**
   * Initialize billing cycle for a business
   */
  async initializeBillingCycle(
    businessId: string,
    businessInfo: {
      name: string;
      orgNumber: string;
      tier: number;
      contactEmail: string;
    }
  ): Promise<BillingCycle> {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    // Billing period: 1st of current month to last day of current month
    const startDate = new Date(currentYear, currentMonth, 1);
    const endDate = new Date(currentYear, currentMonth + 1, 0); // Last day of month
    const dueDate = new Date(currentYear, currentMonth + 1, this.config.dueDays);
    
    const billingCycle: BillingCycle = {
      id: this.generateBillingCycleId(businessId, currentYear, currentMonth),
      businessId,
      billingPeriod: {
        startDate,
        endDate,
        month: currentMonth + 1, // 1-based month
        year: currentYear
      },
      transactions: {
        totalCount: 0,
        completedCount: 0,
        failedCount: 0,
        pendingCount: 0
      },
      financials: {
        totalCustomerRewards: 0,
        totalCommissions: 0,
        averageCommissionRate: this.config.businessTiers[businessInfo.tier].commissionRate,
        swedishVAT: 0,
        netRevenue: 0,
        grossRevenue: 0
      },
      status: 'active',
      dueDate,
      businessInfo,
      processingFees: {
        stripeProcessingFee: 0,
        bankingFees: 0,
        systemFees: 0,
        total: 0
      },
      paymentHistory: []
    };
    
    // Store current billing cycle
    this.currentCycles.set(businessId, billingCycle);
    
    // Add to historical cycles
    const businessCycles = this.billingCycles.get(businessId) || [];
    businessCycles.push(billingCycle);
    this.billingCycles.set(businessId, businessCycles);
    
    console.log(`📋 Initialized billing cycle for ${businessInfo.name} (${businessId})`);
    console.log(`📅 Period: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    console.log(`💰 Commission Rate: ${(billingCycle.financials.averageCommissionRate * 100).toFixed(1)}%`);
    
    return billingCycle;
  }

  /**
   * Add transaction to current billing cycle
   */
  async addTransactionToBilling(
    businessId: string,
    customerReward: number,
    commissionAmount: number,
    status: 'completed' | 'pending' | 'failed' = 'completed'
  ): Promise<void> {
    let cycle = this.currentCycles.get(businessId);
    
    if (!cycle) {
      throw new Error(`No active billing cycle found for business ${businessId}`);
    }
    
    // Update transaction counts
    cycle.transactions.totalCount++;
    switch (status) {
      case 'completed':
        cycle.transactions.completedCount++;
        break;
      case 'pending':
        cycle.transactions.pendingCount++;
        break;
      case 'failed':
        cycle.transactions.failedCount++;
        break;
    }
    
    // Update financials (only for completed transactions)
    if (status === 'completed') {
      cycle.financials.totalCustomerRewards += customerReward;
      cycle.financials.totalCommissions += commissionAmount;
      cycle.financials.averageCommissionRate = 
        cycle.financials.totalCommissions / cycle.financials.totalCustomerRewards;
      
      // Calculate processing fees
      const stripeProcessingFee = (customerReward * this.config.processingFeeRates.stripeRate) + 0.30;
      const bankingFee = this.config.processingFeeRates.bankingFeeFlat;
      const systemFee = commissionAmount * this.config.processingFeeRates.systemFeeRate;
      
      // Apply tier-based processing discount
      const tierDiscount = this.config.businessTiers[cycle.businessInfo.tier].processingDiscount;
      const discountedProcessingFee = (stripeProcessingFee + bankingFee) * (1 - tierDiscount);
      
      cycle.processingFees.stripeProcessingFee += discountedProcessingFee;
      cycle.processingFees.bankingFees += bankingFee * (1 - tierDiscount);
      cycle.processingFees.systemFees += systemFee;
      cycle.processingFees.total = 
        cycle.processingFees.stripeProcessingFee + 
        cycle.processingFees.bankingFees + 
        cycle.processingFees.systemFees;
      
      // Calculate final financials
      cycle.financials.netRevenue = cycle.financials.totalCommissions - cycle.processingFees.total;
      cycle.financials.swedishVAT = cycle.financials.totalCommissions * this.config.swedishVATRate;
      cycle.financials.grossRevenue = cycle.financials.totalCommissions + cycle.financials.swedishVAT;
    }
  }

  /**
   * Finalize billing cycle (prepare for invoicing)
   */
  async finalizeBillingCycle(businessId: string): Promise<BillingCycle> {
    const cycle = this.currentCycles.get(businessId);
    
    if (!cycle) {
      throw new Error(`No active billing cycle found for business ${businessId}`);
    }
    
    // Check if billing period has ended
    const now = new Date();
    if (now < cycle.billingPeriod.endDate) {
      throw new Error('Cannot finalize billing cycle before period ends');
    }
    
    // Mark as finalized
    cycle.status = 'finalized';
    
    console.log(`✅ Finalized billing cycle for ${cycle.businessInfo.name}`);
    console.log(`📊 Transactions: ${cycle.transactions.completedCount} completed, ${cycle.transactions.failedCount} failed`);
    console.log(`💰 Total Commissions: ${cycle.financials.totalCommissions.toFixed(2)} SEK`);
    console.log(`🏦 Processing Fees: ${cycle.processingFees.total.toFixed(2)} SEK`);
    console.log(`💵 Net Revenue: ${cycle.financials.netRevenue.toFixed(2)} SEK`);
    
    return cycle;
  }

  /**
   * Get current billing cycle for a business
   */
  async getCurrentBillingCycle(businessId: string): Promise<BillingCycle | null> {
    return this.currentCycles.get(businessId) || null;
  }

  /**
   * Get billing history for a business
   */
  async getBillingHistory(businessId: string, months: number = 12): Promise<BillingCycle[]> {
    const cycles = this.billingCycles.get(businessId) || [];
    return cycles.slice(-months); // Return last N months
  }

  /**
   * Generate mock billing data for testing
   */
  async generateMockBillingData(): Promise<{
    businesses: string[];
    cycles: BillingCycle[];
    totalRevenue: number;
  }> {
    const mockBusinesses = [
      {
        id: 'cafe-aurora-001',
        name: 'Aurora Café Stockholm',
        orgNumber: '556123-4567',
        tier: 1,
        contactEmail: 'billing@auroracafe.se'
      },
      {
        id: 'malmo-huset-002', 
        name: 'Malmö Huset Restaurant',
        orgNumber: '556234-5678',
        tier: 2,
        contactEmail: 'accounts@malmohuset.se'
      },
      {
        id: 'goteborg-store-003',
        name: 'Göteborg Department Store',
        orgNumber: '556345-6789', 
        tier: 3,
        contactEmail: 'finance@goteborgsstore.se'
      }
    ];

    console.log('📋 Generating mock billing cycle data...');
    
    const allCycles: BillingCycle[] = [];
    let totalRevenue = 0;
    
    for (const business of mockBusinesses) {
      // Initialize current billing cycle
      const cycle = await this.initializeBillingCycle(business.id, business);
      
      // Generate random transactions for this month
      const transactionCount = Math.floor(Math.random() * 50) + 20; // 20-70 transactions
      
      for (let i = 0; i < transactionCount; i++) {
        const customerReward = Math.round((Math.random() * 200 + 10) * 100) / 100; // 10-210 SEK
        const commissionRate = this.config.businessTiers[business.tier].commissionRate;
        const commissionAmount = Math.round(customerReward * commissionRate * 100) / 100;
        
        // 95% completed, 3% pending, 2% failed
        let status: 'completed' | 'pending' | 'failed' = 'completed';
        const random = Math.random();
        if (random > 0.98) status = 'failed';
        else if (random > 0.95) status = 'pending';
        
        await this.addTransactionToBilling(business.id, customerReward, commissionAmount, status);
      }
      
      // Finalize the cycle (simulate end of month)
      cycle.billingPeriod.endDate = new Date(); // Set end date to now for testing
      const finalizedCycle = await this.finalizeBillingCycle(business.id);
      
      allCycles.push(finalizedCycle);
      totalRevenue += finalizedCycle.financials.netRevenue;
      
      // Create historical billing cycles (past 3 months)
      for (let monthsBack = 1; monthsBack <= 3; monthsBack++) {
        const historicalCycle = await this.createHistoricalBillingCycle(business, monthsBack);
        allCycles.push(historicalCycle);
        totalRevenue += historicalCycle.financials.netRevenue;
      }
    }
    
    console.log(`✅ Generated ${allCycles.length} billing cycles for ${mockBusinesses.length} businesses`);
    console.log(`💰 Total Platform Revenue: ${totalRevenue.toFixed(2)} SEK`);
    
    return {
      businesses: mockBusinesses.map(b => b.id),
      cycles: allCycles,
      totalRevenue
    };
  }

  /**
   * Create historical billing cycle for testing
   */
  private async createHistoricalBillingCycle(
    business: any,
    monthsBack: number
  ): Promise<BillingCycle> {
    const now = new Date();
    const historicalDate = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
    const startDate = new Date(historicalDate.getFullYear(), historicalDate.getMonth(), 1);
    const endDate = new Date(historicalDate.getFullYear(), historicalDate.getMonth() + 1, 0);
    const dueDate = new Date(historicalDate.getFullYear(), historicalDate.getMonth() + 1, this.config.dueDays);
    
    // Generate random historical data
    const transactionCount = Math.floor(Math.random() * 60) + 30;
    const totalCustomerRewards = Math.round((Math.random() * 5000 + 1000) * 100) / 100;
    const commissionRate = this.config.businessTiers[business.tier].commissionRate;
    const totalCommissions = Math.round(totalCustomerRewards * commissionRate * 100) / 100;
    
    // Calculate processing fees
    const processingFees = {
      stripeProcessingFee: Math.round(totalCommissions * 0.1 * 100) / 100,
      bankingFees: transactionCount * this.config.processingFeeRates.bankingFeeFlat,
      systemFees: Math.round(totalCommissions * this.config.processingFeeRates.systemFeeRate * 100) / 100,
      total: 0
    };
    processingFees.total = processingFees.stripeProcessingFee + processingFees.bankingFees + processingFees.systemFees;
    
    const netRevenue = totalCommissions - processingFees.total;
    const swedishVAT = totalCommissions * this.config.swedishVATRate;
    
    const historicalCycle: BillingCycle = {
      id: this.generateBillingCycleId(business.id, historicalDate.getFullYear(), historicalDate.getMonth()),
      businessId: business.id,
      billingPeriod: {
        startDate,
        endDate,
        month: historicalDate.getMonth() + 1,
        year: historicalDate.getFullYear()
      },
      transactions: {
        totalCount: transactionCount,
        completedCount: Math.floor(transactionCount * 0.95),
        failedCount: Math.floor(transactionCount * 0.02),
        pendingCount: Math.floor(transactionCount * 0.03)
      },
      financials: {
        totalCustomerRewards,
        totalCommissions,
        averageCommissionRate: commissionRate,
        swedishVAT,
        netRevenue,
        grossRevenue: totalCommissions + swedishVAT
      },
      status: 'paid',
      dueDate,
      paidDate: new Date(dueDate.getTime() + (Math.random() * 7 * 24 * 60 * 60 * 1000)), // Paid within 7 days
      businessInfo: business,
      processingFees,
      paymentHistory: [
        {
          date: new Date(dueDate.getTime() + (Math.random() * 7 * 24 * 60 * 60 * 1000)),
          amount: totalCommissions,
          method: 'Bank Transfer',
          status: 'completed',
          reference: `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
        }
      ]
    };
    
    // Add to historical cycles
    const businessCycles = this.billingCycles.get(business.id) || [];
    businessCycles.unshift(historicalCycle); // Add to beginning (oldest first)
    this.billingCycles.set(business.id, businessCycles);
    
    return historicalCycle;
  }

  /**
   * Get platform-wide billing statistics
   */
  async getPlatformBillingStats(): Promise<{
    totalBusinesses: number;
    totalActiveCycles: number;
    totalMonthlyRevenue: number;
    totalYearlyRevenue: number;
    averageRevenuePerBusiness: number;
    paymentStatus: {
      current: number;
      overdue: number;
      paid: number;
    };
    tierBreakdown: {
      tier1: { businesses: number; revenue: number };
      tier2: { businesses: number; revenue: number };
      tier3: { businesses: number; revenue: number };
    };
  }> {
    const allCycles = Array.from(this.billingCycles.values()).flat();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const currentCycles = allCycles.filter(
      c => c.billingPeriod.month === currentMonth + 1 && c.billingPeriod.year === currentYear
    );
    
    const yearCycles = allCycles.filter(c => c.billingPeriod.year === currentYear);
    
    const totalMonthlyRevenue = currentCycles.reduce((sum, c) => sum + c.financials.netRevenue, 0);
    const totalYearlyRevenue = yearCycles.reduce((sum, c) => sum + c.financials.netRevenue, 0);
    
    // Tier breakdown
    const tierBreakdown = {
      tier1: { businesses: 0, revenue: 0 },
      tier2: { businesses: 0, revenue: 0 },
      tier3: { businesses: 0, revenue: 0 }
    };
    
    currentCycles.forEach(cycle => {
      const tier = cycle.businessInfo.tier;
      const tierKey = `tier${tier}` as keyof typeof tierBreakdown;
      tierBreakdown[tierKey].businesses++;
      tierBreakdown[tierKey].revenue += cycle.financials.netRevenue;
    });
    
    return {
      totalBusinesses: this.currentCycles.size,
      totalActiveCycles: currentCycles.length,
      totalMonthlyRevenue,
      totalYearlyRevenue,
      averageRevenuePerBusiness: totalMonthlyRevenue / Math.max(currentCycles.length, 1),
      paymentStatus: {
        current: allCycles.filter(c => c.status === 'finalized' || c.status === 'invoiced').length,
        overdue: allCycles.filter(c => c.status === 'overdue').length,
        paid: allCycles.filter(c => c.status === 'paid').length
      },
      tierBreakdown
    };
  }

  /**
   * Generate billing cycle ID
   */
  private generateBillingCycleId(businessId: string, year: number, month: number): string {
    return `bill-${businessId}-${year}-${month.toString().padStart(2, '0')}`;
  }
}