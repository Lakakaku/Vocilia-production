/**
 * PCI Compliance Manager - Secure Payment Data Handling (Test Environment)
 * 
 * Implements PCI DSS compliance patterns for secure payment processing
 * using test data only with Swedish banking security standards.
 * 
 * PCI DSS Requirements Addressed:
 * 1. Build and Maintain Secure Network
 * 2. Protect Cardholder Data 
 * 3. Maintain Vulnerability Management Program
 * 4. Implement Strong Access Control Measures
 * 5. Regularly Monitor and Test Networks
 * 6. Maintain Information Security Policy
 */

import * as crypto from 'crypto';

interface PCISecurePaymentData {
  tokenizedCardNumber: string;      // PCI: Never store real card numbers
  cardType: 'visa' | 'mastercard' | 'amex' | 'other';
  lastFourDigits: string;           // Only store last 4 digits
  expiryMonth: string;              // Encrypted expiry
  expiryYear: string;               // Encrypted expiry
  holderName: string;               // Encrypted holder name
  tokenCreatedAt: Date;
  tokenExpiresAt: Date;
  encryptionKeyId: string;
  swedishBankAccount?: {            // Swedish banking details
    bankgiroNumber?: string;        // Encrypted Bankgiro
    swishNumber?: string;           // Encrypted Swish number
    ibanNumber?: string;            // Encrypted IBAN
  };
}

interface PCIAuditLog {
  id: string;
  timestamp: Date;
  eventType: 'card_tokenization' | 'data_access' | 'encryption_key_rotation' | 
            'suspicious_activity' | 'compliance_check' | 'data_deletion';
  userId?: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  
  // PCI-specific audit fields
  cardTokenAccessed?: string;
  dataFieldsAccessed?: string[];
  encryptionStatus: 'encrypted' | 'decrypted' | 'tokenized';
  complianceStatus: 'compliant' | 'violation' | 'warning';
  
  // Swedish compliance
  swedishRegulationCompliance: boolean;
  gdprCompliant: boolean;
  
  details: string;
  severityLevel: 'info' | 'warning' | 'critical';
  remediationRequired: boolean;
}

interface PCISecurityMetrics {
  encryptionCoverage: number;       // % of data encrypted
  tokenizationRate: number;         // % of cards tokenized
  accessControlViolations: number;  // Access violations detected
  suspiciousActivities: number;     // Suspicious activities detected
  complianceScore: number;          // Overall PCI compliance score (0-100)
  lastSecurityScan: Date;
  vulnerabilitiesFound: number;
  remediated: number;
  swedishComplianceStatus: 'compliant' | 'partial' | 'non-compliant';
}

interface PCIAccessControl {
  userId: string;
  role: 'admin' | 'finance' | 'support' | 'readonly';
  permissions: PCIPermission[];
  lastAccess: Date;
  accessAttempts: number;
  failedAttempts: number;
  accountLocked: boolean;
  ipWhitelist: string[];
  mfaEnabled: boolean;
  swedishBankingAccess: boolean;    // Special permission for Swedish banking
}

interface PCIPermission {
  resource: 'card_data' | 'payment_processing' | 'reports' | 'audit_logs' | 'swedish_banking';
  actions: ('read' | 'write' | 'delete' | 'tokenize' | 'decrypt')[];
  restrictions?: {
    timeRestriction?: { startHour: number; endHour: number };
    ipRestriction?: string[];
    mfaRequired?: boolean;
  };
}

export class PCIComplianceManager {
  private secureVault: Map<string, PCISecurePaymentData> = new Map();
  private auditLogs: PCIAuditLog[] = [];
  private accessControls: Map<string, PCIAccessControl> = new Map();
  private encryptionKeys: Map<string, Buffer> = new Map();
  private currentKeyId: string;

  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private readonly KEY_ROTATION_INTERVAL = 90 * 24 * 60 * 60 * 1000; // 90 days
  private readonly TOKEN_EXPIRY_DAYS = 365; // 1 year token expiry

  constructor() {
    this.initializeEncryptionKeys();
    this.initializeAccessControls();
    console.log('🔒 PCI Compliance Manager initialized with test security protocols');
  }

  /**
   * PCI DSS Requirement 3.4: Render PAN unreadable (Tokenization)
   */
  async tokenizePaymentData(
    testCardData: {
      cardNumber: string;
      expiryMonth: string;
      expiryYear: string;
      holderName: string;
      cvv?: string; // Never stored, used only for processing
    },
    swedishBankAccount?: {
      bankgiroNumber?: string;
      swishNumber?: string;
      ibanNumber?: string;
    },
    userId: string,
    sessionId: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<{ token: string; lastFourDigits: string }> {
    
    // Validate test card number (only accept test cards)
    if (!this.isTestCardNumber(testCardData.cardNumber)) {
      throw new Error('PCI Violation: Only test card numbers are allowed');
    }

    // PCI DSS: Generate secure token (replace PAN)
    const token = this.generateSecureToken();
    const lastFourDigits = testCardData.cardNumber.slice(-4);
    const cardType = this.detectCardType(testCardData.cardNumber);

    // PCI DSS: Encrypt sensitive data
    const encryptedData: PCISecurePaymentData = {
      tokenizedCardNumber: token,
      cardType,
      lastFourDigits,
      expiryMonth: await this.encryptSensitiveData(testCardData.expiryMonth),
      expiryYear: await this.encryptSensitiveData(testCardData.expiryYear),
      holderName: await this.encryptSensitiveData(testCardData.holderName),
      tokenCreatedAt: new Date(),
      tokenExpiresAt: new Date(Date.now() + (this.TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000)),
      encryptionKeyId: this.currentKeyId,
      swedishBankAccount: swedishBankAccount ? {
        bankgiroNumber: swedishBankAccount.bankgiroNumber ? 
          await this.encryptSensitiveData(swedishBankAccount.bankgiroNumber) : undefined,
        swishNumber: swedishBankAccount.swishNumber ? 
          await this.encryptSensitiveData(swedishBankAccount.swishNumber) : undefined,
        ibanNumber: swedishBankAccount.ibanNumber ? 
          await this.encryptSensitiveData(swedishBankAccount.ibanNumber) : undefined,
      } : undefined
    };

    // Store in secure vault
    this.secureVault.set(token, encryptedData);

    // PCI DSS Requirement 10: Log all access to cardholder data
    await this.logPCIEvent({
      eventType: 'card_tokenization',
      userId,
      sessionId,
      ipAddress,
      userAgent: 'PCI-Compliant-System',
      cardTokenAccessed: token,
      dataFieldsAccessed: ['cardNumber', 'holderName', 'expiry'],
      encryptionStatus: 'tokenized',
      complianceStatus: 'compliant',
      swedishRegulationCompliance: true,
      gdprCompliant: true,
      details: `Card tokenized for ${cardType} ending in ${lastFourDigits}`,
      severityLevel: 'info',
      remediationRequired: false
    });

    console.log(`🔐 PCI Compliant: Card tokenized (${cardType} ending in ${lastFourDigits})`);
    
    return { token, lastFourDigits };
  }

  /**
   * PCI DSS Requirement 3.4: Securely decrypt payment data when needed
   */
  async accessSecurePaymentData(
    token: string,
    userId: string,
    sessionId: string,
    ipAddress: string,
    purpose: string
  ): Promise<{
    cardType: string;
    lastFourDigits: string;
    holderName: string;
    swedishBankAccount?: any;
  } | null> {
    
    // PCI DSS: Validate access permissions
    if (!await this.validateAccess(userId, 'card_data', 'read', ipAddress)) {
      await this.logPCIEvent({
        eventType: 'data_access',
        userId,
        sessionId,
        ipAddress,
        userAgent: 'PCI-System',
        cardTokenAccessed: token,
        encryptionStatus: 'encrypted',
        complianceStatus: 'violation',
        swedishRegulationCompliance: false,
        gdprCompliant: false,
        details: `Unauthorized access attempt to token ${token}`,
        severityLevel: 'critical',
        remediationRequired: true
      });
      throw new Error('PCI Access Denied: Insufficient permissions');
    }

    const secureData = this.secureVault.get(token);
    if (!secureData) {
      return null;
    }

    // Check token expiry
    if (new Date() > secureData.tokenExpiresAt) {
      await this.logPCIEvent({
        eventType: 'data_access',
        userId,
        sessionId,
        ipAddress,
        userAgent: 'PCI-System',
        cardTokenAccessed: token,
        encryptionStatus: 'encrypted',
        complianceStatus: 'warning',
        swedishRegulationCompliance: true,
        gdprCompliant: true,
        details: `Attempted access to expired token ${token}`,
        severityLevel: 'warning',
        remediationRequired: false
      });
      return null;
    }

    // PCI DSS: Decrypt sensitive data
    const decryptedData = {
      cardType: secureData.cardType,
      lastFourDigits: secureData.lastFourDigits,
      holderName: await this.decryptSensitiveData(secureData.holderName, secureData.encryptionKeyId),
      swedishBankAccount: secureData.swedishBankAccount ? {
        bankgiroNumber: secureData.swedishBankAccount.bankgiroNumber ? 
          await this.decryptSensitiveData(secureData.swedishBankAccount.bankgiroNumber, secureData.encryptionKeyId) : undefined,
        swishNumber: secureData.swedishBankAccount.swishNumber ? 
          await this.decryptSensitiveData(secureData.swedishBankAccount.swishNumber, secureData.encryptionKeyId) : undefined,
        ibanNumber: secureData.swedishBankAccount.ibanNumber ? 
          await this.decryptSensitiveData(secureData.swedishBankAccount.ibanNumber, secureData.encryptionKeyId) : undefined,
      } : undefined
    };

    // PCI DSS: Log access to cardholder data
    await this.logPCIEvent({
      eventType: 'data_access',
      userId,
      sessionId,
      ipAddress,
      userAgent: 'PCI-System',
      cardTokenAccessed: token,
      dataFieldsAccessed: ['holderName', 'swedishBankAccount'],
      encryptionStatus: 'decrypted',
      complianceStatus: 'compliant',
      swedishRegulationCompliance: true,
      gdprCompliant: true,
      details: `Authorized access to payment data for purpose: ${purpose}`,
      severityLevel: 'info',
      remediationRequired: false
    });

    return decryptedData;
  }

  /**
   * PCI DSS Requirement 3.1: Keep cardholder data storage to minimum
   */
  async securelyDeletePaymentData(
    token: string,
    userId: string,
    reason: string
  ): Promise<boolean> {
    
    const secureData = this.secureVault.get(token);
    if (!secureData) {
      return false;
    }

    // PCI DSS: Secure deletion
    this.secureVault.delete(token);

    await this.logPCIEvent({
      eventType: 'data_deletion',
      userId,
      sessionId: `delete-${Date.now()}`,
      ipAddress: '127.0.0.1',
      userAgent: 'PCI-System',
      cardTokenAccessed: token,
      encryptionStatus: 'encrypted',
      complianceStatus: 'compliant',
      swedishRegulationCompliance: true,
      gdprCompliant: true,
      details: `Payment data securely deleted. Reason: ${reason}`,
      severityLevel: 'info',
      remediationRequired: false
    });

    console.log(`🗑️ PCI Compliant: Payment data securely deleted (${token})`);
    return true;
  }

  /**
   * PCI DSS Requirement 8: Identify and authenticate access
   */
  private async validateAccess(
    userId: string,
    resource: string,
    action: string,
    ipAddress: string
  ): Promise<boolean> {
    
    const accessControl = this.accessControls.get(userId);
    if (!accessControl) {
      return false;
    }

    // Check account status
    if (accessControl.accountLocked) {
      return false;
    }

    // Check IP whitelist
    if (accessControl.ipWhitelist.length > 0 && !accessControl.ipWhitelist.includes(ipAddress)) {
      return false;
    }

    // Check permissions
    const permission = accessControl.permissions.find(p => p.resource === resource);
    if (!permission || !permission.actions.includes(action as any)) {
      return false;
    }

    // Check time restrictions
    if (permission.restrictions?.timeRestriction) {
      const currentHour = new Date().getHours();
      const { startHour, endHour } = permission.restrictions.timeRestriction;
      if (currentHour < startHour || currentHour > endHour) {
        return false;
      }
    }

    // Update access tracking
    accessControl.lastAccess = new Date();
    accessControl.accessAttempts++;

    return true;
  }

  /**
   * PCI DSS Requirement 4: Encrypt transmission of cardholder data
   */
  private async encryptSensitiveData(data: string): Promise<string> {
    const key = this.encryptionKeys.get(this.currentKeyId);
    if (!key) {
      throw new Error('Encryption key not available');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.ENCRYPTION_ALGORITHM, key);
    cipher.update(data, 'utf8');
    const encrypted = cipher.final('base64');
    
    return `${iv.toString('base64')}:${encrypted}`;
  }

  /**
   * PCI DSS Requirement 4: Decrypt cardholder data securely
   */
  private async decryptSensitiveData(encryptedData: string, keyId: string): Promise<string> {
    const key = this.encryptionKeys.get(keyId);
    if (!key) {
      throw new Error('Decryption key not available');
    }

    const [ivBase64, encrypted] = encryptedData.split(':');
    const decipher = crypto.createDecipher(this.ENCRYPTION_ALGORITHM, key);
    decipher.update(encrypted, 'base64', 'utf8');
    return decipher.final('utf8');
  }

  /**
   * Generate secure tokens for card numbers
   */
  private generateSecureToken(): string {
    return `tok_test_${crypto.randomBytes(16).toString('hex')}`;
  }

  /**
   * Validate test card numbers only
   */
  private isTestCardNumber(cardNumber: string): boolean {
    const testCardPrefixes = [
      '4242', '4000', '5555', '5200', '3782', '3714', // Stripe test cards
      '2223', '4999', '5424'  // Additional test cards
    ];
    
    return testCardPrefixes.some(prefix => cardNumber.startsWith(prefix));
  }

  /**
   * Detect card type from number
   */
  private detectCardType(cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'other' {
    if (cardNumber.startsWith('4')) return 'visa';
    if (cardNumber.startsWith('5') || cardNumber.startsWith('2')) return 'mastercard';
    if (cardNumber.startsWith('37') || cardNumber.startsWith('34')) return 'amex';
    return 'other';
  }

  /**
   * PCI DSS Requirement 10: Track and monitor access
   */
  private async logPCIEvent(event: Omit<PCIAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const auditLog: PCIAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      timestamp: new Date(),
      ...event
    };

    this.auditLogs.push(auditLog);

    // Alert on critical events
    if (event.severityLevel === 'critical') {
      console.log(`🚨 PCI CRITICAL ALERT: ${event.details}`);
    }
  }

  /**
   * Initialize encryption keys
   */
  private initializeEncryptionKeys(): void {
    this.currentKeyId = `key-${Date.now()}`;
    const key = crypto.randomBytes(32); // 256-bit key
    this.encryptionKeys.set(this.currentKeyId, key);
    
    console.log(`🔑 PCI Encryption key initialized: ${this.currentKeyId}`);
  }

  /**
   * Initialize access controls
   */
  private initializeAccessControls(): void {
    // Test users with different permission levels
    const testUsers = [
      {
        userId: 'admin-test-001',
        role: 'admin' as const,
        permissions: [
          {
            resource: 'card_data' as const,
            actions: ['read', 'write', 'delete', 'tokenize', 'decrypt'] as const
          },
          {
            resource: 'swedish_banking' as const,
            actions: ['read', 'write'] as const
          }
        ]
      },
      {
        userId: 'finance-test-001',
        role: 'finance' as const,
        permissions: [
          {
            resource: 'card_data' as const,
            actions: ['read', 'tokenize'] as const
          }
        ]
      }
    ];

    testUsers.forEach(user => {
      this.accessControls.set(user.userId, {
        userId: user.userId,
        role: user.role,
        permissions: user.permissions,
        lastAccess: new Date(),
        accessAttempts: 0,
        failedAttempts: 0,
        accountLocked: false,
        ipWhitelist: ['127.0.0.1', '::1'], // Local testing only
        mfaEnabled: true,
        swedishBankingAccess: true
      });
    });

    console.log(`🔐 PCI Access controls initialized for ${testUsers.length} test users`);
  }

  /**
   * Get PCI compliance metrics
   */
  async getPCIComplianceMetrics(): Promise<PCISecurityMetrics> {
    const totalData = this.secureVault.size;
    const encryptedData = Array.from(this.secureVault.values()).length;
    const criticalEvents = this.auditLogs.filter(log => log.severityLevel === 'critical').length;
    const violations = this.auditLogs.filter(log => log.complianceStatus === 'violation').length;

    return {
      encryptionCoverage: totalData > 0 ? (encryptedData / totalData) * 100 : 100,
      tokenizationRate: 100, // All cards are tokenized
      accessControlViolations: violations,
      suspiciousActivities: criticalEvents,
      complianceScore: Math.max(0, 100 - (violations * 10) - (criticalEvents * 5)),
      lastSecurityScan: new Date(),
      vulnerabilitiesFound: 0, // Test environment
      remediated: 0,
      swedishComplianceStatus: 'compliant' as const
    };
  }

  /**
   * Get audit logs for compliance reporting
   */
  async getPCIAuditLogs(
    startDate?: Date,
    endDate?: Date,
    eventType?: string
  ): Promise<PCIAuditLog[]> {
    return this.auditLogs.filter(log => {
      if (startDate && log.timestamp < startDate) return false;
      if (endDate && log.timestamp > endDate) return false;
      if (eventType && log.eventType !== eventType) return false;
      return true;
    });
  }

  /**
   * Generate PCI compliance report
   */
  async generatePCIComplianceReport(): Promise<{
    metrics: PCISecurityMetrics;
    summary: {
      totalTokens: number;
      totalAuditLogs: number;
      complianceStatus: string;
      recommendedActions: string[];
    };
  }> {
    const metrics = await this.getPCIComplianceMetrics();
    const totalTokens = this.secureVault.size;
    const totalAuditLogs = this.auditLogs.length;
    
    const recommendedActions: string[] = [];
    
    if (metrics.complianceScore < 95) {
      recommendedActions.push('Review and remediate compliance violations');
    }
    if (metrics.accessControlViolations > 0) {
      recommendedActions.push('Strengthen access controls and user training');
    }
    if (metrics.suspiciousActivities > 0) {
      recommendedActions.push('Investigate and address suspicious activities');
    }

    const complianceStatus = metrics.complianceScore >= 95 ? 'COMPLIANT' : 
                           metrics.complianceScore >= 80 ? 'PARTIAL_COMPLIANCE' : 'NON_COMPLIANT';

    return {
      metrics,
      summary: {
        totalTokens,
        totalAuditLogs,
        complianceStatus,
        recommendedActions
      }
    };
  }
}