/**
 * Reconciliation System - Payment and Commission Reconciliation
 * 
 * Handles automated reconciliation of customer payouts, business commissions,
 * and invoice payments using test data for comprehensive validation.
 */

interface ReconciliationRecord {
  id: string;
  date: Date;
  type: 'customer_payout' | 'commission_earned' | 'invoice_payment' | 'processing_fee';
  
  // Transaction references
  transactionId?: string;
  invoiceId?: string;
  businessId: string;
  
  // Financial details
  amount: number;              // SEK
  currency: 'SEK';
  status: 'pending' | 'completed' | 'failed' | 'disputed';
  
  // Reconciliation status
  reconciled: boolean;
  reconciledDate?: Date;
  reconciledBy?: string;
  
  // Source data
  sourceSystem: 'stripe' | 'banking' | 'manual' | 'api';
  sourceReference: string;
  
  // Metadata
  description: string;
  notes?: string;
  category: string;
  
  // Swedish compliance
  vatAmount?: number;          // VAT portion for commissions
  grossAmount?: number;        // Amount including VAT
}

interface ReconciliationSummary {
  period: { startDate: Date; endDate: Date };
  businessId: string;
  businessName: string;
  
  // Customer payouts
  customerPayouts: {
    totalCount: number;
    totalAmount: number;
    reconciledCount: number;
    reconciledAmount: number;
    unreconciledCount: number;
    unreconciledAmount: number;
  };
  
  // Commission earnings
  commissionEarnings: {
    totalAmount: number;
    vatAmount: number;
    netAmount: number;
    reconciledAmount: number;
    unreconciledAmount: number;
  };
  
  // Invoice payments
  invoicePayments: {
    totalInvoiced: number;
    totalPaid: number;
    totalOutstanding: number;
    overdueAmount: number;
  };
  
  // Processing fees
  processingFees: {
    stripeFeesTotal: number;
    bankingFeesTotal: number;
    systemFeesTotal: number;
    totalFees: number;
    reconciledFees: number;
  };
  
  // Reconciliation status
  reconciliationStatus: {
    totalRecords: number;
    reconciledRecords: number;
    unreconciledRecords: number;
    disputedRecords: number;
    reconciliationPercentage: number;
  };
  
  // Discrepancies
  discrepancies: {
    count: number;
    totalAmount: number;
    resolved: number;
    unresolved: number;
  };
}

interface DiscrepancyRecord {
  id: string;
  date: Date;
  businessId: string;
  type: 'amount_mismatch' | 'missing_transaction' | 'duplicate_entry' | 'timing_difference';
  description: string;
  
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  
  sourceRecord?: ReconciliationRecord;
  relatedRecords: string[];      // IDs of related records
  
  status: 'open' | 'investigating' | 'resolved' | 'accepted';
  resolution?: string;
  resolvedBy?: string;
  resolvedDate?: Date;
  
  priority: 'low' | 'medium' | 'high' | 'critical';
  impact: 'minor' | 'moderate' | 'significant' | 'major';
}

export class ReconciliationSystem {
  private reconciliationRecords: ReconciliationRecord[] = [];
  private discrepancies: DiscrepancyRecord[] = [];
  private reconciledTransactions: Set<string> = new Set();
  
  /**
   * Add reconciliation record
   */
  async addReconciliationRecord(record: Omit<ReconciliationRecord, 'id' | 'reconciled' | 'currency'>): Promise<ReconciliationRecord> {
    const reconciliationRecord: ReconciliationRecord = {
      ...record,
      id: this.generateReconciliationId(),
      reconciled: false,
      currency: 'SEK'
    };
    
    this.reconciliationRecords.push(reconciliationRecord);
    
    console.log(`📊 Added reconciliation record: ${record.type} - ${record.amount.toFixed(2)} SEK`);
    
    return reconciliationRecord;
  }

  /**
   * Reconcile customer payout
   */
  async reconcileCustomerPayout(
    transactionId: string,
    businessId: string,
    payoutAmount: number,
    sourceReference: string,
    sourceSystem: 'stripe' | 'banking' = 'stripe'
  ): Promise<ReconciliationRecord> {
    const record = await this.addReconciliationRecord({
      date: new Date(),
      type: 'customer_payout',
      transactionId,
      businessId,
      amount: payoutAmount,
      status: 'completed',
      sourceSystem,
      sourceReference,
      description: `Customer reward payout - ${payoutAmount.toFixed(2)} SEK`,
      category: 'customer_rewards'
    });
    
    // Mark as reconciled immediately for successful payouts
    await this.markRecordReconciled(record.id, 'system');
    
    return record;
  }

  /**
   * Reconcile commission earnings
   */
  async reconcileCommissionEarning(
    transactionId: string,
    businessId: string,
    commissionAmount: number,
    vatAmount: number,
    sourceReference: string
  ): Promise<ReconciliationRecord> {
    const grossAmount = commissionAmount + vatAmount;
    
    const record = await this.addReconciliationRecord({
      date: new Date(),
      type: 'commission_earned',
      transactionId,
      businessId,
      amount: commissionAmount,
      vatAmount,
      grossAmount,
      status: 'completed',
      sourceSystem: 'api',
      sourceReference,
      description: `Commission earned - ${commissionAmount.toFixed(2)} SEK (+ ${vatAmount.toFixed(2)} VAT)`,
      category: 'commission_revenue'
    });
    
    await this.markRecordReconciled(record.id, 'system');
    
    return record;
  }

  /**
   * Reconcile invoice payment
   */
  async reconcileInvoicePayment(
    invoiceId: string,
    businessId: string,
    paymentAmount: number,
    paymentMethod: string,
    sourceReference: string
  ): Promise<ReconciliationRecord> {
    const record = await this.addReconciliationRecord({
      date: new Date(),
      type: 'invoice_payment',
      invoiceId,
      businessId,
      amount: paymentAmount,
      status: 'completed',
      sourceSystem: 'banking',
      sourceReference,
      description: `Invoice payment via ${paymentMethod} - ${paymentAmount.toFixed(2)} SEK`,
      category: 'invoice_payments'
    });
    
    await this.markRecordReconciled(record.id, 'system');
    
    return record;
  }

  /**
   * Reconcile processing fees
   */
  async reconcileProcessingFee(
    transactionId: string,
    businessId: string,
    feeAmount: number,
    feeType: 'stripe' | 'banking' | 'system',
    sourceReference: string
  ): Promise<ReconciliationRecord> {
    const record = await this.addReconciliationRecord({
      date: new Date(),
      type: 'processing_fee',
      transactionId,
      businessId,
      amount: -feeAmount, // Negative amount for fees
      status: 'completed',
      sourceSystem: 'api',
      sourceReference,
      description: `${feeType} processing fee - ${feeAmount.toFixed(2)} SEK`,
      category: `${feeType}_fees`
    });
    
    await this.markRecordReconciled(record.id, 'system');
    
    return record;
  }

  /**
   * Mark record as reconciled
   */
  async markRecordReconciled(recordId: string, reconciledBy: string): Promise<void> {
    const record = this.reconciliationRecords.find(r => r.id === recordId);
    if (!record) {
      throw new Error(`Reconciliation record ${recordId} not found`);
    }
    
    record.reconciled = true;
    record.reconciledDate = new Date();
    record.reconciledBy = reconciledBy;
    
    if (record.transactionId) {
      this.reconciledTransactions.add(record.transactionId);
    }
    
    console.log(`✅ Reconciled record ${recordId}: ${record.description}`);
  }

  /**
   * Generate reconciliation summary for business
   */
  async generateReconciliationSummary(
    businessId: string,
    startDate: Date,
    endDate: Date,
    businessName: string = 'Unknown Business'
  ): Promise<ReconciliationSummary> {
    const businessRecords = this.reconciliationRecords.filter(
      record => record.businessId === businessId &&
                record.date >= startDate &&
                record.date <= endDate
    );
    
    // Customer payouts
    const payoutRecords = businessRecords.filter(r => r.type === 'customer_payout');
    const reconciledPayouts = payoutRecords.filter(r => r.reconciled);
    const unreconciledPayouts = payoutRecords.filter(r => !r.reconciled);
    
    const customerPayouts = {
      totalCount: payoutRecords.length,
      totalAmount: payoutRecords.reduce((sum, r) => sum + r.amount, 0),
      reconciledCount: reconciledPayouts.length,
      reconciledAmount: reconciledPayouts.reduce((sum, r) => sum + r.amount, 0),
      unreconciledCount: unreconciledPayouts.length,
      unreconciledAmount: unreconciledPayouts.reduce((sum, r) => sum + r.amount, 0)
    };
    
    // Commission earnings
    const commissionRecords = businessRecords.filter(r => r.type === 'commission_earned');
    const reconciledCommissions = commissionRecords.filter(r => r.reconciled);
    
    const commissionEarnings = {
      totalAmount: commissionRecords.reduce((sum, r) => sum + r.amount, 0),
      vatAmount: commissionRecords.reduce((sum, r) => sum + (r.vatAmount || 0), 0),
      netAmount: commissionRecords.reduce((sum, r) => sum + r.amount - (r.vatAmount || 0), 0),
      reconciledAmount: reconciledCommissions.reduce((sum, r) => sum + r.amount, 0),
      unreconciledAmount: commissionRecords.filter(r => !r.reconciled).reduce((sum, r) => sum + r.amount, 0)
    };
    
    // Invoice payments
    const invoiceRecords = businessRecords.filter(r => r.type === 'invoice_payment');
    const invoicePayments = {
      totalInvoiced: commissionEarnings.totalAmount + commissionEarnings.vatAmount,
      totalPaid: invoiceRecords.reduce((sum, r) => sum + r.amount, 0),
      totalOutstanding: 0,
      overdueAmount: 0
    };
    invoicePayments.totalOutstanding = invoicePayments.totalInvoiced - invoicePayments.totalPaid;
    
    // Processing fees
    const feeRecords = businessRecords.filter(r => r.type === 'processing_fee');
    const processingFees = {
      stripeFeesTotal: Math.abs(feeRecords.filter(r => r.category === 'stripe_fees').reduce((sum, r) => sum + r.amount, 0)),
      bankingFeesTotal: Math.abs(feeRecords.filter(r => r.category === 'banking_fees').reduce((sum, r) => sum + r.amount, 0)),
      systemFeesTotal: Math.abs(feeRecords.filter(r => r.category === 'system_fees').reduce((sum, r) => sum + r.amount, 0)),
      totalFees: Math.abs(feeRecords.reduce((sum, r) => sum + r.amount, 0)),
      reconciledFees: Math.abs(feeRecords.filter(r => r.reconciled).reduce((sum, r) => sum + r.amount, 0))
    };
    
    // Reconciliation status
    const totalRecords = businessRecords.length;
    const reconciledRecords = businessRecords.filter(r => r.reconciled).length;
    const unreconciledRecords = totalRecords - reconciledRecords;
    const disputedRecords = businessRecords.filter(r => r.status === 'disputed').length;
    
    const reconciliationStatus = {
      totalRecords,
      reconciledRecords,
      unreconciledRecords,
      disputedRecords,
      reconciliationPercentage: totalRecords > 0 ? Math.round((reconciledRecords / totalRecords) * 100) : 100
    };
    
    // Discrepancies
    const businessDiscrepancies = this.discrepancies.filter(d => d.businessId === businessId);
    const discrepancies = {
      count: businessDiscrepancies.length,
      totalAmount: businessDiscrepancies.reduce((sum, d) => sum + Math.abs(d.difference), 0),
      resolved: businessDiscrepancies.filter(d => d.status === 'resolved').length,
      unresolved: businessDiscrepancies.filter(d => d.status !== 'resolved').length
    };
    
    return {
      period: { startDate, endDate },
      businessId,
      businessName,
      customerPayouts,
      commissionEarnings,
      invoicePayments,
      processingFees,
      reconciliationStatus,
      discrepancies
    };
  }

  /**
   * Detect and create discrepancies
   */
  async detectDiscrepancies(): Promise<DiscrepancyRecord[]> {
    const newDiscrepancies: DiscrepancyRecord[] = [];
    
    // Group records by business and transaction
    const transactionGroups = new Map<string, ReconciliationRecord[]>();
    
    this.reconciliationRecords.forEach(record => {
      if (record.transactionId) {
        const key = `${record.businessId}-${record.transactionId}`;
        const group = transactionGroups.get(key) || [];
        group.push(record);
        transactionGroups.set(key, group);
      }
    });
    
    // Check for discrepancies in each group
    transactionGroups.forEach((records, key) => {
      const [businessId, transactionId] = key.split('-');
      
      // Check for amount mismatches
      const payoutRecords = records.filter(r => r.type === 'customer_payout');
      const commissionRecords = records.filter(r => r.type === 'commission_earned');
      
      if (payoutRecords.length > 1) {
        // Multiple payouts for same transaction
        const amounts = payoutRecords.map(r => r.amount);
        const uniqueAmounts = [...new Set(amounts)];
        
        if (uniqueAmounts.length > 1) {
          const discrepancy: DiscrepancyRecord = {
            id: this.generateDiscrepancyId(),
            date: new Date(),
            businessId,
            type: 'amount_mismatch',
            description: `Multiple payout amounts for transaction ${transactionId}`,
            expectedAmount: Math.max(...amounts),
            actualAmount: Math.min(...amounts),
            difference: Math.max(...amounts) - Math.min(...amounts),
            relatedRecords: payoutRecords.map(r => r.id),
            status: 'open',
            priority: 'medium',
            impact: 'moderate'
          };
          
          newDiscrepancies.push(discrepancy);
        }
      }
      
      // Check commission calculation accuracy
      if (payoutRecords.length === 1 && commissionRecords.length === 1) {
        const payout = payoutRecords[0];
        const commission = commissionRecords[0];
        
        // Estimate expected commission (assuming 15-20% rate)
        const estimatedCommission = payout.amount * 0.175; // Average rate
        const actualCommission = commission.amount;
        const difference = Math.abs(estimatedCommission - actualCommission);
        
        // Flag significant differences (>10%)
        if (difference > estimatedCommission * 0.1) {
          const discrepancy: DiscrepancyRecord = {
            id: this.generateDiscrepancyId(),
            date: new Date(),
            businessId,
            type: 'amount_mismatch',
            description: `Commission amount differs significantly from expected rate`,
            expectedAmount: estimatedCommission,
            actualAmount: actualCommission,
            difference: difference,
            relatedRecords: [payout.id, commission.id],
            status: 'open',
            priority: difference > 50 ? 'high' : 'medium',
            impact: difference > 100 ? 'significant' : 'moderate'
          };
          
          newDiscrepancies.push(discrepancy);
        }
      }
    });
    
    // Add new discrepancies
    this.discrepancies.push(...newDiscrepancies);
    
    console.log(`🔍 Detected ${newDiscrepancies.length} new discrepancies`);
    
    return newDiscrepancies;
  }

  /**
   * Generate test reconciliation data
   */
  async generateTestReconciliationData(): Promise<{
    records: ReconciliationRecord[];
    summaries: ReconciliationSummary[];
    discrepancies: DiscrepancyRecord[];
  }> {
    const testBusinesses = [
      { id: 'cafe-aurora-001', name: 'Aurora Café Stockholm' },
      { id: 'malmo-huset-002', name: 'Malmö Huset Restaurant' },
      { id: 'goteborg-store-003', name: 'Göteborg Department Store' }
    ];

    console.log('📊 Generating test reconciliation data...');
    
    const period = {
      startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      endDate: new Date()
    };
    
    for (const business of testBusinesses) {
      // Generate transactions for the month
      const transactionCount = Math.floor(Math.random() * 50) + 30; // 30-80 transactions
      
      for (let i = 0; i < transactionCount; i++) {
        const transactionId = `txn-${business.id}-${i.toString().padStart(3, '0')}`;
        const customerReward = Math.round((Math.random() * 200 + 10) * 100) / 100;
        const commissionRate = 0.15 + (Math.random() * 0.05); // 15-20%
        const commissionAmount = Math.round(customerReward * commissionRate * 100) / 100;
        const vatAmount = Math.round(commissionAmount * 0.25 * 100) / 100;
        
        // Customer payout
        await this.reconcileCustomerPayout(
          transactionId,
          business.id,
          customerReward,
          `stripe-${transactionId}`,
          'stripe'
        );
        
        // Commission earning
        await this.reconcileCommissionEarning(
          transactionId,
          business.id,
          commissionAmount,
          vatAmount,
          `api-${transactionId}`
        );
        
        // Processing fees
        const stripeFee = Math.round((customerReward * 0.029 + 0.30) * 100) / 100;
        await this.reconcileProcessingFee(
          transactionId,
          business.id,
          stripeFee,
          'stripe',
          `stripe-fee-${transactionId}`
        );
        
        const systemFee = Math.round(commissionAmount * 0.01 * 100) / 100;
        await this.reconcileProcessingFee(
          transactionId,
          business.id,
          systemFee,
          'system',
          `system-fee-${transactionId}`
        );
      }
      
      // Generate some invoice payments
      const invoiceCount = Math.floor(Math.random() * 3) + 1; // 1-3 invoices
      for (let i = 0; i < invoiceCount; i++) {
        const invoiceId = `inv-${business.id}-${i}`;
        const paymentAmount = Math.round((Math.random() * 5000 + 1000) * 100) / 100;
        
        await this.reconcileInvoicePayment(
          invoiceId,
          business.id,
          paymentAmount,
          'bank_transfer',
          `bank-${invoiceId}`
        );
      }
    }
    
    // Generate discrepancies
    await this.detectDiscrepancies();
    
    // Add some intentional discrepancies for testing
    for (let i = 0; i < 3; i++) {
      const business = testBusinesses[i];
      const testDiscrepancy: DiscrepancyRecord = {
        id: this.generateDiscrepancyId(),
        date: new Date(),
        businessId: business.id,
        type: 'timing_difference',
        description: `Test discrepancy: Payment timing difference`,
        expectedAmount: 100.00,
        actualAmount: 95.50,
        difference: 4.50,
        relatedRecords: [],
        status: 'open',
        priority: 'low',
        impact: 'minor'
      };
      
      this.discrepancies.push(testDiscrepancy);
    }
    
    // Generate summaries
    const summaries: ReconciliationSummary[] = [];
    for (const business of testBusinesses) {
      const summary = await this.generateReconciliationSummary(
        business.id,
        period.startDate,
        period.endDate,
        business.name
      );
      summaries.push(summary);
    }
    
    console.log(`✅ Generated reconciliation data:`);
    console.log(`📊 Records: ${this.reconciliationRecords.length}`);
    console.log(`📋 Summaries: ${summaries.length} businesses`);
    console.log(`⚠️  Discrepancies: ${this.discrepancies.length}`);
    
    return {
      records: this.reconciliationRecords,
      summaries,
      discrepancies: this.discrepancies
    };
  }

  /**
   * Get reconciliation statistics
   */
  async getReconciliationStats(): Promise<{
    totalRecords: number;
    reconciledRecords: number;
    reconciledPercentage: number;
    totalAmount: number;
    reconciledAmount: number;
    discrepancyCount: number;
    unresolvedDiscrepancies: number;
    processingFeeAccuracy: number;
  }> {
    const totalRecords = this.reconciliationRecords.length;
    const reconciledRecords = this.reconciliationRecords.filter(r => r.reconciled).length;
    const reconciledPercentage = totalRecords > 0 ? Math.round((reconciledRecords / totalRecords) * 100) : 100;
    
    const totalAmount = this.reconciliationRecords
      .filter(r => r.amount > 0)
      .reduce((sum, r) => sum + r.amount, 0);
    
    const reconciledAmount = this.reconciliationRecords
      .filter(r => r.reconciled && r.amount > 0)
      .reduce((sum, r) => sum + r.amount, 0);
    
    const discrepancyCount = this.discrepancies.length;
    const unresolvedDiscrepancies = this.discrepancies.filter(d => d.status !== 'resolved').length;
    
    // Calculate processing fee accuracy
    const feeRecords = this.reconciliationRecords.filter(r => r.type === 'processing_fee');
    const reconciledFees = feeRecords.filter(r => r.reconciled).length;
    const processingFeeAccuracy = feeRecords.length > 0 
      ? Math.round((reconciledFees / feeRecords.length) * 100) 
      : 100;

    return {
      totalRecords,
      reconciledRecords,
      reconciledPercentage,
      totalAmount,
      reconciledAmount,
      discrepancyCount,
      unresolvedDiscrepancies,
      processingFeeAccuracy
    };
  }

  /**
   * Export reconciliation data
   */
  async exportReconciliationData(
    startDate: Date,
    endDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    const records = this.reconciliationRecords.filter(
      r => r.date >= startDate && r.date <= endDate
    );

    if (format === 'csv') {
      const headers = [
        'ID',
        'Date',
        'Type',
        'Business ID',
        'Amount (SEK)',
        'Status',
        'Reconciled',
        'Source System',
        'Description'
      ];
      
      const rows = records.map(r => [
        r.id,
        r.date.toISOString().split('T')[0],
        r.type,
        r.businessId,
        r.amount.toFixed(2),
        r.status,
        r.reconciled ? 'Yes' : 'No',
        r.sourceSystem,
        r.description.replace(/,/g, ';') // Escape commas
      ]);
      
      return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    return JSON.stringify({
      period: { startDate, endDate },
      recordCount: records.length,
      records: records
    }, null, 2);
  }

  /**
   * Helper methods
   */
  private generateReconciliationId(): string {
    return `rec-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private generateDiscrepancyId(): string {
    return `disc-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}