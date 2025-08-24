/**
 * Fraud Protection Engine
 * Comprehensive fraud detection and prevention for customer reward system
 * 
 * Multi-layer protection:
 * 1. Device fingerprinting limits
 * 2. Geographic/temporal pattern analysis
 * 3. Voice pattern analysis
 * 4. Content duplication detection
 * 5. Risk-based reward reduction
 * 6. Behavioral anomaly detection
 */

export interface FraudRiskAssessment {
  overallRiskScore: number; // 0-1 (1 = highest risk)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  
  // Individual risk factors
  deviceRisk: number;
  geographicRisk: number;
  temporalRisk: number;
  voiceRisk: number;
  contentRisk: number;
  behavioralRisk: number;
  
  // Applied limits and adjustments
  rewardAdjustment: number; // Percentage reduction (0-1)
  dailyLimitReduction: number; // Percentage of daily limit to reduce
  sessionBlocked: boolean;
  
  // Evidence and reasons
  triggeredRules: FraudRule[];
  evidence: FraudEvidence[];
  
  // Actions taken
  requiresManualReview: boolean;
  autoRejected: boolean;
  warningsIssued: string[];
  
  assessmentTime: Date;
  testMode: boolean;
}

export interface FraudRule {
  id: string;
  name: string;
  type: 'device' | 'geographic' | 'temporal' | 'voice' | 'content' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number; // 0-1 contribution to overall score
  threshold: number;
  currentValue: number;
  description: string;
  
  // Swedish market specific
  marketSpecific: boolean;
  swedishRegulation?: string;
}

export interface FraudEvidence {
  type: string;
  description: string;
  confidence: number; // 0-1
  severity: 'info' | 'warning' | 'critical';
  data: any;
  timestamp: Date;
}

export interface FraudProtectionLimits {
  // Device-based limits
  maxRewardsPerDevice: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  
  // Geographic limits (Swedish market)
  maxRewardsPerLocation: {
    radius: number; // meters
    daily: number;
    hourly: number;
  };
  
  // Temporal limits
  minTimeBetweenRewards: number; // minutes
  maxRewardsPerHour: number;
  suspiciousHours: number[]; // 0-23 (night hours)
  
  // Voice analysis limits
  voiceSimilarityThreshold: number; // 0-1
  syntheticVoiceConfidence: number; // 0-1
  
  // Content limits
  contentSimilarityThreshold: number; // 0-1
  minWordCount: number;
  maxWordCount: number;
  
  // Behavioral limits
  maxQualityScoreVariation: number; // Standard deviation limit
  minSessionDuration: number; // seconds
  maxSessionDuration: number; // seconds
  
  // Economic limits
  maxDailyRewardPerCustomer: number; // öre
  suspiciousRewardPatterns: {
    exactAmountRepeats: number;
    roundNumberFrequency: number;
  };
}

export class FraudProtectionEngine {
  private limits: FraudProtectionLimits;
  private rules: Map<string, FraudRule>;
  private sessionHistory: Map<string, any[]>; // Customer hash -> session history
  private testMode: boolean;

  constructor(testMode = true) {
    this.testMode = testMode;
    this.sessionHistory = new Map();
    this.rules = new Map();
    
    this.initializeLimits();
    this.initializeFraudRules();
    
    console.log(`🛡️ Fraud Protection Engine initialized (${testMode ? 'TEST' : 'LIVE'} mode)`);
  }

  /**
   * Initialize fraud protection limits for Swedish market
   */
  private initializeLimits(): void {
    this.limits = {
      // Device fingerprinting limits
      maxRewardsPerDevice: {
        daily: 5,   // Max 5 rewards per device per day
        weekly: 20, // Max 20 per week
        monthly: 50 // Max 50 per month
      },
      
      // Geographic clustering protection
      maxRewardsPerLocation: {
        radius: 100, // 100 meter radius
        daily: 10,   // Max 10 rewards from same location daily
        hourly: 3    // Max 3 per hour from same location
      },
      
      // Temporal pattern protection
      minTimeBetweenRewards: 30, // 30 minutes between rewards
      maxRewardsPerHour: 2,
      suspiciousHours: [0, 1, 2, 3, 4, 5], // Late night/early morning
      
      // Voice analysis
      voiceSimilarityThreshold: 0.85, // 85% similarity triggers review
      syntheticVoiceConfidence: 0.7,  // 70% confidence in synthetic voice
      
      // Content analysis
      contentSimilarityThreshold: 0.8, // 80% content similarity
      minWordCount: 10,
      maxWordCount: 500,
      
      // Behavioral analysis
      maxQualityScoreVariation: 5.0, // Standard deviation limit
      minSessionDuration: 15, // 15 seconds minimum
      maxSessionDuration: 300, // 5 minutes maximum
      
      // Economic protection
      maxDailyRewardPerCustomer: 50000, // 500 SEK max per customer per day
      suspiciousRewardPatterns: {
        exactAmountRepeats: 3, // Same exact amount 3+ times
        roundNumberFrequency: 5 // Round numbers 5+ times
      }
    };
  }

  /**
   * Initialize fraud detection rules
   */
  private initializeFraudRules(): void {
    const rules = [
      // Device-based rules
      {
        id: 'device_excessive_usage',
        name: 'Excessive Device Usage',
        type: 'device' as const,
        severity: 'medium' as const,
        weight: 0.3,
        threshold: 5,
        description: 'Same device used for too many rewards',
        marketSpecific: false
      },
      
      // Geographic rules
      {
        id: 'geo_clustering',
        name: 'Geographic Clustering',
        type: 'geographic' as const,
        severity: 'high' as const,
        weight: 0.4,
        threshold: 10,
        description: 'Too many rewards from same location',
        marketSpecific: true,
        swedishRegulation: 'Customer anonymity requirement'
      },
      
      // Temporal rules
      {
        id: 'rapid_succession',
        name: 'Rapid Succession Rewards',
        type: 'temporal' as const,
        severity: 'high' as const,
        weight: 0.5,
        threshold: 30, // 30 minutes
        description: 'Rewards claimed too quickly',
        marketSpecific: false
      },
      
      {
        id: 'suspicious_hours',
        name: 'Suspicious Time Patterns',
        type: 'temporal' as const,
        severity: 'medium' as const,
        weight: 0.2,
        threshold: 3,
        description: 'Activity during unusual hours',
        marketSpecific: true,
        swedishRegulation: 'Typical business hours pattern'
      },
      
      // Voice analysis rules
      {
        id: 'voice_similarity',
        name: 'Voice Pattern Similarity',
        type: 'voice' as const,
        severity: 'high' as const,
        weight: 0.6,
        threshold: 0.85,
        description: 'Voice patterns too similar to previous sessions',
        marketSpecific: false
      },
      
      {
        id: 'synthetic_voice',
        name: 'Synthetic Voice Detection',
        type: 'voice' as const,
        severity: 'critical' as const,
        weight: 0.8,
        threshold: 0.7,
        description: 'AI-generated voice detected',
        marketSpecific: false
      },
      
      // Content analysis rules
      {
        id: 'content_duplication',
        name: 'Content Duplication',
        type: 'content' as const,
        severity: 'high' as const,
        weight: 0.5,
        threshold: 0.8,
        description: 'Feedback content too similar to previous submissions',
        marketSpecific: false
      },
      
      {
        id: 'content_length_anomaly',
        name: 'Content Length Anomaly',
        type: 'content' as const,
        severity: 'low' as const,
        weight: 0.1,
        threshold: 0,
        description: 'Feedback too short or too long',
        marketSpecific: false
      },
      
      // Behavioral rules
      {
        id: 'quality_score_pattern',
        name: 'Quality Score Pattern Anomaly',
        type: 'behavioral' as const,
        severity: 'medium' as const,
        weight: 0.3,
        threshold: 5.0,
        description: 'Quality scores show unnatural patterns',
        marketSpecific: false
      },
      
      {
        id: 'session_duration_anomaly',
        name: 'Session Duration Anomaly',
        type: 'behavioral' as const,
        severity: 'low' as const,
        weight: 0.2,
        threshold: 300,
        description: 'Session duration outside normal range',
        marketSpecific: false
      }
    ];

    rules.forEach(rule => {
      this.rules.set(rule.id, { ...rule, currentValue: 0 });
    });
  }

  /**
   * Main fraud risk assessment
   */
  async assessFraudRisk(sessionData: {
    customerHash: string;
    deviceFingerprint: any;
    location?: { lat: number; lng: number };
    timestamp: Date;
    voiceAnalysis?: any;
    transcript: string;
    sessionDuration: number;
    qualityScore: number;
    rewardAmount: number;
  }): Promise<FraudRiskAssessment> {
    
    console.log(`🔍 Assessing fraud risk for session: ${sessionData.customerHash.substring(0, 8)}...`);
    
    const assessment: FraudRiskAssessment = {
      overallRiskScore: 0,
      riskLevel: 'low',
      deviceRisk: 0,
      geographicRisk: 0,
      temporalRisk: 0,
      voiceRisk: 0,
      contentRisk: 0,
      behavioralRisk: 0,
      rewardAdjustment: 0,
      dailyLimitReduction: 0,
      sessionBlocked: false,
      triggeredRules: [],
      evidence: [],
      requiresManualReview: false,
      autoRejected: false,
      warningsIssued: [],
      assessmentTime: new Date(),
      testMode: this.testMode
    };

    // Analyze each risk category
    assessment.deviceRisk = await this.analyzeDeviceRisk(sessionData);
    assessment.geographicRisk = await this.analyzeGeographicRisk(sessionData);
    assessment.temporalRisk = await this.analyzeTemporalRisk(sessionData);
    assessment.voiceRisk = await this.analyzeVoiceRisk(sessionData);
    assessment.contentRisk = await this.analyzeContentRisk(sessionData);
    assessment.behavioralRisk = await this.analyzeBehavioralRisk(sessionData);

    // Calculate overall risk score (weighted average)
    const weights = {
      device: 0.2,
      geographic: 0.15,
      temporal: 0.15,
      voice: 0.25,
      content: 0.15,
      behavioral: 0.1
    };

    assessment.overallRiskScore = 
      assessment.deviceRisk * weights.device +
      assessment.geographicRisk * weights.geographic +
      assessment.temporalRisk * weights.temporal +
      assessment.voiceRisk * weights.voice +
      assessment.contentRisk * weights.content +
      assessment.behavioralRisk * weights.behavioral;

    // Determine risk level and actions
    this.determineRiskLevelAndActions(assessment);
    
    // Store session history
    this.storeSessionHistory(sessionData, assessment);
    
    console.log(`📊 Risk assessment complete: ${assessment.riskLevel} risk (${(assessment.overallRiskScore * 100).toFixed(1)}%)`);
    
    return assessment;
  }

  /**
   * Analyze device-based risk factors
   */
  private async analyzeDeviceRisk(sessionData: any): Promise<number> {
    let risk = 0;
    
    // Check device usage frequency (mock implementation)
    const deviceUsage = this.getDeviceUsageHistory(sessionData.deviceFingerprint);
    
    if (deviceUsage.dailyCount > this.limits.maxRewardsPerDevice.daily) {
      risk += 0.8; // High risk
    } else if (deviceUsage.dailyCount > this.limits.maxRewardsPerDevice.daily * 0.7) {
      risk += 0.4; // Medium risk
    }

    // Check for device spoofing indicators (mock)
    if (sessionData.deviceFingerprint.inconsistencies) {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  /**
   * Analyze geographic risk patterns
   */
  private async analyzeGeographicRisk(sessionData: any): Promise<number> {
    let risk = 0;

    if (!sessionData.location) {
      return 0; // No location data, no geographic risk
    }

    // Check for location clustering (mock implementation)
    const nearbyRewards = this.getNearbyRewards(
      sessionData.location,
      this.limits.maxRewardsPerLocation.radius
    );

    if (nearbyRewards.dailyCount > this.limits.maxRewardsPerLocation.daily) {
      risk += 0.7;
    }

    if (nearbyRewards.hourlyCount > this.limits.maxRewardsPerLocation.hourly) {
      risk += 0.5;
    }

    // Check for impossible travel patterns
    const previousLocation = this.getLastLocationForCustomer(sessionData.customerHash);
    if (previousLocation && this.isImpossibleTravel(previousLocation, sessionData.location, sessionData.timestamp)) {
      risk += 0.9;
    }

    return Math.min(risk, 1.0);
  }

  /**
   * Analyze temporal risk patterns
   */
  private async analyzeTemporalRisk(sessionData: any): Promise<number> {
    let risk = 0;
    const hour = sessionData.timestamp.getHours();

    // Check for suspicious hours
    if (this.limits.suspiciousHours.includes(hour)) {
      risk += 0.3;
    }

    // Check for rapid succession
    const lastReward = this.getLastRewardTime(sessionData.customerHash);
    if (lastReward) {
      const timeDiff = (sessionData.timestamp.getTime() - lastReward.getTime()) / (1000 * 60); // minutes
      
      if (timeDiff < this.limits.minTimeBetweenRewards) {
        risk += 0.6;
      }
    }

    // Check hourly frequency
    const hourlyCount = this.getHourlyRewardCount(sessionData.customerHash, sessionData.timestamp);
    if (hourlyCount > this.limits.maxRewardsPerHour) {
      risk += 0.5;
    }

    return Math.min(risk, 1.0);
  }

  /**
   * Analyze voice-based risk factors
   */
  private async analyzeVoiceRisk(sessionData: any): Promise<number> {
    let risk = 0;

    if (!sessionData.voiceAnalysis) {
      return 0; // No voice data available
    }

    // Check for synthetic voice
    if (sessionData.voiceAnalysis.syntheticConfidence > this.limits.syntheticVoiceConfidence) {
      risk += 0.9; // Very high risk
    }

    // Check voice similarity to previous sessions
    const voiceHistory = this.getVoiceHistory(sessionData.customerHash);
    for (const previousVoice of voiceHistory) {
      if (this.calculateVoiceSimilarity(sessionData.voiceAnalysis, previousVoice) > this.limits.voiceSimilarityThreshold) {
        risk += 0.4;
        break;
      }
    }

    return Math.min(risk, 1.0);
  }

  /**
   * Analyze content-based risk factors
   */
  private async analyzeContentRisk(sessionData: any): Promise<number> {
    let risk = 0;

    // Check content length
    const wordCount = sessionData.transcript.split(' ').length;
    if (wordCount < this.limits.minWordCount || wordCount > this.limits.maxWordCount) {
      risk += 0.2;
    }

    // Check content similarity to previous feedback
    const contentHistory = this.getContentHistory(sessionData.customerHash);
    for (const previousContent of contentHistory) {
      if (this.calculateContentSimilarity(sessionData.transcript, previousContent) > this.limits.contentSimilarityThreshold) {
        risk += 0.6;
        break;
      }
    }

    // Check for template-like language patterns
    if (this.detectTemplateLanguage(sessionData.transcript)) {
      risk += 0.3;
    }

    return Math.min(risk, 1.0);
  }

  /**
   * Analyze behavioral risk patterns
   */
  private async analyzeBehavioralRisk(sessionData: any): Promise<number> {
    let risk = 0;

    // Check session duration anomalies
    if (sessionData.sessionDuration < this.limits.minSessionDuration || 
        sessionData.sessionDuration > this.limits.maxSessionDuration) {
      risk += 0.3;
    }

    // Check quality score patterns
    const qualityHistory = this.getQualityScoreHistory(sessionData.customerHash);
    if (qualityHistory.length >= 3) {
      const variance = this.calculateVariance(qualityHistory);
      if (variance < 2.0) { // Suspiciously consistent scores
        risk += 0.4;
      }
    }

    return Math.min(risk, 1.0);
  }

  /**
   * Determine risk level and required actions
   */
  private determineRiskLevelAndActions(assessment: FraudRiskAssessment): void {
    if (assessment.overallRiskScore >= 0.8) {
      assessment.riskLevel = 'critical';
      assessment.sessionBlocked = true;
      assessment.autoRejected = true;
      assessment.rewardAdjustment = 1.0; // 100% reduction
    } else if (assessment.overallRiskScore >= 0.6) {
      assessment.riskLevel = 'high';
      assessment.requiresManualReview = true;
      assessment.rewardAdjustment = 0.5; // 50% reduction
      assessment.dailyLimitReduction = 0.3; // 30% limit reduction
    } else if (assessment.overallRiskScore >= 0.3) {
      assessment.riskLevel = 'medium';
      assessment.rewardAdjustment = 0.2; // 20% reduction
      assessment.warningsIssued.push('Elevated fraud risk detected');
    } else {
      assessment.riskLevel = 'low';
      // No action needed
    }
  }

  // Mock helper methods (would be implemented with real data sources)
  private getDeviceUsageHistory(deviceFingerprint: any) {
    return { dailyCount: Math.floor(Math.random() * 8), weeklyCount: Math.floor(Math.random() * 25) };
  }

  private getNearbyRewards(location: any, radius: number) {
    return { dailyCount: Math.floor(Math.random() * 12), hourlyCount: Math.floor(Math.random() * 4) };
  }

  private getLastLocationForCustomer(customerHash: string) {
    return Math.random() > 0.7 ? { lat: 59.3293, lng: 18.0686 } : null;
  }

  private isImpossibleTravel(prev: any, current: any, timestamp: Date): boolean {
    // Mock: 10% chance of impossible travel
    return Math.random() < 0.1;
  }

  private getLastRewardTime(customerHash: string): Date | null {
    // Mock: 30% chance of recent reward
    return Math.random() > 0.7 ? new Date(Date.now() - Math.random() * 60 * 60 * 1000) : null;
  }

  private getHourlyRewardCount(customerHash: string, timestamp: Date): number {
    return Math.floor(Math.random() * 3);
  }

  private getVoiceHistory(customerHash: string): any[] {
    return []; // Mock implementation
  }

  private calculateVoiceSimilarity(voice1: any, voice2: any): number {
    return Math.random(); // Mock similarity
  }

  private getContentHistory(customerHash: string): string[] {
    return []; // Mock implementation
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    return Math.random(); // Mock similarity
  }

  private detectTemplateLanguage(transcript: string): boolean {
    const templatePhrases = ['very good service', 'highly recommend', 'excellent quality'];
    return templatePhrases.some(phrase => transcript.toLowerCase().includes(phrase));
  }

  private getQualityScoreHistory(customerHash: string): number[] {
    return Array.from({ length: Math.floor(Math.random() * 6) }, () => Math.floor(Math.random() * 40) + 60);
  }

  private calculateVariance(numbers: number[]): number {
    const mean = numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
    return Math.sqrt(numbers.reduce((sum, n) => sum + Math.pow(n - mean, 2), 0) / numbers.length);
  }

  private storeSessionHistory(sessionData: any, assessment: FraudRiskAssessment): void {
    // Mock implementation - would store in database
    console.log(`📝 Stored session history for ${sessionData.customerHash.substring(0, 8)}...`);
  }

  /**
   * Generate test scenarios for fraud detection
   */
  static generateFraudTestScenarios() {
    return [
      {
        name: 'Normal Customer Session',
        customerHash: 'normal_customer_123',
        riskFactors: ['none'],
        expectedRisk: 'low'
      },
      {
        name: 'Device Abuse Scenario',
        customerHash: 'device_abuser_456',
        riskFactors: ['excessive_device_usage', 'rapid_succession'],
        expectedRisk: 'high'
      },
      {
        name: 'Synthetic Voice Detection',
        customerHash: 'synthetic_voice_789',
        riskFactors: ['synthetic_voice', 'content_duplication'],
        expectedRisk: 'critical'
      },
      {
        name: 'Geographic Clustering',
        customerHash: 'geo_cluster_012',
        riskFactors: ['location_clustering', 'impossible_travel'],
        expectedRisk: 'high'
      }
    ];
  }
}

export { FraudProtectionEngine };