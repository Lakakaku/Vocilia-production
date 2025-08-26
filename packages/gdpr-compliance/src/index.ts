// Main GDPR Compliance Service
export { GDPRComplianceService } from './GDPRComplianceService';

// Individual Services
export { ConsentManager } from './ConsentManager';
export { DataRetentionManager } from './DataRetentionManager';
export { DataExportService } from './DataExportService';
export { RightToErasureService } from './RightToErasureService';
export { DataAnonymizer } from './DataAnonymizer';
export { VoiceDataManager } from './VoiceDataManager';
export { TranscriptSanitizer } from './TranscriptSanitizer';
export { CookieConsentManager, type CookieConsentPreferences, type CookieConsentBanner } from './CookieConsentManager';

// Types and Interfaces
export * from './types';

// Default GDPR Configuration
export const DEFAULT_GDPR_CONFIG = {
  dataRetentionPolicies: [
    {
      dataType: 'voice_audio',
      retentionPeriod: 0, // Delete immediately after processing
      category: 'voice_audio' as const,
      automaticDeletion: true
    },
    {
      dataType: 'transcripts',
      retentionPeriod: 365, // 1 year
      category: 'transcripts' as const,
      automaticDeletion: true,
      anonymizationRules: [
        {
          field: 'transcript',
          method: 'replace' as const,
          replacement: '[PII_REMOVED]'
        }
      ]
    },
    {
      dataType: 'customer_data',
      retentionPeriod: 1095, // 3 years
      category: 'customer_data' as const,
      automaticDeletion: true
    },
    {
      dataType: 'system_logs',
      retentionPeriod: 90, // 3 months
      category: 'system_logs' as const,
      automaticDeletion: true
    },
    {
      dataType: 'analytics_data',
      retentionPeriod: 730, // 2 years
      category: 'analytics_data' as const,
      automaticDeletion: true,
      anonymizationRules: [
        {
          field: '*',
          method: 'hash' as const
        }
      ]
    }
  ],
  consentDefaults: {
    voice_processing: false,
    data_storage: false,
    analytics: false,
    marketing: false,
    cookies_functional: true, // Required for basic functionality
    cookies_analytics: false,
    cookies_marketing: false
  },
  anonymizationEnabled: true,
  autoDeleteEnabled: true,
  exportExpirationDays: 30
};