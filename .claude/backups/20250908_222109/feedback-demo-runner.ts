/**
 * Feedback Demo Runner - Interactive Demo System
 * Connects FeedbackCollectionSystem with visualization dashboard for demos
 */

import { FeedbackCollectionSystem, FeedbackData, FeedbackAnalytics } from '../packages/feedback-collection/FeedbackCollectionSystem';
import { EventEmitter } from 'events';

export interface DemoScenario {
  id: string;
  name: string;
  description: string;
  duration: number; // milliseconds
  feedbackRate: number; // feedbacks per minute
  cafeConfigs: Array<{
    id: string;
    name: string;
    location: string;
    customerTypes: string[];
    qualityRange: [number, number];
    categories: string[];
  }>;
}

export interface DemoConfig {
  scenario: DemoScenario;
  realTimeUpdates: boolean;
  autoExport: boolean;
  exportInterval: number;
  visualizationEndpoint?: string;
}

export class FeedbackDemoRunner extends EventEmitter {
  private collectionSystem: FeedbackCollectionSystem;
  private isRunning: boolean = false;
  private demoInterval: NodeJS.Timeout | null = null;
  private feedbackCount: number = 0;
  private startTime: Date | null = null;

  constructor(private config: DemoConfig) {
    super();
    
    this.collectionSystem = new FeedbackCollectionSystem({
      demoMode: true,
      enableRealTimeAnalytics: config.realTimeUpdates,
      analyticsUpdateInterval: 15000, // 15 seconds for demo
    });

    this.setupEventListeners();
    console.log('🎭 Feedback Demo Runner initialized');
  }

  /**
   * Available demo scenarios
   */
  static getAvailableScenarios(): DemoScenario[] {
    return [
      {
        id: 'swedish-morning-rush',
        name: 'Svensk Morgon-Rush',
        description: 'Simulerar morgonrushen på svenska caféer med hög feedbackvolym',
        duration: 5 * 60 * 1000, // 5 minutes
        feedbackRate: 15, // 15 per minute
        cafeConfigs: [
          {
            id: 'central-stockholm',
            name: 'Café Aurora',
            location: 'Stockholm Centralstation',
            customerTypes: ['commuter', 'tourist', 'business'],
            qualityRange: [70, 90],
            categories: ['service', 'speed', 'quality']
          },
          {
            id: 'gamla-stan',
            name: 'Gamla Stan Bryggeri',
            location: 'Gamla Stan, Stockholm',
            customerTypes: ['tourist', 'local', 'student'],
            qualityRange: [75, 95],
            categories: ['atmosphere', 'quality', 'authenticity']
          }
        ]
      },
      {
        id: 'lunch-feedback-wave',
        name: 'Lunch Feedback-våg',
        description: 'Lunch-tid feedback från flera caféer med varierad kvalitet',
        duration: 10 * 60 * 1000, // 10 minutes
        feedbackRate: 8,
        cafeConfigs: [
          {
            id: 'malmo-central',
            name: 'Malmö Huset',
            location: 'Malmö Centralstation',
            customerTypes: ['business', 'local', 'commuter'],
            qualityRange: [65, 85],
            categories: ['food', 'service', 'value']
          },
          {
            id: 'goteborg-office',
            name: 'Göteborg Kontor Kafé',
            location: 'Göteborg Business District',
            customerTypes: ['business', 'meeting'],
            qualityRange: [80, 95],
            categories: ['environment', 'service', 'wifi']
          },
          {
            id: 'uppsala-student',
            name: 'Uppsala Studentkafé',
            location: 'Uppsala Universitet',
            customerTypes: ['student', 'academic'],
            qualityRange: [60, 80],
            categories: ['value', 'study_space', 'atmosphere']
          }
        ]
      },
      {
        id: 'weekend-leisure',
        name: 'Helg Avkoppling',
        description: 'Avslappnade helgkunder med längre, mer genomtänkta feedbacks',
        duration: 8 * 60 * 1000, // 8 minutes
        feedbackRate: 5,
        cafeConfigs: [
          {
            id: 'seaside-cafe',
            name: 'Havets Kafé',
            location: 'Göteborg Skärgård',
            customerTypes: ['leisure', 'family', 'couple'],
            qualityRange: [75, 90],
            categories: ['atmosphere', 'relaxation', 'view', 'service']
          },
          {
            id: 'cultural-district',
            name: 'Kulturkvarter Kafé',
            location: 'Stockholm Södermalm',
            customerTypes: ['artistic', 'cultural', 'intellectual'],
            qualityRange: [80, 95],
            categories: ['atmosphere', 'authenticity', 'culture', 'quality']
          }
        ]
      },
      {
        id: 'stress-test-scenario',
        name: 'Stress Test - Hög Belastning',
        description: 'Högvolym scenario för att testa systemets kapacitet',
        duration: 3 * 60 * 1000, // 3 minutes
        feedbackRate: 30, // High volume
        cafeConfigs: [
          {
            id: 'airport-terminal',
            name: 'Arlanda Terminal Kafé',
            location: 'Stockholm Arlanda Airport',
            customerTypes: ['traveler', 'international', 'rushed'],
            qualityRange: [50, 85],
            categories: ['speed', 'convenience', 'international']
          },
          {
            id: 'train-station',
            name: 'Centralstations Express',
            location: 'Stockholm Centralstation',
            customerTypes: ['commuter', 'traveler', 'rushed'],
            qualityRange: [55, 80],
            categories: ['speed', 'efficiency', 'convenience']
          }
        ]
      }
    ];
  }

  /**
   * Start the demo
   */
  async startDemo(): Promise<void> {
    if (this.isRunning) {
      console.warn('⚠️ Demo already running');
      return;
    }

    console.log(`🚀 Starting demo: ${this.config.scenario.name}`);
    console.log(`📊 Duration: ${this.config.scenario.duration / 1000}s`);
    console.log(`⚡ Rate: ${this.config.scenario.feedbackRate} feedbacks/min`);

    this.isRunning = true;
    this.startTime = new Date();
    this.feedbackCount = 0;

    // Start collection system
    await this.collectionSystem.startCollection();

    // Calculate interval between feedbacks
    const intervalMs = (60 * 1000) / this.config.scenario.feedbackRate;
    
    // Start generating feedback
    this.demoInterval = setInterval(() => {
      this.generateFeedback();
    }, intervalMs);

    // Stop after duration
    setTimeout(() => {
      this.stopDemo();
    }, this.config.scenario.duration);

    // Auto-export if configured
    if (this.config.autoExport) {
      this.scheduleExports();
    }

    this.emit('demo:started', {
      scenario: this.config.scenario.name,
      startTime: this.startTime,
      duration: this.config.scenario.duration
    });
  }

  /**
   * Stop the demo
   */
  async stopDemo(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Stopping demo...');
    
    this.isRunning = false;
    
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }

    await this.collectionSystem.stopCollection();

    const endTime = new Date();
    const duration = endTime.getTime() - (this.startTime?.getTime() || 0);

    console.log(`✅ Demo completed:`);
    console.log(`   Duration: ${Math.round(duration / 1000)}s`);
    console.log(`   Feedbacks generated: ${this.feedbackCount}`);
    console.log(`   Average rate: ${Math.round((this.feedbackCount / (duration / 1000)) * 60)} feedbacks/min`);

    this.emit('demo:stopped', {
      feedbackCount: this.feedbackCount,
      duration,
      analytics: this.getAnalytics()
    });
  }

  /**
   * Get current analytics
   */
  getAnalytics(): FeedbackAnalytics {
    return this.collectionSystem.getAnalytics();
  }

  /**
   * Get real-time stats
   */
  getRealTimeStats() {
    return {
      ...this.collectionSystem.getRealTimeStats(),
      demoStats: {
        isRunning: this.isRunning,
        scenario: this.config.scenario.name,
        feedbacksGenerated: this.feedbackCount,
        elapsedTime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
        remainingTime: this.isRunning && this.startTime ? 
          Math.max(0, this.config.scenario.duration - (Date.now() - this.startTime.getTime())) : 0
      }
    };
  }

  /**
   * Export demo data
   */
  async exportDemoData(format: 'json' | 'csv' | 'xlsx' = 'json'): Promise<string | Buffer> {
    return await this.collectionSystem.exportFeedback(format, {
      includePersonalData: false // Never include personal data in demos
    });
  }

  /**
   * Generate a single feedback entry
   */
  private async generateFeedback(): Promise<void> {
    try {
      // Select random café
      const cafe = this.selectRandomCafe();
      
      // Generate realistic feedback
      const feedback = this.generateRealisticFeedback(cafe);
      
      // Collect feedback
      await this.collectionSystem.collectFeedback(feedback);
      
      this.feedbackCount++;
      
      this.emit('feedback:generated', {
        feedback,
        count: this.feedbackCount,
        cafe: cafe.name
      });

    } catch (error) {
      console.error('❌ Error generating feedback:', error);
      this.emit('demo:error', error);
    }
  }

  /**
   * Select random café based on scenario
   */
  private selectRandomCafe() {
    const cafes = this.config.scenario.cafeConfigs;
    return cafes[Math.floor(Math.random() * cafes.length)];
  }

  /**
   * Generate realistic feedback for a café
   */
  private generateRealisticFeedback(cafe: any): Omit<FeedbackData, 'id' | 'timestamp'> {
    const templates = this.getFeedbackTemplates(cafe);
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Generate quality score within café's range
    const baseQuality = cafe.qualityRange[0] + Math.random() * (cafe.qualityRange[1] - cafe.qualityRange[0]);
    const qualityVariation = (Math.random() - 0.5) * 20; // ±10 points variation
    
    const authenticity = Math.max(0, Math.min(100, baseQuality + qualityVariation));
    const concreteness = Math.max(0, Math.min(100, baseQuality + (Math.random() - 0.5) * 30));
    const depth = Math.max(0, Math.min(100, baseQuality + (Math.random() - 0.5) * 25));
    const totalQuality = Math.round((authenticity * 0.4) + (concreteness * 0.3) + (depth * 0.3));

    // Calculate reward based on quality
    const purchaseAmount = Math.floor(Math.random() * 200) + 30; // 30-230 SEK
    const rewardPercentage = Math.max(1, Math.min(12, (totalQuality - 50) * 0.2)); // 1-12% based on quality
    const rewardAmount = Math.round((purchaseAmount * rewardPercentage / 100) * 100) / 100;

    return {
      sessionId: `demo-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      businessId: cafe.id,
      cafeName: cafe.name,
      location: cafe.location,
      customerHash: `demo-customer-${Math.random().toString(36).substr(2, 12)}`,
      
      transcript: template.transcript,
      audioMetadata: {
        duration: 30 + Math.random() * 60, // 30-90 seconds
        quality: 0.85 + Math.random() * 0.1,
        language: 'sv-SE',
        confidence: 0.9
      },
      
      qualityScore: {
        authenticity,
        concreteness,
        depth,
        total: totalQuality,
        reasoning: template.reasoning
      },
      
      categories: this.selectRandomCategories(cafe.categories, template.categories),
      sentiment: template.sentiment,
      
      businessContext: {
        type: 'café',
        purchase: {
          amount: purchaseAmount,
          items: this.generatePurchaseItems(),
          time: new Date(Date.now() - Math.random() * 60 * 60 * 1000) // Within last hour
        },
        staff: ['Anna', 'Erik', 'Maria', 'Johan', 'Lisa'],
        promotions: ['Vintererbjudande', 'Fika-deal', '20% rabatt på bakverk']
      },
      
      reward: {
        amount: rewardAmount,
        currency: 'SEK',
        tier: this.selectTier(purchaseAmount),
        processed: true,
        processingTime: Math.random() * 3000 + 500 // 0.5-3.5 seconds
      },
      
      demo: {
        isDemoData: true,
        scenario: this.config.scenario.id,
        generatedBy: 'FeedbackDemoRunner'
      }
    };
  }

  /**
   * Get feedback templates for different scenarios
   */
  private getFeedbackTemplates(cafe: any) {
    const commonTemplates = [
      {
        transcript: `Kaffet på ${cafe.name} var riktigt bra idag. Personalen var trevlig och servicen snabb. Lokalen känns välkomnande och ren.`,
        categories: ['service', 'quality', 'environment'],
        sentiment: { score: 0.7, label: 'positive' as const, confidence: 0.8 },
        reasoning: 'Positiv feedback med specifika observationer om kaffe, personal och miljö'
      },
      {
        transcript: `Hade en trevlig upplevelse här. Latte var välgjord och baristerna verkade kunniga. Lite för mycket ljud från köksmaskiner dock.`,
        categories: ['quality', 'service', 'environment'],
        sentiment: { score: 0.5, label: 'positive' as const, confidence: 0.7 },
        reasoning: 'Balanserad feedback med både positiva och konstruktiva kommentarer'
      },
      {
        transcript: `Bra café men väntetiden var längre än väntat. Kaffet var dock värt det. Priset är rimligt för kvaliteten.`,
        categories: ['service', 'quality', 'value'],
        sentiment: { score: 0.3, label: 'neutral' as const, confidence: 0.8 },
        reasoning: 'Realistisk feedback som väger för- och nackdelar'
      },
      {
        transcript: `Fantastisk atmosfär och personal som verkligen bryr sig. Den här platsen har blivit mitt favoritcafé i ${cafe.location}.`,
        categories: ['atmosphere', 'service', 'loyalty'],
        sentiment: { score: 0.9, label: 'positive' as const, confidence: 0.9 },
        reasoning: 'Entusiastisk feedback som visar stark känslomässig koppling'
      },
      {
        transcript: `Kaffet var kallt när jag fick det och det tog 10 minuter att få beställningen. Personalen verkade stressad idag.`,
        categories: ['quality', 'service', 'operations'],
        sentiment: { score: -0.4, label: 'negative' as const, confidence: 0.8 },
        reasoning: 'Konstruktiv kritik med specifika observationer om problem'
      }
    ];

    // Add scenario-specific templates based on customer types
    const customerType = cafe.customerTypes[Math.floor(Math.random() * cafe.customerTypes.length)];
    
    switch (customerType) {
      case 'business':
        commonTemplates.push({
          transcript: `Perfekt för affärsmöten. Wifi fungerar bra och miljön är professionell. Servicen var effektiv.`,
          categories: ['business', 'wifi', 'environment', 'service'],
          sentiment: { score: 0.8, label: 'positive' as const, confidence: 0.8 },
          reasoning: 'Affärsfokuserad feedback med praktiska observationer'
        });
        break;
      
      case 'student':
        commonTemplates.push({
          transcript: `Bra studieplatser och rimliga priser för studenter. Wifi är stabilt och inte för bullrigt.`,
          categories: ['study_space', 'value', 'wifi', 'atmosphere'],
          sentiment: { score: 0.6, label: 'positive' as const, confidence: 0.7 },
          reasoning: 'Studentperspektiv med fokus på studievänlighet och priser'
        });
        break;
      
      case 'tourist':
        commonTemplates.push({
          transcript: `Härlig svensk kaffekultur! Personalen hjälpte oss på engelska och förklarade lokala specialiteter.`,
          categories: ['culture', 'service', 'international'],
          sentiment: { score: 0.8, label: 'positive' as const, confidence: 0.9 },
          reasoning: 'Turistperspektiv som uppskattar kulturell upplevelse och språkstöd'
        });
        break;
    }

    return commonTemplates;
  }

  /**
   * Select random categories from available options
   */
  private selectRandomCategories(cafeCategories: string[], templateCategories: string[]): string[] {
    const allCategories = [...new Set([...cafeCategories, ...templateCategories])];
    const numCategories = Math.floor(Math.random() * 3) + 2; // 2-4 categories
    
    const selectedCategories: string[] = [];
    while (selectedCategories.length < numCategories && selectedCategories.length < allCategories.length) {
      const category = allCategories[Math.floor(Math.random() * allCategories.length)];
      if (!selectedCategories.includes(category)) {
        selectedCategories.push(category);
      }
    }
    
    return selectedCategories;
  }

  /**
   * Generate realistic purchase items
   */
  private generatePurchaseItems(): string[] {
    const items = [
      'Cappuccino', 'Latte', 'Espresso', 'Americano', 'Cortado',
      'Smörgås', 'Croissant', 'Muffin', 'Kanelbulle', 'Wienerbrød',
      'Sallad', 'Soppa', 'Quiche', 'Bagel', 'Macka'
    ];
    
    const numItems = Math.floor(Math.random() * 3) + 1; // 1-3 items
    const selectedItems: string[] = [];
    
    while (selectedItems.length < numItems) {
      const item = items[Math.floor(Math.random() * items.length)];
      if (!selectedItems.includes(item)) {
        selectedItems.push(item);
      }
    }
    
    return selectedItems;
  }

  /**
   * Select business tier based on purchase amount
   */
  private selectTier(amount: number): string {
    if (amount >= 200) return 'Tier 3';
    if (amount >= 100) return 'Tier 2';
    return 'Tier 1';
  }

  /**
   * Schedule automatic exports
   */
  private scheduleExports(): void {
    setInterval(async () => {
      try {
        const data = await this.exportDemoData('json');
        console.log(`📤 Auto-exported demo data: ${(data as string).length} characters`);
        this.emit('demo:exported', { format: 'json', size: (data as string).length });
      } catch (error) {
        console.error('❌ Auto-export failed:', error);
      }
    }, this.config.exportInterval);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    this.collectionSystem.on('feedback:collected', (feedback) => {
      this.emit('feedback:collected', feedback);
    });

    this.collectionSystem.on('analytics:updated', (analytics) => {
      this.emit('analytics:updated', analytics);
    });

    // Forward collection system events
    ['collection:started', 'collection:stopped'].forEach(event => {
      this.collectionSystem.on(event, (...args) => {
        this.emit(event, ...args);
      });
    });
  }
}

export default FeedbackDemoRunner;