import crypto from 'crypto';
import * as natural from 'natural';
import * as levenshtein from 'fast-levenshtein';
import { compareTwoStrings, findBestMatch } from 'string-similarity';
import { distance } from 'ml-distance';
import { stemmer } from 'stemmer';
import {
  FraudCheck,
  ContentFingerprint,
  DuplicateMatch,
  ContentPattern,
  SwedishTextNormalization,
  FraudDetectionConfig
} from './types';

/**
 * Advanced duplicate content detection for Swedish voice feedback
 * Uses multiple algorithms to detect various forms of content duplication
 */
export class ContentDuplicateDetector {
  private config: FraudDetectionConfig;
  private contentHistory: Map<string, ContentFingerprint> = new Map();
  private patterns: Map<string, ContentPattern> = new Map();

  // Swedish-specific processing
  private swedishStopWords = new Set([
    'och', 'att', 'det', 'är', 'som', 'på', 'de', 'av', 'för', 'den',
    'med', 'var', 'sig', 'om', 'har', 'inte', 'till', 'eller', 'ett',
    'han', 'hon', 'ska', 'skulle', 'kan', 'kommer', 'från', 'när',
    'här', 'där', 'vad', 'hur', 'varför', 'vilken', 'denna', 'dessa',
    'bara', 'också', 'mycket', 'bra', 'bättre', 'sämre', 'stor', 'liten'
  ]);

  private swedishSynonyms = new Map([
    ['bra', ['bra', 'buna', 'ok', 'okej', 'fint', 'nice', 'najs']],
    ['dåligt', ['dåligt', 'kasst', 'uselt', 'taskigt', 'illa']],
    ['personal', ['personal', 'anställda', 'folk', 'människor', 'tjej', 'kille']],
    ['service', ['service', 'betjäning', 'bemötande', 'kundservice']],
    ['mat', ['mat', 'käk', 'föda', 'måltid', 'lunch', 'middag']],
    ['kaffe', ['kaffe', 'coffee', 'java', 'brygg', 'kopp']]
  ]);

  constructor(config: Partial<FraudDetectionConfig> = {}) {
    this.config = {
      exactMatchThreshold: 1.0,
      fuzzyMatchThreshold: 0.85,
      semanticMatchThreshold: 0.90,
      structuralMatchThreshold: 0.80,
      duplicateContentWeight: 0.8,
      temporalPatternWeight: 0.6,
      devicePatternWeight: 0.7,
      suspiciousTimeWindow: 10,
      maxSubmissionsPerHour: 3,
      minPatternOccurrences: 3,
      suspiciousPatternThreshold: 0.7,
      conservativeMode: true,
      conservativeModeMultiplier: 1.3,
      ...config
    };
  }

  /**
   * Main entry point: analyze content for duplication
   */
  async analyzeContent(
    content: string,
    sessionId: string,
    deviceFingerprint?: string,
    timestamp: Date = new Date()
  ): Promise<FraudCheck> {
    // Normalize and fingerprint content
    const normalized = this.normalizeSwedishText(content);
    const fingerprint = this.generateContentFingerprint(normalized, timestamp);
    
    // Store fingerprint for future comparisons
    this.contentHistory.set(sessionId, fingerprint);

    // Run all detection algorithms
    const exactMatches = this.findExactMatches(fingerprint);
    const fuzzyMatches = this.findFuzzyMatches(normalized);
    const semanticMatches = await this.findSemanticMatches(normalized);
    const structuralMatches = this.findStructuralMatches(normalized);
    const suspiciousPatterns = this.detectSuspiciousPatterns(normalized);

    // Calculate risk score
    const riskScore = this.calculateDuplicateRiskScore({
      exactMatches,
      fuzzyMatches,
      semanticMatches,
      structuralMatches,
      suspiciousPatterns,
      deviceFingerprint,
      timestamp
    });

    // Build evidence
    const evidence = {
      exactMatches: exactMatches.length,
      fuzzyMatches: fuzzyMatches.filter(m => m.similarity >= this.config.fuzzyMatchThreshold).length,
      semanticMatches: semanticMatches.filter(m => m.similarity >= this.config.semanticMatchThreshold).length,
      structuralMatches: structuralMatches.filter(m => m.similarity >= this.config.structuralMatchThreshold).length,
      suspiciousPatterns: suspiciousPatterns.length,
      contentLength: content.length,
      wordCount: normalized.original.split(/\\s+/).length,
      normalizedContent: normalized.normalized.substring(0, 200) + '...',
      duplicateDetails: {
        highestSimilarity: Math.max(
          ...exactMatches.map(m => m.similarity),
          ...fuzzyMatches.map(m => m.similarity),
          ...semanticMatches.map(m => m.similarity),
          0
        ),
        mostSimilarSession: this.findMostSimilarSession([
          ...exactMatches,
          ...fuzzyMatches,
          ...semanticMatches
        ])
      }
    };

    // Apply conservative mode multiplier
    let finalScore = riskScore;
    if (this.config.conservativeMode) {
      finalScore = Math.min(1.0, riskScore * this.config.conservativeModeMultiplier);
    }

    // Determine confidence and severity
    const confidence = this.calculateConfidence(evidence);
    const severity = this.determineSeverity(finalScore);

    return {
      type: 'content_duplicate',
      score: finalScore,
      evidence,
      confidence,
      description: this.generateDescription(finalScore, evidence),
      severity
    };
  }

  /**
   * Normalize Swedish text for comparison
   */
  private normalizeSwedishText(content: string): SwedishTextNormalization {
    // Basic cleaning
    let normalized = content.toLowerCase()
      .trim()
      .replace(/[.,!?;:()\\[\\]{}\"']/g, '') // Remove punctuation
      .replace(/\\s+/g, ' ')               // Normalize whitespace
      .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o'); // Normalize Swedish characters

    // Extract keywords (non-stop words)
    const words = normalized.split(/\\s+/);
    const keywords = words.filter(word => 
      word.length > 2 && !this.swedishStopWords.has(word)
    );

    // Generate stemmed version
    const stemmed = keywords.map(word => stemmer(word)).join(' ');

    // Generate phonetic representation (simplified for Swedish)
    const phonetic = this.generateSwedishPhonetic(normalized);

    return {
      original: content,
      normalized,
      stemmed,
      phonetic,
      keywords
    };
  }

  /**
   * Generate content fingerprint with multiple hashing strategies
   */
  private generateContentFingerprint(
    normalized: SwedishTextNormalization,
    timestamp: Date
  ): ContentFingerprint {
    const exactHash = crypto
      .createHash('sha256')
      .update(normalized.normalized)
      .digest('hex');

    const phoneticHash = crypto
      .createHash('sha256')
      .update(normalized.phonetic)
      .digest('hex');

    const semanticHash = crypto
      .createHash('sha256')
      .update(normalized.stemmed)
      .digest('hex');

    const structureHash = crypto
      .createHash('sha256')
      .update(this.extractStructure(normalized.normalized))
      .digest('hex');

    const keywordsHash = crypto
      .createHash('sha256')
      .update(normalized.keywords.sort().join(' '))
      .digest('hex');

    return {
      exactHash,
      phoneticHash,
      semanticHash,
      structureHash,
      keywordsHash,
      length: normalized.original.length,
      wordCount: normalized.normalized.split(/\\s+/).length,
      timestamp
    };
  }

  /**
   * Find exact matches using hash comparison
   */
  private findExactMatches(fingerprint: ContentFingerprint): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];

    for (const [sessionId, storedFingerprint] of this.contentHistory) {
      if (storedFingerprint.exactHash === fingerprint.exactHash) {
        matches.push({
          sessionId,
          similarity: 1.0,
          matchType: 'exact',
          confidence: 1.0,
          evidence: {
            matchedSegments: ['entire_content'],
            differenceRatio: 0.0,
            timestampDelta: Math.abs(
              fingerprint.timestamp.getTime() - storedFingerprint.timestamp.getTime()
            ) / (1000 * 60) // Convert to minutes
          }
        });
      }
    }

    return matches;
  }

  /**
   * Find fuzzy matches using Levenshtein distance and string similarity
   */
  private findFuzzyMatches(normalized: SwedishTextNormalization): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];
    const currentText = normalized.normalized;

    for (const [sessionId, storedFingerprint] of this.contentHistory) {
      // Get stored normalized text (simplified - in production, store this)
      const storedText = this.reconstructNormalizedText(sessionId, storedFingerprint);
      
      if (storedText) {
        // Calculate similarity using multiple algorithms
        const jaccardSimilarity = this.calculateJaccardSimilarity(currentText, storedText);
        const levenshteinSimilarity = 1 - (levenshtein.get(currentText, storedText) / Math.max(currentText.length, storedText.length));
        const cosineSimilarity = compareTwoStrings(currentText, storedText);
        
        // Use highest similarity score
        const similarity = Math.max(jaccardSimilarity, levenshteinSimilarity, cosineSimilarity);

        if (similarity >= this.config.fuzzyMatchThreshold) {
          matches.push({
            sessionId,
            similarity,
            matchType: 'fuzzy',
            confidence: this.calculateFuzzyConfidence(similarity, currentText, storedText),
            evidence: {
              matchedSegments: this.findMatchedSegments(currentText, storedText),
              differenceRatio: 1 - similarity,
              timestampDelta: Math.abs(
                Date.now() - storedFingerprint.timestamp.getTime()
              ) / (1000 * 60)
            }
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find semantic matches using keyword and meaning analysis
   */
  private async findSemanticMatches(normalized: SwedishTextNormalization): Promise<DuplicateMatch[]> {
    const matches: DuplicateMatch[] = [];
    const currentKeywords = new Set(normalized.keywords);

    for (const [sessionId, storedFingerprint] of this.contentHistory) {
      // In a full implementation, we'd store normalized text or reconstruct it
      const storedKeywords = this.getStoredKeywords(sessionId, storedFingerprint);
      
      if (storedKeywords) {
        const similarity = this.calculateSemanticSimilarity(currentKeywords, new Set(storedKeywords));
        
        if (similarity >= this.config.semanticMatchThreshold) {
          matches.push({
            sessionId,
            similarity,
            matchType: 'semantic',
            confidence: this.calculateSemanticConfidence(currentKeywords, new Set(storedKeywords)),
            evidence: {
              matchedSegments: this.findSemanticMatches(currentKeywords, new Set(storedKeywords)),
              differenceRatio: 1 - similarity,
              timestampDelta: Math.abs(
                Date.now() - storedFingerprint.timestamp.getTime()
              ) / (1000 * 60)
            }
          });
        }
      }
    }

    return matches;
  }

  /**
   * Find structural matches using sentence patterns
   */
  private findStructuralMatches(normalized: SwedishTextNormalization): DuplicateMatch[] {
    const matches: DuplicateMatch[] = [];
    const currentStructure = this.extractStructure(normalized.normalized);

    for (const [sessionId, storedFingerprint] of this.contentHistory) {
      if (storedFingerprint.structureHash) {
        const storedStructure = this.getStoredStructure(sessionId, storedFingerprint);
        
        if (storedStructure) {
          const similarity = compareTwoStrings(currentStructure, storedStructure);
          
          if (similarity >= this.config.structuralMatchThreshold) {
            matches.push({
              sessionId,
              similarity,
              matchType: 'structural',
              confidence: this.calculateStructuralConfidence(currentStructure, storedStructure),
              evidence: {
                matchedSegments: this.findStructuralMatches(currentStructure, storedStructure),
                differenceRatio: 1 - similarity,
                timestampDelta: Math.abs(
                  Date.now() - storedFingerprint.timestamp.getTime()
                ) / (1000 * 60)
              }
            });
          }
        }
      }
    }

    return matches;
  }

  /**
   * Detect suspicious patterns (templates, scripts, repeated phrases)
   */
  private detectSuspiciousPatterns(normalized: SwedishTextNormalization): ContentPattern[] {
    const suspiciousPatterns: ContentPattern[] = [];
    const text = normalized.normalized;

    // Look for template-like patterns
    const templatePatterns = [
      /jag tycker att .* är .*/g,
      /personalen .* var .*/g,
      /service .* kunde .*/g,
      /det var .* att .*/g,
      /bra .* men .* kunde .*/g
    ];

    templatePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        matches.forEach(match => {
          const existingPattern = this.patterns.get(match);
          if (existingPattern) {
            existingPattern.occurrences++;
            existingPattern.sessions.push('current'); // In production, use actual session ID
          } else {
            this.patterns.set(match, {
              pattern: match,
              occurrences: 1,
              sessions: ['current'],
              suspiciousThreshold: this.config.suspiciousPatternThreshold,
              confidence: 0.8
            });
          }

          if (existingPattern && existingPattern.occurrences >= this.config.minPatternOccurrences) {
            suspiciousPatterns.push(existingPattern);
          }
        });
      }
    });

    return suspiciousPatterns;
  }

  /**
   * Calculate overall duplicate content risk score
   */
  private calculateDuplicateRiskScore(evidence: {
    exactMatches: DuplicateMatch[];
    fuzzyMatches: DuplicateMatch[];
    semanticMatches: DuplicateMatch[];
    structuralMatches: DuplicateMatch[];
    suspiciousPatterns: ContentPattern[];
    deviceFingerprint?: string;
    timestamp: Date;
  }): number {
    let riskScore = 0;

    // Exact matches = immediate high risk
    if (evidence.exactMatches.length > 0) {
      return 0.95; // Almost certain fraud
    }

    // Fuzzy matches
    const highFuzzyMatches = evidence.fuzzyMatches.filter(m => m.similarity >= 0.9);
    if (highFuzzyMatches.length > 0) {
      riskScore += 0.7 * Math.min(1, highFuzzyMatches.length / 2);
    }

    // Semantic matches
    const highSemanticMatches = evidence.semanticMatches.filter(m => m.similarity >= 0.95);
    if (highSemanticMatches.length > 0) {
      riskScore += 0.6 * Math.min(1, highSemanticMatches.length / 2);
    }

    // Structural matches
    const highStructuralMatches = evidence.structuralMatches.filter(m => m.similarity >= 0.85);
    if (highStructuralMatches.length > 0) {
      riskScore += 0.5 * Math.min(1, highStructuralMatches.length / 2);
    }

    // Suspicious patterns
    if (evidence.suspiciousPatterns.length > 0) {
      riskScore += 0.4 * Math.min(1, evidence.suspiciousPatterns.length / 3);
    }

    // Temporal pattern (multiple submissions in short time)
    const recentMatches = [...evidence.fuzzyMatches, ...evidence.semanticMatches]
      .filter(m => m.evidence.timestampDelta < this.config.suspiciousTimeWindow);
    
    if (recentMatches.length > 0) {
      riskScore += 0.3 * Math.min(1, recentMatches.length / 2);
    }

    return Math.min(1, riskScore);
  }

  // Helper methods for text processing and similarity calculation

  private generateSwedishPhonetic(text: string): string {
    // Simplified Swedish phonetic representation
    return text
      .replace(/ck/g, 'k')
      .replace(/th/g, 't')
      .replace(/ph/g, 'f')
      .replace(/ch/g, 'sh')
      .replace(/å/g, 'ao')
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe');
  }

  private extractStructure(text: string): string {
    // Extract sentence structure (simplified)
    return text
      .replace(/\\b\\w+\\b/g, 'W') // Replace words with W
      .replace(/\\d+/g, 'N')      // Replace numbers with N
      .replace(/\\s+/g, ' ');     // Normalize spaces
  }

  private calculateJaccardSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\\s+/));
    const words2 = new Set(text2.split(/\\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private calculateSemanticSimilarity(keywords1: Set<string>, keywords2: Set<string>): number {
    let totalSimilarity = 0;
    let comparisons = 0;

    // Direct keyword matches
    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
    const union = new Set([...keywords1, ...keywords2]);
    const directSimilarity = intersection.size / union.size;

    // Synonym matches
    let synonymMatches = 0;
    for (const word1 of keywords1) {
      for (const word2 of keywords2) {
        if (this.areSynonyms(word1, word2)) {
          synonymMatches++;
        }
      }
    }
    
    const synonymSimilarity = synonymMatches / Math.max(keywords1.size, keywords2.size);
    
    return Math.max(directSimilarity, synonymSimilarity * 0.8); // Weight synonym matches slightly lower
  }

  private areSynonyms(word1: string, word2: string): boolean {
    for (const [key, synonyms] of this.swedishSynonyms) {
      if (synonyms.includes(word1) && synonyms.includes(word2)) {
        return true;
      }
    }
    return false;
  }

  private findMatchedSegments(text1: string, text2: string): string[] {
    const words1 = text1.split(/\\s+/);
    const words2 = text2.split(/\\s+/);
    const matches: string[] = [];

    // Find common n-grams
    for (let n = 3; n <= Math.min(5, Math.min(words1.length, words2.length)); n++) {
      for (let i = 0; i <= words1.length - n; i++) {
        const ngram = words1.slice(i, i + n).join(' ');
        if (text2.includes(ngram)) {
          matches.push(ngram);
        }
      }
    }

    return [...new Set(matches)]; // Remove duplicates
  }

  private findSemanticMatches(keywords1: Set<string>, keywords2: Set<string>): string[] {
    const matches: string[] = [];
    
    for (const word1 of keywords1) {
      if (keywords2.has(word1)) {
        matches.push(word1);
      } else {
        for (const word2 of keywords2) {
          if (this.areSynonyms(word1, word2)) {
            matches.push(`${word1}~${word2}`);
          }
        }
      }
    }
    
    return matches;
  }

  private findStructuralMatches(structure1: string, structure2: string): string[] {
    // Find common structural patterns
    const patterns1 = structure1.split(' ');
    const patterns2 = structure2.split(' ');
    const matches: string[] = [];

    for (let i = 0; i < patterns1.length - 2; i++) {
      const pattern = patterns1.slice(i, i + 3).join(' ');
      if (structure2.includes(pattern)) {
        matches.push(pattern);
      }
    }

    return [...new Set(matches)];
  }

  private calculateConfidence(evidence: any): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence with multiple types of matches
    const matchTypes = [
      evidence.exactMatches > 0,
      evidence.fuzzyMatches > 0,
      evidence.semanticMatches > 0,
      evidence.structuralMatches > 0
    ].filter(Boolean).length;

    confidence += matchTypes * 0.15;

    // Higher confidence with higher similarity scores
    if (evidence.duplicateDetails?.highestSimilarity > 0.9) {
      confidence += 0.2;
    }

    return Math.min(1, confidence);
  }

  private determineSeverity(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore >= 0.8) return 'high';
    if (riskScore >= 0.5) return 'medium';
    return 'low';
  }

  private generateDescription(riskScore: number, evidence: any): string {
    if (evidence.exactMatches > 0) {
      return `Exact duplicate content detected (${evidence.exactMatches} matches)`;
    }
    
    if (evidence.fuzzyMatches > 0) {
      return `High similarity content detected (max similarity: ${Math.round(evidence.duplicateDetails?.highestSimilarity * 100)}%)`;
    }
    
    if (evidence.semanticMatches > 0) {
      return `Semantically similar content detected (${evidence.semanticMatches} matches)`;
    }
    
    if (evidence.suspiciousPatterns > 0) {
      return `Suspicious content patterns detected (${evidence.suspiciousPatterns} patterns)`;
    }
    
    return `Low risk of content duplication (score: ${Math.round(riskScore * 100)}%)`;
  }

  private findMostSimilarSession(matches: DuplicateMatch[]): string | null {
    if (matches.length === 0) return null;
    
    const bestMatch = matches.reduce((prev, current) => 
      (prev.similarity > current.similarity) ? prev : current
    );
    
    return bestMatch.sessionId;
  }

  // Placeholder methods (in production, these would query database or cache)
  private reconstructNormalizedText(sessionId: string, fingerprint: ContentFingerprint): string | null {
    // In production: retrieve stored normalized text from database/cache
    return null;
  }

  private getStoredKeywords(sessionId: string, fingerprint: ContentFingerprint): string[] | null {
    // In production: retrieve stored keywords from database/cache
    return null;
  }

  private getStoredStructure(sessionId: string, fingerprint: ContentFingerprint): string | null {
    // In production: retrieve stored structure from database/cache
    return null;
  }

  private calculateFuzzyConfidence(similarity: number, text1: string, text2: string): number {
    const lengthRatio = Math.min(text1.length, text2.length) / Math.max(text1.length, text2.length);
    return similarity * lengthRatio;
  }

  private calculateSemanticConfidence(keywords1: Set<string>, keywords2: Set<string>): number {
    const minSize = Math.min(keywords1.size, keywords2.size);
    const maxSize = Math.max(keywords1.size, keywords2.size);
    return minSize / maxSize;
  }

  private calculateStructuralConfidence(structure1: string, structure2: string): number {
    const lengthRatio = Math.min(structure1.length, structure2.length) / Math.max(structure1.length, structure2.length);
    return lengthRatio;
  }

  /**
   * Clean up old content history to prevent memory leaks
   */
  public cleanupHistory(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [sessionId, fingerprint] of this.contentHistory) {
      if (fingerprint.timestamp < cutoff) {
        this.contentHistory.delete(sessionId);
      }
    }
  }

  /**
   * Get statistics about detection performance
   */
  public getStats(): {
    contentHistorySize: number;
    patternsDetected: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
  } {
    const timestamps = Array.from(this.contentHistory.values()).map(f => f.timestamp);
    
    return {
      contentHistorySize: this.contentHistory.size,
      patternsDetected: this.patterns.size,
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : null,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : null
    };
  }
}