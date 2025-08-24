/**
 * Comprehensive Audit Trail System - Complete Transaction and Security Logging
 * 
 * Provides enterprise-grade audit logging for all payment transactions,
 * security events, and compliance activities with Swedish regulatory compliance.
 * 
 * Features:
 * - Complete transaction lifecycle tracking
 * - Security event monitoring and logging
 * - Compliance audit trails (PCI DSS, GDPR, Swedish regulations)
 * - Real-time alerting and anomaly detection
 * - Comprehensive reporting and analytics
 */

interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  category: AuditCategory;
  severity: AuditSeverity;
  
  // Transaction context
  transactionId?: string;
  sessionId?: string;
  businessId?: string;
  customerId?: string;
  
  // User context
  userId?: string;
  userRole?: string;
  ipAddress: string;
  userAgent: string;
  
  // Event details
  action: string;
  resource: string;
  outcome: 'success' | 'failure' | 'warning';
  
  // Financial details
  amount?: number;
  currency?: string;
  commissionAmount?: number;
  
  // Technical details
  systemComponent: string;
  apiEndpoint?: string;
  responseTime?: number;
  errorCode?: string;
  errorMessage?: string;
  
  // Security details
  authenticationMethod?: string;
  securityLevel: SecurityLevel;
  riskScore?: number;
  fraudIndicators?: string[];
  
  // Compliance details
  pciCompliant: boolean;
  gdprCompliant: boolean;
  swedishRegulationCompliant: boolean;
  dataClassification: DataClassification;
  retentionPeriod: number; // Days
  
  // Context and metadata
  beforeState?: any;
  afterState?: any;
  additionalData?: { [key: string]: any };
  tags: string[];
  
  // Swedish specific
  swedishPersonalDataProcessed?: boolean;
  swedishTaxImplications?: boolean;
  swedishBankingRegulation?: boolean;
}

type AuditEventType = 
  | 'payment_processed' | 'payment_failed' | 'payment_refunded'
  | 'user_login' | 'user_logout' | 'user_access_denied'
  | 'data_access' | 'data_modification' | 'data_deletion'
  | 'security_violation' | 'fraud_detected' | 'suspicious_activity'
  | 'system_startup' | 'system_shutdown' | 'system_error'
  | 'compliance_check' | 'audit_export' | 'configuration_change'
  | 'key_rotation' | 'encryption_operation' | 'tokenization'
  | 'swedish_tax_calculation' | 'swedish_banking_operation';

type AuditCategory = 
  | 'financial' | 'security' | 'compliance' | 'operational' 
  | 'user_activity' | 'system' | 'fraud' | 'swedish_regulatory';

type AuditSeverity = 'low' | 'medium' | 'high' | 'critical';

type SecurityLevel = 'public' | 'internal' | 'confidential' | 'restricted' | 'top_secret';

type DataClassification = 'public' | 'internal' | 'sensitive' | 'highly_sensitive' | 'swedish_personal';

interface AuditQuery {
  startDate?: Date;
  endDate?: Date;
  eventTypes?: AuditEventType[];
  categories?: AuditCategory[];
  severities?: AuditSeverity[];
  businessId?: string;
  userId?: string;
  outcome?: 'success' | 'failure' | 'warning';
  tags?: string[];
  transactionId?: string;
  complianceStatus?: 'compliant' | 'non_compliant';
}

interface AuditReport {
  reportId: string;
  generatedAt: Date;
  period: { startDate: Date; endDate: Date };
  totalEvents: number;
  
  eventBreakdown: {
    byType: { [key: string]: number };
    byCategory: { [key: string]: number };
    bySeverity: { [key: string]: number };
    byOutcome: { [key: string]: number };
  };
  
  securityMetrics: {
    securityViolations: number;
    fraudAttempts: number;
    suspiciousActivities: number;
    averageRiskScore: number;
  };
  
  complianceMetrics: {
    pciComplianceRate: number;
    gdprComplianceRate: number;
    swedishComplianceRate: number;
    violations: number;
  };
  
  financialMetrics: {
    totalTransactions: number;
    totalAmount: number;
    totalCommissions: number;
    failedTransactions: number;
  };
  
  performanceMetrics: {
    averageResponseTime: number;
    errorRate: number;
    systemUptime: number;
  };
  
  swedishRegulatoryMetrics: {
    personalDataProcessingEvents: number;
    taxCalculationEvents: number;
    bankingOperationEvents: number;
    complianceViolations: number;
  };
  
  recommendedActions: string[];
  criticalAlerts: AuditEvent[];
}

export class ComprehensiveAuditTrail {
  private auditEvents: AuditEvent[] = [];
  private auditIndex: Map<string, Set<string>> = new Map(); // For fast queries
  private alertThresholds: Map<string, number> = new Map();
  private retentionPolicy: Map<DataClassification, number> = new Map();

  constructor() {
    this.initializeAuditSystem();
    console.log('📋 Comprehensive Audit Trail System initialized');
  }

  /**
   * Log audit event
   */
  async logAuditEvent(event: Omit<AuditEvent, 'id' | 'timestamp' | 'tags'> & { tags?: string[] }): Promise<string> {
    const auditEvent: AuditEvent = {
      id: this.generateAuditId(),
      timestamp: new Date(),
      tags: event.tags || [],
      ...event
    };

    // Store event
    this.auditEvents.push(auditEvent);

    // Update indexes for fast querying
    this.updateAuditIndexes(auditEvent);

    // Check for alerting conditions
    await this.checkAlertConditions(auditEvent);

    // Ensure compliance with retention policy
    await this.enforceRetentionPolicy();

    console.log(`📝 Audit logged: ${event.eventType} (${event.severity}) - ${event.action}`);
    
    return auditEvent.id;
  }

  /**
   * Log payment transaction event
   */
  async logPaymentTransaction(
    transactionId: string,
    businessId: string,
    amount: number,
    commissionAmount: number,
    outcome: 'success' | 'failure',
    details: {
      sessionId?: string;
      customerId?: string;
      userId?: string;
      ipAddress: string;
      responseTime?: number;
      errorMessage?: string;
      fraudRiskScore?: number;
    }
  ): Promise<string> {
    
    const eventType: AuditEventType = outcome === 'success' ? 'payment_processed' : 'payment_failed';
    const severity: AuditSeverity = outcome === 'failure' ? 'high' : 'low';
    
    return await this.logAuditEvent({
      eventType,
      category: 'financial',
      severity,
      transactionId,
      sessionId: details.sessionId,
      businessId,
      customerId: details.customerId,
      userId: details.userId,
      userRole: 'customer',
      ipAddress: details.ipAddress,
      userAgent: 'Payment-System',
      action: `Process payment transaction`,
      resource: 'payment_processor',
      outcome,
      amount,
      currency: 'SEK',
      commissionAmount,
      systemComponent: 'payment-handler',
      responseTime: details.responseTime,
      errorMessage: details.errorMessage,
      securityLevel: 'confidential',
      riskScore: details.fraudRiskScore,
      pciCompliant: true,
      gdprCompliant: true,
      swedishRegulationCompliant: true,
      dataClassification: 'sensitive',
      retentionPeriod: 2555, // 7 years Swedish requirement
      swedishTaxImplications: true,
      swedishBankingRegulation: true
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(
    eventType: AuditEventType,
    details: {
      userId?: string;
      ipAddress: string;
      action: string;
      outcome: 'success' | 'failure' | 'warning';
      riskScore?: number;
      fraudIndicators?: string[];
      errorMessage?: string;
      additionalData?: any;
    }
  ): Promise<string> {
    
    const severity: AuditSeverity = details.outcome === 'failure' ? 'high' : 
                                   details.outcome === 'warning' ? 'medium' : 'low';
    
    return await this.logAuditEvent({
      eventType,
      category: 'security',
      severity,
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: 'Security-System',
      action: details.action,
      resource: 'security_system',
      outcome: details.outcome,
      systemComponent: 'security-monitor',
      errorMessage: details.errorMessage,
      securityLevel: 'restricted',
      riskScore: details.riskScore,
      fraudIndicators: details.fraudIndicators,
      pciCompliant: true,
      gdprCompliant: true,
      swedishRegulationCompliant: true,
      dataClassification: 'highly_sensitive',
      retentionPeriod: 2555,
      additionalData: details.additionalData
    });
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    resource: string,
    action: string,
    userId: string,
    ipAddress: string,
    outcome: 'success' | 'failure',
    dataClassification: DataClassification,
    swedishPersonalData: boolean = false
  ): Promise<string> {
    
    return await this.logAuditEvent({
      eventType: 'data_access',
      category: 'compliance',
      severity: outcome === 'failure' ? 'medium' : 'low',
      userId,
      ipAddress,
      userAgent: 'Data-Access-System',
      action,
      resource,
      outcome,
      systemComponent: 'data-access-layer',
      securityLevel: dataClassification === 'swedish_personal' ? 'restricted' : 'confidential',
      pciCompliant: true,
      gdprCompliant: true,
      swedishRegulationCompliant: true,
      dataClassification,
      retentionPeriod: swedishPersonalData ? 2555 : 1825, // 7 years for Swedish personal data
      swedishPersonalDataProcessed: swedishPersonalData
    });
  }

  /**
   * Log Swedish regulatory event
   */
  async logSwedishRegulatoryEvent(
    eventType: AuditEventType,
    action: string,
    details: {
      businessId?: string;
      transactionId?: string;
      amount?: number;
      taxAmount?: number;
      bankingOperation?: string;
      personalDataProcessed?: boolean;
      ipAddress: string;
      userId?: string;
    }
  ): Promise<string> {
    
    return await this.logAuditEvent({
      eventType,
      category: 'swedish_regulatory',
      severity: 'medium',
      transactionId: details.transactionId,
      businessId: details.businessId,
      userId: details.userId,
      ipAddress: details.ipAddress,
      userAgent: 'Swedish-Regulatory-System',
      action,
      resource: 'swedish_compliance',
      outcome: 'success',
      amount: details.amount,
      currency: 'SEK',
      systemComponent: 'swedish-compliance',
      securityLevel: 'restricted',
      pciCompliant: true,
      gdprCompliant: true,
      swedishRegulationCompliant: true,
      dataClassification: 'swedish_personal',
      retentionPeriod: 2555,
      swedishPersonalDataProcessed: details.personalDataProcessed,
      swedishTaxImplications: !!details.taxAmount,
      swedishBankingRegulation: !!details.bankingOperation,
      additionalData: {
        taxAmount: details.taxAmount,
        bankingOperation: details.bankingOperation
      }
    });
  }

  /**
   * Query audit events
   */
  async queryAuditEvents(query: AuditQuery): Promise<AuditEvent[]> {
    let filteredEvents = this.auditEvents;

    // Apply filters
    if (query.startDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp >= query.startDate!);
    }

    if (query.endDate) {
      filteredEvents = filteredEvents.filter(event => event.timestamp <= query.endDate!);
    }

    if (query.eventTypes && query.eventTypes.length > 0) {
      filteredEvents = filteredEvents.filter(event => query.eventTypes!.includes(event.eventType));
    }

    if (query.categories && query.categories.length > 0) {
      filteredEvents = filteredEvents.filter(event => query.categories!.includes(event.category));
    }

    if (query.severities && query.severities.length > 0) {
      filteredEvents = filteredEvents.filter(event => query.severities!.includes(event.severity));
    }

    if (query.businessId) {
      filteredEvents = filteredEvents.filter(event => event.businessId === query.businessId);
    }

    if (query.userId) {
      filteredEvents = filteredEvents.filter(event => event.userId === query.userId);
    }

    if (query.outcome) {
      filteredEvents = filteredEvents.filter(event => event.outcome === query.outcome);
    }

    if (query.transactionId) {
      filteredEvents = filteredEvents.filter(event => event.transactionId === query.transactionId);
    }

    if (query.complianceStatus) {
      const isCompliant = query.complianceStatus === 'compliant';
      filteredEvents = filteredEvents.filter(event => 
        event.pciCompliant === isCompliant && 
        event.gdprCompliant === isCompliant && 
        event.swedishRegulationCompliant === isCompliant
      );
    }

    if (query.tags && query.tags.length > 0) {
      filteredEvents = filteredEvents.filter(event => 
        query.tags!.some(tag => event.tags.includes(tag))
      );
    }

    return filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Generate comprehensive audit report
   */
  async generateAuditReport(
    startDate: Date,
    endDate: Date,
    includeRecommendations: boolean = true
  ): Promise<AuditReport> {
    
    const events = await this.queryAuditEvents({ startDate, endDate });
    const reportId = `audit_report_${Date.now()}`;

    // Calculate event breakdown
    const eventBreakdown = {
      byType: this.calculateBreakdown(events, 'eventType'),
      byCategory: this.calculateBreakdown(events, 'category'),
      bySeverity: this.calculateBreakdown(events, 'severity'),
      byOutcome: this.calculateBreakdown(events, 'outcome')
    };

    // Calculate security metrics
    const securityEvents = events.filter(e => e.category === 'security');
    const securityMetrics = {
      securityViolations: securityEvents.filter(e => e.eventType === 'security_violation').length,
      fraudAttempts: securityEvents.filter(e => e.eventType === 'fraud_detected').length,
      suspiciousActivities: securityEvents.filter(e => e.eventType === 'suspicious_activity').length,
      averageRiskScore: this.calculateAverageRiskScore(securityEvents)
    };

    // Calculate compliance metrics
    const totalEvents = events.length || 1;
    const complianceMetrics = {
      pciComplianceRate: (events.filter(e => e.pciCompliant).length / totalEvents) * 100,
      gdprComplianceRate: (events.filter(e => e.gdprCompliant).length / totalEvents) * 100,
      swedishComplianceRate: (events.filter(e => e.swedishRegulationCompliant).length / totalEvents) * 100,
      violations: events.filter(e => !e.pciCompliant || !e.gdprCompliant || !e.swedishRegulationCompliant).length
    };

    // Calculate financial metrics
    const paymentEvents = events.filter(e => e.category === 'financial');
    const financialMetrics = {
      totalTransactions: paymentEvents.filter(e => e.eventType === 'payment_processed').length,
      totalAmount: paymentEvents.reduce((sum, e) => sum + (e.amount || 0), 0),
      totalCommissions: paymentEvents.reduce((sum, e) => sum + (e.commissionAmount || 0), 0),
      failedTransactions: paymentEvents.filter(e => e.eventType === 'payment_failed').length
    };

    // Calculate performance metrics
    const eventsWithResponseTime = events.filter(e => e.responseTime !== undefined);
    const performanceMetrics = {
      averageResponseTime: eventsWithResponseTime.length > 0 ?
        eventsWithResponseTime.reduce((sum, e) => sum + (e.responseTime || 0), 0) / eventsWithResponseTime.length : 0,
      errorRate: (events.filter(e => e.outcome === 'failure').length / totalEvents) * 100,
      systemUptime: 99.9 // Mock value
    };

    // Calculate Swedish regulatory metrics
    const swedishEvents = events.filter(e => e.category === 'swedish_regulatory');
    const swedishRegulatoryMetrics = {
      personalDataProcessingEvents: events.filter(e => e.swedishPersonalDataProcessed).length,
      taxCalculationEvents: events.filter(e => e.swedishTaxImplications).length,
      bankingOperationEvents: events.filter(e => e.swedishBankingRegulation).length,
      complianceViolations: events.filter(e => !e.swedishRegulationCompliant).length
    };

    // Generate recommendations
    const recommendedActions = includeRecommendations ? this.generateRecommendations({
      securityMetrics,
      complianceMetrics,
      performanceMetrics,
      swedishRegulatoryMetrics
    }) : [];

    // Get critical alerts
    const criticalAlerts = events.filter(e => e.severity === 'critical').slice(0, 10);

    return {
      reportId,
      generatedAt: new Date(),
      period: { startDate, endDate },
      totalEvents: events.length,
      eventBreakdown,
      securityMetrics,
      complianceMetrics,
      financialMetrics,
      performanceMetrics,
      swedishRegulatoryMetrics,
      recommendedActions,
      criticalAlerts
    };
  }

  /**
   * Generate test audit data
   */
  async generateTestAuditData(): Promise<{
    totalEvents: number;
    eventsByCategory: { [key: string]: number };
    securityEvents: number;
    complianceViolations: number;
  }> {
    
    const testBusinesses = ['cafe-aurora-001', 'malmo-huset-002', 'goteborg-store-003'];
    const testUsers = ['admin-test-001', 'finance-test-001', 'customer-001', 'customer-002'];
    
    console.log('📋 Generating comprehensive test audit data...');

    // Generate payment transactions
    for (let i = 0; i < 100; i++) {
      const businessId = testBusinesses[Math.floor(Math.random() * testBusinesses.length)];
      const customerId = testUsers[Math.floor(Math.random() * testUsers.length)];
      const amount = Math.round((Math.random() * 200 + 10) * 100) / 100;
      const commission = Math.round(amount * 0.17 * 100) / 100;
      const outcome = Math.random() > 0.95 ? 'failure' : 'success';

      await this.logPaymentTransaction(
        `txn-${Date.now()}-${i}`,
        businessId,
        amount,
        commission,
        outcome,
        {
          sessionId: `session-${i}`,
          customerId,
          userId: 'system',
          ipAddress: `192.168.1.${Math.floor(Math.random() * 255)}`,
          responseTime: Math.floor(Math.random() * 1000) + 100,
          errorMessage: outcome === 'failure' ? 'Payment processing failed' : undefined,
          fraudRiskScore: Math.random() * 100
        }
      );
    }

    // Generate security events
    for (let i = 0; i < 25; i++) {
      const eventTypes: AuditEventType[] = ['user_login', 'user_access_denied', 'fraud_detected', 'suspicious_activity'];
      const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const userId = testUsers[Math.floor(Math.random() * testUsers.length)];
      
      await this.logSecurityEvent(eventType, {
        userId,
        ipAddress: `10.0.0.${Math.floor(Math.random() * 255)}`,
        action: `Security event: ${eventType}`,
        outcome: Math.random() > 0.8 ? 'failure' : 'success',
        riskScore: Math.random() * 100,
        fraudIndicators: Math.random() > 0.7 ? ['unusual_location', 'high_velocity'] : []
      });
    }

    // Generate data access events
    for (let i = 0; i < 50; i++) {
      const userId = testUsers[Math.floor(Math.random() * testUsers.length)];
      const resources = ['payment_data', 'customer_data', 'business_data', 'swedish_personal_data'];
      const resource = resources[Math.floor(Math.random() * resources.length)];
      
      await this.logDataAccess(
        resource,
        'Read sensitive data',
        userId,
        `172.16.0.${Math.floor(Math.random() * 255)}`,
        Math.random() > 0.95 ? 'failure' : 'success',
        resource === 'swedish_personal_data' ? 'swedish_personal' : 'sensitive',
        resource === 'swedish_personal_data'
      );
    }

    // Generate Swedish regulatory events
    for (let i = 0; i < 30; i++) {
      const businessId = testBusinesses[Math.floor(Math.random() * testBusinesses.length)];
      const amount = Math.round((Math.random() * 1000 + 100) * 100) / 100;
      
      await this.logSwedishRegulatoryEvent(
        'swedish_tax_calculation',
        'Calculate Swedish VAT',
        {
          businessId,
          transactionId: `tax-${Date.now()}-${i}`,
          amount,
          taxAmount: Math.round(amount * 0.25 * 100) / 100,
          personalDataProcessed: Math.random() > 0.5,
          ipAddress: '127.0.0.1',
          userId: 'tax-system'
        }
      );
    }

    const eventsByCategory = this.calculateBreakdown(this.auditEvents, 'category');
    const securityEvents = this.auditEvents.filter(e => e.category === 'security').length;
    const complianceViolations = this.auditEvents.filter(e => 
      !e.pciCompliant || !e.gdprCompliant || !e.swedishRegulationCompliant
    ).length;

    console.log(`✅ Generated ${this.auditEvents.length} audit events`);
    console.log(`🔒 Security events: ${securityEvents}`);
    console.log(`⚠️  Compliance violations: ${complianceViolations}`);

    return {
      totalEvents: this.auditEvents.length,
      eventsByCategory,
      securityEvents,
      complianceViolations
    };
  }

  /**
   * Private helper methods
   */
  private initializeAuditSystem(): void {
    // Set alert thresholds
    this.alertThresholds.set('fraud_detected', 5);
    this.alertThresholds.set('security_violation', 3);
    this.alertThresholds.set('payment_failed', 10);

    // Set retention policies (in days)
    this.retentionPolicy.set('public', 365);
    this.retentionPolicy.set('internal', 1095);
    this.retentionPolicy.set('sensitive', 2190);
    this.retentionPolicy.set('highly_sensitive', 2555);
    this.retentionPolicy.set('swedish_personal', 2555); // 7 years Swedish requirement
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  private updateAuditIndexes(event: AuditEvent): void {
    // Update event type index
    const typeKey = `type:${event.eventType}`;
    if (!this.auditIndex.has(typeKey)) {
      this.auditIndex.set(typeKey, new Set());
    }
    this.auditIndex.get(typeKey)!.add(event.id);

    // Update business index
    if (event.businessId) {
      const businessKey = `business:${event.businessId}`;
      if (!this.auditIndex.has(businessKey)) {
        this.auditIndex.set(businessKey, new Set());
      }
      this.auditIndex.get(businessKey)!.add(event.id);
    }
  }

  private async checkAlertConditions(event: AuditEvent): Promise<void> {
    if (event.severity === 'critical') {
      console.log(`🚨 CRITICAL ALERT: ${event.eventType} - ${event.action}`);
    }

    // Check for threshold violations
    const threshold = this.alertThresholds.get(event.eventType);
    if (threshold) {
      const recentEvents = this.auditEvents.filter(e => 
        e.eventType === event.eventType && 
        Date.now() - e.timestamp.getTime() < 60 * 60 * 1000 // Last hour
      );

      if (recentEvents.length >= threshold) {
        console.log(`⚠️  THRESHOLD ALERT: ${event.eventType} exceeded threshold (${recentEvents.length}/${threshold})`);
      }
    }
  }

  private async enforceRetentionPolicy(): Promise<void> {
    const now = Date.now();
    const eventsToRemove: string[] = [];

    this.auditEvents.forEach(event => {
      const retentionDays = this.retentionPolicy.get(event.dataClassification) || 365;
      const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
      
      if (now - event.timestamp.getTime() > retentionMs) {
        eventsToRemove.push(event.id);
      }
    });

    // Remove expired events
    this.auditEvents = this.auditEvents.filter(event => !eventsToRemove.includes(event.id));

    if (eventsToRemove.length > 0) {
      console.log(`🗑️  Removed ${eventsToRemove.length} expired audit events`);
    }
  }

  private calculateBreakdown(events: AuditEvent[], field: keyof AuditEvent): { [key: string]: number } {
    const breakdown: { [key: string]: number } = {};
    events.forEach(event => {
      const value = String(event[field]);
      breakdown[value] = (breakdown[value] || 0) + 1;
    });
    return breakdown;
  }

  private calculateAverageRiskScore(events: AuditEvent[]): number {
    const eventsWithRisk = events.filter(e => e.riskScore !== undefined);
    if (eventsWithRisk.length === 0) return 0;
    
    return eventsWithRisk.reduce((sum, e) => sum + (e.riskScore || 0), 0) / eventsWithRisk.length;
  }

  private generateRecommendations(metrics: {
    securityMetrics: any;
    complianceMetrics: any;
    performanceMetrics: any;
    swedishRegulatoryMetrics: any;
  }): string[] {
    const recommendations: string[] = [];

    if (metrics.securityMetrics.fraudAttempts > 10) {
      recommendations.push('Increase fraud detection sensitivity and implement additional verification steps');
    }

    if (metrics.complianceMetrics.pciComplianceRate < 95) {
      recommendations.push('Review and remediate PCI DSS compliance violations');
    }

    if (metrics.complianceMetrics.swedishComplianceRate < 95) {
      recommendations.push('Address Swedish regulatory compliance issues');
    }

    if (metrics.performanceMetrics.errorRate > 5) {
      recommendations.push('Investigate and reduce system error rate');
    }

    if (metrics.swedishRegulatoryMetrics.complianceViolations > 0) {
      recommendations.push('Implement additional Swedish regulatory controls');
    }

    return recommendations;
  }
}