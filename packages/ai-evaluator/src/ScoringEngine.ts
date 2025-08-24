import { BusinessContext, QualityScore, RewardTier } from './types';

/**
 * Advanced scoring engine with multiple evaluation strategies and reward calculations
 */
import { EnhancedFraudPrevention } from '../../../services/payment-handler/src/EnhancedFraudPrevention';

export class ScoringEngine {
  private rewardTiers: RewardTier[] = [
    { min: 90, max: 100, rewardPercentage: [0.08, 0.12] }, // Exceptional
    { min: 75, max: 89, rewardPercentage: [0.04, 0.07] },  // Very Good
    { min: 60, max: 74, rewardPercentage: [0.01, 0.03] },  // Acceptable  
    { min: 0, max: 59, rewardPercentage: [0, 0] }          // Insufficient
  ];
  private enhancedFraudPrevention: EnhancedFraudPrevention;

  constructor() {
    this.enhancedFraudPrevention = new EnhancedFraudPrevention();
  }

  /**
   * Generate comprehensive evaluation prompt with multiple scoring aspects
   */
  generateEvaluationPrompt(
    transcript: string,
    businessContext: BusinessContext,
    purchaseItems: string[]
  ): string {
    // Use optimized short prompt for faster processing
    return this.buildOptimizedPrompt(transcript, businessContext, purchaseItems);
  }

  /**
   * Build ultra-optimized prompt for maximum speed (targeting <500ms processing)
   */
  private buildOptimizedPrompt(
    transcript: string,
    businessContext: BusinessContext,
    purchaseItems: string[]
  ): string {
    // Ultra-concise prompt focusing only on essential elements
    const contextStr = `${businessContext.type}${businessContext.strengths ? ` (Styrkor: ${businessContext.strengths.slice(0, 2).join(', ')})` : ''}`;
    const itemsStr = purchaseItems.length > 0 ? ` Köpte: ${purchaseItems.slice(0, 3).join(', ')}` : '';
    
    return `Bedöm feedback 0-100:
"${transcript}"

Kontext: ${contextStr}${itemsStr}

Kriterier: Trov (40%), Konkret (30%), Djup (30%)

Svara JSON:
{"authenticity":N,"concreteness":N,"depth":N,"total_score":N,"reasoning":"kort förklaring","categories":["ord"],"sentiment":N}

Sentiment -1 till 1. Kategorier svenska ord.`;
  }

  /**
   * Generate conversation prompt for natural Swedish dialogue
   */
  generateConversationPrompt(
    userInput: string,
    conversationHistory: string[],
    businessContext: BusinessContext
  ): string {
    // Ultra-optimized conversation prompt for speed
    const isFirstMessage = conversationHistory.length === 0;
    const shouldEnd = conversationHistory.length >= 4;
    
    if (shouldEnd) {
      return `Avsluta vänligt på svenska. KUND: "${userInput}" DU:`;
    }
    
    if (isFirstMessage) {
      return `Du hjälper kunder ge feedback på svenska. Var vänlig, fråga specifikt om deras upplevelse. Max 2 meningar.
KUND: "${userInput}" 
DU:`;
    }
    
    return `Följ upp med specifik fråga. Kort svar på svenska.
KUND: "${userInput}" 
DU:`;
  }

  /**
   * Calculate reward amount based on quality score with comprehensive tier system and caps
   */
  calculateReward(
    qualityScore: QualityScore,
    purchaseAmount: number,
    businessTier: number = 1,
    customerHistory?: { 
      totalFeedbacks: number; 
      averageScore: number;
      totalRewardsEarned: number;
      accountAge: number; // days since first feedback
      suspiciousActivityScore?: number;
    },
    businessConstraints?: {
      maxDailyRewardPerCustomer?: number;
      maxMonthlyRewardBudget?: number;
      currentMonthlySpent?: number;
      riskTolerance?: 'low' | 'medium' | 'high';
    },
    transactionContext?: {
      customerId?: string;
      businessId: string;
      ipAddress: string;
      deviceFingerprint: string;
      sessionId: string;
    }
  ): {
    rewardAmount: number;
    rewardPercentage: number;
    tier: string;
    explanation: string;
    bonuses: Array<{ type: string; amount: number; reason: string }>;
    caps: Array<{ type: string; originalAmount: number; cappedAmount: number; reason: string }>;
    riskAssessment: {
      riskLevel: 'low' | 'medium' | 'high';
      factors: string[];
      confidence: number;
    };
    enhancedFraudResults?: {
      approved: boolean;
      riskScore: number;
      alerts: any[];
      actions: string[];
      velocityViolations: string[];
      behavioralAnomalies: string[];
    };
  } {
    const tier = this.getRewardTier(qualityScore.total);
    const basePercentage = this.calculateBasePercentage(qualityScore, tier);
    
    const bonuses: Array<{ type: string; amount: number; reason: string }> = [];
    const caps: Array<{ type: string; originalAmount: number; cappedAmount: number; reason: string }> = [];
    let finalPercentage = basePercentage;

    // Enhanced Fraud Prevention Check (if transaction context provided)
    let enhancedFraudResults;
    let combinedSuspiciousScore = customerHistory?.suspiciousActivityScore || 0;

    if (transactionContext) {
      try {
        // Create a test transaction for fraud analysis
        const testTransaction = {
          timestamp: new Date(),
          amount: purchaseAmount,
          currency: 'SEK' as const,
          businessId: transactionContext.businessId,
          customerId: transactionContext.customerId,
          ipAddress: transactionContext.ipAddress,
          deviceFingerprint: transactionContext.deviceFingerprint,
          sessionId: transactionContext.sessionId,
          // Create test Swedish payment data for demonstration
          swedishBankAccount: {
            type: 'bankgiro' as const,
            number: '5555-5555', // Test Bankgiro number
            verified: true
          },
          metadata: {
            qualityScore: qualityScore.total,
            feedbackCategory: qualityScore.total >= 80 ? 'high_quality' : qualityScore.total >= 60 ? 'medium_quality' : 'low_quality'
          }
        };

        // Run enhanced fraud detection
        enhancedFraudResults = await this.enhancedFraudPrevention.performEnhancedFraudCheck(
          testTransaction,
          combinedSuspiciousScore
        );

        // Combine fraud scores
        combinedSuspiciousScore = Math.max(
          combinedSuspiciousScore,
          enhancedFraudResults.riskScore
        );

        // If fraud prevention blocks the transaction, apply severe restrictions
        if (!enhancedFraudResults.approved) {
          finalPercentage *= 0.1; // Only 10% of normal reward
          caps.push({
            type: 'fraud_prevention_block',
            originalAmount: basePercentage,
            cappedAmount: finalPercentage,
            reason: 'Fraudskydd blockerade transaktionen - endast minimal belöning utbetalas'
          });
        }
      } catch (error) {
        console.warn('Enhanced fraud prevention check failed, falling back to basic risk assessment:', error);
        // Fall back to existing risk assessment only
      }
    }

    // Risk assessment with enhanced fraud data
    const riskAssessment = this.assessCustomerRisk(
      qualityScore, 
      customerHistory ? { ...customerHistory, suspiciousActivityScore: combinedSuspiciousScore } : undefined, 
      businessConstraints
    );

    // Apply risk-based percentage adjustment
    if (riskAssessment.riskLevel === 'high') {
      const riskPenalty = 0.5; // 50% reduction for high risk
      finalPercentage *= riskPenalty;
      caps.push({
        type: 'risk_reduction',
        originalAmount: basePercentage,
        cappedAmount: finalPercentage,
        reason: `Hög riskprofil reducerar belöning med ${((1 - riskPenalty) * 100).toFixed(0)}%`
      });
    } else if (riskAssessment.riskLevel === 'medium') {
      const riskPenalty = 0.75; // 25% reduction for medium risk
      finalPercentage *= riskPenalty;
      caps.push({
        type: 'risk_reduction', 
        originalAmount: basePercentage,
        cappedAmount: finalPercentage,
        reason: `Medium riskprofil reducerar belöning med ${((1 - riskPenalty) * 100).toFixed(0)}%`
      });
    }

    // Apply additional velocity-based restrictions if detected
    if (enhancedFraudResults?.velocityViolations?.length) {
      const velocityPenalty = 0.7; // 30% reduction for velocity violations
      finalPercentage *= velocityPenalty;
      caps.push({
        type: 'velocity_restriction',
        originalAmount: finalPercentage / velocityPenalty,
        cappedAmount: finalPercentage,
        reason: `Hastighetsbegränsningar aktiva: ${enhancedFraudResults.velocityViolations.join(', ')}`
      });
    }

    // Business tier bonus (higher tier businesses can offer higher rewards)
    if (businessTier > 1) {
      const tierBonus = Math.min(0.03, (businessTier - 1) * 0.01); // Cap tier bonus at 3%
      finalPercentage += tierBonus;
      bonuses.push({
        type: 'business_tier',
        amount: tierBonus,
        reason: `Företag tier ${businessTier} bonus`
      });
    }

    // Enhanced loyalty bonus system
    if (customerHistory) {
      const loyaltyBonus = this.calculateLoyaltyBonus(customerHistory);
      if (loyaltyBonus > 0) {
        finalPercentage += loyaltyBonus;
        bonuses.push({
          type: 'loyalty',
          amount: loyaltyBonus,
          reason: this.generateLoyaltyBonusExplanation(customerHistory, loyaltyBonus)
        });
      }
    }

    // Quality-based bonuses
    if (qualityScore.total >= 95) {
      const excellenceBonus = 0.015; // 1.5%
      finalPercentage += excellenceBonus;
      bonuses.push({
        type: 'excellence',
        amount: excellenceBonus,
        reason: 'Exceptionell kvalitet (95+ poäng)'
      });
    } else if (qualityScore.total >= 90) {
      const qualityBonus = 0.01; // 1%
      finalPercentage += qualityBonus;
      bonuses.push({
        type: 'high_quality',
        amount: qualityBonus,
        reason: 'Mycket hög kvalitet (90+ poäng)'
      });
    }

    // Component-specific bonuses (reward balanced feedback)
    const componentBonus = this.calculateComponentBalanceBonus(qualityScore);
    if (componentBonus > 0) {
      finalPercentage += componentBonus;
      bonuses.push({
        type: 'component_balance',
        amount: componentBonus,
        reason: 'Balanserad feedback inom alla kategorier'
      });
    }

    // Apply caps and constraints
    finalPercentage = this.applyCaps(
      finalPercentage, 
      purchaseAmount, 
      businessConstraints, 
      customerHistory,
      caps
    );

    const originalRewardAmount = Math.round(purchaseAmount * (basePercentage + bonuses.reduce((sum, b) => sum + b.amount, 0)));
    const finalRewardAmount = Math.round(purchaseAmount * finalPercentage);
    
    return {
      rewardAmount: finalRewardAmount,
      rewardPercentage: finalPercentage,
      tier: this.getTierName(qualityScore.total),
      explanation: this.generateEnhancedRewardExplanation(qualityScore, basePercentage, finalPercentage, bonuses, caps),
      bonuses,
      caps,
      riskAssessment,
      enhancedFraudResults
    };
  }

  /**
   * Assess customer risk based on multiple factors
   */
  private assessCustomerRisk(
    qualityScore: QualityScore,
    customerHistory?: { 
      totalFeedbacks: number; 
      averageScore: number;
      totalRewardsEarned: number;
      accountAge: number;
      suspiciousActivityScore?: number;
    },
    businessConstraints?: {
      riskTolerance?: 'low' | 'medium' | 'high';
    }
  ): {
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
    confidence: number;
  } {
    const factors: string[] = [];
    let riskScore = 0;

    if (!customerHistory) {
      factors.push('Ny kund utan historik');
      riskScore += 0.3;
    } else {
      // Account age factor
      if (customerHistory.accountAge < 7) {
        factors.push('Mycket nytt konto (<7 dagar)');
        riskScore += 0.4;
      } else if (customerHistory.accountAge < 30) {
        factors.push('Relativt nytt konto (<30 dagar)');
        riskScore += 0.2;
      }

      // Feedback frequency factor
      const feedbacksPerDay = customerHistory.totalFeedbacks / Math.max(1, customerHistory.accountAge);
      if (feedbacksPerDay > 3) {
        factors.push('Ovanligt hög feedbackfrekvens (>3/dag)');
        riskScore += 0.3;
      }

      // Score consistency factor
      if (customerHistory.averageScore > 90 && customerHistory.totalFeedbacks > 10) {
        factors.push('Ovanligt konsekvent höga poäng');
        riskScore += 0.2;
      }

      // Reward accumulation factor  
      const avgRewardPerFeedback = customerHistory.totalRewardsEarned / Math.max(1, customerHistory.totalFeedbacks);
      if (avgRewardPerFeedback > 50) { // More than 50 SEK average per feedback
        factors.push('Hög genomsnittlig belöning per feedback');
        riskScore += 0.2;
      }

      // Suspicious activity score
      if (customerHistory.suspiciousActivityScore && customerHistory.suspiciousActivityScore > 0.7) {
        factors.push('Hög misstankepoäng från fraud-detection');
        riskScore += 0.5;
      }
    }

    // Current score analysis
    if (qualityScore.total > 95 && qualityScore.confidence && qualityScore.confidence < 0.7) {
      factors.push('Hög kvalitetspoäng men låg confidence');
      riskScore += 0.3;
    }

    // Adjust based on business risk tolerance
    const tolerance = businessConstraints?.riskTolerance || 'medium';
    if (tolerance === 'low') {
      riskScore *= 1.2; // More strict
    } else if (tolerance === 'high') {
      riskScore *= 0.8; // More lenient
    }

    let riskLevel: 'low' | 'medium' | 'high';
    if (riskScore < 0.3) {
      riskLevel = 'low';
    } else if (riskScore < 0.6) {
      riskLevel = 'medium';
    } else {
      riskLevel = 'high';
    }

    return {
      riskLevel,
      factors,
      confidence: Math.min(1.0, Math.max(0.3, 1 - (factors.length * 0.1)))
    };
  }

  /**
   * Calculate loyalty bonus based on comprehensive customer history
   */
  private calculateLoyaltyBonus(customerHistory: { 
    totalFeedbacks: number; 
    averageScore: number;
    totalRewardsEarned: number;
    accountAge: number;
  }): number {
    let bonus = 0;

    // Base loyalty bonus for consistent customers
    if (customerHistory.totalFeedbacks >= 5 && customerHistory.averageScore >= 70) {
      bonus += 0.005; // 0.5% base loyalty bonus
    }

    // Tier-based loyalty bonuses
    if (customerHistory.totalFeedbacks >= 10 && customerHistory.averageScore >= 75) {
      bonus += 0.005; // Additional 0.5% for frequent quality feedback
    }

    if (customerHistory.totalFeedbacks >= 25 && customerHistory.averageScore >= 80) {
      bonus += 0.005; // Additional 0.5% for very frequent quality feedback
    }

    // Long-term customer bonus
    if (customerHistory.accountAge >= 90 && customerHistory.totalFeedbacks >= 10) {
      bonus += 0.005; // 0.5% for long-term engagement
    }

    // Cap total loyalty bonus at 2%
    return Math.min(0.02, bonus);
  }

  /**
   * Calculate bonus for balanced component scores
   */
  private calculateComponentBalanceBonus(qualityScore: QualityScore): number {
    const scores = [qualityScore.authenticity, qualityScore.concreteness, qualityScore.depth];
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min;

    // Bonus for well-balanced scores (small range between components)
    if (range <= 10 && min >= 70) {
      return 0.005; // 0.5% bonus for balanced high-quality feedback
    } else if (range <= 15 && min >= 60) {
      return 0.0025; // 0.25% bonus for reasonably balanced feedback
    }

    return 0;
  }

  /**
   * Apply various caps and constraints to the final percentage
   */
  private applyCaps(
    percentage: number,
    purchaseAmount: number,
    businessConstraints?: {
      maxDailyRewardPerCustomer?: number;
      maxMonthlyRewardBudget?: number;
      currentMonthlySpent?: number;
    },
    customerHistory?: { totalRewardsEarned: number; accountAge: number },
    caps: Array<{ type: string; originalAmount: number; cappedAmount: number; reason: string }>
  ): number {
    let cappedPercentage = percentage;

    // Absolute percentage cap (15%)
    if (cappedPercentage > 0.15) {
      caps.push({
        type: 'absolute_percentage_cap',
        originalAmount: cappedPercentage,
        cappedAmount: 0.15,
        reason: 'Absolut gräns på 15% av köpesumma'
      });
      cappedPercentage = 0.15;
    }

    // Absolute amount cap (200 SEK per transaction)
    const rewardAmount = purchaseAmount * cappedPercentage;
    if (rewardAmount > 200) {
      const newPercentage = 200 / purchaseAmount;
      caps.push({
        type: 'absolute_amount_cap',
        originalAmount: cappedPercentage,
        cappedAmount: newPercentage,
        reason: 'Absolut gräns på 200 SEK per feedback'
      });
      cappedPercentage = newPercentage;
    }

    // Daily customer cap
    if (businessConstraints?.maxDailyRewardPerCustomer) {
      const dailyAmount = purchaseAmount * cappedPercentage;
      if (dailyAmount > businessConstraints.maxDailyRewardPerCustomer) {
        const newPercentage = businessConstraints.maxDailyRewardPerCustomer / purchaseAmount;
        caps.push({
          type: 'daily_customer_cap',
          originalAmount: cappedPercentage,
          cappedAmount: newPercentage,
          reason: `Daglig kundgräns på ${businessConstraints.maxDailyRewardPerCustomer} SEK`
        });
        cappedPercentage = newPercentage;
      }
    }

    // Monthly budget cap
    if (businessConstraints?.maxMonthlyRewardBudget && businessConstraints?.currentMonthlySpent !== undefined) {
      const remainingBudget = businessConstraints.maxMonthlyRewardBudget - businessConstraints.currentMonthlySpent;
      const proposedReward = purchaseAmount * cappedPercentage;
      
      if (proposedReward > remainingBudget && remainingBudget > 0) {
        const newPercentage = remainingBudget / purchaseAmount;
        caps.push({
          type: 'monthly_budget_cap',
          originalAmount: cappedPercentage,
          cappedAmount: newPercentage,
          reason: `Månadlig budget: ${remainingBudget} SEK kvar av ${businessConstraints.maxMonthlyRewardBudget} SEK`
        });
        cappedPercentage = newPercentage;
      } else if (remainingBudget <= 0) {
        caps.push({
          type: 'budget_exhausted',
          originalAmount: cappedPercentage,
          cappedAmount: 0,
          reason: 'Månadlig belöningsbudget är slut'
        });
        cappedPercentage = 0;
      }
    }

    // Purchase amount minimums and maximums
    if (purchaseAmount < 50) {
      caps.push({
        type: 'minimum_purchase',
        originalAmount: cappedPercentage,
        cappedAmount: 0,
        reason: 'Minimum köpbelopp 50 SEK för belöning'
      });
      cappedPercentage = 0;
    } else if (purchaseAmount > 5000) {
      // Cap percentage for very large purchases
      const maxPercentageForLarge = 0.05; // Max 5% for purchases over 5000 SEK
      if (cappedPercentage > maxPercentageForLarge) {
        caps.push({
          type: 'large_purchase_cap',
          originalAmount: cappedPercentage,
          cappedAmount: maxPercentageForLarge,
          reason: 'Max 5% belöning för köp över 5000 SEK'
        });
        cappedPercentage = maxPercentageForLarge;
      }
    }

    return Math.max(0, cappedPercentage);
  }

  /**
   * Generate explanation for loyalty bonus
   */
  private generateLoyaltyBonusExplanation(
    customerHistory: { 
      totalFeedbacks: number; 
      averageScore: number;
      accountAge: number;
    },
    bonusAmount: number
  ): string {
    const parts = [];
    
    if (customerHistory.totalFeedbacks >= 25) {
      parts.push('mycket aktiv kund');
    } else if (customerHistory.totalFeedbacks >= 10) {
      parts.push('återkommande kund');
    }
    
    if (customerHistory.averageScore >= 80) {
      parts.push('konsekvent hög kvalitet');
    } else if (customerHistory.averageScore >= 70) {
      parts.push('bra genomsnittlig kvalitet');
    }
    
    if (customerHistory.accountAge >= 90) {
      parts.push('långsiktig relation');
    }

    return `Lojalitetsbonus: ${parts.join(', ')} (${(bonusAmount * 100).toFixed(1)}%)`;
  }

  /**
   * Generate comprehensive reward explanation
   */
  private generateEnhancedRewardExplanation(
    score: QualityScore,
    basePercentage: number,
    finalPercentage: number,
    bonuses: Array<{ type: string; amount: number; reason: string }>,
    caps: Array<{ type: string; originalAmount: number; cappedAmount: number; reason: string }>
  ): string {
    let explanation = `Basbelöning: ${(basePercentage * 100).toFixed(1)}% för ${this.getTierName(score.total)} feedback (${score.total}/100 poäng).`;
    
    if (bonuses.length > 0) {
      const totalBonus = bonuses.reduce((sum, b) => sum + b.amount, 0);
      explanation += ` Bonusar: +${(totalBonus * 100).toFixed(1)}% (${bonuses.map(b => b.reason).join(', ')}).`;
    }

    if (caps.length > 0) {
      const significantCaps = caps.filter(c => c.originalAmount - c.cappedAmount > 0.001);
      if (significantCaps.length > 0) {
        explanation += ` Begränsningar: ${significantCaps.map(c => c.reason).join(', ')}.`;
      }
    }

    explanation += ` Slutlig belöning: ${(finalPercentage * 100).toFixed(1)}%.`;

    return explanation;
  }

  /**
   * Generate comprehensive explanation of AI scoring for customer understanding
   */
  generateScoreExplanation(
    qualityScore: QualityScore,
    transcript: string,
    businessContext: BusinessContext,
    purchaseItems: string[],
    concretenessAnalysis?: any,
    depthAnalysis?: any
  ): {
    overallExplanation: string;
    componentBreakdown: {
      authenticity: { score: number; explanation: string; examples: string[] };
      concreteness: { score: number; explanation: string; examples: string[] };
      depth: { score: number; explanation: string; examples: string[] };
    };
    improvementSuggestions: string[];
    strengthsHighlighted: string[];
    customerFriendlyScore: string;
  } {
    // Generate overall explanation
    const overallExplanation = this.generateOverallExplanation(qualityScore);
    
    // Component-specific breakdowns
    const componentBreakdown = {
      authenticity: this.generateAuthenticityExplanation(qualityScore.authenticity, transcript, businessContext, purchaseItems),
      concreteness: this.generateConcretenessExplanation(qualityScore.concreteness, transcript, concretenessAnalysis),
      depth: this.generateDepthExplanation(qualityScore.depth, transcript, depthAnalysis)
    };

    // Generate improvement suggestions
    const improvementSuggestions = this.generateImprovementSuggestions(qualityScore, componentBreakdown);

    // Highlight strengths
    const strengthsHighlighted = this.highlightStrengths(qualityScore, componentBreakdown);

    // Customer-friendly score description
    const customerFriendlyScore = this.generateCustomerFriendlyScore(qualityScore.total);

    return {
      overallExplanation,
      componentBreakdown,
      improvementSuggestions,
      strengthsHighlighted,
      customerFriendlyScore
    };
  }

  /**
   * Generate overall explanation of the feedback quality
   */
  private generateOverallExplanation(qualityScore: QualityScore): string {
    const total = qualityScore.total;
    const tierName = this.getTierName(total);

    let explanation = `Din feedback fick ${total}/100 poäng och klassas som "${tierName}".`;

    if (total >= 90) {
      explanation += ` Detta är en exceptionell feedback som visar djup förståelse för företaget och ger mycket värdefulla insikter.`;
    } else if (total >= 75) {
      explanation += ` Detta är en mycket bra feedback som innehåller konkreta observationer och hjälpsamma förslag.`;
    } else if (total >= 60) {
      explanation += ` Detta är en acceptabel feedback som ger användbara insikter men kunde vara mer detaljerad.`;
    } else {
      explanation += ` För att få högre poäng behöver feedbacken vara mer specifik och detaljerad.`;
    }

    // Add weighting explanation
    explanation += ` Poängen beräknas genom: Trovärdighet (40%), Konkrethet (30%), och Djup (30%).`;

    return explanation;
  }

  /**
   * Generate authenticity-specific explanation
   */
  private generateAuthenticityExplanation(
    score: number, 
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): { score: number; explanation: string; examples: string[] } {
    const examples: string[] = [];
    let explanation = '';

    if (score >= 90) {
      explanation = 'Utmärkt trovärdighet! Din feedback visar tydligt att du varit på plats och förstår företagets verksamhet.';
      // Find specific mentions that show authenticity
      if (businessContext.strengths) {
        businessContext.strengths.forEach(strength => {
          if (transcript.toLowerCase().includes(strength.toLowerCase())) {
            examples.push(`Du nämnde "${strength}" som vi är kända för`);
          }
        });
      }
      purchaseItems.forEach(item => {
        if (transcript.toLowerCase().includes(item.toLowerCase())) {
          examples.push(`Du refererade specifikt till din "${item}"`);
        }
      });
    } else if (score >= 75) {
      explanation = 'Bra trovärdighet. Din feedback stämmer väl överens med vad vi vet om vår verksamhet.';
    } else if (score >= 60) {
      explanation = 'Rimlig trovärdighet, men din feedback kunde innehålla fler specifika detaljer som visar att du varit här.';
    } else {
      explanation = 'Låg trovärdighet. För att förbättra, nämn specifika detaljer om din upplevelse som visar att du varit på plats.';
    }

    return { score, explanation, examples };
  }

  /**
   * Generate concreteness-specific explanation
   */
  private generateConcretenessExplanation(
    score: number, 
    transcript: string, 
    analysis?: any
  ): { score: number; explanation: string; examples: string[] } {
    const examples: string[] = [];
    let explanation = '';

    if (analysis) {
      // Use analysis to provide specific feedback
      if (analysis.specificDetails && analysis.specificDetails.length > 0) {
        examples.push(`Bra specifika detaljer: ${analysis.specificDetails.slice(0, 2).join(', ')}`);
      }
      if (analysis.actionableInsights && analysis.actionableInsights.length > 0) {
        examples.push(`Handlingsbara förslag: ${analysis.actionableInsights.slice(0, 2).join(', ')}`);
      }
      if (analysis.vagueness && analysis.vagueness.length > 0) {
        examples.push(`Kunde varit mer specifik istället för: ${analysis.vagueness.slice(0, 2).join(', ')}`);
      }
    }

    if (score >= 90) {
      explanation = 'Utmärkt konkrethet! Du ger mycket specifika observationer och praktiska förslag.';
    } else if (score >= 75) {
      explanation = 'Bra konkrethet med flera specifika detaljer och handlingsbara insikter.';
    } else if (score >= 60) {
      explanation = 'Acceptabel konkrethet, men fler specifika exempel och mätbara observationer skulle förbättra feedbacken.';
    } else {
      explanation = 'Låg konkrethet. Försök att inkludera specifika namn, tider, platser och mätbara observationer.';
    }

    return { score, explanation, examples };
  }

  /**
   * Generate depth-specific explanation
   */
  private generateDepthExplanation(
    score: number, 
    transcript: string, 
    analysis?: any
  ): { score: number; explanation: string; examples: string[] } {
    const examples: string[] = [];
    let explanation = '';

    if (analysis) {
      if (analysis.reflectiveElements && analysis.reflectiveElements.length > 0) {
        examples.push(`Reflektion: ${analysis.reflectiveElements.slice(0, 2).join(', ')}`);
      }
      if (analysis.causalReasoningInstances && analysis.causalReasoningInstances.length > 0) {
        examples.push(`Orsakssamband: ${analysis.causalReasoningInstances.slice(0, 2).join(', ')}`);
      }
      if (analysis.constructiveNature && analysis.constructiveNature.length > 0) {
        examples.push(`Konstruktiva förslag: ${analysis.constructiveNature.slice(0, 2).join(', ')}`);
      }
    }

    if (score >= 90) {
      explanation = 'Utmärkt djup! Din feedback visar reflektion, orsakssamband och förståelse för konsekvenser.';
    } else if (score >= 75) {
      explanation = 'Bra djup med genomtänkta observationer och förklaringar.';
    } else if (score >= 60) {
      explanation = 'Acceptabelt djup, men mer reflektion och förklaringar skulle göra feedbacken värdefullare.';
    } else {
      explanation = 'Lågt djup. Försök förklara varför saker påverkade dig och vad konsekvenserna kan bli.';
    }

    return { score, explanation, examples };
  }

  /**
   * Generate personalized improvement suggestions
   */
  private generateImprovementSuggestions(
    qualityScore: QualityScore,
    componentBreakdown: any
  ): string[] {
    const suggestions: string[] = [];
    const lowest = Math.min(qualityScore.authenticity, qualityScore.concreteness, qualityScore.depth);

    // Focus on the weakest component first
    if (qualityScore.authenticity === lowest && qualityScore.authenticity < 75) {
      suggestions.push('💡 Nämn specifika personalnamn, produkter du köpte, eller exakta tider för att visa att du verkligen var där');
      suggestions.push('💡 Referera till saker som är unika för just denna butik/restaurang');
    }

    if (qualityScore.concreteness === lowest && qualityScore.concreteness < 75) {
      suggestions.push('💡 Använd mätbara beskrivningar som "tog 10 minuter", "perfekt temperatur", "stor portion"');
      suggestions.push('💡 Ge konkreta förbättringsförslag istället för bara "det var bra/dåligt"');
    }

    if (qualityScore.depth === lowest && qualityScore.depth < 75) {
      suggestions.push('💡 Förklara varför något påverkade din upplevelse: "eftersom...", "det gjorde att..."');
      suggestions.push('💡 Tänk på konsekvenser: "det kan leda till...", "andra kunder skulle..."');
    }

    // General suggestions for improvement
    if (qualityScore.total < 60) {
      suggestions.push('💡 Beskriv hela din upplevelse från början till slut');
      suggestions.push('💡 Jämför med andra liknande ställen du besökt');
    }

    return suggestions.slice(0, 4); // Limit to 4 suggestions
  }

  /**
   * Highlight what the customer did well
   */
  private highlightStrengths(
    qualityScore: QualityScore,
    componentBreakdown: any
  ): string[] {
    const strengths: string[] = [];

    if (qualityScore.authenticity >= 80) {
      strengths.push('✨ Excellent trovärdighet - det framgår tydligt att du varit på plats');
    }

    if (qualityScore.concreteness >= 80) {
      strengths.push('✨ Mycket konkret feedback med specifika detaljer och exempel');
    }

    if (qualityScore.depth >= 80) {
      strengths.push('✨ Genomtänkt och reflekterad feedback som visar djup förståelse');
    }

    // Component balance bonus
    const scores = [qualityScore.authenticity, qualityScore.concreteness, qualityScore.depth];
    const range = Math.max(...scores) - Math.min(...scores);
    if (range <= 15 && Math.min(...scores) >= 70) {
      strengths.push('✨ Väl balanserad feedback inom alla kategorier');
    }

    // High overall score
    if (qualityScore.total >= 85) {
      strengths.push('✨ Exceptionellt hög kvalitet - denna feedback är mycket värdefull för företaget');
    }

    return strengths;
  }

  /**
   * Generate customer-friendly score description
   */
  private generateCustomerFriendlyScore(score: number): string {
    if (score >= 95) {
      return '🌟 FANTASTISK - En av våra bästa feedbacks någonsin!';
    } else if (score >= 90) {
      return '⭐ EXCEPTIONELL - Riktigt bra jobbat med detaljerna!';
    } else if (score >= 80) {
      return '👍 MYCKET BRA - Innehåller värdefulla insikter!';
    } else if (score >= 70) {
      return '✓ BRA - En gedigen feedback med bra observationer!';
    } else if (score >= 60) {
      return '📝 OKEJ - Bra grund, men kan utvecklas mer!';
    } else {
      return '💪 POTENTIAL - Med lite mer detaljer kan du få mycket högre poäng!';
    }
  }

  /**
   * Generate short summary for display
   */
  generateQuickSummary(qualityScore: QualityScore, rewardAmount: number): string {
    const tier = this.getTierName(qualityScore.total);
    const customerFriendly = this.generateCustomerFriendlyScore(qualityScore.total);
    
    return `${customerFriendly} Du fick ${qualityScore.total}/100 poäng (${tier}) och tjänade ${rewardAmount} SEK. Tack för din värdefulla feedback!`;
  }

  /**
   * Analyze concreteness of feedback with detailed Swedish language processing
   */
  analyzeConcreteness(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): {
    score: number;
    analysis: {
      specificDetails: string[];
      actionableInsights: string[];
      measurableObservations: string[];
      vagueness: string[];
      concretenessFactor: number;
    };
  } {
    const text = transcript.toLowerCase();
    const analysis = {
      specificDetails: [],
      actionableInsights: [],
      measurableObservations: [],
      vagueness: [],
      concretenessFactor: 0
    };

    // 1. Identify specific details (names, locations, times, specific products)
    const specificDetailPatterns = [
      // Names (Swedish names are often capitalized in feedback)
      /\b([A-ZÅÄÖ][a-zåäö]+)\s+(var|som|hjälpte|serverade)/g,
      // Time references
      /\b(kl|klockan|tid)\s*(\d{1,2}[:.]\d{2}|\d{1,2})/g,
      /\b(idag|igår|förra\s+veckan|i\s+morse|på\s+eftermiddagen)/g,
      // Specific locations within store
      /\b(kassan|kassor|kassa\s+\d+|vid\s+ingången|i\s+hörnet|vid\s+fönstret|första\s+våningen)/g,
      // Product specifics
      /\b(cappuccino|latte|espresso|americano|macchiato|kanelbulle|croissant|smörgås)/g,
      // Measurements and quantities
      /\b(\d+\s*(kr|kronor|procent|minuter|sekunder|grader|liter|cl))/g
    ];

    specificDetailPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.specificDetails.push(...matches);
      }
    });

    // 2. Identify actionable insights (suggestions, specific problems with solutions)
    const actionablePatterns = [
      // Direct suggestions
      /\b(föreslår|rekommenderar|skulle\s+kunna|borde|kan\s+ni|kanske\s+ni)/g,
      // Problem-solution pairs
      /\b(problemet\s+är|utmaningen\s+är|svårigheten\s+är).*?(lösning|förbättring|åtgärd)/g,
      // Specific improvement areas
      /\b(skulle\s+vara\s+bättre\s+om|skulle\s+förbättras\s+om|behöver\s+justeras)/g,
      // Comparative feedback
      /\b(bättre\s+än|sämre\s+än|jämfört\s+med|i\s+förhållande\s+till)/g
    ];

    actionablePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.actionableInsights.push(...matches);
      }
    });

    // 3. Identify measurable observations
    const measurablePatterns = [
      // Temperature references
      /\b(för\s+varmt|för\s+kallt|perfekt\s+temperatur|lagom\s+varmt|iskall|kokhet)/g,
      // Quality descriptors with specifics
      /\b(krämigt|fast|mjukt|segt|färskt|gammalt|torrt|fuktigt|salt|sött|surt|bittert)/g,
      // Time/speed measurements
      /\b(snabbt|långsamt|vänta\s+\d+|tog\s+\d+|inom\s+\d+|efter\s+\d+)/g,
      // Size/quantity observations
      /\b(stor|liten|lagom\s+stor|för\s+stor|för\s+liten|fyllig|tunn|tjock)/g,
      // Sensory details
      /\b(doftade|lukta|smaka|höra|känna|se|titta|lyssna)/g
    ];

    measurablePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.measurableObservations.push(...matches);
      }
    });

    // 4. Identify vague language that reduces concreteness
    const vaguePatterns = [
      /\b(bra|dåligt|okej|ok|sådär|ganska\s+bra|rätt\s+bra|helt\s+okej)/g,
      /\b(någonting|någonstans|ibland|kanske|typ|liksom|sånt\s+där)/g,
      /\b(allmänt\s+sett|överlag|i\s+stort\s+sett|typ\s+av|slags)/g,
      /\b(saker|grejer|sånt|sådant|det\s+där|den\s+där)/g
    ];

    vaguePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.vagueness.push(...matches);
      }
    });

    // Calculate concreteness score
    let score = 0;

    // Base score from word count (longer feedback tends to be more detailed)
    const wordCount = transcript.split(/\s+/).length;
    const lengthScore = Math.min(20, wordCount / 2); // Max 20 points for length

    // Specific details (40 points max)
    const detailScore = Math.min(40, analysis.specificDetails.length * 8);

    // Actionable insights (25 points max)  
    const actionableScore = Math.min(25, analysis.actionableInsights.length * 12);

    // Measurable observations (25 points max)
    const measurableScore = Math.min(25, analysis.measurableObservations.length * 5);

    // Vagueness penalty (up to -20 points)
    const vaguenessPenalty = Math.min(20, analysis.vagueness.length * 3);

    // Context relevance bonus
    const contextRelevanceBonus = this.calculateContextRelevanceBonus(
      transcript, businessContext, purchaseItems
    );

    score = lengthScore + detailScore + actionableScore + measurableScore - vaguenessPenalty + contextRelevanceBonus;
    
    // Cap at 100
    score = Math.min(100, Math.max(0, score));

    analysis.concretenessFactor = score / 100;

    return { score, analysis };
  }

  /**
   * Calculate bonus for context relevance in concreteness analysis
   */
  private calculateContextRelevanceBonus(
    transcript: string, 
    businessContext: BusinessContext, 
    purchaseItems: string[]
  ): number {
    let bonus = 0;
    const text = transcript.toLowerCase();

    // Bonus for mentioning specific purchase items
    purchaseItems.forEach(item => {
      if (text.includes(item.toLowerCase())) {
        bonus += 3;
      }
    });

    // Bonus for mentioning business-specific elements
    if (businessContext.layout?.departments) {
      businessContext.layout.departments.forEach(dept => {
        if (text.includes(dept.toLowerCase())) {
          bonus += 2;
        }
      });
    }

    // Bonus for mentioning known strengths or issues
    if (businessContext.strengths) {
      businessContext.strengths.forEach(strength => {
        if (text.includes(strength.toLowerCase())) {
          bonus += 2;
        }
      });
    }

    if (businessContext.knownIssues) {
      businessContext.knownIssues.forEach(issue => {
        if (text.includes(issue.toLowerCase())) {
          bonus += 3; // Higher bonus for addressing known issues
        }
      });
    }

    return Math.min(10, bonus); // Cap bonus at 10 points
  }

  /**
   * Analyze depth of feedback with comprehensive Swedish language analysis
   */
  analyzeDepth(
    transcript: string,
    businessContext: BusinessContext,
    purchaseItems: string[]
  ): {
    score: number;
    analysis: {
      reflectiveElements: string[];
      causalReasoningInstances: string[];
      contextualUnderstanding: string[];
      consequenceConsiderations: string[];
      comparativeInsights: string[];
      emotionalDepth: string[];
      constructiveNature: string[];
      superficialIndicators: string[];
      depthFactor: number;
    };
  } {
    const text = transcript.toLowerCase();
    const analysis = {
      reflectiveElements: [],
      causalReasoningInstances: [],
      contextualUnderstanding: [],
      consequenceConsiderations: [],
      comparativeInsights: [],
      emotionalDepth: [],
      constructiveNature: [],
      superficialIndicators: [],
      depthFactor: 0
    };

    // 1. Identify reflective elements (shows thoughtfulness)
    const reflectivePatterns = [
      /\b(jag\s+(tänker|funderar|reflekterar|känner|upplever)\s+att)/g,
      /\b(det\s+(gör\s+mig|får\s+mig\s+att|påverkar\s+mig))/g,
      /\b(jag\s+(märkte|observerade|lade\s+märke\s+till|upptäckte))/g,
      /\b(enligt\s+min\s+(åsikt|upplevelse|uppfattning))/g,
      /\b(ur\s+mitt\s+perspektiv|från\s+min\s+synvinkel)/g,
      /\b(när\s+jag\s+(tänker\s+efter|reflekterar|funderar))/g
    ];

    reflectivePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.reflectiveElements.push(...matches);
      }
    });

    // 2. Identify causal reasoning (because, due to, leads to)
    const causalPatterns = [
      /\b(eftersom|därför\s+att|på\s+grund\s+av|beroende\s+på)/g,
      /\b(det\s+(leder\s+till|resulterar\s+i|orsakar|betyder\s+att))/g,
      /\b(anledningen\s+(är\s+att|till\s+att)|orsaken\s+är)/g,
      /\b(följden\s+(blir|av\s+detta)|konsekvensen\s+är)/g,
      /\b(detta\s+(innebär|påverkar|medför)\s+att)/g
    ];

    causalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.causalReasoningInstances.push(...matches);
      }
    });

    // 3. Contextual understanding (shows awareness of business context)
    const contextualPatterns = [
      /\b(förstår\s+att\s+ni|jag\s+vet\s+att\s+ni|medveten\s+om\s+att)/g,
      /\b(med\s+tanke\s+på|i\s+relation\s+till|jämfört\s+med)/g,
      /\b(inom\s+(branschen|området)|för\s+en\s+(restaurang|butik|kafé))/g,
      /\b(som\s+(kund|gäst|besökare)\s+förväntar\s+jag\s+mig)/g,
      /\b(era\s+(utmaningar|möjligheter|styrkor|svagheter))/g,
      /\b(konkurrensen\s+inom|marknaden\s+för)/g
    ];

    contextualPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.contextualUnderstanding.push(...matches);
      }
    });

    // 4. Consequence considerations (thinks about impact)
    const consequencePatterns = [
      /\b(det\s+kan\s+(leda\s+till|betyda\s+att|resultera\s+i))/g,
      /\b(risk(en\s+är|er\s+för)|fara(n\s+är|n\s+med))/g,
      /\b(påverka(r\s+andra\s+kunder|r\s+verksamheten|r\s+upplevelsen))/g,
      /\b(långsiktigt|på\s+sikt|i\s+framtiden|framöver)/g,
      /\b(effekt(en\s+blir|erna\s+av)|inverka(n\s+på|r\s+på))/g,
      /\b(kunde\s+(påverka|förbättra|förvärra|förändra))/g
    ];

    consequencePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.consequenceConsiderations.push(...matches);
      }
    });

    // 5. Comparative insights (benchmarking, experiences elsewhere)
    const comparativePatterns = [
      /\b(jämfört\s+med\s+(andra|tidigare)|i\s+förhållande\s+till)/g,
      /\b(andra\s+(ställen|restauranger|kaféer|butiker))/g,
      /\b(tidigare\s+(besök|erfarenheter|upplevelser))/g,
      /\b(skillnaden\s+(är|mellan)|liknande\s+(ställen|upplevelser))/g,
      /\b(standard(en\s+är|en\s+inom)|nivå(n\s+jämfört|n\s+här))/g,
      /\b(vanligtvis|normalt\s+sett|brukar\s+vara)/g
    ];

    comparativePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.comparativeInsights.push(...matches);
      }
    });

    // 6. Emotional depth (feelings, emotional impact)
    const emotionalPatterns = [
      /\b(känns\s+(som|att)|känsla\s+av|stämning(en\s+är|en\s+var))/g,
      /\b(atmosfär(en\s+är|en\s+var|en\s+känns)|miljö(n\s+känns|n\s+var))/g,
      /\b(trygg(het|a)|bekväm|avslappna(d|de)|stressig|orolig)/g,
      /\b(glädje|frustration|besvikelse|tillfredsställelse)/g,
      /\b(väl(mående|befinnande)|komfort|trygghet)/g,
      /\b(uppskattar\s+verkligen|djupt\s+tacksam|riktigt\s+nöjd)/g
    ];

    emotionalPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.emotionalDepth.push(...matches);
      }
    });

    // 7. Constructive nature (solution-oriented, helpful)
    const constructivePatterns = [
      /\b(förslag\s+(är\s+att|skulle\s+vara)|rekommendation)/g,
      /\b(skulle\s+(kunna|vara\s+bra\s+att|hjälpa\s+om))/g,
      /\b(möjlighet\s+(att\s+förbättra|för\s+utveckling))/g,
      /\b(potentia(l\s+för|len\s+att)|kan\s+utvecklas)/g,
      /\b(hoppas\s+att|önskar\s+att|skulle\s+vara\s+bra)/g,
      /\b(framtid(a\s+besök|en\s+skulle)|fortsatt\s+förbättring)/g
    ];

    constructivePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.constructiveNature.push(...matches);
      }
    });

    // 8. Identify superficial indicators (reduces depth score)
    const superficialPatterns = [
      /\b(bara|endast|enbart)\s+(bra|dåligt|okej|ok)/g,
      /\b(inget\s+(speciellt|mer\s+att\s+säga)|inga\s+kommentarer)/g,
      /\b(som\s+vanligt|som\s+alltid|som\s+förväntat)/g,
      /\b(rätt\s+så|typ|liksom|sånt\s+där)\s+(bra|okej)/g,
      /\b(helt\s+enkelt|bara\s+så|det\s+var\s+det)/g
    ];

    superficialPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        analysis.superficialIndicators.push(...matches);
      }
    });

    // Calculate depth score
    let score = 0;

    // Base score from sentence complexity
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim().length > 5);
    const avgWordsPerSentence = transcript.split(/\s+/).length / Math.max(1, sentences.length);
    const complexityScore = Math.min(15, (avgWordsPerSentence - 5) * 2); // Bonus for complex sentences

    // Reflective elements (20 points max)
    const reflectiveScore = Math.min(20, analysis.reflectiveElements.length * 10);

    // Causal reasoning (20 points max)
    const causalScore = Math.min(20, analysis.causalReasoningInstances.length * 8);

    // Contextual understanding (15 points max)
    const contextualScore = Math.min(15, analysis.contextualUnderstanding.length * 7);

    // Consequence considerations (15 points max)
    const consequenceScore = Math.min(15, analysis.consequenceConsiderations.length * 7);

    // Comparative insights (10 points max)
    const comparativeScore = Math.min(10, analysis.comparativeInsights.length * 5);

    // Emotional depth (10 points max)
    const emotionalScore = Math.min(10, analysis.emotionalDepth.length * 4);

    // Constructive nature (10 points max)
    const constructiveScore = Math.min(10, analysis.constructiveNature.length * 5);

    // Superficial penalty (up to -20 points)
    const superficialPenalty = Math.min(20, analysis.superficialIndicators.length * 4);

    // Business context depth bonus
    const contextDepthBonus = this.calculateBusinessContextDepthBonus(
      transcript, businessContext, purchaseItems
    );

    score = complexityScore + reflectiveScore + causalScore + contextualScore + 
            consequenceScore + comparativeScore + emotionalScore + constructiveScore - 
            superficialPenalty + contextDepthBonus;

    // Cap at 100
    score = Math.min(100, Math.max(0, score));

    analysis.depthFactor = score / 100;

    return { score, analysis };
  }

  /**
   * Calculate business context depth bonus for comprehensive understanding
   */
  private calculateBusinessContextDepthBonus(
    transcript: string,
    businessContext: BusinessContext,
    purchaseItems: string[]
  ): number {
    let bonus = 0;
    const text = transcript.toLowerCase();

    // Bonus for demonstrating understanding of business operations
    const operationalUnderstanding = [
      /\b(ni\s+(arbetar|jobbar)\s+med|era\s+(processer|rutiner))/g,
      /\b(verksamhet(en|ens)|affärsmodell|koncept)/g,
      /\b(personal(ens|styrka)|team(et|arbete))/g,
      /\b(kvalitet(sarbete|ssystem)|standard(er|isering))/g
    ];

    operationalUnderstanding.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        bonus += matches.length * 2;
      }
    });

    // Bonus for customer journey awareness
    const journeyAwareness = [
      /\b(från\s+det\s+att|hela\s+(upplevelsen|processen))/g,
      /\b(första\s+intryck|avslutning|helhets(intryck|upplevelse))/g,
      /\b(andra\s+(kunder|gäster)\s+(verkar|såg\s+ut\s+att))/g
    ];

    journeyAwareness.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        bonus += matches.length * 3;
      }
    });

    // Bonus for industry knowledge
    const industryKnowledge = [
      /\b(inom\s+(branschen|restaurang|kaféverksamhet))/g,
      /\b(konkurrent(er|erna)|marknaden|branschen)/g,
      /\b(trend(er|en\s+är)|utveckling(en\s+inom|ar\s+sig))/g
    ];

    industryKnowledge.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        bonus += matches.length * 3;
      }
    });

    return Math.min(15, bonus); // Cap bonus at 15 points
  }

  /**
   * Validate and improve quality score consistency
   */
  validateAndAdjustScore(score: QualityScore): QualityScore {
    // Ensure scores are within valid ranges
    score.authenticity = Math.max(0, Math.min(100, score.authenticity));
    score.concreteness = Math.max(0, Math.min(100, score.concreteness));
    score.depth = Math.max(0, Math.min(100, score.depth));
    score.sentiment = Math.max(-1, Math.min(1, score.sentiment));

    // Recalculate total score with proper weighting
    const weightedTotal = (
      score.authenticity * 0.40 +
      score.concreteness * 0.30 +
      score.depth * 0.30
    );

    // Ensure total is consistent with component scores
    score.total = Math.round(weightedTotal);

    // Validate consistency: high scores should have reasonable components
    if (score.total > 80) {
      const minExpected = 70;
      if (score.authenticity < minExpected || score.concreteness < minExpected || score.depth < minExpected) {
        console.warn('Score inconsistency detected, adjusting components');
        const adjustment = Math.min(10, (minExpected - Math.min(score.authenticity, score.concreteness, score.depth)) / 2);
        score.authenticity = Math.min(100, score.authenticity + adjustment);
        score.concreteness = Math.min(100, score.concreteness + adjustment);
        score.depth = Math.min(100, score.depth + adjustment);
        score.total = Math.round((score.authenticity * 0.40 + score.concreteness * 0.30 + score.depth * 0.30));
      }
    }

    return score;
  }

  private buildContextSection(businessContext: BusinessContext): string {
    let context = `FÖRETAGSKONTEXT:\nTyp: ${businessContext.type}`;

    if (businessContext.layout) {
      context += `\nLayout: Avdelningar: ${businessContext.layout.departments.join(', ')}, ${businessContext.layout.checkouts} kassor`;
      if (businessContext.layout.selfCheckout) {
        context += ', självutcheckning tillgänglig';
      }
    }

    if (businessContext.currentPromotions && businessContext.currentPromotions.length > 0) {
      context += `\nAktuella erbjudanden: ${businessContext.currentPromotions.join(', ')}`;
    }

    if (businessContext.knownIssues && businessContext.knownIssues.length > 0) {
      context += `\nKända utmaningar: ${businessContext.knownIssues.join(', ')}`;
    }

    if (businessContext.strengths && businessContext.strengths.length > 0) {
      context += `\nStyrkor: ${businessContext.strengths.join(', ')}`;
    }

    return context;
  }

  private buildScoringCriteria(): string {
    return `BEDÖMNINGSKRITERIER (0-100 poäng vardera):

1. AUTENTICITET (Vikt: 40%)
   90-100: Perfekt match med företagskontext, visar djup förståelse
   75-89: Mycket trovärdigt, stämmer väl överens med kontext  
   60-74: Rimligt trovärdigt, några detaljer stämmer
   45-59: Delvis trovärdig men vaga referenser
   0-44: Otrovärdigt eller helt irrelevant för företaget

2. KONKRETHET (Vikt: 30%)
   SPECIFIKA DETALJER (40% av konkrethet):
   - Namn på personal (Emma, Maria, osv.)
   - Exakta tider (kl 14:30, på eftermiddagen)
   - Specifika produkter (cappuccino, kanelbulle)
   - Platser i butiken (vid kassan, vid fönstret)
   - Mätbara mängder (5 minuter, 45 kr, stor/liten)
   
   HANDLINGSBARA INSIKTER (35% av konkrethet):
   - Konkreta förbättringsförslag
   - Specifika problem med lösningar
   - Jämförelser som hjälper företaget
   - Tydliga preferenser och behov
   
   MÄTBARA OBSERVATIONER (25% av konkrethet):
   - Temperatur (för varmt/kallt, perfekt)
   - Kvalitet (krämigt, färskt, segt)
   - Hastighet (snabbt, långsamt, tog 5 min)
   - Storlek (stor, liten, lagom)
   - Sensoriska detaljer (doftade, smakade)
   
   POÄNGAVDRAG för vaga uttryck:
   - "Bra/dåligt/okej" utan förklaring
   - "Någonting/någonstans/ibland" 
   - "Saker/grejer/sånt där"
   - Allmänna formuleringar utan specifika exempel

   90-100: Riklig med specifika detaljer, handlingsbara förslag, mätbara observationer
   75-89: Flera konkreta element, tydliga exempel, användbara insikter
   60-74: Några specifika detaljer, vissa handlingsbara element
   45-59: Mestadels allmänt men med enstaka konkreta inslag
   0-44: Vag, allmän feedback utan användbara specifika detaljer

3. DJUP (Vikt: 30%)
   REFLEKTIVA ELEMENT (20% av djup):
   - "Jag tänker/känner att...", "Det får mig att..."
   - Personlig reflektion och eftertanke
   - Medvetenhet om egna upplevelser och reaktioner
   
   ORSAKSSAMBAND (20% av djup):
   - "Eftersom...", "Det leder till...", "På grund av..."
   - Förklarar varför något hände eller påverkar
   - Logiska samband mellan orsak och verkan
   
   KONTEXTUELL FÖRSTÅELSE (15% av djup):
   - "Förstår att ni...", "Med tanke på..."
   - Visar förståelse för företagets situation
   - Medvetenhet om branschens utmaningar
   
   KONSEKVENSTÄNKANDE (15% av djup):
   - "Det kan leda till...", "Långsiktigt..."
   - Tänker på påverkan på andra kunder/verksamhet
   - Framtidsmedvetenhet
   
   JÄMFÖRANDE INSIKTER (10% av djup):
   - "Jämfört med andra...", "Vanligtvis..."
   - Benchmarking mot andra upplevelser
   - Relativ bedömning
   
   EMOTIONELL DJUP (10% av djup):
   - "Känns som...", "Atmosfären..."
   - Beskriver känslor och stämningar
   - Emotionell påverkan av upplevelsen
   
   KONSTRUKTIV NATUR (10% av djup):
   - "Förslag är att...", "Skulle kunna..."
   - Framåtblickande och lösningsorienterad
   - Hjälpsam attityd
   
   POÄNGAVDRAG för ytlighet:
   - "Bara bra", "Inget speciellt", "Som vanligt"
   - Enkel bekräftelse utan reflektion
   - Inga förklaringar eller resonemang

   90-100: Djupgående analys med reflektion, orsakssamband, konsekvenstänkande
   75-89: Välformulerad reflektion med god förståelse och sammanhang  
   60-74: Genomtänkt feedback med rimlig förklaring och vissa insikter
   45-59: Grundläggande förklaring med begränsad reflektion
   0-44: Ytlig kommentar utan fördjupning eller eftertanke`;
  }

  private buildExamples(): string {
    return `EXEMPEL PÅ OLIKA KVALITETSNIVÅER:

EXCEPTIONAL (90+ poäng):
"Jag handlade kaffe i er Vasastan-butik kl 14:30 idag. Baristan Emma var fantastisk - hon kände igen min vanliga beställning och föreslog en ny böna från Guatemala som passade min smak. Lokalen var ren men ljussättningen vid fönsterplatserna kunde vara varmare. Jag märkte att ni bytt till miljövänliga muggar vilket jag uppskattar. Förslaget är att ha mer information om kaffebörnornas ursprung synligt för kunderna."

VERY GOOD (75-89 poäng):
"Bra service och trevlig personal idag. Mitt cappuccino var perfekt temperatur och mjölkskummet var krämigt. Lokalen var mysig men det var lite för kallt vid dörren. Kanske ni kan justera värmen lite?"

ACCEPTABLE (60-74 poäng):
"Okej kaffe och trevlig personal. Lite långsam service men bra kvalitet på drycken."

INSUFFICIENT (under 60 poäng):
"Det var bra." / "Allt var okej." / Irrelevant innehåll`;
  }

  private buildConversationContext(businessContext: BusinessContext): string {
    const typeInfo = {
      'cafe': 'kafé - fokusera på drycker, mat, atmosfär, service',
      'restaurant': 'restaurang - fokusera på mat, service, miljö, värde',
      'grocery_store': 'matbutik - fokusera på utbud, priser, personal, kundupplevelse',
      'retail': 'butik - fokusera på produkter, personal, layout, kundservice'
    };

    return `FÖRETAGSINFORMATION:
Typ: ${typeInfo[businessContext.type] || businessContext.type}
Fokusområden: ${businessContext.strengths?.join(', ') || 'Allmän kundupplevelse'}`;
  }

  private buildHistorySection(conversationHistory: string[]): string {
    if (conversationHistory.length === 0) {
      return 'FÖRSTA INTERAKTION: Välkomna kunden och be om initial feedback.';
    }

    return `SAMTALSHISTORIK:
${conversationHistory.map((msg, i) => `${i % 2 === 0 ? 'KUND' : 'DU'}: ${msg}`).join('\n')}

NÄSTA STEG: Baserat på historiken ovan, ställ en uppföljning som fördjupar feedbacken.`;
  }

  private getQuestionStrategy(historyLength: number, businessType: string): string {
    if (historyLength === 0) {
      return `INLEDNINGSSTRATEGI:
- Välkomna kunden varmt
- Fråga om deras övergripande upplevelse
- Var nyfiken och intresserad`;
    }

    if (historyLength <= 2) {
      return `FÖRDJUPNINGSSTRATEGI:
- Ställ följdfrågor om specifika detaljer
- Be om konkreta exempel
- Fråga om förbättringsförslag`;
    }

    return `AVSLUTNINGSSTRATEGI:
- Sammanfatta deras viktiga poäng
- Tacka för värdefull feedback
- Avsluta på ett positivt sätt`;
  }

  private getRewardTier(score: number): RewardTier {
    return this.rewardTiers.find(tier => score >= tier.min && score <= tier.max) || this.rewardTiers[this.rewardTiers.length - 1];
  }

  private calculateBasePercentage(score: QualityScore, tier: RewardTier): number {
    const [minReward, maxReward] = tier.rewardPercentage;
    
    if (minReward === maxReward) return minReward;
    
    // Linear interpolation within tier
    const tierRange = tier.max - tier.min;
    const scoreWithinTier = score.total - tier.min;
    const percentageWithinTier = scoreWithinTier / tierRange;
    
    return minReward + (percentageWithinTier * (maxReward - minReward));
  }

  private getTierName(score: number): string {
    if (score >= 90) return 'Exceptionell';
    if (score >= 75) return 'Mycket Bra';
    if (score >= 60) return 'Acceptabel';
    return 'Otillräcklig';
  }

  private generateRewardExplanation(
    score: QualityScore, 
    basePercentage: number, 
    bonuses: Array<{ type: string; amount: number; reason: string }>
  ): string {
    let explanation = `Basbelöning: ${(basePercentage * 100).toFixed(1)}% för ${this.getTierName(score.total)} feedback (${score.total}/100 poäng).`;
    
    if (bonuses.length > 0) {
      explanation += ` Bonusar: ${bonuses.map(b => `${(b.amount * 100).toFixed(1)}% (${b.reason})`).join(', ')}.`;
    }

    return explanation;
  }
}