import { 
  ConsentData, 
  ConsentType, 
  GDPRConfig 
} from './types';
import { gdprDb } from '@feedback-platform/database';

export class ConsentManager {
  constructor(private config: GDPRConfig) {}

  async recordConsent(
    sessionId: string,
    customerHash: string,
    consentType: ConsentType,
    granted: boolean,
    metadata: {
      ipAddress: string;
      userAgent: string;
      version: string;
    }
  ): Promise<ConsentData> {
    const consentData = await gdprDb.createConsentRecord({
      sessionId,
      customerHash,
      consentType,
      granted,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      version: metadata.version
    });

    // Log the consent action for audit trail
    await gdprDb.createAuditLog({
      customerHash,
      actionType: granted ? 'consent_granted' : 'consent_revoked',
      actionDetails: {
        consentType,
        sessionId,
        version: metadata.version
      },
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      legalBasis: 'consent'
    });
    
    return consentData;
  }

  async getConsent(
    customerHash: string,
    consentType: ConsentType
  ): Promise<ConsentData | null> {
    return gdprDb.getLatestConsent(customerHash, consentType);
  }

  async hasValidConsent(
    customerHash: string,
    consentType: ConsentType
  ): Promise<boolean> {
    const consent = await this.getConsent(customerHash, consentType);
    
    if (!consent) {
      // Check if default consent exists
      return this.config.consentDefaults[consentType] ?? false;
    }

    return consent.granted;
  }

  async revokeConsent(
    customerHash: string,
    consentType: ConsentType
  ): Promise<void> {
    // Record revocation as new consent entry with granted: false
    await this.recordConsent(
      'revocation',
      customerHash,
      consentType,
      false,
      {
        ipAddress: '0.0.0.0', // System revocation
        userAgent: 'system',
        version: '1.0'
      }
    );
  }

  async getConsentHistory(customerHash: string): Promise<ConsentData[]> {
    return gdprDb.getConsentHistory(customerHash);
  }

  async getConsentStats(): Promise<{
    totalUsers: number;
    consentedUsers: number;
    coveragePercentage: number;
    consentsByType: Record<ConsentType, number>;
  }> {
    // TODO: Calculate from database
    // const stats = await prisma.consent.groupBy({
    //   by: ['consentType', 'granted'],
    //   _count: true
    // });

    return {
      totalUsers: 0,
      consentedUsers: 0,
      coveragePercentage: 0,
      consentsByType: {} as Record<ConsentType, number>
    }; // Placeholder
  }

  async cleanupExpiredConsents(): Promise<void> {
    // Remove consent records older than required retention period
    const retentionDays = 365; // 1 year
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // TODO: Delete from database
    // await prisma.consent.deleteMany({
    //   where: {
    //     timestamp: {
    //       lt: cutoffDate
    //     }
    //   }
    // });
  }

  private generateId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Bulk consent operations for admin/migration purposes
  async bulkUpdateConsent(
    customerHashes: string[],
    consentType: ConsentType,
    granted: boolean
  ): Promise<void> {
    const timestamp = new Date();
    
    // TODO: Bulk update in database
    // const consentRecords = customerHashes.map(customerHash => ({
    //   id: this.generateId(),
    //   sessionId: 'bulk_update',
    //   customerHash,
    //   consentType,
    //   granted,
    //   timestamp,
    //   ipAddress: '0.0.0.0',
    //   userAgent: 'system',
    //   version: '1.0'
    // }));
    
    // await prisma.consent.createMany({
    //   data: consentRecords
    // });
  }

  // Consent verification for specific operations
  async verifyRequiredConsents(
    customerHash: string,
    requiredConsents: ConsentType[]
  ): Promise<{ valid: boolean; missing: ConsentType[] }> {
    const missing: ConsentType[] = [];
    
    for (const consentType of requiredConsents) {
      const hasConsent = await this.hasValidConsent(customerHash, consentType);
      if (!hasConsent) {
        missing.push(consentType);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  // Generate consent proof for legal purposes
  async generateConsentProof(customerHash: string): Promise<{
    customerHash: string;
    consents: ConsentData[];
    generatedAt: Date;
    signature: string;
  }> {
    const consents = await this.getConsentHistory(customerHash);
    const generatedAt = new Date();
    
    // Generate cryptographic signature for proof
    const dataToSign = JSON.stringify({
      customerHash,
      consents: consents.map(c => ({ 
        type: c.consentType, 
        granted: c.granted, 
        timestamp: c.timestamp 
      })),
      generatedAt
    });
    
    // TODO: Use proper cryptographic signing
    const signature = Buffer.from(dataToSign).toString('base64');

    return {
      customerHash,
      consents,
      generatedAt,
      signature
    };
  }
}