/**
 * Feedback Collection System - Demo and Pilot Preparation
 * Comprehensive feedback analytics and collection for Swedish Café Pilot
 */

import { EventEmitter } from 'events';

export interface FeedbackData {
  id: string;
  sessionId: string;
  businessId: string;
  cafeName: string;
  location: string;
  timestamp: Date;
  customerHash: string;
  
  // Voice Data
  transcript: string;
  audioMetadata: {
    duration: number;
    quality: number;
    language: string;
    confidence: number;
  };
  
  // Quality Scoring
  qualityScore: {
    authenticity: number;
    concreteness: number;
    depth: number;
    total: number;
    reasoning: string;
  };
  
  // Categories & Analysis
  categories: string[];
  sentiment: {
    score: number;
    label: 'positive' | 'neutral' | 'negative';
    confidence: number;
  };
  
  // Business Context
  businessContext: {
    type: string;
    purchase: {
      amount: number;
      items: string[];
      time: Date;
    };
    staff: string[];
    promotions: string[];
  };
  
  // Reward Information
  reward: {
    amount: number;
    currency: string;
    tier: string;
    processed: boolean;
    processingTime?: number;
  };
  
  // Demo/Pilot Metadata
  demo?: {
    isDemoData: boolean;
    scenario: string;
    generatedBy: string;
  };
  
  pilot?: {
    isPilotData: boolean;
    program: string;
    phase: string;
  };
}

export interface FeedbackAnalytics {
  totalFeedbacks: number;
  averageQuality: number;
  categoryDistribution: Record<string, number>;
  sentimentDistribution: Record<string, number>;
  rewardDistribution: {
    total: number;
    average: number;
    byTier: Record<string, number>;
  };
  timeSeriesData: {
    hourly: Array<{ hour: string; count: number; avgQuality: number }>;
    daily: Array<{ date: string; count: number; avgQuality: number }>;
    weekly: Array<{ week: string; count: number; avgQuality: number }>;
  };
  cafePerformance: Array<{
    cafeName: string;
    location: string;
    totalFeedbacks: number;
    averageQuality: number;
    totalRewards: number;
  }>;
}

export class FeedbackCollectionSystem extends EventEmitter {
  private feedbackData: Map<string, FeedbackData> = new Map();
  private analytics: FeedbackAnalytics | null = null;
  private isCollecting: boolean = false;
  
  constructor(
    private config: {
      maxStorageSize?: number;
      analyticsUpdateInterval?: number;
      enableRealTimeAnalytics?: boolean;
      demoMode?: boolean;
      pilotMode?: boolean;
    } = {}
  ) {
    super();
    
    this.config = {
      maxStorageSize: 10000,
      analyticsUpdateInterval: 60000, // 1 minute
      enableRealTimeAnalytics: true,
      demoMode: false,
      pilotMode: false,
      ...config
    };
    
    console.log('🇸🇪 Feedback Collection System initialized for Swedish Café Program');
    this.startAnalyticsEngine();
  }

  /**
   * Start collecting feedback data
   */
  async startCollection(): Promise<void> {
    if (this.isCollecting) {
      console.warn('⚠️ Feedback collection already running');
      return;
    }
    
    this.isCollecting = true;
    console.log('🚀 Starting feedback collection system...');
    
    // Initialize demo data if in demo mode
    if (this.config.demoMode) {
      await this.generateDemoFeedback();
    }
    
    this.emit('collection:started');
    console.log('✅ Feedback collection system started');
  }

  /**
   * Stop collecting feedback data
   */
  async stopCollection(): Promise<void> {
    this.isCollecting = false;
    this.emit('collection:stopped');
    console.log('🛑 Feedback collection system stopped');
  }

  /**
   * Collect a single feedback entry
   */
  async collectFeedback(feedback: Omit<FeedbackData, 'id' | 'timestamp'>): Promise<string> {
    if (!this.isCollecting) {
      throw new Error('Feedback collection system not running');
    }

    const feedbackData: FeedbackData = {
      ...feedback,
      id: this.generateId(),
      timestamp: new Date(),
    };

    // Store feedback
    this.feedbackData.set(feedbackData.id, feedbackData);

    // Cleanup old data if needed
    if (this.feedbackData.size > this.config.maxStorageSize!) {
      this.cleanupOldData();
    }

    // Emit events for real-time processing
    this.emit('feedback:collected', feedbackData);
    
    if (this.config.enableRealTimeAnalytics) {
      this.updateAnalytics();
    }

    console.log(`📝 Feedback collected: ${feedbackData.cafeName} - Quality: ${feedbackData.qualityScore.total}`);
    return feedbackData.id;
  }

  /**
   * Get feedback analytics
   */
  getAnalytics(): FeedbackAnalytics {
    if (!this.analytics) {
      this.updateAnalytics();
    }
    return this.analytics!;
  }

  /**
   * Get feedback data with filtering options
   */
  getFeedback(options: {
    cafeId?: string;
    startDate?: Date;
    endDate?: Date;
    minQuality?: number;
    categories?: string[];
    limit?: number;
    offset?: number;
  } = {}): FeedbackData[] {
    let feedbacks = Array.from(this.feedbackData.values());

    // Apply filters
    if (options.cafeId) {
      feedbacks = feedbacks.filter(f => f.businessId === options.cafeId);
    }

    if (options.startDate) {
      feedbacks = feedbacks.filter(f => f.timestamp >= options.startDate!);
    }

    if (options.endDate) {
      feedbacks = feedbacks.filter(f => f.timestamp <= options.endDate!);
    }

    if (options.minQuality) {
      feedbacks = feedbacks.filter(f => f.qualityScore.total >= options.minQuality!);
    }

    if (options.categories && options.categories.length > 0) {
      feedbacks = feedbacks.filter(f => 
        f.categories.some(cat => options.categories!.includes(cat))
      );
    }

    // Sort by timestamp (newest first)
    feedbacks.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const start = options.offset || 0;
    const end = options.limit ? start + options.limit : undefined;
    
    return feedbacks.slice(start, end);
  }

  /**
   * Export feedback data in various formats
   */
  async exportFeedback(format: 'json' | 'csv' | 'xlsx', options: {
    cafeId?: string;
    startDate?: Date;
    endDate?: Date;
    includePersonalData?: boolean;
  } = {}): Promise<string | Buffer> {
    const feedbacks = this.getFeedback(options);
    
    switch (format) {
      case 'json':
        return this.exportToJSON(feedbacks, options.includePersonalData);
      case 'csv':
        return this.exportToCSV(feedbacks, options.includePersonalData);
      case 'xlsx':
        return this.exportToXLSX(feedbacks, options.includePersonalData);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Get real-time feedback statistics
   */
  getRealTimeStats(): {
    activeSessions: number;
    feedbacksToday: number;
    averageQualityToday: number;
    totalRewardsToday: number;
    topCategories: Array<{ category: string; count: number }>;
  } {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todaysFeedback = this.getFeedback({ startDate: today });
    
    const categoryCount: Record<string, number> = {};
    let totalQuality = 0;
    let totalRewards = 0;

    todaysFeedback.forEach(feedback => {
      totalQuality += feedback.qualityScore.total;
      totalRewards += feedback.reward.amount;
      
      feedback.categories.forEach(category => {
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });
    });

    const topCategories = Object.entries(categoryCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    return {
      activeSessions: 0, // Would be connected to WebSocket sessions
      feedbacksToday: todaysFeedback.length,
      averageQualityToday: todaysFeedback.length > 0 ? totalQuality / todaysFeedback.length : 0,
      totalRewardsToday: totalRewards,
      topCategories
    };
  }

  /**
   * Generate demo feedback data for testing
   */
  private async generateDemoFeedback(): Promise<void> {
    console.log('🎭 Generating demo feedback data...');
    
    const demoCafes = [
      { id: 'aurora-stockholm', name: 'Café Aurora', location: 'Stockholm' },
      { id: 'malmohuset-malmo', name: 'Malmö Huset', location: 'Malmö' },
      { id: 'goteborg-center', name: 'Göteborg Center', location: 'Göteborg' },
    ];

    const demoFeedbacks = [
      // High quality feedback examples
      {
        transcript: 'Kaffet var verkligen fantastiskt idag. Baristerna Anna och Erik var mycket professionella och hjälpsamma. Lokalen var ren och välkomnande, men stolarna kunde vara lite bekvämare.',
        categories: ['service', 'quality', 'environment'],
        qualityScore: { authenticity: 88, concreteness: 82, depth: 85, total: 85, reasoning: 'Specific staff names, detailed observations' },
        sentiment: { score: 0.8, label: 'positive' as const, confidence: 0.9 }
      },
      {
        transcript: 'Mycket bra latte och trevlig personal. Hade en liten väntetid men det var värt det. Priset är okej för kvaliteten.',
        categories: ['quality', 'service', 'value'],
        qualityScore: { authenticity: 75, concreteness: 78, depth: 72, total: 75, reasoning: 'Genuine feedback with specific details' },
        sentiment: { score: 0.6, label: 'positive' as const, confidence: 0.8 }
      },
      // Medium quality feedback
      {
        transcript: 'Bra café. Kaffet var okej och personalen trevlig. Kommer nog tillbaka.',
        categories: ['general', 'service'],
        qualityScore: { authenticity: 65, concreteness: 45, depth: 40, total: 50, reasoning: 'Generic but authentic' },
        sentiment: { score: 0.3, label: 'neutral' as const, confidence: 0.7 }
      },
      // Critical but constructive feedback
      {
        transcript: 'Kaffet var kallt när jag fick det och det tog 15 minuter att få beställningen. Personalen verkade stressad. Kanske behöver ni fler anställda under lunchtid?',
        categories: ['quality', 'service', 'operations'],
        qualityScore: { authenticity: 90, concreteness: 85, depth: 80, total: 85, reasoning: 'Constructive criticism with specific observations' },
        sentiment: { score: -0.4, label: 'negative' as const, confidence: 0.8 }
      }
    ];

    // Generate feedback for each café
    for (const cafe of demoCafes) {
      for (let i = 0; i < 15; i++) {
        const demoFeedback = demoFeedbacks[i % demoFeedbacks.length];
        const timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000); // Last 7 days

        await this.collectFeedback({
          sessionId: `demo-session-${cafe.id}-${i}`,
          businessId: cafe.id,
          cafeName: cafe.name,
          location: cafe.location,
          customerHash: `demo-customer-${Math.random().toString(36).substr(2, 9)}`,
          
          transcript: demoFeedback.transcript,
          audioMetadata: {
            duration: Math.random() * 60 + 30,
            quality: 0.8 + Math.random() * 0.2,
            language: 'sv-SE',
            confidence: 0.9
          },
          
          qualityScore: demoFeedback.qualityScore,
          categories: demoFeedback.categories,
          sentiment: demoFeedback.sentiment,
          
          businessContext: {
            type: 'café',
            purchase: {
              amount: Math.floor(Math.random() * 150) + 25,
              items: ['Kaffe', 'Latte', 'Smörgås'][Math.floor(Math.random() * 3)],
              time: timestamp
            },
            staff: ['Anna', 'Erik', 'Maria'],
            promotions: ['Vinterlatte', 'Fika-erbjudande']
          },
          
          reward: {
            amount: Math.round((Math.random() * 50 + 10) * 100) / 100,
            currency: 'SEK',
            tier: 'Tier 1',
            processed: true,
            processingTime: Math.random() * 2000 + 500
          },
          
          demo: {
            isDemoData: true,
            scenario: 'swedish-cafe-simulation',
            generatedBy: 'FeedbackCollectionSystem'
          }
        });
      }
    }

    console.log(`✅ Generated ${demoCafes.length * 15} demo feedback entries`);
  }

  /**
   * Start analytics engine
   */
  private startAnalyticsEngine(): void {
    if (this.config.enableRealTimeAnalytics) {
      setInterval(() => {
        this.updateAnalytics();
      }, this.config.analyticsUpdateInterval);
    }
  }

  /**
   * Update analytics calculations
   */
  private updateAnalytics(): void {
    const feedbacks = Array.from(this.feedbackData.values());
    
    if (feedbacks.length === 0) {
      this.analytics = this.getEmptyAnalytics();
      return;
    }

    // Calculate basic metrics
    const totalFeedbacks = feedbacks.length;
    const averageQuality = feedbacks.reduce((sum, f) => sum + f.qualityScore.total, 0) / totalFeedbacks;

    // Category distribution
    const categoryDistribution: Record<string, number> = {};
    feedbacks.forEach(feedback => {
      feedback.categories.forEach(category => {
        categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;
      });
    });

    // Sentiment distribution
    const sentimentDistribution: Record<string, number> = {
      positive: 0,
      neutral: 0,
      negative: 0
    };
    feedbacks.forEach(feedback => {
      sentimentDistribution[feedback.sentiment.label]++;
    });

    // Reward distribution
    const totalRewards = feedbacks.reduce((sum, f) => sum + f.reward.amount, 0);
    const rewardsByTier: Record<string, number> = {};
    feedbacks.forEach(feedback => {
      rewardsByTier[feedback.reward.tier] = (rewardsByTier[feedback.reward.tier] || 0) + feedback.reward.amount;
    });

    // Time series data (simplified)
    const now = new Date();
    const hourlyData: Array<{ hour: string; count: number; avgQuality: number }> = [];
    
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const hourFeedbacks = feedbacks.filter(f => 
        f.timestamp.getHours() === hour.getHours() && 
        f.timestamp.getDate() === hour.getDate()
      );
      
      hourlyData.push({
        hour: hour.toISOString(),
        count: hourFeedbacks.length,
        avgQuality: hourFeedbacks.length > 0 
          ? hourFeedbacks.reduce((sum, f) => sum + f.qualityScore.total, 0) / hourFeedbacks.length 
          : 0
      });
    }

    // Café performance
    const cafePerformance: Record<string, {
      cafeName: string;
      location: string;
      totalFeedbacks: number;
      qualitySum: number;
      rewardSum: number;
    }> = {};

    feedbacks.forEach(feedback => {
      if (!cafePerformance[feedback.businessId]) {
        cafePerformance[feedback.businessId] = {
          cafeName: feedback.cafeName,
          location: feedback.location,
          totalFeedbacks: 0,
          qualitySum: 0,
          rewardSum: 0
        };
      }
      
      cafePerformance[feedback.businessId].totalFeedbacks++;
      cafePerformance[feedback.businessId].qualitySum += feedback.qualityScore.total;
      cafePerformance[feedback.businessId].rewardSum += feedback.reward.amount;
    });

    this.analytics = {
      totalFeedbacks,
      averageQuality,
      categoryDistribution,
      sentimentDistribution,
      rewardDistribution: {
        total: totalRewards,
        average: totalRewards / totalFeedbacks,
        byTier: rewardsByTier
      },
      timeSeriesData: {
        hourly: hourlyData,
        daily: [], // Simplified for now
        weekly: []
      },
      cafePerformance: Object.values(cafePerformance).map(cafe => ({
        cafeName: cafe.cafeName,
        location: cafe.location,
        totalFeedbacks: cafe.totalFeedbacks,
        averageQuality: cafe.qualitySum / cafe.totalFeedbacks,
        totalRewards: cafe.rewardSum
      }))
    };

    this.emit('analytics:updated', this.analytics);
  }

  /**
   * Export helpers
   */
  private exportToJSON(feedbacks: FeedbackData[], includePersonal: boolean = false): string {
    const exportData = feedbacks.map(feedback => {
      const data: any = { ...feedback };
      
      if (!includePersonal) {
        delete data.customerHash;
        delete data.audioMetadata;
        data.transcript = this.sanitizeTranscript(data.transcript);
      }
      
      return data;
    });

    return JSON.stringify({
      exportDate: new Date().toISOString(),
      totalRecords: exportData.length,
      includesPersonalData: includePersonal,
      data: exportData
    }, null, 2);
  }

  private exportToCSV(feedbacks: FeedbackData[], includePersonal: boolean = false): string {
    if (feedbacks.length === 0) return '';

    const headers = [
      'ID', 'Timestamp', 'Café Name', 'Location', 'Quality Score', 
      'Categories', 'Sentiment', 'Reward Amount', 'Transcript'
    ];

    if (includePersonal) {
      headers.push('Customer Hash', 'Audio Duration');
    }

    const csvRows = [headers.join(',')];
    
    feedbacks.forEach(feedback => {
      const row = [
        feedback.id,
        feedback.timestamp.toISOString(),
        `"${feedback.cafeName}"`,
        `"${feedback.location}"`,
        feedback.qualityScore.total,
        `"${feedback.categories.join(', ')}"`,
        feedback.sentiment.label,
        feedback.reward.amount,
        `"${includePersonal ? feedback.transcript : this.sanitizeTranscript(feedback.transcript)}"`
      ];

      if (includePersonal) {
        row.push(feedback.customerHash, feedback.audioMetadata.duration.toString());
      }

      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  private exportToXLSX(feedbacks: FeedbackData[], includePersonal: boolean = false): Buffer {
    // This would require a library like xlsx
    // For now, return CSV data as buffer
    const csvData = this.exportToCSV(feedbacks, includePersonal);
    return Buffer.from(csvData, 'utf-8');
  }

  private sanitizeTranscript(transcript: string): string {
    // Remove potential personal identifiers
    return transcript
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]') // Remove dates
      .replace(/\b\d{10,}\b/g, '[NUMBER]') // Remove long numbers
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]'); // Remove emails
  }

  private getEmptyAnalytics(): FeedbackAnalytics {
    return {
      totalFeedbacks: 0,
      averageQuality: 0,
      categoryDistribution: {},
      sentimentDistribution: { positive: 0, neutral: 0, negative: 0 },
      rewardDistribution: { total: 0, average: 0, byTier: {} },
      timeSeriesData: { hourly: [], daily: [], weekly: [] },
      cafePerformance: []
    };
  }

  private cleanupOldData(): void {
    const feedbacks = Array.from(this.feedbackData.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());
    
    const keepCount = Math.floor(this.config.maxStorageSize! * 0.8);
    const toRemove = feedbacks.slice(keepCount);
    
    toRemove.forEach(([id]) => {
      this.feedbackData.delete(id);
    });
    
    console.log(`🧹 Cleaned up ${toRemove.length} old feedback entries`);
  }

  private generateId(): string {
    return `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default FeedbackCollectionSystem;