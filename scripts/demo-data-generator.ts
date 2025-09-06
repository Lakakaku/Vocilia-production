#!/usr/bin/env ts-node

/**
 * Demo Data Generator for AI Feedback Platform
 * 
 * Generates realistic Swedish café simulation data for internal demos
 * including businesses, feedback sessions, and comprehensive analytics
 */

import { randomUUID } from 'crypto';

// Demo Configuration
const DEMO_CONFIG = {
  businesses: 8,
  locationsPerBusiness: 2,
  feedbackSessionsPerDay: 25,
  daysOfData: 30,
  languages: ['sv', 'en'],
  fraudPercentage: 0.03, // 3% fraud rate
} as const;

// Swedish Business Data
const SWEDISH_BUSINESSES = [
  {
    name: 'Café Aurora Stockholm',
    type: 'cafe',
    orgNumber: '556123-4567',
    email: 'kontakt@cafeaurora.se',
    phone: '+46701234567',
    address: {
      street: 'Drottninggatan 123',
      city: 'Stockholm', 
      postalCode: '11151',
      country: 'SE'
    },
    context: {
      specialties: ['artisan coffee', 'fresh pastries', 'vegan options'],
      atmosphere: 'cozy urban café',
      knownIssues: ['crowded mornings', 'limited seating'],
      strengths: ['excellent coffee quality', 'friendly staff']
    }
  },
  {
    name: 'Göteborg Kaffebröd',
    type: 'cafe',
    orgNumber: '556234-5678', 
    email: 'info@gbgkaffebrod.se',
    phone: '+46702345678',
    address: {
      street: 'Avenyn 45',
      city: 'Göteborg',
      postalCode: '41136',
      country: 'SE'
    },
    context: {
      specialties: ['traditional Swedish pastries', 'specialty coffee', 'kanelbullar'],
      atmosphere: 'traditional Swedish café',
      knownIssues: ['slow service during peak', 'old equipment'],
      strengths: ['authentic atmosphere', 'local favorite']
    }
  },
  {
    name: 'Malmö Modern Café',
    type: 'cafe',
    orgNumber: '556345-6789',
    email: 'hello@malmomodern.se',
    phone: '+46703456789',
    address: {
      street: 'Storgatan 67',
      city: 'Malmö',
      postalCode: '21134',
      country: 'SE'
    },
    context: {
      specialties: ['modern Nordic cuisine', 'oat milk lattes', 'minimalist design'],
      atmosphere: 'modern minimalist',
      knownIssues: ['expensive prices', 'limited parking'],
      strengths: ['Instagram-worthy interior', 'sustainable practices']
    }
  },
  {
    name: 'Uppsala Universitets Café',
    type: 'cafe',
    orgNumber: '556456-7890',
    email: 'cafe@uppsalauniv.se',
    phone: '+46704567890',
    address: {
      street: 'Universitetsgatan 12',
      city: 'Uppsala',
      postalCode: '75236',
      country: 'SE'
    },
    context: {
      specialties: ['student-friendly prices', 'study spaces', 'quick service'],
      atmosphere: 'academic casual',
      knownIssues: ['noisy during exams', 'limited healthy options'],
      strengths: ['convenient location', 'affordable prices']
    }
  },
  {
    name: 'Växjö Växtcafé',
    type: 'cafe',
    orgNumber: '556567-8901',
    email: 'kontakt@vaxjovaxt.se',
    phone: '+46705678901',
    address: {
      street: 'Smålandsgatan 23',
      city: 'Växjö',
      postalCode: '35252',
      country: 'SE'
    },
    context: {
      specialties: ['plant-based menu', 'local ingredients', 'eco-friendly'],
      atmosphere: 'green sustainable café',
      knownIssues: ['limited non-vegan options', 'slower preparation'],
      strengths: ['sustainability focus', 'unique menu']
    }
  },
  {
    name: 'Lund Lunchcafé',
    type: 'cafe',
    orgNumber: '556678-9012',
    email: 'info@lundlunch.se',
    phone: '+46706789012',
    address: {
      street: 'Kyrkogatan 8',
      city: 'Lund',
      postalCode: '22222',
      country: 'SE'
    },
    context: {
      specialties: ['lunch combinations', 'fresh salads', 'quick service'],
      atmosphere: 'business casual',
      knownIssues: ['long lunch queues', 'limited variety'],
      strengths: ['convenient location', 'reliable quality']
    }
  },
  {
    name: 'Örebro Kaffehörna',
    type: 'cafe',
    orgNumber: '556789-0123',
    email: 'kaffe@orebrohorna.se',
    phone: '+46707890123',
    address: {
      street: 'Järnvägsgatan 34',
      city: 'Örebro',
      postalCode: '70216',
      country: 'SE'
    },
    context: {
      specialties: ['local roasted coffee', 'homemade cakes', 'cozy atmosphere'],
      atmosphere: 'traditional cozy',
      knownIssues: ['outdated decor', 'cash-only payments'],
      strengths: ['personal service', 'local charm']
    }
  },
  {
    name: 'Helsingborg Harbor Café',
    type: 'cafe', 
    orgNumber: '556890-1234',
    email: 'harbor@hbgharbor.se',
    phone: '+46708901234',
    address: {
      street: 'Hamngatan 56',
      city: 'Helsingborg',
      postalCode: '25221',
      country: 'SE'
    },
    context: {
      specialties: ['harbor views', 'fresh seafood options', 'tourist-friendly'],
      atmosphere: 'scenic waterfront',
      knownIssues: ['tourist prices', 'weather dependent seating'],
      strengths: ['beautiful location', 'unique experience']
    }
  }
] as const;

// Swedish Menu Items
const MENU_ITEMS = [
  'kaffe', 'cappuccino', 'latte', 'americano', 'espresso',
  'kanelbulle', 'semla', 'prinsesstårta', 'kladdkaka', 'pepparkakor',
  'smörgås', 'sallad', 'soppa', 'macka', 'wienerbröd',
  'te', 'chai latte', 'hot chocolate', 'smoothie', 'juice'
] as const;

// Realistic Swedish Feedback Templates
const FEEDBACK_TEMPLATES = {
  positive: [
    {
      template: "Jag älskar verkligen denna plats! {{staff}} var så vänlig och {{item}} smakade fantastiskt. Atmosfären är perfekt för att {{activity}}.",
      categories: ['service', 'food_quality', 'atmosphere'],
      scores: { authenticity: 85, concreteness: 90, depth: 85 }
    },
    {
      template: "{{item}} var riktigt bra idag. Personalen arbetar hårt och det märks. Kommer definitivt tillbaka för {{reason}}.",
      categories: ['food_quality', 'service'],
      scores: { authenticity: 80, concreteness: 85, depth: 75 }
    },
    {
      template: "Fantastisk service från {{staff}}! De rekommenderade {{item}} och det var precis vad jag behövde. Platsen känns alltid välkomnande.",
      categories: ['service', 'recommendations'],
      scores: { authenticity: 90, concreteness: 95, depth: 80 }
    }
  ],
  negative: [
    {
      template: "{{item}} var tyvärr inte bra idag. Det smakade {{issue}} och jag fick vänta {{wait_time}} minuter. Hoppas ni kan förbättra detta.",
      categories: ['food_quality', 'wait_time'],
      scores: { authenticity: 85, concreteness: 90, depth: 80 }
    },
    {
      template: "Personalen verkade stressad och {{item}} var {{issue}}. För {{price}} SEK förväntade jag mig mycket bättre kvalitet.",
      categories: ['service', 'food_quality', 'price'],
      scores: { authenticity: 80, concreteness: 85, depth: 85 }
    },
    {
      template: "Lokalen var {{cleanliness_issue}} och {{item}} smakade gammalt. Jag har varit kund här länge men kvaliteten har sjunkit.",
      categories: ['cleanliness', 'food_quality'],
      scores: { authenticity: 90, concreteness: 85, depth: 90 }
    }
  ],
  neutral: [
    {
      template: "{{item}} var okej, ingenting speciellt. Servicen var normal och priserna rimliga. En genomsnittlig upplevelse helt enkelt.",
      categories: ['food_quality', 'service', 'price'],
      scores: { authenticity: 75, concreteness: 70, depth: 60 }
    },
    {
      template: "Stannade för en snabb {{item}}. {{staff}} var vänlig men inte utmärkande. Platsen gör sitt jobb för ett snabbt stopp.",
      categories: ['service', 'efficiency'],
      scores: { authenticity: 70, concreteness: 75, depth: 65 }
    }
  ],
  fraudulent: [
    {
      template: "Bra service generellt sett. Allt fungerade bra.",
      categories: ['service'],
      scores: { authenticity: 45, concreteness: 30, depth: 25 }
    },
    {
      template: "Kaffe var okej. Personalen var trevlig. Rekommenderar detta ställe.",
      categories: ['food_quality', 'service'],
      scores: { authenticity: 40, concreteness: 35, depth: 30 }
    }
  ]
} as const;

// Demo Data Types
interface DemoBusiness {
  id: string;
  name: string;
  org_number: string;
  email: string;
  phone: string;
  address: any;
  stripe_account_id: string;
  stripe_onboarding_complete: boolean;
  reward_settings: any;
  status: string;
  trial_feedbacks_remaining: number;
  trial_expires_at: string;
  created_at: string;
  updated_at: string;
  context: any;
}

interface DemoLocation {
  id: string;
  business_id: string;
  name: string;
  address: string;
  pos_location_id: string;
  qr_code_url: string;
  qr_code_expires_at: string;
  active: boolean;
  created_at: string;
}

interface DemoFeedbackSession {
  id: string;
  business_id: string;
  location_id: string;
  customer_hash: string;
  device_fingerprint: any;
  qr_token: string;
  qr_scanned_at: string;
  transaction_id: string;
  transaction_amount: number;
  transaction_items: any;
  transcript: string;
  ai_evaluation: any;
  quality_score: number;
  authenticity_score: number;
  concreteness_score: number;
  depth_score: number;
  sentiment_score: number;
  feedback_categories: string[];
  fraud_risk_score: number;
  fraud_flags: any;
  fraud_review_status: string;
  reward_tier: string;
  reward_amount: number;
  reward_percentage: number;
  status: string;
  created_at: string;
  completed_at: string;
}

class SwedishDemoDataGenerator {
  private businesses: DemoBusiness[] = [];
  private locations: DemoLocation[] = [];
  private feedbackSessions: DemoFeedbackSession[] = [];

  constructor() {
    console.log('🇸🇪 Initializing Swedish AI Feedback Platform Demo Data Generator');
    console.log('================================================================\n');
  }

  // Generate realistic Swedish businesses
  generateBusinesses(): DemoBusiness[] {
    console.log('🏢 Generating Swedish Businesses...');
    
    this.businesses = SWEDISH_BUSINESSES.map((template, index) => ({
      id: randomUUID(),
      name: template.name,
      org_number: template.orgNumber,
      email: template.email,
      phone: template.phone,
      address: template.address,
      stripe_account_id: `acct_demo_${Date.now()}_${index}`,
      stripe_onboarding_complete: Math.random() > 0.2, // 80% completed onboarding
      reward_settings: {
        tierMultipliers: { poor: 0.01, fair: 0.03, good: 0.06, very_good: 0.09, excellent: 0.12 },
        maxDailyReward: 150.00,
        fraudRiskThreshold: 0.7
      },
      status: Math.random() > 0.1 ? 'active' : 'pending_verification',
      trial_feedbacks_remaining: Math.floor(Math.random() * 25),
      trial_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      context: template.context
    }));

    console.log(`✅ Generated ${this.businesses.length} Swedish businesses`);
    return this.businesses;
  }

  // Generate business locations
  generateLocations(): DemoLocation[] {
    console.log('📍 Generating Business Locations...');
    
    this.businesses.forEach(business => {
      const template = SWEDISH_BUSINESSES.find(t => t.name === business.name)!;
      
      // Main location
      this.locations.push({
        id: randomUUID(),
        business_id: business.id,
        name: `${business.name} - Huvudbutik`,
        address: `${template.address.street}, ${template.address.city}`,
        pos_location_id: `pos_${randomUUID()}`,
        qr_code_url: `https://demo.aifeedback.se/qr/${randomUUID()}`,
        qr_code_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        active: true,
        created_at: business.created_at
      });

      // Secondary location (if applicable)
      if (Math.random() > 0.4) {
        this.locations.push({
          id: randomUUID(),
          business_id: business.id,
          name: `${business.name} - Filial`,
          address: `${template.address.street.replace(/\d+/, String(Math.floor(Math.random() * 200) + 1))}, ${template.address.city}`,
          pos_location_id: `pos_${randomUUID()}`,
          qr_code_url: `https://demo.aifeedback.se/qr/${randomUUID()}`,
          qr_code_expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          active: Math.random() > 0.1,
          created_at: new Date(Date.parse(business.created_at) + Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString()
        });
      }
    });

    console.log(`✅ Generated ${this.locations.length} business locations`);
    return this.locations;
  }

  // Generate realistic Swedish feedback
  generateFeedbackSessions(): DemoFeedbackSession[] {
    console.log('💬 Generating Realistic Swedish Feedback Sessions...');
    
    const totalSessions = DEMO_CONFIG.daysOfData * DEMO_CONFIG.feedbackSessionsPerDay;
    let sessionsGenerated = 0;

    for (let day = 0; day < DEMO_CONFIG.daysOfData; day++) {
      const sessionDate = new Date(Date.now() - day * 24 * 60 * 60 * 1000);
      const sessionsThisDay = DEMO_CONFIG.feedbackSessionsPerDay + Math.floor(Math.random() * 10 - 5);

      for (let session = 0; session < sessionsThisDay; session++) {
        const location = this.locations[Math.floor(Math.random() * this.locations.length)];
        const business = this.businesses.find(b => b.id === location.business_id)!;
        
        const isFraud = Math.random() < DEMO_CONFIG.fraudPercentage;
        const feedbackType = isFraud ? 'fraudulent' : 
                           Math.random() < 0.6 ? 'positive' : 
                           Math.random() < 0.7 ? 'negative' : 'neutral';

        const template = this.getRandomTemplate(feedbackType);
        const transcript = this.generateTranscript(template, business);
        const scores = this.calculateScores(template, isFraud);
        
        const sessionTime = new Date(sessionDate);
        sessionTime.setHours(Math.floor(Math.random() * 12) + 8); // 8 AM to 8 PM
        sessionTime.setMinutes(Math.random() * 60);

        this.feedbackSessions.push({
          id: randomUUID(),
          business_id: business.id,
          location_id: location.id,
          customer_hash: this.generateCustomerHash(),
          device_fingerprint: this.generateDeviceFingerprint(),
          qr_token: randomUUID(),
          qr_scanned_at: sessionTime.toISOString(),
          transaction_id: `txn_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
          transaction_amount: Math.floor(Math.random() * 500) + 50, // 5-55 SEK
          transaction_items: this.generateTransactionItems(),
          transcript,
          ai_evaluation: {
            reasoning: this.generateAIReasoning(transcript, scores),
            categories_detected: template.categories,
            sentiment_analysis: scores.sentiment
          },
          quality_score: scores.total,
          authenticity_score: scores.authenticity,
          concreteness_score: scores.concreteness,
          depth_score: scores.depth,
          sentiment_score: scores.sentiment,
          feedback_categories: template.categories,
          fraud_risk_score: isFraud ? Math.random() * 0.3 + 0.7 : Math.random() * 0.3,
          fraud_flags: isFraud ? { generic_content: true, low_detail: true } : null,
          fraud_review_status: isFraud ? 'flagged' : 'clear',
          reward_tier: this.calculateRewardTier(scores.total),
          reward_amount: this.calculateRewardAmount(scores.total, this.feedbackSessions.length),
          reward_percentage: this.calculateRewardPercentage(scores.total),
          status: 'completed',
          created_at: sessionTime.toISOString(),
          completed_at: new Date(sessionTime.getTime() + Math.random() * 300000).toISOString() // Up to 5 min later
        });

        sessionsGenerated++;
      }
    }

    console.log(`✅ Generated ${sessionsGenerated} realistic feedback sessions`);
    return this.feedbackSessions;
  }

  private getRandomTemplate(type: string) {
    const templates = FEEDBACK_TEMPLATES[type as keyof typeof FEEDBACK_TEMPLATES];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generateTranscript(template: any, business: DemoBusiness): string {
    let transcript = template.template;
    
    // Replace placeholders
    transcript = transcript.replace(/\{\{staff\}\}/g, this.getRandomStaffName());
    transcript = transcript.replace(/\{\{item\}\}/g, this.getRandomMenuItem());
    transcript = transcript.replace(/\{\{activity\}\}/g, this.getRandomActivity());
    transcript = transcript.replace(/\{\{reason\}\}/g, this.getRandomReason());
    transcript = transcript.replace(/\{\{issue\}\}/g, this.getRandomIssue());
    transcript = transcript.replace(/\{\{wait_time\}\}/g, String(Math.floor(Math.random() * 20) + 5));
    transcript = transcript.replace(/\{\{price\}\}/g, String(Math.floor(Math.random() * 50) + 30));
    transcript = transcript.replace(/\{\{cleanliness_issue\}\}/g, this.getRandomCleanlinessIssue());
    
    return transcript;
  }

  private calculateScores(template: any, isFraud: boolean) {
    if (isFraud) {
      return {
        authenticity: template.scores.authenticity,
        concreteness: template.scores.concreteness,
        depth: template.scores.depth,
        total: Math.round((template.scores.authenticity * 0.4 + template.scores.concreteness * 0.3 + template.scores.depth * 0.3)),
        sentiment: Math.random() * 0.4 + 0.3 // Neutral-ish sentiment for fraud
      };
    }

    const variance = 10;
    const authenticity = Math.max(0, Math.min(100, template.scores.authenticity + (Math.random() - 0.5) * variance));
    const concreteness = Math.max(0, Math.min(100, template.scores.concreteness + (Math.random() - 0.5) * variance));
    const depth = Math.max(0, Math.min(100, template.scores.depth + (Math.random() - 0.5) * variance));
    
    return {
      authenticity: Math.round(authenticity),
      concreteness: Math.round(concreteness),
      depth: Math.round(depth),
      total: Math.round(authenticity * 0.4 + concreteness * 0.3 + depth * 0.3),
      sentiment: Math.random() // Random sentiment
    };
  }

  private generateAIReasoning(transcript: string, scores: any): string {
    return `Feedback visar ${scores.total > 70 ? 'hög' : scores.total > 50 ? 'medel' : 'låg'} kvalitet. ` +
           `Autenticitet: ${scores.authenticity}% baserat på specifika detaljer. ` +
           `Konkrethet: ${scores.concreteness}% genom actionable insikter. ` +
           `Djup: ${scores.depth}% i reflektion och analys.`;
  }

  private generateCustomerHash(): string {
    return `customer_${Math.random().toString(36).substr(2, 16)}`;
  }

  private generateDeviceFingerprint() {
    return {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15',
      screen: '375x812',
      timezone: 'Europe/Stockholm',
      language: 'sv-SE'
    };
  }

  private generateTransactionItems() {
    const numItems = Math.floor(Math.random() * 3) + 1;
    const items = [];
    
    for (let i = 0; i < numItems; i++) {
      items.push({
        name: MENU_ITEMS[Math.floor(Math.random() * MENU_ITEMS.length)],
        quantity: Math.floor(Math.random() * 2) + 1,
        price: Math.floor(Math.random() * 40) + 15
      });
    }
    
    return items;
  }

  private calculateRewardTier(score: number): string {
    if (score >= 85) return 'excellent';
    if (score >= 70) return 'very_good';
    if (score >= 55) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
  }

  private calculateRewardAmount(score: number, sessionIndex: number): number {
    const baseAmount = Math.floor(Math.random() * 400) + 100; // 10-50 SEK transaction
    const percentage = this.calculateRewardPercentage(score);
    return Math.round(baseAmount * percentage / 100);
  }

  private calculateRewardPercentage(score: number): number {
    if (score >= 85) return Math.random() * 3 + 9; // 9-12%
    if (score >= 70) return Math.random() * 3 + 6; // 6-9%
    if (score >= 55) return Math.random() * 3 + 3; // 3-6%
    if (score >= 40) return Math.random() * 2 + 1; // 1-3%
    return Math.random(); // 0-1%
  }

  // Helper methods for realistic Swedish content
  private getRandomStaffName(): string {
    const names = ['Anna', 'Erik', 'Maria', 'Johan', 'Emma', 'Lars', 'Sofia', 'Magnus', 'Linda', 'Anders'];
    return names[Math.floor(Math.random() * names.length)];
  }

  private getRandomMenuItem(): string {
    return MENU_ITEMS[Math.floor(Math.random() * MENU_ITEMS.length)];
  }

  private getRandomActivity(): string {
    const activities = ['arbeta', 'studera', 'träffa vänner', 'läsa', 'koppla av', 'ha möten'];
    return activities[Math.floor(Math.random() * activities.length)];
  }

  private getRandomReason(): string {
    const reasons = ['kaffet', 'atmosfären', 'servicen', 'priserna', 'läget', 'maten'];
    return reasons[Math.floor(Math.random() * reasons.length)];
  }

  private getRandomIssue(): string {
    const issues = ['kallt', 'bittert', 'svagt', 'gammalt', 'för starkt', 'för sött'];
    return issues[Math.floor(Math.random() * issues.length)];
  }

  private getRandomCleanlinessIssue(): string {
    const issues = ['smutsig', 'ostädad', 'kladdigt', 'luktande', 'slarvigt'];
    return issues[Math.floor(Math.random() * issues.length)];
  }

  // Export data in various formats
  exportToJSON(): any {
    return {
      metadata: {
        generated_at: new Date().toISOString(),
        config: DEMO_CONFIG,
        total_businesses: this.businesses.length,
        total_locations: this.locations.length,
        total_sessions: this.feedbackSessions.length
      },
      businesses: this.businesses,
      locations: this.locations,
      feedback_sessions: this.feedbackSessions
    };
  }

  exportSQL(): string {
    let sql = "-- Demo Data for AI Feedback Platform\n";
    sql += "-- Generated on " + new Date().toISOString() + "\n\n";
    
    // Insert businesses
    sql += "INSERT INTO businesses (id, name, org_number, email, phone, address, stripe_account_id, stripe_onboarding_complete, reward_settings, status, trial_feedbacks_remaining, trial_expires_at, created_at, updated_at) VALUES\n";
    sql += this.businesses.map(b => 
      `('${b.id}', '${b.name}', '${b.org_number}', '${b.email}', '${b.phone}', '${JSON.stringify(b.address).replace(/'/g, "''")}', '${b.stripe_account_id}', ${b.stripe_onboarding_complete}, '${JSON.stringify(b.reward_settings).replace(/'/g, "''")}', '${b.status}', ${b.trial_feedbacks_remaining}, '${b.trial_expires_at}', '${b.created_at}', '${b.updated_at}')`
    ).join(",\n") + ";\n\n";

    // Insert locations
    sql += "INSERT INTO business_locations (id, business_id, name, address, pos_location_id, qr_code_url, qr_code_expires_at, active, created_at) VALUES\n";
    sql += this.locations.map(l => 
      `('${l.id}', '${l.business_id}', '${l.name}', '${l.address}', '${l.pos_location_id}', '${l.qr_code_url}', '${l.qr_code_expires_at}', ${l.active}, '${l.created_at}')`
    ).join(",\n") + ";\n\n";

    return sql;
  }

  // Generate analytics summary
  generateAnalyticsSummary() {
    const totalSessions = this.feedbackSessions.length;
    const averageScore = this.feedbackSessions.reduce((sum, s) => sum + s.quality_score, 0) / totalSessions;
    const fraudSessions = this.feedbackSessions.filter(s => s.fraud_risk_score > 0.7).length;
    const totalRewards = this.feedbackSessions.reduce((sum, s) => sum + s.reward_amount, 0) / 100; // Convert öre to SEK
    
    const categoryStats = {};
    this.feedbackSessions.forEach(session => {
      session.feedback_categories.forEach(category => {
        categoryStats[category] = (categoryStats[category] || 0) + 1;
      });
    });

    return {
      overview: {
        total_sessions: totalSessions,
        average_quality_score: Math.round(averageScore * 10) / 10,
        fraud_rate: Math.round((fraudSessions / totalSessions) * 1000) / 10, // Percentage with 1 decimal
        total_rewards_sek: Math.round(totalRewards * 100) / 100,
        businesses_active: this.businesses.filter(b => b.status === 'active').length
      },
      categories: categoryStats,
      daily_trends: this.calculateDailyTrends(),
      business_performance: this.calculateBusinessPerformance()
    };
  }

  private calculateDailyTrends() {
    const dailyData = {};
    this.feedbackSessions.forEach(session => {
      const date = session.created_at.split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { sessions: 0, total_score: 0, rewards: 0 };
      }
      dailyData[date].sessions++;
      dailyData[date].total_score += session.quality_score;
      dailyData[date].rewards += session.reward_amount / 100;
    });

    return Object.entries(dailyData).map(([date, data]: [string, any]) => ({
      date,
      sessions: data.sessions,
      average_score: Math.round(data.total_score / data.sessions * 10) / 10,
      total_rewards: Math.round(data.rewards * 100) / 100
    }));
  }

  private calculateBusinessPerformance() {
    const businessStats = {};
    
    this.feedbackSessions.forEach(session => {
      const businessId = session.business_id;
      if (!businessStats[businessId]) {
        businessStats[businessId] = {
          sessions: 0,
          total_score: 0,
          total_rewards: 0,
          fraud_count: 0
        };
      }
      businessStats[businessId].sessions++;
      businessStats[businessId].total_score += session.quality_score;
      businessStats[businessId].total_rewards += session.reward_amount / 100;
      if (session.fraud_risk_score > 0.7) businessStats[businessId].fraud_count++;
    });

    return Object.entries(businessStats).map(([businessId, stats]: [string, any]) => {
      const business = this.businesses.find(b => b.id === businessId);
      return {
        business_name: business?.name,
        sessions: stats.sessions,
        average_score: Math.round(stats.total_score / stats.sessions * 10) / 10,
        total_rewards: Math.round(stats.total_rewards * 100) / 100,
        fraud_rate: Math.round((stats.fraud_count / stats.sessions) * 1000) / 10
      };
    });
  }

  // Main generation method
  async generate(): Promise<any> {
    console.log('🚀 Starting Demo Data Generation...\n');
    
    this.generateBusinesses();
    this.generateLocations();
    this.generateFeedbackSessions();
    
    const analytics = this.generateAnalyticsSummary();
    
    console.log('\n📊 Generation Summary:');
    console.log('=====================');
    console.log(`✅ ${this.businesses.length} Swedish businesses created`);
    console.log(`✅ ${this.locations.length} business locations created`);
    console.log(`✅ ${this.feedbackSessions.length} feedback sessions created`);
    console.log(`✅ Average quality score: ${analytics.overview.average_quality_score}/100`);
    console.log(`✅ Total rewards generated: ${analytics.overview.total_rewards_sek} SEK`);
    console.log(`✅ Fraud rate: ${analytics.overview.fraud_rate}%`);
    
    return {
      businesses: this.businesses,
      locations: this.locations,
      feedback_sessions: this.feedbackSessions,
      analytics
    };
  }
}

// CLI execution
async function main() {
  const generator = new SwedishDemoDataGenerator();
  
  try {
    const demoData = await generator.generate();
    
    // Export options
    const exportJSON = process.argv.includes('--json');
    const exportSQL = process.argv.includes('--sql');
    const quiet = process.argv.includes('--quiet');
    
    if (exportJSON) {
      console.log('\n💾 Exporting JSON data...');
      const fs = await import('fs');
      const jsonData = generator.exportToJSON();
      fs.writeFileSync('demo-data.json', JSON.stringify(jsonData, null, 2));
      console.log('✅ JSON exported to demo-data.json');
    }
    
    if (exportSQL) {
      console.log('\n💾 Exporting SQL data...');
      const fs = await import('fs');
      const sqlData = generator.exportSQL();
      fs.writeFileSync('demo-data.sql', sqlData);
      console.log('✅ SQL exported to demo-data.sql');
    }
    
    if (!quiet) {
      console.log('\n📈 Analytics Summary:');
      console.log('====================');
      console.log(JSON.stringify(demoData.analytics, null, 2));
    }
    
    console.log('\n🎉 Demo Data Generation Complete!');
    console.log('===============================');
    console.log('Your Swedish AI Feedback Platform demo is ready.');
    
  } catch (error) {
    console.error('❌ Demo data generation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { SwedishDemoDataGenerator };