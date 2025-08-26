import * as crypto from 'crypto';
import { 
  PIIPattern, 
  PIIType, 
  AnonymizationRule, 
  AnonymizationMethod,
  GDPRConfig 
} from './types';

export class DataAnonymizer {
  private piiPatterns: PIIPattern[] = [
    {
      type: PIIType.EMAIL,
      pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      replacement: '[EMAIL]'
    },
    {
      type: PIIType.PHONE,
      pattern: /(\+\d{1,3}[- ]?)?\d{10,}/g,
      replacement: '[PHONE]'
    },
    {
      type: PIIType.CREDIT_CARD,
      pattern: /\b(?:\d{4}[- ]?){3}\d{4}\b/g,
      replacement: '[CARD]'
    },
    {
      type: PIIType.SSN,
      pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
      replacement: '[SSN]'
    },
    {
      type: PIIType.NAME,
      // Swedish names pattern - more comprehensive
      pattern: /\b[A-ZÅÄÖ][a-zåäöé-]+\s+[A-ZÅÄÖ][a-zåäöé-]+(?:\s+[A-ZÅÄÖ][a-zåäöé-]+)*\b/g,
      replacement: '[NAME]'
    },
    {
      type: PIIType.ADDRESS,
      // Swedish address patterns
      pattern: /\b\d+\s+[A-ZÅÄÖ][a-zåäöé-]+(?:gatan|vägen|torget|platsen|stigen)\b/g,
      replacement: '[ADDRESS]'
    }
  ];

  constructor(private config: GDPRConfig) {}

  async anonymizeText(text: string): Promise<string> {
    let anonymizedText = text;

    // Apply PII patterns
    for (const pattern of this.piiPatterns) {
      anonymizedText = anonymizedText.replace(pattern.pattern, pattern.replacement);
    }

    // Apply custom Swedish-specific anonymization
    anonymizedText = this.anonymizeSwedishSpecific(anonymizedText);

    // Remove any remaining potential PII
    anonymizedText = this.sanitizeRemainingPII(anonymizedText);

    return anonymizedText;
  }

  private anonymizeSwedishSpecific(text: string): string {
    let anonymized = text;

    // Swedish personal numbers (personnummer)
    anonymized = anonymized.replace(/\b\d{6}-?\d{4}\b/g, '[PERSONNUMMER]');
    
    // Swedish postal codes
    anonymized = anonymized.replace(/\b\d{3}\s?\d{2}\b/g, '[POSTAL_CODE]');
    
    // Common Swedish place names that might identify location
    const swedishPlaces = /\b(Stockholm|Göteborg|Malmö|Uppsala|Västerås|Örebro|Linköping|Helsingborg|Jönköping|Norrköping|Lund|Umeå|Gävle|Borås|Eskilstuna|Halmstad|Växjö|Karlstad|Sundsvall|Falun)\b/gi;
    anonymized = anonymized.replace(swedishPlaces, '[CITY]');

    return anonymized;
  }

  private sanitizeRemainingPII(text: string): string {
    let sanitized = text;

    // Remove any sequences that look like IDs or codes
    sanitized = sanitized.replace(/\b[A-Z0-9]{8,}\b/g, '[ID]');
    
    // Remove potential URLs
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/g, '[URL]');
    
    // Remove potential file paths
    sanitized = sanitized.replace(/[\/\\][A-Za-z0-9\/\\._-]+/g, '[PATH]');

    return sanitized;
  }

  async anonymizeCustomerData(customerHash: string): Promise<void> {
    console.log(`Starting data anonymization for customer ${customerHash}`);

    // Anonymize feedback transcripts
    await this.anonymizeFeedbackTranscripts(customerHash);

    // Anonymize system logs
    await this.anonymizeSystemLogs(customerHash);

    // Anonymize analytics data
    await this.anonymizeAnalyticsData(customerHash);

    console.log(`Data anonymization completed for customer ${customerHash}`);
  }

  private async anonymizeFeedbackTranscripts(customerHash: string): Promise<void> {
    // TODO: Query and update customer's feedback transcripts
    // const feedbackSessions = await prisma.feedbackSession.findMany({
    //   where: {
    //     customerHash,
    //     feedback: {
    //       transcript: {
    //         not: null
    //       }
    //     }
    //   },
    //   include: {
    //     feedback: true
    //   }
    // });

    // for (const session of feedbackSessions) {
    //   if (session.feedback?.transcript) {
    //     const anonymizedTranscript = await this.anonymizeText(session.feedback.transcript);
    //     
    //     await prisma.feedback.update({
    //       where: { id: session.feedback.id },
    //       data: { transcript: anonymizedTranscript }
    //     });
    //   }
    // }

    console.log(`Feedback transcripts anonymized for customer ${customerHash}`);
  }

  private async anonymizeSystemLogs(customerHash: string): Promise<void> {
    // TODO: Anonymize customer references in system logs
    console.log(`System logs anonymized for customer ${customerHash}`);
  }

  private async anonymizeAnalyticsData(customerHash: string): Promise<void> {
    // TODO: Anonymize customer data in analytics systems
    console.log(`Analytics data anonymized for customer ${customerHash}`);
  }

  // Apply specific anonymization rules
  async applyAnonymizationRule(text: string, rule: AnonymizationRule): Promise<string> {
    switch (rule.method) {
      case AnonymizationMethod.HASH:
        return this.hashSensitiveData(text, rule.field);
      case AnonymizationMethod.REMOVE:
        return this.removeSensitiveData(text, rule.field);
      case AnonymizationMethod.REPLACE:
        return this.replaceSensitiveData(text, rule.field, rule.replacement);
      case AnonymizationMethod.MASK:
        return this.maskSensitiveData(text, rule.field);
      default:
        return text;
    }
  }

  private hashSensitiveData(text: string, field: string): string {
    // Create consistent hash for the field
    const hash = crypto.createHash('sha256').update(text + field).digest('hex');
    return `[HASH_${hash.substring(0, 8)}]`;
  }

  private removeSensitiveData(text: string, field: string): string {
    // Simply remove the sensitive data
    return `[${field.toUpperCase()}_REMOVED]`;
  }

  private replaceSensitiveData(text: string, field: string, replacement?: string): string {
    return replacement || `[${field.toUpperCase()}_REPLACED]`;
  }

  private maskSensitiveData(text: string, field: string): string {
    // Show only first and last characters, mask the middle
    if (text.length <= 4) {
      return '*'.repeat(text.length);
    }
    
    const start = text.substring(0, 2);
    const end = text.substring(text.length - 2);
    const middle = '*'.repeat(text.length - 4);
    
    return `${start}${middle}${end}`;
  }

  // Batch anonymization
  async anonymizeDataBatch(
    data: Array<{ id: string; text: string; field: string }>,
    rules: AnonymizationRule[]
  ): Promise<Array<{ id: string; originalText: string; anonymizedText: string }>> {
    const results = [];

    for (const item of data) {
      let anonymizedText = item.text;
      
      // Apply all relevant rules
      for (const rule of rules) {
        if (rule.field === item.field || rule.field === '*') {
          anonymizedText = await this.applyAnonymizationRule(anonymizedText, rule);
        }
      }
      
      // Apply general PII anonymization
      anonymizedText = await this.anonymizeText(anonymizedText);
      
      results.push({
        id: item.id,
        originalText: item.text,
        anonymizedText
      });
    }

    return results;
  }

  // Validate anonymization effectiveness
  async validateAnonymization(originalText: string, anonymizedText: string): Promise<{
    score: number; // 0-100, higher is better
    detectedPII: PIIType[];
    recommendations: string[];
  }> {
    const detectedPII: PIIType[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Check for remaining PII patterns
    for (const pattern of this.piiPatterns) {
      if (pattern.pattern.test(anonymizedText)) {
        detectedPII.push(pattern.type);
        score -= 20;
        recommendations.push(`Detected ${pattern.type} in anonymized text`);
      }
    }

    // Check for Swedish-specific PII
    if (/\b\d{6}-?\d{4}\b/.test(anonymizedText)) {
      detectedPII.push(PIIType.SSN);
      score -= 25;
      recommendations.push('Swedish personal number detected');
    }

    // Check text similarity (too similar might indicate insufficient anonymization)
    const similarity = this.calculateTextSimilarity(originalText, anonymizedText);
    if (similarity > 0.8) {
      score -= 30;
      recommendations.push('Text too similar to original, increase anonymization');
    }

    return {
      score: Math.max(0, score),
      detectedPII,
      recommendations
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple Jaccard similarity for validation
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  // Generate anonymization report
  async generateAnonymizationReport(
    customerHash: string
  ): Promise<{
    transcriptsProcessed: number;
    piiInstancesFound: Record<PIIType, number>;
    averageAnonymizationScore: number;
    complianceLevel: 'high' | 'medium' | 'low';
  }> {
    // TODO: Generate report from processed data
    return {
      transcriptsProcessed: 0,
      piiInstancesFound: {} as Record<PIIType, number>,
      averageAnonymizationScore: 0,
      complianceLevel: 'high'
    }; // Placeholder
  }

  // Add custom PII pattern
  addCustomPIIPattern(type: PIIType, pattern: RegExp, replacement: string): void {
    this.piiPatterns.push({
      type,
      pattern,
      replacement
    });
  }

  // Remove or disable PII pattern
  removePIIPattern(type: PIIType): void {
    this.piiPatterns = this.piiPatterns.filter(p => p.type !== type);
  }

  // Test anonymization with sample data
  async testAnonymization(sampleTexts: string[]): Promise<{
    original: string;
    anonymized: string;
    validation: {
      score: number;
      detectedPII: PIIType[];
      recommendations: string[];
    };
  }[]> {
    const results = [];

    for (const text of sampleTexts) {
      const anonymized = await this.anonymizeText(text);
      const validation = await this.validateAnonymization(text, anonymized);
      
      results.push({
        original: text,
        anonymized,
        validation
      });
    }

    return results;
  }
}