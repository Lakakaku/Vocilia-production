/**
 * Business Tier Management System
 * Manages business tiers, caps, and limits for Swedish market
 * 
 * Tier System:
 * - Tier 1: Small businesses (cafés, small shops) - Conservative limits
 * - Tier 2: Medium businesses (restaurants, chains) - Moderate limits  
 * - Tier 3: Large businesses (department stores, corporations) - High limits
 */

export type BusinessTier = 1 | 2 | 3;

export interface BusinessTierConfig {
  tier: BusinessTier;
  name: string;
  description: string;
  
  // Transaction limits (in öre)
  maxSingleReward: number;
  maxDailyReward: number;
  maxWeeklyReward: number;
  maxMonthlyReward: number;
  
  // Volume limits
  maxDailyTransactions: number;
  maxMonthlyTransactions: number;
  
  // Quality requirements
  minQualityThreshold: number; // 0-100
  qualityBonusMultiplier: number; // 1.0-2.0
  
  // Commission rates
  platformCommissionRate: number; // 0.15-0.25
  
  // Risk management
  fraudToleranceLevel: number; // 0-1 (higher = more tolerant)
  requiredDocumentation: string[];
  
  // Swedish regulatory compliance
  monthlyReportingRequired: boolean;
  taxWithholdingRequired: boolean;
  
  // Upgrade criteria
  upgradeRequirements?: {
    minMonthlyVolume: number; // in öre
    minSessionCount: number;
    minQualityScore: number;
    businessAgeMonths: number;
  };
}

export interface TierUsageStats {
  businessId: string;
  tier: BusinessTier;
  period: 'daily' | 'weekly' | 'monthly';
  
  // Current usage
  currentRewardsPaid: number; // in öre
  currentTransactionCount: number;
  averageRewardAmount: number;
  averageQualityScore: number;
  
  // Limits and remaining
  remainingRewardBudget: number;
  remainingTransactions: number;
  utilizationPercentage: number;
  
  // Performance metrics
  fraudIncidents: number;
  disputedTransactions: number;
  customerSatisfactionScore: number;
  
  lastUpdated: Date;
}

export class BusinessTierManager {
  private tierConfigs: Map<BusinessTier, BusinessTierConfig>;
  private usageStats: Map<string, TierUsageStats>;
  private testMode: boolean;

  constructor(testMode = true) {
    this.testMode = testMode;
    this.tierConfigs = new Map();
    this.usageStats = new Map();
    
    this.initializeTierConfigs();
    console.log(`🏢 Business Tier Manager initialized (${testMode ? 'TEST' : 'LIVE'} mode)`);
  }

  /**
   * Initialize tier configurations for Swedish market
   */
  private initializeTierConfigs(): void {
    // Tier 1: Small Businesses (Cafés, Small Shops)
    this.tierConfigs.set(1, {
      tier: 1,
      name: 'Small Business',
      description: 'Cafés, small restaurants, independent shops',
      
      // Conservative limits for risk management
      maxSingleReward: 5000, // 50 SEK max per transaction
      maxDailyReward: 20000, // 200 SEK per day
      maxWeeklyReward: 100000, // 1000 SEK per week  
      maxMonthlyReward: 350000, // 3500 SEK per month
      
      maxDailyTransactions: 50,
      maxMonthlyTransactions: 1000,
      
      minQualityThreshold: 55, // Slightly lower threshold
      qualityBonusMultiplier: 1.0, // No bonus multiplier
      
      platformCommissionRate: 0.20, // 20% commission
      
      fraudToleranceLevel: 0.2, // Low tolerance
      requiredDocumentation: ['business_license', 'bank_account'],
      
      monthlyReportingRequired: false,
      taxWithholdingRequired: false,
      
      upgradeRequirements: {
        minMonthlyVolume: 300000, // 3000 SEK monthly
        minSessionCount: 500,
        minQualityScore: 70,
        businessAgeMonths: 6
      }
    });

    // Tier 2: Medium Businesses (Restaurant Chains, Regional Retailers)
    this.tierConfigs.set(2, {
      tier: 2,
      name: 'Medium Business',
      description: 'Restaurant chains, regional retailers, growing businesses',
      
      maxSingleReward: 15000, // 150 SEK max per transaction
      maxDailyReward: 100000, // 1000 SEK per day
      maxWeeklyReward: 600000, // 6000 SEK per week
      maxMonthlyReward: 2000000, // 20000 SEK per month
      
      maxDailyTransactions: 200,
      maxMonthlyTransactions: 5000,
      
      minQualityThreshold: 50,
      qualityBonusMultiplier: 1.2, // 20% bonus multiplier
      
      platformCommissionRate: 0.18, // 18% commission (discount)
      
      fraudToleranceLevel: 0.3,
      requiredDocumentation: ['business_license', 'bank_account', 'vat_registration'],
      
      monthlyReportingRequired: true,
      taxWithholdingRequired: false,
      
      upgradeRequirements: {
        minMonthlyVolume: 1500000, // 15000 SEK monthly
        minSessionCount: 2000,
        minQualityScore: 75,
        businessAgeMonths: 12
      }
    });

    // Tier 3: Large Businesses (Department Stores, Corporations)
    this.tierConfigs.set(3, {
      tier: 3,
      name: 'Large Business',
      description: 'Department stores, large chains, corporations',
      
      maxSingleReward: 50000, // 500 SEK max per transaction
      maxDailyReward: 500000, // 5000 SEK per day
      maxWeeklyReward: 3000000, // 30000 SEK per week
      maxMonthlyReward: 10000000, // 100000 SEK per month
      
      maxDailyTransactions: 1000,
      maxMonthlyTransactions: 25000,
      
      minQualityThreshold: 45, // Lowest threshold (high volume)
      qualityBonusMultiplier: 1.5, // 50% bonus multiplier
      
      platformCommissionRate: 0.15, // 15% commission (best rate)
      
      fraudToleranceLevel: 0.4, // Higher tolerance (better fraud systems)
      requiredDocumentation: ['business_license', 'bank_account', 'vat_registration', 'audited_financials'],
      
      monthlyReportingRequired: true,
      taxWithholdingRequired: true,
      
      // No upgrade requirements (top tier)
    });
  }

  /**
   * Get business tier configuration
   */
  getTierConfig(tier: BusinessTier): BusinessTierConfig {
    const config = this.tierConfigs.get(tier);
    if (!config) {
      throw new Error(`Invalid business tier: ${tier}`);
    }
    return config;
  }

  /**
   * Check if reward amount is within tier limits
   */
  validateRewardAmount(
    businessId: string, 
    tier: BusinessTier, 
    rewardAmount: number,
    period: 'single' | 'daily' | 'weekly' | 'monthly' = 'single'
  ): {
    allowed: boolean;
    limit: number;
    current: number;
    remaining: number;
    reason?: string;
  } {
    const config = this.getTierConfig(tier);
    const stats = this.getUsageStats(businessId, tier);

    let limit: number;
    let current: number;

    switch (period) {
      case 'single':
        limit = config.maxSingleReward;
        current = rewardAmount;
        break;
      case 'daily':
        limit = config.maxDailyReward;
        current = stats.currentRewardsPaid + rewardAmount;
        break;
      case 'weekly':
        limit = config.maxWeeklyReward;
        current = stats.currentRewardsPaid + rewardAmount;
        break;
      case 'monthly':
        limit = config.maxMonthlyReward;
        current = stats.currentRewardsPaid + rewardAmount;
        break;
    }

    const remaining = Math.max(0, limit - current);
    const allowed = current <= limit;

    const result = {
      allowed,
      limit,
      current,
      remaining
    };

    if (!allowed) {
      return {
        ...result,
        reason: `${period} limit exceeded for tier ${tier} business`
      };
    }

    return result;
  }

  /**
   * Get usage statistics for business
   */
  private getUsageStats(businessId: string, tier: BusinessTier): TierUsageStats {
    const existing = this.usageStats.get(businessId);
    
    if (existing) {
      return existing;
    }

    // Create new stats (mock for testing)
    const stats: TierUsageStats = {
      businessId,
      tier,
      period: 'daily',
      currentRewardsPaid: 0,
      currentTransactionCount: 0,
      averageRewardAmount: 0,
      averageQualityScore: 0,
      remainingRewardBudget: this.getTierConfig(tier).maxDailyReward,
      remainingTransactions: this.getTierConfig(tier).maxDailyTransactions,
      utilizationPercentage: 0,
      fraudIncidents: 0,
      disputedTransactions: 0,
      customerSatisfactionScore: 0,
      lastUpdated: new Date()
    };

    this.usageStats.set(businessId, stats);
    return stats;
  }

  /**
   * Update usage statistics after processing reward
   */
  updateUsageStats(
    businessId: string, 
    tier: BusinessTier, 
    rewardAmount: number, 
    qualityScore: number
  ): void {
    const stats = this.getUsageStats(businessId, tier);
    const config = this.getTierConfig(tier);
    
    // Update counters
    stats.currentRewardsPaid += rewardAmount;
    stats.currentTransactionCount += 1;
    
    // Update averages
    const totalTransactions = stats.currentTransactionCount;
    stats.averageRewardAmount = stats.currentRewardsPaid / totalTransactions;
    stats.averageQualityScore = ((stats.averageQualityScore * (totalTransactions - 1)) + qualityScore) / totalTransactions;
    
    // Update remaining budgets
    stats.remainingRewardBudget = Math.max(0, config.maxDailyReward - stats.currentRewardsPaid);
    stats.remainingTransactions = Math.max(0, config.maxDailyTransactions - stats.currentTransactionCount);
    
    // Update utilization
    stats.utilizationPercentage = (stats.currentRewardsPaid / config.maxDailyReward) * 100;
    
    stats.lastUpdated = new Date();
    
    console.log(`📊 Updated stats for ${businessId}: ${rewardAmount/100} SEK reward processed`);
  }

  /**
   * Check if business is eligible for tier upgrade
   */
  checkTierUpgradeEligibility(
    businessId: string, 
    currentTier: BusinessTier,
    monthlyStats: {
      volume: number;
      sessionCount: number;
      averageQuality: number;
      businessAgeMonths: number;
    }
  ): {
    eligible: boolean;
    newTier?: BusinessTier;
    requirements: any;
    missing: string[];
  } {
    if (currentTier >= 3) {
      return {
        eligible: false,
        requirements: {},
        missing: ['Already at highest tier']
      };
    }

    const nextTier = (currentTier + 1) as BusinessTier;
    const currentConfig = this.getTierConfig(currentTier);
    const requirements = currentConfig.upgradeRequirements!;
    
    const missing: string[] = [];
    
    if (monthlyStats.volume < requirements.minMonthlyVolume) {
      missing.push(`Monthly volume: ${monthlyStats.volume/100} SEK (need ${requirements.minMonthlyVolume/100} SEK)`);
    }
    
    if (monthlyStats.sessionCount < requirements.minSessionCount) {
      missing.push(`Session count: ${monthlyStats.sessionCount} (need ${requirements.minSessionCount})`);
    }
    
    if (monthlyStats.averageQuality < requirements.minQualityScore) {
      missing.push(`Quality score: ${monthlyStats.averageQuality} (need ${requirements.minQualityScore})`);
    }
    
    if (monthlyStats.businessAgeMonths < requirements.businessAgeMonths) {
      missing.push(`Business age: ${monthlyStats.businessAgeMonths} months (need ${requirements.businessAgeMonths})`);
    }

    return {
      eligible: missing.length === 0,
      newTier: missing.length === 0 ? nextTier : undefined,
      requirements,
      missing
    };
  }

  /**
   * Generate test scenarios for different tiers
   */
  static generateTestScenarios(): Array<{
    businessId: string;
    tier: BusinessTier;
    scenario: string;
    testData: any;
  }> {
    return [
      {
        businessId: 'small_cafe_test',
        tier: 1,
        scenario: 'Small café approaching daily limit',
        testData: {
          currentDailyRewards: 18000, // 180 SEK (near 200 SEK limit)
          proposedReward: 3000, // 30 SEK (would exceed limit)
          expectedResult: 'capped'
        }
      },
      {
        businessId: 'medium_restaurant_test',
        tier: 2,
        scenario: 'Medium restaurant with upgrade eligibility',
        testData: {
          monthlyVolume: 1600000, // 16000 SEK (exceeds upgrade requirement)
          sessionCount: 2100,
          averageQuality: 76,
          businessAgeMonths: 15,
          expectedResult: 'upgrade_eligible'
        }
      },
      {
        businessId: 'large_retailer_test',
        tier: 3,
        scenario: 'Large retailer high-volume transaction',
        testData: {
          singleReward: 40000, // 400 SEK (within 500 SEK limit)
          qualityScore: 92,
          expectedResult: 'approved_with_bonus'
        }
      }
    ];
  }
}

export { BusinessTierManager };