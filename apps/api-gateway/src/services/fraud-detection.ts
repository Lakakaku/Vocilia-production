/**
 * Fraud Detection Service for Simple Verification
 * Analyzes verification attempts for fraudulent patterns and calculates risk scores
 */

import { db } from '@ai-feedback/database';
import type { SimpleVerificationFraudFlag, SimpleVerificationFraudType } from '@ai-feedback/shared-types';
import type { DeviceFingerprint } from '../utils/device-fingerprinting';
import { analyzeDeviceFingerprint } from '../utils/device-fingerprinting';

interface FraudAnalysisInput {
  customerPhone: string;
  purchaseAmount: number;
  purchaseTime: Date;
  deviceFingerprint: DeviceFingerprint;
  businessId: string;
  ipAddress: string;
}

interface FraudAnalysisResult {
  score: number; // 0-1 where 1 = highest fraud risk
  flags: SimpleVerificationFraudFlag[];
  riskFactors: string[];
}

/**
 * Main fraud detection function that analyzes verification attempts
 */
export async function calculateFraudScore(input: FraudAnalysisInput): Promise<FraudAnalysisResult> {
  const flags: SimpleVerificationFraudFlag[] = [];
  const riskFactors: string[] = [];
  let totalScore = 0;
  let weightSum = 0;

  // 1. Phone number abuse detection (weight: 0.3)
  const phoneAbuse = await analyzePhoneAbuse(input.customerPhone, input.businessId);
  if (phoneAbuse.risk > 0) {
    flags.push({
      type: 'phone_abuse',
      severity: phoneAbuse.risk > 0.7 ? 'high' : phoneAbuse.risk > 0.4 ? 'medium' : 'low',
      description: phoneAbuse.description,
      confidence: phoneAbuse.confidence,
      data: phoneAbuse.data
    });
    totalScore += phoneAbuse.risk * 0.3;
    riskFactors.push(phoneAbuse.description);
  }
  weightSum += 0.3;

  // 2. Time pattern analysis (weight: 0.15)
  const timePattern = await analyzeTimePatterns(input.customerPhone, input.purchaseTime);
  if (timePattern.risk > 0) {
    flags.push({
      type: 'time_pattern',
      severity: timePattern.risk > 0.6 ? 'high' : timePattern.risk > 0.3 ? 'medium' : 'low',
      description: timePattern.description,
      confidence: timePattern.confidence,
      data: timePattern.data
    });
    totalScore += timePattern.risk * 0.15;
    riskFactors.push(timePattern.description);
  }
  weightSum += 0.15;

  // 3. Amount pattern analysis (weight: 0.2)
  const amountPattern = await analyzeAmountPatterns(input.customerPhone, input.purchaseAmount);
  if (amountPattern.risk > 0) {
    flags.push({
      type: 'amount_pattern',
      severity: amountPattern.risk > 0.6 ? 'high' : timePattern.risk > 0.3 ? 'medium' : 'low',
      description: amountPattern.description,
      confidence: amountPattern.confidence,
      data: amountPattern.data
    });
    totalScore += amountPattern.risk * 0.2;
    riskFactors.push(amountPattern.description);
  }
  weightSum += 0.2;

  // 4. Rapid submission detection (weight: 0.15)
  const rapidSubmission = await analyzeRapidSubmissions(input.customerPhone, input.ipAddress);
  if (rapidSubmission.risk > 0) {
    flags.push({
      type: 'rapid_submission',
      severity: rapidSubmission.risk > 0.7 ? 'high' : rapidSubmission.risk > 0.4 ? 'medium' : 'low',
      description: rapidSubmission.description,
      confidence: rapidSubmission.confidence,
      data: rapidSubmission.data
    });
    totalScore += rapidSubmission.risk * 0.15;
    riskFactors.push(rapidSubmission.description);
  }
  weightSum += 0.15;

  // 5. Device fingerprint analysis (weight: 0.1)
  const deviceAnalysis = analyzeDeviceFingerprint(input.deviceFingerprint);
  if (deviceAnalysis.riskScore > 0) {
    totalScore += deviceAnalysis.riskScore * 0.1;
    riskFactors.push(`Device risk: ${deviceAnalysis.flags.join(', ')}`);
  }
  weightSum += 0.1;

  // 6. Duplicate verification check (weight: 0.1)
  const duplicateCheck = await analyzeDuplicateVerifications(input);
  if (duplicateCheck.risk > 0) {
    flags.push({
      type: 'duplicate_verification',
      severity: duplicateCheck.risk > 0.8 ? 'high' : duplicateCheck.risk > 0.5 ? 'medium' : 'low',
      description: duplicateCheck.description,
      confidence: duplicateCheck.confidence,
      data: duplicateCheck.data
    });
    totalScore += duplicateCheck.risk * 0.1;
    riskFactors.push(duplicateCheck.description);
  }
  weightSum += 0.1;

  // Calculate final normalized score
  const finalScore = weightSum > 0 ? Math.min(totalScore / weightSum, 1) : 0;

  return {
    score: Math.round(finalScore * 100) / 100, // Round to 2 decimal places
    flags,
    riskFactors
  };
}

/**
 * Analyze phone number abuse patterns
 */
async function analyzePhoneAbuse(phone: string, businessId: string): Promise<{
  risk: number;
  description: string;
  confidence: number;
  data: Record<string, any>;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Count verifications from this phone in the last 7 days
  const recentVerifications = await db.simpleVerification.findMany({
    where: {
      customerPhone: phone,
      submittedAt: {
        gte: oneWeekAgo
      }
    },
    select: {
      id: true,
      submittedAt: true,
      reviewStatus: true,
      businessId: true
    }
  });

  const data = {
    totalVerifications: recentVerifications.length,
    verifiedBusiness: recentVerifications.filter(v => v.businessId === businessId).length,
    otherBusinesses: recentVerifications.filter(v => v.businessId !== businessId).length,
    rejectedCount: recentVerifications.filter(v => v.reviewStatus === 'rejected').length
  };

  let risk = 0;
  let description = '';

  // High risk if too many verifications
  if (data.totalVerifications > 20) {
    risk = 0.9;
    description = `Extremely high verification frequency: ${data.totalVerifications} in 7 days`;
  } else if (data.totalVerifications > 10) {
    risk = 0.7;
    description = `High verification frequency: ${data.totalVerifications} in 7 days`;
  } else if (data.totalVerifications > 5) {
    risk = 0.4;
    description = `Moderate verification frequency: ${data.totalVerifications} in 7 days`;
  }

  // Increase risk if many rejections
  if (data.rejectedCount > 0) {
    risk += 0.2 * (data.rejectedCount / data.totalVerifications);
    description += `. ${data.rejectedCount} previous rejections`;
  }

  // Slightly increase risk if same phone used across many businesses
  if (data.otherBusinesses > 3) {
    risk += 0.1;
    description += `. Used across ${data.otherBusinesses} different businesses`;
  }

  return {
    risk: Math.min(risk, 1),
    description: description || 'Normal phone usage pattern',
    confidence: data.totalVerifications > 3 ? 0.8 : 0.5,
    data
  };
}

/**
 * Analyze timing patterns for suspicious behavior
 */
async function analyzeTimePatterns(phone: string, currentTime: Date): Promise<{
  risk: number;
  description: string;
  confidence: number;
  data: Record<string, any>;
}> {
  const hour = currentTime.getHours();
  const dayOfWeek = currentTime.getDay();
  
  // Get recent verification times for this phone
  const recentVerifications = await db.simpleVerification.findMany({
    where: {
      customerPhone: phone,
      submittedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    },
    select: {
      submittedAt: true
    },
    orderBy: {
      submittedAt: 'desc'
    }
  });

  const data = {
    currentHour: hour,
    currentDayOfWeek: dayOfWeek,
    recentCount: recentVerifications.length,
    timePattern: 'normal'
  };

  let risk = 0;
  let description = 'Normal timing pattern';

  // Check for unusual hours (very late night/early morning)
  if (hour >= 0 && hour <= 5) {
    risk += 0.4;
    description = 'Verification submitted during unusual hours (midnight to 5 AM)';
    data.timePattern = 'unusual_hours';
  } else if (hour >= 22) {
    risk += 0.2;
    description = 'Verification submitted during late hours';
    data.timePattern = 'late_hours';
  }

  // Check for rapid-fire pattern (multiple submissions within short time)
  if (recentVerifications.length > 1) {
    const lastSubmission = recentVerifications[0].submittedAt;
    const timeDiff = (currentTime.getTime() - lastSubmission.getTime()) / (1000 * 60); // minutes
    
    if (timeDiff < 5) {
      risk += 0.6;
      description = `Multiple verifications within ${Math.round(timeDiff)} minutes`;
      data.timePattern = 'rapid_fire';
    } else if (timeDiff < 30) {
      risk += 0.3;
      description = `Recent verification ${Math.round(timeDiff)} minutes ago`;
      data.timePattern = 'frequent';
    }
  }

  return {
    risk: Math.min(risk, 1),
    description,
    confidence: recentVerifications.length > 2 ? 0.7 : 0.4,
    data
  };
}

/**
 * Analyze purchase amount patterns
 */
async function analyzeAmountPatterns(phone: string, amount: number): Promise<{
  risk: number;
  description: string;
  confidence: number;
  data: Record<string, any>;
}> {
  // Get recent amounts for this phone
  const recentVerifications = await db.simpleVerification.findMany({
    where: {
      customerPhone: phone,
      submittedAt: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
      }
    },
    select: {
      purchaseAmount: true,
      submittedAt: true
    },
    orderBy: {
      submittedAt: 'desc'
    },
    take: 10 // Last 10 verifications
  });

  const amounts = recentVerifications.map(v => v.purchaseAmount);
  const data = {
    currentAmount: amount,
    recentAmounts: amounts,
    isRoundAmount: amount % 100 === 0,
    isVeryRoundAmount: amount % 1000 === 0,
    recentCount: amounts.length
  };

  let risk = 0;
  let description = 'Normal amount pattern';

  // Check for suspiciously round amounts
  if (amount % 1000 === 0 && amount >= 1000) {
    risk += 0.3;
    description = 'Very round amount (multiple of 1000 SEK)';
  } else if (amount % 100 === 0 && amount >= 500) {
    risk += 0.1;
    description = 'Round amount pattern detected';
  }

  // Check for repeated identical amounts
  if (amounts.length > 0) {
    const identicalCount = amounts.filter(a => a === amount).length;
    if (identicalCount > 2) {
      risk += 0.4;
      description = `Identical amount used ${identicalCount + 1} times recently`;
    } else if (identicalCount > 0) {
      risk += 0.1;
      description = 'Amount previously used';
    }
  }

  // Check for unrealistic amounts
  if (amount > 10000) {
    risk += 0.2;
    description += '. Unusually high amount for typical retail purchase';
  }

  return {
    risk: Math.min(risk, 1),
    description,
    confidence: amounts.length > 3 ? 0.7 : 0.4,
    data
  };
}

/**
 * Analyze rapid submission patterns
 */
async function analyzeRapidSubmissions(phone: string, ipAddress: string): Promise<{
  risk: number;
  description: string;
  confidence: number;
  data: Record<string, any>;
}> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Check recent submissions from same phone
  const phoneSubmissions = await db.simpleVerification.count({
    where: {
      customerPhone: phone,
      submittedAt: {
        gte: fiveMinutesAgo
      }
    }
  });

  // Check recent submissions from same IP
  const ipSubmissions = await db.simpleVerification.count({
    where: {
      ipAddress,
      submittedAt: {
        gte: oneHourAgo
      }
    }
  });

  const data = {
    phoneSubmissionsLast5Min: phoneSubmissions,
    ipSubmissionsLastHour: ipSubmissions
  };

  let risk = 0;
  let description = 'Normal submission frequency';

  if (phoneSubmissions > 0) {
    risk += 0.8;
    description = `${phoneSubmissions + 1} submissions from same phone in 5 minutes`;
  }

  if (ipSubmissions > 20) {
    risk += 0.6;
    description += `. ${ipSubmissions} submissions from same IP in 1 hour`;
  } else if (ipSubmissions > 10) {
    risk += 0.3;
    description += `. High IP activity: ${ipSubmissions} submissions in 1 hour`;
  }

  return {
    risk: Math.min(risk, 1),
    description,
    confidence: 0.9, // High confidence in timing data
    data
  };
}

/**
 * Check for duplicate verifications
 */
async function analyzeDuplicateVerifications(input: FraudAnalysisInput): Promise<{
  risk: number;
  description: string;
  confidence: number;
  data: Record<string, any>;
}> {
  // Check for exact matches in recent time
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const duplicates = await db.simpleVerification.findMany({
    where: {
      customerPhone: input.customerPhone,
      purchaseAmount: input.purchaseAmount,
      businessId: input.businessId,
      submittedAt: {
        gte: oneHourAgo
      }
    }
  });

  const data = {
    exactDuplicates: duplicates.length,
    duplicateIds: duplicates.map(d => d.id)
  };

  let risk = 0;
  let description = 'No duplicates detected';

  if (duplicates.length > 0) {
    risk = 0.9;
    description = `Exact duplicate verification detected (${duplicates.length} matches)`;
  }

  return {
    risk,
    description,
    confidence: 0.95, // Very high confidence in duplicate detection
    data
  };
}

/**
 * Get fraud statistics for business dashboard
 */
export async function getFraudStatistics(businessId: string, days: number = 30): Promise<{
  totalVerifications: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  avgFraudScore: number;
  topFraudTypes: Array<{ type: string; count: number }>;
  phoneAbuseCount: number;
}> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const verifications = await db.simpleVerification.findMany({
    where: {
      businessId,
      submittedAt: {
        gte: startDate
      }
    },
    select: {
      fraudScore: true,
      fraudFlags: true
    }
  });

  const totalVerifications = verifications.length;
  let highRiskCount = 0;
  let mediumRiskCount = 0;
  let lowRiskCount = 0;
  let totalFraudScore = 0;
  const fraudTypes: Record<string, number> = {};
  let phoneAbuseCount = 0;

  verifications.forEach(v => {
    totalFraudScore += v.fraudScore;
    
    if (v.fraudScore >= 0.7) highRiskCount++;
    else if (v.fraudScore >= 0.3) mediumRiskCount++;
    else lowRiskCount++;

    // Count fraud flag types
    (v.fraudFlags as SimpleVerificationFraudFlag[])?.forEach(flag => {
      fraudTypes[flag.type] = (fraudTypes[flag.type] || 0) + 1;
      if (flag.type === 'phone_abuse') phoneAbuseCount++;
    });
  });

  const avgFraudScore = totalVerifications > 0 ? totalFraudScore / totalVerifications : 0;
  const topFraudTypes = Object.entries(fraudTypes)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalVerifications,
    highRiskCount,
    mediumRiskCount,
    lowRiskCount,
    avgFraudScore: Math.round(avgFraudScore * 100) / 100,
    topFraudTypes,
    phoneAbuseCount
  };
}