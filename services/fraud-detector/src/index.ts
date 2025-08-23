/**
 * AI Feedback Platform - Fraud Detection Service
 * 
 * Comprehensive fraud detection system with:
 * - Duplicate content detection using multiple algorithms
 * - Voice pattern analysis for synthetic speech detection
 * - Device fingerprinting analysis
 * - Temporal and geographic pattern detection
 * - Business context authenticity verification
 * - Swedish language optimizations
 */

export { FraudDetectorService } from './FraudDetectorService';
export { ContentDuplicateDetector } from './ContentDuplicateDetector';
export { VoicePatternAnalyzer } from './VoicePatternAnalyzer';
export type {
  FraudCheck,
  FraudAnalysisResult,
  ContentFingerprint,
  DuplicateMatch,
  ContentPattern,
  SwedishTextNormalization,
  FraudDetectionConfig
} from './types';

export type {
  VoiceFeatures,
  VoicePatternMatch,
  SyntheticVoiceIndicators
} from './VoicePatternAnalyzer';

// Default configuration for conservative fraud detection
export const DEFAULT_FRAUD_CONFIG: Partial<import('./types').FraudDetectionConfig> = {
  exactMatchThreshold: 1.0,
  fuzzyMatchThreshold: 0.85,
  semanticMatchThreshold: 0.90,
  structuralMatchThreshold: 0.80,
  duplicateContentWeight: 0.8,
  temporalPatternWeight: 0.6,
  devicePatternWeight: 0.7,
  voicePatternWeight: 0.8,
  suspiciousTimeWindow: 10,
  maxSubmissionsPerHour: 3,
  minPatternOccurrences: 3,
  suspiciousPatternThreshold: 0.7,
  conservativeMode: true,
  conservativeModeMultiplier: 1.3
};

/**
 * Factory function to create fraud detector with default config
 */
export function createFraudDetector(
  config?: Partial<import('./types').FraudDetectionConfig>
): FraudDetectorService {
  return new FraudDetectorService({ ...DEFAULT_FRAUD_CONFIG, ...config });
}

/**
 * Factory function for content-only duplicate detection
 */
export function createContentDetector(
  config?: Partial<import('./types').FraudDetectionConfig>
): ContentDuplicateDetector {
  return new ContentDuplicateDetector({ ...DEFAULT_FRAUD_CONFIG, ...config });
}

/**
 * Factory function for voice pattern analysis only
 */
export function createVoicePatternAnalyzer(
  config?: Partial<import('./types').FraudDetectionConfig>
): VoicePatternAnalyzer {
  return new VoicePatternAnalyzer({ ...DEFAULT_FRAUD_CONFIG, ...config });
}