/**
 * Verification Matcher Service
 * 
 * Provides algorithms and utilities for matching customer verifications
 * against store transaction records. Implements the tolerance-based
 * matching system (±2 minutes time, ±0.5 SEK amount).
 */

interface TransactionRecord {
  transactionId: string;
  timestamp: Date;
  amount: number;
  location?: string;
  paymentMethod?: string;
}

interface VerificationRecord {
  id: string;
  purchaseTime: Date;
  purchaseAmount: number;
  customerPhone: string;
  storeCode: string;
}

interface MatchResult {
  verified: boolean;
  confidence: number; // 0-1 confidence score
  matchedTransaction?: TransactionRecord;
  reasons: string[];
  toleranceChecks: {
    timeWithinTolerance: boolean;
    amountWithinTolerance: boolean;
    timeDifferenceSeconds: number;
    amountDifference: number;
  };
}

interface MatchingSettings {
  timeToleranceMinutes: number;
  amountToleranceSEK: number;
  requireExactAmount: boolean;
  allowPartialPayments: boolean;
}

export class VerificationMatcher {
  private defaultSettings: MatchingSettings = {
    timeToleranceMinutes: 2,
    amountToleranceSEK: 0.5,
    requireExactAmount: false,
    allowPartialPayments: true
  };

  /**
   * Match a verification against a list of transaction records
   */
  async matchVerification(
    verification: VerificationRecord,
    transactions: TransactionRecord[],
    settings?: Partial<MatchingSettings>
  ): Promise<MatchResult> {
    const config = { ...this.defaultSettings, ...settings };
    
    const results: Array<{ transaction: TransactionRecord; result: MatchResult }> = [];

    // Test each transaction for matching
    for (const transaction of transactions) {
      const matchResult = this.testTransactionMatch(verification, transaction, config);
      if (matchResult.verified) {
        results.push({ transaction, result: matchResult });
      }
    }

    // If no matches found
    if (results.length === 0) {
      return {
        verified: false,
        confidence: 0,
        reasons: ['No matching transactions found within tolerance limits'],
        toleranceChecks: {
          timeWithinTolerance: false,
          amountWithinTolerance: false,
          timeDifferenceSeconds: 0,
          amountDifference: 0
        }
      };
    }

    // Find the best match (highest confidence)
    const bestMatch = results.reduce((best, current) => 
      current.result.confidence > best.result.confidence ? current : best
    );

    return {
      ...bestMatch.result,
      matchedTransaction: bestMatch.transaction
    };
  }

  /**
   * Test if a single transaction matches a verification
   */
  private testTransactionMatch(
    verification: VerificationRecord,
    transaction: TransactionRecord,
    settings: MatchingSettings
  ): MatchResult {
    const timeDifference = Math.abs(
      verification.purchaseTime.getTime() - transaction.timestamp.getTime()
    );
    const timeDifferenceSeconds = timeDifference / 1000;
    const timeDifferenceMinutes = timeDifferenceSeconds / 60;

    const amountDifference = Math.abs(verification.purchaseAmount - transaction.amount);

    const timeWithinTolerance = timeDifferenceMinutes <= settings.timeToleranceMinutes;
    const amountWithinTolerance = amountDifference <= settings.amountToleranceSEK;

    const reasons: string[] = [];
    let confidence = 0;

    // Time matching
    if (timeWithinTolerance) {
      reasons.push(`Time matches (${timeDifferenceSeconds.toFixed(0)}s difference)`);
      // Higher confidence for closer time matches
      confidence += (1 - (timeDifferenceMinutes / settings.timeToleranceMinutes)) * 0.5;
    } else {
      reasons.push(`Time out of tolerance (${timeDifferenceMinutes.toFixed(1)}min difference, max ${settings.timeToleranceMinutes}min)`);
    }

    // Amount matching
    if (amountWithinTolerance) {
      reasons.push(`Amount matches (${amountDifference.toFixed(2)} SEK difference)`);
      // Higher confidence for closer amount matches
      confidence += (1 - (amountDifference / settings.amountToleranceSEK)) * 0.5;
    } else {
      reasons.push(`Amount out of tolerance (${amountDifference.toFixed(2)} SEK difference, max ${settings.amountToleranceSEK} SEK)`);
    }

    // Additional confidence factors
    if (timeWithinTolerance && amountWithinTolerance) {
      // Perfect match within tolerance
      if (timeDifferenceSeconds < 30 && amountDifference < 0.1) {
        confidence = Math.min(0.95, confidence + 0.2); // Very high confidence
        reasons.push('Excellent time and amount precision');
      }
      
      // Exact amount match gets bonus
      if (amountDifference === 0) {
        confidence = Math.min(0.9, confidence + 0.1);
        reasons.push('Exact amount match');
      }

      // Very close time match gets bonus
      if (timeDifferenceSeconds < 10) {
        confidence = Math.min(0.9, confidence + 0.1);
        reasons.push('Very close time match');
      }
    }

    return {
      verified: timeWithinTolerance && amountWithinTolerance,
      confidence: Math.max(0, Math.min(1, confidence)),
      reasons,
      toleranceChecks: {
        timeWithinTolerance,
        amountWithinTolerance,
        timeDifferenceSeconds,
        amountDifference
      }
    };
  }

  /**
   * Batch match multiple verifications against transaction records
   */
  async batchMatch(
    verifications: VerificationRecord[],
    transactions: TransactionRecord[],
    settings?: Partial<MatchingSettings>
  ): Promise<Array<{ verification: VerificationRecord; match: MatchResult }>> {
    const results: Array<{ verification: VerificationRecord; match: MatchResult }> = [];

    for (const verification of verifications) {
      const matchResult = await this.matchVerification(verification, transactions, settings);
      results.push({ verification, match: matchResult });
    }

    return results;
  }

  /**
   * Generate matching statistics and insights
   */
  generateMatchingReport(
    results: Array<{ verification: VerificationRecord; match: MatchResult }>
  ) {
    const totalVerifications = results.length;
    const matchedVerifications = results.filter(r => r.match.verified).length;
    const unmatchedVerifications = totalVerifications - matchedVerifications;

    const confidenceDistribution = {
      high: results.filter(r => r.match.confidence >= 0.8).length,
      medium: results.filter(r => r.match.confidence >= 0.5 && r.match.confidence < 0.8).length,
      low: results.filter(r => r.match.confidence >= 0.2 && r.match.confidence < 0.5).length,
      veryLow: results.filter(r => r.match.confidence < 0.2).length
    };

    const commonIssues = {
      timeOutOfTolerance: results.filter(r => 
        !r.match.toleranceChecks.timeWithinTolerance
      ).length,
      amountOutOfTolerance: results.filter(r => 
        !r.match.toleranceChecks.amountWithinTolerance
      ).length
    };

    return {
      summary: {
        totalVerifications,
        matchedVerifications,
        unmatchedVerifications,
        matchRate: (matchedVerifications / totalVerifications * 100).toFixed(1) + '%'
      },
      confidenceDistribution,
      commonIssues,
      recommendations: this.generateRecommendations(results)
    };
  }

  /**
   * Generate recommendations based on matching results
   */
  private generateRecommendations(
    results: Array<{ verification: VerificationRecord; match: MatchResult }>
  ): string[] {
    const recommendations: string[] = [];
    
    const timeIssues = results.filter(r => !r.match.toleranceChecks.timeWithinTolerance).length;
    const amountIssues = results.filter(r => !r.match.toleranceChecks.amountWithinTolerance).length;
    
    const timeIssueRate = timeIssues / results.length;
    const amountIssueRate = amountIssues / results.length;

    if (timeIssueRate > 0.3) {
      recommendations.push('High rate of time mismatches detected. Consider reviewing store clock synchronization or increasing time tolerance.');
    }

    if (amountIssueRate > 0.2) {
      recommendations.push('High rate of amount mismatches detected. Review if customers are accurately reporting purchase amounts.');
    }

    if (timeIssueRate > 0.1 && amountIssueRate > 0.1) {
      recommendations.push('Both time and amount issues detected. Consider manual review of problematic verifications.');
    }

    const highConfidenceRate = results.filter(r => r.match.confidence >= 0.8).length / results.length;
    if (highConfidenceRate < 0.6) {
      recommendations.push('Low overall matching confidence. Consider tightening verification requirements or implementing additional verification steps.');
    }

    return recommendations;
  }

  /**
   * Create verification guidelines for stores
   */
  generateVerificationInstructions(): {
    overview: string;
    steps: string[];
    toleranceRules: string[];
    examples: Array<{ scenario: string; action: string; }>;
  } {
    return {
      overview: 'This system matches customer-reported purchases against your actual transaction records using time and amount tolerances.',
      
      steps: [
        'Export your transaction data for the review period (POS system dependent)',
        'Download the verification data CSV from your dashboard',
        'For each verification, look for matching transactions within ±2 minutes and ±0.5 SEK',
        'Mark "Transaction Found" as Y/N in the verification spreadsheet',
        'If found, enter the actual transaction time and amount in the "Verified" columns',
        'Mark "Approve" as Y for valid matches, N for suspicious or unmatched verifications',
        'Add notes for any rejections or concerns',
        'Upload the completed spreadsheet back to the system'
      ],
      
      toleranceRules: [
        'Time Tolerance: ±2 minutes from reported purchase time',
        'Amount Tolerance: ±0.5 SEK from reported purchase amount',
        'Both time AND amount must be within tolerance to be considered a match',
        'If multiple transactions match, choose the closest match by time',
        'Round amounts (like 100.00, 50.00) may indicate attempted fraud - review carefully'
      ],
      
      examples: [
        {
          scenario: 'Customer reports: 14:30, 127.50 SEK. Transaction found: 14:29, 127.00 SEK',
          action: 'APPROVE - Within tolerance (1min, 0.50 SEK difference)'
        },
        {
          scenario: 'Customer reports: 14:30, 127.50 SEK. Transaction found: 14:33, 127.50 SEK',
          action: 'REJECT - Outside time tolerance (3min difference)'
        },
        {
          scenario: 'Customer reports: 14:30, 127.50 SEK. Transaction found: 14:29, 128.50 SEK',
          action: 'REJECT - Outside amount tolerance (1.00 SEK difference)'
        },
        {
          scenario: 'Customer reports: 14:30, 100.00 SEK. Multiple round amounts reported by same phone',
          action: 'REVIEW - Suspicious pattern, manual investigation needed'
        }
      ]
    };
  }
}

export const verificationMatcher = new VerificationMatcher();