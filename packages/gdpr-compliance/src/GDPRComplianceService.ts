import { 
  ConsentData, 
  ConsentType, 
  DataRetentionPolicy, 
  DataExportRequest, 
  DataRequestType, 
  RequestStatus, 
  ExportedData,
  GDPRConfig,
  DataCategory
} from './types';
import { ConsentManager } from './ConsentManager';
import { DataRetentionManager } from './DataRetentionManager';
import { DataExportService } from './DataExportService';
import { RightToErasureService } from './RightToErasureService';
import { DataAnonymizer } from './DataAnonymizer';
import { VoiceDataManager } from './VoiceDataManager';
import { TranscriptSanitizer } from './TranscriptSanitizer';
import { CookieConsentManager, CookieConsentPreferences } from './CookieConsentManager';

export class GDPRComplianceService {
  private consentManager: ConsentManager;
  private retentionManager: DataRetentionManager;
  private exportService: DataExportService;
  private erasureService: RightToErasureService;
  private anonymizer: DataAnonymizer;
  private voiceDataManager: VoiceDataManager;
  private transcriptSanitizer: TranscriptSanitizer;
  private cookieConsentManager: CookieConsentManager;

  constructor(private config: GDPRConfig) {
    this.consentManager = new ConsentManager(config);
    this.retentionManager = new DataRetentionManager(config);
    this.exportService = new DataExportService(config);
    this.erasureService = new RightToErasureService(config);
    this.anonymizer = new DataAnonymizer(config);
    this.voiceDataManager = new VoiceDataManager(config);
    this.transcriptSanitizer = new TranscriptSanitizer(config);
    this.cookieConsentManager = new CookieConsentManager(config);
  }

  // Consent Management
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
    return this.consentManager.recordConsent(
      sessionId,
      customerHash,
      consentType,
      granted,
      metadata
    );
  }

  async getConsent(
    customerHash: string,
    consentType: ConsentType
  ): Promise<ConsentData | null> {
    return this.consentManager.getConsent(customerHash, consentType);
  }

  async hasValidConsent(
    customerHash: string,
    consentType: ConsentType
  ): Promise<boolean> {
    return this.consentManager.hasValidConsent(customerHash, consentType);
  }

  async revokeConsent(
    customerHash: string,
    consentType: ConsentType
  ): Promise<void> {
    return this.consentManager.revokeConsent(customerHash, consentType);
  }

  // Data Export (Right to Access)
  async requestDataExport(customerHash: string): Promise<DataExportRequest> {
    return this.exportService.createExportRequest(customerHash, DataRequestType.EXPORT);
  }

  async getExportRequest(requestId: string): Promise<DataExportRequest | null> {
    return this.exportService.getExportRequest(requestId);
  }

  async processExportRequest(requestId: string): Promise<ExportedData> {
    return this.exportService.processExportRequest(requestId);
  }

  // Right to Erasure (Right to be Forgotten)
  async requestDataDeletion(customerHash: string): Promise<DataExportRequest> {
    return this.erasureService.createDeletionRequest(customerHash);
  }

  async processDataDeletion(requestId: string): Promise<void> {
    return this.erasureService.processDeletionRequest(requestId);
  }

  // Data Anonymization
  async anonymizeTranscript(transcript: string): Promise<string> {
    return this.anonymizer.anonymizeText(transcript);
  }

  async anonymizeCustomerData(customerHash: string): Promise<void> {
    return this.anonymizer.anonymizeCustomerData(customerHash);
  }

  // Data Retention
  async enforceRetentionPolicies(): Promise<void> {
    return this.retentionManager.enforceRetentionPolicies();
  }

  async scheduleDataCleanup(): Promise<void> {
    return this.retentionManager.scheduleAutomaticCleanup();
  }

  // Voice Data Handling
  async handleVoiceDataDeletion(sessionId: string): Promise<void> {
    // Immediate deletion after processing
    return this.retentionManager.deleteVoiceData(sessionId);
  }

  // Voice Data Management (GDPR Critical)
  async trackVoiceProcessing(
    sessionId: string,
    customerHash: string,
    audioFilePath?: string
  ): Promise<() => Promise<void>> {
    // Track voice data and return cleanup function
    return VoiceDataManager.integrateWithAIPipeline(
      sessionId,
      customerHash,
      audioFilePath || '',
      this.config
    );
  }

  async startVoiceDataAutoCleanup(): Promise<void> {
    this.voiceDataManager.startAutomaticCleanup();
  }

  async stopVoiceDataAutoCleanup(): Promise<void> {
    this.voiceDataManager.stopAutomaticCleanup();
  }

  async performEmergencyVoiceCleanup(): Promise<void> {
    return this.voiceDataManager.emergencyCleanup();
  }

  // Transcript Sanitization (PII Removal)
  async sanitizeRealtimeTranscript(
    partialTranscript: string,
    sessionId: string,
    customerHash: string
  ): Promise<{
    sanitizedText: string;
    piiDetected: string[];
    confidence: number;
  }> {
    const result = await this.transcriptSanitizer.sanitizeRealtimeTranscript(
      partialTranscript,
      sessionId,
      customerHash
    );
    
    return {
      sanitizedText: result.sanitizedText,
      piiDetected: result.piiDetected,
      confidence: result.confidence
    };
  }

  async sanitizeFinalTranscript(
    transcript: string,
    sessionId: string,
    customerHash: string
  ): Promise<{
    sanitizedTranscript: string;
    piiReport: {
      detectedTypes: string[];
      instancesFound: number;
      confidenceScore: number;
      anonymizationApplied: boolean;
    };
  }> {
    return this.transcriptSanitizer.sanitizeFinalTranscript(
      transcript,
      sessionId,
      customerHash
    );
  }

  async performEmergencyTranscriptSanitization(customerHash?: string): Promise<void> {
    await this.transcriptSanitizer.emergencySanitizeAll(customerHash);
  }

  // GDPR Health Check
  async performComplianceCheck(): Promise<{
    consentCoverage: number;
    retentionCompliance: boolean;
    anonymizationActive: boolean;
    pendingRequests: number;
  }> {
    const [consentStats, retentionStatus, pendingCount] = await Promise.all([
      this.consentManager.getConsentStats(),
      this.retentionManager.checkCompliance(),
      this.exportService.getPendingRequestsCount()
    ]);

    return {
      consentCoverage: consentStats.coveragePercentage,
      retentionCompliance: retentionStatus.compliant,
      anonymizationActive: this.config.anonymizationEnabled,
      pendingRequests: pendingCount
    };
  }

  // Cookie Consent Management
  async getCookieConsent(customerHash: string): Promise<CookieConsentPreferences | null> {
    return this.cookieConsentManager.getCookieConsentPreferences(customerHash);
  }

  async updateCookieConsent(
    sessionId: string,
    customerHash: string,
    preferences: CookieConsentPreferences,
    metadata: {
      ipAddress: string;
      userAgent: string;
      consentMethod?: 'banner' | 'settings' | 'api';
    }
  ): Promise<void> {
    await this.cookieConsentManager.recordCookieConsent(
      sessionId,
      customerHash,
      preferences,
      {
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        consentMethod: metadata.consentMethod || 'api',
        bannerVersion: '1.0'
      }
    );
  }

  async isCookieConsentRequired(customerHash: string): Promise<{
    required: boolean;
    reason?: string;
    lastConsentDate?: Date;
  }> {
    return this.cookieConsentManager.isCookieConsentRequired(customerHash);
  }

  async acceptAllCookies(
    sessionId: string,
    customerHash: string,
    metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<void> {
    return this.cookieConsentManager.acceptAllCookies(sessionId, customerHash, metadata);
  }

  async rejectAllCookies(
    sessionId: string,
    customerHash: string,
    metadata: {
      ipAddress: string;
      userAgent: string;
    }
  ): Promise<void> {
    return this.cookieConsentManager.rejectAllCookies(sessionId, customerHash, metadata);
  }

  getCookieConsentBanner() {
    return this.cookieConsentManager.getBannerConfiguration();
  }

  generateCookieScript(customerHash: string): string {
    return this.cookieConsentManager.generateCookieScript(customerHash);
  }
}