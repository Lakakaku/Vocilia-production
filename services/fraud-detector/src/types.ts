import { FeedbackSession, FraudFlag, FraudType, DeviceFingerprint } from '@feedback-platform/shared-types';

/**
 * Core fraud detection interfaces
 */
export interface FraudCheck {
  type: FraudType;
  score: number;      // 0-1 risk score (0 = no risk, 1 = maximum risk)
  evidence: Record<string, unknown>;
  confidence: number; // 0-1 confidence in detection accuracy
  description: string;
  severity: 'low' | 'medium' | 'high';
}

export interface FraudAnalysisResult {
  overallRiskScore: number;
  flags: FraudFlag[];
  checks: FraudCheck[];
  recommendation: 'accept' | 'review' | 'reject';
  confidence: number;
}

export interface ContentFingerprint {
  exactHash: string;           // SHA-256 of normalized content
  phoneticHash: string;        // Phonetic representation hash
  semanticHash: string;        // Semantic embedding hash
  structureHash: string;       // Sentence structure hash
  keywordsHash: string;        // Keywords-only hash
  length: number;
  wordCount: number;
  timestamp: Date;
}

export interface DuplicateMatch {
  sessionId: string;
  similarity: number;          // 0-1 similarity score
  matchType: 'exact' | 'fuzzy' | 'semantic' | 'structural';
  confidence: number;
  evidence: {
    matchedSegments: string[];
    differenceRatio: number;
    timestampDelta: number;    // Minutes between submissions
  };
}

export interface ContentPattern {
  pattern: string;
  occurrences: number;
  sessions: string[];
  suspiciousThreshold: number;
  confidence: number;
}

export interface SwedishTextNormalization {
  original: string;
  normalized: string;
  stemmed: string;
  phonetic: string;
  keywords: string[];
}

export interface FraudDetectionConfig {
  // Similarity thresholds
  exactMatchThreshold: number;        // Default: 1.0 (100%)
  fuzzyMatchThreshold: number;        // Default: 0.85 (85%)
  semanticMatchThreshold: number;     // Default: 0.90 (90%)
  structuralMatchThreshold: number;   // Default: 0.80 (80%)
  
  // Risk scoring weights
  duplicateContentWeight: number;     // Default: 0.8
  temporalPatternWeight: number;      // Default: 0.6
  devicePatternWeight: number;        // Default: 0.7
  voicePatternWeight?: number;        // Default: 0.8 (voice pattern analysis weight)
  
  // Time-based analysis
  suspiciousTimeWindow: number;       // Minutes, default: 10
  maxSubmissionsPerHour: number;      // Default: 3
  
  // Pattern detection
  minPatternOccurrences: number;      // Default: 3
  suspiciousPatternThreshold: number; // Default: 0.7
  
  // Conservative mode (initially stricter)
  conservativeMode: boolean;          // Default: true
  conservativeModeMultiplier: number; // Default: 1.3
}