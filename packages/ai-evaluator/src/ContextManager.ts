import { BusinessContext, ConversationResponse } from './types';

export interface EnhancedBusinessContext extends BusinessContext {
  businessName: string;
  locationName: string;
  conversationStyle: 'casual' | 'formal' | 'friendly';
  culturalContext: 'swedish' | 'nordic' | 'international';
  operatingHours?: string;
  peakTimes?: string[];
  customerDemographics?: string;
  priceRange?: 'budget' | 'mid-range' | 'premium';
  lastUpdated: Date;
}

export interface ContextInjectionConfig {
  includeStaffNames: boolean;
  includeCurrentPromotions: boolean;
  includeKnownIssues: boolean;
  adaptToBusinessType: boolean;
  useSwedishContext: boolean;
  personalizeGreeting: boolean;
}

export class ContextManager {
  private contextCache: Map<string, EnhancedBusinessContext> = new Map();
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  
  constructor(private config: ContextInjectionConfig = {
    includeStaffNames: true,
    includeCurrentPromotions: true,
    includeKnownIssues: true,
    adaptToBusinessType: true,
    useSwedishContext: true,
    personalizeGreeting: true
  }) {}

  /**
   * Load business context from database and enhance it
   */
  public async loadBusinessContext(businessId: string, locationId?: string): Promise<EnhancedBusinessContext> {
    const cacheKey = `${businessId}:${locationId || 'default'}`;
    
    // Check cache first
    const cached = this.contextCache.get(cacheKey);
    if (cached && Date.now() - cached.lastUpdated.getTime() < this.cacheTimeout) {
      return cached;
    }

    try {
      // In a real implementation, this would fetch from database
      // For now, return enhanced mock data
      const baseContext = await this.fetchBusinessContextFromDB(businessId, locationId);
      const enhancedContext = this.enhanceBusinessContext(baseContext, businessId, locationId);
      
      // Cache the enhanced context
      this.contextCache.set(cacheKey, enhancedContext);
      
      console.log(`📋 Loaded business context for ${enhancedContext.businessName} (${enhancedContext.type})`);
      return enhancedContext;
    } catch (error) {
      console.error('Failed to load business context:', error);
      // Return minimal fallback context
      return this.createFallbackContext(businessId, locationId);
    }
  }

  /**
   * Generate conversation starter prompt with business context
   */
  public generateConversationStarter(context: EnhancedBusinessContext, customerPurchaseInfo?: any): string {
    const greeting = this.generateSwedishGreeting(context);
    const businessIntro = this.generateBusinessIntroduction(context);
    const conversationPrompt = this.generateConversationPrompt(context, customerPurchaseInfo);
    
    return `${greeting}\n\n${businessIntro}\n\n${conversationPrompt}`;
  }

  /**
   * Generate business-aware AI system prompt for authenticity scoring
   */
  public generateAuthenticityPrompt(context: EnhancedBusinessContext): string {
    const businessDetails = this.formatBusinessDetailsForAI(context);
    const staffContext = this.formatStaffContext(context);
    const operationalContext = this.formatOperationalContext(context);
    
    return `Du är en AI som utvärderar autenticitet i kundfeedback för ${context.businessName}, en ${this.translateBusinessType(context.type)} i Sverige.

AFFÄRSKONTEXT:
${businessDetails}

${staffContext}

${operationalContext}

UTVÄRDERINGSKRITERIER för AUTENTICITET (40% av totalbetyg):
- Nämner verkliga element från affären (personal, avdelningar, produkter, miljö)
- Detaljer som matchar affärstyp och kontext
- Realistiska observationer baserade på köpinformation
- Svensk kulturell kontext och förväntningar
- Specifika referenser till tid, plats och situation

Ge höga autenticitetspoäng (80-100) för feedback som:
- Nämner specifik personal eller avdelningar
- Beskriver realistiska interaktioner
- Visar förståelse för affärens layout och drift
- Inkluderar svenska kulturella referenser

Ge låga autenticitetspoäng (0-40) för:
- Generisk feedback som kan gälla vilken affär som helst
- Omnämner saker som inte finns på denna plats
- Orimliga eller osannolika scenarion
- Bristande kulturell kontext`;
  }

  /**
   * Generate contextual conversation prompts for natural dialogue
   */
  public generateContextualPrompts(context: EnhancedBusinessContext, conversationHistory: string[] = []): string[] {
    const prompts: string[] = [];
    
    // Business type specific prompts
    switch (context.type) {
      case 'grocery_store':
        prompts.push(
          'Vad tyckte du om utbudet av färska varor idag?',
          'Hur var din upplevelse vid kassorna?',
          'Hittade du allt du behövde i butiken?'
        );
        if (context.layout?.departments) {
          prompts.push(`Vad tyckte du om vår ${context.layout.departments.join(' eller ')} avdelning?`);
        }
        break;
        
      case 'cafe':
        prompts.push(
          'Vad tyckte du om kaffet och atmosfären?',
          'Hur var servicen från våra baristas?',
          'Var lokalen mysig och välkomnande?'
        );
        break;
        
      case 'restaurant':
        prompts.push(
          'Vad tyckte du om maten och presentationen?',
          'Hur var servicen från våra servitörer?',
          'Passar vår miljö för ditt tillfälle idag?'
        );
        break;
        
      case 'retail':
        prompts.push(
          'Hittade du det du sökte efter?',
          'Vad tyckte du om produktutbudet?',
          'Hur var hjälpen från våra säljare?'
        );
        break;
    }
    
    // Add staff-specific prompts if staff is defined
    if (context.staff && context.staff.length > 0 && this.config.includeStaffNames) {
      const staffNames = context.staff.map(s => s.name).slice(0, 3); // Limit to first 3
      prompts.push(`Hade du kontakt med någon av våra medarbetare som ${staffNames.join(', ')}?`);
    }
    
    // Add promotion-specific prompts
    if (context.currentPromotions && context.currentPromotions.length > 0 && this.config.includeCurrentPromotions) {
      prompts.push(`Såg du våra nuvarande erbjudanden? Vi har bland annat ${context.currentPromotions.slice(0, 2).join(' och ')}.`);
    }
    
    // Add follow-up prompts based on conversation history
    if (conversationHistory.length > 0) {
      prompts.push(
        'Kan du berätta mer detaljerat om det?',
        'Vad skulle kunna förbättra din upplevelse?',
        'Finns det något specifikt du vill lyfta fram?'
      );
    }
    
    return prompts;
  }

  /**
   * Validate feedback authenticity against business context
   */
  public validateFeedbackAuthenticity(
    feedback: string, 
    context: EnhancedBusinessContext,
    purchaseInfo?: any
  ): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 50; // Base authenticity score
    
    const feedbackLower = feedback.toLowerCase();
    const businessName = context.businessName.toLowerCase();
    
    // Check for business name mentions
    if (feedbackLower.includes(businessName)) {
      score += 10;
      reasons.push('Nämner affärsnamnet');
    }
    
    // Check for staff mentions
    if (context.staff) {
      const staffMentioned = context.staff.some(staff => 
        feedbackLower.includes(staff.name.toLowerCase())
      );
      if (staffMentioned) {
        score += 15;
        reasons.push('Nämner specifik personal');
      }
    }
    
    // Check for department/layout mentions
    if (context.layout?.departments) {
      const deptMentioned = context.layout.departments.some(dept =>
        feedbackLower.includes(dept.toLowerCase())
      );
      if (deptMentioned) {
        score += 10;
        reasons.push('Nämner specifik avdelning eller område');
      }
    }
    
    // Check for business type relevance
    const typeKeywords = this.getBusinessTypeKeywords(context.type);
    const relevantMentions = typeKeywords.filter(keyword => 
      feedbackLower.includes(keyword)
    );
    if (relevantMentions.length > 0) {
      score += Math.min(relevantMentions.length * 5, 15);
      reasons.push(`Relevant för ${this.translateBusinessType(context.type)}`);
    }
    
    // Check for Swedish cultural context
    const swedishKeywords = ['tack', 'bra', 'mysigt', 'trevlig', 'service', 'kassa', 'köa'];
    const swedishMentions = swedishKeywords.filter(keyword => 
      feedbackLower.includes(keyword)
    );
    if (swedishMentions.length > 0) {
      score += Math.min(swedishMentions.length * 2, 10);
      reasons.push('Innehåller svensk kulturell kontext');
    }
    
    // Penalize generic feedback
    const genericPhrases = ['bra service', 'trevlig personal', 'bra utbud', 'nöjd kund'];
    const genericCount = genericPhrases.filter(phrase => 
      feedbackLower.includes(phrase)
    ).length;
    if (genericCount > 2) {
      score -= 10;
      reasons.push('Innehåller mycket generisk feedback');
    }
    
    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));
    
    return { score, reasons };
  }

  /**
   * Clear context cache
   */
  public clearCache(): void {
    this.contextCache.clear();
    console.log('📋 Context cache cleared');
  }

  // Private helper methods

  private async fetchBusinessContextFromDB(businessId: string, locationId?: string): Promise<BusinessContext> {
    // This would be a real database query in production
    // For now, return mock data based on business type patterns
    const mockContexts: Record<string, BusinessContext> = {
      'grocery-1': {
        type: 'grocery_store',
        layout: {
          departments: ['Frukt & Grönt', 'Kött & Chark', 'Mejeri', 'Frysta varor'],
          checkouts: 8,
          selfCheckout: true
        },
        staff: [
          { name: 'Anna', role: 'Kassör', department: 'Kassa' },
          { name: 'Erik', role: 'Avdelningschef', department: 'Frukt & Grönt' },
          { name: 'Maria', role: 'Butikschef', department: 'Ledning' }
        ],
        currentPromotions: ['3 för 2 på all frukt', 'Extra rea på kött'],
        knownIssues: ['Långa köer på eftermiddagen', 'Ibland slut på ekolögiska produkter'],
        strengths: ['Fräscha varor', 'Vänlig personal', 'Bra priser']
      },
      'cafe-1': {
        type: 'cafe',
        staff: [
          { name: 'Lisa', role: 'Barista', department: 'Kök' },
          { name: 'Johan', role: 'Café-chef', department: 'Ledning' }
        ],
        currentPromotions: ['Lunchpris på macka + kaffe'],
        strengths: ['Mysig atmosfär', 'Gott kaffe', 'Hemlagade bakverk']
      }
    };
    
    return mockContexts[businessId] || mockContexts['grocery-1'];
  }

  private enhanceBusinessContext(
    baseContext: BusinessContext, 
    businessId: string, 
    locationId?: string
  ): EnhancedBusinessContext {
    return {
      ...baseContext,
      businessName: this.generateBusinessName(baseContext.type, businessId),
      locationName: locationId ? `Filial ${locationId}` : 'Huvudbutik',
      conversationStyle: this.determineConversationStyle(baseContext.type),
      culturalContext: 'swedish',
      operatingHours: this.getTypicalOperatingHours(baseContext.type),
      peakTimes: this.getTypicalPeakTimes(baseContext.type),
      priceRange: this.determinePriceRange(baseContext.type),
      lastUpdated: new Date()
    };
  }

  private createFallbackContext(businessId: string, locationId?: string): EnhancedBusinessContext {
    return {
      type: 'retail',
      businessName: 'Lokal Butik',
      locationName: locationId || 'Huvudbutik',
      conversationStyle: 'friendly',
      culturalContext: 'swedish',
      lastUpdated: new Date(),
      strengths: ['God service', 'Lokalt engagemang']
    };
  }

  private generateSwedishGreeting(context: EnhancedBusinessContext): string {
    const timeOfDay = new Date().getHours();
    let timeGreeting = '';
    
    if (timeOfDay < 10) {
      timeGreeting = 'God morgon';
    } else if (timeOfDay < 17) {
      timeGreeting = 'Hej';
    } else {
      timeGreeting = 'God kväll';
    }
    
    return `${timeGreeting}! Tack för att du handlade hos ${context.businessName} idag.`;
  }

  private generateBusinessIntroduction(context: EnhancedBusinessContext): string {
    const businessTypeText = this.translateBusinessType(context.type);
    return `Jag är en AI-assistent som hjälper oss att förbättra din upplevelse i vår ${businessTypeText}. Dina åsikter är värdefulla för oss!`;
  }

  private generateConversationPrompt(context: EnhancedBusinessContext, purchaseInfo?: any): string {
    const basePrompt = 'Kan du berätta om din upplevelse idag? Vad gick bra och vad kunde varit bättre?';
    
    if (purchaseInfo?.items && purchaseInfo.items.length > 0) {
      return `${basePrompt} Jag ser att du handlade ${purchaseInfo.items.join(', ')} - vad tyckte du om dessa produkter och servicen?`;
    }
    
    return basePrompt;
  }

  private formatBusinessDetailsForAI(context: EnhancedBusinessContext): string {
    let details = `Affärstyp: ${this.translateBusinessType(context.type)}\n`;
    details += `Namn: ${context.businessName}\n`;
    details += `Prisområde: ${context.priceRange || 'okänt'}\n`;
    
    if (context.operatingHours) {
      details += `Öppettider: ${context.operatingHours}\n`;
    }
    
    return details;
  }

  private formatStaffContext(context: EnhancedBusinessContext): string {
    if (!context.staff || context.staff.length === 0) {
      return '';
    }
    
    let staffInfo = 'PERSONAL:\n';
    context.staff.forEach(staff => {
      staffInfo += `- ${staff.name}: ${staff.role} (${staff.department})\n`;
    });
    
    return staffInfo;
  }

  private formatOperationalContext(context: EnhancedBusinessContext): string {
    let opInfo = '';
    
    if (context.layout) {
      opInfo += 'LAYOUT:\n';
      if (context.layout.departments) {
        opInfo += `Avdelningar: ${context.layout.departments.join(', ')}\n`;
      }
      opInfo += `Kassor: ${context.layout.checkouts || 'okänt antal'}\n`;
      opInfo += `Självscanning: ${context.layout.selfCheckout ? 'Ja' : 'Nej'}\n`;
    }
    
    if (context.currentPromotions && context.currentPromotions.length > 0) {
      opInfo += `AKTUELLA ERBJUDANDEN: ${context.currentPromotions.join(', ')}\n`;
    }
    
    if (context.knownIssues && context.knownIssues.length > 0) {
      opInfo += `KÄNDA UTMANINGAR: ${context.knownIssues.join(', ')}\n`;
    }
    
    return opInfo;
  }

  private translateBusinessType(type: string): string {
    const translations = {
      'grocery_store': 'livsmedelsbutik',
      'cafe': 'kafé',
      'restaurant': 'restaurang',
      'retail': 'butik'
    };
    return translations[type] || 'butik';
  }

  private getBusinessTypeKeywords(type: string): string[] {
    const keywords = {
      grocery_store: ['kassa', 'köa', 'frukt', 'grönt', 'mejeri', 'kött', 'kundkorg', 'hyllan', 'prisvärd'],
      cafe: ['kaffe', 'barista', 'latte', 'cappuccino', 'bakverk', 'mysig', 'wifi', 'bord'],
      restaurant: ['mat', 'servering', 'kock', 'servitör', 'meny', 'tallrik', 'atmosfär', 'booking'],
      retail: ['kläder', 'prova', 'storlek', 'kvalitet', 'design', 'pris', 'trend', 'kollektionen']
    };
    return keywords[type] || ['service', 'kvalitet', 'pris'];
  }

  private generateBusinessName(type: string, businessId: string): string {
    const names = {
      grocery_store: ['Lokala ICA', 'Kvarterskvarns Livs', 'Närbutiken'],
      cafe: ['Kafé Mysig', 'Espresso Hörnan', 'Café Centrum'],
      restaurant: ['Restaurang Smakfullt', 'Bistro Lokalt', 'Kök & Bar'],
      retail: ['Modebutiken', 'Style & Trends', 'Kvalitetsbutiken']
    };
    const typeNames = names[type] || ['Lokal Butik'];
    return typeNames[0]; // In real implementation, would map businessId to actual name
  }

  private determineConversationStyle(type: string): 'casual' | 'formal' | 'friendly' {
    const styles = {
      grocery_store: 'friendly' as const,
      cafe: 'casual' as const,
      restaurant: 'formal' as const,
      retail: 'friendly' as const
    };
    return styles[type] || 'friendly';
  }

  private getTypicalOperatingHours(type: string): string {
    const hours = {
      grocery_store: '07:00-22:00',
      cafe: '07:00-18:00',
      restaurant: '11:00-22:00',
      retail: '10:00-19:00'
    };
    return hours[type] || '09:00-18:00';
  }

  private getTypicalPeakTimes(type: string): string[] {
    const peakTimes = {
      grocery_store: ['17:00-19:00', 'Lördag förmiddag'],
      cafe: ['07:00-09:00', '12:00-13:00'],
      restaurant: ['12:00-14:00', '18:00-21:00'],
      retail: ['12:00-15:00', 'Lördag']
    };
    return peakTimes[type] || ['Lunch', 'Eftermiddag'];
  }

  private determinePriceRange(type: string): 'budget' | 'mid-range' | 'premium' {
    // This would be determined from actual business data
    return 'mid-range';
  }
}