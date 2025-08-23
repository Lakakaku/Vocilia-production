/**
 * Advanced Temporal Pattern Analysis for AI Feedback Platform
 * Implements sophisticated time-based pattern detection, seasonal analysis,
 * burst activity detection, and temporal fraud analysis
 */

import {
  TemporalPattern,
  TemporalPatternType,
  TemporalFrequency,
  SeasonalPattern,
  HourlyTrend,
  DailyTrend,
  SeasonalTrend,
  PatternDetectionResult,
  AnalyticsConfig
} from '@feedback-platform/shared-types';
import { mean, standardDeviation, variance, median, mode } from 'simple-statistics';
import { differenceInMinutes, differenceInHours, differenceInDays, 
         format, startOfHour, startOfDay, startOfWeek, startOfMonth,
         getHours, getDay, getDate, getMonth, parseISO } from 'date-fns';
import * as math from 'mathjs';

interface SessionTemporalData {
  sessionId: string;
  customerHash: string;
  businessId: string;
  locationId: string;
  timestamp: Date;
  qualityScore?: number;
  rewardAmount?: number;
  duration?: number; // session duration in seconds
}

interface TemporalWindow {
  start: Date;
  end: Date;
  sessions: SessionTemporalData[];
  sessionCount: number;
  averageInterval: number;
  intervalVariance: number;
}

export class TemporalAnalyzer {
  private config: AnalyticsConfig['temporal'];
  private sessionHistory: Map<string, SessionTemporalData[]> = new Map();
  private seasonalPatterns: Map<string, SeasonalPattern> = new Map();
  private patternCache: Map<string, TemporalPattern[]> = new Map();
  private businessPatterns: Map<string, SeasonalPattern> = new Map();

  constructor(config: Partial<AnalyticsConfig['temporal']> = {}) {
    this.config = {
      burstDetectionWindowMinutes: 10,
      regularIntervalToleranceMs: 30000, // 30 seconds tolerance
      seasonalAnalysisMinimumDays: 30,
      anomalyDetectionSensitivity: 0.7,
      ...config
    };
  }

  /**
   * Analyze a session for temporal patterns and anomalies
   */
  async analyzeSession(sessionData: SessionTemporalData): Promise<PatternDetectionResult> {
    // Store session data
    this.addSessionData(sessionData);

    // Get customer history for pattern analysis
    const customerHistory = this.getCustomerHistory(sessionData.customerHash);
    
    // Detect regular interval patterns (potential bot behavior)
    const regularIntervals = await this.detectRegularIntervals(customerHistory);
    
    // Detect burst activity patterns
    const burstPatterns = await this.detectBurstActivity(customerHistory);
    
    // Detect unusual hours activity
    const unusualHours = await this.detectUnusualHoursActivity(sessionData, customerHistory);
    
    // Detect seasonal anomalies
    const seasonalAnomalies = await this.detectSeasonalAnomalies(sessionData);
    
    // Detect frequency spikes
    const frequencySpikes = await this.detectFrequencySpikes(customerHistory);

    // Combine all patterns
    const allPatterns: TemporalPattern[] = [
      ...regularIntervals,
      ...burstPatterns,
      ...unusualHours,
      ...seasonalAnomalies,
      ...frequencySpikes
    ];

    // Calculate overall anomaly score
    const anomalyScore = this.calculateTemporalAnomalyScore(allPatterns, sessionData);
    
    return {
      sessionId: sessionData.sessionId,
      customerHash: sessionData.customerHash,
      geographicPatterns: [], // Will be populated by GeographicAnalyzer
      temporalPatterns: allPatterns,
      anomalyScore,
      riskLevel: this.determineRiskLevel(anomalyScore),
      confidence: this.calculateConfidence(allPatterns),
      reasoning: this.generateReasoning(allPatterns),
      detectedAt: new Date()
    };
  }

  /**
   * Detect regular interval patterns that might indicate automated behavior
   */
  private async detectRegularIntervals(
    customerHistory: SessionTemporalData[]
  ): Promise<TemporalPattern[]> {
    if (customerHistory.length < 3) return [];

    const intervals = this.calculateIntervals(customerHistory);
    if (intervals.length < 2) return [];

    // Statistical analysis of intervals
    const meanInterval = mean(intervals);
    const stdInterval = standardDeviation(intervals);
    const coefficientOfVariation = stdInterval / meanInterval;
    
    // Low coefficient of variation indicates regular intervals
    if (coefficientOfVariation < 0.1 && intervals.length >= 3) {
      const confidence = Math.min(0.95, 1 - coefficientOfVariation * 5);
      
      return [{
        id: `regular_intervals_${Date.now()}`,
        type: 'regular_intervals',
        timeRange: {
          start: customerHistory[0].timestamp,
          end: customerHistory[customerHistory.length - 1].timestamp
        },
        frequency: this.determineFrequency(meanInterval),
        sessionCount: customerHistory.length,
        averageInterval: meanInterval,
        intervalVariance: variance(intervals),
        confidence,
        metadata: {
          coefficientOfVariation,
          intervals: intervals.slice(0, 10), // Store first 10 intervals for debugging
          toleranceMs: this.config.regularIntervalToleranceMs
        }
      }];
    }

    return [];
  }

  /**
   * Detect burst activity patterns
   */
  private async detectBurstActivity(
    customerHistory: SessionTemporalData[]
  ): Promise<TemporalPattern[]> {
    if (customerHistory.length < 5) return [];

    const burstPatterns: TemporalPattern[] = [];
    const windowMs = this.config.burstDetectionWindowMinutes * 60 * 1000;
    
    // Sliding window to detect bursts
    for (let i = 0; i < customerHistory.length - 2; i++) {
      const windowStart = customerHistory[i].timestamp;
      const windowEnd = new Date(windowStart.getTime() + windowMs);
      
      const sessionsInWindow = customerHistory.filter(session => 
        session.timestamp >= windowStart && session.timestamp <= windowEnd
      );

      if (sessionsInWindow.length >= 4) { // Burst threshold
        const averageInterval = this.calculateAverageInterval(sessionsInWindow);
        const intervalVariance = this.calculateIntervalVariance(sessionsInWindow);
        
        burstPatterns.push({
          id: `burst_${windowStart.getTime()}`,
          type: 'burst_activity',
          timeRange: {
            start: windowStart,
            end: windowEnd
          },
          frequency: 'minutely',
          sessionCount: sessionsInWindow.length,
          averageInterval,
          intervalVariance,
          confidence: Math.min(0.9, sessionsInWindow.length / 10), // Higher burst = higher confidence
          metadata: {
            windowMinutes: this.config.burstDetectionWindowMinutes,
            burstIntensity: sessionsInWindow.length,
            sessionsInBurst: sessionsInWindow.map(s => s.sessionId)
          }
        });
      }
    }

    return burstPatterns;
  }

  /**
   * Detect activity during unusual hours
   */
  private async detectUnusualHoursActivity(
    currentSession: SessionTemporalData,
    customerHistory: SessionTemporalData[]
  ): Promise<TemporalPattern[]> {
    const currentHour = getHours(currentSession.timestamp);
    
    // Define unusual hours (late night/early morning for business context)
    const unusualHours = [0, 1, 2, 3, 4, 5, 22, 23];
    
    if (!unusualHours.includes(currentHour)) return [];

    // Check if this is a pattern or isolated incident
    const unusualHourSessions = customerHistory.filter(session =>
      unusualHours.includes(getHours(session.timestamp))
    );

    if (unusualHourSessions.length >= 2) {
      return [{
        id: `unusual_hours_${currentSession.sessionId}`,
        type: 'unusual_hours',
        timeRange: {
          start: new Date(Math.min(...unusualHourSessions.map(s => s.timestamp.getTime()))),
          end: new Date(Math.max(...unusualHourSessions.map(s => s.timestamp.getTime())))
        },
        frequency: this.determineFrequencyFromSessions(unusualHourSessions),
        sessionCount: unusualHourSessions.length,
        averageInterval: this.calculateAverageInterval(unusualHourSessions),
        intervalVariance: this.calculateIntervalVariance(unusualHourSessions),
        confidence: Math.min(0.8, unusualHourSessions.length / 5),
        metadata: {
          unusualHours: unusualHourSessions.map(s => getHours(s.timestamp)),
          currentHour,
          businessHours: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
        }
      }];
    }

    return [];
  }

  /**
   * Detect seasonal anomalies based on historical patterns
   */
  private async detectSeasonalAnomalies(
    sessionData: SessionTemporalData
  ): Promise<TemporalPattern[]> {
    const businessSeasonalPattern = this.businessPatterns.get(sessionData.businessId);
    if (!businessSeasonalPattern) return [];

    const currentHour = getHours(sessionData.timestamp);
    const currentDay = getDay(sessionData.timestamp);
    const currentMonth = getMonth(sessionData.timestamp) + 1; // getMonth is 0-indexed

    // Check if current session aligns with expected seasonal patterns
    const isExpectedHour = businessSeasonalPattern.pattern.hour.includes(currentHour);
    const isExpectedDay = businessSeasonalPattern.pattern.dayOfWeek.includes(currentDay);
    const isExpectedMonth = businessSeasonalPattern.pattern.month.includes(currentMonth);

    // Calculate anomaly score
    let anomalyScore = 0;
    const reasons: string[] = [];

    if (!isExpectedHour) {
      anomalyScore += 0.3;
      reasons.push(`Unusual hour: ${currentHour}`);
    }
    if (!isExpectedDay) {
      anomalyScore += 0.2;
      reasons.push(`Unusual day: ${format(sessionData.timestamp, 'EEEE')}`);
    }
    if (!isExpectedMonth) {
      anomalyScore += 0.2;
      reasons.push(`Unusual month: ${format(sessionData.timestamp, 'MMMM')}`);
    }

    if (anomalyScore > 0.3) {
      return [{
        id: `seasonal_anomaly_${sessionData.sessionId}`,
        type: 'seasonal_anomaly',
        timeRange: {
          start: sessionData.timestamp,
          end: sessionData.timestamp
        },
        frequency: 'irregular',
        sessionCount: 1,
        averageInterval: 0,
        intervalVariance: 0,
        confidence: Math.min(0.9, anomalyScore),
        metadata: {
          expectedPattern: businessSeasonalPattern.pattern,
          currentTime: {
            hour: currentHour,
            dayOfWeek: currentDay,
            month: currentMonth
          },
          reasons,
          businessId: sessionData.businessId
        }
      }];
    }

    return [];
  }

  /**
   * Detect frequency spikes in submissions
   */
  private async detectFrequencySpikes(
    customerHistory: SessionTemporalData[]
  ): Promise<TemporalPattern[]> {
    if (customerHistory.length < 10) return [];

    // Analyze submission frequency over time windows
    const hourlyBuckets = this.groupSessionsByHour(customerHistory);
    const bucketCounts = Array.from(hourlyBuckets.values()).map(sessions => sessions.length);
    
    if (bucketCounts.length < 3) return [];

    const meanCount = mean(bucketCounts);
    const stdCount = standardDeviation(bucketCounts);

    const spikes: TemporalPattern[] = [];

    for (const [hourKey, sessions] of hourlyBuckets) {
      const count = sessions.length;
      const zScore = Math.abs((count - meanCount) / stdCount);

      if (zScore > 2.5 && count > meanCount * 1.5) { // Significant spike
        const hourStart = parseISO(hourKey);
        const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

        spikes.push({
          id: `frequency_spike_${hourKey}`,
          type: 'frequency_spike',
          timeRange: {
            start: hourStart,
            end: hourEnd
          },
          frequency: 'hourly',
          sessionCount: count,
          averageInterval: this.calculateAverageInterval(sessions),
          intervalVariance: this.calculateIntervalVariance(sessions),
          confidence: Math.min(0.95, zScore / 4),
          metadata: {
            zScore,
            meanCount,
            standardDeviation: stdCount,
            spikeIntensity: count / meanCount,
            hourKey
          }
        });
      }
    }

    return spikes;
  }

  /**
   * Generate business trends analysis
   */
  async generateBusinessTrends(
    businessId: string,
    timeRange: { start: Date; end: Date }
  ): Promise<{
    hourlyTrends: HourlyTrend[];
    dailyTrends: DailyTrend[];
    seasonalTrends: SeasonalTrend[];
  }> {
    const sessions = this.getBusinessSessions(businessId, timeRange);
    
    return {
      hourlyTrends: this.calculateHourlyTrends(sessions),
      dailyTrends: this.calculateDailyTrends(sessions),
      seasonalTrends: this.calculateSeasonalTrends(sessions)
    };
  }

  /**
   * Update seasonal patterns for a business
   */
  async updateSeasonalPattern(businessId: string): Promise<void> {
    const businessSessions = this.getBusinessSessions(businessId);
    if (businessSessions.length < 50) return; // Need minimum data

    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const monthCounts = new Array(12).fill(0);
    
    businessSessions.forEach(session => {
      hourCounts[getHours(session.timestamp)]++;
      dayCounts[getDay(session.timestamp)]++;
      monthCounts[getMonth(session.timestamp)]++;
    });

    // Determine typical hours (above average activity)
    const avgHourlyCount = mean(hourCounts);
    const typicalHours = hourCounts
      .map((count, hour) => ({ hour, count }))
      .filter(h => h.count >= avgHourlyCount)
      .map(h => h.hour);

    // Determine typical days
    const avgDailyCount = mean(dayCounts);
    const typicalDays = dayCounts
      .map((count, day) => ({ day, count }))
      .filter(d => d.count >= avgDailyCount)
      .map(d => d.day);

    // Determine typical months
    const avgMonthlyCount = mean(monthCounts);
    const typicalMonths = monthCounts
      .map((count, month) => ({ month: month + 1, count }))
      .filter(m => m.count >= avgMonthlyCount)
      .map(m => m.month);

    const pattern: SeasonalPattern = {
      id: `business_pattern_${businessId}`,
      businessId,
      pattern: {
        hour: typicalHours,
        dayOfWeek: typicalDays,
        dayOfMonth: [], // Could be expanded for day-of-month patterns
        month: typicalMonths
      },
      averageVolume: businessSessions.length / Math.max(1, 
        differenceInDays(new Date(), businessSessions[0].timestamp) || 1
      ),
      variance: this.calculateSessionVariance(businessSessions),
      confidence: Math.min(0.95, businessSessions.length / 100),
      lastUpdated: new Date()
    };

    this.businessPatterns.set(businessId, pattern);
  }

  // Utility Methods

  private addSessionData(sessionData: SessionTemporalData): void {
    const customerHistory = this.sessionHistory.get(sessionData.customerHash) || [];
    customerHistory.push(sessionData);
    customerHistory.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Keep only last 200 sessions per customer for memory efficiency
    if (customerHistory.length > 200) {
      customerHistory.splice(0, customerHistory.length - 200);
    }
    
    this.sessionHistory.set(sessionData.customerHash, customerHistory);
  }

  private getCustomerHistory(customerHash: string): SessionTemporalData[] {
    return this.sessionHistory.get(customerHash) || [];
  }

  private getBusinessSessions(
    businessId: string,
    timeRange?: { start: Date; end: Date }
  ): SessionTemporalData[] {
    let allSessions: SessionTemporalData[] = [];
    
    for (const customerSessions of this.sessionHistory.values()) {
      allSessions = allSessions.concat(
        customerSessions.filter(session => session.businessId === businessId)
      );
    }

    if (timeRange) {
      allSessions = allSessions.filter(session =>
        session.timestamp >= timeRange.start && session.timestamp <= timeRange.end
      );
    }

    return allSessions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private calculateIntervals(sessions: SessionTemporalData[]): number[] {
    const intervals: number[] = [];
    for (let i = 1; i < sessions.length; i++) {
      intervals.push(sessions[i].timestamp.getTime() - sessions[i-1].timestamp.getTime());
    }
    return intervals;
  }

  private calculateAverageInterval(sessions: SessionTemporalData[]): number {
    const intervals = this.calculateIntervals(sessions);
    return intervals.length > 0 ? mean(intervals) : 0;
  }

  private calculateIntervalVariance(sessions: SessionTemporalData[]): number {
    const intervals = this.calculateIntervals(sessions);
    return intervals.length > 1 ? variance(intervals) : 0;
  }

  private determineFrequency(intervalMs: number): TemporalFrequency {
    const intervalMinutes = intervalMs / (1000 * 60);
    
    if (intervalMinutes < 5) return 'minutely';
    if (intervalMinutes < 120) return 'hourly';
    if (intervalMinutes < 1440 * 2) return 'daily';
    if (intervalMinutes < 1440 * 14) return 'weekly';
    if (intervalMinutes < 1440 * 45) return 'monthly';
    return 'seasonal';
  }

  private determineFrequencyFromSessions(sessions: SessionTemporalData[]): TemporalFrequency {
    if (sessions.length < 2) return 'irregular';
    
    const avgInterval = this.calculateAverageInterval(sessions);
    return this.determineFrequency(avgInterval);
  }

  private groupSessionsByHour(sessions: SessionTemporalData[]): Map<string, SessionTemporalData[]> {
    const buckets = new Map<string, SessionTemporalData[]>();
    
    sessions.forEach(session => {
      const hourKey = startOfHour(session.timestamp).toISOString();
      if (!buckets.has(hourKey)) {
        buckets.set(hourKey, []);
      }
      buckets.get(hourKey)!.push(session);
    });
    
    return buckets;
  }

  private calculateHourlyTrends(sessions: SessionTemporalData[]): HourlyTrend[] {
    const hourlyData = new Map<number, SessionTemporalData[]>();
    
    sessions.forEach(session => {
      const hour = getHours(session.timestamp);
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, []);
      }
      hourlyData.get(hour)!.push(session);
    });

    const trends: HourlyTrend[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourSessions = hourlyData.get(hour) || [];
      const qualityScores = hourSessions.map(s => s.qualityScore || 0).filter(s => s > 0);
      const rewardAmounts = hourSessions.map(s => s.rewardAmount || 0).filter(r => r > 0);

      trends.push({
        hour,
        sessionCount: hourSessions.length,
        averageQualityScore: qualityScores.length > 0 ? mean(qualityScores) : 0,
        averageRewardAmount: rewardAmounts.length > 0 ? mean(rewardAmounts) : 0
      });
    }

    return trends;
  }

  private calculateDailyTrends(sessions: SessionTemporalData[]): DailyTrend[] {
    const dailyData = new Map<number, SessionTemporalData[]>();
    
    sessions.forEach(session => {
      const day = getDay(session.timestamp);
      if (!dailyData.has(day)) {
        dailyData.set(day, []);
      }
      dailyData.get(day)!.push(session);
    });

    const trends: DailyTrend[] = [];
    for (let day = 0; day < 7; day++) {
      const daySessions = dailyData.get(day) || [];
      const qualityScores = daySessions.map(s => s.qualityScore || 0).filter(s => s > 0);
      const rewardAmounts = daySessions.map(s => s.rewardAmount || 0).filter(r => r > 0);

      trends.push({
        dayOfWeek: day,
        sessionCount: daySessions.length,
        averageQualityScore: qualityScores.length > 0 ? mean(qualityScores) : 0,
        averageRewardAmount: rewardAmounts.length > 0 ? mean(rewardAmounts) : 0
      });
    }

    return trends;
  }

  private calculateSeasonalTrends(sessions: SessionTemporalData[]): SeasonalTrend[] {
    const monthlyData = new Map<number, SessionTemporalData[]>();
    
    sessions.forEach(session => {
      const month = getMonth(session.timestamp) + 1; // Convert to 1-12
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(session);
    });

    const trends: SeasonalTrend[] = [];
    for (let month = 1; month <= 12; month++) {
      const monthSessions = monthlyData.get(month) || [];
      const qualityScores = monthSessions.map(s => s.qualityScore || 0).filter(s => s > 0);
      const rewardAmounts = monthSessions.map(s => s.rewardAmount || 0).filter(r => r > 0);

      trends.push({
        month,
        sessionCount: monthSessions.length,
        averageQualityScore: qualityScores.length > 0 ? mean(qualityScores) : 0,
        averageRewardAmount: rewardAmounts.length > 0 ? mean(rewardAmounts) : 0
        // yearOverYearGrowth would require multiple years of data
      });
    }

    return trends;
  }

  private calculateSessionVariance(sessions: SessionTemporalData[]): number {
    // Calculate variance in session counts across different time periods
    const dailyBuckets = new Map<string, number>();
    
    sessions.forEach(session => {
      const dayKey = format(startOfDay(session.timestamp), 'yyyy-MM-dd');
      dailyBuckets.set(dayKey, (dailyBuckets.get(dayKey) || 0) + 1);
    });
    
    const counts = Array.from(dailyBuckets.values());
    return counts.length > 1 ? variance(counts) : 0;
  }

  private calculateTemporalAnomalyScore(
    patterns: TemporalPattern[],
    sessionData: SessionTemporalData
  ): number {
    if (patterns.length === 0) return 0;

    // Weight different pattern types
    const weights: Record<TemporalPatternType, number> = {
      'regular_intervals': 0.9,
      'burst_activity': 0.8,
      'rapid_fire': 0.8,
      'frequency_spike': 0.7,
      'unusual_hours': 0.5,
      'seasonal_anomaly': 0.6,
      'dormant_period': 0.3
    };

    let totalScore = 0;
    let totalWeight = 0;

    patterns.forEach(pattern => {
      const weight = weights[pattern.type];
      const score = pattern.confidence * weight;
      totalScore += score;
      totalWeight += weight;
    });

    return totalWeight > 0 ? Math.min(1, totalScore / totalWeight) : 0;
  }

  private determineRiskLevel(anomalyScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (anomalyScore >= 0.8) return 'critical';
    if (anomalyScore >= 0.6) return 'high';
    if (anomalyScore >= 0.3) return 'medium';
    return 'low';
  }

  private calculateConfidence(patterns: TemporalPattern[]): number {
    if (patterns.length === 0) return 0.9; // High confidence when no anomalies detected
    
    const avgConfidence = mean(patterns.map(p => p.confidence));
    const patternVariety = Math.min(1, patterns.length / 5);
    
    return avgConfidence * (0.8 + patternVariety * 0.2);
  }

  private generateReasoning(patterns: TemporalPattern[]): string[] {
    const reasoning: string[] = [];

    patterns.forEach(pattern => {
      switch (pattern.type) {
        case 'regular_intervals':
          reasoning.push(`Regular submission intervals detected: ${Math.round(pattern.averageInterval / 1000)}s average`);
          break;
        case 'burst_activity':
          reasoning.push(`Burst activity: ${pattern.sessionCount} sessions in ${pattern.metadata?.windowMinutes}min window`);
          break;
        case 'unusual_hours':
          reasoning.push(`Activity during unusual hours: ${pattern.metadata?.currentHour}:00`);
          break;
        case 'seasonal_anomaly':
          reasoning.push(`Seasonal anomaly: activity outside expected business patterns`);
          break;
        case 'frequency_spike':
          reasoning.push(`Frequency spike: ${pattern.metadata?.spikeIntensity?.toFixed(1)}x normal activity`);
          break;
        case 'rapid_fire':
          reasoning.push(`Rapid-fire submissions detected in short time window`);
          break;
      }
    });

    if (reasoning.length === 0) {
      reasoning.push('No significant temporal anomalies detected');
    }

    return reasoning;
  }

  /**
   * Clean up old data to prevent memory leaks
   */
  cleanupHistory(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - maxAge);
    
    for (const [customerHash, sessions] of this.sessionHistory.entries()) {
      const filteredSessions = sessions.filter(session => session.timestamp >= cutoff);
      
      if (filteredSessions.length === 0) {
        this.sessionHistory.delete(customerHash);
      } else {
        this.sessionHistory.set(customerHash, filteredSessions);
      }
    }

    this.patternCache.clear(); // Clear pattern cache on cleanup
  }

  /**
   * Get statistics about the temporal analyzer
   */
  getStats(): {
    customerCount: number;
    totalSessions: number;
    businessPatterns: number;
    cacheSize: number;
    oldestSession: Date | null;
  } {
    let totalSessions = 0;
    let oldestTimestamp = Infinity;

    for (const sessions of this.sessionHistory.values()) {
      totalSessions += sessions.length;
      for (const session of sessions) {
        oldestTimestamp = Math.min(oldestTimestamp, session.timestamp.getTime());
      }
    }

    return {
      customerCount: this.sessionHistory.size,
      totalSessions,
      businessPatterns: this.businessPatterns.size,
      cacheSize: this.patternCache.size,
      oldestSession: oldestTimestamp === Infinity ? null : new Date(oldestTimestamp)
    };
  }
}