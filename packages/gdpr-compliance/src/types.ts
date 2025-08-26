export interface ConsentData {
  id: string;
  sessionId: string;
  customerHash: string;
  consentType: ConsentType;
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  version: string; // Consent version
}

export enum ConsentType {
  VOICE_PROCESSING = 'voice_processing',
  DATA_STORAGE = 'data_storage',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  COOKIES_FUNCTIONAL = 'cookies_functional',
  COOKIES_ANALYTICS = 'cookies_analytics',
  COOKIES_MARKETING = 'cookies_marketing'
}

export interface DataRetentionPolicy {
  dataType: string;
  retentionPeriod: number; // in days
  category: DataCategory;
  automaticDeletion: boolean;
  anonymizationRules?: AnonymizationRule[];
}

export enum DataCategory {
  VOICE_AUDIO = 'voice_audio',
  TRANSCRIPTS = 'transcripts', 
  CUSTOMER_DATA = 'customer_data',
  BUSINESS_DATA = 'business_data',
  SYSTEM_LOGS = 'system_logs',
  ANALYTICS_DATA = 'analytics_data'
}

export interface AnonymizationRule {
  field: string;
  method: AnonymizationMethod;
  replacement?: string;
}

export enum AnonymizationMethod {
  HASH = 'hash',
  REMOVE = 'remove',
  REPLACE = 'replace',
  MASK = 'mask'
}

export interface DataExportRequest {
  id: string;
  customerHash: string;
  requestType: DataRequestType;
  status: RequestStatus;
  requestedAt: Date;
  completedAt?: Date;
  data?: ExportedData;
  downloadUrl?: string;
  expiresAt?: Date;
}

export enum DataRequestType {
  EXPORT = 'export',
  DELETION = 'deletion',
  RECTIFICATION = 'rectification'
}

export enum RequestStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired'
}

export interface ExportedData {
  customerData: {
    customerHash: string;
    feedbackSessions: FeedbackSessionExport[];
    consents: ConsentData[];
    createdAt: Date;
    lastActivity: Date;
  };
  metadata: {
    exportedAt: Date;
    dataTypes: string[];
    totalRecords: number;
  };
}

export interface FeedbackSessionExport {
  sessionId: string;
  timestamp: Date;
  businessId: string;
  qualityScore?: number;
  reward?: number;
  anonymizedTranscript?: string; // PII removed
  categories?: string[];
}

export interface GDPRConfig {
  dataRetentionPolicies: DataRetentionPolicy[];
  consentDefaults: Partial<Record<ConsentType, boolean>>;
  anonymizationEnabled: boolean;
  autoDeleteEnabled: boolean;
  exportExpirationDays: number;
}

export interface PIIPattern {
  type: PIIType;
  pattern: RegExp;
  replacement: string;
}

export enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  CREDIT_CARD = 'credit_card',
  SSN = 'ssn',
  NAME = 'name',
  ADDRESS = 'address'
}