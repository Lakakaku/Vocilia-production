import OpenAI from 'openai';

interface BusinessContext {
  businessType: string;
  physicalLayout: {
    departments: string[];
    checkoutCount: number;
    hasSelfCheckout: boolean;
    specialAreas: string[];
    storeSizeM2?: number;
  };
  staff: Array<{
    name: string;
    role: string;
    department: string;
    languages?: string[];
    shift?: string;
  }>;
  productsServices: {
    mainCategories: string[];
    seasonalOfferings: string[];
    specialServices: string[];
    notOffered: string[];
  };
  operations: {
    businessHours: { [day: string]: { open: string; close: string; closed?: boolean } };
    peakTimes: string[];
    knownChallenges: string[];
    recentImprovements: string[];
  };
  customerPatterns: {
    commonQuestions: string[];
    frequentComplaints: string[];
    praisedAspects: string[];
    seasonalPatterns: string[];
  };
  customQuestions: any[];
}

interface Business {
  name: string;
  business_type: string;
}

interface ConversationMessage {
  role: 'user' | 'ai';
  content: string;
  timestamp: string;
}

interface AIAnalysisResult {
  response: string;
  contextGaps: string[];
  completionScore: number;
  contextUpdates: any;
  suggestedQuestions?: string[];
}

class AIContextService {
  private openai: OpenAI;
  
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  async analyzeContextMessage(
    userMessage: string,
    currentContext: BusinessContext,
    conversationHistory: ConversationMessage[],
    business: Business
  ): Promise<AIAnalysisResult> {
    try {
      const prompt = this.createContextAssistantPrompt(
        userMessage,
        currentContext,
        conversationHistory,
        business
      );

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Du är en expert AI-assistent som hjälper svenska företag att optimera sin verksamhetskontext för bättre kundåterrapportering och AI-analys. 

Du ska ALLTID svara på svenska och vara hjälpsam, konkret och professionell.

Din uppgift är att:
1. Hjälpa företaget fylla i mer information om sin verksamhet
2. Identifiera kunskapsluckor i kontexten  
3. Föreslå konkreta förbättringar
4. Ställa relevanta följdfrågor för att samla mer information
5. Ge en realistisk kompletteringspoäng (0-100)

När du svarar ska du inkludera:
- En hjälpsam respons på svenska
- Identifierade kunskapsluckor 
- En kompletteringspoäng
- Ibland konkreta uppdateringar till kontexten om användaren ger specifik information

Var alltid professionell men personlig, och anpassa din kommunikation efter verksamhetstypen.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 800,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      });

      const aiResponse = completion.choices[0]?.message?.content || 
        'Jag kan inte generera ett svar just nu. Försök igen om en stund.';

      // Calculate completion score
      const completionScore = this.calculateCompletionScore(currentContext);
      
      // Identify context gaps
      const contextGaps = this.identifyContextGaps(currentContext, business.business_type);
      
      // Generate follow-up questions
      const suggestedQuestions = this.generateFollowUpQuestions(currentContext, business.business_type);
      
      // Try to extract context updates from user message
      const contextUpdates = this.extractContextUpdates(userMessage, currentContext, business.business_type);

      return {
        response: aiResponse,
        contextGaps,
        completionScore,
        contextUpdates,
        suggestedQuestions
      };

    } catch (error) {
      console.error('OpenAI API Error:', error);
      
      // Fallback to rule-based response
      return this.fallbackAnalysis(userMessage, currentContext, business);
    }
  }

  private createContextAssistantPrompt(
    userMessage: string,
    currentContext: BusinessContext,
    conversationHistory: ConversationMessage[],
    business: Business
  ): string {
    const businessTypeLabel = this.getBusinessTypeLabel(business.business_type);
    
    return `FÖRETAGSINFORMATION:
Namn: ${business.name}
Typ: ${businessTypeLabel}

NUVARANDE KONTEXT (JSON):
${JSON.stringify(currentContext, null, 2)}

KONVERSATIONSHISTORIK:
${conversationHistory.slice(-6).map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n')}

ANVÄNDARENS SENASTE MEDDELANDE:
"${userMessage}"

INSTRUKTIONER:
Baserat på användarens meddelande och nuvarande kontext, ge en hjälpsam respons som:

1. Svarar direkt på användarens fråga/meddelande
2. Identifierar vad som saknas i kontexten
3. Föreslår konkreta nästa steg
4. Ställer relevanta följdfrågor för att samla mer information
5. Är anpassad för en ${businessTypeLabel}

Fokusera på att vara praktisk och konkret. Om användaren ger specifik information, bekräfta den och fråga efter mer detaljer.

Svara ENDAST med din respons på svenska - ingen JSON eller extra formatering.`;
  }

  private calculateCompletionScore(context: BusinessContext): number {
    let score = 0;
    let maxScore = 0;

    // Business type (required)
    score += 10;
    maxScore += 10;

    // Physical layout (30 points total)
    if (context.physicalLayout?.departments?.length > 0) {
      score += Math.min(context.physicalLayout.departments.length * 3, 15);
    }
    maxScore += 15;
    
    if (context.physicalLayout?.checkoutCount > 0) score += 5;
    maxScore += 5;
    
    if (context.physicalLayout?.specialAreas?.length > 0) {
      score += Math.min(context.physicalLayout.specialAreas.length * 2, 10);
    }
    maxScore += 10;

    // Staff (20 points)
    if (context.staff?.length > 0) {
      score += Math.min(context.staff.length * 4, 20);
    }
    maxScore += 20;

    // Products & Services (20 points)
    if (context.productsServices?.mainCategories?.length > 0) {
      score += Math.min(context.productsServices.mainCategories.length * 2, 8);
    }
    maxScore += 8;
    
    if (context.productsServices?.seasonalOfferings?.length > 0) score += 4;
    maxScore += 4;
    
    if (context.productsServices?.specialServices?.length > 0) score += 4;
    maxScore += 4;
    
    if (context.productsServices?.notOffered?.length > 0) score += 4;
    maxScore += 4;

    // Operations (20 points)
    const hasBusinessHours = context.operations?.businessHours && 
      Object.values(context.operations.businessHours).some((hours: any) => 
        hours && hours.open && hours.close && !hours.closed
      );
    if (hasBusinessHours) score += 8;
    maxScore += 8;
    
    if (context.operations?.peakTimes?.length > 0) score += 4;
    maxScore += 4;
    
    if (context.operations?.knownChallenges?.length > 0) score += 4;
    maxScore += 4;
    
    if (context.operations?.recentImprovements?.length > 0) score += 4;
    maxScore += 4;

    return Math.round((score / maxScore) * 100);
  }

  private identifyContextGaps(context: BusinessContext, businessType: string): string[] {
    const gaps: string[] = [];

    if (!context.physicalLayout?.departments?.length) {
      gaps.push("Lägg till avdelningar/områden i butiken");
    }

    if (!context.staff?.length) {
      gaps.push("Lägg till information om personal (namn och roller)");
    }

    if (!context.productsServices?.mainCategories?.length) {
      gaps.push("Specificera era huvudprodukter/tjänster");
    }

    if (!context.productsServices?.notOffered?.length) {
      gaps.push("Lista produkter ni INTE erbjuder (hjälper upptäcka falsk feedback)");
    }

    const hasBusinessHours = context.operations?.businessHours && 
      Object.values(context.operations.businessHours).some((hours: any) => 
        hours && hours.open && hours.close && !hours.closed
      );
    if (!hasBusinessHours) {
      gaps.push("Fyll i era öppettider för alla dagar");
    }

    if (!context.operations?.peakTimes?.length) {
      gaps.push("Beskriv när ni har mest kunder (rush-tider)");
    }

    if (!context.customerPatterns?.commonQuestions?.length) {
      gaps.push("Lista vanliga frågor från kunder");
    }

    if (!context.customerPatterns?.praisedAspects?.length) {
      gaps.push("Beskriv vad kunder brukar berömma");
    }

    return gaps;
  }

  private generateFollowUpQuestions(context: BusinessContext, businessType: string): string[] {
    const questions: string[] = [];
    const businessTypeLabel = this.getBusinessTypeLabel(businessType);

    if (!context.physicalLayout?.departments?.length) {
      if (businessType === 'grocery_store') {
        questions.push("Vilka avdelningar har ni? (t.ex. Frukt & Grönt, Mejeri, Kött & Chark)");
      } else if (businessType === 'cafe') {
        questions.push("Hur är ert café uppdelat? (t.ex. beställningsdisk, sittplatser, takeaway-område)");
      } else if (businessType === 'restaurant') {
        questions.push("Vilka områden har er restaurang? (t.ex. bar, matsal, terrass)");
      } else {
        questions.push(`Hur är er ${businessTypeLabel} uppdelad i olika områden?`);
      }
    }

    if (!context.staff?.length) {
      questions.push("Vilka arbetar hos er? Kan du berätta namn och roller på de som har mest kundkontakt?");
    }

    if (!context.productsServices?.mainCategories?.length) {
      if (businessType === 'cafe') {
        questions.push("Vad serverar ni? (t.ex. kaffe, te, bakverk, lunch)");
      } else if (businessType === 'restaurant') {
        questions.push("Vad för typ av mat serverar ni? (t.ex. husmanskost, pizza, sushi)");
      } else {
        questions.push(`Vilka är era huvudprodukter eller tjänster?`);
      }
    }

    if (!context.operations?.peakTimes?.length) {
      questions.push("När har ni mest kunder? Vilka tider är det extra travelt?");
    }

    return questions.slice(0, 3); // Return max 3 questions
  }

  private extractContextUpdates(userMessage: string, currentContext: BusinessContext, businessType: string): any {
    // Simple keyword-based extraction - in production this could be more sophisticated
    const message = userMessage.toLowerCase();
    let updates: any = null;

    // Check for staff names
    const staffKeywords = ['heter', 'jobbar', 'anställd', 'personal', 'medarbetare', 'kollega'];
    if (staffKeywords.some(keyword => message.includes(keyword))) {
      // This is a simplified example - in reality you'd want more sophisticated NLP
      // For now, we'll let the AI handle this in its response
    }

    // Check for opening hours
    if (message.includes('öppet') || message.includes('stängt') || message.includes(':')) {
      // Let AI handle time extraction
    }

    return updates;
  }

  private fallbackAnalysis(userMessage: string, currentContext: BusinessContext, business: Business): AIAnalysisResult {
    const messageLower = userMessage.toLowerCase();
    const completionScore = this.calculateCompletionScore(currentContext);
    const contextGaps = this.identifyContextGaps(currentContext, business.business_type);
    const businessTypeLabel = this.getBusinessTypeLabel(business.business_type);

    let response = "";

    if (messageLower.includes('hjälp') || messageLower.includes('börja') || messageLower.includes('start')) {
      response = `Hej! Jag hjälper dig att optimera kontexten för ${business.name}. 

Som ${businessTypeLabel} behöver vi information om:
• Era avdelningar/områden 
• Personal som jobbar hos er
• Produkter/tjänster ni erbjuder
• Öppettider och rush-tider

Vad vill du börja med?`;
    } else if (messageLower.includes('personal') || messageLower.includes('anställda')) {
      response = `Bra! Personalinformation hjälper AI:n att validera äkta feedback.

Kan du berätta:
• Förnamn på era medarbetare
• Vad de har för roller  
• Vilken avdelning de jobbar i

Börja gärna med de som har mest kundkontakt!`;
    } else {
      response = `Tack för informationen! Din kontext är ${completionScore}% komplett.

${contextGaps.length > 0 ? `Vi kan förbättra genom att:
${contextGaps.slice(0, 3).map(gap => `• ${gap}`).join('\n')}` : ''}

Vad vill du fokusera på härnäst?`;
    }

    return {
      response,
      contextGaps,
      completionScore,
      contextUpdates: null,
      suggestedQuestions: this.generateFollowUpQuestions(currentContext, business.business_type)
    };
  }

  private getBusinessTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      grocery_store: 'livsmedelsbutik',
      cafe: 'café', 
      restaurant: 'restaurang',
      retail: 'detaljhandel',
      pharmacy: 'apotek',
      electronics: 'elektronikbutik',
      clothing: 'klädbutik',
      other: 'verksamhet'
    };
    return labels[type] || 'verksamhet';
  }
}

// Export singleton instance
let aiContextService: AIContextService | null = null;

export function getAIContextService(): AIContextService {
  if (!aiContextService) {
    try {
      aiContextService = new AIContextService();
    } catch (error) {
      console.error('Failed to initialize AI Context Service:', error);
      throw error;
    }
  }
  return aiContextService;
}

export type { BusinessContext, Business, ConversationMessage, AIAnalysisResult };