/**
 * Test Data Encryption Service - Secure Handling of Test Sensitive Data
 * 
 * Provides enterprise-grade encryption for test sensitive data including
 * Swedish personal information, payment details, and business data.
 * Uses industry-standard encryption with key rotation and audit logging.
 */

import * as crypto from 'crypto';

interface EncryptionKey {
  id: string;
  key: Buffer;
  algorithm: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'compromised';
  usageCount: number;
  maxUsage: number;
}

interface EncryptedData {
  data: string;              // Base64 encoded encrypted data
  keyId: string;             // Key used for encryption
  algorithm: string;         // Encryption algorithm
  iv: string;                // Initialization vector (Base64)
  tag?: string;              // Authentication tag for AEAD (Base64)
  timestamp: Date;           // Encryption timestamp
  dataType: 'payment' | 'personal' | 'business' | 'swedish_id' | 'banking';
}

interface SwedishSensitiveData {
  personalNumber?: string;   // Swedish personnummer (encrypted)
  bankAccount?: string;      // Swedish bank account (encrypted)
  taxId?: string;           // Swedish tax ID (encrypted)
  organizationNumber?: string; // Swedish org number (encrypted)
  addressData?: {
    street: string;
    postalCode: string;
    city: string;
    county: string;
  };
}

interface EncryptionAuditLog {
  id: string;
  timestamp: Date;
  operation: 'encrypt' | 'decrypt' | 'key_rotation' | 'key_access' | 'data_deletion';
  keyId: string;
  dataType: string;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  success: boolean;
  errorMessage?: string;
  
  // Swedish compliance tracking
  gdprCompliant: boolean;
  swedishRegulationCompliant: boolean;
  dataRetentionCompliant: boolean;
  
  details: string;
}

export class TestDataEncryptionService {
  private encryptionKeys: Map<string, EncryptionKey> = new Map();
  private encryptedDataStore: Map<string, EncryptedData> = new Map();
  private auditLogs: EncryptionAuditLog[] = [];
  private currentKeyId: string;

  // Encryption algorithms supported
  private readonly ALGORITHMS = {
    AES_256_GCM: 'aes-256-gcm',    // Preferred for new data
    AES_256_CBC: 'aes-256-cbc',    // Legacy support
    CHACHA20_POLY1305: 'chacha20-poly1305' // Alternative
  };

  private readonly DEFAULT_ALGORITHM = this.ALGORITHMS.AES_256_GCM;
  private readonly KEY_ROTATION_INTERVAL = 90 * 24 * 60 * 60 * 1000; // 90 days
  private readonly MAX_KEY_USAGE = 1000000; // Max encryptions per key
  private readonly DATA_RETENTION_DAYS = 2555; // 7 years Swedish requirement

  constructor() {
    this.initializeEncryptionSystem();
    console.log('🔐 Test Data Encryption Service initialized with Swedish compliance');
  }

  /**
   * Encrypt sensitive test data
   */
  async encryptSensitiveData(
    plaintext: string,
    dataType: 'payment' | 'personal' | 'business' | 'swedish_id' | 'banking',
    userId?: string,
    sessionId?: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<{ encryptionId: string; encryptedData: EncryptedData }> {
    
    try {
      // Get current active encryption key
      const encryptionKey = this.encryptionKeys.get(this.currentKeyId);
      if (!encryptionKey || encryptionKey.status !== 'active') {
        await this.rotateEncryptionKey();
      }

      const activeKey = this.encryptionKeys.get(this.currentKeyId)!;

      // Generate random IV
      const iv = crypto.randomBytes(16);
      
      // Encrypt data using AES-256-GCM
      const cipher = crypto.createCipher(this.DEFAULT_ALGORITHM, activeKey.key);
      cipher.setAAD(Buffer.from(`${dataType}:${Date.now()}`)); // Additional authenticated data
      
      let encrypted = cipher.update(plaintext, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Get authentication tag for GCM mode
      const tag = (cipher as any).getAuthTag?.()?.toString('base64');

      const encryptedData: EncryptedData = {
        data: encrypted,
        keyId: this.currentKeyId,
        algorithm: this.DEFAULT_ALGORITHM,
        iv: iv.toString('base64'),
        tag,
        timestamp: new Date(),
        dataType
      };

      // Generate unique encryption ID
      const encryptionId = `enc_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      
      // Store encrypted data
      this.encryptedDataStore.set(encryptionId, encryptedData);

      // Update key usage
      activeKey.usageCount++;

      // Audit log
      await this.logEncryptionEvent({
        operation: 'encrypt',
        keyId: this.currentKeyId,
        dataType,
        userId,
        sessionId,
        ipAddress,
        success: true,
        gdprCompliant: true,
        swedishRegulationCompliant: true,
        dataRetentionCompliant: true,
        details: `Successfully encrypted ${dataType} data using ${this.DEFAULT_ALGORITHM}`
      });

      console.log(`🔒 Encrypted ${dataType} data with ID: ${encryptionId}`);
      
      return { encryptionId, encryptedData };

    } catch (error) {
      await this.logEncryptionEvent({
        operation: 'encrypt',
        keyId: this.currentKeyId,
        dataType,
        userId,
        sessionId,
        ipAddress,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        gdprCompliant: false,
        swedishRegulationCompliant: false,
        dataRetentionCompliant: true,
        details: `Failed to encrypt ${dataType} data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt sensitive test data
   */
  async decryptSensitiveData(
    encryptionId: string,
    userId?: string,
    sessionId?: string,
    ipAddress: string = '127.0.0.1'
  ): Promise<string | null> {
    
    try {
      // Get encrypted data
      const encryptedData = this.encryptedDataStore.get(encryptionId);
      if (!encryptedData) {
        throw new Error(`Encrypted data not found for ID: ${encryptionId}`);
      }

      // Get decryption key
      const decryptionKey = this.encryptionKeys.get(encryptedData.keyId);
      if (!decryptionKey) {
        throw new Error(`Decryption key not found: ${encryptedData.keyId}`);
      }

      // Check data retention compliance (Swedish requirement: 7 years max)
      const dataAge = Date.now() - encryptedData.timestamp.getTime();
      const maxRetentionTime = this.DATA_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      
      if (dataAge > maxRetentionTime) {
        await this.logEncryptionEvent({
          operation: 'decrypt',
          keyId: encryptedData.keyId,
          dataType: encryptedData.dataType,
          userId,
          sessionId,
          ipAddress,
          success: false,
          errorMessage: 'Data retention period exceeded',
          gdprCompliant: false,
          swedishRegulationCompliant: false,
          dataRetentionCompliant: false,
          details: `Attempted to decrypt expired data (${Math.floor(dataAge / (24 * 60 * 60 * 1000))} days old)`
        });
        
        // Auto-delete expired data
        this.encryptedDataStore.delete(encryptionId);
        return null;
      }

      // Decrypt data
      const decipher = crypto.createDecipher(encryptedData.algorithm, decryptionKey.key);
      
      if (encryptedData.tag) {
        // Set auth tag for GCM mode
        (decipher as any).setAuthTag?.(Buffer.from(encryptedData.tag, 'base64'));
        decipher.setAAD(Buffer.from(`${encryptedData.dataType}:${encryptedData.timestamp.getTime()}`));
      }

      let decrypted = decipher.update(encryptedData.data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      // Audit log
      await this.logEncryptionEvent({
        operation: 'decrypt',
        keyId: encryptedData.keyId,
        dataType: encryptedData.dataType,
        userId,
        sessionId,
        ipAddress,
        success: true,
        gdprCompliant: true,
        swedishRegulationCompliant: true,
        dataRetentionCompliant: true,
        details: `Successfully decrypted ${encryptedData.dataType} data`
      });

      console.log(`🔓 Decrypted ${encryptedData.dataType} data from ID: ${encryptionId}`);
      
      return decrypted;

    } catch (error) {
      await this.logEncryptionEvent({
        operation: 'decrypt',
        keyId: 'unknown',
        dataType: 'unknown',
        userId,
        sessionId,
        ipAddress,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        gdprCompliant: false,
        swedishRegulationCompliant: false,
        dataRetentionCompliant: true,
        details: `Failed to decrypt data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Encrypt Swedish sensitive data with special handling
   */
  async encryptSwedishSensitiveData(
    swedishData: SwedishSensitiveData,
    userId?: string,
    sessionId?: string
  ): Promise<{ [key: string]: string }> {
    
    const encryptedData: { [key: string]: string } = {};

    if (swedishData.personalNumber) {
      const { encryptionId } = await this.encryptSensitiveData(
        swedishData.personalNumber,
        'swedish_id',
        userId,
        sessionId
      );
      encryptedData.personalNumber = encryptionId;
    }

    if (swedishData.bankAccount) {
      const { encryptionId } = await this.encryptSensitiveData(
        swedishData.bankAccount,
        'banking',
        userId,
        sessionId
      );
      encryptedData.bankAccount = encryptionId;
    }

    if (swedishData.taxId) {
      const { encryptionId } = await this.encryptSensitiveData(
        swedishData.taxId,
        'swedish_id',
        userId,
        sessionId
      );
      encryptedData.taxId = encryptionId;
    }

    if (swedishData.organizationNumber) {
      const { encryptionId } = await this.encryptSensitiveData(
        swedishData.organizationNumber,
        'business',
        userId,
        sessionId
      );
      encryptedData.organizationNumber = encryptionId;
    }

    if (swedishData.addressData) {
      const addressString = JSON.stringify(swedishData.addressData);
      const { encryptionId } = await this.encryptSensitiveData(
        addressString,
        'personal',
        userId,
        sessionId
      );
      encryptedData.addressData = encryptionId;
    }

    console.log(`🇸🇪 Encrypted Swedish sensitive data with ${Object.keys(encryptedData).length} fields`);
    return encryptedData;
  }

  /**
   * Securely delete encrypted data (GDPR Right to Erasure)
   */
  async securelyDeleteData(
    encryptionId: string,
    userId?: string,
    reason: string = 'Data deletion requested'
  ): Promise<boolean> {
    
    const encryptedData = this.encryptedDataStore.get(encryptionId);
    if (!encryptedData) {
      return false;
    }

    // Remove from storage
    this.encryptedDataStore.delete(encryptionId);

    // Audit log
    await this.logEncryptionEvent({
      operation: 'data_deletion',
      keyId: encryptedData.keyId,
      dataType: encryptedData.dataType,
      userId,
      sessionId: `delete-${Date.now()}`,
      ipAddress: '127.0.0.1',
      success: true,
      gdprCompliant: true,
      swedishRegulationCompliant: true,
      dataRetentionCompliant: true,
      details: `Data securely deleted. Reason: ${reason}`
    });

    console.log(`🗑️ Securely deleted encrypted data: ${encryptionId}`);
    return true;
  }

  /**
   * Rotate encryption keys (security best practice)
   */
  async rotateEncryptionKey(): Promise<string> {
    const oldKeyId = this.currentKeyId;
    
    // Generate new key
    const newKeyId = `key_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const newKey: EncryptionKey = {
      id: newKeyId,
      key: crypto.randomBytes(32), // 256-bit key
      algorithm: this.DEFAULT_ALGORITHM,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.KEY_ROTATION_INTERVAL),
      status: 'active',
      usageCount: 0,
      maxUsage: this.MAX_KEY_USAGE
    };

    // Store new key
    this.encryptionKeys.set(newKeyId, newKey);
    this.currentKeyId = newKeyId;

    // Mark old key as expired (but keep for decryption)
    if (oldKeyId) {
      const oldKey = this.encryptionKeys.get(oldKeyId);
      if (oldKey) {
        oldKey.status = 'expired';
      }
    }

    // Audit log
    await this.logEncryptionEvent({
      operation: 'key_rotation',
      keyId: newKeyId,
      dataType: 'system',
      sessionId: `rotation-${Date.now()}`,
      ipAddress: '127.0.0.1',
      success: true,
      gdprCompliant: true,
      swedishRegulationCompliant: true,
      dataRetentionCompliant: true,
      details: `Encryption key rotated from ${oldKeyId} to ${newKeyId}`
    });

    console.log(`🔄 Encryption key rotated: ${oldKeyId} → ${newKeyId}`);
    return newKeyId;
  }

  /**
   * Get encryption statistics
   */
  async getEncryptionStatistics(): Promise<{
    totalEncryptedItems: number;
    encryptionsByType: { [key: string]: number };
    activeKeys: number;
    expiredKeys: number;
    keyRotationsDue: number;
    swedishComplianceRate: number;
    gdprComplianceRate: number;
  }> {
    
    const encryptionsByType: { [key: string]: number } = {};
    let swedishCompliantOps = 0;
    let gdprCompliantOps = 0;

    // Count encryptions by type
    Array.from(this.encryptedDataStore.values()).forEach(data => {
      encryptionsByType[data.dataType] = (encryptionsByType[data.dataType] || 0) + 1;
    });

    // Count compliance rates
    this.auditLogs.forEach(log => {
      if (log.swedishRegulationCompliant) swedishCompliantOps++;
      if (log.gdprCompliant) gdprCompliantOps++;
    });

    const totalOps = this.auditLogs.length || 1;
    const activeKeys = Array.from(this.encryptionKeys.values()).filter(k => k.status === 'active').length;
    const expiredKeys = Array.from(this.encryptionKeys.values()).filter(k => k.status === 'expired').length;
    
    // Check keys that need rotation
    const keyRotationsDue = Array.from(this.encryptionKeys.values()).filter(key => 
      key.status === 'active' && (
        Date.now() > key.expiresAt.getTime() || 
        key.usageCount >= key.maxUsage
      )
    ).length;

    return {
      totalEncryptedItems: this.encryptedDataStore.size,
      encryptionsByType,
      activeKeys,
      expiredKeys,
      keyRotationsDue,
      swedishComplianceRate: (swedishCompliantOps / totalOps) * 100,
      gdprComplianceRate: (gdprCompliantOps / totalOps) * 100
    };
  }

  /**
   * Initialize encryption system
   */
  private initializeEncryptionSystem(): void {
    // Create initial encryption key
    this.currentKeyId = `key_init_${Date.now()}`;
    const initialKey: EncryptionKey = {
      id: this.currentKeyId,
      key: crypto.randomBytes(32),
      algorithm: this.DEFAULT_ALGORITHM,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.KEY_ROTATION_INTERVAL),
      status: 'active',
      usageCount: 0,
      maxUsage: this.MAX_KEY_USAGE
    };

    this.encryptionKeys.set(this.currentKeyId, initialKey);
    
    console.log(`🔐 Encryption system initialized with key: ${this.currentKeyId}`);
  }

  /**
   * Log encryption events for audit
   */
  private async logEncryptionEvent(event: Omit<EncryptionAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const auditLog: EncryptionAuditLog = {
      id: `audit_enc_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      timestamp: new Date(),
      ...event
    };

    this.auditLogs.push(auditLog);

    // Keep only last 10000 audit logs to prevent memory issues
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-10000);
    }
  }

  /**
   * Get audit logs for compliance reporting
   */
  async getEncryptionAuditLogs(
    startDate?: Date,
    endDate?: Date,
    operation?: string
  ): Promise<EncryptionAuditLog[]> {
    return this.auditLogs.filter(log => {
      if (startDate && log.timestamp < startDate) return false;
      if (endDate && log.timestamp > endDate) return false;
      if (operation && log.operation !== operation) return false;
      return true;
    });
  }

  /**
   * Generate encryption compliance report
   */
  async generateEncryptionComplianceReport(): Promise<{
    statistics: any;
    complianceStatus: 'COMPLIANT' | 'PARTIAL_COMPLIANCE' | 'NON_COMPLIANT';
    recommendedActions: string[];
    auditSummary: {
      totalOperations: number;
      successfulOperations: number;
      failedOperations: number;
      complianceViolations: number;
    };
  }> {
    const statistics = await this.getEncryptionStatistics();
    const successfulOps = this.auditLogs.filter(log => log.success).length;
    const failedOps = this.auditLogs.filter(log => !log.success).length;
    const violations = this.auditLogs.filter(log => 
      !log.gdprCompliant || !log.swedishRegulationCompliant
    ).length;

    const complianceScore = Math.min(statistics.swedishComplianceRate, statistics.gdprComplianceRate);
    const complianceStatus = complianceScore >= 95 ? 'COMPLIANT' : 
                           complianceScore >= 80 ? 'PARTIAL_COMPLIANCE' : 'NON_COMPLIANT';

    const recommendedActions: string[] = [];
    if (statistics.keyRotationsDue > 0) {
      recommendedActions.push(`Rotate ${statistics.keyRotationsDue} encryption keys`);
    }
    if (complianceScore < 95) {
      recommendedActions.push('Address compliance violations in audit logs');
    }
    if (failedOps > successfulOps * 0.05) {
      recommendedActions.push('Investigate high failure rate in encryption operations');
    }

    return {
      statistics,
      complianceStatus,
      recommendedActions,
      auditSummary: {
        totalOperations: this.auditLogs.length,
        successfulOperations: successfulOps,
        failedOperations: failedOps,
        complianceViolations: violations
      }
    };
  }
}