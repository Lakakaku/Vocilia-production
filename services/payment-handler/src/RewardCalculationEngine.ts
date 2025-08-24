/**
 * AI Feedback Platform - Reward Calculation Engine
 * 
 * Calculates customer rewards based on:
 * - Quality score (0-100) from AI evaluation
 * - Business tier (affects caps and commission rates)
 * - Fraud protection limits
 * - Purchase amount and time constraints
 * - Swedish market regulations
 */

import type { RewardTier, RewardSettings, FraudFlag } from '@ai-feedback/shared-types';

export interface RewardCalculationInput {
  // Customer feedback data
  qualityScore: number; // 0-100 from AI evaluation
  purchaseAmount: number; // in öre (Swedish cents)
  feedbackCategories: string[];
  sessionDuration?: number; // seconds
  
  // Business context
  businessId: string;
  businessTier: BusinessTier; // 1-3 (affects caps)
  businessSettings: RewardSettings;
  
  // Fraud protection
  customerHash: string;
  fraudRiskScore?: number; // 0-1
  fraudFlags?: FraudFlag[];
  deviceFingerprint?: string;
  
  // Time constraints
  purchaseTime: Date;
  feedbackTime: Date;
  
  // Market constraints
  currency: 'sek';
  country: 'SE';
}

export interface RewardCalculationResult {
  // Final reward
  rewardAmount: number; // in öre
  rewardPercentage: number; // actual percentage (0-0.12)
  rewardTier: RewardTier;
  
  // Platform economics
  platformCommission: number; // in öre (20% of reward)
  businessCost: number; // in öre (reward + commission)
  
  // Calculation details
  baseReward: number;
  appliedCaps: RewardCap[];
  fraudAdjustment: number;
  qualityBonus: number;
  
  // Validation
  isEligible: boolean;
  rejectionReasons: string[];
  
  // Metadata
  calculatedAt: Date;
  algorithm: 'v1.0';
  testMode: boolean;
}

export type BusinessTier = 1 | 2 | 3;

export interface RewardCap {
  type: 'daily_customer' | 'daily_business' | 'single_transaction' | 'fraud_protection';
  limit: number; // in öre
  applied: number; // in öre
  reason: string;
}

export interface SwedishMarketLimits {
  // Swedish financial regulations
  maxSingleReward: number; // 1000 SEK = 100000 öre
  maxDailyPerCustomer: number; // 500 SEK = 50000 öre  
  maxDailyPerBusiness: number; // Based on tier
  minReward: number; // 1 SEK = 100 öre
  
  // Tax reporting thresholds (Swedish regulations)
  taxReportingThreshold: number; // 600 SEK = 60000 öre annually
}

/**
 * Swedish Market Reward Calculation Engine
 * Implements quality-based rewards with fraud protection
 */
export class RewardCalculationEngine {
  private swedishLimits: SwedishMarketLimits;
  private testMode: boolean;

  constructor(testMode = true) {
    this.testMode = testMode;
    this.swedishLimits = {
      maxSingleReward: 100000, // 1000 SEK
      maxDailyPerCustomer: 50000, // 500 SEK
      maxDailyPerBusiness: 500000, // 5000 SEK (Tier 1)
      minReward: 100, // 1 SEK
      taxReportingThreshold: 60000 // 600 SEK annually
    };
    
    console.log(`💰 Reward Engine initialized (${testMode ? 'TEST' : 'LIVE'} mode)`);
  }

  /**
   * Main reward calculation method
   */
  async calculateReward(input: RewardCalculationInput): Promise<RewardCalculationResult> {
    console.log(`🧮 Calculating reward for quality score: ${input.qualityScore}/100`);
    
    const result: RewardCalculationResult = {
      rewardAmount: 0,
      rewardPercentage: 0,
      rewardTier: 'insufficient',
      platformCommission: 0,
      businessCost: 0,
      baseReward: 0,
      appliedCaps: [],
      fraudAdjustment: 0,
      qualityBonus: 0,
      isEligible: true,
      rejectionReasons: [],
      calculatedAt: new Date(),
      algorithm: 'v1.0',
      testMode: this.testMode
    };

    // Step 1: Validate eligibility
    this.validateEligibility(input, result);
    if (!result.isEligible) {
      return result;
    }

    // Step 2: Determine reward tier
    result.rewardTier = this.determineRewardTier(input.qualityScore);
    
    // Step 3: Calculate base reward percentage
    const basePercentage = this.calculateBasePercentage(input.qualityScore, result.rewardTier);
    result.baseReward = Math.floor(input.purchaseAmount * basePercentage);
    
    // Step 4: Apply quality bonuses
    result.qualityBonus = this.calculateQualityBonus(input);
    
    // Step 5: Apply fraud adjustments
    result.fraudAdjustment = this.calculateFraudAdjustment(input);
    
    // Step 6: Calculate raw reward
    let rawReward = result.baseReward + result.qualityBonus - result.fraudAdjustment;
    
    // Step 7: Apply caps and limits
    rawReward = this.applyCaps(rawReward, input, result);
    
    // Step 8: Final reward amount
    result.rewardAmount = Math.max(0, rawReward);
    result.rewardPercentage = result.rewardAmount / input.purchaseAmount;
    
    // Step 9: Calculate platform economics
    result.platformCommission = Math.floor(result.rewardAmount * 0.20); // 20%
    result.businessCost = result.rewardAmount + result.platformCommission;
    
    console.log(`✅ Reward calculated: ${result.rewardAmount} öre (${result.rewardAmount/100} SEK)`);
    console.log(`   Tier: ${result.rewardTier}, Percentage: ${(result.rewardPercentage * 100).toFixed(2)}%`);
    
    return result;
  }

  /**
   * Validates if customer/session is eligible for rewards
   */
  private validateEligibility(input: RewardCalculationInput, result: RewardCalculationResult): void {
    // Time window check (15 minutes after purchase)
    const timeDiff = input.feedbackTime.getTime() - input.purchaseTime.getTime();
    const maxWindow = 15 * 60 * 1000; // 15 minutes
    
    if (timeDiff > maxWindow) {
      result.isEligible = false;
      result.rejectionReasons.push('feedback_too_late');
      return;
    }
    
    if (timeDiff < 0) {
      result.isEligible = false;
      result.rejectionReasons.push('invalid_timestamp');
      return;
    }

    // Minimum purchase amount (10 SEK)
    if (input.purchaseAmount < 1000) {
      result.isEligible = false;
      result.rejectionReasons.push('purchase_too_small');
      return;
    }

    // Maximum purchase amount (10,000 SEK for fraud protection)
    if (input.purchaseAmount > 1000000) {
      result.isEligible = false;
      result.rejectionReasons.push('purchase_too_large');
      return;
    }

    // High fraud risk check
    if (input.fraudRiskScore && input.fraudRiskScore > 0.8) {
      result.isEligible = false;
      result.rejectionReasons.push('high_fraud_risk');
      return;
    }

    // Quality threshold (minimum 50/100 for any reward)
    if (input.qualityScore < 50) {
      result.isEligible = false;
      result.rejectionReasons.push('quality_too_low');
      return;
    }
  }

  /**
   * Determines reward tier based on quality score
   */
  private determineRewardTier(qualityScore: number): RewardTier {
    if (qualityScore >= 90) return 'exceptional';
    if (qualityScore >= 75) return 'very_good';
    if (qualityScore >= 60) return 'acceptable';
    return 'insufficient';
  }

  /**
   * Calculates base reward percentage from quality score
   */
  private calculateBasePercentage(qualityScore: number, tier: RewardTier): number {
    // Quality-based reward mapping
    const rewardMapping = {
      exceptional: { min: 0.08, max: 0.12 }, // 8-12%
      very_good: { min: 0.04, max: 0.07 },   // 4-7%
      acceptable: { min: 0.01, max: 0.03 },  // 1-3%
      insufficient: { min: 0, max: 0 }       // 0%
    };

    const range = rewardMapping[tier];
    if (range.max === 0) return 0;

    // Linear interpolation within tier range
    const tierMin = this.getTierMinScore(tier);
    const tierMax = this.getTierMaxScore(tier);
    const tierProgress = (qualityScore - tierMin) / (tierMax - tierMin);
    
    return range.min + (tierProgress * (range.max - range.min));
  }

  private getTierMinScore(tier: RewardTier): number {
    switch (tier) {
      case 'exceptional': return 90;
      case 'very_good': return 75;
      case 'acceptable': return 60;
      case 'insufficient': return 0;
    }
  }

  private getTierMaxScore(tier: RewardTier): number {
    switch (tier) {
      case 'exceptional': return 100;
      case 'very_good': return 89;
      case 'acceptable': return 74;
      case 'insufficient': return 59;
    }
  }

  /**
   * Calculates quality bonuses for exceptional feedback
   */
  private calculateQualityBonus(input: RewardCalculationInput): number {
    let bonus = 0;

    // Category diversity bonus (more categories = better feedback)
    if (input.feedbackCategories.length >= 3) {
      bonus += Math.floor(input.purchaseAmount * 0.005); // +0.5%
    }

    // Length bonus for detailed feedback
    if (input.sessionDuration && input.sessionDuration >= 45) {
      bonus += Math.floor(input.purchaseAmount * 0.003); // +0.3%
    }

    return bonus;
  }

  /**
   * Calculates fraud-based adjustments (reductions)
   */
  private calculateFraudAdjustment(input: RewardCalculationInput): number {
    let adjustment = 0;

    if (input.fraudRiskScore) {
      // Reduce reward based on fraud risk (0-50% reduction)
      const riskPenalty = input.fraudRiskScore * 0.5;
      adjustment += Math.floor(input.purchaseAmount * riskPenalty * 0.01);
    }

    // Specific fraud flag penalties
    if (input.fraudFlags) {
      for (const flag of input.fraudFlags) {
        switch (flag.severity) {
          case 'high':
            adjustment += Math.floor(input.purchaseAmount * 0.02); // -2%
            break;
          case 'medium':
            adjustment += Math.floor(input.purchaseAmount * 0.01); // -1%
            break;
          case 'low':
            adjustment += Math.floor(input.purchaseAmount * 0.005); // -0.5%
            break;
        }
      }
    }

    return adjustment;
  }

  /**
   * Applies various caps and limits
   */
  private applyCaps(reward: number, input: RewardCalculationInput, result: RewardCalculationResult): number {
    let cappedReward = reward;

    // Single transaction cap
    if (cappedReward > this.swedishLimits.maxSingleReward) {
      result.appliedCaps.push({
        type: 'single_transaction',
        limit: this.swedishLimits.maxSingleReward,
        applied: cappedReward - this.swedishLimits.maxSingleReward,
        reason: 'Swedish single transaction limit'
      });
      cappedReward = this.swedishLimits.maxSingleReward;
    }

    // Business tier caps
    const tierCaps = this.getBusinessTierCaps(input.businessTier);
    if (cappedReward > tierCaps.maxSingleReward) {
      result.appliedCaps.push({
        type: 'single_transaction',
        limit: tierCaps.maxSingleReward,
        applied: cappedReward - tierCaps.maxSingleReward,
        reason: `Business tier ${input.businessTier} limit`
      });
      cappedReward = tierCaps.maxSingleReward;
    }

    // Minimum reward
    if (cappedReward > 0 && cappedReward < this.swedishLimits.minReward) {
      cappedReward = this.swedishLimits.minReward;
    }

    return cappedReward;
  }

  /**
   * Gets business tier-specific caps
   */
  private getBusinessTierCaps(tier: BusinessTier) {
    switch (tier) {
      case 1: // Small businesses
        return {
          maxSingleReward: 5000, // 50 SEK
          maxDailyReward: 20000, // 200 SEK
          maxMonthlyReward: 500000 // 5000 SEK
        };
      case 2: // Medium businesses  
        return {
          maxSingleReward: 15000, // 150 SEK
          maxDailyReward: 100000, // 1000 SEK
          maxMonthlyReward: 2000000 // 20000 SEK
        };
      case 3: // Large businesses
        return {
          maxSingleReward: 50000, // 500 SEK
          maxDailyReward: 500000, // 5000 SEK
          maxMonthlyReward: 10000000 // 100000 SEK
        };
    }
  }

  /**
   * Creates test calculation scenarios
   */
  static createTestScenarios(): RewardCalculationInput[] {
    const baseTime = new Date();
    const feedbackTime = new Date(baseTime.getTime() + 5 * 60 * 1000); // 5 min later

    return [
      // Exceptional quality feedback
      {
        qualityScore: 95,
        purchaseAmount: 10000, // 100 SEK
        feedbackCategories: ['service', 'quality', 'atmosphere', 'value'],
        sessionDuration: 60,
        businessId: 'cafe_aurora_test',
        businessTier: 2,
        businessSettings: {} as RewardSettings,
        customerHash: 'test_customer_excellent',
        purchaseTime: baseTime,
        feedbackTime,
        currency: 'sek',
        country: 'SE'
      },
      
      // Good quality with fraud risk
      {
        qualityScore: 80,
        purchaseAmount: 25000, // 250 SEK
        feedbackCategories: ['service', 'quality'],
        businessId: 'restaurant_test',
        businessTier: 1,
        businessSettings: {} as RewardSettings,
        customerHash: 'test_customer_fraud_risk',
        fraudRiskScore: 0.3,
        fraudFlags: [{
          type: 'device_abuse',
          severity: 'low',
          description: 'Multiple sessions from same device',
          confidence: 0.6,
          data: {}
        }],
        purchaseTime: baseTime,
        feedbackTime,
        currency: 'sek',
        country: 'SE'
      },

      // Minimum quality threshold
      {
        qualityScore: 62,
        purchaseAmount: 5000, // 50 SEK
        feedbackCategories: ['service'],
        businessId: 'retail_test',
        businessTier: 3,
        businessSettings: {} as RewardSettings,
        customerHash: 'test_customer_minimal',
        purchaseTime: baseTime,
        feedbackTime,
        currency: 'sek',
        country: 'SE'
      }
    ];
  }
}

export { RewardCalculationEngine };