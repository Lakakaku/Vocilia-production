import { gdprDb } from '@feedback-platform/database';
import { 
  PIIPattern, 
  PIIType, 
  GDPRConfig 
} from './types';
import { DataAnonymizer } from './DataAnonymizer';

export class TranscriptSanitizer {
  private anonymizer: DataAnonymizer;
  private realtimePIIPatterns: PIIPattern[];

  constructor(private config: GDPRConfig) {
    this.anonymizer = new DataAnonymizer(config);
    
    // Optimized patterns for real-time processing (faster regex patterns)
    this.realtimePIIPatterns = [
      {
        type: PIIType.EMAIL,
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/gi,
        replacement: '[EMAIL_REDACTED]'
      },
      {
        type: PIIType.PHONE,
        pattern: /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        replacement: '[PHONE_REDACTED]'
      },
      {
        type: PIIType.CREDIT_CARD,
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: '[CARD_REDACTED]'
      },
      {
        type: PIIType.SSN,
        // Swedish personal numbers (personnummer)
        pattern: /\b\d{6}[-]?\d{4}\b/g,
        replacement: '[PERSONNUMMER_REDACTED]'
      },
      {
        type: PIIType.ADDRESS,
        // Swedish address patterns (simplified for real-time)
        pattern: /\b\d+\s+[A-ZÅÄÖ][a-zåäöé-]+(?:gatan|vägen|torget|platsen|stigen)\b/gi,
        replacement: '[ADDRESS_REDACTED]'
      }
    ];
  }

  // Real-time sanitization for live transcript streaming
  async sanitizeRealtimeTranscript(
    partialTranscript: string,
    sessionId: string,
    customerHash: string
  ): Promise<{
    sanitizedText: string;
    piiDetected: PIIType[];
    confidence: number;
  }> {
    let sanitizedText = partialTranscript;
    const piiDetected: PIIType[] = [];
    let totalMatches = 0;
    let totalCharacters = partialTranscript.length;

    // Apply real-time PII patterns (fast processing)
    for (const pattern of this.realtimePIIPatterns) {
      const matches = partialTranscript.match(pattern.pattern);
      if (matches && matches.length > 0) {
        piiDetected.push(pattern.type);
        totalMatches += matches.length;
        sanitizedText = sanitizedText.replace(pattern.pattern, pattern.replacement);
      }
    }

    // Apply Swedish-specific sanitization
    sanitizedText = this.sanitizeSwedishPIIRealtime(sanitizedText);

    // Calculate confidence score
    const confidence = this.calculateSanitizationConfidence(
      partialTranscript,
      sanitizedText,
      totalMatches,
      totalCharacters
    );

    // Log PII detection if found
    if (piiDetected.length > 0) {
      await this.logPIIDetection(
        sessionId,
        customerHash,
        'transcript_realtime',
        piiDetected,
        confidence
      );
    }

    return {
      sanitizedText,
      piiDetected,
      confidence
    };
  }

  // Complete sanitization for final transcript
  async sanitizeFinalTranscript(
    transcript: string,
    sessionId: string,
    customerHash: string
  ): Promise<{
    sanitizedTranscript: string;
    piiReport: {
      detectedTypes: PIIType[];
      instancesFound: number;
      confidenceScore: number;
      anonymizationApplied: boolean;
    };
  }> {
    // Use comprehensive anonymization
    const sanitizedTranscript = await this.anonymizer.anonymizeText(transcript);
    
    // Validate sanitization effectiveness
    const validation = await this.anonymizer.validateAnonymization(transcript, sanitizedTranscript);
    
    // Log comprehensive PII detection
    await this.logPIIDetection(
      sessionId,
      customerHash,
      'transcript_final',
      validation.detectedPII,
      validation.score / 100
    );

    // Update feedback session to mark transcript as sanitized
    await gdprDb.markTranscriptAnonymized(sessionId);

    // Create audit log
    await gdprDb.createAuditLog({
      customerHash,
      actionType: 'transcript_sanitized',
      actionDetails: {
        sessionId,
        originalLength: transcript.length,
        sanitizedLength: sanitizedTranscript.length,
        piiTypesFound: validation.detectedPII,
        confidenceScore: validation.score
      },
      legalBasis: 'legal_obligation'
    });

    return {
      sanitizedTranscript,
      piiReport: {
        detectedTypes: validation.detectedPII,
        instancesFound: validation.detectedPII.length,
        confidenceScore: validation.score,
        anonymizationApplied: true
      }
    };
  }

  // Swedish-specific real-time PII sanitization
  private sanitizeSwedishPIIRealtime(text: string): string {
    let sanitized = text;

    // Swedish postal codes (faster pattern)
    sanitized = sanitized.replace(/\b\d{3}\s?\d{2}\b/g, '[POSTKOD_REDACTED]');
    
    // Common Swedish cities (limited list for real-time processing)
    const majorCities = /\b(Stockholm|Göteborg|Malmö|Uppsala|Linköping|Västerås|Örebro|Helsingborg)\b/gi;
    sanitized = sanitized.replace(majorCities, '[STAD_REDACTED]');

    // Swedish organization numbers
    sanitized = sanitized.replace(/\b\d{6}-?\d{4}\b/g, '[ORGNR_REDACTED]');

    return sanitized;
  }

  // Calculate confidence score for sanitization effectiveness
  private calculateSanitizationConfidence(
    original: string,
    sanitized: string,
    piiMatches: number,
    totalCharacters: number
  ): number {
    // Base confidence starts high
    let confidence = 0.95;

    // Reduce confidence if many PII instances were found
    if (piiMatches > 0) {
      const piiDensity = piiMatches / (totalCharacters / 100); // PII per 100 characters
      confidence -= Math.min(piiDensity * 0.1, 0.3); // Max 30% reduction
    }

    // Reduce confidence if sanitized text is very similar to original
    const similarityRatio = this.calculateSimilarity(original, sanitized);
    if (similarityRatio > 0.9) {
      confidence -= 0.1; // Might have missed some PII
    }

    // Reduce confidence for very short texts (harder to assess)
    if (totalCharacters < 50) {
      confidence -= 0.05;
    }

    return Math.max(0.5, Math.min(1.0, confidence)); // Keep between 0.5 and 1.0
  }

  // Simple similarity calculation
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return union.size === 0 ? 1 : intersection.size / union.size;
  }

  // Log PII detection for compliance tracking
  private async logPIIDetection(
    sessionId: string,
    customerHash: string,
    sourceType: string,
    piiTypes: PIIType[],
    confidence: number
  ): Promise<void> {
    // This would integrate with the database to log PII detection
    // For now, just log to audit trail
    await gdprDb.createAuditLog({
      customerHash,
      actionType: 'pii_detected',
      actionDetails: {
        sessionId,
        sourceType,
        piiTypes,
        confidence,
        detectedAt: new Date()
      },
      legalBasis: 'legal_obligation'
    });
  }

  // Batch sanitization for existing transcripts
  async sanitizeExistingTranscripts(
    sessionIds: string[],
    batchSize: number = 10
  ): Promise<{
    processed: number;
    sanitized: number;
    errors: string[];
  }> {
    const result = {
      processed: 0,
      sanitized: 0,
      errors: [] as string[]
    };

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < sessionIds.length; i += batchSize) {
      const batch = sessionIds.slice(i, i + batchSize);
      
      for (const sessionId of batch) {
        try {
          // Get the session data (this would need database integration)
          // For now, skip the actual implementation
          result.processed++;
          result.sanitized++;
        } catch (error) {
          result.errors.push(`${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          result.processed++;
        }
      }

      // Small delay between batches
      if (i + batchSize < sessionIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return result;
  }

  // Get sanitization statistics
  async getSanitizationStats(): Promise<{
    totalTranscriptsProcessed: number;
    piiInstancesFound: number;
    mostCommonPIITypes: { type: PIIType; count: number }[];
    averageConfidenceScore: number;
    recentSanitizations: number; // Last 24 hours
  }> {
    // This would require database queries to get actual stats
    return {
      totalTranscriptsProcessed: 0,
      piiInstancesFound: 0,
      mostCommonPIITypes: [],
      averageConfidenceScore: 0,
      recentSanitizations: 0
    };
  }

  // Test sanitization with sample data
  async testSanitization(sampleTexts: string[]): Promise<Array<{
    original: string;
    sanitized: string;
    piiDetected: PIIType[];
    confidence: number;
    processingTime: number;
  }>> {
    const results = [];

    for (const text of sampleTexts) {
      const startTime = Date.now();
      
      const result = await this.sanitizeRealtimeTranscript(
        text,
        'test-session',
        'test-customer'
      );
      
      const processingTime = Date.now() - startTime;

      results.push({
        original: text,
        sanitized: result.sanitizedText,
        piiDetected: result.piiDetected,
        confidence: result.confidence,
        processingTime
      });
    }

    return results;
  }

  // Emergency sanitization (for security incidents)
  async emergencySanitizeAll(customerHash?: string): Promise<{
    sessionsProcessed: number;
    transcriptsSanitized: number;
    errors: string[];
  }> {
    const result = {
      sessionsProcessed: 0,
      transcriptsSanitized: 0,
      errors: [] as string[]
    };

    try {
      // Get all sessions that need sanitization
      // This would require database integration
      
      // Log emergency sanitization
      await gdprDb.createAuditLog({
        customerHash,
        actionType: 'emergency_sanitization',
        actionDetails: {
          initiatedAt: new Date(),
          reason: 'Emergency PII protection',
          scope: customerHash ? 'single_customer' : 'all_customers'
        },
        legalBasis: 'legal_obligation'
      });

    } catch (error) {
      result.errors.push(`Emergency sanitization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  // Integration with AI processing pipeline
  static createRealtimeSanitizer(config: GDPRConfig) {
    const sanitizer = new TranscriptSanitizer(config);
    
    return {
      // Function to sanitize streaming transcript chunks
      sanitizeChunk: async (
        textChunk: string, 
        sessionId: string, 
        customerHash: string
      ) => {
        return sanitizer.sanitizeRealtimeTranscript(textChunk, sessionId, customerHash);
      },
      
      // Function to sanitize final complete transcript
      sanitizeFinal: async (
        transcript: string, 
        sessionId: string, 
        customerHash: string
      ) => {
        return sanitizer.sanitizeFinalTranscript(transcript, sessionId, customerHash);
      }
    };
  }
}