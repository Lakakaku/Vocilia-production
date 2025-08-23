import { 
  FeedbackSession, 
  FraudFlag, 
  FraudType, 
  DeviceFingerprint 
} from '@feedback-platform/shared-types';
import { ContentDuplicateDetector } from './ContentDuplicateDetector';
import { VoicePatternAnalyzer } from './VoicePatternAnalyzer';
import { 
  FraudCheck, 
  FraudAnalysisResult, 
  FraudDetectionConfig 
} from './types';

/**
 * Comprehensive fraud detection service for AI Feedback Platform
 * Orchestrates multiple fraud detection algorithms and provides unified analysis
 */
export class FraudDetectorService {
  private contentDetector: ContentDuplicateDetector;
  private voicePatternAnalyzer: VoicePatternAnalyzer;
  private config: FraudDetectionConfig;
  private detectionHistory: Map<string, FraudAnalysisResult> = new Map();

  constructor(config: Partial<FraudDetectionConfig> = {}) {
    this.config = {
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
      conservativeModeMultiplier: 1.3,
      ...config
    };

    this.contentDetector = new ContentDuplicateDetector(this.config);
    this.voicePatternAnalyzer = new VoicePatternAnalyzer(this.config);
  }

  /**
   * Main entry point: analyze a feedback session for fraud
   */
  async analyzeSession(session: {
    id: string;
    transcript: string;
    customerHash: string;
    deviceFingerprint?: DeviceFingerprint;
    timestamp: Date;
    businessId: string;
    locationId: string;
    purchaseAmount: number;
    audioData?: ArrayBuffer; // Added for voice pattern analysis
  }): Promise<FraudAnalysisResult> {
    try {
      // Prepare voice pattern analysis check
      const voicePatternCheck = session.audioData 
        ? this.voicePatternAnalyzer.analyzeVoicePattern(
            session.audioData,
            session.id,
            session.customerHash,
            session.transcript
          )
        : this.createMissingVoiceDataCheck();

      // Run all fraud detection checks in parallel
      const checks = await Promise.all([
        this.contentDetector.analyzeContent(
          session.transcript,
          session.id,
          session.deviceFingerprint?.userAgent,
          session.timestamp
        ),
        this.checkDeviceFingerprint(session.deviceFingerprint, session.customerHash),
        this.checkTemporalPatterns(session.customerHash, session.timestamp),
        this.checkGeographicPatterns(session.customerHash, session.locationId),
        this.checkContextAuthenticity(session.transcript, session.businessId),
        this.checkSubmissionFrequency(session.customerHash, session.timestamp),
        voicePatternCheck // Add voice pattern analysis to the checks
      ]);

      // Calculate overall risk score
      const overallRiskScore = this.calculateOverallRiskScore(checks);

      // Generate fraud flags
      const flags = this.generateFraudFlags(checks, session.id);

      // Determine recommendation
      const recommendation = this.determineRecommendation(overallRiskScore, flags);

      // Calculate overall confidence
      const confidence = this.calculateOverallConfidence(checks);

      const result: FraudAnalysisResult = {
        overallRiskScore,
        flags,
        checks,
        recommendation,
        confidence
      };

      // Store result for future pattern analysis
      this.detectionHistory.set(session.id, result);

      return result;
    } catch (error) {
      // Fallback to conservative approach on error
      const fallbackResult: FraudAnalysisResult = {
        overallRiskScore: 0.3, // Conservative but not blocking
        flags: [{
          type: 'content_duplicate',
          severity: 'low',
          description: 'Fraud detection error - conservative analysis applied',
          confidence: 0.5,
          data: { error: error instanceof Error ? error.message : 'Unknown error' }
        }],
        checks: [],
        recommendation: 'review',
        confidence: 0.5
      };

      return fallbackResult;
    }
  }

  /**
   * Create a fallback check when voice data is not available
   */
  private createMissingVoiceDataCheck(): Promise<FraudCheck> {
    return Promise.resolve({
      type: 'voice_pattern',
      score: 0.1, // Low risk when no voice data
      evidence: { 
        reason: 'missing_voice_data',
        message: 'No audio data provided for voice pattern analysis' 
      },
      confidence: 0.3,
      description: 'Voice pattern analysis skipped - no audio data available',
      severity: 'low'
    });
  }

  /**
   * Check device fingerprint for suspicious patterns
   */
  private async checkDeviceFingerprint(
    deviceFingerprint?: DeviceFingerprint,
    customerHash?: string
  ): Promise<FraudCheck> {
    let riskScore = 0;
    const evidence: any = {};

    if (!deviceFingerprint) {
      return {
        type: 'device_abuse',
        score: 0.2,
        evidence: { reason: 'missing_fingerprint' },
        confidence: 0.3,
        description: 'No device fingerprint provided',
        severity: 'low'
      };
    }

    // Check for suspicious user agents
    const suspiciousUserAgents = [
      /headless/i,
      /phantom/i,
      /selenium/i,
      /bot/i,
      /crawler/i,
      /automation/i
    ];

    for (const pattern of suspiciousUserAgents) {
      if (pattern.test(deviceFingerprint.userAgent)) {
        riskScore += 0.8;
        evidence.suspiciousUserAgent = true;
        evidence.userAgentPattern = pattern.toString();
        break;
      }
    }

    // Check for missing standard browser features
    if (!deviceFingerprint.cookieEnabled) {
      riskScore += 0.3;
      evidence.cookiesDisabled = true;
    }

    if (deviceFingerprint.doNotTrack === undefined) {
      riskScore += 0.1;
      evidence.missingDoNotTrack = true;
    }

    // Check for unusual screen resolutions (common in headless browsers)
    if (deviceFingerprint.screenResolution) {
      const [width, height] = deviceFingerprint.screenResolution.split('x').map(Number);
      if (width < 800 || height < 600 || width > 4000 || height > 3000) {
        riskScore += 0.2;
        evidence.unusualScreenResolution = deviceFingerprint.screenResolution;
      }
    }

    // Check for device consistency (simplified - in production would be more complex)
    evidence.deviceFingerprint = {
      userAgent: deviceFingerprint.userAgent.substring(0, 100),
      platform: deviceFingerprint.platform,
      language: deviceFingerprint.language,
      timezone: deviceFingerprint.timezone
    };

    const confidence = deviceFingerprint ? 0.7 : 0.3;
    const severity = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'medium' : 'low';

    return {
      type: 'device_abuse',
      score: Math.min(1, riskScore),
      evidence,
      confidence,
      description: this.generateDeviceDescription(riskScore, evidence),
      severity
    };
  }

  /**
   * Check temporal patterns for suspicious behavior
   */
  private async checkTemporalPatterns(
    customerHash: string,
    timestamp: Date
  ): Promise<FraudCheck> {
    let riskScore = 0;
    const evidence: any = { customerHash: customerHash?.substring(0, 8) + '...' };

    // Get recent submissions for this customer hash
    const recentSubmissions = this.getRecentSubmissions(customerHash, timestamp);
    evidence.recentSubmissions = recentSubmissions.length;

    // Check submission frequency
    const oneHourAgo = new Date(timestamp.getTime() - 60 * 60 * 1000);
    const submissionsLastHour = recentSubmissions.filter(
      submission => submission.timestamp >= oneHourAgo
    );

    if (submissionsLastHour.length > this.config.maxSubmissionsPerHour) {
      riskScore += 0.6;
      evidence.excessiveSubmissions = submissionsLastHour.length;
      evidence.maxAllowed = this.config.maxSubmissionsPerHour;
    }

    // Check for rapid-fire submissions
    const rapidSubmissions = recentSubmissions.filter((submission, index) => {
      if (index === 0) return false;
      const timeDiff = submission.timestamp.getTime() - recentSubmissions[index - 1].timestamp.getTime();
      return timeDiff < 2 * 60 * 1000; // Less than 2 minutes apart
    });

    if (rapidSubmissions.length > 0) {
      riskScore += 0.4;
      evidence.rapidFireSubmissions = rapidSubmissions.length;
    }

    // Check for unusual timing patterns (e.g., submissions at exact intervals)
    if (recentSubmissions.length >= 3) {
      const intervals = [];
      for (let i = 1; i < recentSubmissions.length; i++) {
        const interval = recentSubmissions[i].timestamp.getTime() - recentSubmissions[i-1].timestamp.getTime();
        intervals.push(interval);
      }

      // Check for suspiciously regular intervals
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const intervalVariance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
      
      if (intervalVariance < 10000 && intervals.length >= 2) { // Very consistent intervals
        riskScore += 0.3;
        evidence.suspiciousRegularIntervals = {
          averageInterval: Math.round(avgInterval / 1000), // seconds
          variance: Math.round(intervalVariance)
        };
      }
    }

    const confidence = recentSubmissions.length >= 2 ? 0.8 : 0.4;
    const severity = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'medium' : 'low';

    return {
      type: 'temporal_pattern',
      score: Math.min(1, riskScore),
      evidence,
      confidence,
      description: this.generateTemporalDescription(riskScore, evidence),
      severity
    };
  }

  /**
   * Check geographic patterns for suspicious behavior
   */
  private async checkGeographicPatterns(
    customerHash: string,
    locationId: string
  ): Promise<FraudCheck> {
    let riskScore = 0;
    const evidence: any = { 
      customerHash: customerHash?.substring(0, 8) + '...',
      currentLocation: locationId
    };

    // Get recent locations for this customer hash
    const recentLocations = this.getRecentLocations(customerHash);
    evidence.recentLocations = recentLocations.length;

    // Check for impossible travel (submissions from distant locations too quickly)
    if (recentLocations.length > 1) {
      for (let i = 1; i < recentLocations.length; i++) {
        const prev = recentLocations[i - 1];
        const current = recentLocations[i];
        
        // In production, calculate actual distance between locations
        const timeDiff = current.timestamp.getTime() - prev.timestamp.getTime();
        const timeDiffHours = timeDiff / (1000 * 60 * 60);
        
        // Simplified: assume different location IDs could be far apart
        if (prev.locationId !== current.locationId && timeDiffHours < 1) {
          riskScore += 0.4;
          evidence.impossibleTravel = {
            from: prev.locationId,
            to: current.locationId,
            timeDiffMinutes: Math.round(timeDiff / (1000 * 60))
          };
        }
      }
    }

    // Check for excessive location switching
    const uniqueLocations = new Set(recentLocations.map(l => l.locationId));
    if (uniqueLocations.size > 5) {
      riskScore += 0.3;
      evidence.excessiveLocationSwitching = uniqueLocations.size;
    }

    const confidence = recentLocations.length >= 2 ? 0.7 : 0.3;
    const severity = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'medium' : 'low';

    return {
      type: 'location_mismatch',
      score: Math.min(1, riskScore),
      evidence,
      confidence,
      description: this.generateGeographicDescription(riskScore, evidence),
      severity
    };
  }

  /**
   * Check context authenticity (feedback matches business context)
   */
  private async checkContextAuthenticity(
    transcript: string,
    businessId: string
  ): Promise<FraudCheck> {
    let riskScore = 0;
    const evidence: any = { businessId };

    // Get business context (simplified - in production would query database)
    const businessContext = await this.getBusinessContext(businessId);
    evidence.hasBusinessContext = !!businessContext;

    if (!businessContext) {
      return {
        type: 'context_mismatch',
        score: 0.1,
        evidence,
        confidence: 0.2,
        description: 'No business context available for verification',
        severity: 'low'
      };
    }

    const transcript_lower = transcript.toLowerCase();

    // Check for context mismatches (simplified analysis)
    const businessType = businessContext.type;
    evidence.businessType = businessType;

    // Check for inappropriate mentions for business type
    const inappropriateForBusiness: Record<string, string[]> = {
      'cafe': ['bil', 'bank', 'läkare', 'tandläkare', 'sjukhus'],
      'grocery_store': ['coffee', 'latte', 'cappuccino', 'cocktail', 'alkohol'],
      'restaurant': ['shopping', 'kläder', 'skor', 'elektronik'],
      'retail': ['mat', 'meny', 'servitör', 'kök', 'tallrik']
    };

    const inappropriate = inappropriateForBusiness[businessType] || [];
    const foundInappropriate = inappropriate.filter(word => transcript_lower.includes(word));
    
    if (foundInappropriate.length > 0) {
      riskScore += 0.4 * (foundInappropriate.length / inappropriate.length);
      evidence.inappropriateTerms = foundInappropriate;
    }

    // Check for generic/template-like feedback
    const genericPhrases = [
      'bra service',
      'trevlig personal',
      'allt var bra',
      'inget att klaga på',
      'som vanligt',
      'rekommenderar starkt'
    ];

    const foundGeneric = genericPhrases.filter(phrase => transcript_lower.includes(phrase));
    if (foundGeneric.length >= 3) {
      riskScore += 0.3;
      evidence.genericPhrases = foundGeneric;
    }

    // Check for overly positive or negative sentiment (potential fake)
    const veryPositive = ['fantastisk', 'perfekt', 'suveränt', 'otroligt bra', 'bästa någonsin'];
    const veryNegative = ['fruktansvärt', 'förskräckligt', 'skandal', 'hemsk', 'värsta någonsin'];
    
    const extremePositive = veryPositive.filter(word => transcript_lower.includes(word));
    const extremeNegative = veryNegative.filter(word => transcript_lower.includes(word));
    
    if (extremePositive.length > 2 || extremeNegative.length > 2) {
      riskScore += 0.2;
      evidence.extremeSentiment = {
        positive: extremePositive,
        negative: extremeNegative
      };
    }

    const confidence = businessContext ? 0.6 : 0.2;
    const severity = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'medium' : 'low';

    return {
      type: 'context_mismatch',
      score: Math.min(1, riskScore),
      evidence,
      confidence,
      description: this.generateContextDescription(riskScore, evidence),
      severity
    };
  }

  /**
   * Check submission frequency patterns
   */
  private async checkSubmissionFrequency(
    customerHash: string,
    timestamp: Date
  ): Promise<FraudCheck> {
    let riskScore = 0;
    const evidence: any = { customerHash: customerHash?.substring(0, 8) + '...' };

    // Get submission history
    const submissions = this.getCustomerSubmissionHistory(customerHash);
    evidence.totalSubmissions = submissions.length;

    if (submissions.length === 0) {
      return {
        type: 'temporal_pattern',
        score: 0,
        evidence,
        confidence: 0.5,
        description: 'No submission history available',
        severity: 'low'
      };
    }

    // Calculate submission frequency
    const timeSpan = timestamp.getTime() - submissions[0].timestamp.getTime();
    const timeSpanDays = timeSpan / (1000 * 60 * 60 * 24);
    const avgSubmissionsPerDay = submissions.length / Math.max(1, timeSpanDays);
    
    evidence.avgSubmissionsPerDay = Math.round(avgSubmissionsPerDay * 100) / 100;

    // Flag high-frequency submitters
    if (avgSubmissionsPerDay > 5) {
      riskScore += 0.5;
      evidence.highFrequencySubmitter = true;
    } else if (avgSubmissionsPerDay > 2) {
      riskScore += 0.2;
      evidence.moderateFrequencySubmitter = true;
    }

    // Check for burst patterns (many submissions in short periods)
    const bursts = this.detectSubmissionBursts(submissions);
    if (bursts.length > 0) {
      riskScore += 0.3 * Math.min(1, bursts.length / 3);
      evidence.submissionBursts = bursts.length;
    }

    const confidence = submissions.length >= 5 ? 0.8 : 0.4;
    const severity = riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'medium' : 'low';

    return {
      type: 'temporal_pattern',
      score: Math.min(1, riskScore),
      evidence,
      confidence,
      description: this.generateFrequencyDescription(riskScore, evidence),
      severity
    };
  }

  /**
   * Calculate overall risk score from all checks
   */
  private calculateOverallRiskScore(checks: FraudCheck[]): number {
    let weightedScore = 0;
    let totalWeight = 0;

    const weights: Record<string, number> = {
      'content_duplicate': this.config.duplicateContentWeight,
      'device_abuse': this.config.devicePatternWeight,
      'temporal_pattern': this.config.temporalPatternWeight,
      'voice_synthetic': this.config.voicePatternWeight || 0.8,
      'voice_pattern': this.config.voicePatternWeight || 0.8,
      'location_mismatch': 0.5,
      'context_mismatch': 0.4
    };

    for (const check of checks) {
      const weight = weights[check.type] || 0.3;
      weightedScore += check.score * check.confidence * weight;
      totalWeight += weight;
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    
    // Apply conservative mode multiplier
    return this.config.conservativeMode 
      ? Math.min(1, overallScore * this.config.conservativeModeMultiplier)
      : overallScore;
  }

  /**
   * Generate fraud flags based on checks
   */
  private generateFraudFlags(checks: FraudCheck[], sessionId: string): FraudFlag[] {
    const flags: FraudFlag[] = [];

    for (const check of checks) {
      if (check.score >= 0.3) { // Only flag significant risks
        flags.push({
          type: check.type,
          severity: check.severity,
          description: check.description,
          confidence: check.confidence,
          data: {
            sessionId,
            score: check.score,
            evidence: check.evidence
          }
        });
      }
    }

    return flags;
  }

  /**
   * Determine recommendation based on risk score and flags
   */
  private determineRecommendation(
    overallRiskScore: number, 
    flags: FraudFlag[]
  ): 'accept' | 'review' | 'reject' {
    // Immediate rejection for high-confidence, high-risk cases
    const highRiskFlags = flags.filter(f => f.severity === 'high' && f.confidence >= 0.8);
    if (highRiskFlags.length > 0 && overallRiskScore >= 0.8) {
      return 'reject';
    }

    // Special handling for voice fraud - prioritize synthetic voice detection
    const voiceFraudFlags = flags.filter(f => f.type === 'voice_synthetic' && f.confidence >= 0.7);
    if (voiceFraudFlags.length > 0) {
      return overallRiskScore >= 0.6 ? 'reject' : 'review';
    }

    // Manual review for moderate risk
    if (overallRiskScore >= 0.5 || flags.length >= 2) {
      return 'review';
    }

    // Accept low-risk cases
    return 'accept';
  }

  /**
   * Calculate overall confidence in the fraud analysis
   */
  private calculateOverallConfidence(checks: FraudCheck[]): number {
    if (checks.length === 0) return 0.3;

    const avgConfidence = checks.reduce((sum, check) => sum + check.confidence, 0) / checks.length;
    const checkVariety = Math.min(1, checks.length / 6); // Updated for 6 checks including voice
    
    return Math.min(1, avgConfidence * (0.7 + checkVariety * 0.3));
  }

  // Helper methods for generating descriptions
  private generateDeviceDescription(riskScore: number, evidence: any): string {
    if (evidence.suspiciousUserAgent) {
      return `Suspicious user agent detected: potentially automated`;
    }
    if (riskScore >= 0.5) {
      return `Device fingerprint shows multiple suspicious indicators`;
    }
    return `Device fingerprint appears normal`;
  }

  private generateTemporalDescription(riskScore: number, evidence: any): string {
    if (evidence.excessiveSubmissions) {
      return `Excessive submissions detected: ${evidence.excessiveSubmissions} in last hour (limit: ${evidence.maxAllowed})`;
    }
    if (evidence.rapidFireSubmissions) {
      return `Rapid-fire submissions detected: ${evidence.rapidFireSubmissions} within 2 minutes`;
    }
    if (evidence.suspiciousRegularIntervals) {
      return `Suspiciously regular submission intervals detected`;
    }
    return `Normal temporal submission pattern`;
  }

  private generateGeographicDescription(riskScore: number, evidence: any): string {
    if (evidence.impossibleTravel) {
      return `Impossible travel detected: ${evidence.impossibleTravel.from} to ${evidence.impossibleTravel.to} in ${evidence.impossibleTravel.timeDiffMinutes} minutes`;
    }
    if (evidence.excessiveLocationSwitching) {
      return `Excessive location switching: ${evidence.excessiveLocationSwitching} different locations recently`;
    }
    return `Normal geographic pattern`;
  }

  private generateContextDescription(riskScore: number, evidence: any): string {
    if (evidence.inappropriateTerms?.length > 0) {
      return `Content inappropriate for business type: mentions ${evidence.inappropriateTerms.join(', ')}`;
    }
    if (evidence.genericPhrases?.length >= 3) {
      return `Generic/template-like content detected`;
    }
    if (evidence.extremeSentiment) {
      return `Extreme sentiment detected: potentially artificial`;
    }
    return `Content appears authentic for business context`;
  }

  private generateFrequencyDescription(riskScore: number, evidence: any): string {
    if (evidence.highFrequencySubmitter) {
      return `High-frequency submitter: ${evidence.avgSubmissionsPerDay} submissions/day`;
    }
    if (evidence.submissionBursts) {
      return `Submission burst pattern detected: ${evidence.submissionBursts} burst periods`;
    }
    return `Normal submission frequency pattern`;
  }

  // Data access methods (in production, these would query database)
  private getRecentSubmissions(customerHash: string, timestamp: Date): Array<{timestamp: Date}> {
    // Placeholder: in production, query database for recent submissions by this customer hash
    return [];
  }

  private getRecentLocations(customerHash: string): Array<{locationId: string; timestamp: Date}> {
    // Placeholder: in production, query database for recent locations by this customer hash
    return [];
  }

  private async getBusinessContext(businessId: string): Promise<any> {
    // Placeholder: in production, query database for business context
    return {
      type: 'cafe',
      name: 'Test Café',
      departments: ['counter', 'seating'],
      knownIssues: ['slow wifi'],
      strengths: ['good coffee', 'friendly staff']
    };
  }

  private getCustomerSubmissionHistory(customerHash: string): Array<{timestamp: Date}> {
    // Placeholder: in production, query database for customer submission history
    return [];
  }

  private detectSubmissionBursts(submissions: Array<{timestamp: Date}>): Array<{start: Date; end: Date; count: number}> {
    // Simplified burst detection
    const bursts = [];
    let currentBurst: {start: Date; end: Date; count: number} | null = null;

    for (let i = 1; i < submissions.length; i++) {
      const timeDiff = submissions[i].timestamp.getTime() - submissions[i-1].timestamp.getTime();
      
      if (timeDiff < 10 * 60 * 1000) { // Less than 10 minutes apart
        if (!currentBurst) {
          currentBurst = {
            start: submissions[i-1].timestamp,
            end: submissions[i].timestamp,
            count: 2
          };
        } else {
          currentBurst.end = submissions[i].timestamp;
          currentBurst.count++;
        }
      } else {
        if (currentBurst && currentBurst.count >= 3) {
          bursts.push(currentBurst);
        }
        currentBurst = null;
      }
    }

    if (currentBurst && currentBurst.count >= 3) {
      bursts.push(currentBurst);
    }

    return bursts;
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<FraudDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clean up detection history
   */
  public cleanupHistory(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    // Clean up content detector history
    this.contentDetector.cleanupHistory(maxAge);
    
    // Clean up voice pattern analyzer history
    this.voicePatternAnalyzer.cleanupHistory(maxAge);
    
    // Clean up analysis history
    for (const [sessionId, result] of this.detectionHistory) {
      // In production, this would check actual timestamp from stored result
      // For now, we'll keep recent entries
      if (this.detectionHistory.size > 10000) {
        this.detectionHistory.delete(sessionId);
      }
    }
  }

  /**
   * Get fraud detection statistics
   */
  public getStats(): {
    contentDetectorStats: any;
    voicePatternStats: any;
    analysisHistorySize: number;
    config: FraudDetectionConfig;
  } {
    return {
      contentDetectorStats: this.contentDetector.getStats(),
      voicePatternStats: this.voicePatternAnalyzer.getStats(),
      analysisHistorySize: this.detectionHistory.size,
      config: this.config
    };
  }
}